import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button, Modal, Select } from "../../components/ui";

/**
 * Paste-from-Excel importer. Excel/Sheets put tab-separated text on the
 * clipboard, so pasting into the textarea gives us rows to map. The coach
 * assigns a meaning to each column, previews, and imports.
 */
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

function parseClipboard(text: string): string[][] {
  const sep = text.includes("\t") ? "\t" : ",";
  return text
    .split(/\r?\n/)
    .map((line) => line.split(sep).map((c) => c.trim()))
    .filter((row) => row.some((c) => c.length > 0));
}

/** Guess a column's meaning from its header text. */
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

/** Pull the first number out of cells like "3x10", "10-12" or "60 kg". */
function firstNumber(cell: string): number {
  const m = cell.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export default function PasteGrid({
  dayId,
  nextSortOrder,
  onDone,
  onCancel,
}: {
  dayId: string;
  nextSortOrder: number;
  onDone: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Target[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => parseClipboard(raw), [raw]);
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const header = hasHeader ? rows[0] : undefined;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  // (Re)initialise the mapping when the pasted shape changes.
  const effectiveMapping: Target[] = useMemo(() => {
    if (mapping.length === width) return mapping;
    return Array.from({ length: width }, (_, i) => {
      if (header?.[i]) return guessTarget(header[i]);
      return i === 0 ? "name" : i === 1 ? "sets" : i === 2 ? "reps" : i === 3 ? "weight_kg" : "ignore";
    });
  }, [mapping, width, header]);

  const preview = useMemo(() => {
    return dataRows
      .map((row) => {
        const out = { name: "", sets: 3, reps: 10, weight_kg: 0, rest_sec: 0, notes: "" };
        row.forEach((cell, i) => {
          const target = effectiveMapping[i];
          if (target === "name") out.name = cell;
          else if (target === "notes") out.notes = cell;
          else if (target !== "ignore" && cell) out[target] = firstNumber(cell);
        });
        return out;
      })
      .filter((r) => r.name.length > 0);
  }, [dataRows, effectiveMapping]);

  async function importRows() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("plan_exercises").insert(
      preview.map((r, i) => ({
        plan_day_id: dayId,
        name: r.name,
        target_sets: Math.max(1, Math.round(r.sets)),
        target_reps: Math.max(1, Math.round(r.reps)),
        target_weight_kg: r.weight_kg,
        rest_sec: Math.round(r.rest_sec),
        trainer_notes: r.notes,
        sort_order: nextSortOrder + i,
      })),
    );
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await onDone();
  }

  return (
    <Modal title="Paste from Excel" onClose={onCancel} wide>
      <p className="mb-3 text-xs font-semibold text-muted">
        Copy the exercise rows in your sheet (Ctrl/Cmd+C), then paste below (Ctrl/Cmd+V).
      </p>

      <textarea
          className="mb-2 h-28 w-full rounded-xl border-2 border-line bg-inset p-3 font-mono text-xs text-ink outline-none focus:border-accent"
          placeholder={"Bench press\t3\t10\t60\nIncline DB press\t3\t12\t22.5"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      <label className="mb-3 flex items-center gap-2 text-xs font-bold text-muted">
        <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
        First row is a header
      </label>

      {rows.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {Array.from({ length: width }, (_, i) => (
                  <th key={i} className="p-1">
                    <Select
                      className="w-full px-1 py-1 text-[11px]"
                      value={effectiveMapping[i]}
                      onChange={(v) => {
                        const next = [...effectiveMapping];
                        next[i] = v as Target;
                        setMapping(next);
                      }}
                      options={TARGETS.map((t) => ({ value: t, label: TARGET_LABELS[t] }))}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.slice(0, 8).map((row, ri) => (
                <tr key={ri} className="border-t-2 border-line">
                  {Array.from({ length: width }, (_, ci) => (
                    <td key={ci} className="truncate p-1 font-semibold">
                      {row[ci] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {dataRows.length > 8 && (
            <p className="mt-1 text-[11px] font-bold text-muted">…and {dataRows.length - 8} more rows</p>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs font-bold text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={importRows} disabled={busy || preview.length === 0}>
          {busy ? "…" : `Import ${preview.length} exercise${preview.length === 1 ? "" : "s"}`}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
