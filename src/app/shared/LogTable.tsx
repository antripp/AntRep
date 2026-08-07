/**
 * The training log as a spreadsheet: exercises down the side, sessions across
 * the top, expandable into per-set rows. Notion-ish rows, Excel-ish grid.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDelta,
  formatSetCell,
  type ExerciseLogRow,
  type LogTable as LogTableData,
} from "../../domain/planLog";
import { Icon } from "../../ui/kit";

const NAME_WIDTH = 190;
// Wide enough for the compact set cell — "102.5kg×12" is the worst realistic case.
const COL_WIDTH = 88;

export function LogTable({
  table,
  onOpenExercise,
  emptyMessage = "Nothing logged in this view yet.",
}: {
  table: LogTableData;
  onOpenExercise?: (name: string) => void;
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  // Land on the most recent sessions, the way a spreadsheet opens at the end.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [table.columns.length]);

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allExpanded = expanded.size > 0 && expanded.size === table.rows.length;

  if (table.columns.length === 0 || table.rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
        <p className="text-sm font-semibold text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <p className="flex-1 text-[11px] font-bold text-muted">
          {table.rows.length} exercises · {table.columns.length} sessions · tap a row for every set
        </p>
        <button
          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-black text-muted"
          onClick={() =>
            setExpanded(allExpanded ? new Set() : new Set(table.rows.map((r) => r.key)))
          }
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div ref={scroller} className="overflow-x-auto">
        <table className="border-collapse text-left" style={{ minWidth: NAME_WIDTH + table.columns.length * COL_WIDTH }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 border-b border-r border-line px-3 py-2 text-[10px] font-black uppercase tracking-wide text-muted"
                style={{ width: NAME_WIDTH, minWidth: NAME_WIDTH, background: "var(--t-surface)" }}
              >
                Exercise
              </th>
              {table.columns.map((column) => (
                <th
                  key={column.sessionId}
                  title={column.tooltip}
                  className="cursor-help border-b border-line px-2 py-2 text-center text-[11px] font-black text-muted"
                  style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                >
                  S{column.index}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {table.rows.map((row, rowIndex) => (
              <ExerciseRows
                key={row.key}
                row={row}
                columns={table.columns}
                zebra={rowIndex % 2 === 1}
                expanded={expanded.has(row.key)}
                onToggle={() => toggle(row.key)}
                onOpen={onOpenExercise ? () => onOpenExercise(row.name) : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[10px] font-bold text-muted">
        <span>
          <span className="text-done">+%</span> / <span className="text-danger">−%</span> vs the previous
          session logged
        </span>
        <span>— first time logged</span>
        <span>-- not logged</span>
        <span className="hidden sm:inline">Hover a session for its date</span>
      </div>
    </div>
  );
}

function ExerciseRows({
  row,
  columns,
  zebra,
  expanded,
  onToggle,
  onOpen,
}: {
  row: ExerciseLogRow;
  columns: LogTableData["columns"];
  zebra: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  // The sticky column must be fully opaque or the grid scrolls under it.
  const rowBg = zebra
    ? "color-mix(in srgb, var(--t-inset) 45%, var(--t-surface))"
    : "var(--t-surface)";
  const trendColor =
    row.overallDelta === null
      ? "var(--t-muted)"
      : row.overallDelta > 0.02
        ? "var(--color-done)"
        : row.overallDelta < -0.02
          ? "var(--color-danger)"
          : "var(--t-muted)";

  return (
    <>
      <tr className="group" style={{ background: rowBg }}>
        <th
          scope="row"
          className="sticky left-0 z-10 border-b border-r border-line px-2 py-2 text-left align-top"
          style={{ width: NAME_WIDTH, minWidth: NAME_WIDTH, background: rowBg }}
        >
          <div className="flex items-start gap-1.5">
            <button
              onClick={onToggle}
              aria-label={expanded ? `Collapse ${row.name}` : `Expand ${row.name}`}
              aria-expanded={expanded}
              className="mt-0.5 shrink-0 text-muted transition group-hover:text-ink"
            >
              <Icon.chevron className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>

            <button onClick={onToggle} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-black text-ink">{row.name}</span>
              <span className="mt-0.5 flex items-center gap-1">
                <span className="text-[10px] font-black" style={{ color: trendColor }}>
                  {row.overallDelta === null ? "—" : formatDelta(row.overallDelta)}
                </span>
                <span className="truncate text-[10px] font-semibold text-muted">{row.remark}</span>
              </span>
            </button>

            {onOpen && (
              <button
                onClick={onOpen}
                aria-label={`Open ${row.name} analytics`}
                title="Open full analytics"
                className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <Icon.share className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </th>

        {row.cells.map((cell, i) => (
          <td
            key={cell.sessionId}
            title={
              cell.logged
                ? `${columns[i].tooltip} · ${cell.setCount} set${cell.setCount === 1 ? "" : "s"} · best ${
                    Math.round(cell.best * 10) / 10
                  }${row.unit}`
                : `${columns[i].tooltip} · not logged`
            }
            className={`border-b border-line px-1 py-2 text-center text-[12px] font-black ${
              cell.logged ? "" : "text-muted/40"
            }`}
            style={{
              width: COL_WIDTH,
              minWidth: COL_WIDTH,
              color: !cell.logged
                ? undefined
                : cell.delta === null
                  ? "var(--t-muted)"
                  : cell.delta > 0.001
                    ? "var(--color-done)"
                    : cell.delta < -0.001
                      ? "var(--color-danger)"
                      : "var(--t-ink)",
            }}
          >
            {cell.logged ? formatDelta(cell.delta) : "--"}
          </td>
        ))}
      </tr>

      {expanded &&
        row.setRows.map((setRow) => (
          <tr key={`${row.key}-set-${setRow.setNumber}`} style={{ background: rowBg }}>
            <th
              scope="row"
              className="sticky left-0 z-10 border-b border-r border-line py-1.5 pl-8 pr-2 text-left"
              style={{ width: NAME_WIDTH, minWidth: NAME_WIDTH, background: rowBg }}
            >
              <span className="text-[11px] font-bold text-muted">Set {setRow.setNumber}</span>
            </th>
            {setRow.cells.map((set, i) => (
              <td
                key={`${row.key}-${columns[i].sessionId}-${setRow.setNumber}`}
                title={set ? `${columns[i].tooltip} · set ${setRow.setNumber}` : undefined}
                className={`border-b border-line px-1 py-1.5 text-center text-[11px] font-bold ${
                  set ? "text-ink" : "text-muted/40"
                }`}
                style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
              >
                {set ? formatSetCell(set, row.logType, true) : "--"}
              </td>
            ))}
          </tr>
        ))}

      {expanded && row.maxSets === 0 && (
        <tr style={{ background: rowBg }}>
          <th
            scope="row"
            className="sticky left-0 z-10 border-b border-r border-line py-1.5 pl-8 pr-2 text-left"
            style={{ width: NAME_WIDTH, minWidth: NAME_WIDTH, background: rowBg }}
          >
            <span className="text-[11px] font-bold text-muted">No sets</span>
          </th>
          <td className="border-b border-line px-2 py-1.5 text-[11px] font-semibold text-muted" colSpan={columns.length}>
            Prescribed by the plan but never logged.
          </td>
        </tr>
      )}
    </>
  );
}

/** Sessions in scope, for the header line above the table. */
export function useLogTableSummary(table: LogTableData) {
  return useMemo(() => {
    const logged = table.rows.filter((r) => r.loggedSessions > 0);
    const improving = logged.filter((r) => (r.overallDelta ?? 0) > 0.02).length;
    const slipping = logged.filter((r) => (r.overallDelta ?? 0) < -0.02).length;
    return { tracked: logged.length, improving, slipping };
  }, [table]);
}
