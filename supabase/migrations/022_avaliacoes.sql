-- Maza — 022_avaliacoes.sql
-- Sprint 4 / Etapa 1 — módulo Avaliação de desempenho.
--
-- Pré-req: 001 (groups/brands/units + helpers RBAC) · 003 (employees).
--
-- Aditivo: nenhuma tabela existente é alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY antes de CREATE POLICY.
--
-- Notas de modelagem:
--   • performance_templates.criterios é um array JSON de objetos:
--       [{ id, nome, descricao, peso, tipo: 'nota_1_5' | 'sim_nao' | 'texto' }]
--     A app valida o shape com zod no client; aqui o tipo é só JSONB.
--   • performance_reviews.respostas é um mapa {criterio_id: valor}.
--   • nota_geral é a média ponderada das respostas tipo 'nota_1_5' calculada
--     pela app no save (não via GENERATED — depende de criterios em outra row).
--   • RLS em templates: maza_has_role_for_brand (espelha training_templates).
--   • RLS em reviews: cascade via employee.unit_id (espelha training_records).

-- ── TABELAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id),
  unit_id         UUID REFERENCES units(id),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  funcao          TEXT,             -- filtro por cargo (NULL = todos)
  periodicidade   TEXT NOT NULL CHECK (periodicidade IN
                    ('mensal','trimestral','semestral','anual')),
  criterios       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo           BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id       UUID NOT NULL REFERENCES performance_templates(id),
  avaliador_id      UUID REFERENCES auth.users(id),
  periodo           TEXT NOT NULL,                          -- ex: '2026-Q1', '2026-04', '2026-S1'
  status            TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','concluida','aprovada')),
  nota_geral        NUMERIC(4,2),                           -- 0.00 — 5.00 (média ponderada)
  respostas         JSONB NOT NULL DEFAULT '{}'::jsonb,
  pontos_fortes     TEXT,
  pontos_melhoria   TEXT,
  plano_acao        TEXT,
  data_avaliacao    DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_performance_templates_brand     ON performance_templates(brand_id);
CREATE INDEX IF NOT EXISTS idx_performance_templates_unit      ON performance_templates(unit_id);
CREATE INDEX IF NOT EXISTS idx_performance_templates_funcao    ON performance_templates(funcao);
CREATE INDEX IF NOT EXISTS idx_performance_templates_ativo     ON performance_templates(ativo);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee    ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_template    ON performance_reviews(template_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_avaliador   ON performance_reviews(avaliador_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_periodo     ON performance_reviews(periodo);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status      ON performance_reviews(status);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_data        ON performance_reviews(data_avaliacao DESC);

-- ── updated_at TRIGGERS ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_performance_templates_updated_at ON performance_templates;
CREATE TRIGGER trg_performance_templates_updated_at
  BEFORE UPDATE ON performance_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_performance_reviews_updated_at ON performance_reviews;
CREATE TRIGGER trg_performance_reviews_updated_at
  BEFORE UPDATE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE performance_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews   ENABLE ROW LEVEL SECURITY;

-- performance_templates: SELECT/INSERT/UPDATE qualquer role na brand;
--                        DELETE só founder.
DROP POLICY IF EXISTS "pt_select" ON performance_templates;
CREATE POLICY "pt_select" ON performance_templates FOR SELECT
  USING (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "pt_insert" ON performance_templates;
CREATE POLICY "pt_insert" ON performance_templates FOR INSERT
  WITH CHECK (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "pt_update" ON performance_templates;
CREATE POLICY "pt_update" ON performance_templates FOR UPDATE
  USING (maza_has_role_for_brand(brand_id))
  WITH CHECK (maza_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "pt_delete" ON performance_templates;
CREATE POLICY "pt_delete" ON performance_templates FOR DELETE
  USING (maza_is_founder());

-- performance_reviews: cascade via employee.unit_id.
DROP POLICY IF EXISTS "pr_select" ON performance_reviews;
CREATE POLICY "pr_select" ON performance_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND maza_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "pr_insert" ON performance_reviews;
CREATE POLICY "pr_insert" ON performance_reviews FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND maza_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "pr_update" ON performance_reviews;
CREATE POLICY "pr_update" ON performance_reviews FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND maza_has_role_for_unit(e.unit_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND maza_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "pr_delete" ON performance_reviews;
CREATE POLICY "pr_delete" ON performance_reviews FOR DELETE
  USING (maza_is_founder());

-- ── GRANTS ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_reviews   TO authenticated;
