/** Small dependency-free SVG charts, themed with the app tokens. */

import { useId, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export interface Point {
  label: string;
  value: number;
  /** Optional second line under the label in the tooltip. */
  detail?: string;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/** Index nearest the pointer, for tap-to-inspect on both mouse and touch. */
function indexFromPointer(event: ReactPointerEvent<SVGSVGElement | HTMLDivElement>, count: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}

export function BarChart({
  data,
  color = "var(--t-accent)",
  height = 140,
  format = (v: number) => String(Math.round(v)),
  goal,
  goalLabel,
}: {
  data: Point[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
  /** Horizontal reference line, e.g. the weekly session goal. */
  goal?: number;
  goalLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const max = niceMax(Math.max(...data.map((d) => d.value), goal ?? 0));
  const plot = height - 24;
  const shown = active ?? data.length - 1;
  const chartStyle = { "--chart-color": color } as CSSProperties;

  return (
    <div className="ui-chart ui-bar-chart" style={chartStyle}>
      <div className="ui-chart-readout mb-1 flex items-baseline justify-between gap-2">
        <span className="text-lg font-black text-ink">{format(data[shown]?.value ?? 0)}</span>
        <span className="truncate text-[11px] font-bold text-muted">
          {data[shown]?.detail ?? data[shown]?.label}
        </span>
      </div>

      <div
        className="ui-chart-plot relative flex items-end gap-1.5 touch-pan-y"
        style={{ height: plot }}
        onPointerDown={(e) => setActive(indexFromPointer(e, data.length))}
        onPointerMove={(e) => setActive(indexFromPointer(e, data.length))}
        onPointerLeave={() => setActive(null)}
      >
        {goal !== undefined && goal > 0 && (
          <div
            className="ui-chart-goal pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/50"
            style={{ bottom: (goal / max) * plot }}
          >
            {goalLabel && (
              <span className="absolute right-0 -top-4 text-[10px] font-black text-muted">{goalLabel}</span>
            )}
          </div>
        )}

        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="ui-chart-bar w-full rounded-t-md transition-[height,opacity,transform] duration-500"
              data-active={i === shown || undefined}
              style={{
                height: `${Math.max(2, (d.value / max) * plot)}px`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={`${d.label}-label-${i}`}
            className={`flex-1 truncate text-center text-[10px] font-bold ${
              i === shown ? "text-ink" : "text-muted"
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  data,
  color = "var(--t-accent)",
  height = 160,
  format = (v: number) => String(Math.round(v * 10) / 10),
  emptyMessage = "Log this twice to see a trend line.",
}: {
  data: Point[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
  emptyMessage?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = `line-fill-${useId().replace(/:/g, "")}`;

  if (data.length < 2) {
    return <p className="py-6 text-center text-sm font-semibold text-muted">{emptyMessage}</p>;
  }

  const width = 320;
  const padX = 8;
  const padTop = 10;
  const padBottom = 18;

  const values = data.map((d) => d.value);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  // Keep a little headroom so the line never touches the edges.
  const span = rawMax - rawMin || rawMax || 1;
  const max = rawMax + span * 0.12;
  const min = Math.max(0, rawMin - span * 0.12);

  const x = (i: number) => padX + (i * (width - padX * 2)) / (data.length - 1);
  const y = (v: number) => padTop + (1 - (v - min) / (max - min || 1)) * (height - padTop - padBottom);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const area = `${line} L ${x(data.length - 1)} ${height - padBottom} L ${x(0)} ${height - padBottom} Z`;
  const shown = active ?? data.length - 1;
  const chartStyle = { "--chart-color": color } as CSSProperties;

  return (
    <div className="ui-chart ui-line-chart" style={chartStyle}>
      <div className="ui-chart-readout mb-1 flex items-baseline justify-between gap-2">
        <span className="text-lg font-black text-ink">{format(data[shown].value)}</span>
        <span className="truncate text-[11px] font-bold text-muted">
          {data[shown].detail ?? data[shown].label}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="ui-chart-plot w-full touch-pan-y"
        role="img"
        aria-label="Progress chart"
        onPointerDown={(e) => setActive(indexFromPointer(e, data.length))}
        onPointerMove={(e) => setActive(indexFromPointer(e, data.length))}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-color)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--chart-color)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <line
            className="ui-chart-grid"
            key={t}
            x1={0}
            x2={width}
            y1={padTop + t * (height - padTop - padBottom)}
            y2={padTop + t * (height - padTop - padBottom)}
            stroke="var(--t-line)"
            strokeWidth={1}
          />
        ))}

        <path className="ui-chart-area" d={area} fill={`url(#${gradientId})`} />
        <path className="ui-chart-line" d={line} fill="none" stroke="var(--chart-color)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        <line
          x1={x(shown)}
          x2={x(shown)}
          y1={padTop}
          y2={height - padBottom}
          className="ui-chart-cursor"
          stroke="var(--chart-color)"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
        {data.map((d, i) => (
          <circle
            className="ui-chart-point"
            data-active={i === shown || undefined}
            key={`${d.label}-${i}`}
            cx={x(i)}
            cy={y(d.value)}
            r={i === shown ? 4.5 : 2.5}
            fill={i === shown ? "var(--chart-color)" : "var(--t-surface)"}
            stroke="var(--chart-color)"
            strokeWidth={2}
          />
        ))}
      </svg>

      <div className="flex justify-between text-[10px] font-bold text-muted">
        <span>{data[0].label}</span>
        <span>{data.at(-1)!.label}</span>
      </div>
    </div>
  );
}

/** Tiny inline trend line for list rows and coach cards. */
export function Sparkline({
  values,
  color = "var(--t-accent)",
  width = 64,
  height = 22,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || max || 1;
  const x = (i: number) => (i * width) / (values.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="ui-sparkline shrink-0"
      style={{ "--chart-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="var(--chart-color)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={2.5} fill="var(--chart-color)" />
    </svg>
  );
}

export function DotRow({ dots }: { dots: { date: string; level: 0 | 1 | 2 }[] }) {
  return (
    <div className="ui-dot-row flex items-center gap-1">
      {dots.map((d) => (
        <span
          key={d.date}
          title={d.date}
          className="h-3.5 w-3.5 rounded-[5px]"
          style={{
            background:
              d.level === 2 ? "var(--t-accent)" : d.level === 1 ? "var(--t-accent)" : "var(--t-line)",
            opacity: d.level === 2 ? 1 : d.level === 1 ? 0.45 : 1,
          }}
        />
      ))}
    </div>
  );
}

export function ShareBar({
  parts,
}: {
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  return (
    <div className="ui-share-chart">
      <div className="ui-share-bar flex h-3 overflow-hidden rounded-full bg-inset">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1 text-[11px] font-bold text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} {Math.round((p.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Planned vs done, week by week. */
export function AdherenceBars({
  weeks,
}: {
  weeks: { label: string; planned: number; completed: number; extra: number }[];
}) {
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.planned, w.completed + w.extra)));
  return (
    <div className="ui-adherence-chart">
      <div className="ui-adherence-bars flex items-end gap-2" style={{ height: 84 }}>
        {weeks.map((week) => (
          <div key={week.label} className="flex h-full flex-1 flex-col justify-end gap-0.5">
            <div className="relative w-full" style={{ height: `${(week.planned / max) * 76 || 4}px` }}>
              <div className="absolute inset-0 rounded-md border border-dashed border-line" />
              <div
                className="absolute bottom-0 w-full rounded-md bg-accent transition-[height] duration-500"
                style={{ height: `${(Math.min(week.completed, week.planned) / (week.planned || 1)) * 100}%` }}
              />
            </div>
            {week.extra > 0 && (
              <div
                className="w-full rounded-md bg-accent/40"
                style={{ height: `${(week.extra / max) * 76}px` }}
                title={`${week.extra} off-plan`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {weeks.map((week) => (
          <span key={`${week.label}-l`} className="flex-1 truncate text-center text-[10px] font-bold text-muted">
            {week.completed}/{week.planned}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {weeks.map((week) => (
          <span key={`${week.label}-d`} className="flex-1 truncate text-center text-[10px] font-semibold text-muted">
            {week.label}
          </span>
        ))}
      </div>
    </div>
  );
}
