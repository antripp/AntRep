/**
 * Spreadsheet import — pick a file, see exactly what it will do, then commit.
 *
 * The preview is the point. An importer that writes straight from the file is
 * a coin toss: the whole risk is a column being read as something it isn't, or
 * "session 3" landing on the wrong date. Showing the resolved sessions before
 * anything is written turns that risk into a glance.
 */

import { useMemo, useRef, useState } from "react";
import type { PlanBundle, Session } from "../../data/types";
import { formatShortDate } from "../../domain/dates";
import {
  buildImportPreview,
  describeResolution,
  parseRows,
  type ImportPreview,
  type ImportSession,
} from "../../domain/importLog";
import { exportImportTemplate, IMPORT_COLUMNS, IMPORT_PROMPT } from "../../domain/export";
import type { ImportOutcome } from "../../data/importWriter";
import { XLSX } from "../../lib/exportTheme";
import { plural } from "../../domain/text";
import { Button, Icon, Pill, Sheet } from "../../ui/kit";

type Stage = "pick" | "preview" | "working" | "done";

export function ImportSheet({
  open,
  onClose,
  bundles,
  existingSessions,
  onImport,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  /** Plans the rows can be resolved against; the first is the default. */
  bundles: { bundle: PlanBundle; start?: string | null }[];
  existingSessions: Session[];
  onImport: (
    batch: ImportSession[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<ImportOutcome>;
  onToast: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ReturnType<typeof parseRows> | null>(null);
  const [planIndex, setPlanIndex] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = bundles[planIndex] ?? null;

  // Re-resolved whenever the plan changes, so switching plans re-dates every
  // occurrence-based row without re-reading the file.
  const preview: ImportPreview | null = useMemo(() => {
    if (!rows) return null;
    return buildImportPreview({
      rows: rows.rows,
      bundle: chosen?.bundle ?? null,
      existingSessions,
      startOverride: chosen?.start ?? null,
    });
  }, [rows, chosen, existingSessions]);

  function reset() {
    setStage("pick");
    setRows(null);
    setFileName("");
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  }

  async function readFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      // `cellDates` makes SheetJS hand back real Dates for date-formatted cells
      // instead of Excel serial numbers.
      const book = XLSX.read(buffer, { cellDates: true });

      // Prefer a sheet that looks like the template; otherwise the first one.
      const sheetName =
        book.SheetNames.find((n) => /import|log|set|data/i.test(n)) ?? book.SheetNames[0];
      const sheet = book.Sheets[sheetName];
      if (!sheet) throw new Error("That file has no sheets in it.");

      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
      const parsed = parseRows(aoa as unknown[][]);

      if (Object.keys(parsed.columns).length === 0) {
        throw new Error(
          `Couldn't find the columns in "${sheetName}". It needs a header row with at least an Exercise column.`,
        );
      }
      if (parsed.rows.length === 0) {
        throw new Error(`"${sheetName}" has headers but no rows with an exercise name.`);
      }

      setFileName(file.name);
      setRows(parsed);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  async function commit() {
    if (!preview) return;
    setStage("working");
    setProgress({ done: 0, total: preview.sessions.length });
    try {
      const outcome = await onImport(preview.sessions, (done, total) => setProgress({ done, total }));
      setResult(outcome);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed partway through.");
      setStage("preview");
    }
  }

  const errors = preview?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = preview?.issues.filter((i) => i.level === "warning") ?? [];

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import training"
      wide
      footer={
        stage === "preview" && preview ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              Choose another file
            </Button>
            <Button full onClick={commit} disabled={preview.sessions.length === 0}>
              Import {plural(preview.sessions.length, "session")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <p className="mb-3 rounded-2xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</p>
      )}

      {stage === "pick" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted">
            Bring in past training from a spreadsheet — .xlsx or .csv. You'll see exactly what it
            will create before anything is saved.
          </p>

          <div className="rounded-2xl border border-line p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted">
              Columns it looks for
            </p>
            <p className="mt-1 text-xs font-bold text-ink">{IMPORT_COLUMNS.join(" · ")}</p>
            <p className="mt-2 text-[11px] font-semibold text-muted">
              Names are matched loosely. Either give a <b>Date</b>, or give <b>Day</b> + <b>Session</b>{" "}
              — "Pull day" + 3 lands on the 3rd pull day, counted from the plan's start date.
            </p>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset so picking the same file twice still fires a change.
              e.target.value = "";
              if (file) readFile(file);
            }}
          />

          <Button full onClick={() => fileInput.current?.click()}>
            <Icon.plus className="h-4 w-4" /> Choose a file
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportImportTemplate()}>
              Download the template
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(IMPORT_PROMPT);
                  onToast("Prompt copied — paste it into an AI assistant with your spreadsheet");
                } catch {
                  onToast("Couldn't copy — the prompt is on the template's 'How to import' sheet");
                }
              }}
            >
              Copy the AI prompt
            </Button>
          </div>

          <p className="text-[11px] font-semibold text-muted">
            Got your own spreadsheet in a different shape? Copy the prompt above, paste it into
            ChatGPT or Claude along with your file, and it will reshape it into these columns.
          </p>
        </div>
      )}

      {stage === "preview" && preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tint="var(--t-accent)">{fileName}</Pill>
            <Pill tint="var(--color-done)">{plural(preview.totalSets, "set")}</Pill>
            <Pill tint="var(--t-muted)">{plural(preview.sessions.length, "session")}</Pill>
          </div>

          {bundles.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-muted">
                Resolve day names against
              </p>
              <div className="flex flex-wrap gap-1.5">
                {bundles.map((option, index) => (
                  <button
                    key={option.bundle.plan.id}
                    onClick={() => setPlanIndex(index)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${
                      index === planIndex
                        ? "bg-accent text-white"
                        : "border border-line bg-surface text-muted"
                    }`}
                  >
                    {option.bundle.plan.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-2xl bg-danger/10 p-3">
              <p className="text-xs font-black text-danger">
                {plural(errors.length, "row")} couldn't be placed and will be skipped
              </p>
              <ul className="mt-1 space-y-0.5">
                {errors.slice(0, 5).map((issue, i) => (
                  <li key={i} className="text-[11px] font-semibold text-danger">
                    Row {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
              {errors.length > 5 && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  …and {errors.length - 5} more
                </p>
              )}
            </div>
          )}

          {warnings.length > 0 && (
            <details className="rounded-2xl border border-line p-3">
              <summary className="cursor-pointer text-xs font-black text-muted">
                {plural(warnings.length, "warning")}
              </summary>
              <ul className="mt-1.5 space-y-0.5">
                {warnings.slice(0, 10).map((issue, i) => (
                  <li key={i} className="text-[11px] font-semibold text-muted">
                    Row {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-muted">
              What will be created
            </p>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {preview.sessions.map((session) => (
                <div key={session.key} className="rounded-xl bg-inset px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-xs font-black text-ink">
                      {formatShortDate(session.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">
                      {session.dayTitle}
                    </span>
                    {session.existing && <Pill tint="#f5883b">updates existing</Pill>}
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted">
                    {plural(session.sets.length, "set")} ·{" "}
                    {describeResolution(chosen?.bundle ?? null, session)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === "working" && (
        <div className="py-8 text-center">
          <p className="text-sm font-black text-ink">
            Importing {progress.done} of {progress.total}…
          </p>
          <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-inset">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {stage === "done" && result && (
        <div className="space-y-3 py-4 text-center">
          <p className="text-lg font-black text-ink">
            Imported {plural(result.sessions, "session")}
          </p>
          <p className="text-sm font-semibold text-muted">{plural(result.sets, "set")} added.</p>
          {result.skipped > 0 && (
            <p className="text-xs font-semibold text-muted">
              {plural(result.skipped, "session")} skipped — already in the log.
            </p>
          )}
          {result.failed.length > 0 && (
            <div className="rounded-2xl bg-danger/10 p-3 text-left">
              <p className="text-xs font-black text-danger">
                {plural(result.failed.length, "session")} failed to save
              </p>
              <ul className="mt-1 space-y-0.5">
                {result.failed.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-[11px] font-semibold text-danger">
                    {f.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] font-semibold text-danger">
                Re-running the same file will retry these — anything already saved is skipped.
              </p>
            </div>
          )}
          <Button
            full
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      )}
    </Sheet>
  );
}
