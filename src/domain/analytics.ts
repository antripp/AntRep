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
  /** Rolling performance change, not just the latest workout versus one prior workout. */
  strengthTrend: number;
  /** Change in later-set retention across comparable recent workouts. */
  enduranceTrend: number;
  /** 0-100; higher means the recent baseline is repeatable rather than peak-driven. */
  stabilityScore: number;
  /** Mean later-set performance divided by the first working set. */
  setRetention: number | null;
  trendLabel: "Improving" | "Stable" | "Plateau" | "High variability" | "Possible regression";
  confidence: "Building" | "Moderate" | "High";
  futureSessions: number;
  volume: number;
  history: {
    date: string;
    best: number;
    volume: number;
    reps: number;
    e1RM: number;
    avgRpe: number | null;
    retention: number | null;
    future: boolean;
  }[];
}

function inferLogType(sets: SetLog[]): LogType {
  if (sets.some((s) => (s.distance_km ?? 0) > 0)) return "cardio";
  if (sets.some((s) => (s.duration_sec ?? 0) > 0 && !(s.reps ?? 0))) return "timed";
  if (sets.every((s) => !(s.weight_kg ?? 0) && !(s.reps ?? 0) && !(s.duration_sec ?? 0))) return "custom";
  return "strength";
}

/** Per-exercise history, newest metric first. */
export function exerciseStats(sessions: Session[], logs: SetLog[], today = new Date()): ExerciseStat[] {
  const cutoff = localDate(today);
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
        e1RM: daySets.reduce((m, s) => Math.max(m, estimated1RM(s.weight_kg ?? 0, s.reps ?? 0)), 0),
        avgRpe: mean(daySets.map((s) => s.rpe).filter((r): r is number => r !== null && r > 0)),
        retention: setRetention(daySets, logType),
        future: date > cutoff,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Future/simulation rows remain visible in the history table, but do not
    // leak into present-tense records, trends, recency or headline totals.
    const analysed = history.filter((h) => !h.future);
    const analysedDates = new Set(analysed.map((h) => h.date));
    const analysedSets = rows.filter((r) => analysedDates.has(r.date)).map((r) => r.set);
    const best = analysed.reduce((m, h) => Math.max(m, h.best), 0);
    const lastBest = analysed.at(-1)?.best ?? 0;
    const previousBest = analysed.at(-2)?.best ?? 0;
    const best1RM = analysedSets.reduce((m, s) => Math.max(m, estimated1RM(s.weight_kg ?? 0, s.reps ?? 0)), 0);
    const performance = analysed.map((h) => {
      const raw = h.e1RM > 0 ? h.e1RM : h.best;
      // Same output at lower RPE represents more reserve. Keep the correction
      // deliberately small because RPE is subjective.
      return raw * (h.avgRpe ? 1 + Math.max(0, 10 - h.avgRpe) * 0.015 : 1);
    });
    const strengthTrend = rollingChange(performance);
    const retentionSeries = analysed.flatMap((h) => h.retention === null ? [] : [h.retention]);
    const enduranceTrend = rollingChange(retentionSeries);
    const stabilityScore = stability(performance);
    const trendLabel = classifyTrend(strengthTrend, stabilityScore, analysed.length);

    stats.push({
      key,
      name,
      logType,
      sessions: analysed.length,
      totalSets: analysedSets.length,
      hasWeight: analysedSets.some((s) => (s.weight_kg ?? 0) > 0),
      best,
      bestReps: analysedSets.reduce((m, s) => Math.max(m, s.reps ?? 0), 0),
      best1RM,
      lastDate: analysed.at(-1)?.date ?? null,
      lastBest,
      previousBest,
      trend: strengthTrend,
      strengthTrend,
      enduranceTrend,
      stabilityScore,
      setRetention: retentionSeries.length ? retentionSeries.at(-1)! : null,
      trendLabel,
      confidence: analysed.length >= 8 ? "High" : analysed.length >= 4 ? "Moderate" : "Building",
      futureSessions: history.length - analysed.length,
      volume: volumeOf(analysedSets),
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
    const todayStr = localDate(today);
    const weekSessions = sessions.filter((s) => s.date >= startStr && s.date <= endStr && s.date <= todayStr);
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
    const peak = stat.history.filter((entry) => !entry.future).reduce<{ date: string; best: number } | null>(
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
        title: change > 0 ? "Total lifting work is rising" : "Total lifting work is easing",
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
    const stat = improving[0];
    const matchedBestChanged = Math.abs(stat.lastBest - stat.previousBest) >= 0.05;
    out.push({
      id: `improving-${stat.key}`,
      title: `${stat.name} is moving up`,
      detail: matchedBestChanged
        ? `Best set went from ${round(stat.previousBest)} to ${round(stat.lastBest)}.`
        : `Rolling performance is up ${Math.round(stat.strengthTrend * 100)}%, combining your estimated max lift with how manageable the work felt.`,
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
export function lifetimeTotals(sessions: Session[], logs: SetLog[], today = new Date()) {
  const cutoff = localDate(today);
  const currentSessions = sessions.filter((s) => s.date <= cutoff);
  const currentIds = new Set(currentSessions.map((s) => s.id));
  const valid = logs.filter((log) => currentIds.has(log.session_id) && setHasData(log));
  const logged = loggedSessionIds(valid);
  return {
    sessions: new Set(
      currentSessions.filter((s) => wasTrained(s, logged)).map((s) => `${s.date}-${s.id}`),
    ).size,
    sets: valid.length,
    volume: Math.round(volumeOf(valid)),
    distanceKm: Math.round(totalDistance(valid) * 10) / 10,
    minutes: Math.round(totalDuration(valid) / 60),
  };
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function setRetention(sets: SetLog[], logType: LogType): number | null {
  const ordered = [...sets].sort((a, b) => a.set_index - b.set_index);
  if (ordered.length < 2) return null;
  const score = (set: SetLog) => {
    if (logType === "cardio") return set.distance_km ?? set.duration_sec ?? 0;
    if (logType === "timed" || logType === "interval") return set.duration_sec ?? set.reps ?? 0;
    const reps = set.reps ?? 0;
    const weight = set.weight_kg ?? 0;
    return weight > 0 ? weight * reps : reps;
  };
  const first = score(ordered[0]);
  if (first <= 0) return null;
  const later = ordered.slice(1).map(score).filter((value) => value > 0);
  return later.length ? later.reduce((total, value) => total + value, 0) / later.length / first : null;
}

function rollingChange(values: number[]): number {
  if (values.length < 4) return 0;
  const size = Math.min(4, Math.floor(values.length / 2));
  const recent = values.slice(-size);
  const baseline = values.slice(-(size * 2), -size);
  const recentMean = mean(recent) ?? 0;
  const baselineMean = mean(baseline) ?? 0;
  return baselineMean > 0 ? (recentMean - baselineMean) / baselineMean : 0;
}

function stability(values: number[]): number {
  const recent = values.slice(-8).filter((value) => value > 0);
  if (recent.length < 3) return 50;
  const average = mean(recent) ?? 0;
  if (average <= 0) return 50;
  const variance = recent.reduce((total, value) => total + (value - average) ** 2, 0) / recent.length;
  const coefficient = Math.sqrt(variance) / average;
  return Math.max(0, Math.min(100, Math.round(100 - coefficient * 300)));
}

function classifyTrend(
  change: number,
  stabilityScore: number,
  observations: number,
): ExerciseStat["trendLabel"] {
  if (observations < 4) return "Stable";
  if (stabilityScore < 55) return "High variability";
  if (change >= 0.025) return "Improving";
  if (change <= -0.04) return "Possible regression";
  if (Math.abs(change) <= 0.01 && observations >= 8) return "Plateau";
  return "Stable";
}
