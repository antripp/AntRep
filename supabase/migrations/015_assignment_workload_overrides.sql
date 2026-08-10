-- ============================================================
-- 015 — Per-athlete workload overrides on a shared plan template
--
-- Dates already live on plan_assignments. Workload patches now do too, keyed
-- by stable plan_exercise id. The template stays shared and editable; only
-- fields present in this JSON object differ for the assigned athlete.
-- ============================================================

alter table public.plan_assignments
  add column if not exists exercise_overrides jsonb not null default '{}'::jsonb;

comment on column public.plan_assignments.exercise_overrides is
  'Per-athlete PlanExercise patches keyed by template plan_exercises.id.';
