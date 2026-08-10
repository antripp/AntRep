import type { PlanAssignment, PlanBundle, PlanExerciseOverride } from "../data/types";

/** Overlay one athlete's workload patches without mutating the coach template. */
export function applyAssignmentOverrides(
  bundle: PlanBundle,
  assignment?: Pick<PlanAssignment, "exercise_overrides"> | null,
): PlanBundle {
  const overrides = assignment?.exercise_overrides ?? {};
  if (Object.keys(overrides).length === 0) return bundle;
  return {
    ...bundle,
    exercises: bundle.exercises.map((exercise) => ({
      ...exercise,
      ...(overrides[exercise.id] ?? {}),
    })),
  };
}

const WORKLOAD_KEYS: (keyof PlanExerciseOverride)[] = [
  "target_sets",
  "target_reps",
  "target_weight_kg",
  "rest_sec",
  "rpe_target",
  "set_details",
  "rep_scheme",
  "trainer_notes",
  "is_mandatory",
];

/** Keep JSON small: fields equal to the template are not overrides. */
export function workloadDiff(
  template: PlanBundle,
  customized: PlanBundle,
): PlanAssignment["exercise_overrides"] {
  const result: PlanAssignment["exercise_overrides"] = {};
  for (const base of template.exercises) {
    const next = customized.exercises.find((exercise) => exercise.id === base.id);
    if (!next) continue;
    const patch: PlanExerciseOverride = {};
    for (const key of WORKLOAD_KEYS) {
      if (JSON.stringify(next[key]) !== JSON.stringify(base[key])) {
        // The indexed keys are deliberately constrained to PlanExerciseOverride.
        (patch as Record<string, unknown>)[key] = next[key];
      }
    }
    if (Object.keys(patch).length > 0) result[base.id] = patch;
  }
  return result;
}
