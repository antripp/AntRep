import * as XLSX from "xlsx";
import type { CustomField, Session, SetLog } from "./types";

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
    { key: "distance_km", label: "Distance (km)", value: (_s, l) => l.distance_km ?? "" },
    {
      key: "duration",
      label: "Duration",
      value: (_s, l) => (l.duration_sec != null ? formatDuration(l.duration_sec) : ""),
    },
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
    ["Date", "Session", "Exercises", "Sets", "Total volume (kg)", "Total distance (km)", "Duration"],
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
    ]);
  }
  return rows;
}

export function exportXlsx(data: SessionExport[], columns: ExportColumn[], filename: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows(data)), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(setsRows(data, columns)), "Sets");
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
