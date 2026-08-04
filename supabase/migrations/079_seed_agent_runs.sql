-- Migration 070: seed agent_runs com 2 semanas de dados realistas
-- Semana 22 (26/mai–01/jun/2026) e Semana 21 (19–25/mai/2026)
-- EXECUTAR APÓS migration 068.

-- ── Semana 22 (2026, ISO week 22) ────────────────────────────────────
INSERT INTO public.agent_runs (agent_name, category, triggered_by, status, duration_seconds, output_summary, week_number, year, created_at) VALUES
-- maza-dev: 14 runs
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 420, 'Implementou Learning Machine panel no Orquestrador', 22, 2026, '2026-05-26 10:15:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 380, 'Fix skip link: extraiu SkipLink para Client Component', 22, 2026, '2026-05-27 09:30:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 290, 'Fix wbr dedup: remove duplicate Meet & Eat no trend chart', 22, 2026, '2026-05-27 14:20:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 510, 'Tokens.ts: design system centralizado', 22, 2026, '2026-05-28 08:45:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 340, 'Intelligence Score card implementado', 22, 2026, '2026-05-28 15:10:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 270, 'WBR AI insight panel com Anthropic Haiku', 22, 2026, '2026-05-29 09:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 195, 'Empty states educativos em cross/metas/adocao/feedback', 22, 2026, '2026-05-29 11:30:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 460, 'Metas semáforo thresholds alinhados ao benchmark MAZA', 22, 2026, '2026-05-29 16:45:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 320, 'ISO 8601 week number corrigido em wbr.ts', 22, 2026, '2026-05-30 10:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 240, 'revalidatePath em cycleStatus do feedback', 22, 2026, '2026-05-30 14:15:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 180, 'EBITDA severity threshold corrigido para 12%', 22, 2026, '2026-05-31 09:20:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 390, 'aria-current e skip link WCAG em InteligenciaNav', 22, 2026, '2026-05-31 13:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 280, 'PageViewTracker adicionado ao Orquestrador layout', 22, 2026, '2026-06-01 09:30:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 350, 'Fraunces font em todos os h1 de página', 22, 2026, '2026-06-01 14:00:00+00'),

-- ux-reviewer: 8 runs
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 180, 'Review WBR dashboard — semáforos e hierarquia visual', 22, 2026, '2026-05-26 11:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 165, 'Review Metas page — consistência de componentes', 22, 2026, '2026-05-27 10:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 190, 'Review Cross page — empty state e layout', 22, 2026, '2026-05-28 09:30:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 170, 'Review Intelligence Score card', 22, 2026, '2026-05-28 16:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 185, 'Review WBR Insight Panel — tipografia e espaçamento', 22, 2026, '2026-05-29 10:30:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 155, 'Review Feedback table — densidade e legibilidade', 22, 2026, '2026-05-30 11:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 175, 'Review Roadmap page — hierarquia de informação', 22, 2026, '2026-05-31 10:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 160, 'Review Orquestrador empty state', 22, 2026, '2026-06-01 10:00:00+00'),

-- webapp-tester: 6 runs
('webapp-tester', 'Qualidade & Testes', 'ike', 'completed', 240, 'Smoke suite /inteligencia/* — 22 testes OK', 22, 2026, '2026-05-26 12:00:00+00'),
('webapp-tester', 'Qualidade & Testes', 'ike', 'completed', 210, 'Teste WBR trend chart após fix null values', 22, 2026, '2026-05-28 11:00:00+00'),
('webapp-tester', 'Qualidade & Testes', 'ike', 'completed', 195, 'Teste Metas semáforo 90/70 thresholds', 22, 2026, '2026-05-29 14:00:00+00'),
('webapp-tester', 'Qualidade & Testes', 'ike', 'completed', 225, 'Teste feedback form validação server-side', 22, 2026, '2026-05-30 15:00:00+00'),
('webapp-tester', 'Qualidade & Testes', 'ike', 'completed', 180, 'Smoke regressão após deploy maza-inteligencia', 22, 2026, '2026-05-31 15:00:00+00'),
('webapp-tester', 'Qualidade & Testes', 'ike', 'completed', 200, 'Teste 500 error fix — todas rotas /inteligencia OK', 22, 2026, '2026-06-01 11:00:00+00'),

-- migration-writer: 5 runs
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 120, 'Migration 065 maza_alerts', 22, 2026, '2026-05-26 09:00:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 110, 'Migration 066 maza_intelligence_scores', 22, 2026, '2026-05-26 09:05:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 115, 'Migration 067 maza_insights', 22, 2026, '2026-05-26 09:10:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 130, 'Migration 068 agent_runs + orquestrador_jobs', 22, 2026, '2026-06-02 10:00:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 125, 'Migration 069 learning_machine_reports', 22, 2026, '2026-06-02 10:05:00+00'),

