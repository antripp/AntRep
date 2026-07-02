-- ============================================================
-- AntRep schema + Row-Level Security
-- Run this once in Supabase → SQL Editor → New query.
--
-- Security model:
--   * No emails are stored in app tables (auth.users keeps them,
--     and it is never exposed through the API).
--   * Every table has RLS enabled. Athletes only reach their own
--     rows; coaches only reach rows of athletes actively linked
--     to them. There are no public rows.
--   * Invite claiming goes through a SECURITY DEFINER function so
--     unclaimed invites are never readable/searchable.
-- ============================================================

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('athlete', 'coach')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------- coach <-> athlete links ----------
create table public.coach_links (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid references public.profiles (id) on delete cascade,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  unique (trainer_id, athlete_id)
);

alter table public.coach_links enable row level security;

-- Helper: is there an active link between coach and athlete?
create or replace function public.is_linked(coach uuid, athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_links
    where trainer_id = coach and athlete_id = athlete and status = 'active'
  );
$$;

-- ---------- plans ----------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Training plan',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  weekday int not null check (weekday between 1 and 7), -- 1 = Monday
  title text not null default '',
  day_type text not null default 'fullbody',
  sort_order int not null default 0
);

alter table public.plan_days enable row level security;

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.plan_days (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  log_type text not null default 'strength' check (log_type in ('strength', 'cardio', 'timed', 'interval')),
  target_sets int not null default 3,
  target_reps int not null default 10,
  target_weight_kg numeric not null default 0,
  rest_sec int not null default 0,
  trainer_notes text not null default '',
  -- Extension point for future prescriptions (intervals, tempo, RPE targets…)
  prescription jsonb not null default '{}'::jsonb
);

alter table public.plan_exercises enable row level security;

-- ---------- sessions + set logs ----------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  plan_day_id uuid references public.plan_days (id) on delete set null,
  day_title text not null default '',
  date date not null default current_date,
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  athlete_notes text not null default '',
  unique (athlete_id, date, plan_day_id)
);

alter table public.sessions enable row level security;

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  plan_exercise_id uuid references public.plan_exercises (id) on delete set null,
  exercise_name text not null,
  set_index int not null default 1,
  weight_kg numeric,
  reps int,
  rpe int,
  distance_km numeric,
  duration_sec int,
  note text not null default '',
  -- Values for coach-defined custom fields, keyed by field key.
  extra jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  unique (session_id, exercise_name, set_index)
);

alter table public.set_logs enable row level security;

-- ---------- coach settings (custom logging fields + export layout) ----------
create table public.coach_settings (
  trainer_id uuid primary key references public.profiles (id) on delete cascade,
  -- [{ "key": "band_color", "label": "Band colour", "type": "text" | "number", "unit": "kg" }]
  custom_fields jsonb not null default '[]'::jsonb,
  -- Ordered export column keys; empty = default layout.
  export_columns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_settings enable row level security;

-- ============================================================
-- Policies
-- ============================================================

-- profiles: self + people you are actively linked with (display name only,
-- since profiles has no sensitive columns).
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or public.is_linked(auth.uid(), id)
  or public.is_linked(id, auth.uid())
);
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- coach_links: each side sees only their own links. Nobody can browse invites.
create policy "links_select" on public.coach_links for select using (
  trainer_id = auth.uid() or athlete_id = auth.uid()
);
create policy "links_insert" on public.coach_links for insert with check (
  trainer_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
);
create policy "links_delete" on public.coach_links for delete using (trainer_id = auth.uid());

-- Claiming an invite: SECURITY DEFINER so the athlete never needs read
-- access to unclaimed invites (prevents code enumeration via the API).
create or replace function public.claim_invite(code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'athlete') then
    return false;
  end if;
  update public.coach_links
    set athlete_id = auth.uid(), status = 'active'
    where invite_code = code and athlete_id is null
    and not exists (
      select 1 from public.coach_links existing
      where existing.trainer_id = coach_links.trainer_id
        and existing.athlete_id = auth.uid()
    );
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- plans: coach owns; athlete reads their own.
create policy "plans_coach_all" on public.plans for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "plans_athlete_select" on public.plans for select using (athlete_id = auth.uid());

-- plan_days / plan_exercises: derived from the parent plan.
create policy "plan_days_coach_all" on public.plan_days for all
  using (exists (select 1 from public.plans p where p.id = plan_id and p.trainer_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.trainer_id = auth.uid()));
create policy "plan_days_athlete_select" on public.plan_days for select
  using (exists (select 1 from public.plans p where p.id = plan_id and p.athlete_id = auth.uid()));

create policy "plan_exercises_coach_all" on public.plan_exercises for all
  using (exists (
    select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.trainer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.trainer_id = auth.uid()
  ));
create policy "plan_exercises_athlete_select" on public.plan_exercises for select
  using (exists (
    select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.athlete_id = auth.uid()
  ));

-- sessions: athlete owns; linked coach reads.
create policy "sessions_athlete_all" on public.sessions for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy "sessions_coach_select" on public.sessions for select
  using (public.is_linked(auth.uid(), athlete_id));

-- set_logs: athlete owns via session; linked coach reads.
create policy "set_logs_athlete_all" on public.set_logs for all
  using (exists (select 1 from public.sessions s where s.id = session_id and s.athlete_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.athlete_id = auth.uid()));
create policy "set_logs_coach_select" on public.set_logs for select
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and public.is_linked(auth.uid(), s.athlete_id)
  ));

-- coach_settings: coach owns; linked athletes read (they need the custom
-- logging fields to render the logging form).
create policy "coach_settings_coach_all" on public.coach_settings for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "coach_settings_athlete_select" on public.coach_settings for select
  using (public.is_linked(trainer_id, auth.uid()));
