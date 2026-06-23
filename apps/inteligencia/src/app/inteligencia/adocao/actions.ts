"use server";

// Server Actions do módulo Adoção.
// page_views requer migration no Supabase:
//
// CREATE TABLE IF NOT EXISTS public.page_views (
//   id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
//   path        text        NOT NULL,
//   visited_at  timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_page_views_path      ON public.page_views(path);
// CREATE INDEX IF NOT EXISTS idx_page_views_user      ON public.page_views(user_id);
// CREATE INDEX IF NOT EXISTS idx_page_views_visited   ON public.page_views(visited_at DESC);
// ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
// -- founder/cfo vêem tudo; usuário vê só o próprio
// CREATE POLICY "select_own" ON public.page_views FOR SELECT
//   USING (user_id = auth.uid() OR kph_is_founder_or_cfo());
// CREATE POLICY "insert_own" ON public.page_views FOR INSERT
//   WITH CHECK (user_id = auth.uid());

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import { startOfWeek, subWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Fire-and-forget: regista uma page_view. Nunca lança exceção pro caller. */
export async function trackPageView(path: string): Promise<void> {
  try {
    const user = await requireUser().catch(() => null);
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;
    // insert sem await no caller — mas a server action É async, então o insert é feito aqui.
    await supabase
      .from("page_views" as never)
      .insert({ user_id: user?.id ?? null, path } as never);
  } catch {
    // silencioso — tracking nunca deve quebrar a navegação
  }
}

// ── Tipos de leitura ──────────────────────────────────────────────

export type TopPath = { path: string; count: number };

export type WauPoint = {
  week_label: string;   // "Sem 20"
  week_start: string;   // ISO date
  active_users: number;
};

export type RecentVisit = {
  path: string;
  user_email: string | null;
  visited_at: string;
};

export type AdocaoData = {
  top_paths: TopPath[];
  wau: WauPoint[];
  recent: RecentVisit[];
  total_views_30d: number;
};

/** Carrega os dados de adoção para a página /adocao. */
export async function loadAdocaoData(): Promise<AdocaoData | null> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    // Referência temporal: hoje
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    // 1) Todas as views dos últimos 30 dias
    const { data: allViews } = await supabase
      .from("page_views" as never)
      .select("path, user_id, visited_at")
      .gte("visited_at", thirtyDaysAgoIso)
      .order("visited_at", { ascending: false })
      .limit(2000)
      .returns<{ path: string; user_id: string | null; visited_at: string }[]>();

    const views = allViews ?? [];

    // 2) Top 5 paths
    const pathCount = new Map<string, number>();
    for (const v of views) pathCount.set(v.path, (pathCount.get(v.path) ?? 0) + 1);
    const top_paths: TopPath[] = Array.from(pathCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    // 3) WAU — últimas 4 semanas (segunda como início)
    const wau: WauPoint[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59);

      const weekStartIso = weekStart.toISOString();
      const weekEndIso = weekEnd.toISOString();

      const usersThisWeek = new Set(
        views
          .filter((v) => v.visited_at >= weekStartIso && v.visited_at <= weekEndIso && v.user_id)
          .map((v) => v.user_id),
      );

      const weekNum = format(weekStart, "w", { locale: ptBR });
      wau.push({
        week_label: `Sem ${weekNum}`,
        week_start: weekStart.toISOString().slice(0, 10),
        active_users: usersThisWeek.size,
      });
    }

    // 4) Visitas recentes (últimas 20) com user_email via auth
    // Supabase JS não expõe auth.users diretamente via client — usamos user_id como fallback
    const recent: RecentVisit[] = views.slice(0, 20).map((v) => ({
      path: v.path,
      user_email: v.user_id ? `...${v.user_id.slice(-8)}` : "anônimo",
      visited_at: v.visited_at,
    }));

    return {
      top_paths,
      wau,
      recent,
      total_views_30d: views.length,
    };
  } catch (e) {
    console.error("[loadAdocaoData]", e);
    return null;
  }
}
