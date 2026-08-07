/**
 * Domain model for the AntRep app — a direct port of the iOS SwiftData model.
 *
 * Shapes match the Postgres rows (snake_case) so there is no mapping layer
 * between the database and the UI, and the same objects can be produced by the
 * offline demo backend.
 */

export type Role = "athlete" | "coach";

/** Plan day / segment type. Mirrors iOS `WorkoutType`. */
export const DAY_TYPES = [
  "push",
  "pull",
  "legs",
  "arms",
  "core",
  "fullbody",
  "hiit",
  "run",
  "sport",
  "rest",
  "custom",
] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  arms: "Arms",
  core: "Core",
  fullbody: "Full body",
  hiit: "HIIT",
  run: "Run",
  sport: "Sport",
  rest: "Rest",
  custom: "Custom",
};

/** Accent per day type — the iOS palette. */
export const DAY_TYPE_COLORS: Record<DayType, string> = {
  push: "#fa73b8",
  pull: "#21b9d4",
  legs: "#8c5cf5",
  arms: "#f5b301",
  core: "#f2c14e",
  fullbody: "#66b29c",
  hiit: "#e5484d",
  run: "#4fbe92",
  sport: "#5b7fd6",
  rest: "#66757f",
  custom: "#9a8cf5",
};

export const DAY_TYPE_ICONS: Record<DayType, string> = {
  push: "🏋️",
  pull: "🚣",
  legs: "🦵",
  arms: "💪",
  core: "🧘",
  fullbody: "🤸",
  hiit: "🔥",
  run: "🏃",
  sport: "⚽️",
  rest: "😴",
  custom: "✨",
};

/** Gym-style days count toward the weekly gym goal (iOS `WorkoutType.isGym`). */
export const GYM_DAY_TYPES: DayType[] = ["push", "pull", "legs", "arms", "core", "fullbody", "hiit"];

export function isGymType(t: DayType): boolean {
  return GYM_DAY_TYPES.includes(t);
}

/**
 * How an exercise is logged. `custom` uses only its `custom_fields`;
 * every type can add custom fields on top.
 */
export type LogType = "strength" | "bodyweight" | "cardio" | "timed" | "interval" | "custom";

export const LOG_TYPES: LogType[] = ["strength", "bodyweight", "cardio", "timed", "interval", "custom"];

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  strength: "Weight × reps",
  bodyweight: "Reps only",
  cardio: "Distance & time",
  timed: "Hold / time",
  interval: "Rounds",
  custom: "Custom fields",
};

export const LOG_TYPE_HINTS: Record<LogType, string> = {
  strength: "Barbell, dumbbell, machine — load and reps per set",
  bodyweight: "Push-ups, pull-ups, dips — reps, plus any added weight",
  cardio: "Run, row, bike — distance and duration",
  timed: "Plank, hang, stretch — seconds held",
  interval: "Circuits and intervals — rounds with work time",
  custom: "Only the fields you define below",
};

/** One user-defined logging field. Same shape as the coach's Excel columns. */
export interface CustomField {
  key: string;
  label: string;
  type: "number" | "text";
  unit?: string;
}

export function fieldKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "field"
  );
}
export type RepeatRule = "once" | "weekly" | "biweekly" | "monthly";
export type ExerciseCategory = "push" | "pull" | "legs" | "core" | "cardio";
export type RunModality = "walk" | "jog" | "run";

export interface AvatarPref {
  kind?: "initials" | "symbol" | "solid";
  value?: string;
  color?: string;
}

export interface ProfileSettings {
  theme_mode?: "light" | "dark";
  accent?: string;
  background?: string | null;
  quotes_enabled?: boolean;
  rest_timer_enabled?: boolean;
  units?: "kg" | "lb";
}

export interface Profile {
  id: string;
  user_id: string;
  role: Role;
  display_name: string;
  avatar?: AvatarPref;
  approved_at: string | null;
  created_at?: string;
  total_xp: number;
  level: number;
  current_streak: number;
  best_streak: number;
  last_active_date: string | null;
  weekly_gym_goal: number;
  weekly_km_goal: number;
  daily_calorie_goal: number;
  settings: ProfileSettings;
}

export interface CoachLink {
  id: string;
  trainer_id: string;
  athlete_id: string | null;
  invite_code: string | null;
  status: "pending" | "active" | "expired";
  is_self_link?: boolean;
  expires_at: string | null;
  claimed_at?: string | null;
}

export interface Plan {
  id: string;
  owner_id: string;
  trainer_id: string;
  name: string;
  is_active: boolean;
  is_archived: boolean;
  start_date: string;
  weeks: number;
  icon_name: string;
  color_hex: string;
  notes: string;
}

export interface PlanDay {
  id: string;
  plan_id: string;
  week_index: number;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  title: string;
  day_type: DayType;
  custom_type_label: string;
  icon_name: string;
  color_hex: string;
  is_optional: boolean;
  counts_as_gym: boolean | null;
  run_modality: RunModality;
  sort_order: number;
}

export interface PlanSegment {
  id: string;
  plan_day_id: string;
  title: string;
  day_type: DayType;
  custom_type_label: string;
  sort_order: number;
  icon_name: string;
  color_hex: string;
  run_modality: RunModality;
  counts_as_gym: boolean | null;
}

