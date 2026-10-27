CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.supabase_keepalive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supabase_keepalive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supabase_keepalive FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.run_supabase_keepalive()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  keepalive_id uuid;
BEGIN
  INSERT INTO public.supabase_keepalive DEFAULT VALUES
  RETURNING id INTO keepalive_id;

  DELETE FROM public.supabase_keepalive
  WHERE id = keepalive_id;
END;
$$;

REVOKE ALL ON FUNCTION public.run_supabase_keepalive() FROM PUBLIC, anon, authenticated, service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'supabase-keepalive-every-three-days';

SELECT cron.schedule(
  'supabase-keepalive-every-three-days',
  '0 0 */3 * *',
  'SELECT public.run_supabase_keepalive();'
);
