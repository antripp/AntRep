/**
 * One exercise, full page — promoted from the old bottom sheet so there's room
 * for the chart, the record line and every set ever logged against it.
 */

import { Fragment, useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import type { Session, SetLog } from "../../data/types";
import type { ExerciseStat } from "../../domain/analytics";
import { formatShortDate } from "../../domain/dates";
import { nameKey, setHasData } from "../../domain/logging";
import { bestUnit, formatSetCell } from "../../domain/planLog";
import { plural } from "../../domain/text";
import { LineChart } from "../../ui/charts";
import { Card, Icon, IconButton, IconTile, Pill, SectionHeader, Segmented, StatTile } from "../../ui/kit";
import { CATEGORY_EMOJI } from "./ExercisesTab";

const VIEWS = [
  { value: "best", label: "Best" },
  { value: "volume", label: "Volume" },
  { value: "reps", label: "Reps" },
] as const;

type ViewKey = (typeof VIEWS)[number]["value"];

export function ExerciseDetail({
  stat,
  sessions,
  logs,
  scopeLabel,
  onBack,
}: {
  stat: ExerciseStat;
  sessions: Session[];
  logs: SetLog[];
  /** Plan the Progress screen is scoped to, shown so the numbers aren't a mystery. */
  scopeLabel: string | null;
  onBack: () => void;
}) {
  const [view, setView] = useState<ViewKey>("best");
  const [openDate, setOpenDate] = useState<string | null>(stat.lastDate);

  const unit = bestUnit(stat.logType, stat.hasWeight) || "reps";

  // Every set of this exercise, grouped by the day it was logged.
  const setsByDate = useMemo(() => {
    const dateOf = new Map(sessions.map((s) => [s.id, s.date] as const));
    const grouped = new Map<string, SetLog[]>();
    for (const log of logs) {
      if (nameKey(log.exercise_name) !== stat.key || !setHasData(log)) continue;
      const date = dateOf.get(log.session_id);
      if (!date) continue;
      grouped.set(date, [...(grouped.get(date) ?? []), log]);
    }
    for (const sets of grouped.values()) sets.sort((a, b) => a.set_index - b.set_index);
    return grouped;
  }, [logs, sessions, stat.key]);

  const peak = useMemo(
    () =>
      stat.history.reduce<{ date: string; best: number } | null>(
        (top, h) => (!top || h.best > top.best ? h : top),
        null,
      ),
    [stat.history],
  );

  const chart = stat.history.slice(-14).map((h) => ({
    label: formatShortDate(h.date),
    value: view === "best" ? h.best : view === "volume" ? h.volume : h.reps,
    detail: `${formatShortDate(h.date)} · ${Math.round(h.best * 10) / 10} ${unit} best · ${Math.round(
      h.volume,
    )} kg volume`,
  }));

  const recent = [...stat.history].reverse();

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back to exercises" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <IconTile emoji={CATEGORY_EMOJI[categoryFor(stat.name)] ?? "🏋️"} tint="var(--t-accent)" size={36} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black leading-tight text-ink">{stat.name}</h1>
          <p className="truncate text-xs font-bold text-muted">
            {categoryFor(stat.name)}
            {scopeLabel ? ` · within ${scopeLabel}` : ""}
          </p>
        </div>
      </div>

      <Card className="mb-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={`${Math.round(stat.best * 10) / 10}`} label={`best ${unit}`} />
          <StatTile value={String(stat.sessions)} label="sessions" />
          <StatTile value={String(stat.totalSets)} label="sets" />
          <StatTile value={Math.round(stat.volume).toLocaleString()} label="kg volume" />
        </div>
        {(stat.best1RM > 0 || stat.bestReps > 0) && (
          <p className="mt-2 text-center text-[11px] font-bold text-muted">
            {stat.best1RM > 0 && `Best estimated 1RM ${Math.round(stat.best1RM * 10) / 10} kg`}
            {stat.best1RM > 0 && stat.bestReps > 0 && " · "}
            {stat.bestReps > 0 && `Most reps in a set ${stat.bestReps}`}
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-2">
          <Segmented value={view} onChange={setView} options={VIEWS.map((v) => ({ ...v }))} />
        </div>
        <LineChart
          data={chart}
          format={(v) => (view === "best" ? `${Math.round(v * 10) / 10} ${unit}` : String(Math.round(v)))}
          emptyMessage="Log this twice and the trend line appears."
        />
        {peak && (
          <p className="mt-1 text-center text-[11px] font-bold text-muted">
            Peak {Math.round(peak.best * 10) / 10} {unit} on {formatShortDate(peak.date)}
          </p>
        )}
      </Card>

      <SectionHeader title={`History — ${plural(stat.history.length, "session")}`} />

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr>
                {["Date", `Best ${unit}`, "Sets", "Reps", "Volume"].map((label, i) => (
                  <th
                    key={label}
                    className={`border-b border-line px-3 py-2 text-[10px] font-black uppercase tracking-wide text-muted ${
                      i === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {recent.map((entry, i) => {
                const sets = setsByDate.get(entry.date) ?? [];
                const expanded = openDate === entry.date;
                const isPeak = peak?.date === entry.date && stat.history.length > 1;
                const background =
                  i % 2 === 1
                    ? "color-mix(in srgb, var(--t-inset) 45%, var(--t-surface))"
                    : "var(--t-surface)";

                return (
                  <Fragment key={entry.date}>
                    <tr
                      onClick={() => setOpenDate(expanded ? null : entry.date)}
                      className="cursor-pointer"
                      style={{ background }}
                    >
                      <td className="whitespace-nowrap border-b border-line px-3 py-2 text-[12px] font-bold text-muted">
                        <span className="flex items-center gap-1.5">
                          <Icon.chevron
                            className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                          {formatShortDate(entry.date)}
                          {isPeak && <Icon.star className="h-3.5 w-3.5 text-gold" />}
                        </span>
                      </td>
                      <td className="border-b border-line px-3 py-2 text-right text-[12px] font-black text-ink">
                        {Math.round(entry.best * 10) / 10}
                      </td>
                      <td className="border-b border-line px-3 py-2 text-right text-[12px] font-bold text-ink">
                        {sets.length}
                      </td>
                      <td className="border-b border-line px-3 py-2 text-right text-[12px] font-bold text-ink">
                        {entry.reps || "—"}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-3 py-2 text-right text-[12px] font-bold text-muted">
                        {entry.volume > 0 ? `${Math.round(entry.volume).toLocaleString()} kg` : "—"}
                      </td>
                    </tr>

                    {expanded && (
                      <tr style={{ background }}>
                        <td className="border-b border-line px-3 py-2" colSpan={5}>
                          <div className="flex flex-wrap gap-1.5">
                            {sets.length === 0 ? (
                              <span className="text-[11px] font-semibold text-muted">
                                Marked done, but no numbers recorded.
                              </span>
                            ) : (
                              sets.map((set) => (
                                <Pill key={set.id} tint="var(--t-muted)">
                                  {set.set_index}: {formatSetCell(set, stat.logType)}
                                  {set.rpe ? ` · RPE ${set.rpe}` : ""}
                                </Pill>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
