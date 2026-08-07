import { aoaToStyledSheet, getExportTheme, XLSX } from "./exportTheme";
import { formatMetricValue, weekLabel, type ProgressionGridRow } from "./progression";
import type {
  AthleteProgram,
  CheckIn,
  CoachNote,
  CustomField,
  ProgressionMetric,
  Session,
  SetLog,
  TrackerEntry,
  TrackerTemplate,
} from "./types";
import type { ClientProfileData } from "./trackers";
import { MEDICAL_FIELDS, RESTRICTION_FIELDS } from "./trackers";

export interface ExportColumn {
  key: string;
  label: string;
  value: (session: Session, set: SetLog) => string | number;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function buildColumns(customFields: CustomField[]): ExportColumn[] {
  const base: ExportColumn[] = [
    { key: "date", label: "Date", value: (s) => s.date },
    { key: "session", label: "Session", value: (s) => s.day_title },
    { key: "exercise", label: "Exercise", value: (_s, l) => l.exercise_name },
    { key: "set", label: "Set", value: (_s, l) => l.set_index },
    { key: "weight_kg", label: "Weight (kg)", value: (_s, l) => l.weight_kg ?? "" },
    { key: "reps", label: "Reps", value: (_s, l) => l.reps ?? "" },
    {
      key: "volume_kg",
      label: "Volume (kg)",
      value: (_s, l) => (l.weight_kg != null && l.reps != null ? l.weight_kg * l.reps : ""),
    },
    { key: "rpe", label: "RPE", value: (_s, l) => l.rpe ?? "" },
    { key: "pain", label: "Pain", value: (_s, l) => l.pain ?? "" },
    { key: "distance_km", label: "Distance (km)", value: (_s, l) => l.distance_km ?? "" },
    {
      key: "duration",
      label: "Duration",
      value: (_s, l) => (l.duration_sec != null ? formatDuration(l.duration_sec) : ""),
    },
    { key: "calories", label: "Calories", value: (_s, l) => l.calories ?? "" },
    { key: "note", label: "Notes", value: (_s, l) => l.note },
  ];
  const custom: ExportColumn[] = customFields.map((f) => ({
    key: `extra.${f.key}`,
    label: f.unit ? `${f.label} (${f.unit})` : f.label,
    value: (_s, l) => l.extra?.[f.key] ?? "",
  }));
  return [...base, ...custom];
}

/** Order/filter columns by the coach's saved layout; empty layout = all columns. */
export function applyLayout(columns: ExportColumn[], layout: string[]): ExportColumn[] {
  if (layout.length === 0) return columns;
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const picked = layout.map((k) => byKey.get(k)).filter((c): c is ExportColumn => Boolean(c));
  return picked.length > 0 ? picked : columns;
}

export interface SessionExport {
  session: Session;
  sets: SetLog[];
}

function setsRows(data: SessionExport[], columns: ExportColumn[]): (string | number)[][] {
  const rows: (string | number)[][] = [columns.map((c) => c.label)];
  for (const { session, sets } of data) {
    const ordered = [...sets].sort(
      (a, b) => a.exercise_name.localeCompare(b.exercise_name) || a.set_index - b.set_index,
    );
    for (const set of ordered) rows.push(columns.map((c) => c.value(session, set)));
  }
  return rows;
}

function summaryRows(data: SessionExport[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Date", "Session", "Exercises", "Sets", "Total volume (kg)", "Total distance (km)", "Duration", "Calories"],
  ];
  for (const { session, sets } of data) {
    const exercises = new Set(sets.map((s) => s.exercise_name)).size;
    const volume = sets.reduce((acc, s) => acc + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
    const distance = sets.reduce((acc, s) => acc + (s.distance_km ?? 0), 0);
    const duration =
      session.ended_at != null
        ? formatDuration(
            Math.max(
              0,
              Math.round(
                (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000,
              ),
            ),
          )
        : "";
    rows.push([
      session.date,
      session.day_title,
      exercises,
      sets.length,
      Math.round(volume),
      Number(distance.toFixed(2)),
      duration,
      session.calories ?? "",
    ]);
  }
  return rows;
}

export function exportXlsx(data: SessionExport[], columns: ExportColumn[], filename: string) {
  const theme = getExportTheme();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aoaToStyledSheet(summaryRows(data), theme), "Summary");
  XLSX.utils.book_append_sheet(wb, aoaToStyledSheet(setsRows(data, columns), theme), "Sets");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportCsv(data: SessionExport[], columns: ExportColumn[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(setsRows(data, columns));
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface WarriorExportData {
  athleteName: string;
  coachName: string;
  program: Pick<AthleteProgram, "goals" | "duration_weeks" | "start_date" | "assessment_date">;
  grid: ProgressionGridRow[];
  checkIns: CheckIn[];
  coachNotes: CoachNote[];
  metric: ProgressionMetric;
  clientProfile?: ClientProfileData;
  templates?: TrackerTemplate[];
  trackerEntries?: TrackerEntry[];
}

/** Full multi-sheet export matching the Warrior Training Systems workbook layout. */
export function exportWarriorWorkbook(data: WarriorExportData) {
  const theme = getExportTheme();
  const wb = XLSX.utils.book_new();
  const { athleteName, coachName, program } = data;

  // Dashboard
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Dashboard"],
      [],
      ["Client", athleteName],
      ["Coach", coachName],
      ["Duration", `${program.duration_weeks} Weeks`],
      ["Goal", program.goals],
      ["Assessment Date", program.assessment_date ?? ""],
    ]),
    "Dashboard",
  );

  // Client Profile
  const cp = data.clientProfile ?? {};
  const profileRows: (string | number)[][] = [["Client Profile"], [], ["Field", "Details"]];
  if (cp.age) profileRows.push(["Age", cp.age]);
  if (cp.height) profileRows.push(["Height", cp.height]);
  if (cp.phone) profileRows.push(["Phone", cp.phone]);
  if (cp.doctor_clearance) profileRows.push(["Doctor clearance", cp.doctor_clearance]);
  profileRows.push([]);
  profileRows.push(["MEDICAL HISTORY"]);
  profileRows.push(["Condition", "Status"]);
  for (const f of MEDICAL_FIELDS) {
    const v = cp.medical_history?.[f.key];
    if (v) profileRows.push([f.label, v]);
  }
  profileRows.push([]);
  profileRows.push(["RESTRICTION"]);
  for (const f of RESTRICTION_FIELDS) {
    const v = cp.restrictions?.[f.key];
    if (v) profileRows.push([f.label, v]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(profileRows), "Client Profile");

  // Tracker sheets
  const sheetNames: Record<string, string> = {
    body_assessment: "Body Assessment",
    mobility_pain: "Mobility & Pain",
    flexibility: "Flexibility",
    cardio: "Cardio Tracker",
  };
  for (const tpl of data.templates ?? []) {
    const entryMap = new Map(
      (data.trackerEntries ?? [])
        .filter((e) => e.template_id === tpl.id)
        .map((e) => [`${e.metric_key}::${e.column_index}`, e.value]),
    );
    const rows = tpl.metrics.map((m) => [
      m.label,
      ...tpl.column_labels.map((_, i) => entryMap.get(`${m.key}::${i + 1}`) ?? ""),
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      aoaToStyledSheet(
        [
          ["Measurement", ...tpl.column_labels],
          ...rows,
        ],
        theme,
      ),
      sheetNames[tpl.kind] ?? tpl.title,
    );
  }

  // Progressive Overload
  if (data.grid.length > 0) {
    const weekCount = data.grid[0].cells.length;
    const header = ["Exercise", ...Array.from({ length: weekCount }, (_, i) => weekLabel(i + 1))];
    const rows = data.grid.map((r) => [
      r.exerciseName,
      ...r.cells.map((c) => formatMetricValue(c.value, data.metric)),
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      aoaToStyledSheet([header, ...rows], theme),
      "Progressive Overload",
    );
  }

  // Check-Ins
  XLSX.utils.book_append_sheet(
    wb,
    aoaToStyledSheet(
      [
        ["Week", "weight", "Sleep", "Energy", "Appetite", "Pain"],
        ...data.checkIns.map((c) => [c.week_index, c.weight_kg ?? "", c.sleep, c.energy, c.appetite, c.pain]),
      ],
      theme,
    ),
    "Weekly Check-In",
  );

  // Coach Notes
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Date", "Observation", "Adjustment", "Reason", "Next review"],
      ...data.coachNotes.map((n) => [n.note_date, n.observation, n.adjustment, n.reason, n.next_review ?? ""]),
    ]),
    "Coach Notes",
  );

  XLSX.writeFile(wb, `warrior_${athleteName.replace(/\s+/g, "-")}.xlsx`);
}

/** @deprecated Use exportWarriorWorkbook for full workbook */
export function exportProgressBundle(
  athleteName: string,
  grid: ProgressionGridRow[],
  checkIns: CheckIn[],
  coachNotes: CoachNote[],
  metric: ProgressionMetric,
) {
  exportWarriorWorkbook({
    athleteName,
    coachName: "",
    program: { goals: "", duration_weeks: grid[0]?.cells.length ?? 12, start_date: null, assessment_date: null },
    grid,
    checkIns,
    coachNotes,
    metric,
  });
}
