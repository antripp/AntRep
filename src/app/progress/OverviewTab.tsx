/** Overview — the headline numbers, the trend you steer by, and what changed. */

import { useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import type { Session, SetLog } from "../../data/types";
import {
  buildInsights,
  categoryBalance,
  lifetimeTotals,
  recentRecords,
  weeklySeries,
  type ExerciseStat,
  type Insight,
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
import { buildTrainingIntelligence, type InterferenceInsight, type TrainingDimension } from "../../domain/trainingIntelligence";
import type { DimensionKey } from "../../domain/trainingIntelligence";
import { DIMENSION_METHODS } from "../../domain/progressionDetail";
import { compactKg } from "../../domain/text";
import { DotRow, LineChart, ShareBar, type Point } from "../../ui/charts";
import { Card, Icon, IconTile, Pill, ProgressRing, SectionHeader, Sheet, StatTile } from "../../ui/kit";
import { CATEGORY_COLORS, DIMENSION_COLORS } from "./palette";
import type { ProgressPlanRun } from "../../domain/consistency";

const OVERVIEW_CHART_COLORS: Record<MetricKey, string> = {
  volume: DIMENSION_COLORS.capacity,
  sessions: DIMENSION_COLORS.consistency,
  sets: DIMENSION_COLORS.strength,
};

const RANGES = [
  { key: "4", label: "4w", weeks: 4 },
  { key: "8", label: "8w", weeks: 8 },
  { key: "12", label: "12w", weeks: 12 },
  { key: "26", label: "6m", weeks: 26 },
] as const;

const METRICS = [
  { key: "volume", label: "Total work" },
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
  onOpenDimension,
  planRuns,
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
  onOpenDimension: (key: DimensionKey) => void;
  planRuns: ProgressPlanRun[];
}) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("8");
  const [metric, setMetric] = useState<MetricKey>("volume");
  const [infoDimension, setInfoDimension] = useState<TrainingDimension | null>(null);
  const [infoInsight, setInfoInsight] = useState<Insight | null>(null);
  const [infoInterference, setInfoInterference] = useState<InterferenceInsight | null>(null);

  const weeks = RANGES.find((r) => r.key === rangeKey)!.weeks;

  // Two ranges' worth, so "vs previous" compares like for like.
  const fullSeries = useMemo(
    () => weeklySeries(sessions, logs, weeks * 2),
    [sessions, logs, weeks],
  );
  const series = fullSeries.slice(-weeks);
  const previous = fullSeries.slice(0, weeks);

  const totals = useMemo(() => lifetimeTotals(sessions, logs), [sessions, logs]);
  const intelligence = useMemo(
    () => buildTrainingIntelligence(sessions, logs, weeklyGymGoal, new Date(), { planRuns }),
    [sessions, logs, weeklyGymGoal, planRuns],
  );
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
  const dots = recentDays(sessions, 10, new Date(), logged, isRestDay);
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

      <SectionHeader
        title="Training dimensions"
        action={<Pill tint="var(--t-accent)">{intelligence.trend}</Pill>}
      />
      <p className="mb-2 text-[11px] font-semibold text-muted">{intelligence.analysedSessions} analysed sessions</p>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {intelligence.dimensions.map((dimension) => (
          <DimensionCard
            key={dimension.key}
            dimension={dimension}
            onOpen={() => onOpenDimension(dimension.key)}
            onInfo={() => setInfoDimension(dimension)}
          />
        ))}
      </div>

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <ProgressRing
            ratio={weeklyGymGoal ? gymDays / weeklyGymGoal : 0}
            label={`${gymDays}/${weeklyGymGoal}`}
            sublabel="week"
            size={78}
            stroke={5}
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
          color={OVERVIEW_CHART_COLORS[metric]}
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
          <div className="grid gap-2 sm:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        insight.tone === "good"
                          ? "color-mix(in srgb, var(--color-done) 18%, transparent)"
                          : insight.tone === "warn"
                            ? "color-mix(in srgb, var(--color-danger) 16%, transparent)"
                            : "var(--t-inset)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{insight.title}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`More about ${insight.title}`}
                    onClick={() => setInfoInsight(insight)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-inset text-[11px] font-black text-muted"
                  >i</button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {intelligence.interference.length > 0 && (
        <>
          <SectionHeader title="Exercise-order influence" icon={<Icon.progress className="h-4 w-4" />} />
          <p className="-mt-1 mb-2 text-[11px] font-semibold text-muted">Observed ordering associations</p>
          <div className="space-y-2">
            {intelligence.interference.map((insight) => (
              <Card key={insight.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <IconTile emoji="↘️" tint="var(--color-gold)" size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-black text-ink">
                        {insight.earlier} → {insight.later}
                      </p>
                      <Pill tint={insight.confidence === "Personal" ? "var(--color-done)" : "var(--t-muted)"}>
                        {insight.confidence}
                      </Pill>
                    </div>
                  </div>
                  {insight.estimatedImpact !== null && (
                    <span className="shrink-0 text-sm font-black text-danger">
                      {Math.round(insight.estimatedImpact * 100)}%
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`More about ${insight.earlier} before ${insight.later}`}
                    onClick={() => setInfoInterference(insight)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-inset text-[11px] font-black text-muted"
                  >i</button>
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

      <Sheet
        open={infoDimension !== null}
        onClose={() => setInfoDimension(null)}
        title={infoDimension ? `${infoDimension.label} score` : "Metric score"}
      >
        {infoDimension && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-inset p-3">
              <MetricScoreRing score={infoDimension.score} color={DIMENSION_COLORS[infoDimension.key]} size={62} />
              <div>
                <p className="text-sm font-black text-ink">{infoDimension.status}</p>
                <p className="text-xs font-semibold text-muted">{infoDimension.confidence} confidence</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-ink">{infoDimension.detail}</p>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-muted">What it assesses</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">
              {DIMENSION_METHODS[infoDimension.key].summary}
            </p>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-muted">Calculation</p>
            <p className="mt-1 rounded-2xl bg-inset p-3 text-xs font-semibold leading-relaxed text-ink">
              {DIMENSION_METHODS[infoDimension.key].formula}
            </p>
          </>
        )}
      </Sheet>

      <Sheet open={infoInsight !== null} onClose={() => setInfoInsight(null)} title={infoInsight?.title ?? "Insight"}>
        {infoInsight && (
          <>
            <Pill tint={infoInsight.tone === "good" ? "var(--color-done)" : infoInsight.tone === "warn" ? "var(--color-danger)" : "var(--t-accent)"}>
              {infoInsight.tone === "good" ? "Positive signal" : infoInsight.tone === "warn" ? "Worth attention" : "Context"}
            </Pill>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-ink">{infoInsight.detail}</p>
            <p className="mt-4 text-xs font-semibold leading-relaxed text-muted">
              Read-outs summarize the selected time range. Use the underlying day, session and exercise evidence before changing a plan.
            </p>
          </>
        )}
      </Sheet>

      <Sheet
        open={infoInterference !== null}
        onClose={() => setInfoInterference(null)}
        title={infoInterference ? `${infoInterference.earlier} → ${infoInterference.later}` : "Exercise-order influence"}
      >
        {infoInterference && (
          <>
            <div className="flex items-center gap-2">
              <Pill tint={infoInterference.confidence === "Personal" ? "var(--color-done)" : "var(--color-gold)"}>{infoInterference.confidence}</Pill>
              {infoInterference.estimatedImpact !== null && (
                <span className="text-sm font-black text-danger">{Math.round(infoInterference.estimatedImpact * 100)}% association</span>
              )}
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-ink">{infoInterference.detail}</p>
            <div className="mt-4 rounded-2xl bg-inset p-3 text-xs font-semibold leading-relaxed text-muted">
              This is an association, not proven causation. Personal fresh-versus-after comparisons replace generic overlap estimates as comparable sessions accumulate.
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

function DimensionCard({ dimension, onOpen, onInfo }: { dimension: TrainingDimension; onOpen: () => void; onInfo: () => void }) {
  const tint = DIMENSION_COLORS[dimension.key];
  return (
    <div className="ui-card relative overflow-hidden rounded-card border border-line bg-surface shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[84px] w-full items-center gap-3 p-4 pr-14 text-left transition active:scale-[0.99]"
      >
        <MetricScoreRing score={dimension.score} color={tint} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-tight text-ink">{dimension.label}</p>
          <Pill tint={tint} className="mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {dimension.status}
          </Pill>
          <p className="mt-1 truncate text-[10px] font-bold text-muted">{dimension.confidence} confidence</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onInfo}
        aria-label={`About ${dimension.label}`}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-inset text-[10px] font-black text-muted transition active:scale-95 active:text-ink"
      >i</button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${dimension.label}`}
        className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-inset transition active:scale-95"
        style={{ color: tint }}
      >
        <Icon.chevron className="h-4 w-4" />
      </button>
    </div>
  );
}

function MetricScoreRing({ score, color, size }: { score: number; color: string; size: number }) {
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = radius * Math.PI * 2;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-label={`Score ${score} out of 100`} role="img">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--t-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-ink">{score}</span>
    </div>
  );
}
