-- ── 080_security_hardening.sql ──────────────────────────────────────────────
-- Sprint 1 Segurança — corrige 5 tabelas com políticas USING (true) excessivamente
-- permissivas e uma view sem security_invoker.
--
-- Princípios invioláveis seguidos:
--   • DROP POLICY IF EXISTS antes de qualquer CREATE POLICY (idempotente)
--   • Nenhum ALTER TABLE em tabelas existentes
--   • Views recriadas com CREATE OR REPLACE (idempotente)
--   • Sem INSERT/UPDATE de dados
--
-- Aplicar via: supabase db query --linked --file supabase/migrations/080_security_hardening.sql
-- Executar APÓS suspender as 10 rotas de cron da Vercel (elas usam service_role,
-- não são afetadas pelo RLS, mas a boa prática é não rodar migrations com crons ativos).
-- ────────────────────────────────────────────────────────────────────────────


-- ── 1. employee_auth ─────────────────────────────────────────────────────────
-- Contexto: o app mobile HOS autentica via service_role key, que bypassa RLS
-- automaticamente — nenhuma policy FOR authenticated é necessária.
-- Problema: "employee_auth_service_role_all" FOR ALL USING (true) permite que
-- qualquer usuário autenticado leia CPFs e hashes de senha de todos os colaboradores.
-- Fix: remover a policy permissiva. service_role continua acessando normalmente
-- (RLS é transparente para service_role). Default deny para authenticated/anon.

DROP POLICY IF EXISTS "employee_auth_service_role_all" ON employee_auth;

-- Sem CREATE POLICY: authenticated e anon recebem 0 linhas por default deny.
-- service_role bypassa RLS e continua com acesso total (comportamento do Supabase).


-- ── 2. theo_tickets ──────────────────────────────────────────────────────────
-- Contexto: o bot Theo (WhatsApp SAC interno) cria tickets via service_role.
-- Problema: "theo_tickets_service_role" FOR ALL USING (true) permite que qualquer
-- autenticado veja/modifique tickets de qualquer colaborador de qualquer marca.
-- Fix: SELECT restrito a quem tem role na unidade do colaborador vinculado.
-- Escrita: apenas service_role (bot). Nenhuma policy de escrita para authenticated.

DROP POLICY IF EXISTS "theo_tickets_service_role" ON theo_tickets;
DROP POLICY IF EXISTS "theo_tickets_select"        ON theo_tickets;

CREATE POLICY "theo_tickets_select" ON theo_tickets
  FOR SELECT TO authenticated
  USING (
    kph_is_founder()
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = theo_tickets.employee_id
        AND kph_has_role_for_unit(e.unit_id)
    )
  );


-- ── 3. candidates ────────────────────────────────────────────────────────────
-- Contexto: tabela de candidatos do pipeline web de R&S (não Maya/WhatsApp).
-- Problema: "candidates_service_role" FOR ALL USING (true) expõe todos os
-- candidatos a qualquer autenticado, sem restrição de role.
-- Fix: SELECT para roles com acesso a RH (pessoas, gm, founder). Escrita:
-- apenas service_role ou API routes com service_role (formulários web).

DROP POLICY IF EXISTS "candidates_service_role" ON candidates;
DROP POLICY IF EXISTS "candidates_select"        ON candidates;

CREATE POLICY "candidates_select" ON candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('founder', 'gm', 'pessoas')
    )
  );


-- ── 4. candidatos_maya ───────────────────────────────────────────────────────
-- Contexto: leads do agente Maya (WhatsApp R&S) — separado do pipeline web.
-- Problema: mesmo que candidates — "candidatos_maya_service_role" USING (true).
-- Fix: mesma política de candidates (roles HR org-wide).

DROP POLICY IF EXISTS "candidatos_maya_service_role" ON candidatos_maya;
DROP POLICY IF EXISTS "candidatos_maya_select"        ON candidatos_maya;

CREATE POLICY "candidatos_maya_select" ON candidatos_maya
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('founder', 'gm', 'pessoas')
    )
  );


