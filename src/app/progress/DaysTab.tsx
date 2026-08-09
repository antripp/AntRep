/**
 * Days — every repeat of a planned day together.
 *
 * The other tabs slice the log by plan, by session and by exercise. This one
 * slices it by the day of the split, which is the comparison a repeating plan
 * actually invites: this pull day against the last four pull days, not against
 * yesterday's legs.
 */

import { useMemo, useState } from "react";
import type { Session, SetLog } from "../../data/types";
import { DAY_TYPE_COLORS, DAY_TYPE_LABELS } from "../../data/types";
import { formatShortDate } from "../../domain/dates";
import {
  DAY_METRIC_LABELS,
  dayGroupExercises,
  formatDayMetric,
  groupSessionsByDay,
  type DayGroup,
  type DaySession,
} from "../../domain/dayTrends";
import { typeIcon } from "../../domain/plan";
import { formatVolume } from "../../domain/sessionTable";
import { plural } from "../../domain/text";
import { Sparkline } from "../../ui/charts";
import { Card, EmptyState, Icon, IconTile, Pill } from "../../ui/kit";

export function DaysTab({
  sessions,
  logs,
  onOpenSession,
}: {
  sessions: Session[];
  logs: SetLog[];
  onOpenSession: (id: string) => void;
}) {
  const groups = useMemo(() => groupSessionsByDay(sessions, logs), [sessions, logs]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No days to compare yet"
        subtitle="Log a couple of sessions and each planned day — pull, push, legs — gets its own trend here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <DayGroupCard
          key={group.key}
          group={group}
          logs={logs}
          open={openKey === group.key}
          onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
          onOpenSession={onOpenSession}
        />
      ))}
    </div>
  );
}

/** "+12%" / "−4%" / "level", coloured by whether more is happening. */
function TrendPill({ pct, metric }: { pct: number | null; metric: string }) {
  if (pct === null) {
    return <Pill tint="var(--t-muted)">Not enough yet</Pill>;
  }
  if (Math.abs(pct) < 3) return <Pill tint="var(--t-muted)">Holding steady</Pill>;
  const up = pct > 0;
  return (
    <Pill tint={up ? "var(--color-done)" : "#f5883b"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% {metric}
    </Pill>
  );
}

function DayGroupCard({
  group,
  logs,
  open,
  onToggle,
  onOpenSession,
}: {
  group: DayGroup;
  logs: SetLog[];
  open: boolean;
  onToggle: () => void;
  onOpenSession: (id: string) => void;
}) {
  const tint = DAY_TYPE_COLORS[group.dayType] ?? "var(--t-accent)";
  const exercises = useMemo(
    () => (open ? dayGroupExercises(group, logs) : []),
    [open, group, logs],
  );

  return (
    <Card tint={tint}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <IconTile emoji={typeIcon(group.dayType)} tint={tint} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black text-ink">{group.title}</p>
          <p className="truncate text-xs font-bold text-muted">
            {DAY_TYPE_LABELS[group.dayType]} · {plural(group.count, "session")} · last{" "}
            {formatShortDate(group.lastDate)}
          </p>
        </div>
        {/* The day's own metric across every repeat — the trend at a glance. */}
        <Sparkline values={group.series} color={tint} width={70} height={24} />
        <Icon.chevron
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TrendPill pct={group.trendPct} metric={DAY_METRIC_LABELS[group.metric]} />
        {group.avgRpe !== null && <Pill tint={tint}>avg RPE {group.avgRpe}</Pill>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Figure
          label={`Avg ${DAY_METRIC_LABELS[group.metric]}`}
          value={formatDayMetric(group.metric, group.avgValue)}
        />
        <Figure label="Best" value={formatDayMetric(group.metric, group.bestValue)} />
        <Figure label="Total sets" value={String(group.totalSets)} />
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          {exercises.length > 0 && (
            <>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-muted">
                Across every {group.title}
              </p>
              <div className="mb-3 space-y-1">
                {exercises.slice(0, 8).map((exercise) => (
                  <div
                    key={exercise.name}
                    className="flex items-baseline gap-2 rounded-xl bg-inset px-3 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">
                      {exercise.name}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-muted">
                      {plural(exercise.sets, "set")}
                      {exercise.bestWeight > 0 && ` · best ${exercise.bestWeight} kg`}
                    </span>
                    <span className="shrink-0 text-[11px] font-black text-ink">
                      {formatVolume(exercise.volume)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-muted">
            Every session
          </p>
          <div className="space-y-1">
            {group.sessions.map((entry) => (
              <button
                key={entry.session.id}
                onClick={() => onOpenSession(entry.session.id)}
                className="flex w-full items-baseline gap-2 rounded-xl bg-inset px-3 py-1.5 text-left"
              >
                <span className="shrink-0 text-xs font-black text-ink">
                  {formatShortDate(entry.session.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-muted">
                  {plural(entry.sets, "set")}
                  {entry.rpe !== null && ` · RPE ${entry.rpe}`}
                </span>
                <span className="shrink-0 text-[11px] font-black text-ink">
                  {formatDayMetric(group.metric, metricValue(group.metric, entry))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** One session's value under whichever metric its day is judged on. */
function metricValue(metric: DayGroup["metric"], entry: DaySession): number {
  switch (metric) {
    case "volume":
      return entry.volume;
    case "distance":
      return entry.distanceKm;
    case "duration":
      return entry.durationSec;
    case "sets":
      return entry.sets;
  }
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-inset px-2.5 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate text-sm font-black text-ink">{value}</p>
    </div>
  );
}
