-- Migration 069: roadmap de sprints + seed
-- Standalone app maza-inteligencia (Sprint 3.2)

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  sprint      int         NOT NULL,
  status      text        NOT NULL DEFAULT 'backlog'
              CHECK (status IN ('backlog', 'in_progress', 'done')),
  module      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_sprint ON public.roadmap_items(sprint);
CREATE INDEX IF NOT EXISTS idx_roadmap_status ON public.roadmap_items(status);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'roadmap_items' AND policyname = 'select_roadmap'
  ) THEN
    CREATE POLICY "select_roadmap" ON public.roadmap_items
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'roadmap_items' AND policyname = 'manage_roadmap'
  ) THEN
    CREATE POLICY "manage_roadmap" ON public.roadmap_items
      FOR ALL
      USING (maza_is_founder_or_cfo())
      WITH CHECK (maza_is_founder_or_cfo());
  END IF;
END $$;

-- Seed: apenas se a tabela estiver vazia
INSERT INTO public.roadmap_items (title, description, sprint, status, module)
SELECT t.title, t.description, t.sprint::int, t.status, t.module
FROM (VALUES
  ('Diagnóstico receita R$0 no WBR',
   'WBR exibia R$0,00 de receita. Causa: sem lançamentos na semana corrente. Solução: campo receita_mensal_dre + banner âmbar no card da marca.',
   '1', 'done', 'WBR'),
  ('Detalhes de alertas críticos no WBR',
   'WBR só exibia contagem de alertas. Expandido para mostrar tipo, mensagem e data de cada alerta com painel colapsável por marca.',
   '1', 'done', 'WBR'),
  ('Configuração de metas por marca',
   'Página /metas exibia traços em todas as linhas. Infra completa mas sem dados. Adicionado badge "Configurar" para linhas sem meta configurada.',
   '1', 'done', 'Metas'),
  ('Breakdown de headcount no WBR',
   'WBR mostrava apenas total de headcount. Adicionado breakdown por departamento com expansão inline no card de cada marca.',
   '1', 'done', 'WBR'),
  ('Cross-módulo — comparativo por marca',
   'Nova página /inteligencia/cross com seletor de período (mês atual/anterior/3m/6m/12m), grid de KPIs lado a lado e badges de delta MoM com TrendingUp/Down.',
   '2', 'done', 'Cross-módulo'),
  ('Adoção da plataforma',
   'Nova página /inteligencia/adocao com rastreamento de page_views via server action fire-and-forget, top 5 módulos, WAU semanal e tabela de visitas recentes.',
   '2', 'done', 'Adoção'),
  ('Trend chart 8 semanas no WBR',
   'LineChart recharts abaixo dos cards de marca no WBR. Uma linha por marca com brand_color, X=semana ISO, Y=receita BRL formatada.',
   '2', 'done', 'WBR'),
  ('Módulo Bugs & Feedback',
   'Formulário para reportar bugs/sugestões com seletor de tipo, módulo (12 opções), descrição ≥20 chars e prioridade. Tabela com status cycling (open→triaged→resolved) para founder.',
   '3', 'in_progress', 'Bugs & Feedback'),
  ('Módulo Roadmap — kanban de sprints',
   'Board kanban estático com 3 colunas (Backlog, Em progresso, Entregue). Cards expansíveis com descrição inline, sprint badge colorido e module pill âmbar.',
   '3', 'in_progress', 'Roadmap'),
  ('Orquestrador — novos tipos de job',
   'Suporte visual (ícone + cor) para data_sync (Database/azul), alert_generated (AlertTriangle/vermelho), feedback_received (MessageSquare/âmbar), insight_generated (Sparkles/roxo). Wire feedback_received ao submit do formulário.',
   '3', 'in_progress', 'Orquestrador')
) AS t(title, description, sprint, status, module)
WHERE NOT EXISTS (SELECT 1 FROM public.roadmap_items LIMIT 1);
