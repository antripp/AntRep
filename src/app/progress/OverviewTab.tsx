/** Overview — the headline numbers, the trend you steer by, and what changed. */

import { useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import { DAY_TYPE_COLORS } from "../../data/types";
import type { Session, SetLog } from "../../data/types";
import {
  buildInsights,
  categoryBalance,
  lifetimeTotals,
  recentRecords,
  weeklySeries,
  type ExerciseStat,
} from "../../domain/analytics";
import { formatShortDate, startOfWeek } from "../../domain/dates";
import {
  currentStreak,
  levelProgress,
  recentDays,
  streakCopy,
  weeklyGymCount,
} from "../../domain/gamification";
import { loggedSessionIds, nameKey } from "../../domain/logging";
import { compactKg } from "../../domain/text";
import { DotRow, LineChart, ShareBar, type Point } from "../../ui/charts";
import { Card, Icon, IconTile, Pill, ProgressRing, SectionHeader, StatTile } from "../../ui/kit";

const CATEGORY_COLORS: Record<string, string> = {
  push: DAY_TYPE_COLORS.push,
  pull: DAY_TYPE_COLORS.pull,
  legs: DAY_TYPE_COLORS.legs,
  core: DAY_TYPE_COLORS.core,
  cardio: DAY_TYPE_COLORS.run,
};

const RANGES = [
  { key: "4", label: "4w", weeks: 4 },
  { key: "8", label: "8w", weeks: 8 },
  { key: "12", label: "12w", weeks: 12 },
  { key: "26", label: "6m", weeks: 26 },
] as const;

const METRICS = [
  { key: "volume", label: "Volume" },
  { key: "sessions", label: "Sessions" },
  { key: "sets", label: "Sets" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

export function OverviewTab({
  sessions,
  logs,
  stats,
  weeklyGymGoal,
  totalXp,
  isRestDay,
  onOpenExercise,
}: {
  sessions: Session[];
  logs: SetLog[];
  stats: ExerciseStat[];
  weeklyGymGoal: number;
  /** Streak and level moved here off the Home screen. */
  totalXp: number;
  /** Was a day off scheduled on this date? Bridges the streak. */
  isRestDay: (date: Date) => boolean;
  onOpenExercise: (key: string) => void;
}) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("8");
  const [metric, setMetric] = useState<MetricKey>("volume");

  const weeks = RANGES.find((r) => r.key === rangeKey)!.weeks;

  // Two ranges' worth, so "vs previous" compares like for like.
  const fullSeries = useMemo(
    () => weeklySeries(sessions, logs, weeks * 2),
    [sessions, logs, weeks],
  );
  const series = fullSeries.slice(-weeks);
  const previous = fullSeries.slice(0, weeks);

  const totals = useMemo(() => lifetimeTotals(sessions, logs), [sessions, logs]);
  const insights = useMemo(
    () => buildInsights(sessions, logs, stats, weeklyGymGoal),
    [sessions, logs, stats, weeklyGymGoal],
  );
  const balance = useMemo(() => categoryBalance(logs, categoryFor), [logs]);
  const records = useMemo(() => recentRecords(stats), [stats]);
  // Sets recorded without ticking anything off still count as a session, here
  // and on the coach's side — the two views must not disagree.
  const logged = useMemo(() => loggedSessionIds(logs), [logs]);
  const gymDays = weeklyGymCount(sessions, startOfWeek(), logged);

  const valueOf = (point: (typeof series)[number]) =>
    metric === "volume" ? point.volume : metric === "sessions" ? point.sessions : point.sets;

  const chartData: Point[] = series.map((point) => ({
    label: point.label,
    value: valueOf(point),
    detail: `Week of ${point.label} · ${point.sessions} session${
      point.sessions === 1 ? "" : "s"
    } · ${point.volume.toLocaleString()} kg`,
  }));

  const currentTotal = series.reduce((t, p) => t + valueOf(p), 0);
  const previousTotal = previous.reduce((t, p) => t + valueOf(p), 0);
  const delta = previousTotal > 0 ? (currentTotal - previousTotal) / previousTotal : 0;

  const streak = currentStreak(sessions, isRestDay, new Date(), logged);
  const copy = streakCopy(streak);
  const dots = recentDays(sessions, 10, new Date(), logged);
  const level = levelProgress(totalXp);

  return (
    <>
      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <IconTile emoji="🔥" tint="var(--t-accent)" size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black text-ink">{copy.headline}</p>
            <p className="truncate text-xs font-bold text-muted">{copy.subtitle}</p>
          </div>
          <DotRow dots={dots} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Pill tint="var(--t-accent)">LVL {level.level}</Pill>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.min(100, (level.current / level.needed) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-black text-muted">
            {level.current}/{level.needed} XP
          </span>
        </div>
      </Card>

      <Card className="mb-3">
        <div className="flex items-center gap-4">
          <ProgressRing
            ratio={weeklyGymGoal ? gymDays / weeklyGymGoal : 0}
            label={`${gymDays}/${weeklyGymGoal}`}
            sublabel="week"
            size={78}
          />
          <div className="grid flex-1 grid-cols-2 gap-2">
            <StatTile value={totals.volume.toLocaleString()} label="kg lifted" />
            <StatTile value={String(totals.sets)} label="sets" />
            <StatTile value={String(totals.sessions)} label="sessions" />
            <StatTile value={`${totals.distanceKm}`} label="km" />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line bg-inset p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                aria-pressed={metric === m.key}
                className={`rounded-full px-3 py-1 text-xs font-black transition ${
                  metric === m.key ? "bg-surface text-ink shadow-sm" : "text-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex rounded-full border border-line bg-inset p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                aria-pressed={rangeKey === r.key}
                className={`rounded-full px-2.5 py-1 text-xs font-black transition ${
                  rangeKey === r.key ? "bg-surface text-ink shadow-sm" : "text-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <LineChart
          data={chartData}
          format={(v) => (metric === "volume" ? `${compactKg(v)} kg` : String(Math.round(v)))}
          emptyMessage="Two weeks of training and this fills in."
        />

        {previousTotal > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Pill tint={delta >= 0 ? "var(--color-done)" : "var(--color-danger)"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))}%
            </Pill>
            <span className="text-[11px] font-bold text-muted">
              {metric === "volume" ? `${currentTotal.toLocaleString()} kg` : `${currentTotal} ${metric}`}{" "}
              vs {metric === "volume" ? `${previousTotal.toLocaleString()} kg` : previousTotal} the{" "}
              {weeks} weeks before
            </span>
          </div>
        )}
      </Card>

      {insights.length > 0 && (
        <>
          <SectionHeader title="Read-outs" />
          <div className="space-y-2">
            {insights.map((insight) => (
              <Card key={insight.id}>
                <div className="flex gap-3">
                  <div
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-xl"
                    style={{
                      background:
                        insight.tone === "good"
                          ? "color-mix(in srgb, var(--color-done) 18%, transparent)"
                          : insight.tone === "warn"
                            ? "color-mix(in srgb, var(--color-danger) 16%, transparent)"
                            : "var(--t-inset)",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-ink">{insight.title}</p>
                    <p className="text-xs font-semibold text-muted">{insight.detail}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {balance.length > 0 && (
        <>
          <SectionHeader title="Muscle balance" />
          <Card>
            <ShareBar
              parts={balance.map((b) => ({
                label: b.category,
                value: b.sets,
                color: CATEGORY_COLORS[b.category] ?? "var(--t-accent)",
              }))}
            />
          </Card>
        </>
      )}

      {records.length > 0 && (
        <>
          <SectionHeader title="Recent records" icon={<Icon.trophy className="h-4 w-4" />} />
          <div className="space-y-2">
            {records.slice(0, 6).map((record) => (
              <Card
                key={`${record.name}-${record.date}`}
                onClick={() => onOpenExercise(nameKey(record.name))}
              >
                <div className="flex items-center gap-3">
                  <Icon.star className="h-5 w-5 text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{record.name}</p>
                    <p className="text-xs font-bold text-muted">{formatShortDate(record.date)}</p>
                  </div>
                  <Pill tint="var(--t-accent)">
                    {record.logType === "cardio"
                      ? `${Math.round(record.value * 10) / 10} km`
                      : record.logType === "timed"
                        ? `${Math.round(record.value)} sec`
                        : `${record.value} kg`}
                  </Pill>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
