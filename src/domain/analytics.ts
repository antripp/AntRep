/**
 * Training analytics — the port of the iOS exercise-stats / insight engines.
 * Everything is derived from sessions + set logs, so a coach can run exactly
 * the same numbers over an athlete's data.
 */

import type { ExerciseCategory, LogType, Session, SetLog } from "../data/types";
import { addDays, localDate, parseDate, startOfWeek } from "./dates";
import {
  estimated1RM,
  loggedSessionIds,
  nameKey,
  sessionBest,
  setHasData,
  totalDistance,
  totalDuration,
  totalReps,
  volumeOf,
  wasTrained,
} from "./logging";

export interface ExerciseStat {
  key: string;
  name: string;
  logType: LogType;
  sessions: number;
  totalSets: number;
  /** False for reps-only work, so `best` isn't reported as a weight. */
  hasWeight: boolean;
  best: number;
  bestReps: number;
  best1RM: number;
  lastDate: string | null;
  lastBest: number;
  previousBest: number;
  trend: number;
  volume: number;
  history: { date: string; best: number; volume: number; reps: number }[];
}

function inferLogType(sets: SetLog[]): LogType {
  if (sets.some((s) => (s.distance_km ?? 0) > 0)) return "cardio";
  if (sets.some((s) => (s.duration_sec ?? 0) > 0 && !(s.reps ?? 0))) return "timed";
  if (sets.every((s) => !(s.weight_kg ?? 0) && !(s.reps ?? 0) && !(s.duration_sec ?? 0))) return "custom";
  return "strength";
}

