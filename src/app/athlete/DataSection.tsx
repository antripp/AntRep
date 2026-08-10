/**
 * Your data — take it out, bring it in.
 *
 * Export and import live together on purpose: the workbook that goes out
 * carries the import template and its instructions, so "how do I get my old
 * spreadsheet in?" is answered by the same button that gets your data out.
 */

import { useState } from "react";
import { exportAthleteCsv, exportAthleteWorkbook, exportImportTemplate } from "../../domain/export";
import { plural } from "../../domain/text";
import { Button, Card, Icon, SectionHeader, Sheet } from "../../ui/kit";
import { ImportSheet } from "../shared/ImportSheet";
import { BatchLogSheet } from "../shared/BatchLogSheet";
import { useWorkspace } from "../workspace";

export function DataSection() {
  const { profile, sessions, logs, planViews, pastViews, importSessions, reload, showToast } = useWorkspace();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBatch, setShowBatch] = useState(false);

  const name = profile.display_name || "me";
  const batchViews = [...planViews, ...pastViews];

  return (
    <>
      <SectionHeader title="Your data" />
      <Card className="p-0">
        <button
          onClick={() => setShowBatch(true)}
          className="flex w-full items-center gap-3 border-b border-line p-3 text-left"
          disabled={batchViews.length === 0}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">Batch log a plan</p>
            <p className="text-xs font-semibold text-muted">
              {batchViews.length === 0
                ? "Sync or create a plan first"
                : "Edit scheduled days and sets in one grid"}
            </p>
          </div>
          <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex w-full items-center gap-3 border-b border-line p-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">Import training</p>
            <p className="text-xs font-semibold text-muted">
              Bring in past sessions from a spreadsheet
            </p>
          </div>
          <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="flex w-full items-center gap-3 p-3 text-left"
          disabled={sessions.length === 0}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">Export training</p>
            <p className="text-xs font-semibold text-muted">
              {sessions.length === 0
                ? "Nothing logged yet"
                : `${plural(sessions.length, "session")} as Excel or CSV`}
            </p>
          </div>
          <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
        </button>
      </Card>

      <Sheet open={showExport} onClose={() => setShowExport(false)} title="Export training">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted">
            The workbook also contains the import template and instructions, so you can edit it and
            bring it back in.
          </p>
          <Button
            full
            onClick={() => {
              exportAthleteWorkbook({ athleteName: name, sessions, logs });
              setShowExport(false);
              showToast("Workbook downloaded");
            }}
          >
            Excel workbook (.xlsx)
          </Button>
          <Button
            full
            variant="secondary"
            onClick={() => {
              exportAthleteCsv({ athleteName: name, sessions, logs });
              setShowExport(false);
              showToast("CSV downloaded");
            }}
          >
            Set-by-set CSV
          </Button>
          <Button
            full
            variant="secondary"
            onClick={() => {
              exportImportTemplate();
              setShowExport(false);
              showToast("Template downloaded");
            }}
          >
            Blank import template
          </Button>
        </div>
      </Sheet>

      <ImportSheet
        open={showImport}
        onClose={() => setShowImport(false)}
        bundles={planViews.map((view) => ({ bundle: view.bundle, start: view.start }))}
        existingSessions={sessions}
        onImport={importSessions}
        onToast={showToast}
      />

      <BatchLogSheet
        open={showBatch}
        onClose={() => setShowBatch(false)}
        athleteId={profile.id}
        plans={batchViews.map((view) => ({ bundle: view.bundle, start: view.start, end: view.end }))}
        sessions={sessions}
        logs={logs}
        onSaved={reload}
        onToast={showToast}
      />
    </>
  );
}
