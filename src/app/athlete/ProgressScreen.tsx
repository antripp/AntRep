/** Progress — trends you can steer: pick a metric and a range, then read the detail. */

import { useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import { DAY_TYPE_COLORS } from "../../data/types";
import type { PlanBundle, Session, SetLog } from "../../data/types";
import { nameKey } from "../../domain/logging";
import { buildLogTable } from "../../domain/planLog";
import { LogTable } from "../shared/LogTable";
import { formatShortDate, startOfWeek } from "../../domain/dates";
import {
  buildInsights,
  categoryBalance,
  exerciseStats,
  lifetimeTotals,
  recentRecords,
  weeklySeries,
  type ExerciseStat,
} from "../../domain/analytics";
import { weeklyGymCount } from "../../domain/gamification";
import { compactKg, plural } from "../../domain/text";
import { LineChart, Sparkline, ShareBar, type Point } from "../../ui/charts";
import {
  Card,
  EmptyState,
  Icon,
  Pill,
  ProgressRing,
  ScreenTitle,
  SectionHeader,
  StatTile,
} from "../../ui/kit";
import { ExerciseDetailSheet } from "./ExercisesScreen";
import { useWorkspace } from "../workspace";

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

export default function ProgressScreen() {
  const { profile, sessions, logs, workspace } = useWorkspace();
  const plans = useMemo(
    () => [...workspace.assigned.map((a) => a.bundle), ...workspace.ownPlans],
    [workspace],
  );
  return (
    <>
      <ScreenTitle title="Progress" />
      <ProgressBody
        sessions={sessions}
        logs={logs}
        plans={plans}
        weeklyGymGoal={profile.weekly_gym_goal}
      />
    </>
  );
}

/** Shared with the coach's athlete view. */
export function ProgressBody({
  sessions: allSessions,
  logs: allLogs,
  plans = [],
  weeklyGymGoal,
}: {
  sessions: Session[];
  logs: SetLog[];
  /** Enables the per-plan view; omit for overall only. */
  plans?: PlanBundle[];
  weeklyGymGoal: number;
}) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("8");
  const [metric, setMetric] = useState<MetricKey>("volume");
  const [scope, setScope] = useState<string>("all");
  const [openStat, setOpenStat] = useState<ExerciseStat | null>(null);

  const weeks = RANGES.find((r) => r.key === rangeKey)!.weeks;

  // Plans the athlete has actually trained against, newest first.
  const scopePlans = useMemo(
    () =>
      plans.filter((bundle) => allSessions.some((s) => s.plan_id === bundle.plan.id)),
    [plans, allSessions],
  );

  const activeBundle = scopePlans.find((b) => b.plan.id === scope) ?? null;

  const sessions = useMemo(
    () => (activeBundle ? allSessions.filter((s) => s.plan_id === activeBundle.plan.id) : allSessions),
    [allSessions, activeBundle],
  );
  const logs = useMemo(() => {
    if (!activeBundle) return allLogs;
    const ids = new Set(sessions.map((s) => s.id));
    return allLogs.filter((l) => ids.has(l.session_id));
  }, [allLogs, sessions, activeBundle]);

  const stats = useMemo(() => exerciseStats(sessions, logs), [sessions, logs]);

  const table = useMemo(
    () => buildLogTable({ sessions, logs, bundle: activeBundle }),
    [sessions, logs, activeBundle],
  );
  // Two ranges' worth, so "vs previous" compares like for like.
  const fullSeries = useMemo(() => weeklySeries(sessions, logs, weeks * 2), [sessions, logs, weeks]);
  const series = fullSeries.slice(-weeks);
  const previous = fullSeries.slice(0, weeks);

  const totals = useMemo(() => lifetimeTotals(sessions, logs), [sessions, logs]);
  const insights = useMemo(
    () => buildInsights(sessions, logs, stats, weeklyGymGoal),
    [sessions, logs, stats, weeklyGymGoal],
  );
  const balance = useMemo(() => categoryBalance(logs, categoryFor), [logs]);
  const records = useMemo(() => recentRecords(stats), [stats]);
  const gymDays = weeklyGymCount(sessions, startOfWeek());

  const valueOf = (point: (typeof series)[number]) =>
    metric === "volume" ? point.volume : metric === "sessions" ? point.sessions : point.sets;

  const chartData: Point[] = series.map((point) => ({
    label: point.label,
    value: valueOf(point),
    detail: `Week of ${point.label} · ${point.sessions} session${point.sessions === 1 ? "" : "s"} · ${point.volume.toLocaleString()} kg`,
  }));

  const currentTotal = series.reduce((t, p) => t + valueOf(p), 0);
  const previousTotal = previous.reduce((t, p) => t + valueOf(p), 0);
  const delta = previousTotal > 0 ? (currentTotal - previousTotal) / previousTotal : 0;

  if (sessions.length === 0) {
    return <EmptyState title="Nothing logged yet" subtitle="Your charts appear after the first session." />;
  }

  return (
    <>
      {scopePlans.length > 0 && (
        <Card className="mb-3 p-0">
          <div className="flex items-center gap-2 px-3 pt-3">
            <Icon.plan className="h-4 w-4 text-muted" />
            <p className="text-[11px] font-black uppercase tracking-wide text-muted">Analytics for</p>
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 pt-2">
            {[{ id: "all", name: "Overall" }, ...scopePlans.map((b) => ({ id: b.plan.id, name: b.plan.name }))].map(
              (option) => (
                <button
                  key={option.id}
                  onClick={() => setScope(option.id)}
                  aria-pressed={scope === option.id}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-black transition ${
                    scope === option.id
                      ? "bg-accent text-white"
                      : "border border-line bg-inset text-muted active:scale-[0.98]"
                  }`}
                >
                  {option.name}
                </button>
              ),
            )}
          </div>

          <p className="px-3 pb-3 text-[11px] font-semibold text-muted">
            {activeBundle
              ? `${plural(sessions.length, "session")} logged against ${activeBundle.plan.name} — every chart and the log below covers just this plan.`
              : "Everything you've logged, in and out of a plan. Pick a plan to narrow it down."}
          </p>
        </Card>
      )}

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

      {/* The main graph: pick what to look at and over how long */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line bg-inset p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
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
              {metric === "volume"
                ? `${currentTotal.toLocaleString()} kg`
                : `${currentTotal} ${metric}`}{" "}
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
              <Card key={`${record.name}-${record.date}`}>
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

      <SectionHeader
        title={activeBundle ? `${activeBundle.plan.name} — session log` : "Session log"}
      />
      <LogTable
        table={table}
        onOpenExercise={(name) => {
          const match = stats.find((s) => nameKey(s.name) === nameKey(name));
          if (match) setOpenStat(match);
        }}
        emptyMessage={
          activeBundle
            ? "No sets logged against this plan yet."
            : "Log a few sets and they'll line up here session by session."
        }
      />

      <SectionHeader title="Exercises" />
      <div className="space-y-2">
        {stats.slice(0, 15).map((stat) => (
          <Card key={stat.key} onClick={() => setOpenStat(stat)}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">{stat.name}</p>
                <p className="text-xs font-bold text-muted">
                  {stat.sessions} session{stat.sessions === 1 ? "" : "s"} ·{" "}
                  {stat.logType === "cardio"
                    ? `${Math.round(stat.best * 10) / 10} km best`
                    : stat.logType === "timed"
                      ? `${Math.round(stat.best)} sec best`
                      : `${stat.best} kg best`}
                </p>
              </div>
              <Sparkline
                values={stat.history.slice(-8).map((h) => h.best)}
                color={stat.trend >= 0 ? "var(--color-done)" : "var(--color-danger)"}
              />
              {stat.trend !== 0 && (
                <Pill tint={stat.trend > 0 ? "var(--color-done)" : "var(--color-danger)"}>
                  {stat.trend > 0 ? "▲" : "▼"} {Math.abs(Math.round(stat.trend * 100))}%
                </Pill>
              )}
            </div>
          </Card>
        ))}
      </div>

      {openStat && <ExerciseDetailSheet stat={openStat} onClose={() => setOpenStat(null)} />}
    </>
  );
}
