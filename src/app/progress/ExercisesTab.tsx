/**
 * Exercises — every movement you've logged as a compact card: how often, how
 * heavy, and which way it's going. Tap through for the full page.
 */

import { useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import type { ExerciseStat } from "../../domain/analytics";
import { formatShortDate } from "../../domain/dates";
import { bestUnit } from "../../domain/planLog";
import { plural } from "../../domain/text";
import { Sparkline } from "../../ui/charts";
import { EmptyState, Icon, IconTile, TextField } from "../../ui/kit";

export const CATEGORY_EMOJI: Record<string, string> = {
  push: "🏋️",
  pull: "🚣",
  legs: "🦵",
  core: "🧘",
  cardio: "🏃",
};

const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "trend", label: "Trend" },
  { key: "best", label: "Best" },
  { key: "volume", label: "Total work" },
  { key: "sessions", label: "Sessions" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

export function formatBest(stat: ExerciseStat): string {
  const value = Math.round(stat.best * 10) / 10;
  return `${value} ${bestUnit(stat.logType, stat.hasWeight)}`.trim();
}

export function ExercisesTab({
  stats,
  onOpenExercise,
}: {
  stats: ExerciseStat[];
  onOpenExercise: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? stats.filter((s) => s.name.toLowerCase().includes(q)) : stats;
    const sorted = [...filtered];
    switch (sort) {
      case "trend":
        sorted.sort((a, b) => b.trend - a.trend);
        break;
      case "best":
        sorted.sort((a, b) => b.best - a.best);
        break;
      case "volume":
        sorted.sort((a, b) => b.volume - a.volume);
        break;
      case "sessions":
        sorted.sort((a, b) => b.sessions - a.sessions);
        break;
      default:
        sorted.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
    }
    return sorted;
  }, [stats, query, sort]);

  return (
    <>
      <div className="mb-3 space-y-2">
        <TextField
          placeholder="Search your exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SORTS.map((option) => (
            <button
              key={option.key}
              onClick={() => setSort(option.key)}
              aria-pressed={sort === option.key}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                sort === option.key
                  ? "bg-accent text-white"
                  : "border border-line bg-inset text-muted active:scale-[0.98]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={query ? "No match" : "No logged exercises yet"}
          subtitle={
            query
              ? "Nothing logged under that name in this scope."
              : "Every exercise you log shows up here with its own trend and records."
          }
        />
      ) : (
        <>
          <p className="mb-2 text-[11px] font-bold text-muted">
            {plural(visible.length, "exercise")}
            {query && ` matching “${query.trim()}”`}
          </p>
          <div className="space-y-1.5">
            {visible.map((stat) => (
              <ExerciseCard key={stat.key} stat={stat} onOpen={() => onOpenExercise(stat.key)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** One compact row: identity on the left, trend metrics on the right. */
export function ExerciseCard({ stat, onOpen }: { stat: ExerciseStat; onOpen: () => void }) {
  const trendColor = stat.trend > 0 ? "var(--color-done)" : stat.trend < 0 ? "var(--color-danger)" : "var(--t-muted)";
  const history = stat.history.slice(-8).map((h) => h.best);

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5 text-left transition active:scale-[0.99]"
    >
      <IconTile emoji={CATEGORY_EMOJI[categoryFor(stat.name)] ?? "🏋️"} tint="var(--t-accent)" size={34} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black leading-tight text-ink">{stat.name}</p>
        <p className="truncate text-[11px] font-bold text-muted">
          {plural(stat.sessions, "session")} · {stat.totalSets} sets
          {stat.lastDate && ` · ${formatShortDate(stat.lastDate)}`}
        </p>
        <p className="truncate text-[10px] font-bold text-muted">
          {stat.trendLabel} · stability {stat.stabilityScore} · {stat.confidence.toLowerCase()} confidence
        </p>
      </div>

      <Sparkline values={history} color={trendColor} width={48} height={20} />

      <div className="w-[68px] shrink-0 text-right">
        <p className="text-[13px] font-black leading-tight text-ink">{formatBest(stat)}</p>
        <p className="text-[11px] font-black leading-tight" style={{ color: trendColor }}>
          {Math.abs(stat.trend) < 0.005
            ? "rolling —"
            : `${stat.trend > 0 ? "▲" : "▼"} ${Math.abs(Math.round(stat.trend * 100))}%`}
        </p>
      </div>

      <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}
