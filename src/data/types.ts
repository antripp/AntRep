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

/**
 * One prescribed set. A coach who wants "12 @ 40, 10 @ 45, 8 @ 50" writes three
 * of these; an exercise with none falls back to `target_sets` × `target_reps`.
 * Stored as jsonb, so extra keys cost no migration.
 */
export interface SetDetail {
  reps: number;
  weight_kg: number;
  /** Prescribed effort for this set specifically. 0 = use the exercise target. */
  rpe?: number;
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
  /** Auto follows the device and is the default for new accounts/devices. */
  theme_mode?: "auto" | "light" | "dark";
  /** Presentation only. Training records and calculations are shared by every mode. */
  ui_mode?: "classic" | "minimal" | "compact";
  accent?: string;
  background?: string | null;
  background_secondary?: string | null;
  theme_style?: "solid" | "gradient" | "duotone";
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
  /** False for accounts that predate email verification — they are not gated. */
  requires_email_verification: boolean;
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

/**
 * How a plan repeats.
 *
 * `weekly` — the calendar week: `weeks` blocks of Monday–Sunday, cycling.
 * `cycle`  — a split of its own length (a 9-day split restarting on the 10th).
 *            Day 1 is the plan's start date; weekdays play no part.
 */
export type ScheduleMode = "weekly" | "cycle";

export type RepeatMode = "auto" | "custom";

export interface Plan {
  id: string;
  owner_id: string;
  trainer_id: string;
  name: string;
  is_active: boolean;
  is_archived: boolean;
  /** Calendar-free templates leave this null; athlete-owned activation may set it. */
  start_date: string | null;
  /** Optional last day. Past it the plan stops scheduling and becomes a past plan. */
  end_date: string | null;
  weeks: number;
  /**
   * 'auto' repeats the first block for the plan's whole life; 'custom' cycles
   * through every block. The block count alone can't say which is meant — four
   * weeks with only week 1 filled in is "repeat this week", not "three blank
   * weeks then back to the first".
   */
  repeat_mode: RepeatMode;
  schedule_mode: ScheduleMode;
  /** Days per cycle in `cycle` mode; 0 when the plan runs on weeks. */
  cycle_length: number;
  /** Inclusive length of one athlete run, independent of its eventual start date. */
  duration_days: number;
  /** Active days in each ordered custom split. */
  split_lengths: number[];
  /** Rest interval after each matching split (the last is before repetition). */
  split_rest_days: number[];
  icon_name: string;
  color_hex: string;
  notes: string;
}

export interface PlanDay {
  id: string;
  plan_id: string;
  week_index: number;
  /** 1 = Monday … 7 = Sunday. Null on a cycle day, which has no weekday. */
  weekday: number | null;
  /** 1-based position in the cycle. Null on a weekly day. */
  cycle_day: number | null;
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
  /** Effort to aim for, 0.5 steps. 0 = none prescribed. */
  rpe_target: number;
  /** Per-set prescription. Empty = every set uses the targets above. */
  set_details: SetDetail[];
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
  /** Per-athlete end override, so ending one run doesn't end everyone's. */
  end_date: string | null;
  status: "offered" | "active" | "declined";
  /** Scheduled runs activate by date; manual runs wait for the athlete to switch. */
  activation_mode: "scheduled" | "manual";
  /** Per-athlete prescription patches, keyed by the template exercise id. */
  exercise_overrides: Record<string, PlanExerciseOverride>;
  accepted_at: string | null;
  created_at?: string;
}

export type PlanRemarkScope = "plan" | "week" | "exercise";

/**
 * Coach guidance attached to one athlete's run of a plan.
 *
 * Plan remarks have no week/exercise target. Weekly remarks use `week_index`,
 * and exercise remarks use both the plan exercise id and the week they apply
 * to. Keeping these outside the shared template lets guidance progress without
 * rewriting what every athlete sees.
 */
export interface PlanAssignmentRemark {
  id: string;
  assignment_id: string;
  coach_id: string;
  scope: PlanRemarkScope;
  week_index: number | null;
  plan_exercise_id: string | null;
  note: string;
  created_at?: string;
  updated_at?: string;
}

export type PlanExerciseOverride = Partial<
  Pick<
    PlanExercise,
    | "target_sets"
    | "target_reps"
    | "target_weight_kg"
    | "rest_sec"
    | "rpe_target"
    | "set_details"
    | "rep_scheme"
    | "trainer_notes"
    | "is_mandatory"
  >
>;

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
  /** Optional canonical metadata link. The user's name and logging shape remain authoritative. */
  wger_exercise_id: number | null;
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

export type ProgressGoalScope = "overall" | "plan" | "day" | "session" | "exercise";
export type ProgressGoalMetric = "strength" | "exercise_pr";
export type ProgressGoalTarget = "score" | "weight" | "reps" | "estimated_max";

/** A coach- or athlete-authored target attached to one analytics context. */
export interface ProgressGoal {
  id: string;
  athlete_id: string;
  set_by_profile_id: string;
  scope_type: ProgressGoalScope;
  /** Plan/session id, grouped-day key, or normalized exercise name. */
  scope_key: string | null;
  scope_label: string;
  metric: ProgressGoalMetric;
  target_type: ProgressGoalTarget;
  target_value: number;
  unit: string;
  deadline: string | null;
  notes: string;
  status: "active" | "achieved" | "cancelled";
  created_at?: string;
  updated_at?: string;
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
/**
 * The only things a coach can say. Keys are constrained by a CHECK in the
 * database (migration 008), so free text cannot reach this column even by
 * calling the API directly.
 */
export const REACTION_PRESETS = [
  { key: "well_done", label: "Well done", emoji: "👏" },
  { key: "strong_session", label: "Strong session", emoji: "💪" },
  { key: "good_consistency", label: "Good consistency", emoji: "📈" },
  { key: "nice_progress", label: "Nice progress", emoji: "🚀" },
  { key: "watch_your_form", label: "Watch your form", emoji: "👀" },
  { key: "ease_off", label: "Ease off next time", emoji: "🧊" },
  { key: "push_harder", label: "Room to push", emoji: "🔥" },
  { key: "lets_review", label: "Let's review this", emoji: "📋" },
  { key: "noted", label: "Noted", emoji: "✅" },
] as const;

export type ReactionPreset = (typeof REACTION_PRESETS)[number]["key"];

export interface ActivityReaction {
  id: string;
  coach_link_id: string;
  sender_profile_id: string;
  session_id: string | null;
  check_in_id: string | null;
  preset: ReactionPreset;
  created_at: string;
}

export interface CoachingBoard {
  /** Frozen by migration 008 — always empty, kept so old code still compiles. */
  messages: Message[];
  reactions: ActivityReaction[];
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
