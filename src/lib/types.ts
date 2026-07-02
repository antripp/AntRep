export type Role = "athlete" | "coach";

export interface Profile {
  id: string;
  role: Role;
  display_name: string;
}

export interface CoachLink {
  id: string;
  trainer_id: string;
  athlete_id: string | null;
  invite_code: string;
  status: "pending" | "active";
}

export interface Plan {
  id: string;
  trainer_id: string;
  athlete_id: string;
  name: string;
  is_active: boolean;
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
  weekday: number; // 1 = Monday … 7 = Sunday
  title: string;
  day_type: DayType;
  sort_order: number;
}

export type LogType = "strength" | "cardio" | "timed" | "interval";

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
  note: string;
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
