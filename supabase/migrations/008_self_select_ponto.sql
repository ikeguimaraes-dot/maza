-- Self-select pra colaborador no /ponto.
--
-- Bug original: as policies SELECT de employees e time_clock_punches só
-- aceitam maza_has_role_for_unit(unit_id) — colaborador puro (sem entry em
-- user_roles) NÃO consegue ver o próprio registro nem os próprios punches.
-- /ponto chama getMyEmployee() que retornava null mesmo com user_id setado,
-- mostrando "conta não vinculada".
--
-- Fix: adicionar policy ADICIONAL pra cada tabela permitindo SELECT do
-- próprio registro. Múltiplas policies SELECT são combinadas com OR pelo
-- Postgres — o caminho via role continua funcionando pra GM/founder.
--
-- Idempotente.

-- 1) Colaborador vê o próprio cadastro
DROP POLICY IF EXISTS "employees_self_select" ON employees;
CREATE POLICY "employees_self_select" ON employees FOR SELECT
  USING (user_id = auth.uid());

-- 2) Colaborador vê os próprios punches (timeline /ponto)
DROP POLICY IF EXISTS "punches_self_select" ON time_clock_punches;
CREATE POLICY "punches_self_select" ON time_clock_punches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND e.user_id = auth.uid()
  ));
