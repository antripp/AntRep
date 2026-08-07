/**
 * Plans — the training log, drilled.
 *
 *   plans → sessions → one session, exercise by exercise
 *
 * The exercise × session grid rides alongside and always covers whatever level
 * you're on: every scoped session at the top, one plan's once you're inside it.
 * Picking a plan with the scope chip above drops you straight to its sessions.
 */

import { useMemo, useState } from "react";
import type { PlanBundle, Session, SetLog } from "../../data/types";
import { DAY_TYPE_COLORS } from "../../data/types";
import type { ExerciseStat } from "../../domain/analytics";
import { formatDuration, formatShortDate, isoWeekday, parseDate, weekdayLabel } from "../../domain/dates";
import { nameKey } from "../../domain/logging";
import { typeIcon } from "../../domain/plan";
import { buildLogTable } from "../../domain/planLog";
import {
  buildSessionRows,
  formatVolume,
  groupSessionsByPlan,
  FREE_WORK_ID,
  type PlanGroup,
  type SessionRow,
} from "../../domain/sessionTable";
import { plural } from "../../domain/text";
import { Sparkline } from "../../ui/charts";
import { Card, EmptyState, Icon, IconButton, IconTile, Pill, Segmented, StatTile } from "../../ui/kit";
import { LogTable, useLogTableSummary } from "../shared/LogTable";

export function PlansTab({
  sessions,
  logs,
  stats,
  plans,
  activeBundle,
  openPlanId,
  onOpenPlan,
  onOpenSession,
  onOpenExercise,
}: {
  sessions: Session[];
  logs: SetLog[];
  stats: ExerciseStat[];
  plans: PlanBundle[];
  activeBundle: PlanBundle | null;
  /** Drill state lives in the shell, so a session page can take the full screen. */
  openPlanId: string | null;
  onOpenPlan: (id: string | null) => void;
  onOpenSession: (id: string) => void;
  onOpenExercise: (key: string) => void;
}) {
  const [view, setView] = useState<"list" | "grid">("list");

  const rows = useMemo(() => buildSessionRows(sessions, logs, plans), [sessions, logs, plans]);
  const groups = useMemo(() => groupSessionsByPlan(rows, plans), [rows, plans]);

  // Scoped by chip, or drilled into by tapping a card — same destination.
  const planId = activeBundle ? activeBundle.plan.id : openPlanId;
  const group = planId ? (groups.find((g) => g.id === planId) ?? null) : null;

  const gridBundle = group?.bundle ?? activeBundle;
  const gridSessions = useMemo(
    () => (group ? group.rows.map((r) => r.session) : sessions),
    [group, sessions],
  );
  const table = useMemo(
    () => buildLogTable({ sessions: gridSessions, logs, bundle: gridBundle }),
    [gridSessions, logs, gridBundle],
  );
  const summary = useLogTableSummary(table);

  return (
    <>
      {group && (
        <PlanHeader
          group={group}
          summary={summary}
          onBack={activeBundle ? null : () => onOpenPlan(null)}
        />
      )}

      <div className="mb-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            {
              value: "list",
              label: group ? `Sessions (${group.sessions})` : `Plans (${groups.length})`,
            },
            { value: "grid", label: `Exercise grid (${table.rows.length})` },
          ]}
        />
      </div>

      {view === "grid" ? (
        <LogTable
          table={table}
          onOpenExercise={(name) => {
            const match = stats.find((s) => s.key === nameKey(name));
            if (match) onOpenExercise(match.key);
          }}
          emptyMessage={
            group
              ? "No sets logged against this plan yet."
              : "Log a few sets and they'll line up here session by session."
          }
        />
      ) : group ? (
        <SessionCards rows={group.rows} onOpen={(s) => onOpenSession(s.id)} />
      ) : (
        <PlanCards groups={groups} onOpen={onOpenPlan} />
      )}
    </>
  );
}

