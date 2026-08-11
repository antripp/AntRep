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
import { buildContextSignals } from "../../domain/progressionDetail";
import { plural } from "../../domain/text";
import { BarChart, LineChart, Sparkline } from "../../ui/charts";
import { Card, Icon, IconButton, IconTile, Pill, SectionHeader, StatTile } from "../../ui/kit";
import { LogTable } from "../shared/LogTable";
import { MetricTrendGrid } from "./MetricTrendGrid";
import type { ProgressPlanRun } from "../../domain/consistency";

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
  weeklyGoal,
  planRuns,
}: {
  group: DayGroup;
  logs: SetLog[];
  onBack: () => void;
  onOpenSession: (id: string) => void;
  onOpenExercise: (name: string) => void;
  weeklyGoal: number;
  planRuns: ProgressPlanRun[];
}) {
  const tint = DAY_TYPE_COLORS[group.dayType] ?? "var(--t-accent)";
  const metricLabel = DAY_METRIC_LABELS[group.metric];

  const table = useMemo(
    () => buildLogTable({ sessions: group.sessions.map((s) => s.session), logs }),
    [group, logs],
  );
  const signals = useMemo(
    () => buildContextSignals(group.sessions.map((entry) => entry.session), logs),
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
            {group.avgRpe !== null && <Pill tint={tint}>average effort {group.avgRpe}/10</Pill>}
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

      <Card className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-muted">Pattern insight</p>
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
      </Card>

      <MetricTrendGrid
        sessions={group.sessions.map((entry) => entry.session)}
        logs={logs}
        weeklyGoal={weeklyGoal}
        title="Planned-day metric trends"
        planRuns={planRuns}
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted">{metricLabel} by session</p>
          <LineChart
            data={group.sessions.slice().reverse().map((entry) => ({
              label: formatShortDate(entry.session.date),
              value: metricValue(group.metric, entry),
              detail: `${entry.session.day_title || group.title} · ${plural(entry.sets, "set")}`,
            }))}
            color={tint}
            format={(value) => formatDayMetric(group.metric, value)}
          />
        </Card>
        {signals.exerciseRetention.length > 1 && (
          <Card>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted">Fatigue resistance</p>
            <BarChart
              data={signals.exerciseRetention.slice(0, 8).map((entry) => ({
                label: entry.name.split(" ")[0],
                value: Math.round(entry.retention * 100),
                detail: `${entry.name} · ${entry.sets} sets`,
              }))}
              color={tint}
              format={(value) => `${Math.round(value)}%`}
              goal={90}
              goalLabel="strong"
            />
          </Card>
        )}
      </div>

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
              {entry.rpe !== null && ` · effort ${entry.rpe}/10`}
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
