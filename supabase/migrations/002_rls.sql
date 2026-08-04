-- Maza — 002_rls.sql
-- Fase 0 / Dia 2 — RLS em todas as tabelas com default deny.
-- Aplicar DEPOIS de 001_base_schema.sql.
--
-- Princípio: ENABLE RLS em tudo. Sem policy = sem acesso (default deny).
-- Helpers maza_* foram criados em 001 (SECURITY DEFINER) e bypassam recursão.

-- ── ENABLE RLS ──────────────────────────────────────────────────

ALTER TABLE groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands      ENABLE ROW LEVEL SECURITY;
ALTER TABLE units       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;

-- ── groups ─────────────────────────────────────────────────────
-- SELECT: autenticado com qualquer role no group; founder vê tudo.
-- Mutations: só founder.

DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups
  FOR SELECT TO authenticated
  USING (public.maza_has_role_for_group(id));

DROP POLICY IF EXISTS "groups_insert" ON groups;
CREATE POLICY "groups_insert" ON groups
  FOR INSERT TO authenticated
  WITH CHECK (public.maza_is_founder());

DROP POLICY IF EXISTS "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups
  FOR UPDATE TO authenticated
  USING (public.maza_is_founder())
  WITH CHECK (public.maza_is_founder());

DROP POLICY IF EXISTS "groups_delete" ON groups;
CREATE POLICY "groups_delete" ON groups
  FOR DELETE TO authenticated
  USING (public.maza_is_founder());

-- ── brands ─────────────────────────────────────────────────────
-- SELECT: autenticado com role na brand (ou em unit dela); founder vê tudo.
-- Mutations: só founder ou GM da brand.

DROP POLICY IF EXISTS "brands_select" ON brands;
CREATE POLICY "brands_select" ON brands
  FOR SELECT TO authenticated
  USING (public.maza_has_role_for_brand(id));

DROP POLICY IF EXISTS "brands_insert" ON brands;
CREATE POLICY "brands_insert" ON brands
  FOR INSERT TO authenticated
  WITH CHECK (public.maza_is_founder());

DROP POLICY IF EXISTS "brands_update" ON brands;
CREATE POLICY "brands_update" ON brands
  FOR UPDATE TO authenticated
  USING (public.maza_is_founder() OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = brands.id
      AND r.name IN ('founder', 'gm')
  ))
  WITH CHECK (public.maza_is_founder() OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = brands.id
      AND r.name IN ('founder', 'gm')
  ));

DROP POLICY IF EXISTS "brands_delete" ON brands;
CREATE POLICY "brands_delete" ON brands
  FOR DELETE TO authenticated
  USING (public.maza_is_founder());

-- ── units ──────────────────────────────────────────────────────
-- SELECT: autenticado com role na unit (ou na brand pai); founder vê tudo.
-- Mutations: founder ou GM da unit.

DROP POLICY IF EXISTS "units_select" ON units;
CREATE POLICY "units_select" ON units
  FOR SELECT TO authenticated
  USING (public.maza_has_role_for_unit(id));

DROP POLICY IF EXISTS "units_insert" ON units;
CREATE POLICY "units_insert" ON units
  FOR INSERT TO authenticated
  WITH CHECK (public.maza_is_founder());

DROP POLICY IF EXISTS "units_update" ON units;
CREATE POLICY "units_update" ON units
  FOR UPDATE TO authenticated
  USING (public.maza_is_founder() OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.unit_id = units.id
      AND r.name IN ('founder', 'gm')
  ))
  WITH CHECK (public.maza_is_founder() OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.unit_id = units.id
      AND r.name IN ('founder', 'gm')
  ));

DROP POLICY IF EXISTS "units_delete" ON units;
CREATE POLICY "units_delete" ON units
  FOR DELETE TO authenticated
  USING (public.maza_is_founder());

-- ── roles ──────────────────────────────────────────────────────
-- Tabela de catálogo: SELECT pra qualquer autenticado, mutations só founder
-- (a lista de roles é estável — alterar via migration).

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "roles_mutate" ON roles;
CREATE POLICY "roles_mutate" ON roles
  FOR ALL TO authenticated
  USING (public.maza_is_founder())
  WITH CHECK (public.maza_is_founder());

-- ── user_roles ─────────────────────────────────────────────────
-- SELECT: próprio registro OU founder.
-- Mutations: só founder.

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.maza_is_founder());

DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.maza_is_founder());

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles
  FOR UPDATE TO authenticated
  USING (public.maza_is_founder())
  WITH CHECK (public.maza_is_founder());

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles
  FOR DELETE TO authenticated
  USING (public.maza_is_founder());

-- ── audit_log ──────────────────────────────────────────────────
-- SELECT: founder + cfo.
-- INSERT: só service_role (Edge Functions / triggers). Authenticated não escreve direto.
-- UPDATE/DELETE: bloqueado (sem policy = deny).

DROP POLICY IF EXISTS "audit_select" ON audit_log;
CREATE POLICY "audit_select" ON audit_log
  FOR SELECT TO authenticated
  USING (public.maza_is_founder_or_cfo());

DROP POLICY IF EXISTS "audit_insert_service" ON audit_log;
CREATE POLICY "audit_insert_service" ON audit_log
  FOR INSERT TO service_role
  WITH CHECK (TRUE);
