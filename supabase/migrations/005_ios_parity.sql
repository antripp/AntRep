-- ============================================================
-- 005 — iOS parity (AntRep web app)
--
-- Run once in Supabase → SQL Editor → New query, on the project that
-- already has schema.sql + migrations 001–004 applied.
--
-- Everything here is additive: no table is dropped and no row is deleted.
-- Existing accounts, plans, sessions and logs keep working unchanged.
--
-- What it adds
--   * profile stats + goals + settings (XP, level, streak, theme)
--   * plans ownable by ANY profile (athletes can build their own plans)
--   * plan segments (a day can be "Strength" then "Walk")
--   * the iOS exercise prescription (alternates, mandatory, tempo, RPE…)
--   * session timing windows, XP, per-day type, coach sharing switch
--   * exercise library presets, XP events, weekly quests
--   * RLS for all of the above
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profiles: stats, goals, app settings
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists total_xp integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists current_streak integer not null default 0,
  add column if not exists best_streak integer not null default 0,
  add column if not exists last_active_date date,
  add column if not exists weekly_gym_goal integer not null default 3,
  add column if not exists weekly_km_goal numeric not null default 0,
  add column if not exists daily_calorie_goal integer not null default 2000,
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- 2. Plans: owned by any profile (coach OR athlete)
--    `trainer_id` stays populated for older code; `owner_id` is the truth.
-- ------------------------------------------------------------
alter table public.plans
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade,
  add column if not exists icon_name text not null default '',
  add column if not exists color_hex text not null default '',
  add column if not exists is_archived boolean not null default false,
  add column if not exists notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();

update public.plans set owner_id = trainer_id where owner_id is null;

