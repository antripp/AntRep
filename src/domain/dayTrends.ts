/**
 * Trends per planned day — every "Pull day" in one place, rather than one card
 * per session.
 *
 * A split repeats, so the useful comparison for a session is the *same day of
 * the split* last time round, not yesterday's different workout. Grouping by
 * planned day is what makes "is my pull day going up?" answerable.
 */

import type { DayType, Session, SetLog } from "../data/types";
import { nameKey, setHasData, volumeOf, elapsedSeconds } from "./logging";

/**
 * What a given day is actually measured by.
 *
 * Volume is meaningless for a run — weight × reps is zero however far you go —
 * so reporting "avg volume 0 kg" for a cardio day is worse than saying nothing.
 * Each group is scored on the strongest signal its own sets carry.
 */
export type DayMetric = "volume" | "distance" | "duration" | "sets";

export const DAY_METRIC_LABELS: Record<DayMetric, string> = {
  volume: "volume",
  distance: "distance",
  duration: "time",
  sets: "sets",
};

export interface DaySession {
  session: Session;
  volume: number;
  distanceKm: number;
  durationSec: number;
  sets: number;
  rpe: number | null;
}

export interface DayGroup {
  key: string;
  /** What the athlete calls it — "Pull day". */
  title: string;
  dayType: DayType;
  /** Newest first, for display. */
  sessions: DaySession[];
  count: number;
  totalSets: number;
  /** Mean RPE across every rated set in the group, or null if nothing is rated. */
  avgRpe: number | null;
  firstDate: string;
  lastDate: string;
  /** Which figure this day is judged on — see `DayMetric`. */
  metric: DayMetric;
  /** The metric per session, oldest → newest. The sparkline's input. */
  series: number[];
  avgValue: number;
  bestValue: number;
  /**
   * Percent change from the earlier half of the group to the later half.
   * `null` until there are enough sessions for the comparison to mean anything.
   */
  trendPct: number | null;
}

/** The metric formatted for display, units included. */
export function formatDayMetric(metric: DayMetric, value: number): string {
  switch (metric) {
    case "volume":
      return `${Math.round(value).toLocaleString()} kg`;
    case "distance":
      return `${Math.round(value * 10) / 10} km`;
    case "duration": {
      const mins = Math.round(value / 60);
      return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
    }
    case "sets":
      return String(Math.round(value));
  }
}

/**
 * The identity of a planned day across every repeat of the split.
 *
 * Not `plan_day_id`: a multi-week plan copies its days per week, so week 1's
 * Monday and week 2's Monday are different rows describing the same session.
 * The pair that actually recurs is the day's type and its title.
 */
function groupKey(session: Session): string {
  const title = nameKey(session.day_title || "");
  return `${session.day_type}::${title}`;
}

/** Mean of the rated sets only — unrated sets must not drag the average to zero. */
function meanRpe(sets: SetLog[]): number | null {
  const rated = sets.map((s) => s.rpe).filter((r): r is number => typeof r === "number" && r > 0);
  if (rated.length === 0) return null;
  return Math.round((rated.reduce((t, r) => t + r, 0) / rated.length) * 10) / 10;
}

/**
 * Direction of travel: mean of the later half against the mean of the earlier
 * half. Comparing single sessions instead would report noise as a trend — one
 * heavy day off the back of a deload would read as +40%.
 */
function trendOf(series: number[]): number | null {
  if (series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
  const before = mean(series.slice(0, mid));
  const after = mean(series.slice(mid));
  if (before <= 0) return null;
  return Math.round(((after - before) / before) * 100);
}

/**
 * Group logged sessions by their planned day, busiest first.
 *
 * Only sessions carrying real sets count — a session opened and abandoned would
 * otherwise pull every average down and show as a dip in the trend.
 */
export function groupSessionsByDay(sessions: Session[], logs: SetLog[]): DayGroup[] {
  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (!setHasData(log)) continue;
    bySession.set(log.session_id, [...(bySession.get(log.session_id) ?? []), log]);
  }

  const groups = new Map<
    string,
    { title: string; dayType: DayType; entries: DayGroup["sessions"] }
  >();

  for (const session of sessions) {
    const sets = bySession.get(session.id);
    if (!sets || sets.length === 0) continue;

    const key = groupKey(session);
    const existing = groups.get(key);
    const entry: DaySession = {
      session,
      volume: volumeOf(sets),
      distanceKm: sets.reduce((t, s) => t + (s.distance_km ?? 0), 0),
      durationSec: sets.reduce((t, s) => t + (s.duration_sec ?? 0), 0) || elapsedSeconds(session),
      sets: sets.length,
      rpe: meanRpe(sets),
    };
    if (existing) existing.entries.push(entry);
    else {
      groups.set(key, {
        title: session.day_title || "Workout",
        dayType: session.day_type,
        entries: [entry],
      });
    }
  }

  const out: DayGroup[] = [];
  for (const [key, { title, dayType, entries }] of groups) {
    const chronological = [...entries].sort((a, b) => a.session.date.localeCompare(b.session.date));
    const allSets = chronological.flatMap((e) => bySession.get(e.session.id) ?? []);

    // Pick the metric this day genuinely carries, strongest signal first. Sets
    // are the last resort: every session has them, so it always says something.
    const totals = {
      volume: chronological.reduce((t, e) => t + e.volume, 0),
      distance: chronological.reduce((t, e) => t + e.distanceKm, 0),
      duration: chronological.reduce((t, e) => t + e.durationSec, 0),
    };
    const metric: DayMetric =
      totals.volume > 0
        ? "volume"
        : totals.distance > 0
          ? "distance"
          : totals.duration > 0
            ? "duration"
            : "sets";

    const valueOf = (e: DaySession): number =>
      metric === "volume"
        ? e.volume
        : metric === "distance"
          ? e.distanceKm
          : metric === "duration"
            ? e.durationSec
            : e.sets;

    const series = chronological.map(valueOf);
    const real = series.filter((v) => v > 0);

    out.push({
      key,
      title,
      dayType,
      sessions: [...chronological].reverse(),
      count: chronological.length,
      totalSets: chronological.reduce((t, e) => t + e.sets, 0),
      avgRpe: meanRpe(allSets),
      firstDate: chronological[0].session.date,
      lastDate: chronological[chronological.length - 1].session.date,
      metric,
      series,
      avgValue: real.length > 0 ? real.reduce((t, v) => t + v, 0) / real.length : 0,
      bestValue: real.length > 0 ? Math.max(...real) : 0,
      trendPct: trendOf(series),
    });
  }

  return out.sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate));
}
