-- Maza — Fase 1 / Módulo Pessoas
-- Aplicar APÓS 001 + 002 (helpers RBAC maza_has_role_for_unit precisam existir).
-- Idempotente.

-- ── Colaboradores ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES auth.users(id),
  nome            TEXT NOT NULL,
  sobrenome       TEXT NOT NULL,
  cpf             TEXT UNIQUE,
  ctps            TEXT,
  funcao          TEXT NOT NULL,
  salario_base    NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_admissao   DATE NOT NULL,
  data_demissao   DATE,
  ativo           BOOLEAN DEFAULT TRUE,
  banco           TEXT,
  agencia         TEXT,
  conta           TEXT,
  tipo_conta      TEXT,
  pix             TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Turnos / escala ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  unit_id         UUID REFERENCES units(id) NOT NULL,
  data            DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fim        TIME NOT NULL,
  tipo            TEXT DEFAULT 'normal', -- normal, extra, folga, feriado
  labor_cost      NUMERIC(10,2),
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, data)
);

-- ── Ponto ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_clock_punches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  tipo            TEXT NOT NULL, -- entrada, saida, intervalo_inicio, intervalo_fim
  timestamp_punch TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  device_info     TEXT,
  aprovado        BOOLEAN DEFAULT NULL, -- null = pendente, true = aprovado, false = rejeitado
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Banco de horas ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_bank_balance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  saldo_minutos   INTEGER DEFAULT 0,
  ultimo_calculo  DATE,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id)
);

-- ── Holerites ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payslips (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  competencia                 DATE NOT NULL, -- primeiro dia do mês
  salario_base                NUMERIC(10,2) NOT NULL,
  horas_extras                NUMERIC(10,2) DEFAULT 0,
  adicional_noturno           NUMERIC(10,2) DEFAULT 0,
  gorjeta                     NUMERIC(10,2) DEFAULT 0,
  dsr_gorjeta                 NUMERIC(10,2) DEFAULT 0,
  desconto_inss               NUMERIC(10,2) DEFAULT 0,
  desconto_irrf               NUMERIC(10,2) DEFAULT 0,
  desconto_vale_transporte    NUMERIC(10,2) DEFAULT 0,
  desconto_vale_refeicao      NUMERIC(10,2) DEFAULT 0,
  outros_descontos            NUMERIC(10,2) DEFAULT 0,
  outros_acrescimos           NUMERIC(10,2) DEFAULT 0,
  liquido                     NUMERIC(10,2) NOT NULL,
  status                      TEXT DEFAULT 'rascunho', -- rascunho, aprovado, pago
  pdf_url                     TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, competencia)
);

-- ── CCT versionada (Sinthoresp / Sindresbar) ───────────────────

CREATE TABLE IF NOT EXISTS cct_versions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sindicato               TEXT NOT NULL,
  vigencia_inicio         DATE NOT NULL,
  vigencia_fim            DATE NOT NULL,
  piso_salarial           NUMERIC(10,2),
  adicional_noturno_pct   NUMERIC(5,2) DEFAULT 20,
  hora_extra_50_pct       NUMERIC(5,2) DEFAULT 50,
  hora_extra_100_pct      NUMERIC(5,2) DEFAULT 100,
  gorjeta_percentual      NUMERIC(5,2),
  dsr_sobre_gorjeta       BOOLEAN DEFAULT TRUE,
  dados_completos         JSONB,
  ativo                   BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_employees_unit       ON employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_data ON shifts(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_shifts_unit_data     ON shifts(unit_id, data);
CREATE INDEX IF NOT EXISTS idx_punches_employee     ON time_clock_punches(employee_id, timestamp_punch DESC);
CREATE INDEX IF NOT EXISTS idx_payslips_employee    ON payslips(employee_id, competencia DESC);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_clock_punches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_bank_balance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cct_versions        ENABLE ROW LEVEL SECURITY;

-- Policies básicas (founder e qualquer role na unit veem; mutations idem).

DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees FOR UPDATE
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts FOR SELECT
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "shifts_all" ON shifts;
CREATE POLICY "shifts_all" ON shifts FOR ALL
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "punches_select" ON time_clock_punches;
CREATE POLICY "punches_select" ON time_clock_punches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND maza_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "payslips_select" ON payslips;
CREATE POLICY "payslips_select" ON payslips FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND maza_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "cct_select" ON cct_versions;
CREATE POLICY "cct_select" ON cct_versions FOR SELECT TO authenticated USING (TRUE);
