/** XP, levels, streaks and weekly quests — the port of iOS `GamificationEngine`. */

import type { Profile, Quest, Session } from "../data/types";
import { addDays, localDate, parseDate, startOfWeek } from "./dates";

export const XP = {
  sessionStart: 25,
  sessionComplete: 30,
  exerciseBase: 8,
  perSet: 2,
  weeklyGoalBonus: 100,
  quest: 25,
  allQuestsBonus: 75,
  prBonus: 20,
};

export function xpForLevel(level: number): number {
  return Math.max(100, level * 120);
}

export function levelFor(totalXp: number): number {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return level;
}

export function levelProgress(totalXp: number): { level: number; current: number; needed: number } {
  const level = levelFor(totalXp);
  let spent = 0;
  for (let l = 1; l < level; l += 1) spent += xpForLevel(l);
  return { level, current: totalXp - spent, needed: xpForLevel(level) };
}

export function exerciseXp(setCount: number, priority = 1): number {
  const multiplier = priority >= 2 ? 1.5 : priority === 1 ? 1.25 : 1;
  return Math.round((XP.exerciseBase + setCount * XP.perSet) * multiplier);
}

/** Dates with real training activity. */
export function activeDates(sessions: Session[]): Set<string> {
  const dates = new Set<string>();
  for (const s of sessions) {
    const active =
      s.status === "complete" ||
      s.completed_names.length > 0 ||
      s.timer_segments.length > 0 ||
      s.xp_awarded > 0;
    if (active) dates.add(s.date);
  }
  return dates;
}

/**
 * Consecutive-day streak ending today (or yesterday, so an untrained morning
 * doesn't wipe a streak). Rest days in the plan bridge the chain.
 */
export function currentStreak(sessions: Session[], restWeekdays: number[] = [], today = new Date()): number {
  const active = activeDates(sessions);
  if (active.size === 0) return 0;

  const todayStr = localDate(today);
  const yesterdayStr = localDate(addDays(today, -1));
  let cursor = active.has(todayStr) ? today : active.has(yesterdayStr) ? addDays(today, -1) : null;
  if (!cursor) return 0;

  let streak = 0;
  let guard = 0;
  while (guard < 800) {
    guard += 1;
    const key = localDate(cursor);
    if (active.has(key)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    // A scheduled rest day keeps the chain alive without counting.
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (restWeekdays.includes(weekday)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}

export interface DayDot {
  date: string;
  level: 0 | 1 | 2;
}

/** Last `count` days as dots for the Home streak chip. */
export function recentDays(sessions: Session[], count = 10, today = new Date()): DayDot[] {
  const active = activeDates(sessions);
  return Array.from({ length: count }, (_, i) => {
    const date = localDate(addDays(today, -(count - 1 - i)));
    return { date, level: (active.has(date) ? 2 : 0) as 0 | 1 | 2 };
  });
}

export function weeklyGymCount(sessions: Session[], weekStart: Date = startOfWeek()): number {
  const start = localDate(weekStart);
  const end = localDate(addDays(weekStart, 6));
  const days = new Set(
    sessions
      .filter((s) => s.date >= start && s.date <= end && s.counts_as_gym && s.completed_names.length > 0)
      .map((s) => s.date),
  );
  return days.size;
}

export const QUEST_TEMPLATES = [
  { key: "sessions", label: "Train 3 days this week", target: 3 },
  { key: "exercises", label: "Log 12 exercises", target: 12 },
  { key: "volume", label: "Lift 5,000 kg of volume", target: 5000 },
] as const;

/** Recompute this week's quest progress from sessions. */
export function buildQuests(
  profileId: string,
  sessions: Session[],
  volumeThisWeek: number,
  weekStart: Date = startOfWeek(),
): Quest[] {
  const start = localDate(weekStart);
  const end = localDate(addDays(weekStart, 6));
  const inWeek = sessions.filter((s) => s.date >= start && s.date <= end);
  const trainedDays = new Set(inWeek.filter((s) => s.completed_names.length > 0).map((s) => s.date)).size;
  const exercises = inWeek.reduce((t, s) => t + s.completed_names.length, 0);

  const values: Record<string, number> = {
    sessions: trainedDays,
    exercises,
    volume: Math.round(volumeThisWeek),
  };

  return QUEST_TEMPLATES.map((q) => ({
    id: `${profileId}-${start}-${q.key}`,
    profile_id: profileId,
    week_start: start,
    key: q.key,
    label: q.label,
    target: q.target,
    progress: Math.min(values[q.key] ?? 0, q.target),
    completed: (values[q.key] ?? 0) >= q.target,
  }));
}

/** Streak headline + subtitle, matching the iOS copy. */
export function streakCopy(streak: number): { headline: string; subtitle: string } {
  if (streak <= 0) return { headline: "Start your streak", subtitle: "Log a workout to begin" };
  if (streak === 1) return { headline: "Day 1 streak", subtitle: "Great start — come back tomorrow" };
  if (streak < 7) return { headline: `${streak}-day streak`, subtitle: "Building momentum" };
  return { headline: `${streak}-day streak`, subtitle: "You're on fire — keep it up" };
}

export function syncedProfileStats(profile: Profile, sessions: Session[], restWeekdays: number[]): Partial<Profile> {
  const streak = currentStreak(sessions, restWeekdays);
  const last = [...activeDates(sessions)].sort().pop() ?? null;
  return {
    current_streak: streak,
    best_streak: Math.max(profile.best_streak, streak),
    level: levelFor(profile.total_xp),
    last_active_date: last ? localDate(parseDate(last)) : profile.last_active_date,
  };
}
