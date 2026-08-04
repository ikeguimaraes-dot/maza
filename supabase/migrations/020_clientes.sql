-- Maza — 020_clientes.sql
-- Sprint 3 / Etapa 2 — módulo Cliente / CRM.
--
-- Pré-req: 001 (groups/brands/units + helpers RBAC) · 008 (events).
--
-- Aditivo: nenhuma tabela existente é alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY antes de CREATE POLICY.

-- ── TABELAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID NOT NULL REFERENCES brands(id),
  unit_id     UUID NOT NULL REFERENCES units(id),
  nome        TEXT NOT NULL,
  email       TEXT,
  telefone    TEXT,
  empresa     TEXT,
  origem      TEXT CHECK (origem IS NULL OR origem IN
                ('indicacao','site','instagram','whatsapp','evento','outro')),
  observacoes TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN
                ('ligacao','email','whatsapp','reuniao','visita','outro')),
  descricao   TEXT,
  data        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_unit             ON clients(unit_id);
CREATE INDEX IF NOT EXISTS idx_clients_brand            ON clients(brand_id);
CREATE INDEX IF NOT EXISTS idx_clients_ativo            ON clients(ativo);
CREATE INDEX IF NOT EXISTS idx_clients_origem           ON clients(origem);
CREATE INDEX IF NOT EXISTS idx_clients_created_at       ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_interactions_cli  ON client_interactions(client_id, data DESC);

-- ── updated_at TRIGGER (reusa função existente) ────────────────
DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_interactions  ENABLE ROW LEVEL SECURITY;

-- clients: SELECT/INSERT/UPDATE via role na unit; DELETE só founder.
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (maza_has_role_for_unit(unit_id))
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (maza_is_founder());

-- client_interactions: cascade via parent client.
DROP POLICY IF EXISTS "client_interactions_select" ON client_interactions;
CREATE POLICY "client_interactions_select" ON client_interactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = client_id AND maza_has_role_for_unit(c.unit_id)
  ));

DROP POLICY IF EXISTS "client_interactions_insert" ON client_interactions;
CREATE POLICY "client_interactions_insert" ON client_interactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = client_id AND maza_has_role_for_unit(c.unit_id)
  ));

DROP POLICY IF EXISTS "client_interactions_update" ON client_interactions;
CREATE POLICY "client_interactions_update" ON client_interactions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = client_id AND maza_has_role_for_unit(c.unit_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = client_id AND maza_has_role_for_unit(c.unit_id)
  ));

DROP POLICY IF EXISTS "client_interactions_delete" ON client_interactions;
CREATE POLICY "client_interactions_delete" ON client_interactions FOR DELETE
  USING (maza_is_founder());

-- ── GRANTS ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON clients             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_interactions TO authenticated;
