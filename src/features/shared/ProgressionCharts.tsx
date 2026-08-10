import type { ProgressionMetric } from "../../lib/types";
import type { ProgressionAnalytics } from "../../lib/analytics";
import { formatAnalyticsValue } from "../../lib/analytics";
import { Card } from "../../components/ui";
import { useId, type CSSProperties } from "react";

const CHART_COLORS = [
  "var(--t-chart-1)",
  "var(--t-chart-2)",
  "var(--t-chart-3)",
  "var(--t-chart-4)",
  "var(--t-chart-5)",
];

function LineChart({
  series,
  height = 120,
  unit = "kg",
}: {
  series: { label: string; points: { label: string; value: number }[]; color?: string }[];
  height?: number;
  unit?: string;
}) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return <p className="text-xs font-semibold text-muted">No data yet.</p>;
  }

  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const w = 320;
  const h = height;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const values = allPoints.map((p) => p.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const ySpan = maxY - minY || 1;

  const xAt = (i: number, count: number) =>
    pad.l + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - ((v - minY) / ySpan) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="ui-chart ui-progression-line w-full" role="img" aria-hidden>
      {[0, 0.5, 1].map((tick) => (
        <line
          key={tick}
          className="ui-chart-grid"
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + tick * innerH}
          y2={pad.t + tick * innerH}
          stroke="var(--t-line)"
        />
      ))}
      {series.map((s, si) => {
        if (s.points.length === 0) return null;
        const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length];
        const d = s.points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i, s.points.length)} ${yAt(p.value)}`)
          .join(" ");
        return (
          <g key={s.label}>
            <path className="ui-chart-line" d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {s.points.map((p, i) => (
              <circle className="ui-chart-point" key={i} cx={xAt(i, s.points.length)} cy={yAt(p.value)} r="4" fill={color} />
            ))}
          </g>
        );
      })}
      {series[0]?.points.map((p, i) => (
        <text
          key={i}
          x={xAt(i, series[0].points.length)}
          y={h - 4}
          textAnchor="middle"
          className="fill-muted text-[9px] font-bold"
        >
          {p.label}
        </text>
      ))}
      <text x={pad.l} y={10} className="fill-muted text-[9px] font-bold">
        {Math.round(maxY)} {unit}
      </text>
      <text x={pad.l} y={pad.t + innerH} className="fill-muted text-[9px] font-bold">
        {Math.round(minY)} {unit}
      </text>
    </svg>
  );
}

function BarChart({
  points,
  height = 100,
  color = "var(--t-chart-1)",
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const gradientId = `progress-bar-${useId().replace(/:/g, "")}`;
  if (points.length === 0) {
    return <p className="text-xs font-semibold text-muted">No data yet.</p>;
  }

  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const w = 320;
  const h = height;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(...points.map((p) => p.value), 1);
  const barW = Math.min(28, innerW / points.length - 4);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="ui-chart ui-progression-bars w-full"
      style={{ "--chart-color": color } as CSSProperties}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-color)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--chart-color)" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((tick) => (
        <line
          key={tick}
          className="ui-chart-grid"
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + tick * innerH}
          y2={pad.t + tick * innerH}
          stroke="var(--t-line)"
        />
      ))}
      {points.map((p, i) => {
        const barH = (p.value / maxY) * innerH;
        const x = pad.l + (i + 0.5) * (innerW / points.length) - barW / 2;
        const y = pad.t + innerH - barH;
        return (
          <g key={i}>
            <rect className="ui-chart-bar" x={x} y={y} width={barW} height={barH} rx="6" fill={`url(#${gradientId})`} />
            <text x={x + barW / 2} y={h - 4} textAnchor="middle" className="fill-muted text-[9px] font-bold">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ProgressionCharts({
  analytics,
  metric,
}: {
  analytics: ProgressionAnalytics;
  metric: ProgressionMetric;
}) {
  const unit = metric === "total_volume" ? "kg vol" : "kg";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-black">{analytics.summary.totalSessions}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Sessions logged</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-black">{analytics.summary.avgSessionsPerWeek || "—"}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Avg / active week</p>
        </Card>
      </div>

      {analytics.summary.topGainer && (
        <Card className="border-accent/30 bg-accent-soft">
          <p className="text-xs font-extrabold uppercase tracking-wide text-accent">Top progress</p>
          <p className="mt-1 text-sm font-extrabold">
            {analytics.summary.topGainer.name} +{formatAnalyticsValue(analytics.summary.topGainer.change, metric)}
          </p>
        </Card>
      )}

      {analytics.exerciseSeries.length > 0 && (
        <Card>
          <h3 className="mb-1 font-black">Exercise progression</h3>
          <p className="mb-3 text-xs font-semibold text-muted">
            {metric === "total_volume" ? "Best weekly volume" : "Max weight"} per week
          </p>
          <LineChart
            unit={unit}
            series={analytics.exerciseSeries.slice(0, 4).map((s, i) => ({
              label: s.exerciseName,
              color: CHART_COLORS[i % CHART_COLORS.length],
              points: s.points.map((p) => ({ label: p.label, value: p.value })),
            }))}
          />
          <ul className="mt-3 flex flex-col gap-1">
            {analytics.exerciseSeries.map((s, i) => (
              <li key={s.exerciseName} className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate font-extrabold">{s.exerciseName}</span>
                <span className="text-muted">
                  {s.latest != null ? formatAnalyticsValue(s.latest, metric) : "—"}
                  {s.change != null && s.change !== 0 && (
                    <span className={s.change > 0 ? " text-accent" : " text-danger"}>
                      {" "}
                      ({s.change > 0 ? "+" : ""}
                      {formatAnalyticsValue(s.change, metric)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {analytics.weeklyVolume.length > 0 && (
        <Card>
          <h3 className="mb-1 font-black">Training volume</h3>
          <p className="mb-3 text-xs font-semibold text-muted">Total kg lifted per week (all exercises)</p>
          <BarChart
            color="var(--t-chart-2)"
            points={analytics.weeklyVolume.map((p) => ({ label: p.label, value: p.value }))}
          />
        </Card>
      )}

      {analytics.sessionsPerWeek.length > 0 && (
        <Card>
          <h3 className="mb-1 font-black">Session consistency</h3>
          <p className="mb-3 text-xs font-semibold text-muted">Completed workouts per program week</p>
          <BarChart
            color="var(--t-chart-1)"
            points={analytics.sessionsPerWeek.map((p) => ({ label: p.label, value: p.value }))}
          />
        </Card>
      )}

      {(analytics.checkInWeight.length > 0 || analytics.checkInPain.length > 0) && (
        <Card>
          <h3 className="mb-1 font-black">Check-in trends</h3>
          <p className="mb-3 text-xs font-semibold text-muted">Body weight and reported pain over time</p>
          {analytics.checkInWeight.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Weight (kg)</p>
              <LineChart
                unit="kg"
                series={[
                  {
                    label: "Weight",
                    color: "var(--t-chart-3)",
                    points: analytics.checkInWeight.map((p) => ({ label: p.label, value: p.value })),
                  },
                ]}
              />
            </div>
          )}
          {analytics.checkInPain.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Pain (0–10)</p>
              <LineChart
                unit=""
                series={[
                  {
                    label: "Pain",
                    color: "var(--t-chart-4)",
                    points: analytics.checkInPain.map((p) => ({ label: p.label, value: p.value })),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
