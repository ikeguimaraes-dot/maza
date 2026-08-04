-- ── 081_disable_bypass_user.sql ──────────────────────────────────────────────
-- Sprint 1 Segurança — desabilita a conta bypass@maza.local via banned_until.
--
-- Princípios invioláveis:
--   • NÃO usa DELETE — preserva FK em registros históricos de ponto/audit_log.
--   • banned_until = 'infinity' impede login sem remover o registro.
--   • WHERE filtra por email E id — nunca afeta outros registros.
--   • Idempotente: rodar 2× não altera nada além do que já foi alterado.
--
-- Pré-condição: auth real funcional em produção (middleware + requireUser OK).
-- Aplicar via: supabase db query --linked --file supabase/migrations/081_disable_bypass_user.sql
-- ────────────────────────────────────────────────────────────────────────────

UPDATE auth.users
SET    banned_until = 'infinity'
WHERE  email = 'bypass@maza.local'
  AND  id    = '00000000-0000-0000-0000-000000000001';

-- Verificação — deve retornar 1 linha com banned_until = 'infinity'
-- SELECT id, email, banned_until FROM auth.users WHERE email = 'bypass@maza.local';
