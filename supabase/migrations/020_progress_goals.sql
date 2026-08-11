-- 020 — Coach- and athlete-authored progression goals.
-- One table supports overall strength, plan/day/session targets and exercise PRs.

create table if not exists public.progress_goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  set_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null check (scope_type in ('overall', 'plan', 'day', 'session', 'exercise')),
  scope_key text,
  scope_label text not null default '',
  metric text not null check (metric in ('strength', 'exercise_pr')),
  target_type text not null check (target_type in ('score', 'weight', 'reps', 'estimated_max')),
  target_value numeric not null check (target_value > 0),
  unit text not null default '',
  deadline date,
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'achieved', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists progress_goals_athlete_idx
  on public.progress_goals(athlete_id, status, deadline);

alter table public.progress_goals enable row level security;

drop policy if exists progress_goals_select on public.progress_goals;
create policy progress_goals_select on public.progress_goals for select
using (
  athlete_id in (select id from public.profiles where user_id = auth.uid())
  or exists (
    select 1 from public.coach_links link
    join public.profiles coach on coach.id = link.trainer_id
    where link.athlete_id = progress_goals.athlete_id
      and link.status = 'active'
      and coach.user_id = auth.uid()
  )
);

drop policy if exists progress_goals_insert on public.progress_goals;
create policy progress_goals_insert on public.progress_goals for insert
with check (
  set_by_profile_id in (select id from public.profiles where user_id = auth.uid())
  and (
    athlete_id in (select id from public.profiles where user_id = auth.uid())
    or exists (
      select 1 from public.coach_links link
      join public.profiles coach on coach.id = link.trainer_id
      where link.athlete_id = progress_goals.athlete_id
        and link.status = 'active'
        and coach.user_id = auth.uid()
    )
  )
);

drop policy if exists progress_goals_update on public.progress_goals;
create policy progress_goals_update on public.progress_goals for update
using (
  set_by_profile_id in (select id from public.profiles where user_id = auth.uid())
  or athlete_id in (select id from public.profiles where user_id = auth.uid())
)
with check (
  set_by_profile_id in (select id from public.profiles where user_id = auth.uid())
  or athlete_id in (select id from public.profiles where user_id = auth.uid())
);

drop policy if exists progress_goals_delete on public.progress_goals;
create policy progress_goals_delete on public.progress_goals for delete
using (
  set_by_profile_id in (select id from public.profiles where user_id = auth.uid())
  or athlete_id in (select id from public.profiles where user_id = auth.uid())
);

create or replace function public.touch_progress_goal_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists progress_goals_touch_updated_at on public.progress_goals;
create trigger progress_goals_touch_updated_at
before update on public.progress_goals
for each row execute function public.touch_progress_goal_updated_at();
