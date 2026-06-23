"use server";

// Server Actions do módulo Roadmap.
// roadmap_items requer migration + seed no Supabase:
//
// -- Migration 036
// CREATE TABLE IF NOT EXISTS public.roadmap_items (
//   id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//   title       text        NOT NULL,
//   description text,
//   sprint      int         NOT NULL,
//   status      text        NOT NULL DEFAULT 'backlog'
//               CHECK (status IN ('backlog','in_progress','done')),
//   module      text,
//   created_at  timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_roadmap_sprint  ON public.roadmap_items(sprint);
// CREATE INDEX IF NOT EXISTS idx_roadmap_status  ON public.roadmap_items(status);
// ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "select_roadmap" ON public.roadmap_items FOR SELECT
//   USING (kph_is_founder_or_cfo() OR TRUE); -- visível para todos autenticados
// CREATE POLICY "manage_roadmap" ON public.roadmap_items FOR ALL
//   USING (kph_is_founder_or_cfo())
//   WITH CHECK (kph_is_founder_or_cfo());
//
// -- Seed — Sprints 1, 2, 3 (execute após criar a tabela)
// INSERT INTO public.roadmap_items (title, description, sprint, status, module) VALUES
//   -- Sprint 1 (done)
//   ('Diagnóstico receita R$0 no WBR',
//    'Investigar por que o WBR exibia R$0,00 de receita. Causa: sem lançamentos na semana corrente. Solução: campo receita_mensal_dre + banner de aviso.',
//    1, 'done', 'WBR'),
//   ('Detalhes de alertas críticos no WBR',
//    'WBR só exibia contagem de alertas. Expandido para mostrar tipo, mensagem e data de cada alerta com painel colapsável.',
//    1, 'done', 'WBR'),
//   ('Configuração de metas por marca',
//    'Página /metas exibia traços em todas as linhas. Infra estava completa mas sem dados. Adicionado badge "Configurar" para linhas sem meta.',
//    1, 'done', 'Metas'),
//   ('Discrepância headcount no WBR',
//    'WBR mostrava apenas total de headcount. Adicionado breakdown por departamento com expansão inline.',
//    1, 'done', 'WBR'),
//   -- Sprint 2 (done)
//   ('Módulo Cross-módulo — comparativo por marca',
//    'Nova página /inteligencia/cross com seletor de período, grid de KPIs lado a lado por marca e badges de delta MoM (TrendingUp/Down).',
//    2, 'done', 'Cross-módulo'),
//   ('Módulo Adoção da plataforma',
//    'Nova página /inteligencia/adocao com rastreamento de page_views, top 5 módulos, WAU semanal e tabela de visitas recentes.',
//    2, 'done', 'Adoção'),
//   ('Trend chart 8 semanas no WBR',
//    'LineChart recharts abaixo dos cards de marca no WBR. Uma linha por marca, X=semana ISO, Y=receita BRL, tooltip com nome da marca.',
//    2, 'done', 'WBR'),
//   -- Sprint 3 (in_progress)
//   ('Módulo Bugs & Feedback',
//    'Formulário para reportar bugs/sugestões com tipo, módulo, descrição e prioridade. Tabela de histórico com status cycling para o founder.',
//    3, 'in_progress', 'Bugs & Feedback'),
//   ('Módulo Roadmap — kanban de sprints',
//    'Board kanban estático com 3 colunas (Backlog, Em progresso, Entregue). Cards expansíveis com título, módulo e sprint badge.',
//    3, 'in_progress', 'Roadmap'),
//   ('Orquestrador — novos tipos de job',
//    'Suporte visual (ícone + cor) para data_sync, alert_generated, feedback_received, insight_generated. Wire feedback_received ao submit do formulário.',
//    3, 'in_progress', 'Orquestrador');

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";

export type RoadmapStatus = "backlog" | "in_progress" | "done";

export type RoadmapItem = {
  id: string;
  title: string;
  description: string | null;
  sprint: number;
  status: RoadmapStatus;
  module: string | null;
  created_at: string;
};

export async function loadRoadmap(): Promise<RoadmapItem[] | null> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("roadmap_items" as never)
      .select("id, title, description, sprint, status, module, created_at")
      .order("sprint", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<RoadmapItem[]>();

    if (error) return null;
    return data ?? [];
  } catch {
    return null;
  }
}
