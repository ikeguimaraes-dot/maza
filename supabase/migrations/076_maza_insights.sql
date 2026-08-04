-- ── maza_insights ──────────────────────────────────────────────────────────────
-- Migration: 067
-- Created:   2026-06-01
-- Sprint:    Intelligence Layer — AI Insights
-- Desc:      Insights gerados por LLM a partir dos módulos de inteligência MAZA.
--            Cada insight é vinculado a um módulo e uma semana; o campo
--            `dados_referencia` persiste os dados usados na geração para
--            rastreabilidade e re-avaliação posterior.
--            `aprovado` funciona como gate de publicação: insights não aprovados
--            ficam em rascunho até revisão humana.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.maza_insights (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Módulo de inteligência que gerou o insight
  modulo           TEXT    NOT NULL
                           CHECK (modulo IN ('wbr','metas','cross','adocao','orquestrador','geral')),

  -- Semana de referência (segunda-feira da semana, ISO)
  semana           DATE    NOT NULL,

  insight_text     TEXT    NOT NULL,

  -- Snapshot dos dados usados na geração (métricas, séries, thresholds)
  dados_referencia JSONB,

  -- Modelo que gerou o insight — default reflete o modelo corrente em produção
  gerado_por       TEXT    DEFAULT 'claude-sonnet-4-6',

  -- Gate de publicação: false = rascunho, true = aprovado para exibição
  aprovado         BOOLEAN DEFAULT false,

  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maza_insights_modulo   ON public.maza_insights(modulo);
CREATE INDEX IF NOT EXISTS idx_maza_insights_semana   ON public.maza_insights(semana DESC);
CREATE INDEX IF NOT EXISTS idx_maza_insights_aprovado ON public.maza_insights(aprovado);

-- RLS
ALTER TABLE public.maza_insights ENABLE ROW LEVEL SECURITY;

-- Insights são conteúdo executivo gerado por IA — acesso restrito a founders e CFO.
CREATE POLICY "maza_insights_select" ON public.maza_insights
  FOR SELECT
  USING (maza_is_founder_or_cfo());

CREATE POLICY "maza_insights_manage" ON public.maza_insights
  FOR ALL
  USING     (maza_is_founder_or_cfo())
  WITH CHECK (maza_is_founder_or_cfo());
