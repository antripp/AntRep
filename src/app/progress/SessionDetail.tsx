/**
 * One session, full page — the mirror of the exercise page: header stats, then
 * every movement as a table row that expands into its individual sets.
 *
 * Arrows and a date search step through the sessions either side of this one,
 * the same way the home screen steps through days.
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import type { PlanBundle, Session, SetLog } from "../../data/types";
import { DAY_TYPE_COLORS } from "../../data/types";
import { formatDuration, formatShortDate, isoWeekday, parseDate, weekdayLabel } from "../../domain/dates";
import { setHasData } from "../../domain/logging";
import { typeIcon } from "../../domain/plan";
import { formatDelta, formatSetCell } from "../../domain/planLog";
import { buildSessionDetail, formatVolume, type SessionExerciseRow } from "../../domain/sessionTable";
import { buildContextSignals } from "../../domain/progressionDetail";
import { plural } from "../../domain/text";
import { BarChart } from "../../ui/charts";
import {
  Button,
  ActionDialog,
  Card,
  Field,
  Icon,
  IconButton,
  IconTile,
  Pill,
  SectionHeader,
  Sheet,
  StatTile,
  TextField,
} from "../../ui/kit";
import { MetricTrendGrid } from "./MetricTrendGrid";
import type { ProgressPlanRun } from "../../domain/consistency";

export function SessionDetail({
  session,
  sessions,
  logs,
  bundle,
  siblings,
  onSelectSession,
  onBack,
  onOpenExercise,
  onClearSession,
  onClearExercise,
  onEditSession,
  weeklyGoal,
  planRuns,
}: {
  session: Session;
  /** The whole scope — the "vs last time" column reads back through it. */
  sessions: Session[];
  logs: SetLog[];
  bundle: PlanBundle | null;
  /** Sessions to step through with the arrows, newest first. */
  siblings: Session[];
  onSelectSession: (id: string) => void;
  onBack: () => void;
  onOpenExercise: (key: string) => void;
  onClearSession?: (session: Session) => Promise<void>;
  onClearExercise?: (session: Session, exerciseName: string) => Promise<void>;
  onEditSession?: (session: Session) => void;
  weeklyGoal: number;
  planRuns: ProgressPlanRun[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [clearTarget, setClearTarget] = useState<
    { kind: "session" } | { kind: "exercise"; name: string } | null
  >(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // A different session is a different table — don't carry rows open into it.
  useEffect(() => setExpanded(new Set()), [session.id]);

  const detail = useMemo(
    () => buildSessionDetail({ session, sessions, logs, bundle }),
    [session, sessions, logs, bundle],
  );
  const signals = useMemo(() => buildContextSignals([session], logs), [session, logs]);

  const tint = DAY_TYPE_COLORS[session.day_type] ?? "var(--t-accent)";
  const allExpanded = expanded.size > 0 && expanded.size === detail.rows.length;

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function confirmClear() {
    if (!clearTarget || clearing) return;
    setClearing(true);
    setClearError(null);
    try {
      if (clearTarget.kind === "session") {
        await onClearSession?.(session);
        onBack();
      } else {
        await onClearExercise?.(session, clearTarget.name);
        setExpanded((current) => {
          const next = new Set(current);
          next.delete(clearTarget.name.trim().toLowerCase());
          return next;
        });
      }
    } catch (error) {
      setClearError(error instanceof Error ? error.message : "Couldn't clear that training data.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="Back to sessions" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <IconTile emoji={typeIcon(session.day_type)} tint={tint} size={36} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black leading-tight text-ink">
            {session.day_title || "Workout"}
          </h1>
          <p className="truncate text-xs font-bold text-muted">
            {weekdayLabel(isoWeekday(parseDate(session.date)), true)} {formatShortDate(session.date)}
            {detail.planName && ` · ${detail.planName}`}
            {session.is_late_completion && " · late log"}
          </p>
        </div>
        {session.status === "complete" ? (
          <Pill tint={tint}>Done</Pill>
        ) : (
          <Pill tint="var(--t-muted)">Open</Pill>
        )}
        {onClearSession && (
          <IconButton label="Clear logged session" onClick={() => setClearTarget({ kind: "session" })}>
            <Icon.trash className="h-4 w-4 text-danger" />
          </IconButton>
        )}
        {onEditSession && (
          <IconButton label="Edit logged data" onClick={() => onEditSession(session)}>
            <Icon.edit className="h-4 w-4 text-accent" />
          </IconButton>
        )}
      </div>

      {clearError && (
        <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger">
          {clearError}
        </p>
      )}

      <div className="mb-3">
        <SessionSwitcher
          session={session}
          siblings={siblings}
          logs={logs}
          onSelect={onSelectSession}
        />
      </div>

      <Card className="mb-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={String(detail.totals.exercises)} label="exercises" />
          <StatTile value={String(detail.totals.sets)} label="sets" />
          {/* A pure cardio session has no volume worth a tile — show the distance instead. */}
          {detail.totals.volume === 0 && detail.totals.distanceKm > 0 ? (
            <StatTile value={String(detail.totals.distanceKm)} label="km" />
          ) : (
            <StatTile value={Math.round(detail.totals.volume).toLocaleString()} label="kg total work" />
          )}
          <StatTile
            value={detail.totals.durationSec > 0 ? formatDuration(detail.totals.durationSec) : "—"}
            label="time"
          />
        </div>
        {(detail.totals.reps > 0 || (detail.totals.volume > 0 && detail.totals.distanceKm > 0)) && (
          <p className="mt-2 text-center text-[11px] font-bold text-muted">
            {detail.totals.reps > 0 && `${detail.totals.reps} reps`}
            {detail.totals.reps > 0 && detail.totals.distanceKm > 0 && " · "}
            {detail.totals.distanceKm > 0 && `${detail.totals.distanceKm} km`}
          </p>
        )}
      </Card>

      <Card className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-muted">Session signals</p>
            <p className="mt-1 text-sm font-black leading-snug text-ink">{signals.takeaway}</p>
          </div>
          <Pill tint={tint}>{signals.stability}/100 stable</Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={signals.retention === null ? "—" : `${Math.round(signals.retention * 100)}%`} label="later-set strength kept" />
          <StatTile value={signals.qualityShare === null ? "—" : `${Math.round(signals.qualityShare * 100)}%`} label="manageable sets" />
          <StatTile value={signals.avgRpe === null ? "—" : `${signals.avgRpe.toFixed(1)}/10`} label="average effort" />
          <StatTile value={signals.density === null ? "—" : signals.density.toFixed(2)} label="work rate" />
        </div>
        {signals.exerciseRetention.length > 1 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted">Later-set output by exercise</p>
            <BarChart
              data={signals.exerciseRetention.map((entry) => ({
                label: entry.name.split(" ")[0],
                value: Math.round(entry.retention * 100),
                detail: `${entry.name} · ${entry.sets} sets`,
              }))}
              color={tint}
              height={118}
              format={(value) => `${Math.round(value)}%`}
              goal={90}
              goalLabel="strong later sets"
            />
          </div>
        )}
      </Card>

      <MetricTrendGrid
        sessions={sessions}
        logs={logs}
        weeklyGoal={weeklyGoal}
        today={parseDate(session.date)}
        title="Metric trends into this session"
        planRuns={planRuns}
      />

      {session.athlete_notes && (
        <Card className="mb-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">Notes</p>
          <p className="mt-1 text-xs font-semibold leading-snug text-ink">{session.athlete_notes}</p>
        </Card>
      )}

      <SectionHeader
        title={
          detail.rows.length > detail.totals.exercises
            ? `Logged — ${detail.totals.exercises} of ${plural(detail.rows.length, "exercise")}`
            : `Logged — ${plural(detail.rows.length, "exercise")}`
        }
        action={
          detail.rows.length > 1 && (
            <button
              className="rounded-full border border-line px-2.5 py-1 text-[11px] font-black text-muted"
              onClick={() =>
                setExpanded(allExpanded ? new Set() : new Set(detail.rows.map((r) => r.key)))
              }
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          )
        }
      />

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr>
                {["Exercise", "Best", "Sets", "Reps", "Total work"].map((label, i) => (
                  <th
                    key={label}
                    className={`border-b border-line px-3 py-2 text-[10px] font-black uppercase tracking-wide text-muted ${
                      i === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {detail.rows.map((row, i) => (
                <ExerciseRows
                  key={row.key}
                  row={row}
                  zebra={i % 2 === 1}
                  expanded={expanded.has(row.key)}
                  onToggle={() => toggle(row.key)}
                  onOpen={() => onOpenExercise(row.key)}
                  onClear={
                    onClearExercise && row.sets.length > 0
                      ? () => setClearTarget({ kind: "exercise", name: row.name })
                      : undefined
                  }
                />
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="px-3 py-2 text-[10px] font-black uppercase tracking-wide text-muted">
                  Total
                </td>
                <td />
                <td className="px-3 py-2 text-right text-[12px] font-black text-ink">
                  {detail.totals.sets}
                </td>
                <td className="px-3 py-2 text-right text-[12px] font-black text-ink">
                  {detail.totals.reps || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-[12px] font-black text-ink">
                  {detail.totals.volume > 0 ? formatVolume(detail.totals.volume) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[10px] font-bold text-muted">
          <span>
            <span className="text-done">+%</span> / <span className="text-danger">−%</span> vs the last
            time this was logged
          </span>
          <span>Tap a row for its sets</span>
        </div>
      </div>

      <ActionDialog
        open={clearTarget !== null}
        title={
          clearTarget?.kind === "exercise"
            ? `Clear ${clearTarget.name}?`
            : "Clear this logged session?"
        }
        message={
          clearTarget?.kind === "exercise"
            ? "Every logged set for this exercise will be removed. Other exercises stay unchanged."
            : "The session and all of its logged sets will be removed from activity feeds, progressions, and analytics."
        }
        onClose={() => !clearing && setClearTarget(null)}
        actions={[
          {
            label: clearing
              ? "Clearing…"
              : clearTarget?.kind === "exercise"
                ? "Clear exercise sets"
                : "Clear logged session",
            tone: "danger",
            onClick: confirmClear,
          },
        ]}
      />
    </>
  );
}

/** The set's headline number, and what fills the reps and volume columns. */
function setCells(set: SetLog, row: SessionExerciseRow) {
  const weight = set.weight_kg ?? 0;
  const reps = set.reps ?? 0;

  if (row.logType === "cardio") {
    return {
      best: set.distance_km ? `${Math.round(set.distance_km * 10) / 10} km` : "—",
      reps: "—",
      volume: set.duration_sec ? formatDuration(set.duration_sec) : "—",
    };
  }
  if (row.logType === "timed") {
    return {
      best: set.duration_sec ? formatDuration(set.duration_sec) : "—",
      reps: "—",
      volume: "—",
    };
  }
  if (row.logType === "interval") {
    return {
      best: set.duration_sec ? formatDuration(set.duration_sec) : "—",
      reps: reps ? `${reps} rounds` : "—",
      volume: "—",
    };
  }
  if (row.logType === "custom") {
    return { best: formatSetCell(set, row.logType), reps: "—", volume: "—" };
  }
  return {
    best: weight ? `${Math.round(weight * 10) / 10} kg` : "—",
    reps: reps ? String(reps) : "—",
    volume: weight && reps ? formatVolume(weight * reps) : "—",
  };
}

/** Any custom fields the set carries, as "label value" chips. */
function extraParts(set: SetLog): string[] {
  return Object.entries(set.extra ?? {})
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key} ${value}`);
}

function ExerciseRows({
  row,
  zebra,
  expanded,
  onToggle,
  onOpen,
  onClear,
}: {
  row: SessionExerciseRow;
  zebra: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onClear?: () => void;
}) {
  const background = zebra
    ? "color-mix(in srgb, var(--t-inset) 45%, var(--t-surface))"
    : "var(--t-surface)";
  const deltaColor =
    row.delta === null
      ? "var(--t-muted)"
      : row.delta > 0.001
        ? "var(--color-done)"
        : row.delta < -0.001
          ? "var(--color-danger)"
          : "var(--t-muted)";

  return (
    <Fragment>
      <tr onClick={onToggle} className="group cursor-pointer" style={{ background }}>
        <td className="border-b border-line px-3 py-2">
          <div className="flex items-start gap-1.5">
            <Icon.chevron
              className={`mt-0.5 h-3 w-3 shrink-0 text-muted transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            />
            <div className="min-w-0">
              <span
                className={`block truncate text-[13px] font-black ${
                  row.skipped ? "text-muted" : "text-ink"
                }`}
              >
                {row.name}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] font-semibold">
                {row.skipped ? (
                  <span className="text-muted">Prescribed, nothing logged</span>
                ) : (
                  <>
                    <span className="font-black" style={{ color: deltaColor }}>
                      {formatDelta(row.delta)}
                    </span>
                    <span className="text-muted">
                      {row.previousDate
                        ? `vs ${Math.round(row.previousBest * 10) / 10} ${row.unit} on ${formatShortDate(
                            row.previousDate,
                          )}`
                        : "first time logged"}
                    </span>
                  </>
                )}
                {row.target && <span className="text-muted">· target {row.target}</span>}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label={`Open ${row.name} analytics`}
              title="Open full analytics"
              className="ml-auto shrink-0 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100"
            >
              <Icon.share className="h-3.5 w-3.5" />
            </button>
            {onClear && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                aria-label={`Clear logged sets for ${row.name}`}
                title="Clear logged sets"
                className="shrink-0 text-muted transition active:text-danger"
              >
                <Icon.trash className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>

        <td className="whitespace-nowrap border-b border-line px-3 py-2 text-right text-[12px] font-black text-ink">
          {row.skipped ? "—" : `${Math.round(row.best * 10) / 10}${row.unit ? ` ${row.unit}` : ""}`}
        </td>
        <td className="border-b border-line px-3 py-2 text-right text-[12px] font-bold text-ink">
          {row.sets.length || "—"}
        </td>
        <td className="border-b border-line px-3 py-2 text-right text-[12px] font-bold text-ink">
          {row.reps || "—"}
        </td>
        <td className="whitespace-nowrap border-b border-line px-3 py-2 text-right text-[12px] font-bold text-muted">
          {row.volume > 0
            ? formatVolume(row.volume)
            : row.distanceKm > 0
              ? `${row.distanceKm} km`
              : row.durationSec > 0
                ? formatDuration(row.durationSec)
                : "—"}
        </td>
      </tr>

      {expanded &&
        row.sets.map((set) => {
          const cells = setCells(set, row);
          const extras = extraParts(set);
          return (
            <tr key={set.id} style={{ background }}>
              <td className="border-b border-line py-1.5 pl-8 pr-3">
                <span className="text-[11px] font-bold text-muted">Set {set.set_index}</span>
                {(set.rpe || extras.length > 0) && (
                  <span className="ml-1.5 text-[10px] font-semibold text-muted">
                    {[set.rpe ? `Effort ${set.rpe}/10` : null, ...extras].filter(Boolean).join(" · ")}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap border-b border-line px-3 py-1.5 text-right text-[11px] font-bold text-ink">
                {cells.best}
              </td>
              <td className="border-b border-line px-3 py-1.5" />
              <td className="border-b border-line px-3 py-1.5 text-right text-[11px] font-bold text-ink">
                {cells.reps}
              </td>
              <td className="whitespace-nowrap border-b border-line px-3 py-1.5 text-right text-[11px] font-bold text-muted">
                {cells.volume}
              </td>
            </tr>
          );
        })}

      {expanded && row.sets.length === 0 && (
        <tr style={{ background }}>
          <td className="border-b border-line py-1.5 pl-8 pr-3 text-[11px] font-semibold text-muted" colSpan={5}>
            No sets recorded against this exercise.
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// ------------------------------------------------------------------

/** Arrows through the sessions either side, or search straight to a date. */
function SessionSwitcher({
  session,
  siblings,
  logs,
  onSelect,
}: {
  session: Session;
  siblings: Session[];
  logs: SetLog[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const index = siblings.findIndex((s) => s.id === session.id);
  if (index === -1 || siblings.length < 2) return null;

  // The list runs newest first, so "previous" is further down it.
  const older = siblings[index + 1] ?? null;
  const newer = siblings[index - 1] ?? null;

  return (
    <>
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        <button
          aria-label="Previous session"
          disabled={!older}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:text-ink disabled:opacity-30"
          onClick={() => older && onSelect(older.id)}
        >
          <Icon.back className="h-4 w-4" />
        </button>

        <button
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 py-1.5"
          onClick={() => setOpen(true)}
          aria-label="Search sessions by date"
        >
          <Icon.search className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate text-sm font-black text-ink">
            {weekdayLabel(isoWeekday(parseDate(session.date)), true)} {formatShortDate(session.date)}
          </span>
          <span className="shrink-0 text-[11px] font-bold text-muted">
            {index + 1} of {siblings.length}
          </span>
        </button>

        <button
          aria-label="Next session"
          disabled={!newer}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:text-ink disabled:opacity-30"
          onClick={() => newer && onSelect(newer.id)}
        >
          <Icon.chevron className="h-4 w-4" />
        </button>
      </div>

      <SessionSearchSheet
        open={open}
        current={session}
        siblings={siblings}
        logs={logs}
        onClose={() => setOpen(false)}
        onPick={(id) => {
          onSelect(id);
          setOpen(false);
        }}
      />
    </>
  );
}

function SessionSearchSheet({
  open,
  current,
  siblings,
  logs,
  onPick,
  onClose,
}: {
  open: boolean;
  current: Session;
  siblings: Session[];
  logs: SetLog[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current.date);

  useEffect(() => {
    if (open) setValue(current.date);
  }, [open, current.date]);

  const setCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      if (!setHasData(log)) continue;
      counts.set(log.session_id, (counts.get(log.session_id) ?? 0) + 1);
    }
    return counts;
  }, [logs]);

  /** The session on that date, or the closest one before it. */
  const jump = () => {
    const match =
      siblings.find((s) => s.date === value) ?? siblings.find((s) => s.date <= value) ?? siblings.at(-1);
    if (match) onPick(match.id);
  };

  const oldest = siblings.at(-1)?.date ?? "";
  const newest = siblings[0]?.date ?? "";

  return (
    <Sheet open={open} onClose={onClose} title="Go to a session">
      <Field label="Jump to a date" hint={`Logged between ${formatShortDate(oldest)} and ${formatShortDate(newest)}`}>
        <div className="flex gap-2">
          <TextField
            type="date"
            value={value}
            min={oldest}
            max={newest}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button disabled={!value} onClick={jump}>
            Go
          </Button>
        </div>
      </Field>

      <SectionHeader title={`All ${siblings.length} sessions`} />
      <div className="space-y-1.5">
        {siblings.map((s) => {
          const tint = DAY_TYPE_COLORS[s.day_type] ?? "var(--t-accent)";
          const active = s.id === current.id;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              aria-current={active}
              className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                active ? "border-accent bg-inset" : "border-line bg-surface active:scale-[0.99]"
              }`}
            >
              <IconTile emoji={typeIcon(s.day_type)} tint={tint} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-ink">{s.day_title || "Workout"}</p>
                <p className="truncate text-[11px] font-bold text-muted">
                  {weekdayLabel(isoWeekday(parseDate(s.date)), true)} {formatShortDate(s.date)} ·{" "}
                  {plural(setCounts.get(s.id) ?? 0, "set")}
                </p>
              </div>
              {active && <Pill tint="var(--t-accent)">Viewing</Pill>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
