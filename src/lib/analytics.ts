import type { ProgressionGridRow } from "./progression";
import { weekLabel } from "./progression";
import type { CheckIn, ProgressionMetric, Session, SetLog } from "./types";
import { parseLocalDate, planWeekIndex } from "./types";

export interface WeekPoint {
  week: number;
  label: string;
  value: number;
}

export interface ExerciseSeries {
  exerciseName: string;
  points: WeekPoint[];
  latest: number | null;
  change: number | null;
}

export interface ProgressionAnalytics {
  exerciseSeries: ExerciseSeries[];
  weeklyVolume: WeekPoint[];
  sessionsPerWeek: WeekPoint[];
  checkInWeight: WeekPoint[];
  checkInPain: WeekPoint[];
  summary: {
    totalSessions: number;
    weeksWithSessions: number;
    avgSessionsPerWeek: number;
    topGainer: { name: string; change: number } | null;
  };
}

function painScore(text: string): number | null {
  const m = text.match(/(\d+)\s*\/\s*10/);
  if (m) return Number(m[1]);
  const n = text.match(/\b(\d+)\b/);
  return n ? Number(n[1]) : null;
}

export function computeProgressionAnalytics(
  gridRows: ProgressionGridRow[],
  sessions: Session[],
  setLogs: SetLog[],
  checkIns: CheckIn[],
  programStart: string,
  durationWeeks: number,
  _metric: ProgressionMetric,
): ProgressionAnalytics {
  const weeks = Math.max(1, durationWeeks);
  const plan = { start_date: programStart, weeks };

  const exerciseSeries: ExerciseSeries[] = gridRows.map((row) => {
    const points: WeekPoint[] = row.cells
      .map((cell, i) => ({
        week: i + 1,
        label: weekLabel(i + 1),
        value: cell.value ?? 0,
      }))
      .filter((p) => p.value > 0);
    const first = points[0]?.value ?? null;
    const latest = points[points.length - 1]?.value ?? null;
    const change = first != null && latest != null ? Math.round((latest - first) * 10) / 10 : null;
    return { exerciseName: row.exerciseName, points, latest, change };
  });

  const volumeByWeek = new Map<number, number>();
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  for (const log of setLogs) {
    const session = sessionById.get(log.session_id);
    if (!session) continue;
    const week = planWeekIndex(plan, parseLocalDate(session.date));
    if (week < 1 || week > weeks) continue;
    const vol = (log.weight_kg ?? 0) * (log.reps ?? 0);
    if (vol <= 0) continue;
    volumeByWeek.set(week, (volumeByWeek.get(week) ?? 0) + vol);
  }

  const weeklyVolume: WeekPoint[] = Array.from({ length: weeks }, (_, i) => {
    const week = i + 1;
    return { week, label: weekLabel(week), value: Math.round(volumeByWeek.get(week) ?? 0) };
  }).filter((p) => p.value > 0);

  const sessionsByWeek = new Map<number, number>();
  for (const s of sessions) {
    if (s.status !== "complete") continue;
    const week = planWeekIndex(plan, parseLocalDate(s.date));
    if (week < 1 || week > weeks) continue;
    sessionsByWeek.set(week, (sessionsByWeek.get(week) ?? 0) + 1);
  }

  const sessionsPerWeek: WeekPoint[] = Array.from({ length: weeks }, (_, i) => {
    const week = i + 1;
    return { week, label: weekLabel(week), value: sessionsByWeek.get(week) ?? 0 };
  });

  const checkInWeight: WeekPoint[] = checkIns
    .filter((c) => c.weight_kg != null && c.weight_kg > 0)
    .map((c) => ({
      week: c.week_index,
      label: weekLabel(c.week_index),
      value: c.weight_kg!,
    }));

  const checkInPain: WeekPoint[] = checkIns
    .map((c) => {
      const score = painScore(c.pain);
      return score != null
        ? { week: c.week_index, label: weekLabel(c.week_index), value: score }
        : null;
    })
    .filter((p): p is WeekPoint => p != null);

  const completed = sessions.filter((s) => s.status === "complete");
  const weeksWithSessions = sessionsByWeek.size;
  const avgSessionsPerWeek =
    weeksWithSessions > 0 ? Math.round((completed.length / weeksWithSessions) * 10) / 10 : 0;

  const gainers = exerciseSeries
    .filter((s) => s.change != null && s.change > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  const topGainer = gainers[0]?.change != null
    ? { name: gainers[0].exerciseName, change: gainers[0].change }
    : null;

  return {
    exerciseSeries: exerciseSeries.filter((s) => s.points.length > 0),
    weeklyVolume,
    sessionsPerWeek: sessionsPerWeek.filter((p) => p.value > 0),
    checkInWeight,
    checkInPain,
    summary: {
      totalSessions: completed.length,
      weeksWithSessions,
      avgSessionsPerWeek,
      topGainer,
    },
  };
}

export function formatAnalyticsValue(value: number, metric: ProgressionMetric): string {
  if (metric === "total_volume") return `${Math.round(value)} kg`;
  return `${value} kg`;
}
