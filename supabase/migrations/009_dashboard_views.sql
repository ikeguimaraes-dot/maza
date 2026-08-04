-- Maza — 009_dashboard_views.sql
-- Fase E3 — views agregadoras pro Dashboard Executivo Consolidado.
--
-- Aditivo: nenhuma tabela existente alterada. Apenas CREATE OR REPLACE VIEW.
--
-- Pré-req: 001 (groups/brands/units + RLS) · 003 (employees) · 008 (events).
--
-- ⚠️  RLS em views: por padrão, views rodam com privilégios do owner
-- (postgres) e ignoram RLS das tabelas-base. WITH (security_invoker = true)
-- (Postgres 15+, suportado pelo Supabase) força a view a executar com os
-- privilégios do caller, herdando o RLS de events/employees/brands.

-- ── KPIs de eventos por marca / mês ────────────────────────────
CREATE OR REPLACE VIEW v_eventos_kpi
  WITH (security_invoker = true) AS
SELECT
  e.brand_id,
  b.name  AS brand_name,
  b.color AS brand_color,
  b.slug  AS brand_slug,
  DATE_TRUNC('month', e.data_inicio) AS mes,
  COUNT(*) AS total_eventos,
  COUNT(*) FILTER (WHERE e.status = 'aprovado')           AS eventos_aprovados,
  COUNT(*) FILTER (WHERE e.status = 'em_andamento')       AS eventos_em_andamento,
  COUNT(*) FILTER (WHERE e.status = 'concluido')          AS eventos_concluidos,
  COUNT(*) FILTER (WHERE e.status = 'cancelado')          AS eventos_cancelados,
  COUNT(*) FILTER (WHERE e.status = 'pendente_aprovacao') AS eventos_pendentes,
  COALESCE(SUM(e.valor_total) FILTER (WHERE e.status NOT IN ('cancelado','rascunho')), 0) AS receita_prevista,
  COALESCE(SUM(e.valor_total) FILTER (WHERE e.status = 'concluido'), 0)                   AS receita_realizada,
  COALESCE(SUM(e.num_convidados) FILTER (WHERE e.status NOT IN ('cancelado','rascunho')), 0) AS total_convidados
FROM events e
JOIN brands b ON b.id = e.brand_id
GROUP BY e.brand_id, b.name, b.color, b.slug, DATE_TRUNC('month', e.data_inicio);

-- ── Headcount por marca (ativos / movimentações do mês) ────────
CREATE OR REPLACE VIEW v_headcount_por_marca
  WITH (security_invoker = true) AS
SELECT
  u.brand_id,
  b.name AS brand_name,
  b.slug AS brand_slug,
  COUNT(*) FILTER (WHERE emp.ativo = TRUE)                                                    AS headcount_ativo,
  COUNT(*) FILTER (WHERE emp.ativo = FALSE AND emp.data_demissao >= DATE_TRUNC('month', NOW()))  AS demissoes_mes,
  COUNT(*) FILTER (WHERE emp.ativo = TRUE  AND emp.data_admissao >= DATE_TRUNC('month', NOW()))  AS admissoes_mes,
  COALESCE(SUM(emp.salario_base) FILTER (WHERE emp.ativo = TRUE), 0)                          AS folha_bruta
FROM employees emp
JOIN units  u ON u.id = emp.unit_id
JOIN brands b ON b.id = u.brand_id
GROUP BY u.brand_id, b.name, b.slug;

-- ── Próximos eventos (30 dias) com counts pré-computados ───────
CREATE OR REPLACE VIEW v_proximos_eventos
  WITH (security_invoker = true) AS
SELECT
  e.id,
  e.nome,
  e.data_inicio,
  e.data_fim,
  e.status,
  e.num_convidados,
  e.valor_total,
  e.tipo,
  e.contato_cliente,
  b.name  AS brand_name,
  b.color AS brand_color,
  b.slug  AS brand_slug,
  u.name  AS unit_name,
  (SELECT COUNT(*) FROM event_menu_items mi WHERE mi.event_id = e.id) AS total_itens_cardapio,
  (SELECT COUNT(*) FROM event_staff      es WHERE es.event_id = e.id) AS total_equipe
FROM events e
JOIN brands b      ON b.id = e.brand_id
LEFT JOIN units u  ON u.id = e.unit_id
WHERE e.data_inicio >= NOW()
  AND e.data_inicio <= NOW() + INTERVAL '30 days'
  AND e.status NOT IN ('cancelado', 'rascunho');

-- ── Alertas operacionais ───────────────────────────────────────
-- ORDER BY: severidade textual ('error' < 'warning' alfabeticamente).
-- DESC textual colocaria 'warning' primeiro — invertido. Uso CASE pra
-- garantir critical/error em primeiro lugar.
CREATE OR REPLACE VIEW v_alertas
  WITH (security_invoker = true) AS
SELECT * FROM (
  -- Eventos pendentes de aprovação há mais de 24h
  SELECT
    'evento_pendente'::text AS tipo_alerta,
    'warning'::text         AS severidade,
    e.brand_id,
    b.name AS brand_name,
    e.id   AS resource_id,
    'O.S. ' || e.nome || ' aguarda aprovação há ' ||
      ((EXTRACT(EPOCH FROM (NOW() - e.created_at))::int) / 3600)::text || 'h' AS mensagem,
    e.created_at AS created_at
  FROM events e
  JOIN brands b ON b.id = e.brand_id
  WHERE e.status = 'pendente_aprovacao'
    AND e.created_at < NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Eventos aprovados em até 48h sem equipe escalada (CRÍTICO)
  SELECT
    'evento_sem_equipe'::text AS tipo_alerta,
    'error'::text             AS severidade,
    e.brand_id,
    b.name AS brand_name,
    e.id   AS resource_id,
    'O.S. ' || e.nome || ' em ' || TO_CHAR(e.data_inicio, 'DD/MM HH24:MI') ||
      ' sem equipe escalada' AS mensagem,
    e.created_at AS created_at
  FROM events e
  JOIN brands b ON b.id = e.brand_id
  WHERE e.status = 'aprovado'
    AND e.data_inicio <= NOW() + INTERVAL '48 hours'
    AND NOT EXISTS (SELECT 1 FROM event_staff es WHERE es.event_id = e.id)

  UNION ALL

  -- Eventos aprovados em até 48h sem cardápio
  SELECT
    'evento_sem_cardapio'::text AS tipo_alerta,
    'warning'::text             AS severidade,
    e.brand_id,
    b.name AS brand_name,
    e.id   AS resource_id,
    'O.S. ' || e.nome || ' em ' || TO_CHAR(e.data_inicio, 'DD/MM HH24:MI') ||
      ' sem cardápio definido' AS mensagem,
    e.created_at AS created_at
  FROM events e
  JOIN brands b ON b.id = e.brand_id
  WHERE e.status = 'aprovado'
    AND e.data_inicio <= NOW() + INTERVAL '48 hours'
    AND NOT EXISTS (SELECT 1 FROM event_menu_items mi WHERE mi.event_id = e.id)
) alertas;

-- Grants explícitos pra authenticated (Supabase) — defensivo.
GRANT SELECT ON v_eventos_kpi        TO authenticated;
GRANT SELECT ON v_headcount_por_marca TO authenticated;
GRANT SELECT ON v_proximos_eventos    TO authenticated;
GRANT SELECT ON v_alertas             TO authenticated;
