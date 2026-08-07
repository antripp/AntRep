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

/** Time-of-day greeting, in the voice of the iOS app. */
export function greeting(name: string, d: Date = new Date()): string {
  const trimmed = name.trim();
  const weekday = isoWeekday(d);
  const hour = d.getHours();
  const slot = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
  const who = trimmed ? `, ${trimmed}` : "";

  if (weekday === 1) return `Monday ro${who}!`;
  const lines: Record<string, string[]> = {
    morning: ["Morning grind", "Early sets", "Rise and lift"],
    afternoon: [`${WEEKDAY_FULL[weekday - 1]} grind`, "Midday push", "Afternoon work"],
    evening: ["Evening session", "Night shift", "Last rep of the day"],
    night: ["Late one", "Quiet hours", "Night owl sets"],
  };
  const options = lines[slot];
  const pick = options[(d.getDate() + weekday) % options.length];
  return `${pick}${who}.`;
}
