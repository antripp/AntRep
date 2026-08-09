/**
 * Writes a reviewed spreadsheet import to the backend.
 *
 * Shared by both portals: the athlete importing their own history, and a coach
 * importing on an athlete's behalf. Only two things differ — whose `athlete_id`
 * the sessions carry, and whether existing sessions may be rewritten.
 */

import { api } from ".";
import { makeSession, newId } from "./factories";
import type { Session, SetLog } from "./types";
import type { ImportIssue, ImportSession } from "../domain/importLog";
import { nameKey } from "../domain/logging";

export interface ImportOutcome {
  sessions: number;
  sets: number;
  skipped: number;
  failed: ImportIssue[];
}

export async function writeImport({
  athleteId,
  batch,
  allowUpdateExisting,
  onProgress,
  onSessionSaved,
  onSetsSaved,
}: {
  athleteId: string;
  batch: ImportSession[];
  /**
   * False for a coach: RLS lets them add history but not overwrite sets the
   * athlete already has, so those sessions are skipped rather than attempted.
   */
  allowUpdateExisting: boolean;
  onProgress?: (done: number, total: number) => void;
  onSessionSaved?: (session: Session) => void;
  onSetsSaved?: (sessionId: string, exerciseName: string, sets: SetLog[]) => void;
}): Promise<ImportOutcome> {
  let created = 0;
  let setCount = 0;
  let skipped = 0;
  const failed: ImportIssue[] = [];

  // Sessions are written one at a time rather than as one transaction: a
  // partial import that reports how far it got can simply be re-run, whereas an
  // all-or-nothing failure on row 400 loses the first 399 for no reason.
  for (const [index, item] of batch.entries()) {
    if (item.existing && !allowUpdateExisting) {
      skipped += 1;
      onProgress?.(index + 1, batch.length);
      continue;
    }

    try {
      const base =
        item.existing ??
        makeSession(athleteId, {
          day_title: item.dayTitle,
          day_type: item.dayType,
          date: item.date,
          plan_id: item.planId,
          plan_day_id: item.planDayId,
          counts_as_gym: true,
          status: "complete",
          is_late_completion: true,
          // Imported history is a record, not a live workout: no timer, and no
          // XP — awarding it retroactively would rewrite the streak.
          xp_awarded: 0,
        });

      const session = await api.saveSession(base);
      onSessionSaved?.(session);

      // `replaceSets` works per exercise, so the rows are grouped first —
      // calling it per row would clear the previous set each time.
      const byExercise = new Map<string, ImportSession["sets"]>();
      for (const set of item.sets) {
        const key = nameKey(set.exercise_name);
        byExercise.set(key, [...(byExercise.get(key) ?? []), set]);
      }

      for (const sets of byExercise.values()) {
        const numbered: SetLog[] = sets.map((s, i) => ({
          ...s,
          id: newId(),
          session_id: session.id,
          set_index: s.set_index || i + 1,
        }));
        await api.replaceSets(session.id, sets[0].exercise_name, numbered);
        onSetsSaved?.(session.id, sets[0].exercise_name, numbered);
        setCount += numbered.length;
      }
      created += 1;
    } catch (error) {
      failed.push({
        rowNumber: 0,
        level: "error",
        message: `${item.date} ${item.dayTitle}: ${
          error instanceof Error ? error.message : "failed to save"
        }`,
      });
    }
    onProgress?.(index + 1, batch.length);
  }

  return { sessions: created, sets: setCount, skipped, failed };
}
