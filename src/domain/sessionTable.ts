/**
 * Sessions as table rows — one line per logged session, with the totals a
 * spreadsheet would show. The exercise × session grid in `planLog` reads down
 * the movements; this reads down the calendar.
 */

import type { LogType, PlanBundle, PlanExercise, Session, SetLog } from "../data/types";
import {
  elapsedSeconds,
  nameKey,
  sessionBest,
  setHasData,
  totalDistance,
  totalDuration,
  totalReps,
  volumeOf,
} from "./logging";
import { bestUnit, inferLogType } from "./planLog";

export interface SessionRow {
  session: Session;
  date: string;
  title: string;
  /** Name of the plan this was logged against, or null for free work. */
  planName: string | null;
  exercises: number;
  sets: number;
  /** Exact, so column totals match the lifetime figures rather than drifting by a kg. */
  volume: number;
  distanceKm: number;
  durationSec: number;
}

/** Sessions logged outside any plan get their own group. */
export const FREE_WORK_ID = "__free__";

export function buildSessionRows(
  sessions: Session[],
  logs: SetLog[],
  plans: PlanBundle[] = [],
): SessionRow[] {
  const planNames = new Map(plans.map((b) => [b.plan.id, b.plan.name] as const));

  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (!setHasData(log)) continue;
    bySession.set(log.session_id, [...(bySession.get(log.session_id) ?? []), log]);
  }

  return sessions.map((session) => {
    const sets = bySession.get(session.id) ?? [];
    const names = new Set(sets.map((s) => nameKey(s.exercise_name)));
    return {
      session,
      date: session.date,
      title: session.day_title || "Workout",
      planName: session.plan_id ? (planNames.get(session.plan_id) ?? null) : null,
      // Sets are the truth; completed_names covers work ticked off without numbers.
      exercises: Math.max(names.size, session.completed_names.length),
      sets: sets.length,
      volume: volumeOf(sets),
      distanceKm: Math.round(sets.reduce((t, s) => t + (s.distance_km ?? 0), 0) * 10) / 10,
      durationSec: elapsedSeconds(session),
    };
  });
}

export function formatVolume(volume: number): string {
  return `${Math.round(volume).toLocaleString()} kg`;
}

// ------------------------------------------------------------------
// Plan groups — one card per plan the athlete has trained against
// ------------------------------------------------------------------

export interface PlanGroup {
  id: string;
  name: string;
  /** null for the free-work group, which has no plan behind it. */
  bundle: PlanBundle | null;
  /** Newest session first. */
  rows: SessionRow[];
  sessions: number;
  sets: number;
  volume: number;
  distanceKm: number;
  durationSec: number;
  firstDate: string;
  lastDate: string;
}

/** Group logged sessions by the plan they were logged against, busiest recent first. */
export function groupSessionsByPlan(rows: SessionRow[], plans: PlanBundle[]): PlanGroup[] {
  const bundles = new Map(plans.map((b) => [b.plan.id, b] as const));
  const groups = new Map<string, SessionRow[]>();

  for (const row of rows) {
    const id = row.session.plan_id && bundles.has(row.session.plan_id)
      ? row.session.plan_id
      : FREE_WORK_ID;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([id, groupRows]) => {
      const sorted = [...groupRows].sort((a, b) => b.date.localeCompare(a.date));
      const bundle = bundles.get(id) ?? null;
      return {
        id,
        name: bundle?.plan.name ?? "Free work",
        bundle,
        rows: sorted,
        sessions: sorted.length,
        sets: sorted.reduce((t, r) => t + r.sets, 0),
        volume: sorted.reduce((t, r) => t + r.volume, 0),
        distanceKm: Math.round(sorted.reduce((t, r) => t + r.distanceKm, 0) * 10) / 10,
        durationSec: sorted.reduce((t, r) => t + r.durationSec, 0),
        firstDate: sorted.at(-1)?.date ?? "",
        lastDate: sorted[0]?.date ?? "",
      };
    })
    .sort((a, b) => {
      // Free work last; otherwise most recently trained first.
      if ((a.id === FREE_WORK_ID) !== (b.id === FREE_WORK_ID)) return a.id === FREE_WORK_ID ? 1 : -1;
      return b.lastDate.localeCompare(a.lastDate);
    });
}

// ------------------------------------------------------------------
// One session, exercise by exercise
// ------------------------------------------------------------------

export interface SessionExerciseRow {
  key: string;
  name: string;
  logType: LogType;
  unit: string;
  sets: SetLog[];
  best: number;
  reps: number;
  volume: number;
  distanceKm: number;
  durationSec: number;
  /** Best from the last session this exercise appeared in before this one. */
  previousBest: number;
  previousDate: string | null;
  delta: number | null;
  /** Prescribed by the plan (or ticked off) but with no numbers recorded. */
  skipped: boolean;
  /** "3 × 10 · 60 kg" from the plan, when there is one. */
  target: string;
}

