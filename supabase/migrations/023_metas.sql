-- Maza — 023_metas.sql
-- Sprint 4 / Etapa 2 — módulo Metas por marca.
--
-- Pré-req: 001 (groups/brands/units + helpers RBAC) · 010 (financeiro).
--
-- Aditivo: nenhuma tabela existente alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY antes de CREATE POLICY.
--
-- Modelagem:
--   • brand_targets: KPI alvos por marca/período. UNIQUE(brand_id, periodo)
--     garante 1 registro por marca por mês. unit_id NULL = alvo agregado.
--   • periodo TEXT: convenção YYYY-MM (alinha com financial_periods.competencia).
--   • Realizado vem das views v_dre_consolidado, v_eventos_kpi e
--     v_headcount_por_marca já existentes — não há GENERATED.
--   • target_notes: anotações livres por meta (auditoria/contexto).
--   • RLS espelha o padrão Brand (templates de treinamento/avaliação):
--     SELECT/INSERT/UPDATE via maza_has_role_for_brand; DELETE founder.

-- ── TABELAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_targets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID NOT NULL REFERENCES brands(id),
  unit_id               UUID REFERENCES units(id),
  periodo               TEXT NOT NULL,                 -- YYYY-MM
  receita_meta          NUMERIC(12,2),
  cmv_meta_pct          NUMERIC(5,2),
  prime_cost_meta_pct   NUMERIC(5,2),
  ticket_medio_meta     NUMERIC(10,2),
  nps_meta              NUMERIC(5,2),
  headcount_meta        INTEGER,
  eventos_meta          INTEGER,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, periodo)
);

CREATE TABLE IF NOT EXISTS target_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id   UUID NOT NULL REFERENCES brand_targets(id) ON DELETE CASCADE,
  nota        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brand_targets_brand     ON brand_targets(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_targets_unit      ON brand_targets(unit_id);
CREATE INDEX IF NOT EXISTS idx_brand_targets_periodo   ON brand_targets(periodo);
CREATE INDEX IF NOT EXISTS idx_target_notes_target     ON target_notes(target_id, created_at DESC);

-- ── updated_at TRIGGER ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_brand_targets_updated_at ON brand_targets;
CREATE TRIGGER trg_brand_targets_updated_at
  BEFORE UPDATE ON brand_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE brand_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_notes  ENABLE ROW LEVEL SECURITY;

-- brand_targets: SELECT/INSERT/UPDATE qualquer role na brand; DELETE founder.
DROP POLICY IF EXISTS "bt_select" ON brand_targets;
CREATE POLICY "bt_select" ON brand_targets FOR SELECT
  USING (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "bt_insert" ON brand_targets;
CREATE POLICY "bt_insert" ON brand_targets FOR INSERT
  WITH CHECK (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "bt_update" ON brand_targets;
CREATE POLICY "bt_update" ON brand_targets FOR UPDATE
  USING (maza_has_role_for_brand(brand_id))
  WITH CHECK (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "bt_delete" ON brand_targets;
CREATE POLICY "bt_delete" ON brand_targets FOR DELETE
  USING (maza_is_founder());

-- target_notes: cascade via parent target. Usa IN ao invés de EXISTS pra
-- evitar `bt.id` no SQL (o `.id` é TLD válido e renderers de chat o
-- transformam em hyperlink markdown ao colar — quebra o SQL).
DROP POLICY IF EXISTS "tn_select" ON target_notes;
CREATE POLICY "tn_select" ON target_notes FOR SELECT
  USING (target_id IN (
    SELECT id FROM brand_targets
    WHERE maza_has_role_for_brand(brand_id)
  ));

DROP POLICY IF EXISTS "tn_insert" ON target_notes;
CREATE POLICY "tn_insert" ON target_notes FOR INSERT
  WITH CHECK (target_id IN (
    SELECT id FROM brand_targets
    WHERE maza_has_role_for_brand(brand_id)
  ));

DROP POLICY IF EXISTS "tn_delete" ON target_notes;
CREATE POLICY "tn_delete" ON target_notes FOR DELETE
  USING (maza_is_founder());

-- ── GRANTS ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON brand_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON target_notes  TO authenticated;
