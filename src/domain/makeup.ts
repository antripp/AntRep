/**
 * "Train another day's workout today" — the skipped-day safeguard ported from
 * the iOS app. The session is always logged on today's date and stays attached
 * to the makeup day, so the plan schedule itself is never rewritten.
 */

import type { PlanBundle, PlanDay, Session } from "../data/types";
import { addDays, isoWeekday, localDate, relativeDayLabel } from "./dates";
import { daysForDate, hasTrainableContent, resolveSegments, type ResolvedSegment } from "./plan";
import { canStartTimer, sessionFor } from "./logging";

export interface MakeupCandidate {
  day: PlanDay;
  bundle: PlanBundle;
  segment: ResolvedSegment;
  scheduledDate: string;
  daysAgo: number;
  relativeLabel: string;
  isMissed: boolean;
  isTrainedToday: boolean;
  canStartToday: boolean;
  exerciseCount: number;
}

/** Other scheduled days that can be trained today, most recent first. */
export function makeupCandidates(
  bundles: PlanBundle[],
  sessions: Session[],
  today = new Date(),
): MakeupCandidate[] {
  const todayStr = localDate(today);
  const todayWeekday = isoWeekday(today);
  const out: MakeupCandidate[] = [];

  for (const bundle of bundles) {
    if (!bundle.plan.is_active || bundle.plan.is_archived) continue;
    for (const day of daysForDate(bundle, today)) {
      if (day.weekday === todayWeekday) continue;
      if (!hasTrainableContent(bundle, day)) continue;

      const daysAgo = (todayWeekday - day.weekday + 7) % 7;
      const scheduledDate = localDate(addDays(today, -daysAgo));
      const segments = resolveSegments(bundle, day);

      const trainedOnItsDay = segments.some((seg) => {
        const s = sessionFor(sessions, seg, scheduledDate);
        return Boolean(s && (s.completed_names.length > 0 || s.timer_segments.length > 0));
      });
      const trainedToday = segments.some((seg) => Boolean(sessionFor(sessions, seg, todayStr)));
      const startable = segments.find((seg) => canStartTimer(sessionFor(sessions, seg, todayStr)));

      out.push({
        day,
        bundle,
        segment: startable ?? segments[0],
        scheduledDate,
        daysAgo,
        relativeLabel: relativeDayLabel(daysAgo),
        isMissed: !trainedOnItsDay,
        isTrainedToday: trainedToday,
        canStartToday: Boolean(startable),
        exerciseCount: segments.reduce((t, s) => t + s.exercises.length, 0),
      });
    }
  }

  return out.sort((a, b) => a.daysAgo - b.daysAgo);
}

/**
 * Segments with a session on `date` that the day's own schedule doesn't contain:
 * a makeup being trained today, or — when back-filling — work logged against a
 * plan that has since changed, been swapped, or archived.
 *
 * `bundles` should therefore be every plan the athlete has ever followed, not
 * just the active ones.
 */
export function offScheduleSegments(
  bundles: PlanBundle[],
  sessions: Session[],
  date: Date,
  scheduledIds: Set<string>,
): ResolvedSegment[] {
  const dateStr = localDate(date);
  const result: ResolvedSegment[] = [];
  const seenSegments = new Set<string>();

  for (const bundle of bundles) {
    for (const day of bundle.days) {
      const segments = resolveSegments(bundle, day);
      const dayHasWork = segments.some(
        (seg) => !scheduledIds.has(seg.id) && Boolean(sessionFor(sessions, seg, dateStr)),
      );
      if (!dayHasWork) continue;
      // Show the whole day so the rest of its exercises stay loggable.
      for (const segment of segments) {
        if (scheduledIds.has(segment.id) || seenSegments.has(segment.id)) continue;
        seenSegments.add(segment.id);
        result.push(segment);
      }
    }
  }
  return result;
}

/** Segment ids scheduled on `date` by the plans in effect then. */
export function scheduledSegmentIds(
  plans: { bundle: PlanBundle; start?: string | null }[],
  date: Date,
): Set<string> {
  const weekday = isoWeekday(date);
  const ids = new Set<string>();
  for (const { bundle, start } of plans) {
    for (const day of daysForDate(bundle, date, start)) {
      if (day.weekday !== weekday) continue;
      for (const seg of resolveSegments(bundle, day)) ids.add(seg.id);
    }
  }
  return ids;
}

/** Segments trained today that today's schedule does not contain (makeups in progress). */
export function makeupSegmentsToday(
  bundles: PlanBundle[],
  sessions: Session[],
  today = new Date(),
): ResolvedSegment[] {
  return offScheduleSegments(
    bundles,
    sessions,
    today,
    scheduledSegmentIds(
      bundles.map((bundle) => ({ bundle })),
      today,
    ),
  );
}
