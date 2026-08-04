-- Maza — 008_events.sql
-- Fase E2 — módulo Eventos / Ordem de Serviço (O.S.).
--
-- Pré-req: 001 (groups/brands/units + RBAC + helpers) · 003 (employees) ·
-- 007 (roles 'comercial' e 'operacional').
--
-- Idempotente: tipos via DO/EXCEPTION (Postgres não tem CREATE TYPE IF NOT
-- EXISTS), CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS antes de cada
-- CREATE POLICY.
--
-- Aditivo: nenhuma tabela existente é alterada.

-- ── Enums ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'rascunho',
    'pendente_aprovacao',
    'aprovado',
    'em_andamento',
    'concluido',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE menu_item_category AS ENUM (
    'bar',
    'cozinha',
    'bebida_alcoolica',
    'bebida_nao_alcoolica',
    'entrada',
    'prato_principal',
    'sobremesa',
    'outros'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Tabela principal ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES groups(id),
  brand_id            UUID NOT NULL REFERENCES brands(id),
  unit_id             UUID REFERENCES units(id),
  nome                TEXT NOT NULL,
  tipo                TEXT,
  data_inicio         TIMESTAMPTZ NOT NULL,
  data_fim            TIMESTAMPTZ,
  num_convidados      INTEGER,
  responsavel_interno UUID REFERENCES auth.users(id),
  contato_cliente     TEXT,
  telefone_cliente    TEXT,
  email_cliente       TEXT,
  empresa_cliente     TEXT,
  observacoes         TEXT,
  status              event_status NOT NULL DEFAULT 'rascunho',
  valor_total         NUMERIC(12,2),
  valor_sinal         NUMERIC(12,2),
  valor_sinal_pago    BOOLEAN DEFAULT FALSE,
  created_by          UUID REFERENCES auth.users(id),
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  categoria       menu_item_category NOT NULL,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  quantidade      INTEGER,
  unidade         TEXT,
  preco_unitario  NUMERIC(10,2),
  observacoes     TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_infra_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  categoria     TEXT NOT NULL,
  item          TEXT NOT NULL,
  quantidade    INTEGER DEFAULT 1,
  responsavel   TEXT,
  status        TEXT DEFAULT 'pendente',
  observacoes   TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_staff (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  employee_id       UUID REFERENCES employees(id),
  nome_externo      TEXT,
  funcao            TEXT NOT NULL,
  horario_entrada   TIME,
  horario_saida     TIME,
  observacoes       TEXT,
  confirmado        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  tipo            TEXT,
  storage_path    TEXT NOT NULL,
  tamanho_bytes   BIGINT,
  uploaded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_status_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status_anterior   event_status,
  status_novo       event_status NOT NULL,
  changed_by        UUID REFERENCES auth.users(id),
  motivo            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_brand_id      ON events(brand_id);
CREATE INDEX IF NOT EXISTS idx_events_unit_id       ON events(unit_id);
CREATE INDEX IF NOT EXISTS idx_events_data_inicio   ON events(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_events_status        ON events(status);
CREATE INDEX IF NOT EXISTS idx_event_menu_items_event_id   ON event_menu_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_infra_items_event_id  ON event_infra_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_event_id        ON event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id  ON event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_status_log_event_id   ON event_status_log(event_id, created_at DESC);

-- ── updated_at trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.events_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_updated_at();

-- ── Helper: user pode ESCREVER em eventos da brand? ────────────
-- WRITE = founder / cfo / gm / comercial / operacional com role
-- pra brand (escopo brand_id direto, OU unit_id na brand, OU group_id da brand).
-- Reusa o padrão da função maza_has_role_for_brand pra resolver escopo.
CREATE OR REPLACE FUNCTION public.maza_can_write_event_brand(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.maza_is_founder()
      OR EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('founder','cfo','gm','comercial','operacional')
          AND (
            ur.brand_id = p_brand_id
            OR ur.unit_id IN (SELECT id FROM units WHERE brand_id = p_brand_id)
            OR ur.group_id IN (SELECT group_id FROM brands WHERE id = p_brand_id)
          )
      );
$$;

-- Helper: user pode DELETAR (founder/cfo only)
CREATE OR REPLACE FUNCTION public.maza_can_delete_event_brand(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.maza_is_founder()
      OR EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('founder','cfo')
          AND (
            ur.brand_id = p_brand_id
            OR ur.unit_id IN (SELECT id FROM units WHERE brand_id = p_brand_id)
            OR ur.group_id IN (SELECT group_id FROM brands WHERE id = p_brand_id)
          )
      );
$$;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_menu_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_infra_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staff         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_status_log    ENABLE ROW LEVEL SECURITY;

-- ── Policies — events ──────────────────────────────────────────
-- SELECT: qualquer role na brand (maza_has_role_for_brand já cobre escopos).
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events FOR SELECT
  USING (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (maza_can_write_event_brand(brand_id));

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update" ON events FOR UPDATE
  USING (maza_can_write_event_brand(brand_id));

DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_delete" ON events FOR DELETE
  USING (maza_can_delete_event_brand(brand_id));

-- ── Policies — filhos (cascade via parent brand) ───────────────
-- SELECT: tem acesso à brand do evento.
-- WRITE: pode escrever na brand do evento.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['event_menu_items','event_infra_items','event_staff','event_attachments','event_status_log']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %s', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %s FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM events e
          WHERE e.id = event_id AND maza_has_role_for_brand(e.brand_id)
        )
      )',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON %s', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %s FOR ALL USING (
        EXISTS (
          SELECT 1 FROM events e
          WHERE e.id = event_id AND maza_can_write_event_brand(e.brand_id)
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM events e
          WHERE e.id = event_id AND maza_can_write_event_brand(e.brand_id)
        )
      )',
      t, t
    );
  END LOOP;
END $$;
