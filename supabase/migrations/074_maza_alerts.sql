-- ── maza_alerts ────────────────────────────────────────────────────────────────
-- Migration: 065
-- Created:   2026-06-01
-- Sprint:    Intelligence Layer — Alerting
-- Desc:      Alertas operacionais gerados pelo orquestrador de inteligência MAZA.
--            Suporta priorização P0–P3, multi-canal (whatsapp, email, slack) e
--            rastreamento de leitura/resolução por destinatário.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.maza_alerts (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo        TEXT        NOT NULL,                          -- ex: 'cmv_alto', 'meta_atingida', 'bug_critico'
  prioridade  TEXT        NOT NULL
                          CHECK (prioridade IN ('P0','P1','P2','P3')),
  mensagem    TEXT        NOT NULL,
  entidade    TEXT,                                          -- ex: 'unit', 'brand', 'employee'
  entidade_id UUID,                                         -- FK genérica — sem constraint para manter flexibilidade
  enviado_para TEXT[],                                      -- array de user_ids ou phone numbers
  canal       TEXT        DEFAULT 'whatsapp',               -- 'whatsapp' | 'email' | 'slack'
  enviado_em  TIMESTAMPTZ,
  lido        BOOLEAN     DEFAULT false,
  resolvido   BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maza_alerts_prioridade  ON public.maza_alerts(prioridade);
CREATE INDEX IF NOT EXISTS idx_maza_alerts_created     ON public.maza_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maza_alerts_resolvido   ON public.maza_alerts(resolvido);
CREATE INDEX IF NOT EXISTS idx_maza_alerts_entidade_id ON public.maza_alerts(entidade_id);

-- RLS
ALTER TABLE public.maza_alerts ENABLE ROW LEVEL SECURITY;

-- Founders e CFOs veem todos os alertas.
-- Gerentes de marca/unidade veem apenas alertas cuja entidade_id coincide com
-- alguma unit_id atribuída ao seu usuário via user_roles.
CREATE POLICY "maza_alerts_select" ON public.maza_alerts
  FOR SELECT
  USING (
    maza_is_founder_or_cfo()
    OR entidade_id IN (
      SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- Apenas founders e CFOs podem criar, atualizar ou deletar alertas.
-- O serviço (service_role) bypassa RLS automaticamente.
CREATE POLICY "maza_alerts_manage" ON public.maza_alerts
  FOR ALL
  USING     (maza_is_founder_or_cfo())
  WITH CHECK (maza_is_founder_or_cfo());
