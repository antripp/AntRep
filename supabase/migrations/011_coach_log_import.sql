-- ============================================================
-- 011 — Let a coach write an athlete's training log
--
-- Until now a coach could only SELECT their athletes' sessions and set_logs
-- (`sessions_coach_select`, `set_logs_coach_select`). That is the right default:
-- the log is the athlete's record of what they did, and a coach inventing
-- entries in it is not a normal coaching action.
--
-- Batch import needs the exception. A coach onboarding an athlete with three
-- years of history in a spreadsheet has to be able to put it in on their
-- behalf. The grant is deliberately narrow:
--
--   * INSERT and UPDATE only — never DELETE. A coach can add history and
--     correct what they added; they cannot erase an athlete's own record.
--   * Only while the coach_link is 'active'. Ending the relationship ends the
--     write access, and `is_linked` already enforces that.
--   * Athletes keep full control of their own rows through the existing
--     `_athlete_all` policies, which are unchanged.
-- ============================================================

-- Sessions ---------------------------------------------------

drop policy if exists sessions_coach_insert on public.sessions;
create policy sessions_coach_insert on public.sessions for insert
  with check (public.is_linked(public.my_profile_id('coach'), athlete_id));

drop policy if exists sessions_coach_update on public.sessions;
create policy sessions_coach_update on public.sessions for update
  using (public.is_linked(public.my_profile_id('coach'), athlete_id))
  with check (public.is_linked(public.my_profile_id('coach'), athlete_id));

-- Set logs ---------------------------------------------------
-- Reached through the session, so the same link check covers them.

drop policy if exists set_logs_coach_insert on public.set_logs;
create policy set_logs_coach_insert on public.set_logs for insert
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id
      and public.is_linked(public.my_profile_id('coach'), s.athlete_id)
  ));

drop policy if exists set_logs_coach_update on public.set_logs;
create policy set_logs_coach_update on public.set_logs for update
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id
      and public.is_linked(public.my_profile_id('coach'), s.athlete_id)
  ))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id
      and public.is_linked(public.my_profile_id('coach'), s.athlete_id)
  ));

-- No DELETE policy, deliberately.
--
-- `replaceSets` clears an exercise's rows before inserting. With no delete
-- policy that clear matches zero rows and succeeds — RLS filters DELETEs, it
-- does not raise on them — so importing INTO A NEW SESSION works unchanged.
-- Overwriting sets that already exist then fails loudly on the
-- unique (session_id, exercise_name, set_index) constraint, which is the
-- outcome we want: a coach can add history, never quietly erase it. The
-- importer skips sessions the athlete already has for this reason.
