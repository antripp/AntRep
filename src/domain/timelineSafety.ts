import type { PlanBundle, Session } from "../data/types";
import { parseDate } from "./dates";
import { dayForDate, resolveSegments } from "./plan";

export interface TimelineImpact {
  session: Session;
  reason: "before_start" | "after_end" | "different_day" | "different_segment" | "no_scheduled_day";
}

/**
 * Logged sessions whose immutable performed date no longer maps to the same
 * scheduled plan day/segment. Scoped by plan_id, so multi-plan accounts only
 * see warnings for the plan whose timeline changed.
 */
export function timelineImpacts(
  bundle: PlanBundle,
  sessions: Session[],
  startOverride?: string | null,
  endOverride?: string | null,
): TimelineImpact[] {
  const start = startOverride ?? bundle.plan.start_date;
  const end = endOverride ?? bundle.plan.end_date;
  return sessions
    .filter((session) => session.plan_id === bundle.plan.id)
    .flatMap((session): TimelineImpact[] => {
      if (start && session.date < start) return [{ session, reason: "before_start" }];
      if (end && session.date > end) return [{ session, reason: "after_end" }];
      const day = dayForDate(bundle, parseDate(session.date), startOverride);
      if (!day) return [{ session, reason: "no_scheduled_day" }];
      if (day.id !== session.plan_day_id) return [{ session, reason: "different_day" }];
      if (session.plan_segment_id) {
        const segmentIds = new Set(resolveSegments(bundle, day).map((segment) => segment.segmentId));
        if (!segmentIds.has(session.plan_segment_id)) return [{ session, reason: "different_segment" }];
      }
      return [];
    })
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
}

/** Only impacts introduced by this edit, excluding mismatches that predated it. */
export function newTimelineImpacts({
  before,
  after,
  sessions,
  beforeStart,
  afterStart,
  beforeEnd,
  afterEnd,
}: {
  before: PlanBundle;
  after: PlanBundle;
  sessions: Session[];
  beforeStart?: string | null;
  afterStart?: string | null;
  beforeEnd?: string | null;
  afterEnd?: string | null;
}): TimelineImpact[] {
  const existing = new Set(
    timelineImpacts(before, sessions, beforeStart, beforeEnd).map(({ session }) => session.id),
  );
  return timelineImpacts(after, sessions, afterStart, afterEnd).filter(
    ({ session }) => !existing.has(session.id),
  );
}
