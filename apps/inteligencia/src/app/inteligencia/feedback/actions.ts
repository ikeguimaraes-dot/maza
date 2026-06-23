"use server";

// Server Actions do módulo Bugs & Feedback.
// feedback requer migration no Supabase:
//
// CREATE TABLE IF NOT EXISTS public.feedback (
//   id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
//   type        text        NOT NULL CHECK (type IN ('bug','suggestion','other')),
//   module      text        NOT NULL,
//   description text        NOT NULL,
//   priority    text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
//   status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','resolved')),
//   created_at  timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_feedback_user   ON public.feedback(user_id);
// CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
// CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);
// ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
// -- Founder/CFO vêem tudo; usuário vê só o próprio
// CREATE POLICY "select_feedback" ON public.feedback FOR SELECT
//   USING (user_id = auth.uid() OR kph_is_founder_or_cfo());
// CREATE POLICY "insert_feedback" ON public.feedback FOR INSERT
//   WITH CHECK (user_id = auth.uid());
// CREATE POLICY "update_status" ON public.feedback FOR UPDATE
//   USING (kph_is_founder_or_cfo())
//   WITH CHECK (kph_is_founder_or_cfo());

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser, isFounder } from "@kph/auth/server";
import { insertJob } from "@/lib/inteligencia/orquestrador";

export type FeedbackType = "bug" | "suggestion" | "other";
export type FeedbackPriority = "low" | "medium" | "high";
export type FeedbackStatus = "open" | "triaged" | "resolved";

export type FeedbackItem = {
  id: string;
  user_id: string | null;
  type: FeedbackType;
  module: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  created_at: string;
};

export type SubmitFeedbackInput = {
  type: FeedbackType;
  module: string;
  description: string;
  priority: FeedbackPriority;
};

/** Submete um novo feedback. Retorna { id } em caso de sucesso ou lança erro. */
export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<{ id: string }> {
  // Validação server-side (defesa em profundidade além do client)
  if (!input.description || input.description.trim().length < 20) {
    throw new Error("Descrição deve ter pelo menos 20 caracteres");
  }
  if (!["bug", "suggestion", "other"].includes(input.type)) {
    throw new Error("Tipo inválido");
  }
  if (!["low", "medium", "high"].includes(input.priority)) {
    throw new Error("Prioridade inválida");
  }

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase indisponível");

  const { data, error } = await supabase
    .from("feedback" as never)
    .insert({
      user_id: user.id,
      type: input.type,
      module: input.module,
      description: input.description,
      priority: input.priority,
      status: "open",
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error) throw new Error(error.message);

  // Wire: insere job feedback_received no orquestrador (fire-and-forget)
  void insertJob("feedback_received", {
    feedback_id: data.id,
    module: input.module,
    priority: input.priority,
  });

  return { id: data.id };
}

/** Carrega todos os feedbacks visíveis ao user (RLS filtra). */
export async function loadFeedback(): Promise<FeedbackItem[] | null> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("feedback" as never)
      .select("id, user_id, type, module, description, priority, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<FeedbackItem[]>();

    if (error) return null;
    return data ?? [];
  } catch {
    return null;
  }
}

/** Avança o status de um item: open → triaged → resolved (apenas founder). */
export async function cycleStatus(id: string): Promise<void> {
  const user = await requireUser();
  if (!isFounder(user)) throw new Error("Sem permissão");

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase indisponível");

  // Lê status atual
  const { data } = await supabase
    .from("feedback" as never)
    .select("status")
    .eq("id" as never, id as never)
    .single<{ status: FeedbackStatus }>();

  const next: Record<FeedbackStatus, FeedbackStatus> = {
    open: "triaged",
    triaged: "resolved",
    resolved: "open",
  };
  const newStatus = next[data?.status ?? "open"];

  await supabase
    .from("feedback" as never)
    .update({ status: newStatus } as never)
    .eq("id" as never, id as never);

  revalidatePath("/inteligencia/feedback");
}