-- ── 5. kph_learning_proposals ────────────────────────────────────────────────
-- Contexto: propostas do Learning Machine — aprovadas/descartadas via Orquestrador.
-- SELECT USING (true): intencional — transparência para todos os autenticados. Mantido.
-- Problema: UPDATE USING (true) permite que qualquer autenticado aprove/descarte
-- propostas de qualquer módulo, sem restrição de role.
-- Fix: UPDATE restrito a founder. Somente o Ike aprova ou descarta propostas.

DROP POLICY IF EXISTS "kph_learning_proposals_update"         ON kph_learning_proposals;
DROP POLICY IF EXISTS "kph_learning_proposals_update_founder" ON kph_learning_proposals;

CREATE POLICY "kph_learning_proposals_update_founder"
  ON kph_learning_proposals
  FOR UPDATE
  TO authenticated
  USING (kph_is_founder())
  WITH CHECK (status IN ('approved', 'dismissed'));


-- ── 6. tips_records VIEW ─────────────────────────────────────────────────────
-- Contexto: view usada pelo app mobile para consultar gorjetas por colaborador/mês.
-- Problema: criada sem WITH (security_invoker = true) — queries na view rodavam
-- com os privilégios do owner (postgres), bypassando o RLS de gorjeta_dias.
-- Fix: recriar com security_invoker = true. A view passa a respeitar o RLS da
-- tabela base (gorjeta_dias usa kph_has_role_for_unit) automaticamente.
--
-- Nota: o app mobile usa service_role → este fix não afeta o app.
-- O fix fecha a brecha para usuários autenticados sem role na unidade certa.

CREATE OR REPLACE VIEW public.tips_records
  WITH (security_invoker = true)
AS
SELECT
  md5(gd.employee_id::text || to_char(gd.data, 'YYYY-MM'))::uuid AS id,
  gd.employee_id,
  to_char(gd.data, 'YYYY-MM')                                     AS periodo,
  SUM(gd.pontos)::numeric(10,2)                                    AS total_pontos,
  SUM(gd.pontos)::numeric(10,2)                                    AS pontos_liquidos,
  CASE
    WHEN SUM(gd.pontos) > 0
    THEN (SUM(gd.valor_calculado) / SUM(gd.pontos))::numeric(10,4)
    ELSE 0
  END                                                              AS valor_ponto,
  SUM(gd.valor_calculado)::numeric(10,2)                          AS valor
FROM gorjeta_dias gd
WHERE gd.employee_id IS NOT NULL
GROUP BY gd.employee_id, to_char(gd.data, 'YYYY-MM');

COMMENT ON VIEW public.tips_records IS
  'Agrega gorjeta_dias por colaborador/mês para o app mobile HOS. Read-only. '
  'security_invoker=true: respeita RLS da tabela base (kph_has_role_for_unit).';


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — rodar SEPARADAMENTE no Supabase SQL Editor APÓS aplicar
-- esta migration. Simula um usuário autenticado sem roles atribuídas.
-- Todos os counts devem retornar 0.
--
-- 1. Abra o SQL Editor no painel do Supabase (projeto iqgrvptrtphvbmvrqntm)
-- 2. Cole e execute o bloco abaixo como um todo (BEGIN ... ROLLBACK)
-- ═══════════════════════════════════════════════════════════════════════════
/*
BEGIN;
  -- UUID inexistente em user_roles → simula usuário sem nenhuma role
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-EEEEEEEEEEEE","role":"authenticated"}';

  SELECT
    (SELECT count(*) FROM employee_auth)                 AS employee_auth_count,
    -- espera: 0 (sem policy para authenticated)

    (SELECT count(*) FROM theo_tickets)                  AS theo_tickets_count,
    -- espera: 0 (usuário não tem role em nenhuma unidade)

    (SELECT count(*) FROM candidates)                    AS candidates_count,
    -- espera: 0 (usuário não tem role 'founder'/'gm'/'pessoas')

    (SELECT count(*) FROM candidatos_maya)               AS candidatos_maya_count,
    -- espera: 0 (mesmo critério)

    (SELECT count(*)
     FROM kph_learning_proposals
     WHERE kph_is_founder())                             AS proposals_can_update;
    -- espera: 0 (não é founder — UPDATE policy rejeita)

ROLLBACK;
*/
