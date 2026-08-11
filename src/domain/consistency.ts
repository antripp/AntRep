import type { PlanBundle, Session, SetLog } from "../data/types";
import { addDays, localDate, parseDate } from "./dates";
import { activeDates } from "./gamification";
import { loggedSessionIds } from "./logging";
import { dayForDate, hasTrainableContent } from "./plan";

export interface ProgressPlanRun {
  bundle: PlanBundle;
  start: string;
  end?: string | null;
}

export interface ConsistencyContextScore {
  id: string;
  label: string;
  planned: number;
  completed: number;
  score: number;
}

export interface ConsistencyAnalysis {
  score: number;
  change: number | null;
  requiredDays: number;
  completedRequiredDays: number;
  plannedRate: number | null;
  regularity: number;
  planScores: ConsistencyContextScore[];
  dayScores: ConsistencyContextScore[];
}

/**
 * Headline consistency rewards showing up on required days with any real work.
 * Rest and optional days are neutral: they neither add to nor break the score.
 * Plan/day scores stay stricter and require work linked to that context.
 */
export function analyseConsistency(
  sessions: Session[],
  logs: SetLog[],
  weeklyGoal: number,
  planRuns: ProgressPlanRun[] = [],
  today = new Date(),
  weeks = 8,
): ConsistencyAnalysis {
  const cutoff = localDate(today);
  const lower = localDate(addDays(today, -(weeks * 7 - 1)));
  const currentSessions = sessions.filter((session) => session.date >= lower && session.date <= cutoff);
  const currentIds = new Set(currentSessions.map((session) => session.id));
  const currentLogs = logs.filter((log) => currentIds.has(log.session_id));
  const trainedDates = activeDates(currentSessions, loggedSessionIds(currentLogs));

  const requiredByRun = planRuns.map((run) => ({ run, dates: requiredDates(run, lower, cutoff) }));
  const required = new Set(requiredByRun.flatMap((entry) => entry.dates.map((date) => date.date)));
  const completedRequiredDays = [...required].filter((date) => trainedDates.has(date)).length;
  const plannedRate = required.size ? completedRequiredDays / required.size : null;
  const regularity = regularityScore([...trainedDates].sort(), Math.max(1, weeklyGoal));
  const fallbackFrequency = Math.min(1, trainedDates.size / Math.max(1, weeks * Math.max(1, weeklyGoal)));
  const score = Math.round(100 * (plannedRate === null
    ? fallbackFrequency * 0.7 + regularity * 0.3
    : plannedRate * 0.75 + regularity * 0.25));

  const midpoint = localDate(addDays(today, -(Math.floor(weeks / 2) * 7)));
  const recentDates = new Set([...trainedDates].filter((date) => date >= midpoint));
  const priorDates = new Set([...trainedDates].filter((date) => date < midpoint));
  const recentRequired = [...required].filter((date) => date >= midpoint);
  const priorRequired = [...required].filter((date) => date < midpoint);
  const recentRate = recentRequired.length
    ? recentRequired.filter((date) => recentDates.has(date)).length / recentRequired.length
    : recentDates.size / Math.max(1, Math.floor(weeks / 2) * weeklyGoal);
  const priorRate = priorRequired.length
    ? priorRequired.filter((date) => priorDates.has(date)).length / priorRequired.length
    : priorDates.size / Math.max(1, Math.ceil(weeks / 2) * weeklyGoal);
  const change = priorRate > 0 ? (recentRate - priorRate) / priorRate : null;

  const planScores = requiredByRun.map(({ run, dates }) => {
    const linkedDates = new Set(
      currentSessions
        .filter((session) => session.plan_id === run.bundle.plan.id)
        .filter((session) => trainedDates.has(session.date))
        .map((session) => session.date),
    );
    const completed = dates.filter((entry) => linkedDates.has(entry.date)).length;
    return {
      id: run.bundle.plan.id,
      label: run.bundle.plan.name,
      planned: dates.length,
      completed,
      score: dates.length ? Math.round(completed / dates.length * 100) : 0,
    };
  }).filter((item) => item.planned > 0);

  const dayMap = new Map<string, { label: string; planned: number; completed: number }>();
  for (const { run, dates } of requiredByRun) {
    const linkedDates = new Set(
      currentSessions
        .filter((session) => session.plan_id === run.bundle.plan.id && trainedDates.has(session.date))
        .map((session) => session.date),
    );
    for (const entry of dates) {
      const key = `${entry.day.day_type}::${entry.day.title.trim().toLowerCase()}`;
      const item = dayMap.get(key) ?? { label: entry.day.title || "Workout", planned: 0, completed: 0 };
      item.planned += 1;
      if (linkedDates.has(entry.date)) item.completed += 1;
      dayMap.set(key, item);
    }
  }
  const dayScores = [...dayMap.entries()].map(([id, item]) => ({
    id,
    label: item.label,
    planned: item.planned,
    completed: item.completed,
    score: item.planned ? Math.round(item.completed / item.planned * 100) : 0,
  }));

  return {
    score,
    change,
    requiredDays: required.size,
    completedRequiredDays,
    plannedRate,
    regularity: Math.round(regularity * 100),
    planScores,
    dayScores,
  };
}

function requiredDates(run: ProgressPlanRun, lower: string, upper: string) {
  const start = run.start > lower ? run.start : lower;
  const end = run.end && run.end < upper ? run.end : upper;
  if (!run.start || start > end) return [];
  const out: { date: string; day: ReturnType<typeof dayForDate> extends infer T ? Exclude<T, null> : never }[] = [];
  for (let cursor = parseDate(start), guard = 0; localDate(cursor) <= end && guard < 800; cursor = addDays(cursor, 1), guard += 1) {
    const day = dayForDate(run.bundle, cursor, run.start);
    if (!day || day.day_type === "rest" || day.is_optional || !hasTrainableContent(run.bundle, day)) continue;
    out.push({ date: localDate(cursor), day });
  }
  return out;
}

function regularityScore(dates: string[], weeklyGoal: number): number {
  if (dates.length < 2) return dates.length ? 0.5 : 0;
  const gaps = dates.slice(1).map((date, index) =>
    Math.max(1, Math.round((parseDate(date).getTime() - parseDate(dates[index]).getTime()) / 86400000)),
  );
  const expectedGap = 7 / weeklyGoal;
  const meanError = gaps.reduce((total, gap) => total + Math.min(1, Math.abs(gap - expectedGap) / Math.max(1, expectedGap * 2)), 0) / gaps.length;
  return Math.max(0, Math.min(1, 1 - meanError));
}
