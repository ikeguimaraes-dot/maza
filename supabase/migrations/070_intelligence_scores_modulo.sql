-- Migration 070: padronizar coluna modulo em maza_intelligence_scores
-- Garante que a coluna existe (idempotente — ADD COLUMN IF NOT EXISTS)
-- e cria índice para leitura eficiente por módulo.
--
-- Alinha maza_intelligence_scores com maza_insights (que já tem coluna 'modulo').
-- Permite: SELECT * FROM maza_intelligence_scores WHERE modulo='pessoas' ORDER BY created_at DESC LIMIT 1

ALTER TABLE maza_intelligence_scores
  ADD COLUMN IF NOT EXISTS modulo text;

CREATE INDEX IF NOT EXISTS idx_kis_modulo
  ON maza_intelligence_scores (modulo, created_at DESC);