-- Keep the two columns mirrored so pre-existing queries on trainer_id
-- (and their RLS policies) behave exactly as before.
create or replace function public.plans_sync_owner()
returns trigger
language plpgsql
as $$
begin
  new.owner_id := coalesce(new.owner_id, new.trainer_id);
  new.trainer_id := coalesce(new.trainer_id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists plans_owner_sync on public.plans;
create trigger plans_owner_sync
  before insert or update on public.plans
  for each row execute function public.plans_sync_owner();

create index if not exists plans_owner_id on public.plans (owner_id);

-- ------------------------------------------------------------
-- 3. Plan days: iOS day fields
-- ------------------------------------------------------------
alter table public.plan_days
  add column if not exists custom_type_label text not null default '',
  add column if not exists icon_name text not null default '',
  add column if not exists color_hex text not null default '',
  add column if not exists is_optional boolean not null default false,
  add column if not exists counts_as_gym boolean,
  add column if not exists run_modality text not null default 'walk';

-- ------------------------------------------------------------
-- 4. Plan segments — ordered activity blocks inside one day
-- ------------------------------------------------------------
create table if not exists public.plan_segments (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.plan_days (id) on delete cascade,
  title text not null default '',
  day_type text not null default 'fullbody',
  custom_type_label text not null default '',
  sort_order integer not null default 0,
  icon_name text not null default '',
  color_hex text not null default '',
  run_modality text not null default 'walk',
  counts_as_gym boolean
);

alter table public.plan_segments enable row level security;
create index if not exists plan_segments_day on public.plan_segments (plan_day_id);

-- ------------------------------------------------------------
-- 5. Plan exercises: the iOS prescription
-- ------------------------------------------------------------
alter table public.plan_exercises
  add column if not exists plan_segment_id uuid references public.plan_segments (id) on delete cascade,
  add column if not exists is_mandatory boolean not null default true,
  add column if not exists rep_scheme text not null default '',
  add column if not exists rep_style text not null default 'standard',
  add column if not exists alternate_group_id text not null default '',
  add column if not exists alternate_label text not null default '',
  add column if not exists priority integer not null default 1,
  add column if not exists category text not null default 'push',
  add column if not exists tempo text not null default '',
  add column if not exists rpe_target integer not null default 0,
  add column if not exists instructions text not null default '',
  add column if not exists repeat_rule text not null default 'weekly',
  add column if not exists scheduled_date date,
  add column if not exists icon_name text not null default '',
  add column if not exists color_hex text not null default '',
  add column if not exists use_bar_weight boolean not null default false,
  add column if not exists bar_weight_kg numeric not null default 20,
  add column if not exists per_side_weight_kg numeric not null default 0,
  add column if not exists weight_config text not null default 'standard';

create index if not exists plan_exercises_segment on public.plan_exercises (plan_segment_id);

-- Per-set custom fields (the coach's Excel columns) exist already on fresh
-- installs; make sure they're here, and widen log_type for the traditional
-- logging methods (bodyweight, custom, …) without touching existing values.
alter table public.plan_exercises
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

alter table public.set_logs
  add column if not exists extra jsonb not null default '{}'::jsonb;

do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.plan_exercises'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%log_type%';
  if c is not null then
    execute format('alter table public.plan_exercises drop constraint %I', c);
  end if;
end;
$$;

-- Anything outside the new list (there shouldn't be any) becomes the default,
-- so adding the constraint can't fail on existing rows.
update public.plan_exercises
  set log_type = 'strength'
  where log_type is null
     or log_type not in ('strength', 'bodyweight', 'cardio', 'timed', 'interval', 'custom');

alter table public.plan_exercises
  add constraint plan_exercises_log_type_check
  check (log_type in ('strength', 'bodyweight', 'cardio', 'timed', 'interval', 'custom'));

-- ------------------------------------------------------------
-- 6. Plan assignments: an athlete opts in ("sync plan from coach")
-- ------------------------------------------------------------
alter table public.plan_assignments
  add column if not exists accepted_at timestamptz,
  add column if not exists status text not null default 'offered'
    check (status in ('offered', 'active', 'declined'));

-- Existing assignments were implicitly live — keep them live.
update public.plan_assignments
  set status = 'active', accepted_at = coalesce(accepted_at, created_at)
  where status = 'offered' and created_at < now();

-- ------------------------------------------------------------
-- 7. Sessions: segments, timing, XP, coach sharing
-- ------------------------------------------------------------
alter table public.sessions
  add column if not exists plan_id uuid references public.plans (id) on delete set null,
  add column if not exists plan_segment_id uuid references public.plan_segments (id) on delete set null,
  add column if not exists day_type text not null default 'fullbody',
  add column if not exists counts_as_gym boolean not null default true,
  add column if not exists xp_awarded integer not null default 0,
  add column if not exists timer_segments jsonb not null default '[]'::jsonb,
  add column if not exists completed_names jsonb not null default '[]'::jsonb,
  -- Exercises added on the day, outside the plan: [{name, log_type, category}]
  add column if not exists extra_exercises jsonb not null default '[]'::jsonb,
  add column if not exists shared_with_coach boolean not null default true,
  add column if not exists is_late_completion boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- One session per (athlete, date, day, segment): the old constraint had no
-- segment column, which blocked logging two segments of the same day.
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.sessions'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%plan_day_id%'
    and pg_get_constraintdef(oid) not like '%plan_segment_id%';
  if c is not null then
    execute format('alter table public.sessions drop constraint %I', c);
  end if;
end;
$$;

-- NULLs stay distinct here on purpose: a session with no plan behind it
-- ("Extra work") must never collide with another one on the same date, and
-- older ad-hoc sessions already rely on that. Uniqueness is only enforced for
-- real plan days and segments, which is what the old constraint covered too.
create unique index if not exists sessions_athlete_day_segment
  on public.sessions (athlete_id, date, plan_day_id, plan_segment_id);

-- ------------------------------------------------------------
-- 8. Set logs: a few metrics the iOS logger records
-- ------------------------------------------------------------
alter table public.set_logs
  add column if not exists incline_percent numeric,
  add column if not exists pace_sec_per_km integer,
  add column if not exists plate_weight_kg numeric,
  add column if not exists bar_weight_kg numeric,
  add column if not exists steps integer;

-- ------------------------------------------------------------
-- 9. Exercise library presets (per profile)
-- ------------------------------------------------------------
create table if not exists public.exercise_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null default 'push',
  log_type text not null default 'strength',
  target_sets integer not null default 3,
  target_reps integer not null default 10,
  target_weight_kg numeric not null default 0,
  rest_sec integer not null default 90,
  icon_name text not null default '',
  color_hex text not null default '',
  is_favorite boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- Reusable logging shape for this exercise: [{key, label, type, unit}],
-- the same structure the coach's Excel columns use.
alter table public.exercise_presets
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

alter table public.exercise_presets enable row level security;

-- ------------------------------------------------------------
-- 10. XP ledger + weekly quests
-- ------------------------------------------------------------
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null default '',
  category text not null default 'habit',
  created_at timestamptz not null default now()
);

alter table public.xp_events enable row level security;
create index if not exists xp_events_profile on public.xp_events (profile_id, created_at desc);

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  key text not null,
  label text not null default '',
  target numeric not null default 1,
  progress numeric not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, week_start, key)
);

alter table public.quests enable row level security;

-- ------------------------------------------------------------
-- 11. Helper functions — ownership now spans both of my profiles
-- ------------------------------------------------------------

-- Any profile of the signed-in user (coach or athlete), approved only.
create or replace function public.owns_any_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_profile and user_id = auth.uid() and approved_at is not null
  );
