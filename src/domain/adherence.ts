/**
 * Did the training actually happen? Compares what a plan scheduled against what
 * was logged — the numbers a coach reads first.
 */

import type { PlanBundle, Session, SetLog } from "../data/types";
import { addDays, formatShortDate, localDate, startOfWeek } from "./dates";
import { dayForDate, hasTrainableContent, resolveSegments } from "./plan";
import { loggedSessionIds, sessionFor, wasTrained } from "./logging";
import { weeklySeries } from "./analytics";

export interface PlanView {
  bundle: PlanBundle;
  start?: string | null;
}

export interface AdherenceWeek {
  weekStart: string;
  label: string;
  planned: number;
  completed: number;
  /** Sessions logged that week with no scheduled day behind them. */
  extra: number;
  ratio: number;
}

/** Planned vs completed sessions, week by week (oldest first). */
export function planAdherence(
  plans: PlanView[],
  sessions: Session[],
  weeks = 4,
  today = new Date(),
  /** Sessions with recorded sets — they count even with nothing ticked off. */
  logged?: Set<string>,
): AdherenceWeek[] {
  const thisWeek = startOfWeek(today);
  const todayStr = localDate(today);
  const out: AdherenceWeek[] = [];

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = addDays(thisWeek, -7 * i);
    let planned = 0;
    let completed = 0;
    const countedSessions = new Set<string>();

    for (let d = 0; d < 7; d += 1) {
      const date = addDays(weekStart, d);
      const dateStr = localDate(date);
      if (dateStr > todayStr) continue;

      for (const { bundle, start } of plans) {
        if (start && start > dateStr) continue;
        const day = dayForDate(bundle, date, start);
        if (!day || !hasTrainableContent(bundle, day)) continue;

        for (const segment of resolveSegments(bundle, day)) {
          if (segment.exercises.length === 0 && segment.dayType !== "run") continue;
          planned += 1;
          const session = sessionFor(sessions, segment, dateStr);
          if (session && wasTrained(session, logged)) {
            completed += 1;
            countedSessions.add(session.id);
          }
        }
      }
    }

    const weekStartStr = localDate(weekStart);
    const weekEndStr = localDate(addDays(weekStart, 6));
    const extra = sessions.filter(
      (s) =>
        s.date >= weekStartStr &&
        s.date <= weekEndStr &&
        wasTrained(s, logged) &&
        !countedSessions.has(s.id),
    ).length;

    out.push({
      weekStart: weekStartStr,
      label: formatShortDate(weekStartStr),
      planned,
      completed,
      extra,
      ratio: planned > 0 ? Math.min(1, completed / planned) : completed > 0 ? 1 : 0,
    });
  }
  return out;
}

export interface CoachFlag {
  id: string;
  tone: "good" | "warn" | "info";
  title: string;
  detail: string;
}

/** Short "what needs your attention" list for one athlete. */
export function coachFlags({
  plans,
  sessions,
  logs,
  weeklyGoal,
  today = new Date(),
}: {
  plans: PlanView[];
  sessions: Session[];
  logs: SetLog[];
  weeklyGoal: number;
  today?: Date;
}): CoachFlag[] {
  const flags: CoachFlag[] = [];
  const todayStr = localDate(today);

  const loggedIds = loggedSessionIds(logs);
  const lastDate = sessions
    .filter((s) => wasTrained(s, loggedIds) || s.timer_segments.length > 0)
    .reduce<string | null>((newest, s) => (!newest || s.date > newest ? s.date : newest), null);

  if (!lastDate) {
    flags.push({
      id: "never",
      tone: "warn",
      title: "Nothing logged yet",
      detail: "This athlete hasn't recorded a session.",
    });
    return flags;
  }

  const daysSince = Math.round(
    (new Date(todayStr).getTime() - new Date(lastDate).getTime()) / 86400000,
  );
  if (daysSince >= 4) {
    flags.push({
      id: "quiet",
      tone: "warn",
      title: `Quiet for ${daysSince} days`,
      detail: `Last session was ${formatShortDate(lastDate)}.`,
    });
  }

  const weeks = planAdherence(plans, sessions, 2, today);
  const current = weeks.at(-1);
  if (current && current.planned > 0) {
    const missed = current.planned - current.completed;
    if (missed > 0) {
      flags.push({
        id: "missed",
        tone: missed >= 2 ? "warn" : "info",
        title: `${missed} planned session${missed === 1 ? "" : "s"} missed this week`,
        detail: `${current.completed} of ${current.planned} done so far.`,
      });
    } else {
      flags.push({
        id: "on-plan",
        tone: "good",
        title: "On plan this week",
        detail: `${current.completed} of ${current.planned} sessions done.`,
      });
    }
  }

  const series = weeklySeries(sessions, logs, 2, today);
  const thisWeek = series.at(-1);
  const lastWeek = series.at(-2);
  if (thisWeek && lastWeek && lastWeek.volume > 0) {
    const change = (thisWeek.volume - lastWeek.volume) / lastWeek.volume;
    if (Math.abs(change) >= 0.15) {
      flags.push({
        id: "volume",
        tone: change > 0 ? "good" : "info",
        title: `Total lifting work ${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change * 100))}%`,
        detail: `${thisWeek.volume.toLocaleString()} kg vs ${lastWeek.volume.toLocaleString()} kg last week.`,
      });
    }
  }

  if (thisWeek && weeklyGoal > 0 && thisWeek.sessions >= weeklyGoal) {
    flags.push({
      id: "goal",
      tone: "good",
      title: "Weekly goal hit",
      detail: `${thisWeek.sessions} of ${weeklyGoal} sessions.`,
    });
  }

  return flags;
}

/** Extra work logged with no plan behind it — useful context for a new coach. */
export function offPlanCount(sessions: Session[], logged?: Set<string>): number {
  return sessions.filter((s) => !s.plan_day_id && wasTrained(s, logged)).length;
}
