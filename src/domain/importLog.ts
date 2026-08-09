/**
 * Batch import of past training from a spreadsheet.
 *
 * People arrive with years of training in a spreadsheet of their own shape.
 * Rather than invent a rigid format and make them conform by hand, the importer
 * accepts a wide set of column names and two ways of saying *when*:
 *
 *   by date      a real date in the row — unambiguous, always wins.
 *   by occurrence  "Pull day", session 3 — resolved against the plan's start
 *                  date and its repeat period, so the 3rd pull day lands on the
 *                  3rd pull day whatever the calendar says.
 *
 * Everything is resolved to a preview first. Nothing is written until the
 * preview has been seen, because an import that silently invents thirty
 * sessions on the wrong dates is worse than one that refuses to run.
 */

import type { DayType, PlanBundle, Session, SetLog } from "../data/types";
import { localDate } from "./dates";
import { nameKey } from "./logging";
import { isCyclePlan, occurrenceDate, slotIndex } from "./plan";

// ------------------------------------------------------------------
// Column mapping
// ------------------------------------------------------------------

/** Every column we understand, and the header names people actually use. */
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ["date", "day date", "workout date", "session date", "when", "performed"],
  day: ["day", "plan day", "day title", "workout", "split day", "session name", "routine"],
  occurrence: [
    "session",
    "session #",
    "session no",
    "session number",
    "occurrence",
    "nth",
    "round",
    "week",
    "cycle",
  ],
  exercise: ["exercise", "movement", "lift", "name", "exercise name"],
  set: ["set", "set #", "set no", "set number"],
  weight: ["weight", "weight (kg)", "kg", "load", "load (kg)", "weight kg"],
  reps: ["reps", "rep", "repetitions", "rep count"],
  rpe: ["rpe", "effort", "rir"],
  distance: ["distance", "distance (km)", "km", "distance km"],
  duration: ["duration", "time", "mins", "minutes", "seconds", "secs", "duration (min)"],
  note: ["note", "notes", "comment", "comments"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Map each known column to the sheet column index holding it.
 *
 * Exact header matches are taken first across all fields, so a sheet with both
 * "Set" and "Set number for the day" gives "Set" to `set` before the looser
 * pass runs. A column is only ever claimed once.
 */
export function mapColumns(header: unknown[]): Record<string, number> {
  const normalized = header.map(normalizeHeader);
  const map: Record<string, number> = {};
  const claimed = new Set<number>();

  const claim = (field: string, index: number) => {
    if (index < 0 || claimed.has(index) || field in map) return;
    map[field] = index;
    claimed.add(index);
  };

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    claim(
      field,
      normalized.findIndex((h, i) => h !== "" && !claimed.has(i) && aliases.includes(h)),
    );
  }

  // Looser "contains" pass for anything still unmapped, so "Weight lifted (kg)"
  // still lands on `weight`.
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (field in map) continue;
    claim(
      field,
      normalized.findIndex(
        (h, i) => h !== "" && !claimed.has(i) && aliases.some((a) => h.includes(a)),
      ),
    );
  }

  return map;
}

// ------------------------------------------------------------------
// Cell parsing
// ------------------------------------------------------------------

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * A date from a cell, whatever shape it arrived in.
 *
 * SheetJS hands back a Date when the cell is date-formatted, a number when it
 * is a raw Excel serial, and a string when it was typed as text — and people
 * type both 03/04 orders. Ambiguous d/m vs m/d is resolved by preferring the
 * reading that is a valid date, and by day-first when both are (the app's
 * users are not US-centric); an ISO string is never ambiguous.
 */
export function parseCellDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDate(value);

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial: days since 1899-12-30 (its leap-year bug included).
    const ms = Math.round((value - 25569) * 86400000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : localDate(d);
  }

  const raw = text(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const slash = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    // b > 12 forces day-first; a > 12 forces month-first; else day-first.
    const dayFirst = b > 12 ? false : true;
    const day = dayFirst ? a : b;
    const month = dayFirst ? b : a;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : localDate(parsed);
}

/**
 * Seconds from a duration cell: "1:30" → 90, "1:05:00" → 3900, plain numbers
 * as seconds unless the column called itself minutes.
 */
