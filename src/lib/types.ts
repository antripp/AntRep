export type Role = "athlete" | "coach";

/** Profile picture: coloured initials, an emoji symbol, or a solid dot. */
export interface AvatarPref {
  kind?: "initials" | "symbol" | "solid";
  value?: string; // emoji for "symbol"
  color?: string; // background hex
}

export interface HealthMetrics {
  height_cm?: string;
  weight_kg?: string;
  age?: string;
  sex?: string;
  resting_hr?: string;
  blood_pressure?: string;
  notes?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  role: Role;
  display_name: string;
  avatar?: AvatarPref;
  health_metrics?: HealthMetrics;
  approved_at: string | null;
  created_at?: string;
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
  trainer_id: string;
  /** Legacy 1:1 link — assignment rows are the source of truth now. */
  athlete_id?: string | null;
  name: string;
  is_active: boolean;
  start_date: string; // yyyy-mm-dd (overall timeline)
  weeks: number; // 1..104 weekly blocks; the plan cycles through them
}

/** One athlete on a plan, optionally with their own timeline. */
export interface PlanAssignment {
  id: string;
  plan_id: string;
  athlete_id: string;
  start_date: string | null; // null = follow plans.start_date
}

/** The start date that actually applies to an athlete's assignment. */
export function effectiveStart(plan: Plan, assignment?: Pick<PlanAssignment, "start_date"> | null): string {
  return assignment?.start_date ?? plan.start_date;
}

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
] as const;
export type DayType = (typeof DAY_TYPES)[number];

export interface PlanDay {
  id: string;
  plan_id: string;
  week_index: number; // 1-based week block within the plan
  weekday: number; // 1 = Monday … 7 = Sunday
  title: string;
  day_type: DayType;
  sort_order: number;
}

export type LogType = "strength" | "cardio" | "timed" | "interval";

/** One planned set inside a per-set breakdown (e.g. set 1: 15 reps @ 10 kg). */
export interface SetDetail {
  reps: number;
  weight_kg: number;
}

export interface PlanExercise {
  id: string;
  plan_day_id: string;
  name: string;
  sort_order: number;
  log_type: LogType;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  rest_sec: number;
  trainer_notes: string;
  /** Optional per-set breakdown; when non-empty it overrides reps/weight per set. */
  set_details: SetDetail[];
  /** Custom logging fields scoped to just this exercise. */
  custom_fields: CustomField[];
  prescription: Record<string, unknown>;
}

export interface Session {
  id: string;
  athlete_id: string;
  plan_day_id: string | null;
  day_title: string;
  date: string; // yyyy-mm-dd
  status: "in_progress" | "complete";
  started_at: string;
  ended_at: string | null;
  athlete_notes: string;
  calories: number | null;
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
  pain: number | null;
  distance_km: number | null;
  duration_sec: number | null;
  note: string;
  calories: number | null;
  extra: Record<string, string | number>;
  completed_at: string;
}

export interface CustomField {
  key: string;
  label: string;
  type: "number" | "text";
  unit?: string;
}

export interface CoachSettings {
  trainer_id: string;
  custom_fields: CustomField[];
  export_columns: string[];
}

export const DAY_TYPE_COLORS: Record<DayType, string> = {
  push: "#fa73b8",
  pull: "#8c5cf5",
  legs: "#21d4ed",
  arms: "#f5b301",
  core: "#f2c14e",
  fullbody: "#66b29c",
  hiit: "#e5484d",
  run: "#4fbe92",
  sport: "#5b7fd6",
  rest: "#66757f",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** ISO weekday (1=Mon…7=Sun) for a local date. */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Local date as yyyy-mm-dd (avoids UTC off-by-one from toISOString). */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse yyyy-mm-dd as a LOCAL date (new Date("yyyy-mm-dd") would be UTC). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Which week block of a plan applies on `date`.
 * Weeks are Monday-aligned starting from the week containing start_date;
 * after the last block the plan cycles back to week 1, so a 1-week plan
 * repeats forever and a 12-week block rotates every 12 weeks.
 */
export function planWeekIndex(
  plan: Pick<Plan, "start_date" | "weeks">,
  date: Date,
  startOverride?: string | null,
): number {
  const startDate = startOverride ?? plan.start_date;
  // Rows from a pre-migration database have no start_date/weeks yet —
  // treat them as a single-week plan instead of crashing.
  if (!startDate) return 1;
  const start = parseLocalDate(startDate);
  start.setDate(start.getDate() - (isoWeekday(start) - 1)); // Monday of the start week
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  target.setDate(target.getDate() - (isoWeekday(target) - 1));
  const diffWeeks = Math.round((target.getTime() - start.getTime()) / (7 * 86400000));
  if (diffWeeks < 0) return 1; // plan hasn't started: show week 1
  const weeks = Math.max(1, plan.weeks || 1);
  return (diffWeeks % weeks) + 1;
}

/** A plan + the athlete's assignment, with the start that applies to them. */
export interface AthletePlan {
  plan: Plan;
  assignment: PlanAssignment;
  start: string; // effective start (assignment override ?? plan start)
}

/**
 * Which plans apply to the athlete on `date` — the auto-switch rule:
 * per coach, only plans that have started count, and the one with the
 * NEWEST effective start wins (assigning a new plan takes over from the
 * old one on its start date; plans from different coaches still merge).
 */
export function activeAthletePlans(all: AthletePlan[], date: Date): AthletePlan[] {
  const dateStr = localDateString(date);
  const byCoach = new Map<string, AthletePlan>();
  for (const ap of all) {
    if (!ap.plan.is_active || ap.start > dateStr) continue;
    const current = byCoach.get(ap.plan.trainer_id);
    if (!current || ap.start > current.start) byCoach.set(ap.plan.trainer_id, ap);
  }
  return [...byCoach.values()];
}

/** Effective target for a given set number, honouring a per-set breakdown. */
export function setTarget(ex: PlanExercise, setIndex: number): SetDetail {
  const detail = ex.set_details?.[setIndex - 1];
  return {
    reps: detail?.reps ?? ex.target_reps,
    weight_kg: detail?.weight_kg ?? ex.target_weight_kg,
  };
}

export type ProgressionMetric = "max_weight" | "total_volume";

export interface AthleteProgram {
  id: string;
  coach_link_id: string;
  goals: string;
  duration_weeks: number;
  assessment_date: string | null;
  start_date: string | null;
  progression_metric: ProgressionMetric;
  progression_overrides: Record<string, number>;
  created_at?: string;
  updated_at?: string;
}

export interface ProgressionExercise {
  id: string;
  coach_link_id: string;
  exercise_name: string;
  sort_order: number;
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
  created_at?: string;
}

export interface Message {
  id: string;
  coach_link_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export type TrackerKind = "body_assessment" | "mobility_pain" | "flexibility" | "cardio";

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

export interface AthleteClientProfile {
  coach_link_id: string;
  profile: Record<string, unknown>;
  updated_at?: string;
}