export interface SessionDetailData {
  session: Session;
  planName: string | null;
  rows: SessionExerciseRow[];
  totals: {
    exercises: number;
    sets: number;
    reps: number;
    volume: number;
    distanceKm: number;
    durationSec: number;
  };
}

function targetLabel(exercise: PlanExercise | undefined): string {
  if (!exercise) return "";
  const parts: string[] = [];
  if (exercise.rep_scheme) parts.push(exercise.rep_scheme);
  else if (exercise.target_sets && exercise.target_reps)
    parts.push(`${exercise.target_sets} × ${exercise.target_reps}`);
  else if (exercise.target_sets) parts.push(`${exercise.target_sets} sets`);
  if (exercise.target_weight_kg) parts.push(`${exercise.target_weight_kg} kg`);
  return parts.join(" · ");
}

/**
 * Everything logged in one session, plus what the plan asked for and never got.
 *
 * `sessions` and `logs` are the whole scope, not just this session — the
 * "vs last time" column needs the history behind each movement.
 */
export function buildSessionDetail({
  session,
  sessions,
  logs,
  bundle,
}: {
  session: Session;
  sessions: Session[];
  logs: SetLog[];
  bundle?: PlanBundle | null;
}): SessionDetailData {
  const logsBySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (!setHasData(log)) continue;
    logsBySession.set(log.session_id, [...(logsBySession.get(log.session_id) ?? []), log]);
  }

  // Everything that happened before this session, most recent first.
  const order = (s: Session) => `${s.date} ${s.started_at}`;
  const earlier = sessions
    .filter((s) => s.id !== session.id && order(s) < order(session))
    .sort((a, b) => order(b).localeCompare(order(a)));

  const prescribed = (bundle?.exercises ?? []).filter(
    (e) =>
      e.plan_day_id === session.plan_day_id &&
      (session.plan_segment_id === null || e.plan_segment_id === session.plan_segment_id),
  );
  const prescribedByKey = new Map(prescribed.map((e) => [nameKey(e.name), e] as const));

  const own = logsBySession.get(session.id) ?? [];
  const byKey = new Map<string, { name: string; sets: SetLog[] }>();
  for (const log of own) {
    const key = nameKey(log.exercise_name);
    const entry = byKey.get(key) ?? { name: log.exercise_name, sets: [] };
    entry.sets.push(log);
    byKey.set(key, entry);
  }
  // Work that was ticked off or prescribed but never given numbers still gets a row.
  for (const name of [...session.completed_names, ...prescribed.map((e) => e.name)]) {
    const key = nameKey(name);
    if (!byKey.has(key)) byKey.set(key, { name, sets: [] });
  }

  const rows: SessionExerciseRow[] = [];
  for (const [key, entry] of byKey) {
    const sets = [...entry.sets].sort((a, b) => a.set_index - b.set_index);
    const planExercise = prescribedByKey.get(key);
    const logType = planExercise?.log_type ?? inferLogType(sets);
    const best = sets.length > 0 ? sessionBest(sets, logType) : 0;

    let previousBest = 0;
    let previousDate: string | null = null;
    for (const past of earlier) {
      const pastSets = (logsBySession.get(past.id) ?? []).filter(
        (l) => nameKey(l.exercise_name) === key,
      );
      if (pastSets.length === 0) continue;
      previousBest = sessionBest(pastSets, logType);
      previousDate = past.date;
      break;
    }

    rows.push({
      key,
      name: planExercise?.name ?? entry.name,
      logType,
      unit: bestUnit(logType, sets.some((s) => (s.weight_kg ?? 0) > 0)),
      sets,
      best,
      reps: totalReps(sets),
      volume: volumeOf(sets),
      distanceKm: Math.round(totalDistance(sets) * 10) / 10,
      durationSec: totalDuration(sets),
      previousBest,
      previousDate,
      delta: previousBest > 0 && best > 0 ? (best - previousBest) / previousBest : null,
      skipped: sets.length === 0,
      target: targetLabel(planExercise),
    });
  }

  // Plan order where we know it, then whatever was logged, skipped work last.
  const planOrder = new Map(prescribed.map((e, i) => [nameKey(e.name), i] as const));
  rows.sort((a, b) => {
    if (a.skipped !== b.skipped) return a.skipped ? 1 : -1;
    const ai = planOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const bi = planOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  return {
    session,
    planName: bundle?.plan.name ?? null,
    rows,
    totals: {
      exercises: rows.filter((r) => !r.skipped).length,
      sets: rows.reduce((t, r) => t + r.sets.length, 0),
      reps: rows.reduce((t, r) => t + r.reps, 0),
      volume: rows.reduce((t, r) => t + r.volume, 0),
      distanceKm: Math.round(rows.reduce((t, r) => t + r.distanceKm, 0) * 10) / 10,
      durationSec: elapsedSeconds(session),
    },
  };
}