export function parseDuration(value: unknown, headerSaysMinutes = false): number | null {
  if (value === null || value === undefined || value === "") return null;

  const raw = text(value);
  if (raw.includes(":")) {
    const parts = raw.split(":").map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  const n = num(value);
  if (n === null) return null;
  return headerSaysMinutes ? Math.round(n * 60) : Math.round(n);
}

// ------------------------------------------------------------------
// Rows
// ------------------------------------------------------------------

export interface ImportRow {
  /** 1-based row in the sheet, so an error can name it. */
  rowNumber: number;
  date: string | null;
  day: string;
  occurrence: number | null;
  exercise: string;
  setIndex: number | null;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  note: string;
}

export function parseRows(sheet: unknown[][]): { rows: ImportRow[]; columns: Record<string, number> } {
  if (sheet.length === 0) return { rows: [], columns: {} };

  // The header is the first row with at least two recognisable columns —
  // exported sheets often carry a title row above it.
  let headerIndex = 0;
  let columns: Record<string, number> = {};
  for (let i = 0; i < Math.min(sheet.length, 10); i += 1) {
    const candidate = mapColumns(sheet[i] ?? []);
    if (Object.keys(candidate).length >= 2) {
      headerIndex = i;
      columns = candidate;
      break;
    }
  }
  if (Object.keys(columns).length === 0) return { rows: [], columns: {} };

  const durationHeader = normalizeHeader(sheet[headerIndex]?.[columns.duration ?? -1]);
  const minutes = /min/.test(durationHeader);

  const rows: ImportRow[] = [];
  const cell = (row: unknown[], field: string): unknown =>
    columns[field] === undefined ? undefined : row[columns[field]];

  for (let i = headerIndex + 1; i < sheet.length; i += 1) {
    const row = sheet[i] ?? [];
    const exercise = text(cell(row, "exercise"));
    // A row with no exercise is a spacer, a total, or a section heading.
    if (!exercise) continue;

    rows.push({
      rowNumber: i + 1,
      date: parseCellDate(cell(row, "date")),
      day: text(cell(row, "day")),
      occurrence: num(cell(row, "occurrence")),
      exercise,
      setIndex: num(cell(row, "set")),
      weightKg: num(cell(row, "weight")),
      reps: num(cell(row, "reps")),
      rpe: num(cell(row, "rpe")),
      distanceKm: num(cell(row, "distance")),
      durationSec: parseDuration(cell(row, "duration"), minutes),
      note: text(cell(row, "note")),
    });
  }

  return { rows, columns };
}

// ------------------------------------------------------------------
// Resolution to sessions
// ------------------------------------------------------------------

export interface ImportIssue {
  rowNumber: number;
  level: "error" | "warning";
  message: string;
}

export interface ImportSession {
  key: string;
  date: string;
  dayTitle: string;
  dayType: DayType;
  planId: string | null;
  planDayId: string | null;
  /** True when a session already exists for this date and day. */
  existing: Session | null;
  sets: Omit<SetLog, "id" | "session_id">[];
}

export interface ImportPreview {
  sessions: ImportSession[];
  issues: ImportIssue[];
  /** Rows that produced a set. */
  usedRows: number;
  totalSets: number;
}

/** Match a sheet's day name to a day in the plan, by title then by type. */
function findPlanDay(bundle: PlanBundle, dayName: string) {
  const key = nameKey(dayName);
  if (!key) return null;

  const byTitle = bundle.days.find((d) => nameKey(d.title) === key);
  if (byTitle) return byTitle;

  // "pull" should still find "Pull day", and vice versa.
  const loose = bundle.days.find(
    (d) => nameKey(d.title).includes(key) || key.includes(nameKey(d.title)),
  );
  if (loose) return loose;

  return bundle.days.find((d) => nameKey(d.day_type) === key) ?? null;
}

/**
 * Turn parsed rows into the sessions and sets they describe.
 *
 * Rows are grouped by the day they resolve to, so a spreadsheet listing five
 * exercises against "Pull day 3" produces one session with all of them, not
 * five sessions.
 */
export function buildImportPreview({
  rows,
  bundle,
  existingSessions,
  startOverride,
}: {
  rows: ImportRow[];
  /** The plan to resolve occurrences against. Null imports everything as free work. */
  bundle: PlanBundle | null;
  existingSessions: Session[];
  startOverride?: string | null;
}): ImportPreview {
  const issues: ImportIssue[] = [];
  const byKey = new Map<string, ImportSession>();
  let usedRows = 0;
  let totalSets = 0;

  // Track the set number per exercise per session, for sheets that don't say.
  const setCounters = new Map<string, number>();

  for (const row of rows) {
    let date = row.date;
    let planDayId: string | null = null;
    let dayTitle = row.day;
    let dayType: DayType = "custom";

    const planDay = bundle && row.day ? findPlanDay(bundle, row.day) : null;
    if (planDay) {
      planDayId = planDay.id;
      dayTitle = planDay.title || row.day;
      dayType = planDay.day_type;
    }

    // No date given: resolve "3rd pull day" through the plan's start date.
    if (!date) {
      if (!bundle || !planDay) {
        issues.push({
          rowNumber: row.rowNumber,
          level: "error",
          message: row.day
            ? `No date, and "${row.day}" doesn't match a day in the plan.`
            : "No date and no day name — nothing to place this row against.",
        });
        continue;
      }
      const occurrence = row.occurrence ?? 1;
      date = occurrenceDate(bundle.plan, slotIndex(bundle.plan, planDay), occurrence, startOverride);
      if (!date) {
        issues.push({
          rowNumber: row.rowNumber,
          level: "error",
          message: "The plan has no start date, so session numbers can't be placed on the calendar.",
        });
        continue;
      }
    }

    if (date > localDate()) {
      issues.push({
        rowNumber: row.rowNumber,
        level: "warning",
        message: `Resolved to ${date}, which is in the future — check the session number.`,
      });
    }

    const key = `${date}::${planDayId ?? nameKey(dayTitle)}`;
    let session = byKey.get(key);
    if (!session) {
      session = {
        key,
        date,
        dayTitle: dayTitle || "Imported workout",
        dayType,
        planId: bundle?.plan.id ?? null,
        planDayId,
        existing:
          existingSessions.find(
            (s) => s.date === date && (planDayId ? s.plan_day_id === planDayId : !s.plan_day_id),
          ) ?? null,
        sets: [],
      };
      byKey.set(key, session);
    }

    const counterKey = `${key}::${nameKey(row.exercise)}`;
    const nextIndex = (setCounters.get(counterKey) ?? 0) + 1;
    setCounters.set(counterKey, nextIndex);

    const hasNumbers =
      row.weightKg !== null ||
      row.reps !== null ||
      row.distanceKm !== null ||
      row.durationSec !== null;
    if (!hasNumbers) {
      issues.push({
        rowNumber: row.rowNumber,
        level: "warning",
        message: `"${row.exercise}" has no weight, reps, distance or time — skipped.`,
      });
      continue;
    }

    if (row.rpe !== null && (row.rpe < 0 || row.rpe > 10)) {
      issues.push({
        rowNumber: row.rowNumber,
        level: "warning",
        message: `RPE ${row.rpe} is outside 0–10 and was dropped.`,
      });
    }

    session.sets.push({
      plan_exercise_id: null,
      exercise_name: row.exercise,
      set_index: row.setIndex ?? nextIndex,
      weight_kg: row.weightKg,
      reps: row.reps,
      rpe: row.rpe !== null && row.rpe >= 0 && row.rpe <= 10 ? row.rpe : null,
      distance_km: row.distanceKm,
      duration_sec: row.durationSec,
      incline_percent: null,
      pace_sec_per_km: null,
      note: row.note,
      extra: {},
      completed_at: new Date(`${date}T12:00:00`).toISOString(),
    });
    usedRows += 1;
    totalSets += 1;
  }

  const sessions = [...byKey.values()]
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { sessions, issues, usedRows, totalSets };
}

/** The plan day a title refers to, for the preview's "resolved as" column. */
export function describeResolution(bundle: PlanBundle | null, session: ImportSession): string {
  if (!bundle || !session.planDayId) return "Free work";
  const day = bundle.days.find((d) => d.id === session.planDayId);
  if (!day) return "Free work";
  const slot = slotIndex(bundle.plan, day);
  return isCyclePlan(bundle.plan) ? `Day ${slot} of the split` : `Week slot ${slot}`;
}
