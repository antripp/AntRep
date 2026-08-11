/**
 * One exercise, full page — promoted from the old bottom sheet so there's room
 * for the chart, the record line and every set ever logged against it.
 */

import { Fragment, useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import type { ProgressGoal, Session, SetLog } from "../../data/types";
import type { ExerciseStat } from "../../domain/analytics";
import { formatShortDate } from "../../domain/dates";
import { nameKey, setHasData } from "../../domain/logging";
import { bestUnit, formatSetCell } from "../../domain/planLog";
import { plural } from "../../domain/text";
import { LineChart } from "../../ui/charts";
import { Card, Icon, IconButton, IconTile, Pill, SectionHeader, Segmented, StatTile } from "../../ui/kit";
import { CATEGORY_EMOJI } from "./ExercisesTab";
import { CATEGORY_COLORS } from "./palette";
import { MetricTrendGrid } from "./MetricTrendGrid";
import type { ProgressPlanRun } from "../../domain/consistency";
import { GoalProgressCard, ProgressGoalEditor, type GoalContextOption } from "./ProgressGoalEditor";

const VIEWS = [
  { value: "best", label: "Best" },
  { value: "e1rm", label: "Estimated max" },
  { value: "retention", label: "Later-set strength" },
  { value: "volume", label: "Total work" },
  { value: "rpe", label: "Effort" },
] as const;

type ViewKey = (typeof VIEWS)[number]["value"];

export function ExerciseDetail({
  stat,
  sessions,
  logs,
  scopeLabel,
  onBack,
  weeklyGoal,
  planRuns,
  athleteId,
  viewerId,
  goals = [],
  onSaveGoal,
  onDeleteGoal,
}: {
  stat: ExerciseStat;
  sessions: Session[];
  logs: SetLog[];
  /** Plan the Progress screen is scoped to, shown so the numbers aren't a mystery. */
  scopeLabel: string | null;
  onBack: () => void;
  weeklyGoal: number;
  planRuns: ProgressPlanRun[];
  athleteId?: string;
  viewerId?: string;
  goals?: ProgressGoal[];
  onSaveGoal?: (goal: ProgressGoal) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}) {
  const [view, setView] = useState<ViewKey>("best");
  const [openDate, setOpenDate] = useState<string | null>(stat.lastDate);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ProgressGoal | null>(null);

  const unit = bestUnit(stat.logType, stat.hasWeight) || "reps";
  const exerciseCategory = categoryFor(stat.name);
  const tint = CATEGORY_COLORS[exerciseCategory];
  const goalContexts = useMemo<GoalContextOption[]>(() => [
    { scopeType: "exercise", key: stat.key, label: stat.name },
  ], [stat.key, stat.name]);
  const exerciseGoals = goals.filter((goal) => goal.scope_type === "exercise" && goal.scope_key === stat.key && goal.status === "active");

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
      stat.history.filter((entry) => !entry.future).reduce<{ date: string; best: number } | null>(
        (top, h) => (!top || h.best > top.best ? h : top),
        null,
      ),
    [stat.history],
  );

  const chart = stat.history.filter((entry) => !entry.future).slice(-14).filter((entry) => view !== "rpe" || entry.avgRpe !== null).map((h) => ({
    label: formatShortDate(h.date),
    value: view === "best" ? h.best : view === "e1rm" ? h.e1RM : view === "retention" ? (h.retention ?? 0) * 100 : view === "rpe" ? (h.avgRpe ?? 0) : h.volume,
    detail: `${formatShortDate(h.date)} · ${Math.round(h.best * 10) / 10} ${unit} best${
      h.e1RM > 0 ? ` · ${Math.round(h.e1RM * 10) / 10} kg estimated max` : ""
    }${h.retention !== null ? ` · ${Math.round(h.retention * 100)}% later-set strength kept` : ""}`,
  }));

  const recent = [...stat.history].reverse();
  const exerciseContext = useMemo(() => {
    const exerciseLogs = logs.filter((log) => nameKey(log.exercise_name) === stat.key && setHasData(log));
    const ids = new Set(exerciseLogs.map((log) => log.session_id));
    return {
      logs: exerciseLogs,
      sessions: sessions.filter((session) => ids.has(session.id)),
    };
  }, [logs, sessions, stat.key]);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back to exercises" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <IconTile emoji={CATEGORY_EMOJI[exerciseCategory] ?? "🏋️"} tint={tint} size={36} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black leading-tight text-ink">{stat.name}</h1>
          <p className="truncate text-xs font-bold text-muted">
            {exerciseCategory}
            {scopeLabel ? ` · within ${scopeLabel}` : ""}
          </p>
        </div>
        {athleteId && viewerId && onSaveGoal && (
          <button
            type="button"
            onClick={() => { setEditingGoal(null); setGoalOpen(true); }}
            className="shrink-0 rounded-full bg-accent px-3 py-2 text-xs font-black text-white"
          >Set PR goal</button>
        )}
      </div>

      <Card className="mb-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={`${Math.round(stat.best * 10) / 10}`} label={`best ${unit}`} />
          <StatTile value={String(stat.sessions)} label="sessions" />
          <StatTile value={String(stat.totalSets)} label="sets" />
          <StatTile value={Math.round(stat.volume).toLocaleString()} label="kg total work" />
        </div>
        {(stat.best1RM > 0 || stat.bestReps > 0) && (
          <p className="mt-2 text-center text-[11px] font-bold text-muted">
            {stat.best1RM > 0 && `Estimated max lift ${Math.round(stat.best1RM * 10) / 10} kg`}
            {stat.best1RM > 0 && stat.bestReps > 0 && " · "}
            {stat.bestReps > 0 && `Most reps in a set ${stat.bestReps}`}
          </p>
        )}
      </Card>

      {exerciseGoals.length > 0 && (
        <>
          <SectionHeader title="Personal record goals" />
          <div className="mb-3 space-y-2">
            {exerciseGoals.map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                current={exerciseGoalCurrent(goal, stat)}
                color={tint}
                onEdit={onSaveGoal ? () => { setEditingGoal(goal); setGoalOpen(true); } : undefined}
              />
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Performance profile" />
      <Card className="mb-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SignalTile
            label={stat.logType === "cardio" ? "Output" : stat.logType === "timed" ? "Duration" : "Strength"}
            value={formatChange(stat.strengthTrend)}
            detail="rolling change"
            positive={stat.strengthTrend}
          />
          <SignalTile
            label="Endurance"
            value={stat.setRetention === null ? "Building" : `${Math.round(stat.setRetention * 100)}%`}
            detail="strength kept after the first set"
            positive={stat.enduranceTrend}
          />
          <SignalTile
            label="Stability"
            value={`${stat.stabilityScore}/100`}
            detail="baseline repeatability"
            positive={(stat.stabilityScore - 60) / 100}
          />
          <SignalTile
            label="Trend"
            value={stat.trendLabel}
            detail={`${stat.confidence} confidence`}
            positive={stat.strengthTrend}
          />
        </div>
        <p className="mt-3 rounded-xl bg-inset px-3 py-2 text-xs font-bold leading-snug text-ink">
          {exerciseTakeaway(stat)}
        </p>
        {stat.futureSessions > 0 && (
          <p className="mt-2 rounded-xl bg-inset px-2.5 py-2 text-[11px] font-semibold text-muted">
            {stat.futureSessions} future/simulation observation{stat.futureSessions === 1 ? " is" : "s are"} visible
            in the history below but excluded from this performance profile.
          </p>
        )}
      </Card>

      <MetricTrendGrid
        sessions={exerciseContext.sessions}
        logs={exerciseContext.logs}
        weeklyGoal={weeklyGoal}
        title="Exercise metric trends"
        planRuns={planRuns}
      />

      <Card>
        <div className="mb-2">
          <Segmented
            value={view}
            onChange={setView}
            options={VIEWS.filter((option) => option.value !== "e1rm" || stat.best1RM > 0).map((option) => ({ ...option }))}
          />
        </div>
        <LineChart
          data={chart}
          color={tint}
          format={(v) => view === "best"
            ? `${Math.round(v * 10) / 10} ${unit}`
            : view === "e1rm"
              ? `${Math.round(v * 10) / 10} kg`
              : view === "retention"
                ? `${Math.round(v)}%`
                : view === "rpe"
                  ? `Effort ${Math.round(v * 10) / 10}/10`
                : `${Math.round(v).toLocaleString()} kg`}
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
                {["Date", `Best ${unit}`, "Sets", "Reps", "Total work"].map((label, i) => (
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
                          {entry.future && <Pill tint="var(--color-gold)">Simulation</Pill>}
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
                                  {set.rpe ? ` · Effort ${set.rpe}/10` : ""}
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

      {athleteId && viewerId && onSaveGoal && (
        <ProgressGoalEditor
          open={goalOpen}
          goal={editingGoal}
          athleteId={athleteId}
          viewerId={viewerId}
          contexts={goalContexts}
          defaultContext={goalContexts[0]}
          defaultTargetType={stat.hasWeight ? "weight" : "reps"}
          suggestedTargetValue={stat.hasWeight
            ? Math.max(1, Math.ceil(stat.best * 1.05 / 2.5) * 2.5)
            : Math.max(1, Math.ceil(stat.bestReps * 1.1))}
          metric={editingGoal?.metric ?? "exercise_pr"}
          onClose={() => setGoalOpen(false)}
          onSave={onSaveGoal}
          onDelete={onDeleteGoal}
        />
      )}
    </>
  );
}

function exerciseGoalCurrent(goal: ProgressGoal, stat: ExerciseStat): number {
  if (goal.target_type === "reps") return stat.bestReps;
  if (goal.target_type === "estimated_max") return stat.best1RM;
  if (goal.target_type === "weight") return stat.best;
  return Math.max(0, Math.min(100, Math.round(50 + stat.strengthTrend * 250)));
}

function SignalTile({
  label,
  value,
  detail,
  positive,
}: {
  label: string;
  value: string;
  detail: string;
  positive: number;
}) {
  const tint = positive > 0.015 ? "var(--color-done)" : positive < -0.025 ? "var(--color-danger)" : "var(--t-accent)";
  return (
    <div className="rounded-2xl bg-inset p-2.5">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-black leading-tight" style={{ color: tint }}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-tight text-muted">{detail}</p>
    </div>
  );
}

function formatChange(change: number): string {
  if (Math.abs(change) < 0.005) return "Stable";
  return `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`;
}

function exerciseTakeaway(stat: ExerciseStat): string {
  if (stat.confidence === "Building") {
    return `Keep the setup consistent for ${stat.name}; a few more exposures are needed before the trend is reliable.`;
  }
  if (stat.setRetention !== null && stat.setRetention < 0.75) {
    return `Later sets retain ${Math.round(stat.setRetention * 100)}% of opening output. Consider a slightly lighter start or longer rests if even quality is the goal.`;
  }
  if (stat.strengthTrend >= 0.025) {
    return `Repeatable output is up ${Math.round(stat.strengthTrend * 100)}% across rolling sessions — progress is broader than a single best set.`;
  }
  if (stat.stabilityScore < 60) {
    return "Performance varies from session to session. Compare setup, exercise order, rest time and effort before changing the goal.";
  }
  if (stat.strengthTrend <= -0.04) {
    return "Several recent exposures are below the earlier baseline. Review fatigue and execution before treating this as lost strength.";
  }
  return `Performance is holding with ${stat.stabilityScore}/100 repeatability. A small progression is reasonable while effort and technique stay controlled.`;
}
