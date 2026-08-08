/**
 * Session logging rules — the port of the iOS `ExerciseLogService`.
 *
 * Logs are keyed by exercise NAME (not plan-exercise id) so history survives
 * plan edits, exactly like the iOS app.
 */

import type { PlanExercise, Session, SetLog } from "../data/types";
import { loggingSlots, slotPrimary, visibleExercises, type ResolvedSegment } from "./plan";

/** Case/space-insensitive identity for an exercise name. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function namesMatch(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

export interface SessionProgress {
  completed: number;
  total: number;
  requiredCompleted: number;
  requiredTotal: number;
  ratio: number;
  isComplete: boolean;
  completedNames: string[];
}

/** The session for a segment on a date, if any. */
export function sessionFor(
  sessions: Session[],
  segment: ResolvedSegment,
  date: string,
): Session | undefined {
  return sessions.find(
    (s) =>
      s.date === date &&
      (segment.segmentId
        ? s.plan_segment_id === segment.segmentId
        : s.plan_day_id === segment.dayId && !s.plan_segment_id),
  );
}

export function setsFor(logs: SetLog[], sessionId: string, exerciseName: string): SetLog[] {
  return logs
    .filter((l) => l.session_id === sessionId && namesMatch(l.exercise_name, exerciseName))
    .sort((a, b) => a.set_index - b.set_index);
}

/** A set with real data (marker-only rows don't count toward analytics). */
export function setHasData(set: SetLog): boolean {
  if (
    (set.reps ?? 0) > 0 ||
    (set.weight_kg ?? 0) > 0 ||
    (set.distance_km ?? 0) > 0 ||
    (set.duration_sec ?? 0) > 0
  ) {
    return true;
  }
  // An exercise logged purely through its own custom fields still counts.
  return Object.values(set.extra ?? {}).some(
    (value) => value !== "" && value !== null && value !== undefined,
  );
}

/** Biggest number recorded in a set's custom fields — the headline for `custom`. */
/** Session ids that have at least one set carrying real numbers. */
export function loggedSessionIds(logs: SetLog[]): Set<string> {
  const ids = new Set<string>();
  for (const log of logs) if (setHasData(log)) ids.add(log.session_id);
  return ids;
}

/**
 * Did this session involve training?
 *
 * `completed_names` only fills when an exercise is ticked off, which is an
 * optional gesture — plenty of sessions have real sets logged against them and
 * nothing ticked. Counting those as untrained made a half-finished workout
 * vanish from the coach's totals, adherence and feed. Recorded sets are the
 * stronger evidence, so either one counts.
 */
export function wasTrained(session: Session, logged?: Set<string>): boolean {
  return session.completed_names.length > 0 || Boolean(logged?.has(session.id));
}

export function customBest(sets: SetLog[]): number {
  let best = 0;
  for (const set of sets) {
    for (const value of Object.values(set.extra ?? {})) {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n)) best = Math.max(best, n);
    }
  }
  return best;
}

export function progressFor(
  segment: ResolvedSegment,
  date: Date,
  session: Session | undefined,
): SessionProgress {
  const slots = loggingSlots(visibleExercises(segment, date));
  const done = new Set((session?.completed_names ?? []).map(nameKey));

  let completed = 0;
  let requiredTotal = 0;
  let requiredCompleted = 0;
  const completedNames: string[] = [];

  for (const slot of slots) {
    const slotDone = slot.some((ex) => done.has(nameKey(ex.name)));
    const required = slot.some((ex) => ex.is_mandatory);
    if (required) requiredTotal += 1;
    if (slotDone) {
      completed += 1;
      if (required) requiredCompleted += 1;
      const match = slot.find((ex) => done.has(nameKey(ex.name)));
      if (match) completedNames.push(match.name);
    }
  }

  const total = slots.length;
  const ratio = requiredTotal > 0 ? requiredCompleted / requiredTotal : total > 0 ? completed / total : 0;
  return {
    completed,
    total,
    requiredCompleted,
    requiredTotal,
    ratio: Math.min(1, ratio),
    isComplete: total > 0 && (requiredTotal > 0 ? requiredCompleted >= requiredTotal : completed >= total),
    completedNames,
  };
}