export interface PlanExercise {
  id: string;
  plan_day_id: string;
  plan_segment_id: string | null;
  name: string;
  sort_order: number;
  log_type: LogType;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  rest_sec: number;
  trainer_notes: string;
  instructions: string;
  is_mandatory: boolean;
  rep_scheme: string;
  alternate_group_id: string;
  alternate_label: string;
  priority: number;
  category: ExerciseCategory;
  tempo: string;
  rpe_target: number;
  repeat_rule: RepeatRule;
  scheduled_date: string | null;
  icon_name: string;
  color_hex: string;
  /** Extra per-set fields the coach wants logged (also drives the Excel export). */
  custom_fields: CustomField[];
}

/** A plan and everything under it — the unit the plan editor works with. */
export interface PlanBundle {
  plan: Plan;
  days: PlanDay[];
  segments: PlanSegment[];
  exercises: PlanExercise[];
}

export interface PlanAssignment {
  id: string;
  plan_id: string;
  athlete_id: string;
  start_date: string | null;
  status: "offered" | "active" | "declined";
  accepted_at: string | null;
  created_at?: string;
}

/** One timed window of a session (start → end, minus pauses). */
export interface TimerSegment {
  started_at: string;
  ended_at: string | null;
  paused_seconds: number;
}

/** An exercise added on the day, outside the plan. */
export interface ExtraExercise {
  name: string;
  log_type: LogType;
  category: ExerciseCategory;
  target_sets?: number;
  target_reps?: number;
  /** Copied from the athlete's library so the same exercise always logs the same way. */
  custom_fields?: CustomField[];
}

export interface Session {
  id: string;
  athlete_id: string;
  plan_id: string | null;
  plan_day_id: string | null;
  plan_segment_id: string | null;
  day_title: string;
  day_type: DayType;
  date: string;
  status: "in_progress" | "complete";
  started_at: string;
  ended_at: string | null;
  athlete_notes: string;
  calories: number | null;
  counts_as_gym: boolean;
  xp_awarded: number;
  timer_segments: TimerSegment[];
  completed_names: string[];
  extra_exercises: ExtraExercise[];
  shared_with_coach: boolean;
  is_late_completion: boolean;
}

export interface SetLog {
  id: string;
  session_id: string;
  plan_exercise_id: string | null;
  exercise_name: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  distance_km: number | null;
  duration_sec: number | null;
  incline_percent: number | null;
  pace_sec_per_km: number | null;
  note: string;
  /** Values for the exercise's custom fields, keyed by field key. */
  extra: Record<string, string | number>;
  completed_at: string;
}

export interface ExercisePreset {
  id: string;
  owner_id: string;
  name: string;
  category: ExerciseCategory;
  log_type: LogType;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  rest_sec: number;
  icon_name: string;
  color_hex: string;
  is_favorite: boolean;
  notes: string;
  /** The logging shape reused every time this exercise is logged. */
  custom_fields: CustomField[];
}

export interface XpEvent {
  id: string;
  profile_id: string;
  amount: number;
  reason: string;
  category: string;
  created_at: string;
}

export interface Quest {
  id: string;
  profile_id: string;
  week_start: string;
  key: string;
  label: string;
  target: number;
  progress: number;
  completed: boolean;
}

// ---------------------------------------------------------------
// Coaching tools: chat, weekly check-ins, notes and trackers.
// All of them hang off one coach_link, so either side can read them.
// ---------------------------------------------------------------

export interface Message {
  id: string;
  coach_link_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface CheckIn {
  id: string;
  coach_link_id: string;
  week_index: number;
  weight_kg: number | null;
  sleep: string;
  energy: string;
  appetite: string;
  pain: string;
  submitted_at: string;
}

export interface CoachNote {
  id: string;
  coach_link_id: string;
  note_date: string;
  observation: string;
  adjustment: string;
  reason: string;
  next_review: string | null;
  created_at: string;
}

export type TrackerKind = "body_assessment" | "mobility_pain" | "flexibility" | "cardio";

export const TRACKER_KIND_LABELS: Record<TrackerKind, string> = {
  body_assessment: "Body assessment",
  mobility_pain: "Mobility & pain",
  flexibility: "Flexibility",
  cardio: "Cardio",
};

export interface TrackerMetric {
  key: string;
  label: string;
  unit?: string;
}

export interface TrackerTemplate {
  id: string;
  coach_link_id: string;
  kind: TrackerKind;
  title: string;
  metrics: TrackerMetric[];
  column_labels: string[];
  column_mode: "weekly" | "milestone";
  sort_order: number;
  is_active: boolean;
}

export interface TrackerEntry {
  id: string;
  template_id: string;
  coach_link_id: string;
  metric_key: string;
  column_index: number;
  value: string;
}

/** Everything attached to one coach ↔ athlete link. */
export interface CoachingBoard {
  messages: Message[];
  checkIns: CheckIn[];
  notes: CoachNote[];
  templates: TrackerTemplate[];
  entries: TrackerEntry[];
}

/** A coach's athlete, with the link that connects them. */
export interface LinkedAthlete {
  link: CoachLink;
  profile: Profile;
}

/** A plan offered to (or synced by) an athlete. */
export interface AssignedPlan {
  bundle: PlanBundle;
  assignment: PlanAssignment;
  coach: Profile | null;
}
