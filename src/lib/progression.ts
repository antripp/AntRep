import {
  localDateString,
  parseLocalDate,
  planWeekIndex,
  type AthleteProgram,
  type ProgressionExercise,
  type ProgressionMetric,
  type Session,
  type SetLog,
} from "./types";

export function weekLabel(weekIndex: number): string {
  return `Wk ${weekIndex}`;
}

/** Override key: exercise name + week index. */
export function overrideKey(exerciseName: string, weekIndex: number): string {
  return `${exerciseName}::${weekIndex}`;
}

export interface ProgressionCell {
  value: number | null;
  isOverride: boolean;
}

export interface ProgressionGridRow {
  exerciseName: string;
  cells: ProgressionCell[];
}

/**
 * Aggregate set logs into a progression grid (exercises × program weeks).
 * Uses program start_date (or plan start) and duration_weeks for column count.
 */
export function computeProgressionGrid(
  exercises: ProgressionExercise[],
  setLogs: SetLog[],
  sessions: Session[],
  program: Pick<AthleteProgram, "start_date" | "duration_weeks" | "progression_metric" | "progression_overrides">,
  planStart: string,
): ProgressionGridRow[] {
  const startDate = program.start_date ?? planStart;
  const weeks = Math.max(1, program.duration_weeks || 12);
  const metric = program.progression_metric ?? "max_weight";
  const overrides = program.progression_overrides ?? {};

  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const canonicalName = new Map<string, string>();
  for (const ex of exercises) {
    canonicalName.set(ex.exercise_name.toLowerCase(), ex.exercise_name);
  }

  const agg = new Map<string, number>();
  for (const log of setLogs) {
    const session = sessionById.get(log.session_id);
    if (!session) continue;
    const week = planWeekIndex({ start_date: startDate, weeks }, parseLocalDate(session.date));
    if (week < 1 || week > weeks) continue;

    const exName = log.exercise_name.trim();
    const canon = canonicalName.get(exName.toLowerCase());
    if (!canon) continue;

    const key = overrideKey(canon, week);
    let val = 0;
    if (metric === "total_volume") {
      val = (log.weight_kg ?? 0) * (log.reps ?? 0);
    } else {
      val = log.weight_kg ?? 0;
    }
    if (val <= 0) continue;
    agg.set(key, Math.max(agg.get(key) ?? 0, val));
  }

  return exercises.map((ex) => ({
    exerciseName: ex.exercise_name,
    cells: Array.from({ length: weeks }, (_, i) => {
      const week = i + 1;
      const key = overrideKey(ex.exercise_name, week);
      if (overrides[key] != null) {
        return { value: overrides[key], isOverride: true };
      }
      const computed = agg.get(key);
      return { value: computed != null && computed > 0 ? computed : null, isOverride: false };
    }),
  }));
}

/** Current program week for today. */
export function currentProgramWeek(
  program: Pick<AthleteProgram, "start_date" | "duration_weeks">,
  planStart: string,
  date = new Date(),
): number {
  const startDate = program.start_date ?? planStart;
  if (!startDate) return 1;
  return planWeekIndex({ start_date: startDate, weeks: program.duration_weeks || 12 }, date);
}

/** Monday-aligned week start for a program week index. */
export function weekDateRange(
  programStart: string,
  weekIndex: number,
): { from: string; to: string } {
  const start = parseLocalDate(programStart);
  start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() + (weekIndex - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { from: localDateString(weekStart), to: localDateString(weekEnd) };
}

export function formatMetricValue(value: number | null, metric: ProgressionMetric): string {
  if (value == null || value <= 0) return "—";
  if (metric === "total_volume") return `${Math.round(value)} kg`;
  return `${value} kg`;
}
