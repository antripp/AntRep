import type { PlanBundle, PlanExercise, Session, SetLog } from "../data/types";
import { addDays, localDate, parseDate } from "./dates";
import { namesMatch, plannedSetCount, sessionFor } from "./logging";
import { dayForDate, resolveSegments, type ResolvedSegment } from "./plan";

export interface BatchExerciseRow {
  key: string;
  date: string;
  segment: ResolvedSegment;
  exercise: PlanExercise;
  session: Session | undefined;
  sets: SetLog[];
}

/**
 * Expand a repeating plan into concrete, editable exercise rows.
 *
 * Prescribed rows are deliberately empty: targets belong in placeholders and
 * only performed values belong in set_logs. The 366-day guard prevents a typo
 * in a date input from trying to render an effectively unbounded plan.
 */
export function buildBatchExerciseRows({
  bundle,
  start,
  end,
  startOverride,
  sessions,
  logs,
}: {
  bundle: PlanBundle;
  start: string;
  end: string;
  startOverride?: string | null;
  sessions: Session[];
  logs: SetLog[];
}): BatchExerciseRow[] {
  if (!start || !end || end < start) return [];
  const rows: BatchExerciseRow[] = [];
  let cursor = parseDate(start);
  const last = parseDate(end);

  for (let count = 0; cursor <= last && count < 366; count += 1) {
    const date = localDate(cursor);
    const day = dayForDate(bundle, cursor, startOverride);
    if (day && day.day_type !== "rest") {
      for (const segment of resolveSegments(bundle, day)) {
        const session = sessionFor(sessions, segment, date);
        for (const exercise of segment.exercises) {
          // Prefer the immutable plan exercise id, so logs remain attached
          // after a coach renames the movement. Older rows predate that link,
          // so normalized exercise-name matching remains the fallback.
          const stored = session
            ? logs
                .filter(
                  (log) =>
                    log.session_id === session.id &&
                    (log.plan_exercise_id === exercise.id ||
                      (!log.plan_exercise_id && namesMatch(log.exercise_name, exercise.name))),
                )
                .sort((a, b) => a.set_index - b.set_index)
            : [];
          rows.push({
            key: `${date}:${segment.id}:${exercise.id}`,
            date,
            segment,
            exercise,
            session,
            // Do not discard existing marker, note-only, or RPE-only rows on
            // read. Blank *new* placeholders are filtered only when saving;
            // the batch editor must faithfully show everything already stored.
            sets: stored,
          });
        }
      }
    }
    cursor = addDays(cursor, 1);
  }
  return rows;
}

export function initialBatchSetCount(exercise: PlanExercise, stored: SetLog[]): number {
  return Math.max(1, plannedSetCount(exercise), stored.length);
}
