/**
 * The training log as a grid: exercises down the side, sessions across the top.
 *
 * Each exercise row carries its session-to-session change; expanding it shows
 * one row per set with the actual numbers. Missing work is `--`, never a zero,
 * so a gap reads as "not logged" rather than "logged nothing".
 */

import type { LogType, PlanBundle, Session, SetLog } from "../data/types";
import { formatShortDate, isoWeekday, parseDate, weekdayLabel } from "./dates";
import { nameKey, sessionBest, setHasData, volumeOf } from "./logging";

export interface SessionColumn {
  sessionId: string;
  /** 1-based position in this view — the "S1, S2, S3" label. */
  index: number;
  date: string;
  title: string;
  /** Tooltip text: "Session 3 · Wed 5 Aug · Pull day". */
  tooltip: string;
}

export interface ExerciseSessionCell {
  sessionId: string;
  logged: boolean;
  /** Headline number for the log type: best weight, distance, or hold. */
  best: number;
  volume: number;
  setCount: number;
  /** Change vs the previous session this exercise was logged in. */
  delta: number | null;
}

export interface ExerciseSetRow {
  setNumber: number;
  /** One entry per session column; `null` where that set wasn't logged. */
  cells: (SetLog | null)[];
}

export interface ExerciseLogRow {
  key: string;
  name: string;
  logType: LogType;
  unit: string;
  cells: ExerciseSessionCell[];
  setRows: ExerciseSetRow[];
  maxSets: number;
  loggedSessions: number;
  /** Change from the first logged session to the latest. */
  overallDelta: number | null;
  lastDelta: number | null;
  remark: string;
  best: number;
}

export interface LogTable {
  columns: SessionColumn[];
  rows: ExerciseLogRow[];
}

export function unitFor(logType: LogType): string {
  switch (logType) {
    case "cardio":
      return "km";
    case "timed":
    case "interval":
      return "s";
    case "custom":
      return "";
    default:
      return "kg";
  }
}