-- financial-reviewer: 3 runs
('financial-reviewer', 'Financeiro & Operação', 'ike', 'completed', 150, 'Análise DRE Meet & Eat Jan-Abr 2026 — EBITDA trend', 22, 2026, '2026-05-27 15:00:00+00'),
('financial-reviewer', 'Financeiro & Operação', 'ike', 'completed', 140, 'CMV alert threshold review — 28% meta confirmada', 22, 2026, '2026-05-29 12:00:00+00'),
('financial-reviewer', 'Financeiro & Operação', 'ike', 'completed', 160, 'MAZA Intelligence Score breakdown validado', 22, 2026, '2026-05-31 11:30:00+00'),

-- learning-machine: 1 run
('learning-machine', 'RH & Pessoas', 'cron', 'completed', 85, 'Relatório semana 21/2026 gerado — score 68/100', 22, 2026, '2026-05-30 11:00:00+00');

-- ── Semana 21 (2026, ISO week 21) ────────────────────────────────────
INSERT INTO public.agent_runs (agent_name, category, triggered_by, status, duration_seconds, output_summary, week_number, year, created_at) VALUES
-- maza-dev: 11 runs
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 480, 'Sprint 3 WBR intelligence — wbr-shared.ts tipos', 21, 2026, '2026-05-19 09:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 520, 'Cross page com análise comparativa Meet & Eat / Madonna', 21, 2026, '2026-05-19 14:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 410, 'Adoção page com WAU bars e Top 5 módulos', 21, 2026, '2026-05-20 09:30:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 390, 'Feedback page com form + tabela de histórico', 21, 2026, '2026-05-20 14:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 350, 'Roadmap page com épicos e velocity bars', 21, 2026, '2026-05-21 09:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 440, 'Orquestrador page com job list e type config', 21, 2026, '2026-05-21 14:30:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 300, 'InteligenciaNav sidebar com todas as rotas', 21, 2026, '2026-05-22 09:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 280, 'PageViewTracker server action implementado', 21, 2026, '2026-05-22 11:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 320, 'loadWbr() trend data últimas 8 semanas', 21, 2026, '2026-05-23 10:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 260, 'vendas_diarias fallback para Meet & Eat trend', 21, 2026, '2026-05-23 14:00:00+00'),
('maza-dev', 'Código & Plataformas', 'ike', 'completed', 370, 'Metas semáforo component com progress bars', 21, 2026, '2026-05-25 10:00:00+00'),

-- migration-writer: 7 runs
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 140, 'Migration sprint 2 — metas table', 21, 2026, '2026-05-19 08:30:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 135, 'Migration sprint 2 — roadmap_items table', 21, 2026, '2026-05-19 08:35:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 120, 'Migration sprint 2 — feedback table', 21, 2026, '2026-05-19 08:40:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 145, 'Migration sprint 2 — page_views table', 21, 2026, '2026-05-19 08:45:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 130, 'Migration sprint 3 — v_dre_consolidado view', 21, 2026, '2026-05-21 08:00:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 125, 'Migration sprint 3 — brand_financial_config', 21, 2026, '2026-05-21 08:05:00+00'),
('migration-writer', 'Código & Plataformas', 'ike', 'completed', 150, 'Migration sprint 3 — v_headcount_por_marca view', 21, 2026, '2026-05-21 08:10:00+00'),

-- ux-reviewer: 4 runs
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 175, 'Review sprint 2 pages — Cross, Adoção, Feedback', 21, 2026, '2026-05-20 16:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 185, 'Review WBR Brand cards layout e KPI chips', 21, 2026, '2026-05-22 15:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 160, 'Review trend chart recharts configuração', 21, 2026, '2026-05-23 16:00:00+00'),
('ux-reviewer', 'Qualidade & Testes', 'ike', 'completed', 170, 'Review Metas page semáforo e cards', 21, 2026, '2026-05-25 11:00:00+00'),

-- api-validator: 3 runs
('api-validator', 'Qualidade & Testes', 'ike', 'completed', 130, 'Validação Supabase REST API — vendas_diarias endpoint', 21, 2026, '2026-05-20 10:00:00+00'),
('api-validator', 'Qualidade & Testes', 'ike', 'completed', 120, 'Validação Supabase RLS — brands, employees, units', 21, 2026, '2026-05-22 10:00:00+00'),
('api-validator', 'Qualidade & Testes', 'ike', 'completed', 145, 'Validação createOperationsClient fallback', 21, 2026, '2026-05-24 10:00:00+00');
