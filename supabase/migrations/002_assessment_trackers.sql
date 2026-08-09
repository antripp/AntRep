-- AntRep Phase 2 — Assessment trackers & client profile
-- Run after 001_progression_hub.sql

-- ---------------------------------------------------------------------------
-- athlete_client_profiles — medical history, restrictions (per coach link)
-- ---------------------------------------------------------------------------
create table if not exists public.athlete_client_profiles (
  coach_link_id uuid primary key references public.coach_links(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tracker_templates — coach-configurable assessment grids
-- ---------------------------------------------------------------------------
create table if not exists public.tracker_templates (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links(id) on delete cascade,
  kind text not null check (kind in ('body_assessment', 'mobility_pain', 'flexibility', 'cardio')),
  title text not null,
  metrics jsonb not null default '[]'::jsonb,
  column_labels jsonb not null default '[]'::jsonb,
  column_mode text not null default 'weekly' check (column_mode in ('weekly', 'milestone')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (coach_link_id, kind)
);

create index if not exists tracker_templates_link_idx on public.tracker_templates(coach_link_id);

-- ---------------------------------------------------------------------------
-- tracker_entries — cell values (metric × column)
-- ---------------------------------------------------------------------------
create table if not exists public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.tracker_templates(id) on delete cascade,
  coach_link_id uuid not null references public.coach_links(id) on delete cascade,
  metric_key text not null,
  column_index int not null check (column_index >= 1),
  value text not null default '',
  updated_at timestamptz not null default now(),
  unique (template_id, metric_key, column_index)
);

create index if not exists tracker_entries_template_idx on public.tracker_entries(template_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.athlete_client_profiles enable row level security;
alter table public.tracker_templates enable row level security;
alter table public.tracker_entries enable row level security;

drop policy if exists athlete_client_profiles_select on public.athlete_client_profiles;

create policy athlete_client_profiles_select on public.athlete_client_profiles for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists athlete_client_profiles_insert on public.athlete_client_profiles;
create policy athlete_client_profiles_insert on public.athlete_client_profiles for insert
  with check (public.link_is_coach(coach_link_id));
drop policy if exists athlete_client_profiles_update on public.athlete_client_profiles;
create policy athlete_client_profiles_update on public.athlete_client_profiles for update
  using (public.link_is_coach(coach_link_id));

drop policy if exists tracker_templates_select on public.tracker_templates;

create policy tracker_templates_select on public.tracker_templates for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists tracker_templates_insert on public.tracker_templates;
create policy tracker_templates_insert on public.tracker_templates for insert
  with check (public.link_is_coach(coach_link_id));
drop policy if exists tracker_templates_update on public.tracker_templates;
create policy tracker_templates_update on public.tracker_templates for update
  using (public.link_is_coach(coach_link_id));
drop policy if exists tracker_templates_delete on public.tracker_templates;
create policy tracker_templates_delete on public.tracker_templates for delete
  using (public.link_is_coach(coach_link_id));

drop policy if exists tracker_entries_select on public.tracker_entries;

create policy tracker_entries_select on public.tracker_entries for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists tracker_entries_insert on public.tracker_entries;
create policy tracker_entries_insert on public.tracker_entries for insert
  with check (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists tracker_entries_update on public.tracker_entries;
create policy tracker_entries_update on public.tracker_entries for update
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists tracker_entries_delete on public.tracker_entries;
create policy tracker_entries_delete on public.tracker_entries for delete
  using (public.link_is_coach(coach_link_id));

-- Realtime (run manually if needed):
-- alter publication supabase_realtime add table athlete_client_profiles, tracker_templates, tracker_entries;