/** One set as a compact cell: "60×10", "5 km", "45s", "12 reps". */
export function formatSetCell(set: SetLog, logType: LogType): string {
  const parts: string[] = [];

  if (logType === "cardio") {
    if (set.distance_km) parts.push(`${round(set.distance_km)} km`);
    if (set.duration_sec) parts.push(formatSeconds(set.duration_sec));
  } else if (logType === "timed") {
    if (set.duration_sec) parts.push(formatSeconds(set.duration_sec));
  } else if (logType === "interval") {
    if (set.reps) parts.push(`${set.reps}×`);
    if (set.duration_sec) parts.push(formatSeconds(set.duration_sec));
  } else {
    if (set.weight_kg && set.reps) parts.push(`${round(set.weight_kg)}×${set.reps}`);
    else if (set.weight_kg) parts.push(`${round(set.weight_kg)} kg`);
    else if (set.reps) parts.push(`${set.reps} reps`);
  }

  for (const [key, value] of Object.entries(set.extra ?? {})) {
    if (value === "" || value === null || value === undefined) continue;
    parts.push(`${value}${key.length <= 3 ? ` ${key}` : ""}`);
  }

  return parts.join(" · ") || "—";
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatSeconds(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function inferLogType(sets: SetLog[]): LogType {
  if (sets.some((s) => (s.distance_km ?? 0) > 0)) return "cardio";
  if (sets.some((s) => (s.duration_sec ?? 0) > 0 && !(s.reps ?? 0))) return "timed";
  if (sets.some((s) => (s.weight_kg ?? 0) > 0 || (s.reps ?? 0) > 0)) return "strength";
  return "custom";
}

function remarkFor(row: {
  loggedSessions: number;
  overallDelta: number | null;
  lastDelta: number | null;
  unit: string;
  best: number;
}): string {
  if (row.loggedSessions === 0) return "Not logged yet";
  if (row.loggedSessions === 1) return "First session logged";
  if (row.overallDelta === null) return `${row.loggedSessions} sessions logged`;
  const pct = Math.round(row.overallDelta * 100);
  if (pct >= 5) return `Up ${pct}% across ${row.loggedSessions} sessions`;
  if (pct <= -5) return `Down ${Math.abs(pct)}% across ${row.loggedSessions} sessions`;
  return `Holding steady over ${row.loggedSessions} sessions`;
}

/**
 * Build the grid.
 *
 * `bundle` scopes it to one plan (sessions logged against that plan, and its
 * exercises listed even before they're trained). Pass `null` for everything.
 */
export function buildLogTable({
  sessions,
  logs,
  bundle,
  limit = 24,
}: {
  sessions: Session[];
  logs: SetLog[];
  bundle?: PlanBundle | null;
  /** Most recent N sessions, oldest first. */
  limit?: number;
}): LogTable {
  const inScope = (bundle ? sessions.filter((s) => s.plan_id === bundle.plan.id) : sessions)
    .filter((s) => logs.some((l) => l.session_id === s.id && setHasData(l)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.started_at.localeCompare(b.started_at));

  const scoped = inScope.slice(-limit);

  const columns: SessionColumn[] = scoped.map((session, i) => ({
    sessionId: session.id,
    index: i + 1,
    date: session.date,
    title: session.day_title || "Workout",
    tooltip: `Session ${i + 1} · ${weekdayLabel(isoWeekday(parseDate(session.date)), true)} ${formatShortDate(
      session.date,
    )} · ${session.day_title || "Workout"}`,
  }));

  const sessionIds = new Set(scoped.map((s) => s.id));
  const scopedLogs = logs.filter((l) => sessionIds.has(l.session_id) && setHasData(l));

  // Exercises: everything logged, plus anything the plan prescribes.
  const byKey = new Map<string, { name: string; sets: SetLog[] }>();
  for (const log of scopedLogs) {
    const key = nameKey(log.exercise_name);
    const entry = byKey.get(key) ?? { name: log.exercise_name, sets: [] };
    entry.sets.push(log);
    byKey.set(key, entry);
  }
  if (bundle) {
    for (const exercise of bundle.exercises) {
      const key = nameKey(exercise.name);
      if (!byKey.has(key)) byKey.set(key, { name: exercise.name, sets: [] });
    }
  }

  const planTypes = new Map(
    (bundle?.exercises ?? []).map((e) => [nameKey(e.name), e.log_type] as const),
  );

  const rows: ExerciseLogRow[] = [];

  for (const [key, entry] of byKey) {
    const logType = planTypes.get(key) ?? inferLogType(entry.sets);
    const unit = unitFor(logType);

    const perSession = new Map<string, SetLog[]>();
    for (const set of entry.sets) {
      perSession.set(set.session_id, [...(perSession.get(set.session_id) ?? []), set]);
    }
    for (const sets of perSession.values()) sets.sort((a, b) => a.set_index - b.set_index);

    let previousBest: number | null = null;
    let firstBest: number | null = null;
    let lastBest: number | null = null;
    let lastDelta: number | null = null;

    const cells: ExerciseSessionCell[] = columns.map((column) => {
      const sets = perSession.get(column.sessionId) ?? [];
      if (sets.length === 0) {
        return { sessionId: column.sessionId, logged: false, best: 0, volume: 0, setCount: 0, delta: null };
      }
      const best = sessionBest(sets, logType);
      const delta =
        previousBest !== null && previousBest > 0 ? (best - previousBest) / previousBest : null;
      if (firstBest === null) firstBest = best;
      previousBest = best;
      lastBest = best;
      lastDelta = delta;
      return {
        sessionId: column.sessionId,
        logged: true,
        best,
        volume: volumeOf(sets),
        setCount: sets.length,
        delta,
      };
    });

    const maxSets = Math.max(0, ...[...perSession.values()].map((sets) => sets.length));
    const setRows: ExerciseSetRow[] = Array.from({ length: maxSets }, (_, i) => ({
      setNumber: i + 1,
      cells: columns.map((column) => perSession.get(column.sessionId)?.[i] ?? null),
    }));

    const loggedSessions = cells.filter((c) => c.logged).length;
    const overallDelta =
      firstBest !== null && lastBest !== null && firstBest > 0 && loggedSessions > 1
        ? (lastBest - firstBest) / firstBest
        : null;

    rows.push({
      key,
      name: entry.name,
      logType,
      unit,
      cells,
      setRows,
      maxSets,
      loggedSessions,
      overallDelta,
      lastDelta,
      best: Math.max(0, ...cells.map((c) => c.best)),
      remark: remarkFor({ loggedSessions, overallDelta, lastDelta, unit, best: 0 }),
    });
  }

  rows.sort((a, b) => {
    if (b.loggedSessions !== a.loggedSessions) return b.loggedSessions - a.loggedSessions;
    return a.name.localeCompare(b.name);
  });

  return { columns, rows };
}

/** "+5%" / "-10%" / "—" for the first logged session. */
export function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const pct = Math.round(delta * 100);
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
