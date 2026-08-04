-- Maza — 007_marcas_hos.sql
-- Fase E1 — semeia as 11 marcas operacionais do Grupo HOS na holding MAZA
-- e cria a tabela brand_links (consolida os 12 portais Netlify externos
-- num único módulo /marcas dentro da Maza).
--
-- Pré-req: 001 (groups/brands/units/roles + helpers RBAC) + seed.sql
-- (group 'maza' e brand 'madonna-cucina').
--
-- Idempotente: ON CONFLICT DO NOTHING / CREATE IF NOT EXISTS / DROP POLICY
-- IF EXISTS antes de cada CREATE POLICY / NOT EXISTS no seed de links.

-- ── Roles novos exigidos pelo módulo Eventos (Fase E2) ─────────
INSERT INTO roles (name, description) VALUES
  ('comercial',   'Comercial — vendas + propostas + O.S. eventos'),
  ('operacional', 'Operacional — execução de eventos + escala')
ON CONFLICT (name) DO NOTHING;

-- ── Marcas operacionais (skip madonna-cucina, já está no seed) ─
WITH g AS (SELECT id FROM groups WHERE slug = 'maza')
INSERT INTO brands (group_id, slug, name, color, active)
SELECT g.id, b.slug, b.name, b.color, TRUE
FROM g, (VALUES
  ('meet-eat',       'Meet & Eat',     '#A89368'),
  ('match-point',    'Match Point',    '#2E5984'),
  ('the-forge',      'The Forge',      '#5C3A21'),
  ('klauss',         'Klauss',         '#7A1E1E'),
  ('pipokae',        'Pipokaê',        '#E8A33E'),
  ('pipou-academy',  'PIPOU Academy',  '#9B59B6'),
  ('sushi-muu',      'Sushi Muu',      '#1F3A5F'),
  ('rojo',           'Rojo',           '#C0392B'),
  ('burguer',        'Burguer',        '#8B4513'),
  ('trato',          'Trato',          '#3D5A3D')
) AS b(slug, name, color)
ON CONFLICT (slug) DO NOTHING;

-- ── brand_links: links externos consolidados por marca ─────────
CREATE TABLE IF NOT EXISTS brand_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  kind        TEXT NOT NULL,  -- drive | dashboard | instagram | site | report | other
  url         TEXT NOT NULL,
  label       TEXT,           -- override do label exibido (default vem do kind)
  ordem       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_links_brand ON brand_links(brand_id, ordem);
ALTER TABLE brand_links ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário com role na marca (founder via helper).
DROP POLICY IF EXISTS "brand_links_select" ON brand_links;
CREATE POLICY "brand_links_select" ON brand_links FOR SELECT
  USING (maza_has_role_for_brand(brand_id));

-- WRITE: founder/cfo (governança de links externos).
DROP POLICY IF EXISTS "brand_links_write" ON brand_links;
CREATE POLICY "brand_links_write" ON brand_links FOR ALL
  USING (maza_is_founder_or_cfo());

-- ── Seed dos links extraídos dos sub-portais Netlify ───────────
-- Coletado em 2026-04-27 via curl direto nos portal-{slug}.netlify.app.
-- portal-trato.netlify.app retornou 404 — entrar manualmente depois.
-- IG genérico (instagram.com/) sem usuário foi descartado.
INSERT INTO brand_links (brand_id, kind, url, label, ordem)
SELECT b.id, l.kind, l.url, l.label, l.ordem
FROM brands b
JOIN (VALUES
  ('meet-eat',      'dashboard', 'https://meetandeat-dashboard-wrxm.vercel.app/',                                              NULL,        1),
  ('meet-eat',      'report',    'https://relatorio-meet.netlify.app/',                                                       'Relatório', 2),
  ('madonna-cucina','dashboard', 'https://meetandeat-dashboard-wrxm.vercel.app/',                                              NULL,        1),
  ('match-point',   'drive',     'https://drive.google.com/drive/folders/1p5_STPwifJHkW9Ys7v324VcarKbqtgLi?usp=sharing',       NULL,        1),
  ('match-point',   'dashboard', 'https://meetandeat-dashboard-wrxm.vercel.app/',                                              NULL,        2),
  ('match-point',   'instagram', 'https://www.instagram.com/matchpoint_sp/',                                                  NULL,        3),
  ('the-forge',     'drive',     'https://drive.google.com/drive/folders/16x7H18kxWtIWvjD-NgfcIRulNYRlXzdA?usp=sharing',       NULL,        1),
  ('the-forge',     'dashboard', 'https://moonlit-pegasus-0c90ce.netlify.app/',                                                NULL,        2),
  ('klauss',        'drive',     'https://drive.google.com/drive/folders/12GysoqledahOWEKJic08JLPeV0Hyq3ps?usp=sharing',       NULL,        1),
  ('pipokae',       'drive',     'https://drive.google.com/drive/folders/18CRFWx7W--KSNv1LyTXGG4qlEDCA_BNW?usp=sharing',       NULL,        1),
  ('pipokae',       'site',      'https://pipokae.netlify.app/',                                                               NULL,        2),
  ('pipou-academy', 'drive',     'https://drive.google.com/drive/folders/1hXNVcl37crtZvStowBQHsq6saF0GXvpq?usp=sharing',       NULL,        1),
  ('pipou-academy', 'site',      'https://portal-pipou.netlify.app/',                                                          NULL,        2),
  ('sushi-muu',     'drive',     'https://drive.google.com/drive/folders/1nDH4vYggQw86TD8vKRr96yffJ-KmFNIN?usp=sharing',       NULL,        1),
  ('rojo',          'drive',     'https://drive.google.com/drive/folders/1oihwq9QgvOTt5GgiQLj0NeQ5zDTaLtR0?usp=sharing',       NULL,        1),
  ('burguer',       'drive',     'https://drive.google.com/drive/folders/1Nhhrf5ziHLANa_aMvVZfAWl1HobtV4XY?usp=sharing',       NULL,        1)
) AS l(brand_slug, kind, url, label, ordem)
  ON b.slug = l.brand_slug
WHERE NOT EXISTS (
  SELECT 1 FROM brand_links bl
  WHERE bl.brand_id = b.id AND bl.kind = l.kind AND bl.url = l.url
);
