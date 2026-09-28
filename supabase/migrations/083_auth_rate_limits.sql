-- Persistent, shared brute-force protection for authentication endpoints.
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  identifier_hash text NOT NULL,
  action text NOT NULL,
  failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identifier_hash, action)
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.auth_rate_limit_check(
  p_identifier_hash text,
  p_action text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.auth_rate_limits
    WHERE identifier_hash = p_identifier_hash
      AND action = p_action
      AND blocked_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_rate_limit_fail(
  p_identifier_hash text,
  p_action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.auth_rate_limits AS limits
    (identifier_hash, action, failures, window_started_at, blocked_until, updated_at)
  VALUES (p_identifier_hash, p_action, 1, now(), NULL, now())
  ON CONFLICT (identifier_hash, action) DO UPDATE SET
    failures = CASE
      WHEN limits.window_started_at <= now() - interval '15 minutes' THEN 1
      ELSE limits.failures + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at <= now() - interval '15 minutes' THEN now()
      ELSE limits.window_started_at
    END,
    blocked_until = CASE
      WHEN (CASE WHEN limits.window_started_at <= now() - interval '15 minutes' THEN 1 ELSE limits.failures + 1 END) >= 5
      THEN now() + interval '15 minutes'
      ELSE limits.blocked_until
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_rate_limit_clear(
  p_identifier_hash text,
  p_action text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.auth_rate_limits
  WHERE identifier_hash = p_identifier_hash AND action = p_action;
$$;

REVOKE ALL ON FUNCTION public.auth_rate_limit_check(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auth_rate_limit_fail(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auth_rate_limit_clear(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_check(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_fail(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_clear(text, text) TO service_role;
