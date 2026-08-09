/**
 * Excel / CSV reports. One workbook per athlete: every logged set, a per-exercise
 * summary, weekly check-ins and the assessment trackers.
 */

import { aoaToStyledSheet, XLSX } from "../lib/exportTheme";
import type { CoachingBoard, Session, SetLog } from "../data/types";
import { formatDuration } from "./dates";
import { elapsedSeconds, nameKey, setHasData, volumeOf } from "./logging";
import { exerciseStats } from "./analytics";

type Cell = string | number;

/** Title-case a custom field key for the header row: "band_colour" → "Band colour". */
function headerLabel(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function sessionRows(sessions: Session[], logs: SetLog[]): Cell[][] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  // Custom per-set fields become their own columns, like the coach's sheet.
  const extraKeys = [...new Set(logs.flatMap((l) => Object.keys(l.extra ?? {})))].sort();
  const rows: Cell[][] = [
    [
      "Date",
      "Session",
      "Exercise",
      "Set",
      "Weight (kg)",
      "Reps",
      "RPE",
      "Distance (km)",
      "Duration",
      "Volume (kg)",
      "Note",
      ...extraKeys.map(headerLabel),
    ],
  ];

  const ordered = [...logs]
    .filter((l) => byId.has(l.session_id))
    .sort((a, b) => {
      const sa = byId.get(a.session_id)!;
      const sb = byId.get(b.session_id)!;
      return sa.date === sb.date
        ? a.exercise_name.localeCompare(b.exercise_name) || a.set_index - b.set_index
        : sa.date.localeCompare(sb.date);
    });

  for (const log of ordered) {
    const session = byId.get(log.session_id)!;
    rows.push([
      session.date,
      session.day_title || "Workout",
      log.exercise_name,
      log.set_index,
      log.weight_kg ?? "",
      log.reps ?? "",
      log.rpe ?? "",
      log.distance_km ?? "",
      log.duration_sec ? formatDuration(log.duration_sec) : "",
      Math.round((log.weight_kg ?? 0) * (log.reps ?? 0)),
      log.note,
      ...extraKeys.map((key) => log.extra?.[key] ?? ""),
    ]);
  }
  return rows;
}

function summaryRows(sessions: Session[], logs: SetLog[]): Cell[][] {
  const stats = exerciseStats(sessions, logs);
  const rows: Cell[][] = [
    ["Exercise", "Sessions", "Sets", "Best", "Best est. 1RM (kg)", "Total volume (kg)", "Last logged", "Trend"],
  ];
  for (const stat of stats) {
    rows.push([
      stat.name,
      stat.sessions,
      stat.totalSets,
      Math.round(stat.best * 10) / 10,
      Math.round(stat.best1RM * 10) / 10,
      Math.round(stat.volume),
      stat.lastDate ?? "",
      stat.trend ? `${stat.trend > 0 ? "+" : ""}${Math.round(stat.trend * 100)}%` : "",
    ]);
  }
  return rows;
}

function sessionSummaryRows(sessions: Session[], logs: SetLog[]): Cell[][] {
  const rows: Cell[][] = [["Date", "Session", "Status", "Exercises", "Sets", "Volume (kg)", "Time"]];
  for (const session of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const sessionLogs = logs.filter((l) => l.session_id === session.id && setHasData(l));
    const duration = elapsedSeconds(session);
    rows.push([
      session.date,
      session.day_title || "Workout",
      session.status === "complete" ? "Complete" : "In progress",
      session.completed_names.length,
      sessionLogs.length,
      Math.round(volumeOf(sessionLogs)),
      duration > 0 ? formatDuration(duration) : "",
    ]);
  }
  return rows;
}

function checkInRows(board: CoachingBoard): Cell[][] {
  const rows: Cell[][] = [["Week", "Date", "Weight (kg)", "Sleep", "Energy", "Appetite", "Pain"]];
  for (const c of [...board.checkIns].sort((a, b) => a.week_index - b.week_index)) {
    rows.push([
      c.week_index,
      c.submitted_at.slice(0, 10),
      c.weight_kg ?? "",
      c.sleep,
      c.energy,
      c.appetite,
      c.pain,
    ]);
  }
  return rows;
}

function trackerRows(board: CoachingBoard): Cell[][] {
  const rows: Cell[][] = [];
  for (const template of board.templates) {
    rows.push([template.title, ...template.column_labels]);
    for (const metric of template.metrics) {
      rows.push([
        metric.unit ? `${metric.label} (${metric.unit})` : metric.label,
        ...template.column_labels.map(
          (_, column) =>
            board.entries.find(
              (e) => e.template_id === template.id && e.metric_key === metric.key && e.column_index === column,
            )?.value ?? "",
        ),
      ]);
    }
    rows.push([]);
  }
  return rows.length > 0 ? rows : [["No trackers"]];
}

function notesRows(board: CoachingBoard): Cell[][] {
  const rows: Cell[][] = [["Date", "Observation", "Adjustment", "Reason", "Next review"]];
  for (const note of board.notes) {
    rows.push([note.note_date, note.observation, note.adjustment, note.reason, note.next_review ?? ""]);
  }
  return rows;
}

/**
 * The importer's own columns, with worked examples.
 *
 * This sheet is the contract: whatever the athlete's old spreadsheet looks
 * like, getting it into these columns is the whole job. It ships inside the
 * export so the format arrives with the data rather than living in a docs page
 * nobody reads.
 */
