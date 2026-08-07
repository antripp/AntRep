-- Athlete-owned baseline health metrics on profile (Settings tab).
alter table public.profiles
  add column if not exists health_metrics jsonb not null default '{}'::jsonb;
