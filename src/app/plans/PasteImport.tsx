/**
 * Paste-from-Excel import. Excel and Sheets put tab-separated text on the
 * clipboard, so pasting into the box gives us rows; columns are guessed from
 * the header and can be re-mapped before importing.
 */

import { useMemo, useState } from "react";
import type { PlanExercise } from "../../data/types";
import { makeExercise } from "../../data/factories";
import { Button, Field, Sheet } from "../../ui/kit";

const TARGETS = ["ignore", "name", "sets", "reps", "weight_kg", "rest_sec", "notes"] as const;
type Target = (typeof TARGETS)[number];

const TARGET_LABELS: Record<Target, string> = {
  ignore: "— ignore —",
  name: "Exercise",
  sets: "Sets",
  reps: "Reps",
  weight_kg: "Weight (kg)",
  rest_sec: "Rest (sec)",
  notes: "Notes",
};

function parseGrid(text: string): string[][] {
  const separator = text.includes("\t") ? "\t" : ",";
  return text
    .split(/\r?\n/)
    .map((line) => line.split(separator).map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function guessTarget(header: string): Target {
  const h = header.toLowerCase();
  if (/exercise|movement|lift|name/.test(h)) return "name";
  if (/set/.test(h)) return "sets";
  if (/rep/.test(h)) return "reps";
  if (/weight|kg|load/.test(h)) return "weight_kg";
  if (/rest|pause/.test(h)) return "rest_sec";
  if (/note|comment|cue/.test(h)) return "notes";
  return "ignore";
}

/** First number in cells like "3x10", "10-12" or "60 kg". */
function firstNumber(cell: string): number {
  const match = cell.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function PasteImport({
  dayId,
  segmentId,
  startSortOrder,
  onImport,
  onClose,
}: {
  dayId: string;
  segmentId: string | null;
  startSortOrder: number;
  onImport: (exercises: PlanExercise[]) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Target[] | null>(null);

  const grid = useMemo(() => parseGrid(raw), [raw]);
  const columns = grid[0]?.length ?? 0;

  const targets = useMemo<Target[]>(() => {
    if (mapping && mapping.length === columns) return mapping;
    if (columns === 0) return [];
    const guessed = hasHeader
      ? grid[0].map(guessTarget)
      : (["name", "sets", "reps", "weight_kg"] as Target[]).slice(0, columns);
    while (guessed.length < columns) guessed.push("ignore");
    // Nothing recognised as the exercise name → assume the first column is it.
    if (!guessed.includes("name")) guessed[0] = "name";
    return guessed;
  }, [grid, columns, hasHeader, mapping]);

  const rows = hasHeader ? grid.slice(1) : grid;

  const parsed = useMemo(
    () =>
      rows
        .map((row) => {
          const get = (target: Target) => row[targets.indexOf(target)] ?? "";
          const name = get("name").trim();
          if (!name) return null;
          return {
            name,
            sets: firstNumber(get("sets")) || 3,
            reps: firstNumber(get("reps")) || 10,
            weight: firstNumber(get("weight_kg")),
            rest: firstNumber(get("rest_sec")) || 90,
            notes: get("notes"),
            scheme: get("sets") && get("reps") ? `${get("sets")} x ${get("reps")}` : "",
          };
        })
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [rows, targets],
  );

  function importRows() {
    onImport(
      parsed.map((row, index) =>
        makeExercise(dayId, row.name, {
          plan_segment_id: segmentId,
          sort_order: startSortOrder + index,
          target_sets: row.sets,
          target_reps: row.reps,
          target_weight_kg: row.weight,
          rest_sec: row.rest,
          trainer_notes: row.notes,
          rep_scheme: row.scheme,
        }),
      ),
    );
  }

  return (
    <Sheet open onClose={onClose} title="Paste from Excel" wide>
      <Field label="Paste rows" hint="Copy the cells in Excel or Sheets, then paste here">
        <textarea
          autoFocus
          rows={6}
          value={raw}
          placeholder={"Exercise\tSets\tReps\tWeight\nBench press\t3\t10\t60"}
          onChange={(e) => {
            setRaw(e.target.value);
            setMapping(null);
          }}
          className="w-full rounded-2xl border border-line bg-inset p-3 text-sm font-bold text-ink outline-none focus:border-accent"
        />
      </Field>

      {columns > 0 && (
        <>
          <label className="mb-3 flex items-center gap-2 text-xs font-bold text-muted">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                setMapping(null);
              }}
            />
            First row is a header
          </label>

          <div className="mb-3 flex flex-wrap gap-2">
            {targets.map((target, index) => (
              <label key={index} className="text-[11px] font-black uppercase text-muted">
                <span className="mb-1 block truncate">
                  {hasHeader ? grid[0][index] || `Col ${index + 1}` : `Col ${index + 1}`}
                </span>
                <select
                  value={target}
                  onChange={(e) => {
                    const next = [...targets];
                    next[index] = e.target.value as Target;
                    setMapping(next);
                  }}
                  className="h-9 rounded-xl border border-line bg-inset px-2 text-xs font-bold text-ink"
                >
                  {TARGETS.map((option) => (
                    <option key={option} value={option}>
                      {TARGET_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="max-h-48 overflow-auto rounded-2xl border border-line">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-inset">
                  <th className="p-2 font-black text-muted">Exercise</th>
                  <th className="p-2 font-black text-muted">Sets</th>
                  <th className="p-2 font-black text-muted">Reps</th>
                  <th className="p-2 font-black text-muted">Weight</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 12).map((row, i) => (
                  <tr key={`${row.name}-${i}`} className="border-t border-line">
                    <td className="p-2 font-bold text-ink">{row.name}</td>
                    <td className="p-2 font-semibold text-muted">{row.sets}</td>
                    <td className="p-2 font-semibold text-muted">{row.reps}</td>
                    <td className="p-2 font-semibold text-muted">{row.weight || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Button full className="mt-4" disabled={parsed.length === 0} onClick={importRows}>
        Import {parsed.length > 0 ? `${parsed.length} exercise${parsed.length === 1 ? "" : "s"}` : ""}
      </Button>
    </Sheet>
  );
}
