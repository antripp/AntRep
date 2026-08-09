-- ============================================================
-- 008 — Free-text chat out, preset reactions in
--
-- Run once in Supabase → SQL Editor, after 001–007.
--
-- Coaches and athletes could send each other arbitrary text. For a closed
-- beta that is a moderation surface nobody is staffed to watch, so it goes.
--
-- What replaces it: an activity feed the app derives from sessions and
-- check-ins, and reactions a coach can leave on it. A reaction is a key from
-- a fixed list, not a string — the CHECK constraint means arbitrary text is
-- rejected by Postgres, so the restriction cannot be undone by calling the
-- API directly.
--
-- No message is deleted. `messages` keeps every row; it is only hidden, so
-- turning chat back on later is a policy change and nothing is lost.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Hide chat, and stop new chat being written
-- ------------------------------------------------------------
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;

-- No select policy at all: RLS denies by default, so history is invisible to
-- the API while remaining intact in the table. Restoring the old policy brings
-- every message back exactly as it was.
comment on table public.messages is
  'Frozen by migration 008. Rows are retained but no RLS policy grants access, '
  'so nothing is readable or writable through the API. Chat was replaced by '
  'activity_reactions. Re-add a select policy to restore history.';

-- ------------------------------------------------------------
-- 2. Reactions — a fixed vocabulary, enforced by the database
-- ------------------------------------------------------------
create table if not exists public.activity_reactions (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Exactly one of these is set: the thing being reacted to.
  session_id uuid references public.sessions (id) on delete cascade,
  check_in_id uuid references public.check_ins (id) on delete cascade,
  preset text not null,
  created_at timestamptz not null default now(),

  constraint activity_reactions_target_ck
    check (num_nonnulls(session_id, check_in_id) = 1),

  -- The whole point: no free text can reach this column.
  constraint activity_reactions_preset_ck check (preset in (
    'well_done',
    'strong_session',
    'good_consistency',
    'nice_progress',
    'watch_your_form',
    'ease_off',
    'push_harder',
    'lets_review',
    'noted'
  )),

  -- One reaction per coach per item; re-reacting replaces it.
  unique (coach_link_id, sender_profile_id, session_id, check_in_id)
);

create index if not exists activity_reactions_link_idx
  on public.activity_reactions (coach_link_id, created_at desc);

alter table public.activity_reactions enable row level security;

-- ------------------------------------------------------------
-- 3. Who may react, and to what
--
-- A coach may only react to a session logged against one of their own plans.
-- With several coaches on one athlete this keeps each coach's feed to the work
-- they actually prescribed; free work and other coaches' plans stay out of it.
-- ------------------------------------------------------------
create or replace function public.coach_owns_session(p_session_id uuid, p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.plans pl on pl.id = s.plan_id
    join public.coach_links cl on cl.id = p_link_id
    where s.id = p_session_id
      and s.shared_with_coach
      and cl.athlete_id = s.athlete_id
      and coalesce(pl.owner_id, pl.trainer_id) = cl.trainer_id
  );
$$;

revoke all on function public.coach_owns_session(uuid, uuid) from public, anon;
grant execute on function public.coach_owns_session(uuid, uuid) to authenticated;

-- Both sides read the reactions on their own link.
drop policy if exists activity_reactions_select on public.activity_reactions;
create policy activity_reactions_select on public.activity_reactions for select
  using (
    public.link_is_coach(coach_link_id) or public.link_is_athlete(coach_link_id)
  );

-- Only the coach writes them, only as themselves, and only on their own work.
drop policy if exists activity_reactions_insert on public.activity_reactions;
create policy activity_reactions_insert on public.activity_reactions for insert
  with check (
    public.link_is_coach(coach_link_id)
    and exists (
      select 1 from public.profiles p
      where p.id = sender_profile_id and p.user_id = auth.uid() and p.role = 'coach'
    )
    and (
      session_id is null
      or public.coach_owns_session(session_id, coach_link_id)
    )
  );

drop policy if exists activity_reactions_update on public.activity_reactions;

create policy activity_reactions_update on public.activity_reactions for update
  using (
    public.link_is_coach(coach_link_id)
    and exists (
      select 1 from public.profiles p
      where p.id = sender_profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists activity_reactions_delete on public.activity_reactions;

create policy activity_reactions_delete on public.activity_reactions for delete
  using (
    public.link_is_coach(coach_link_id)
    and exists (
      select 1 from public.profiles p
      where p.id = sender_profile_id and p.user_id = auth.uid()
    )
  );
