-- Maza — seed inicial (Fase 0 / Dia 2).
-- Aplicar APÓS 001 + 002. Idempotente (ON CONFLICT DO NOTHING nos slugs UNIQUE).
--
-- Cria o grupo Maza, a primeira marca e a primeira unidade
-- (SP Itaim) — espelha a realidade atual do grupo.

INSERT INTO groups (slug, name)
VALUES ('maza', 'Maza')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO brands (group_id, slug, name, color, active)
SELECT id, 'madonna-cucina', 'Madonna Cucina', '#D4A574', TRUE
FROM groups WHERE slug = 'maza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO units (brand_id, name, address, whatsapp_number, active)
SELECT b.id, 'Madonna SP Itaim', 'Rua Pedroso Alvarenga, 677 - Itaim Bibi, São Paulo', '+5511988302367', TRUE
FROM brands b WHERE b.slug = 'madonna-cucina'
  AND NOT EXISTS (
    SELECT 1 FROM units u WHERE u.brand_id = b.id AND u.name = 'Madonna SP Itaim'
  );

-- Vincular o founder ao próprio Ike: depois que Ike fizer login no Supabase Auth uma vez,
-- pegar auth.uid() e rodar:
--
-- INSERT INTO user_roles (user_id, role_id, group_id)
-- SELECT '<auth.uid do Ike>'::uuid, r.id, g.id
-- FROM roles r, groups g
-- WHERE r.name = 'founder' AND g.slug = 'maza';