function PlanHeader({
  group,
  summary,
  onBack,
}: {
  group: PlanGroup;
  summary: { tracked: number; improving: number; slipping: number };
  onBack: (() => void) | null;
}) {
  return (
    <Card className="mb-3">
      <div className="mb-3 flex items-center gap-2">
        {onBack && (
          <IconButton label="Back to plans" onClick={onBack}>
            <Icon.back className="h-4 w-4" />
          </IconButton>
        )}
        <IconTile emoji={group.id === FREE_WORK_ID ? "✨" : "📋"} tint="var(--t-accent)" size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-ink">{group.name}</p>
          <p className="truncate text-xs font-bold text-muted">
            {group.bundle
              ? `${plural(group.bundle.plan.weeks, "week")} · ${plural(
                  group.bundle.exercises.length,
                  "exercise",
                )} prescribed`
              : "Logged outside any plan"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile value={String(group.sessions)} label="sessions" />
        <StatTile value={String(group.sets)} label="sets" />
        <StatTile value={String(summary.improving)} label="improving" />
        <StatTile value={String(summary.slipping)} label="slipping" />
      </div>
    </Card>
  );
}

function PlanCards({
  groups,
  onOpen,
}: {
  groups: PlanGroup[];
  onOpen: (id: string) => void;
}) {
  if (groups.length === 0) {
    return <EmptyState title="No plans trained yet" subtitle="Log a session and its plan appears here." />;
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        // Oldest first, so the trend reads left to right like every other chart.
        const trend = [...group.rows].reverse().map((r) => r.volume);
        return (
          <Card key={group.id} onClick={() => onOpen(group.id)}>
            <div className="flex items-center gap-3">
              <IconTile
                emoji={group.id === FREE_WORK_ID ? "✨" : "📋"}
                tint="var(--t-accent)"
                size={38}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">{group.name}</p>
                <p className="truncate text-xs font-bold text-muted">
                  {plural(group.sessions, "session")} · {plural(group.sets, "set")}
                  {group.volume > 0 && ` · ${formatVolume(group.volume)}`}
                </p>
                <p className="truncate text-[11px] font-semibold text-muted">
                  {group.firstDate === group.lastDate
                    ? formatShortDate(group.lastDate)
                    : `${formatShortDate(group.firstDate)} – ${formatShortDate(group.lastDate)}`}
                  {group.distanceKm > 0 && ` · ${group.distanceKm} km`}
                </p>
              </div>
              {trend.some((v) => v > 0) && <Sparkline values={trend} width={54} height={22} />}
              <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SessionCards({
  rows,
  onOpen,
}: {
  rows: SessionRow[];
  onOpen: (session: Session) => void;
}) {
  const [visible, setVisible] = useState(20);

  if (rows.length === 0) {
    return <EmptyState title="No sessions here" subtitle="Nothing has been logged against this plan." />;
  }

  return (
    <>
      <div className="space-y-2">
        {rows.slice(0, visible).map((row) => {
          const tint = DAY_TYPE_COLORS[row.session.day_type] ?? "var(--t-accent)";
          return (
            <Card key={row.session.id} onClick={() => onOpen(row.session)}>
              <div className="flex items-center gap-3">
                <IconTile emoji={typeIcon(row.session.day_type)} tint={tint} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{row.title}</p>
                  <p className="truncate text-xs font-bold text-muted">
                    {weekdayLabel(isoWeekday(parseDate(row.date)), true)} {formatShortDate(row.date)} ·{" "}
                    {plural(row.exercises, "exercise")} · {plural(row.sets, "set")}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-muted">
                    {row.volume > 0 && formatVolume(row.volume)}
                    {row.volume > 0 && row.distanceKm > 0 && " · "}
                    {row.distanceKm > 0 && `${row.distanceKm} km`}
                    {(row.volume > 0 || row.distanceKm > 0) && row.durationSec > 0 && " · "}
                    {row.durationSec > 0 && formatDuration(row.durationSec)}
                  </p>
                </div>
                {row.session.status === "complete" && <Pill tint={tint}>Done</Pill>}
                {!row.session.shared_with_coach && <Pill tint="var(--t-muted)">Private</Pill>}
                <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
              </div>
            </Card>
          );
        })}
      </div>

      {visible < rows.length && (
        <button
          className="mt-3 w-full rounded-full border border-line bg-surface py-2.5 text-xs font-black text-ink"
          onClick={() => setVisible((v) => v + 20)}
        >
          Show older sessions ({rows.length - visible} more)
        </button>
      )}
    </>
  );
}
