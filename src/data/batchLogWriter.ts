import { api } from ".";
import { makeSession } from "./factories";
import type { PlanBundle, PlanExercise, Session, SetLog } from "./types";
import { localDate } from "../domain/dates";
import { nameKey, progressFor, setHasData } from "../domain/logging";
import type { ResolvedSegment } from "../domain/plan";

export interface BatchLogChange {
  date: string;
  segment: ResolvedSegment;
  exercise: PlanExercise;
  session?: Session;
  sets: SetLog[];
}

export interface BatchLogOutcome {
  sessions: number;
  exercises: number;
  sets: number;
  skippedBlank: number;
}

/**
 * Save a reviewed grid through the same sessions/set_logs path as the normal
 * logger. Changes are grouped by session so one date/block is saved once, and
 * exercise replacement makes a repeated save idempotent.
 */
export async function writeBatchLog({
  athleteId,
  bundle,
  changes,
}: {
  athleteId: string;
  bundle: PlanBundle;
  changes: BatchLogChange[];
}): Promise<BatchLogOutcome> {
  const groups = new Map<string, BatchLogChange[]>();
  for (const change of changes) {
    const key = `${change.date}:${change.segment.id}`;
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }

  let sessionCount = 0;
  let exerciseCount = 0;
  let setCount = 0;
  let skippedBlank = 0;

  for (const group of groups.values()) {
    const first = group[0];
    const existing = group.find((change) => change.session)?.session;
    if (existing && existing.athlete_id !== athleteId) {
      throw new Error("This session belongs to a different athlete and cannot be batch edited.");
    }
    const validByExercise = new Map(
      group.map((change) => [change.exercise.id, change.sets.filter(setHasData)] as const),
    );

    // A completely blank new group is a visual prescription, not a session.
    if (!existing && [...validByExercise.values()].every((sets) => sets.length === 0)) {
      skippedBlank += group.length;
      continue;
    }

    const base =
      existing ??
      makeSession(athleteId, {
        plan_id: bundle.plan.id,
        plan_day_id: first.segment.dayId,
        plan_segment_id: first.segment.segmentId,
        day_title: first.segment.title,
        day_type: first.segment.dayType,
        date: first.date,
        counts_as_gym: first.segment.countsAsGym,
        is_late_completion: first.date < localDate(),
        shared_with_coach: true,
        xp_awarded: 0,
      });

    const completed = new Map(base.completed_names.map((name) => [nameKey(name), name]));
    for (const change of group) {
      const sets = validByExercise.get(change.exercise.id) ?? [];
      if (sets.length > 0) completed.set(nameKey(change.exercise.name), change.exercise.name);
      else completed.delete(nameKey(change.exercise.name));
    }
    const completedNames = [...completed.values()];
    const progress = progressFor(first.segment, new Date(`${first.date}T12:00:00`), {
      ...base,
      completed_names: completedNames,
    });
    const saved = await api.saveSession({
      ...base,
      // The editor may be operated by a linked coach, but the training record
      // always belongs to the athlete whose workspace was opened.
      athlete_id: athleteId,
      completed_names: completedNames,
      status: progress.isComplete ? "complete" : "in_progress",
      ended_at: progress.isComplete ? (base.ended_at ?? new Date().toISOString()) : null,
    });
    if (saved.athlete_id !== athleteId) {
      throw new Error("The saved session was not attributed to the selected athlete.");
    }

    for (const change of group) {
      const sets = (validByExercise.get(change.exercise.id) ?? []).map((set, index) => ({
        ...set,
        session_id: saved.id,
        plan_exercise_id: change.exercise.id,
        exercise_name: change.exercise.name,
        set_index: index + 1,
      }));
      await api.replaceSets(saved.id, change.exercise.name, sets);
      exerciseCount += 1;
      setCount += sets.length;
      if (sets.length === 0) skippedBlank += 1;
    }
    sessionCount += 1;
  }

  return { sessions: sessionCount, exercises: exerciseCount, sets: setCount, skippedBlank };
}
