-- Idempotent: only adds tables that are not already in supabase_realtime.
-- Safe to re-run. Skips sessions, set_logs, plans, etc. if already published.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'athlete_programs',
    'progression_exercises',
    'check_ins',
    'coach_notes',
    'messages',
    'athlete_client_profiles',
    'tracker_templates',
    'tracker_entries'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    ELSE
      RAISE NOTICE 'Skipped % (already in supabase_realtime)', t;
    END IF;
  END LOOP;
END $$;
