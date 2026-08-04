-- Maza — 001_base_schema.sql
-- Fase 0 / Dia 2 — fundação multi-marca + RBAC + audit log.
-- Aplicação: rodar no SQL Editor do Supabase Dashboard (maza-dev), em ordem.
-- Idempotente nos CREATEs (IF NOT EXISTS) — re-rodar é seguro.

-- ── Holdings, marcas, unidades ──────────────────────────────────

CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  color       TEXT DEFAULT '#D4A574',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  whatsapp_number TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_group ON brands(group_id);
CREATE INDEX IF NOT EXISTS idx_units_brand  ON units(brand_id);

-- ── RBAC ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT
);

INSERT INTO roles (name, description) VALUES
  ('founder',         'Fundador — acesso total'),
  ('cfo',             'CFO — financeiro + relatórios'),
  ('gm',              'Gerente Geral — unidade completa'),
  ('pessoas',         'RH — módulo pessoas'),
  ('chef',            'Chef — cardápio + estoque'),
  ('comprador',       'Compras — fornecedores + estoque'),
  ('colaborador',     'Colaborador — acesso básico'),
  ('socio_readonly',  'Sócio — somente leitura')
ON CONFLICT (name) DO NOTHING;

-- user_roles vincula auth.users a um role num escopo (unit / brand / group).
-- Pelo menos um dos *_id deve estar setado — escopo "global" = só founder via group_id raiz.
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id     UUID REFERENCES roles(id) NOT NULL,
  unit_id     UUID REFERENCES units(id) ON DELETE CASCADE,
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE,
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role_id, unit_id),
  CHECK (unit_id IS NOT NULL OR brand_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_unit ON user_roles(unit_id);

-- ── Audit log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id),
  action       TEXT NOT NULL,
  resource     TEXT NOT NULL,
  resource_id  TEXT,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource, resource_id);

-- ── Helpers RBAC ────────────────────────────────────────────────
-- SECURITY DEFINER pra ler user_roles sem cair em recursão de RLS.
-- Função roda com privilégios do owner (postgres) — bypassa policies do user_roles.

CREATE OR REPLACE FUNCTION public.maza_is_founder()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'founder'
  );
$$;

CREATE OR REPLACE FUNCTION public.maza_has_role_for_unit(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.maza_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.unit_id = p_unit_id
      );
$$;

CREATE OR REPLACE FUNCTION public.maza_has_role_for_brand(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.maza_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.brand_id = p_brand_id
               OR ur.unit_id IN (SELECT id FROM units WHERE brand_id = p_brand_id))
      );
$$;

CREATE OR REPLACE FUNCTION public.maza_has_role_for_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.maza_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.group_id = p_group_id
               OR ur.brand_id IN (SELECT id FROM brands WHERE group_id = p_group_id))
      );
$$;

CREATE OR REPLACE FUNCTION public.maza_is_founder_or_cfo()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('founder', 'cfo')
  );
$$;