/** Progress across every segment of a day. */
export function dayProgress(
  segments: ResolvedSegment[],
  date: Date,
  sessions: Session[],
  dateStr: string,
): SessionProgress {
  const parts = segments.map((s) => progressFor(s, date, sessionFor(sessions, s, dateStr)));
  const sum = (pick: (p: SessionProgress) => number) => parts.reduce((t, p) => t + pick(p), 0);
  const total = sum((p) => p.total);
  const requiredTotal = sum((p) => p.requiredTotal);
  const requiredCompleted = sum((p) => p.requiredCompleted);
  const completed = sum((p) => p.completed);
  return {
    completed,
    total,
    requiredCompleted,
    requiredTotal,
    ratio: requiredTotal > 0 ? Math.min(1, requiredCompleted / requiredTotal) : total ? completed / total : 0,
    isComplete: parts.length > 0 && parts.every((p) => p.isComplete),
    completedNames: parts.flatMap((p) => p.completedNames),
  };
}

/** Live timer state of a session (seconds), honouring pauses. */
export function elapsedSeconds(session: Session, now = Date.now()): number {
  return session.timer_segments.reduce((total, seg) => {
    const start = new Date(seg.started_at).getTime();
    const end = seg.ended_at ? new Date(seg.ended_at).getTime() : now;
    return total + Math.max(0, (end - start) / 1000 - (seg.paused_seconds || 0));
  }, 0);
}

export function isLive(session: Session | undefined): boolean {
  return Boolean(session?.timer_segments.some((s) => !s.ended_at));
}

export function hasEndedTimer(session: Session | undefined): boolean {
  return Boolean(session?.timer_segments.some((s) => s.ended_at));
}

export function canStartTimer(session: Session | undefined): boolean {
  if (!session) return true;
  if (session.status === "complete") return false;
  return session.timer_segments.length === 0;
}

export function canResumeTimer(session: Session | undefined): boolean {
  if (!session) return false;
  if (session.status === "complete") return false;
  return !isLive(session) && hasEndedTimer(session);
}

/** Planned target for set N, honouring the plan's per-set breakdown. */
export function targetForSet(exercise: PlanExercise): { reps: number; weight: number } {
  return { reps: exercise.target_reps, weight: exercise.target_weight_kg };
}

/** Total volume (kg) of a list of sets. */
export function volumeOf(sets: SetLog[]): number {
  return sets.reduce((t, s) => t + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
}

export function bestWeight(sets: SetLog[]): number {
  return sets.reduce((m, s) => Math.max(m, s.weight_kg ?? 0), 0);
}

export function totalReps(sets: SetLog[]): number {
  return sets.reduce((t, s) => t + (s.reps ?? 0), 0);
}

export function totalDistance(sets: SetLog[]): number {
  return sets.reduce((t, s) => t + (s.distance_km ?? 0), 0);
}

export function totalDuration(sets: SetLog[]): number {
  return sets.reduce((t, s) => t + (s.duration_sec ?? 0), 0);
}

/** Epley 1RM estimate — used for strength trend lines. */
export function estimated1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

/** The headline number for one exercise's sets, by log type. */
export function sessionBest(sets: SetLog[], logType: PlanExercise["log_type"]): number {
  const valid = sets.filter(setHasData);
  if (valid.length === 0) return 0;
  if (logType === "cardio") return totalDistance(valid);
  if (logType === "timed" || logType === "interval") return totalDuration(valid);
  if (logType === "custom") return customBest(valid);
  const weight = bestWeight(valid);
  return weight > 0 ? weight : totalReps(valid);
}

export function slotLabel(slot: PlanExercise[]): string {
  if (slot.length === 1) return slot[0].name;
  return slot.map((e) => e.alternate_label || e.name).join(" / ");
}

export { loggingSlots, slotPrimary, visibleExercises };
