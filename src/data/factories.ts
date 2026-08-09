/** Row constructors — every field defaulted so inserts never miss a column. */

import { localDate } from "../domain/dates";
import { catalogEntry, categoryFor, inferLogType } from "./catalog";
import type {
  CheckIn,
  CoachNote,
  DayType,
  ExerciseCategory,
  ExercisePreset,
  ExtraExercise,
  Plan,
  PlanDay,
  PlanExercise,
  PlanSegment,
  Profile,
  Session,
  SetLog,
  TrackerTemplate,
} from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function makePlan(ownerId: string, patch: Partial<Plan> = {}): Plan {
  return {
    id: newId(),
    owner_id: ownerId,
    trainer_id: ownerId,
    name: "Training plan",
    is_active: true,
    is_archived: false,
    start_date: localDate(),
    weeks: 1,
    schedule_mode: "weekly",
    cycle_length: 0,
    icon_name: "",
    color_hex: "",
    notes: "",
    ...patch,
  };
}

/**
 * A plan day. `slot` is the weekday (1–7) for a weekly plan; pass
 * `{ weekday: null, cycle_day: n }` in the patch — or use `slotFields()` — to
 * place it in a cycle instead.
 */
export function makeDay(planId: string, slot: number, patch: Partial<PlanDay> = {}): PlanDay {
  return {
    id: newId(),
    plan_id: planId,
    week_index: 1,
    weekday: slot,
    cycle_day: null,
    title: "Rest",
    day_type: "rest",
    custom_type_label: "",
    icon_name: "",
    color_hex: "",
    is_optional: false,
    counts_as_gym: null,
    run_modality: "walk",
    sort_order: slot,
    ...patch,
  };
}

export function makeSegment(dayId: string, patch: Partial<PlanSegment> = {}): PlanSegment {
  return {
    id: newId(),
    plan_day_id: dayId,
    title: "",
    day_type: "fullbody",
    custom_type_label: "",
    sort_order: 0,
    icon_name: "",
    color_hex: "",
    run_modality: "walk",
    counts_as_gym: null,
    ...patch,
  };
}

export function makeExercise(
  dayId: string,
  name: string,
  patch: Partial<PlanExercise> = {},
): PlanExercise {
  const preset = catalogEntry(name);
  return {
    id: newId(),
    plan_day_id: dayId,
    plan_segment_id: null,
    name,
    sort_order: 0,
    log_type: preset?.logType ?? inferLogType(name),
    target_sets: preset?.sets ?? 3,
    target_reps: preset?.reps ?? 10,
    target_weight_kg: 0,
    rest_sec: 90,
    trainer_notes: "",
    instructions: "",
    is_mandatory: true,
    rep_scheme: preset?.repScheme ?? "",
    alternate_group_id: "",
    alternate_label: "",
    priority: 1,
    category: (preset?.category ?? categoryFor(name)) as ExerciseCategory,
    tempo: "",
    rpe_target: 0,
    set_details: [],
    repeat_rule: "weekly",
    scheduled_date: null,
    icon_name: "",
    color_hex: "",
    custom_fields: [],
    ...patch,
  };
}

export function makeSession(
  athleteId: string,
  patch: Partial<Session> & { day_title: string; day_type: DayType },
): Session {
  const now = new Date().toISOString();
  return {
    id: newId(),
    athlete_id: athleteId,
    plan_id: null,
    plan_day_id: null,
    plan_segment_id: null,
    date: localDate(),
    status: "in_progress",
    started_at: now,
    ended_at: null,
    athlete_notes: "",
    calories: null,
    counts_as_gym: true,
    xp_awarded: 0,
    timer_segments: [],
    completed_names: [],
    extra_exercises: [],
    shared_with_coach: true,
    is_late_completion: false,
    ...patch,
  };
}

/** A plan-shaped exercise for something logged outside the plan. */
export function extraAsExercise(extra: ExtraExercise, sessionId: string, index = 0): PlanExercise {
  return {
    ...makeExercise("", extra.name, {
      log_type: extra.log_type,
      category: extra.category,
      target_sets: extra.target_sets ?? 3,
      target_reps: extra.target_reps ?? 10,
      is_mandatory: false,
      rep_scheme: "",
      custom_fields: extra.custom_fields ?? [],
    }),
    id: `extra:${sessionId}:${extra.name}`,
    sort_order: index,
  };
}

export function makeSet(sessionId: string, exerciseName: string, setIndex: number, patch: Partial<SetLog> = {}): SetLog {
  return {
    id: newId(),
    session_id: sessionId,
    plan_exercise_id: null,
    exercise_name: exerciseName,
    set_index: setIndex,
    weight_kg: null,
    reps: null,
    rpe: null,
    distance_km: null,
    duration_sec: null,
    incline_percent: null,
    pace_sec_per_km: null,
    note: "",
    extra: {},
    completed_at: new Date().toISOString(),
    ...patch,
  };
}

export function makePreset(ownerId: string, name: string, patch: Partial<ExercisePreset> = {}): ExercisePreset {
  const entry = catalogEntry(name);
  return {
    id: newId(),
    owner_id: ownerId,
    name,
    category: (entry?.category ?? categoryFor(name)) as ExerciseCategory,
    log_type: entry?.logType ?? inferLogType(name),
    target_sets: entry?.sets ?? 3,
    target_reps: entry?.reps ?? 10,
    target_weight_kg: 0,
    rest_sec: 90,
    icon_name: "",
    color_hex: "",
    is_favorite: false,
    notes: "",
    custom_fields: [],
    ...patch,
  };
}

export function makeCheckIn(linkId: string, weekIndex: number, patch: Partial<CheckIn> = {}): CheckIn {
  return {
    id: newId(),
    coach_link_id: linkId,
    week_index: weekIndex,
    weight_kg: null,
    sleep: "",
    energy: "",
    appetite: "",
    pain: "",
    submitted_at: new Date().toISOString(),
    ...patch,
  };
}

export function makeCoachNote(linkId: string, patch: Partial<CoachNote> = {}): CoachNote {
  return {
    id: newId(),
    coach_link_id: linkId,
    note_date: localDate(),
    observation: "",
    adjustment: "",
    reason: "",
    next_review: null,
    created_at: new Date().toISOString(),
    ...patch,
  };
}

export function makeTrackerTemplate(
  linkId: string,
  patch: Partial<TrackerTemplate> = {},
): TrackerTemplate {
  return {
    id: newId(),
    coach_link_id: linkId,
    kind: "body_assessment",
    title: "Body assessment",
    metrics: [
      { key: "weight", label: "Weight", unit: "kg" },
      { key: "waist", label: "Waist", unit: "cm" },
    ],
    column_labels: ["Week 1", "Week 4", "Week 8", "Week 12"],
    column_mode: "milestone",
    sort_order: 0,
    is_active: true,
    ...patch,
  };
}

export function makeProfile(userId: string, role: Profile["role"], displayName: string): Profile {
  return {
    id: newId(),
    user_id: userId,
    role,
    display_name: displayName,
    avatar: {},
    approved_at: new Date().toISOString(),
    requires_email_verification: false,
    created_at: new Date().toISOString(),
    total_xp: 0,
    level: 1,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
    weekly_gym_goal: 3,
    weekly_km_goal: 10,
    daily_calorie_goal: 2000,
    settings: {},
  };
}