$$;

create or replace function public.is_plan_owner(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plans p
    join public.profiles pr on pr.id = coalesce(p.owner_id, p.trainer_id)
    where p.id = p_plan and pr.user_id = auth.uid() and pr.approved_at is not null
  );
$$;

-- An athlete may read a plan assigned to them by a linked coach, and a coach
-- may read a plan owned by one of their linked athletes (to track their work).
create or replace function public.can_athlete_read_plan(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_assignments a
    join public.plans p on p.id = a.plan_id
    where a.plan_id = p_plan
      and a.athlete_id = public.my_profile_id('athlete')
      and public.is_linked(coalesce(p.owner_id, p.trainer_id), a.athlete_id)
  )
  or exists (
    select 1 from public.plans p
    where p.id = p_plan
      and public.is_linked(public.my_profile_id('coach'), coalesce(p.owner_id, p.trainer_id))
  );
$$;

create or replace function public.can_athlete_read_day(p_day uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_days d
    where d.id = p_day and public.can_athlete_read_plan(d.plan_id)
  );
$$;

create or replace function public.can_read_segment(p_segment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_segments s
    join public.plan_days d on d.id = s.plan_day_id
    where s.id = p_segment
      and (public.is_plan_owner(d.plan_id) or public.can_athlete_read_plan(d.plan_id))
  );
$$;

revoke all on function public.owns_any_profile(uuid) from public, anon;
grant execute on function public.owns_any_profile(uuid) to authenticated;
revoke all on function public.can_read_segment(uuid) from public, anon;
grant execute on function public.can_read_segment(uuid) to authenticated;

-- ------------------------------------------------------------
-- 12. Policies for the new tables (and owner-aware plan policies)
-- ------------------------------------------------------------

-- plans: owner (either role) has full control; readers per the helper above.
drop policy if exists "plans_coach_all" on public.plans;
create policy "plans_owner_all" on public.plans for all
  using (public.owns_any_profile(coalesce(owner_id, trainer_id)))
  with check (public.owns_any_profile(coalesce(owner_id, trainer_id)));

drop policy if exists "plans_athlete_select" on public.plans;
create policy "plans_shared_select" on public.plans for select
  using (public.can_athlete_read_plan(id));

drop policy if exists "plan_days_coach_all" on public.plan_days;
create policy "plan_days_owner_all" on public.plan_days for all
  using (public.is_plan_owner(plan_id))
  with check (public.is_plan_owner(plan_id));

drop policy if exists "plan_exercises_coach_all" on public.plan_exercises;
create policy "plan_exercises_owner_all" on public.plan_exercises for all
  using (exists (
    select 1 from public.plan_days d
    where d.id = plan_day_id and public.is_plan_owner(d.plan_id)
  ))
  with check (exists (
    select 1 from public.plan_days d
    where d.id = plan_day_id and public.is_plan_owner(d.plan_id)
  ));

-- plan_segments
drop policy if exists "plan_segments_owner_all" on public.plan_segments;
create policy "plan_segments_owner_all" on public.plan_segments for all
  using (exists (
    select 1 from public.plan_days d
    where d.id = plan_day_id and public.is_plan_owner(d.plan_id)
  ))
  with check (exists (
    select 1 from public.plan_days d
    where d.id = plan_day_id and public.is_plan_owner(d.plan_id)
  ));

drop policy if exists "plan_segments_shared_select" on public.plan_segments;
create policy "plan_segments_shared_select" on public.plan_segments for select
  using (public.can_athlete_read_day(plan_day_id));

-- assignments: an athlete may accept/decline their own assignment row.
drop policy if exists "assignments_athlete_update" on public.plan_assignments;
create policy "assignments_athlete_update" on public.plan_assignments for update
  using (athlete_id = public.my_profile_id('athlete'))
  with check (athlete_id = public.my_profile_id('athlete'));

-- sessions: an athlete owns theirs; a linked coach reads shared ones.
drop policy if exists "sessions_coach_select" on public.sessions;
create policy "sessions_coach_select" on public.sessions for select
  using (shared_with_coach and public.is_linked(public.my_profile_id('coach'), athlete_id));

drop policy if exists "set_logs_coach_select" on public.set_logs;
create policy "set_logs_coach_select" on public.set_logs for select
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id
      and s.shared_with_coach
      and public.is_linked(public.my_profile_id('coach'), s.athlete_id)
  ));

-- exercise_presets / xp_events / quests: private to the owning profile.
drop policy if exists "exercise_presets_owner_all" on public.exercise_presets;
create policy "exercise_presets_owner_all" on public.exercise_presets for all
  using (public.owns_any_profile(owner_id))
  with check (public.owns_any_profile(owner_id));

