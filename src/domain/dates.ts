/** Date helpers. Weeks are Monday-first, matching the iOS app. */

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

export function weekdayLabel(weekday: number, short = false): string {
  const list = short ? WEEKDAY_SHORT : WEEKDAY_FULL;
  return list[weekday - 1] ?? "Day";
}

/** Local yyyy-mm-dd (toISOString would shift by the UTC offset). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date = new Date()): Date {
  return addDays(startOfDay(d), -(isoWeekday(d) - 1));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

/** "Yesterday", "3 days ago", "Today". */
export function relativeDayLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 0) return `In ${-daysAgo} day${daysAgo === -1 ? "" : "s"}`;
  return `${daysAgo} days ago`;
}

export function formatLongDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export function formatShortDate(s: string): string {
  return parseDate(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** mm:ss (or h:mm:ss past an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * A time- and day-aware greeting for the public athlete home screen.
 * Deterministic within each time slot, so a refresh does not make the heading
 * jump while the day still gets a little personality.
 */
export function greeting(name: string, d: Date = new Date()): string {
  const trimmed = name.trim();
  const weekday = isoWeekday(d);
  const hour = d.getHours();
  const who = trimmed ? `, ${trimmed}` : "";

  const slot =
    hour < 5
      ? "preDawn"
      : hour < 8
        ? "early"
        : hour < 12
          ? "morning"
          : hour < 14
            ? "midday"
            : hour < 17
              ? "afternoon"
              : hour < 21
                ? "evening"
                : "late";
  const weekend = weekday >= 6;
  const day = WEEKDAY_FULL[weekday - 1];
  const lines: Record<string, string[]> = {
    preDawn: ["Up before your excuses", "The world is asleep — rude", "Pre-dawn discipline"],
    early: ["Early shift", "Morning, overachiever", "First light, first set"],
    morning: weekend
      ? ["Weekend warrior", "Slow morning, strong start", `${day} sets are calling`]
      : ["Good morning", "Morning momentum", `${day}, let's get moving`],
    midday: ["Midday reset", "Lunch break, but stronger", `${day} power hour`],
    afternoon: weekend
      ? ["Weekend work", "Afternoon gains", "Still time to earn the shower"]
      : ["Good afternoon", "Afternoon push", `${day} isn't done yet`],
    evening: ["Good evening", "Evening session", "Clocked out, locked in"],
    late: ["Night shift", "Late session", "One last win today"],
  };
  const options = lines[slot];
  const pick = options[(d.getDate() + d.getMonth() + weekday) % options.length];
  return `${pick}${who}.`;
}
