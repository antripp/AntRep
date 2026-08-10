-- 016 — Safe, scoped clearing for exercise logs and training sessions
--
-- Clearing is deliberately exposed through authorized functions instead of
-- client-side DELETE chains. Both the athlete and their active linked coach
-- may correct a log, and every operation is limited to one named exercise or
-- one session. Session deletion relies on the existing set_logs cascade.

create or replace function public.clear_exercise_log(
  p_session_id uuid,
  p_exercise_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_name text := trim(p_exercise_name);
begin
  if auth.uid() is null then
    raise exception 'Sign in before clearing training data.' using errcode = '42501';
  end if;

  select athlete_id into v_athlete_id
  from public.sessions
  where id = p_session_id;

  if v_athlete_id is null then
    raise exception 'The training session no longer exists.' using errcode = 'P0002';
  end if;

  if not public.owns_profile(v_athlete_id)
     and not public.is_linked(public.my_profile_id('coach'), v_athlete_id) then
    raise exception 'You cannot clear this athlete''s training log.' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'Exercise name is required.' using errcode = '22023';
  end if;

  delete from public.set_logs
  where session_id = p_session_id
    and lower(regexp_replace(trim(exercise_name), '\s+', ' ', 'g')) =
        lower(regexp_replace(v_name, '\s+', ' ', 'g'));

  -- A cleared exercise is no longer complete. Keep every unrelated completion
  -- marker and make a previously completed session editable again.
  update public.sessions s
  set completed_names = coalesce((
        select jsonb_agg(value)
        from jsonb_array_elements(coalesce(s.completed_names, '[]'::jsonb)) item(value)
        where lower(regexp_replace(trim(value #>> '{}'), '\s+', ' ', 'g')) <>
              lower(regexp_replace(v_name, '\s+', ' ', 'g'))
      ), '[]'::jsonb),
      status = case when s.status = 'complete' then 'in_progress' else s.status end,
      ended_at = case when s.status = 'complete' then null else s.ended_at end,
      updated_at = now()
  where s.id = p_session_id;
end;
$$;

create or replace function public.clear_training_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before clearing training data.' using errcode = '42501';
  end if;

  select athlete_id into v_athlete_id
  from public.sessions
  where id = p_session_id;

  if v_athlete_id is null then
    raise exception 'The training session no longer exists.' using errcode = 'P0002';
  end if;

  if not public.owns_profile(v_athlete_id)
     and not public.is_linked(public.my_profile_id('coach'), v_athlete_id) then
    raise exception 'You cannot clear this athlete''s training session.' using errcode = '42501';
  end if;

  delete from public.sessions where id = p_session_id;
end;
$$;

revoke all on function public.clear_exercise_log(uuid, text) from public;
revoke all on function public.clear_training_session(uuid) from public;
grant execute on function public.clear_exercise_log(uuid, text) to authenticated;
grant execute on function public.clear_training_session(uuid) to authenticated;

comment on function public.clear_exercise_log(uuid, text) is
  'Clears one normalized exercise log and its completion marker for the athlete or an active linked coach.';
comment on function public.clear_training_session(uuid) is
  'Deletes one training session and its cascading logs for the athlete or an active linked coach.';