export const IMPORT_COLUMNS = [
  "Date",
  "Day",
  "Session",
  "Exercise",
  "Set",
  "Weight (kg)",
  "Reps",
  "RPE",
  "Distance (km)",
  "Duration",
  "Note",
];

/**
 * The prompt handed to an AI assistant to reshape someone's own spreadsheet.
 *
 * Reshaping a sheet is exactly the tedious job an LLM does well, and most
 * people won't do it by hand. The rules that matter are the ones that stop it
 * being helpful in the wrong direction — above all, not inventing numbers that
 * were never recorded.
 */
export const IMPORT_PROMPT = [
  `Reshape my training spreadsheet into a CSV with exactly these columns: ${IMPORT_COLUMNS.join(", ")}.`,
  "Rules:",
  "- One row per set. If a row says '3x10 @ 60kg', expand it into 3 rows.",
  "- Date must be YYYY-MM-DD. Leave it blank if the sheet only says which workout",
  "  number it was, and fill Day and Session instead.",
  "- Day is the workout name, e.g. 'Pull day'. Session is which repeat of that day",
  "  it was, counting from 1.",
  "- Weight in kg. Convert from lbs by dividing by 2.2046 if needed.",
  "- RPE is 0-10, halves allowed. Leave blank if not recorded.",
  "- Duration as mm:ss. Distance in km.",
  "- Do not invent values. Leave a cell blank if the source doesn't say.",
  "- Output only the CSV, no commentary.",
].join("\n");

function importTemplateRows(): Cell[][] {
  return [
    IMPORT_COLUMNS,
    ["2026-07-01", "Pull day", 1, "Barbell row", 1, 60, 10, 7.5, "", "", "felt easy"],
    ["2026-07-01", "Pull day", 1, "Barbell row", 2, 62.5, 9, 8, "", "", ""],
    ["", "Pull day", 2, "Barbell row", 1, 65, 8, 8.5, "", "", "no date — 2nd pull day"],
    ["2026-07-04", "Run", 1, "Easy run", 1, "", "", 5, 5.2, "28:30", ""],
  ];
}

/**
 * Instructions, including a prompt to paste into an AI assistant.
 *
 * Reshaping a spreadsheet is exactly the sort of tedious job an LLM does well,
 * and most people won't do it by hand. Handing them the prompt with the file
 * removes the step where they have to work out what to ask for.
 */
function importGuideRows(): Cell[][] {
  return [
    ["Importing your training history into AntRep"],
    [],
    ["1. Put your data in the columns on the 'Import template' sheet."],
    ["2. Save as .xlsx or .csv."],
    ["3. In AntRep, open Import training and pick the file. You'll see a preview first."],
    [],
    ["Saying WHEN a session happened — either is fine:"],
    ["  Date", "A real date. Always wins if both are given. 2026-07-01 or 01/07/2026."],
    [
      "  Day + Session",
      "The plan day by name, and which repeat it was. 'Pull day' + 3 = the 3rd pull day, placed from the plan's start date.",
    ],
    [],
    ["Column names are matched loosely — 'Weight lifted (kg)' finds 'Weight (kg)'."],
    ["Duration accepts 28:30, 1:05:00, or a plain number of seconds."],
    ["One row per SET. Rows with no exercise name are ignored."],
    [],
    ["Prompt for an AI assistant — copy everything below into ChatGPT or Claude"],
    ["along with your own spreadsheet:"],
    [],
    ...IMPORT_PROMPT.split("\n").map((line) => [line] as Cell[]),
  ];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeName(name: string): string {
  return name.trim().replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "") || "athlete";
}

/** Multi-sheet .xlsx for one athlete. */
export function exportAthleteWorkbook({
  athleteName,
  sessions,
  logs,
  board,
}: {
  athleteName: string;
  sessions: Session[];
  logs: SetLog[];
  board?: CoachingBoard;
}) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(sessionSummaryRows(sessions, logs)), "Sessions");
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(sessionRows(sessions, logs)), "Set log");
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(summaryRows(sessions, logs)), "Exercises");
  if (board) {
    XLSX.utils.book_append_sheet(book, aoaToStyledSheet(checkInRows(board)), "Check-ins");
    XLSX.utils.book_append_sheet(book, aoaToStyledSheet(trackerRows(board)), "Trackers");
    XLSX.utils.book_append_sheet(book, aoaToStyledSheet(notesRows(board)), "Notes");
  }
  // The round trip: the same workbook that carries the data out describes how
  // to bring data back in.
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(importTemplateRows()), "Import template");
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(importGuideRows()), "How to import");

  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `antrep-${safeName(athleteName)}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

/** Flat set-by-set CSV — the same data as the "Set log" sheet. */
export function exportAthleteCsv({
  athleteName,
  sessions,
  logs,
}: {
  athleteName: string;
  sessions: Session[];
  logs: SetLog[];
}) {
  const rows = sessionRows(sessions, logs);
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");

  download(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `antrep-${safeName(athleteName)}-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

/**
 * Just the template and its instructions — for someone with nothing logged yet,
 * who has no export to take the format from.
 */
export function exportImportTemplate() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(importTemplateRows()), "Import template");
  XLSX.utils.book_append_sheet(book, aoaToStyledSheet(importGuideRows()), "How to import");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "antrep-import-template.xlsx",
  );
}

/** Exercises an athlete has logged, for a quick picker or report filter. */
export function loggedExerciseNames(logs: SetLog[]): string[] {
  return [...new Map(logs.map((l) => [nameKey(l.exercise_name), l.exercise_name])).values()].sort();
}
