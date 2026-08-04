-- Migration 067: página de adoção — rastreamento de navegação
-- Standalone app maza-inteligencia (Sprint 2.2)

CREATE TABLE IF NOT EXISTS public.page_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  path        text        NOT NULL,
  visited_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_path    ON public.page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_user    ON public.page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_visited ON public.page_views(visited_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'select_own'
  ) THEN
    CREATE POLICY "select_own" ON public.page_views
      FOR SELECT USING (user_id = auth.uid() OR maza_is_founder_or_cfo());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'insert_own'
  ) THEN
    CREATE POLICY "insert_own" ON public.page_views
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
