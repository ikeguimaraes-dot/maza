-- ── maza_intelligence_scores ───────────────────────────────────────────────────
-- Migration: 066
-- Created:   2026-06-01
-- Sprint:    Intelligence Layer — Weekly Score
-- Desc:      Score semanal de saúde do sistema MAZA, calculado pelo orquestrador.
--            Cada dimensão (CMV, EBITDA, metas, adoção, bugs) contribui com um
--            sub-score 0–100; o campo `score` agrega o índice composto.
--            `breakdown` armazena o JSON completo do cálculo para auditoria.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.maza_intelligence_scores (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Semana de referência (segunda-feira da semana, ISO).
  -- UNIQUE garante exatamente um score por semana — use UPSERT na aplicação.
  semana        DATE    NOT NULL,

  -- Score composto 0–100
  score         INTEGER NOT NULL CHECK (score         BETWEEN 0 AND 100),

  -- Sub-scores por dimensão (nullable: ausente = não calculado nesta semana)
  cmv_score     INTEGER          CHECK (cmv_score     BETWEEN 0 AND 100),
  ebitda_score  INTEGER          CHECK (ebitda_score  BETWEEN 0 AND 100),
  metas_score   INTEGER          CHECK (metas_score   BETWEEN 0 AND 100),
  adocao_score  INTEGER          CHECK (adocao_score  BETWEEN 0 AND 100),
  bugs_score    INTEGER          CHECK (bugs_score    BETWEEN 0 AND 100),

  -- Payload completo de cálculo (pesos, valores brutos, anomalias detectadas)
  breakdown     JSONB,

  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT maza_intelligence_scores_semana_key UNIQUE (semana)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intelligence_score_semana ON public.maza_intelligence_scores(semana DESC);

-- RLS
ALTER TABLE public.maza_intelligence_scores ENABLE ROW LEVEL SECURITY;

-- Scores de inteligência são dados internos de nível executivo.
CREATE POLICY "maza_intelligence_scores_select" ON public.maza_intelligence_scores
  FOR SELECT
  USING (maza_is_founder_or_cfo());

CREATE POLICY "maza_intelligence_scores_manage" ON public.maza_intelligence_scores
  FOR ALL
  USING     (maza_is_founder_or_cfo())
  WITH CHECK (maza_is_founder_or_cfo());