/** Per-exercise history, newest metric first. */
export function exerciseStats(sessions: Session[], logs: SetLog[]): ExerciseStat[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const byExercise = new Map<string, { name: string; rows: { date: string; set: SetLog }[] }>();

  for (const log of logs) {
    const session = sessionById.get(log.session_id);
    if (!session || !setHasData(log)) continue;
    const key = nameKey(log.exercise_name);
    const entry = byExercise.get(key) ?? { name: log.exercise_name, rows: [] };
    entry.rows.push({ date: session.date, set: log });
    byExercise.set(key, entry);
  }

  const stats: ExerciseStat[] = [];
  for (const [key, { name, rows }] of byExercise) {
    const sets = rows.map((r) => r.set);
    const logType = inferLogType(sets);

    const byDate = new Map<string, SetLog[]>();
    for (const row of rows) {
      byDate.set(row.date, [...(byDate.get(row.date) ?? []), row.set]);
    }

    const history = [...byDate.entries()]
      .map(([date, daySets]) => ({
        date,
        best: sessionBest(daySets, logType),
        volume: volumeOf(daySets),
        reps: totalReps(daySets),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const best = history.reduce((m, h) => Math.max(m, h.best), 0);
    const lastBest = history.at(-1)?.best ?? 0;
    const previousBest = history.at(-2)?.best ?? 0;
    const best1RM = sets.reduce((m, s) => Math.max(m, estimated1RM(s.weight_kg ?? 0, s.reps ?? 0)), 0);

    stats.push({
      key,
      name,
      logType,
      sessions: byDate.size,
      totalSets: sets.length,
      hasWeight: sets.some((s) => (s.weight_kg ?? 0) > 0),
      best,
      bestReps: sets.reduce((m, s) => Math.max(m, s.reps ?? 0), 0),
      best1RM,
      lastDate: history.at(-1)?.date ?? null,
      lastBest,
      previousBest,
      trend: previousBest > 0 ? (lastBest - previousBest) / previousBest : 0,
      volume: volumeOf(sets),
      history,
    });
  }

  return stats.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
}

export interface WeekPoint {
  weekStart: string;
  label: string;
  volume: number;
  sessions: number;
  sets: number;
}

/** Volume + session count per week, oldest first. */
export function weeklySeries(sessions: Session[], logs: SetLog[], weeks = 8, today = new Date()): WeekPoint[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const logged = loggedSessionIds(logs);
  const points: WeekPoint[] = [];
  const thisWeek = startOfWeek(today);

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(thisWeek, -7 * i);
    const startStr = localDate(start);
    const endStr = localDate(addDays(start, 6));
    const weekSessions = sessions.filter((s) => s.date >= startStr && s.date <= endStr);
    const ids = new Set(weekSessions.map((s) => s.id));
    const weekLogs = logs.filter((l) => ids.has(l.session_id) && sessionById.has(l.session_id) && setHasData(l));
    points.push({
      weekStart: startStr,
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      volume: Math.round(volumeOf(weekLogs)),
      sessions: new Set(weekSessions.filter((s) => wasTrained(s, logged)).map((s) => s.date)).size,
      sets: weekLogs.length,
    });
  }
  return points;
}

/** Share of working sets per muscle category — the iOS muscle-balance view. */
export function categoryBalance(
  logs: SetLog[],
  categoryOf: (name: string) => ExerciseCategory,
): { category: ExerciseCategory; sets: number; share: number }[] {
  const counts = new Map<ExerciseCategory, number>();
  for (const log of logs) {
    if (!setHasData(log)) continue;
    const cat = categoryOf(log.exercise_name);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((t, n) => t + n, 0) || 1;
  return [...counts.entries()]
    .map(([category, sets]) => ({ category, sets, share: sets / total }))
    .sort((a, b) => b.sets - a.sets);
}

export interface PersonalRecord {
  name: string;
  value: number;
  logType: LogType;
  date: string;
}

/** Records set in the last `days` days. */
export function recentRecords(stats: ExerciseStat[], days = 30, today = new Date()): PersonalRecord[] {
  const cutoff = localDate(addDays(today, -days));
  const records: PersonalRecord[] = [];
  for (const stat of stats) {
    const peak = stat.history.reduce<{ date: string; best: number } | null>(
      (top, h) => (!top || h.best > top.best ? h : top),
      null,
    );
    if (peak && peak.date >= cutoff && peak.best > 0 && stat.history.length > 1) {
      records.push({ name: stat.name, value: peak.best, logType: stat.logType, date: peak.date });
    }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  tone: "good" | "warn" | "info";
}

/** Short, actionable read-outs for the Progress tab (and the coach's view). */
export function buildInsights(
  sessions: Session[],
  logs: SetLog[],
  stats: ExerciseStat[],
  weeklyGymGoal: number,
  today = new Date(),
): Insight[] {
  const out: Insight[] = [];
  const series = weeklySeries(sessions, logs, 4, today);
  const thisWeek = series.at(-1);
  const lastWeek = series.at(-2);

  if (thisWeek && lastWeek && lastWeek.volume > 0) {
    const change = (thisWeek.volume - lastWeek.volume) / lastWeek.volume;
    if (Math.abs(change) >= 0.1) {
      out.push({
        id: "volume-trend",
        title: change > 0 ? "Volume climbing" : "Volume easing off",
        detail: `${Math.abs(Math.round(change * 100))}% ${change > 0 ? "more" : "less"} than last week (${thisWeek.volume.toLocaleString()} kg).`,
        tone: change > 0 ? "good" : "info",
      });
    }
  }

  if (thisWeek) {
    const remaining = Math.max(0, weeklyGymGoal - thisWeek.sessions);
    out.push({
      id: "weekly-goal",
      title: remaining === 0 ? "Weekly goal hit" : `${remaining} session${remaining === 1 ? "" : "s"} to go`,
      detail:
        remaining === 0
          ? `${thisWeek.sessions} of ${weeklyGymGoal} sessions done. Nice work.`
          : `You've trained ${thisWeek.sessions} of ${weeklyGymGoal} days this week.`,
      tone: remaining === 0 ? "good" : "info",
    });
  }

  const improving = stats.filter((s) => s.trend > 0.02).slice(0, 1);
  if (improving.length > 0) {
    out.push({
      id: `improving-${improving[0].key}`,
      title: `${improving[0].name} is moving up`,
      detail: `Best set went from ${round(improving[0].previousBest)} to ${round(improving[0].lastBest)}.`,
      tone: "good",
    });
  }

  const stale = stats
    .filter((s) => s.lastDate && daysSince(s.lastDate, today) > 21)
    .slice(0, 1);
  if (stale.length > 0) {
    out.push({
      id: `stale-${stale[0].key}`,
      title: `${stale[0].name} has gone quiet`,
      detail: `Last logged ${daysSince(stale[0].lastDate!, today)} days ago.`,
      tone: "warn",
    });
  }

  return out;
}

function daysSince(date: string, today: Date): number {
  return Math.round((today.getTime() - parseDate(date).getTime()) / 86400000);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Totals for the header tiles. */
export function lifetimeTotals(sessions: Session[], logs: SetLog[]) {
  const valid = logs.filter(setHasData);
  const logged = loggedSessionIds(logs);
  return {
    sessions: new Set(
      sessions.filter((s) => wasTrained(s, logged)).map((s) => `${s.date}-${s.id}`),
    ).size,
    sets: valid.length,
    volume: Math.round(volumeOf(valid)),
    distanceKm: Math.round(totalDistance(valid) * 10) / 10,
    minutes: Math.round(totalDuration(valid) / 60),
  };
}
