-- ============================================================

-- Migration 009 originally omitted week_index here, which made a varying
-- multi-block cycle collide as soon as block 2 reused cycle day 1.
drop index if exists public.plan_days_cycle_slot;
create unique index plan_days_cycle_slot
  on public.plan_days (plan_id, week_index, cycle_day)
  where cycle_day is not null;
-- 014 — Atomic, idempotent set replacement for batch logging
--
-- The old client performed DELETE then INSERT as two requests. A network or
-- constraint failure between them could erase a valid exercise log, and a
-- linked coach could not update an existing log because DELETE was denied by
-- RLS. This function performs the replacement in one transaction, validates
-- the actor, normalizes exercise identity, and refuses marker-only blank rows.
-- ============================================================

create or replace function public.replace_exercise_sets(
  p_session_id uuid,
  p_exercise_name text,
  p_sets jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_plan_day_id uuid;
  v_plan_exercise_id uuid;
  v_set jsonb;
  v_name text := trim(p_exercise_name);
  v_extra jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in before saving training data.' using errcode = '42501';
  end if;

  select athlete_id, plan_day_id into v_athlete_id, v_plan_day_id
  from public.sessions
  where id = p_session_id;

  if v_athlete_id is null then
    raise exception 'The training session no longer exists.' using errcode = 'P0002';
  end if;

  if not public.owns_profile(v_athlete_id)
     and not public.is_linked(public.my_profile_id('coach'), v_athlete_id) then
    raise exception 'You cannot edit this athlete''s training log.' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'Exercise name is required.' using errcode = '22023';
  end if;

  -- Treat casing and repeated whitespace as the same exercise. This also
  -- clears any legacy casing variants before the canonical rows are inserted.
  delete from public.set_logs
  where session_id = p_session_id
    and lower(regexp_replace(trim(exercise_name), '\s+', ' ', 'g')) =
        lower(regexp_replace(v_name, '\s+', ' ', 'g'));

  for v_set in select value from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb))
  loop
    v_extra := coalesce(v_set -> 'extra', '{}'::jsonb);
    v_plan_exercise_id := nullif(v_set ->> 'plan_exercise_id', '')::uuid;

    -- Never allow a caller to attach a set to an exercise from a different
    -- plan day. Legacy/free-work rows legitimately carry NULL here.
    if v_plan_exercise_id is not null and not exists (
      select 1 from public.plan_exercises pe
      where pe.id = v_plan_exercise_id and pe.plan_day_id = v_plan_day_id
    ) then
      raise exception 'The exercise does not belong to this session.' using errcode = '23503';
    end if;

    -- RPE and notes describe a performed set but do not establish that a set
    -- happened. Match the app's setHasData rule exactly.
    if coalesce(nullif(v_set ->> 'weight_kg', '')::numeric, 0) <= 0
       and coalesce(nullif(v_set ->> 'reps', '')::numeric, 0) <= 0
       and coalesce(nullif(v_set ->> 'distance_km', '')::numeric, 0) <= 0
       and coalesce(nullif(v_set ->> 'duration_sec', '')::numeric, 0) <= 0
       and coalesce(nullif(v_set ->> 'incline_percent', '')::numeric, 0) <= 0
       and coalesce(nullif(v_set ->> 'pace_sec_per_km', '')::numeric, 0) <= 0
       and not exists (
         select 1 from jsonb_each(v_extra) e
         where e.value <> 'null'::jsonb and e.value <> '""'::jsonb
       ) then
      continue;
    end if;

    insert into public.set_logs (
      id, session_id, plan_exercise_id, exercise_name, set_index,
      weight_kg, reps, rpe, distance_km, duration_sec,
      incline_percent, pace_sec_per_km, note, extra, completed_at
    ) values (
      coalesce(nullif(v_set ->> 'id', '')::uuid, extensions.gen_random_uuid()),
      p_session_id,
      v_plan_exercise_id,
      v_name,
      greatest(1, coalesce(nullif(v_set ->> 'set_index', '')::integer, 1)),
      nullif(v_set ->> 'weight_kg', '')::numeric,
      nullif(v_set ->> 'reps', '')::integer,
      nullif(v_set ->> 'rpe', '')::numeric,
      nullif(v_set ->> 'distance_km', '')::numeric,
      nullif(v_set ->> 'duration_sec', '')::integer,
      nullif(v_set ->> 'incline_percent', '')::numeric,
      nullif(v_set ->> 'pace_sec_per_km', '')::integer,
      coalesce(v_set ->> 'note', ''),
      v_extra,
      coalesce(nullif(v_set ->> 'completed_at', '')::timestamptz, now())
    );
  end loop;
end;
$$;

revoke all on function public.replace_exercise_sets(uuid, text, jsonb) from public;
grant execute on function public.replace_exercise_sets(uuid, text, jsonb) to authenticated;

comment on function public.replace_exercise_sets(uuid, text, jsonb) is
  'Atomically replaces one exercise log, skipping blank set rows. Available to the athlete and their active linked coach.';