drop policy if exists "xp_events_owner_all" on public.xp_events;
create policy "xp_events_owner_all" on public.xp_events for all
  using (public.owns_any_profile(profile_id))
  with check (public.owns_any_profile(profile_id));

drop policy if exists "quests_owner_all" on public.quests;
create policy "quests_owner_all" on public.quests for all
  using (public.owns_any_profile(profile_id))
  with check (public.owns_any_profile(profile_id));

-- ------------------------------------------------------------
-- 13. Coaching tools — messages, check-ins, notes, trackers
--
-- These come from migrations 001/002. Recreated here with
-- `if not exists` so this file alone is enough on a fresh project.
-- ------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_link_idx on public.messages (coach_link_id, created_at);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links (id) on delete cascade,
  week_index int not null check (week_index >= 1),
  weight_kg numeric,
  sleep text not null default '',
  energy text not null default '',
  appetite text not null default '',
  pain text not null default '',
  submitted_at timestamptz not null default now(),
  unique (coach_link_id, week_index)
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links (id) on delete cascade,
  note_date date not null default current_date,
  observation text not null default '',
  adjustment text not null default '',
  reason text not null default '',
  next_review date,
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_templates (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links (id) on delete cascade,
  kind text not null default 'body_assessment',
  title text not null default '',
  metrics jsonb not null default '[]'::jsonb,
  column_labels jsonb not null default '[]'::jsonb,
  column_mode text not null default 'weekly' check (column_mode in ('weekly', 'milestone')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.tracker_templates (id) on delete cascade,
  coach_link_id uuid not null references public.coach_links (id) on delete cascade,
  metric_key text not null,
  column_index int not null default 0,
  value text not null default '',
  updated_at timestamptz not null default now(),
  unique (template_id, metric_key, column_index)
);

alter table public.messages enable row level security;
alter table public.check_ins enable row level security;
alter table public.coach_notes enable row level security;
alter table public.tracker_templates enable row level security;
alter table public.tracker_entries enable row level security;

-- Either side of an active link may act on that link's rows.
create or replace function public.link_is_coach(p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_links cl
    join public.profiles p on p.id = cl.trainer_id
    where cl.id = p_link_id and cl.status = 'active'
      and p.user_id = auth.uid() and p.role = 'coach'
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
    select 1 from public.coach_links cl
    join public.profiles p on p.id = cl.athlete_id
    where cl.id = p_link_id and cl.status = 'active'
      and p.user_id = auth.uid() and p.role = 'athlete'
  );
$$;

revoke all on function public.link_is_coach(uuid) from public, anon;
grant execute on function public.link_is_coach(uuid) to authenticated;
revoke all on function public.link_is_athlete(uuid) from public, anon;
grant execute on function public.link_is_athlete(uuid) to authenticated;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id))
    and exists (select 1 from public.profiles p where p.id = sender_profile_id and p.user_id = auth.uid())
  );
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));

drop policy if exists check_ins_select on public.check_ins;
create policy check_ins_select on public.check_ins for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists check_ins_insert on public.check_ins;
create policy check_ins_insert on public.check_ins for insert
  with check (public.link_is_athlete(coach_link_id));
drop policy if exists check_ins_update on public.check_ins;
create policy check_ins_update on public.check_ins for update
  using (public.link_is_athlete(coach_link_id));

drop policy if exists coach_notes_select on public.coach_notes;
create policy coach_notes_select on public.coach_notes for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists coach_notes_write on public.coach_notes;
create policy coach_notes_write on public.coach_notes for all
  using (public.link_is_coach(coach_link_id))
  with check (public.link_is_coach(coach_link_id));

drop policy if exists tracker_templates_select on public.tracker_templates;
create policy tracker_templates_select on public.tracker_templates for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists tracker_templates_write on public.tracker_templates;
create policy tracker_templates_write on public.tracker_templates for all
  using (public.link_is_coach(coach_link_id))
  with check (public.link_is_coach(coach_link_id));

drop policy if exists tracker_entries_select on public.tracker_entries;
create policy tracker_entries_select on public.tracker_entries for select
  using (public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id));
drop policy if exists tracker_entries_write on public.tracker_entries;
create policy tracker_entries_write on public.tracker_entries for all
  using (public.link_is_coach(coach_link_id))
  with check (public.link_is_coach(coach_link_id));

-- ------------------------------------------------------------
-- 14. Realtime for the new tables
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'plan_segments', 'exercise_presets', 'xp_events', 'quests',
    'messages', 'check_ins', 'coach_notes', 'tracker_templates', 'tracker_entries'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end;
$$;
