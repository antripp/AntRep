-- AntRep Progression Hub (Phase 1)
-- Run in Supabase SQL Editor after existing AntRep schema.
-- After applying, add new tables to the realtime publication:
--   alter publication supabase_realtime add table athlete_programs, progression_exercises,
--     check_ins, coach_notes, messages;

-- ---------------------------------------------------------------------------
-- set_logs: built-in pain field (0–10, optional)
-- ---------------------------------------------------------------------------
alter table public.set_logs
  add column if not exists pain smallint check (pain is null or (pain >= 0 and pain <= 10));

-- ---------------------------------------------------------------------------
-- athlete_programs — program context per coach-athlete link
-- ---------------------------------------------------------------------------
create table if not exists public.athlete_programs (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null unique references public.coach_links(id) on delete cascade,
  goals text not null default '',
  duration_weeks int not null default 12 check (duration_weeks >= 1 and duration_weeks <= 104),
  assessment_date date,
  start_date date,
  progression_metric text not null default 'max_weight' check (progression_metric in ('max_weight', 'total_volume')),
  progression_overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- progression_exercises — coach-defined key lifts per link
-- ---------------------------------------------------------------------------
create table if not exists public.progression_exercises (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links(id) on delete cascade,
  exercise_name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (coach_link_id, exercise_name)
);

create index if not exists progression_exercises_link_idx on public.progression_exercises(coach_link_id);

-- ---------------------------------------------------------------------------
-- check_ins — weekly wellness form
-- ---------------------------------------------------------------------------
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links(id) on delete cascade,
  week_index int not null check (week_index >= 1),
  weight_kg numeric,
  sleep text not null default '',
  energy text not null default '',
  appetite text not null default '',
  pain text not null default '',
  submitted_at timestamptz not null default now(),
  unique (coach_link_id, week_index)
);

create index if not exists check_ins_link_idx on public.check_ins(coach_link_id);

-- ---------------------------------------------------------------------------
-- coach_notes — structured observations
-- ---------------------------------------------------------------------------
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links(id) on delete cascade,
  note_date date not null default current_date,
  observation text not null default '',
  adjustment text not null default '',
  reason text not null default '',
  next_review date,
  created_at timestamptz not null default now()
);

create index if not exists coach_notes_link_idx on public.coach_notes(coach_link_id);

-- ---------------------------------------------------------------------------
-- messages — simple thread per coach-athlete link
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_link_idx on public.messages(coach_link_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.link_is_coach(p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_links cl
    join public.profiles p on p.id = cl.trainer_id
    where cl.id = p_link_id
      and cl.status = 'active'
      and p.user_id = auth.uid()
      and p.role = 'coach'
  );
$$;

create or replace function public.link_is_athlete(p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_links cl
    join public.profiles p on p.id = cl.athlete_id
    where cl.id = p_link_id
      and cl.status = 'active'
      and p.user_id = auth.uid()
      and p.role = 'athlete'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
alter table public.athlete_programs enable row level security;
alter table public.progression_exercises enable row level security;
alter table public.check_ins enable row level security;
alter table public.coach_notes enable row level security;
alter table public.messages enable row level security;

-- athlete_programs
drop policy if exists athlete_programs_select on public.athlete_programs;
create policy athlete_programs_select on public.athlete_programs for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists athlete_programs_insert on public.athlete_programs;
create policy athlete_programs_insert on public.athlete_programs for insert
  with check (public.link_is_coach(coach_link_id));
drop policy if exists athlete_programs_update on public.athlete_programs;
create policy athlete_programs_update on public.athlete_programs for update
  using (public.link_is_coach(coach_link_id));

-- progression_exercises
drop policy if exists progression_exercises_select on public.progression_exercises;
create policy progression_exercises_select on public.progression_exercises for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists progression_exercises_insert on public.progression_exercises;
create policy progression_exercises_insert on public.progression_exercises for insert
  with check (public.link_is_coach(coach_link_id));
drop policy if exists progression_exercises_update on public.progression_exercises;
create policy progression_exercises_update on public.progression_exercises for update
  using (public.link_is_coach(coach_link_id));
drop policy if exists progression_exercises_delete on public.progression_exercises;
create policy progression_exercises_delete on public.progression_exercises for delete
  using (public.link_is_coach(coach_link_id));

-- check_ins
drop policy if exists check_ins_select on public.check_ins;
create policy check_ins_select on public.check_ins for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists check_ins_insert on public.check_ins;
create policy check_ins_insert on public.check_ins for insert
  with check (public.link_is_athlete(coach_link_id));
drop policy if exists check_ins_update on public.check_ins;
create policy check_ins_update on public.check_ins for update
  using (public.link_is_athlete(coach_link_id));

-- coach_notes
drop policy if exists coach_notes_select on public.coach_notes;
create policy coach_notes_select on public.coach_notes for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists coach_notes_insert on public.coach_notes;
create policy coach_notes_insert on public.coach_notes for insert
  with check (public.link_is_coach(coach_link_id));
drop policy if exists coach_notes_update on public.coach_notes;
create policy coach_notes_update on public.coach_notes for update
  using (public.link_is_coach(coach_link_id));
drop policy if exists coach_notes_delete on public.coach_notes;
create policy coach_notes_delete on public.coach_notes for delete
  using (public.link_is_coach(coach_link_id));

-- messages
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id))
    and exists (
      select 1 from public.profiles p
      where p.id = sender_profile_id and p.user_id = auth.uid()
    )
  );
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
