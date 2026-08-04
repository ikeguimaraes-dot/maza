-- Migration 068: módulo Bugs & Feedback
-- Standalone app maza-inteligencia (Sprint 3.1)

CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        text        NOT NULL CHECK (type IN ('bug', 'suggestion', 'other')),
  module      text        NOT NULL,
  description text        NOT NULL,
  priority    text        NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high')),
  status      text        NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'triaged', 'resolved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user    ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status  ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'select_feedback'
  ) THEN
    CREATE POLICY "select_feedback" ON public.feedback
      FOR SELECT USING (user_id = auth.uid() OR maza_is_founder_or_cfo());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'insert_feedback'
  ) THEN
    CREATE POLICY "insert_feedback" ON public.feedback
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'update_status'
  ) THEN
    CREATE POLICY "update_status" ON public.feedback
      FOR UPDATE
      USING (maza_is_founder_or_cfo())
      WITH CHECK (maza_is_founder_or_cfo());
  END IF;
END $$;
