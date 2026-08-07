import { supabase } from "./supabase";
import {
  effectiveStart,
  type AthletePlan,
  type AthleteProgram,
  type Plan,
  type ProgressionExercise,
  activeAthletePlans,
} from "./types";

/** Active assigned plan for a coach on a given date. */
export function activePlanForCoach(
  athletePlans: AthletePlan[],
  trainerId: string,
  date = new Date(),
): AthletePlan | null {
  return activeAthletePlans(athletePlans, date).find((ap) => ap.plan.trainer_id === trainerId) ?? null;
}

/** Distinct exercise names from a plan (preserves first-seen casing). */
export async function fetchPlanExerciseNames(planId: string): Promise<string[]> {
  const { data: days } = await supabase.from("plan_days").select("id").eq("plan_id", planId);
  if (!days?.length) return [];
  const { data: exs } = await supabase
    .from("plan_exercises")
    .select("name")
    .in(
      "plan_day_id",
      days.map((d) => d.id),
    );
  const seen = new Set<string>();
  const names: string[] = [];
  for (const ex of exs ?? []) {
    const n = (ex as { name: string }).name.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(n);
  }
  return names;
}

/** Mirror plan timeline + exercises into the progression hub for a coach link. */
export async function syncProgramFromPlan(
  coachLinkId: string,
  plan: Plan,
  assignmentStart: string | null,
  options?: { syncExercises?: boolean },
): Promise<void> {
  const startDate = effectiveStart(plan, { start_date: assignmentStart });
  const syncExercises = options?.syncExercises ?? true;

  const { data: existing } = await supabase
    .from("athlete_programs")
    .select("id")
    .eq("coach_link_id", coachLinkId)
    .maybeSingle();

  const row = {
    duration_weeks: plan.weeks,
    start_date: startDate,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("athlete_programs").update(row).eq("id", (existing as { id: string }).id);
  } else {
    await supabase.from("athlete_programs").insert({
      coach_link_id: coachLinkId,
      goals: "",
      assessment_date: null,
      progression_metric: "max_weight",
      ...row,
    });
  }

  if (!syncExercises) return;

  const planNames = await fetchPlanExerciseNames(plan.id);
  if (planNames.length === 0) return;

  const { data: current } = await supabase
    .from("progression_exercises")
    .select("*")
    .eq("coach_link_id", coachLinkId)
    .order("sort_order");

  const currentList = (current as ProgressionExercise[]) ?? [];
  const existingKeys = new Set(currentList.map((e) => e.exercise_name.toLowerCase()));
  const toAdd = planNames.filter((n) => !existingKeys.has(n.toLowerCase()));
  if (toAdd.length === 0) return;

  await supabase.from("progression_exercises").insert(
    toAdd.map((name, i) => ({
      coach_link_id: coachLinkId,
      exercise_name: name,
      sort_order: currentList.length + i,
    })),
  );
}

/** Sync after plan assignment — resolves coach link from trainer + athlete. */
export async function syncProgramForAthletePlan(
  trainerId: string,
  athleteId: string,
  plan: Plan,
  assignmentStart: string | null,
): Promise<void> {
  const { data: link } = await supabase
    .from("coach_links")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) return;
  await syncProgramFromPlan((link as { id: string }).id, plan, assignmentStart);
}

export interface PlanProgramMismatch {
  onlyInPlan: string[];
  onlyInProgression: string[];
  durationMismatch: boolean;
  startMismatch: boolean;
  planWeeks: number;
  programWeeks: number;
  planStart: string;
  programStart: string;
}

export function computePlanProgramMismatch(
  plan: Plan | null,
  assignmentStart: string | null,
  program: AthleteProgram | null,
  progressionExercises: ProgressionExercise[],
  planExerciseNames: string[],
): PlanProgramMismatch | null {
  if (!plan) return null;
  const planStart = effectiveStart(plan, { start_date: assignmentStart });
  const programStart = program?.start_date ?? planStart;
  const planWeeks = plan.weeks;
  const programWeeks = program?.duration_weeks ?? planWeeks;

  const planSet = new Set(planExerciseNames.map((n) => n.toLowerCase()));
  const progSet = new Set(progressionExercises.map((e) => e.exercise_name.toLowerCase()));

  return {
    onlyInPlan: planExerciseNames.filter((n) => !progSet.has(n.toLowerCase())),
    onlyInProgression: progressionExercises
      .map((e) => e.exercise_name)
      .filter((n) => !planSet.has(n.toLowerCase())),
    durationMismatch: program != null && programWeeks !== planWeeks,
    startMismatch: program?.start_date != null && program.start_date !== planStart,
    planWeeks,
    programWeeks,
    planStart,
    programStart,
  };
}

export function hasPlanProgramMismatch(m: PlanProgramMismatch | null): boolean {
  if (!m) return false;
  return (
    m.onlyInPlan.length > 0 ||
    m.onlyInProgression.length > 0 ||
    m.durationMismatch ||
    m.startMismatch
  );
}
