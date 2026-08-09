/**
 * One planned day, across every repeat of it — a page of its own.
 *
 * This was an expanding card, which meant the log grid opened inside a list and
 * had to share its width with the cards either side of it. A day with fifteen
 * sessions is a table, and a table wants the screen.
 */

import { useMemo } from "react";
import type { SetLog } from "../../data/types";
import { DAY_TYPE_COLORS, DAY_TYPE_LABELS } from "../../data/types";
import { formatShortDate } from "../../domain/dates";
import { DAY_METRIC_LABELS, formatDayMetric, type DayGroup, type DaySession } from "../../domain/dayTrends";
import { typeIcon } from "../../domain/plan";
import { buildLogTable } from "../../domain/planLog";
import { plural } from "../../domain/text";
import { Sparkline } from "../../ui/charts";
import { Card, Icon, IconButton, IconTile, Pill, SectionHeader, StatTile } from "../../ui/kit";
import { LogTable } from "../shared/LogTable";

/** One session's value under whichever metric its day is judged on. */
export function metricValue(metric: DayGroup["metric"], entry: DaySession): number {
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

/** "+12%" / "−4%" / "level", coloured by whether more is happening. */
export function TrendPill({ pct, metric }: { pct: number | null; metric: string }) {
  if (pct === null) return <Pill tint="var(--t-muted)">Not enough yet</Pill>;
  if (Math.abs(pct) < 3) return <Pill tint="var(--t-muted)">Holding steady</Pill>;
  const up = pct > 0;
  return (
    <Pill tint={up ? "var(--color-done)" : "#f5883b"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% {metric}
    </Pill>
  );
}

export function DayDetail({
  group,
  logs,
  onBack,
  onOpenSession,
  onOpenExercise,
}: {
  group: DayGroup;
  logs: SetLog[];
  onBack: () => void;
  onOpenSession: (id: string) => void;
  onOpenExercise: (name: string) => void;
}) {
  const tint = DAY_TYPE_COLORS[group.dayType] ?? "var(--t-accent)";
  const metricLabel = DAY_METRIC_LABELS[group.metric];

  const table = useMemo(
    () => buildLogTable({ sessions: group.sessions.map((s) => s.session), logs }),
    [group, logs],
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <IconTile emoji={typeIcon(group.dayType)} tint={tint} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-ink">{group.title}</h1>
          <p className="truncate text-xs font-bold text-muted">
            {DAY_TYPE_LABELS[group.dayType]} · {plural(group.count, "session")} ·{" "}
            {formatShortDate(group.firstDate)} → {formatShortDate(group.lastDate)}
          </p>
        </div>
      </div>

      <Card className="mb-3" tint={tint}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TrendPill pct={group.trendPct} metric={metricLabel} />
            {group.avgRpe !== null && <Pill tint={tint}>avg RPE {group.avgRpe}</Pill>}
          </div>
          <Sparkline values={group.series} color={tint} width={110} height={34} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={`Avg ${metricLabel}`} value={formatDayMetric(group.metric, group.avgValue)} />
          <StatTile label="Best" value={formatDayMetric(group.metric, group.bestValue)} />
          <StatTile label="Sessions" value={String(group.count)} />
          <StatTile label="Total sets" value={String(group.totalSets)} />
        </div>
      </Card>

      <SectionHeader title={`Every ${group.title}`} />
      <LogTable
        table={table}
        onOpenExercise={onOpenExercise}
        emptyMessage={`Nothing logged against ${group.title} yet.`}
      />

      <SectionHeader title="Sessions" />
      <div className="space-y-1.5">
        {group.sessions.map((entry) => (
          <button
            key={entry.session.id}
            onClick={() => onOpenSession(entry.session.id)}
            className="flex w-full items-baseline gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left"
          >
            <span className="shrink-0 text-sm font-black text-ink">
              {formatShortDate(entry.session.date)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">
              {plural(entry.sets, "set")}
              {entry.rpe !== null && ` · RPE ${entry.rpe}`}
            </span>
            <span className="shrink-0 text-xs font-black text-ink">
              {formatDayMetric(group.metric, metricValue(group.metric, entry))}
            </span>
            <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </>
  );
}
