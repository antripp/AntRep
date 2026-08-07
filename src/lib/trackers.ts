import type { SetLog, Session, TrackerKind, TrackerMetric } from "./types";
import { planWeekIndex, parseLocalDate } from "./types";

export interface TrackerTemplateDef {
  kind: TrackerKind;
  title: string;
  column_mode: "weekly" | "milestone";
  metrics: TrackerMetric[];
  /** Fixed labels, or generated from duration_weeks when null */
  column_labels?: string[];
}

export const DEFAULT_TRACKER_DEFS: TrackerTemplateDef[] = [
  {
    kind: "body_assessment",
    title: "Body Assessment",
    column_mode: "weekly",
    metrics: [
      { key: "weight", label: "Weight", unit: "kg" },
      { key: "bmi", label: "BMI" },
      { key: "waist", label: "Waist", unit: "cm" },
      { key: "hip", label: "Hip", unit: "cm" },
      { key: "thigh", label: "Thigh", unit: "cm" },
      { key: "calf", label: "Calf", unit: "cm" },
      { key: "resting_hr", label: "Resting HR", unit: "bpm" },
      { key: "blood_pressure", label: "Blood Pressure" },
    ],
    column_labels: ["Week1", "Week2", "Week3", "Week4"],
  },
  {
    kind: "mobility_pain",
    title: "Mobility & Pain",
    column_mode: "weekly",
    metrics: [
      { key: "knee_pain", label: "Knee Pain (0-10)" },
      { key: "walking_pain", label: "Walking Pain" },
      { key: "balance", label: "Balance" },
      { key: "sit_to_stand", label: "Sit-to-Stand" },
      { key: "hamstring_flex", label: "Hamstring Flexibility" },
      { key: "shoulder_mob", label: "Shoulder Mobility" },
      { key: "hip_mob", label: "Hip Mobility" },
    ],
    column_labels: ["Initial Week1", "Week2", "Week3", "Week4"],
  },
  {
    kind: "flexibility",
    title: "Flexibility",
    column_mode: "milestone",
    metrics: [
      { key: "hamstrings", label: "Hamstrings" },
      { key: "hip_flexors", label: "Hip Flexors" },
      { key: "quadriceps", label: "Quadriceps" },
      { key: "calves", label: "Calves" },
      { key: "ankles", label: "Ankles" },
      { key: "shoulders", label: "Shoulders" },
    ],
    column_labels: ["Initial Week1", "Week4", "Week8", "Week12"],
  },
  {
    kind: "cardio",
    title: "Cardio Tracker",
    column_mode: "weekly",
    metrics: [
      { key: "cycling_time", label: "Cycling Time", unit: "min" },
      { key: "resistance", label: "Resistance" },
      { key: "rpm", label: "RPM" },
      { key: "distance", label: "Distance", unit: "km" },
      { key: "hr_before", label: "HR Before", unit: "bpm" },
      { key: "hr_after", label: "HR After", unit: "bpm" },
      { key: "rpe", label: "RPE" },
    ],
  },
];

export function columnLabelsForTemplate(
  def: TrackerTemplateDef,
  durationWeeks: number,
): string[] {
  if (def.column_labels) return def.column_labels;
  const count = def.kind === "cardio" ? Math.min(durationWeeks, 12) : Math.min(durationWeeks, 4);
  return Array.from({ length: count }, (_, i) => `Week${i + 1}`);
}

/** Map milestone column label to program week index (e.g. "Week4" → 4). */
export function columnToWeekIndex(label: string, columnIndex: number): number {
  const m = label.match(/week\s*(\d+)/i);
  if (m) return Number(m[1]);
  return columnIndex;
}

/** Auto-fill cardio metrics from logged cardio sets per program week. */
export function computeCardioAutoFill(
  sessions: Session[],
  setLogs: SetLog[],
  programStart: string,
  durationWeeks: number,
  columnLabels: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const byWeek = new Map<number, SetLog[]>();

  for (const log of setLogs) {
    const session = sessionById.get(log.session_id);
    if (!session) continue;
    const isCardio = log.distance_km != null || (log.duration_sec != null && log.weight_kg == null);
    if (!isCardio) continue;
    const week = planWeekIndex({ start_date: programStart, weeks: durationWeeks }, parseLocalDate(session.date));
    const arr = byWeek.get(week) ?? [];
    arr.push(log);
    byWeek.set(week, arr);
  }

  columnLabels.forEach((label, i) => {
    const week = columnToWeekIndex(label, i + 1);
    const logs = byWeek.get(week);
    if (!logs?.length) return;
    const best = logs.reduce((a, b) => ((b.duration_sec ?? 0) > (a.duration_sec ?? 0) ? b : a));
    const col = i + 1;
    if (best.duration_sec) {
      result.set(`cycling_time::${col}`, String(Math.round(best.duration_sec / 60)));
    }
    if (best.distance_km) {
      result.set(`distance::${col}`, String(best.distance_km));
    }
    if (best.rpe) result.set(`rpe::${col}`, String(best.rpe));
    if (best.calories) result.set(`hr_after::${col}`, String(best.calories));
  });

  return result;
}

export function entryKey(metricKey: string, columnIndex: number): string {
  return `${metricKey}::${columnIndex}`;
}

export interface ClientProfileData {
  age?: string;
  height?: string;
  phone?: string;
  doctor_clearance?: string;
  medical_history?: Record<string, string>;
  restrictions?: Record<string, string>;
}

export const DEFAULT_CLIENT_PROFILE: ClientProfileData = {
  doctor_clearance: "yes",
  medical_history: {
    diabetes: "NO",
    hypertension: "NO",
    heart_disease: "NO",
    arthritis: "",
    surgeries: "No",
    medication: "",
  },
  restrictions: {
    weight_training: "YES",
    cycling: "YES",
    walking: "YES",
    stairs: "NO",
    treadmill: "NO",
  },
};

export const MEDICAL_FIELDS = [
  { key: "diabetes", label: "Diabetes" },
  { key: "hypertension", label: "Hypertension" },
  { key: "heart_disease", label: "Heart Disease" },
  { key: "arthritis", label: "Arthritis" },
  { key: "surgeries", label: "Surgeries" },
  { key: "medication", label: "Medication" },
];

export const RESTRICTION_FIELDS = [
  { key: "weight_training", label: "Weight training" },
  { key: "cycling", label: "Cycling" },
  { key: "walking", label: "Walking" },
  { key: "stairs", label: "Stairs" },
  { key: "treadmill", label: "Treadmill" },
];
