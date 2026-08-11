import { useId, useMemo } from "react";
import type { Session, SetLog } from "../../data/types";
import { addDays, formatShortDate, localDate } from "../../domain/dates";
import {
  buildTrainingIntelligence,
  type DimensionKey,
  type TrainingDimension,
} from "../../domain/trainingIntelligence";
import { Card, Pill, SectionHeader } from "../../ui/kit";
import { DIMENSION_COLORS } from "./palette";
import type { ProgressPlanRun } from "../../domain/consistency";

interface TrendPoint {
  label: string;
  scores: Record<DimensionKey, number>;
  analysedSessions: number;
}

const KEYS: DimensionKey[] = ["strength", "endurance", "consistency", "capacity", "recovery", "stability"];

/**
 * The same compact six-signal view used in every Progress drill-down. Scores
 * are recalculated at each historical cutoff, so the line is a real as-of trend
 * rather than a decorative sparkline of the current value.
 */
export function MetricTrendGrid({
  sessions,
  logs,
  weeklyGoal,
  today = new Date(),
  title = "All metric trends",
  planRuns = [],
}: {
  sessions: Session[];
  logs: SetLog[];
  weeklyGoal: number;
  /** End the trend at a historical session when viewing that session page. */
  today?: Date;
  title?: string;
  planRuns?: ProgressPlanRun[];
}) {
  const { points, dimensions } = useMemo(() => {
    const sessionIds = new Set(sessions.map((session) => session.id));
    const scopedLogs = logs.filter((log) => sessionIds.has(log.session_id));
    const cutoffs = Array.from({ length: 8 }, (_, index) => addDays(today, -(7 - index) * 7));
    const snapshots = cutoffs.map((cutoff): { point: TrendPoint; dimensions: TrainingDimension[] } => {
      const intelligence = buildTrainingIntelligence(sessions, scopedLogs, weeklyGoal, cutoff, { planRuns });
      const scores = Object.fromEntries(
        intelligence.dimensions.map((dimension) => [dimension.key, dimension.score]),
      ) as Record<DimensionKey, number>;
      return {
        point: {
          label: formatShortDate(localDate(cutoff)),
          scores,
          analysedSessions: intelligence.analysedSessions,
        },
        dimensions: intelligence.dimensions,
      };
    });
    const visible = snapshots.filter((snapshot) => snapshot.point.analysedSessions > 0);
    const latest = (visible.at(-1) ?? snapshots.at(-1))!;
    return { points: visible.map((snapshot) => snapshot.point), dimensions: latest.dimensions };
  }, [sessions, logs, weeklyGoal, today, planRuns]);

  if (points.length === 0) return null;

  return (
    <>
      <SectionHeader title={title} action={<Pill tint="var(--t-accent)">8-week view</Pill>} />
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {KEYS.map((key) => {
          const dimension = dimensions.find((item) => item.key === key);
          if (!dimension) return null;
          const values = points.map((point) => point.scores[key]);
          const change = values.length > 1 ? values.at(-1)! - values[0] : 0;
          const color = DIMENSION_COLORS[key];
          return (
            <Card key={key} className="overflow-hidden !p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-muted">{dimension.emoji} {dimension.label}</p>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-xl font-black leading-none text-ink">{dimension.score}</span>
                    <span className="text-[9px] font-black uppercase tracking-wide text-muted">/100</span>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-black" style={{ color }}>
                  {change > 0 ? "+" : ""}{change} pts
                </span>
              </div>
              <MiniAreaChart values={values} color={color} label={`${dimension.label} score trend`} />
              <div className="mt-1 flex justify-between text-[9px] font-bold text-muted">
                <span>{points[0].label}</span>
                <span>{points.at(-1)!.label}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function MiniAreaChart({ values, color, label }: { values: number[]; color: string; label: string }) {
  const rawId = useId();
  const gradientId = `mini-area-${rawId.replace(/:/g, "")}`;
  const width = 150;
  const height = 42;
  const top = 3;
  const bottom = 4;
  const min = Math.max(0, Math.min(...values) - 8);
  const max = Math.min(100, Math.max(...values) + 8);
  const span = max - min || 1;
  const x = (index: number) => values.length === 1 ? width / 2 : index * width / (values.length - 1);
  const y = (value: number) => top + (1 - (value - min) / span) * (height - top - bottom);
  const coordinates = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${x(values.length - 1)} ${height} L ${x(0)} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[42px] w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.length === 1 && <circle cx={coordinates[0].x} cy={coordinates[0].y} r="2" fill={color} />}
    </svg>
  );
}
