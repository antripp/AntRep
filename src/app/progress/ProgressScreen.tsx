/**
 * Progress — one scoped dataset, three tabs.
 *
 *   Overview   the numbers: totals, trend chart, read-outs, balance, records
 *   Plans      the tables: sessions down the calendar, exercises across sessions
 *   Exercises  the movements: compact trend cards, tap through to a full page
 *
 * The plan selector sits above the tabs because it scopes all three. Everything
 * here is derived from sessions + logs, so the coach's athlete view renders the
 * identical component over the athlete's data.
 */

import { useMemo, useState } from "react";
import type { PlanBundle, Session, SetLog } from "../../data/types";
import { exerciseStats } from "../../domain/analytics";
import { restDayPredicate } from "../../domain/plan";
import { namesMatch, setHasData } from "../../domain/logging";
import { plural } from "../../domain/text";
import { Button, EmptyState, Icon, ScreenTitle, Segmented } from "../../ui/kit";
import { useWorkspace } from "../workspace";
import { ExerciseDetail } from "./ExerciseDetail";
import { ExercisesTab } from "./ExercisesTab";
import { OverviewTab } from "./OverviewTab";
import { PlansTab } from "./PlansTab";
import { SessionDetail } from "./SessionDetail";
import { groupSessionsByDay } from "../../domain/dayTrends";
import { DayDetail } from "./DayDetail";
import { DaysTab } from "./DaysTab";
import { useProgressScope } from "./useProgressScope";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "plans", label: "Plans" },
  { value: "days", label: "Days" },
  { value: "exercises", label: "Exercises" },
] as const;

export type ProgressTab = (typeof TABS)[number]["value"];

export default function ProgressScreen({ onBatchLog }: { onBatchLog?: (planId: string | null) => void }) {
  const { profile, sessions, logs, allBundles, clearExercise, clearSession } = useWorkspace();
  return (
    <ProgressBody
      sessions={sessions}
      logs={logs}
      plans={allBundles}
      weeklyGymGoal={profile.weekly_gym_goal}
      totalXp={profile.total_xp}
      onClearExercise={clearExercise}
      onClearSession={(session) => clearSession(session.id)}
      onBatchLog={onBatchLog}
    />
  );
}

/** Shared with the coach's athlete view — pass their data, get their Progress. */
export function ProgressBody({
  sessions: allSessions,
  logs: allLogs,
  plans = [],
  weeklyGymGoal,
  totalXp = 0,
  title = "Progress",
  initialTab = "overview",
  onClearSession,
  onClearExercise,
  onEditSession,
  onBatchLog,
}: {
  sessions: Session[];
  logs: SetLog[];
  /** Every plan the athlete has followed; those with sessions become scopes. */
  plans?: PlanBundle[];
  weeklyGymGoal: number;
  /** Drives the level bar that used to sit on Home. */
  totalXp?: number;
  /** Omit the heading when the host screen already has one. */
  title?: string | null;
  initialTab?: ProgressTab;
  onClearSession?: (session: Session) => Promise<void>;
  onClearExercise?: (session: Session, exerciseName: string) => Promise<void>;
  onEditSession?: (session: Session) => void;
  /** Offered only when plan-linked analytics contain missing set data. */
  onBatchLog?: (planId: string | null) => void;
}) {
  const [tab, setTab] = useState<ProgressTab>(initialTab);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Where the Plans tab is drilled to. It lives up here so a detail page can
  // take over the whole screen without losing the plan you came from.
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  const scope = useProgressScope({ sessions: allSessions, logs: allLogs, plans });
  const { activeBundle, scopePlans, sessions, logs } = scope;

  const incompletePlanSessions = useMemo(() => sessions.filter((session) => {
    if (!session.plan_id) return false;
    const sessionLogs = logs.filter((log) => log.session_id === session.id);
    const performed = sessionLogs.filter(setHasData);
    if (performed.length === 0) return true;
    return session.completed_names.some((name) =>
      !performed.some((log) => namesMatch(log.exercise_name, name)),
    );
  }), [sessions, logs]);
  const repairPlanId = activeBundle?.plan.id ?? incompletePlanSessions.find((session) => session.plan_id)?.plan_id ?? null;

  // The one derivation every tab needs — the exercise detail page reads it too,
  // so it lives above the tabs rather than inside each of them.
  const stats = useMemo(() => exerciseStats(sessions, logs), [sessions, logs]);

  // Rest days the plans schedule bridge a streak rather than breaking it.
  // Asked per date, not per weekday — a cycle plan's days off move around.
  const isRestDay = useMemo(
    () => restDayPredicate(plans.map((bundle) => ({ bundle }))),
    [plans],
  );

  const openStat = openKey ? (stats.find((s) => s.key === openKey) ?? null) : null;
  // Regrouped rather than stashed, so an import or a fresh log shows up in the
  // open day without having to back out and re-enter it.
  const dayGroups = useMemo(() => groupSessionsByDay(sessions, logs), [sessions, logs]);
  const openDay = openDayKey ? (dayGroups.find((g) => g.key === openDayKey) ?? null) : null;
  const openSession = openSessionId
    ? (sessions.find((s) => s.id === openSessionId) ?? null)
    : null;

  // The sessions the arrows step through: the rest of the same plan (or the
  // rest of the free work), newest first — the list the user drilled in from.
  const sessionSiblings = useMemo(() => {
    if (!openSession) return [];
    return sessions
      .filter((s) => (s.plan_id ?? null) === (openSession.plan_id ?? null))
      .sort(
        (a, b) => b.date.localeCompare(a.date) || b.started_at.localeCompare(a.started_at),
      );
  }, [sessions, openSession]);

  function changeScope(id: string) {
    // The chip is the outer control — narrowing it drops any drill-down below.
    scope.setScope(id);
    setOpenPlanId(null);
    setOpenSessionId(null);
    setOpenKey(null);
    setOpenDayKey(null);
  }

  if (openDay) {
    return (
      <DayDetail
        group={openDay}
        logs={logs}
        onBack={() => setOpenDayKey(null)}
        onOpenSession={setOpenSessionId}
        onOpenExercise={setOpenKey}
      />
    );
  }

  if (openStat) {
    return (
      <ExerciseDetail
        stat={openStat}
        sessions={sessions}
        logs={logs}
        scopeLabel={activeBundle ? activeBundle.plan.name : null}
        onBack={() => setOpenKey(null)}
      />
    );
  }

  if (openSession) {
    return (
      <SessionDetail
        session={openSession}
        sessions={sessions}
        logs={logs}
        bundle={plans.find((b) => b.plan.id === openSession.plan_id) ?? null}
        siblings={sessionSiblings}
        onSelectSession={setOpenSessionId}
        onBack={() => setOpenSessionId(null)}
        onOpenExercise={setOpenKey}
        onClearSession={onClearSession}
        onClearExercise={onClearExercise}
        onEditSession={
          onEditSession && openSession.plan_id && plans.some((plan) => plan.plan.id === openSession.plan_id)
            ? onEditSession
            : undefined
        }
      />
    );
  }

  if (allSessions.length === 0) {
    return (
      <>
        {title && <ScreenTitle title={title} />}
        <EmptyState
          title="Nothing logged yet"
          subtitle="Your charts appear after the first session."
          action={onBatchLog && plans.length > 0 ? (
            <Button onClick={() => onBatchLog(plans[0].plan.id)}>
              <Icon.edit className="h-4 w-4" /> Batch log a plan
            </Button>
          ) : undefined}
        />
      </>
    );
  }

  return (
    <>
      {title && <ScreenTitle title={title} />}

      {scopePlans.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Icon.plan className="h-3.5 w-3.5 text-muted" />
            <p className="text-[11px] font-black uppercase tracking-wide text-muted">Analytics for</p>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[{ id: "all", name: "Overall" }, ...scopePlans.map((b) => ({ id: b.plan.id, name: b.plan.name }))].map(
              (option) => (
                <button
                  key={option.id}
                  onClick={() => changeScope(option.id)}
                  aria-pressed={scope.scope === option.id}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-black transition ${
                    scope.scope === option.id
                      ? "bg-accent text-white"
                      : "border border-line bg-inset text-muted active:scale-[0.98]"
                  }`}
                >
                  {option.name}
                </button>
              ),
            )}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-muted">
            {activeBundle
              ? `${plural(sessions.length, "session")} against ${activeBundle.plan.name} — every tab below covers just this plan.`
              : "Everything logged, in and out of a plan."}
          </p>
        </div>
      )}

      {onBatchLog && repairPlanId && incompletePlanSessions.length > 0 && (
        <button
          type="button"
          onClick={() => onBatchLog(repairPlanId)}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--color-gold)_45%,var(--t-line))] bg-[color-mix(in_srgb,var(--color-gold)_12%,var(--t-surface))] px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <Icon.edit className="h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-ink">Review missing training data</span>
            <span className="block text-xs font-semibold text-muted">
              {plural(incompletePlanSessions.length, "planned session")} contain incomplete or missing set logs.
            </span>
          </span>
          <span className="shrink-0 text-xs font-black text-accent">Batch log</span>
          <Icon.chevron className="h-4 w-4 shrink-0 text-accent" />
        </button>
      )}

      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t }))} />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Nothing logged against this plan"
          subtitle="Switch back to Overall, or log a session under this plan."
          action={onBatchLog && activeBundle ? (
            <Button onClick={() => onBatchLog(activeBundle.plan.id)}>
              <Icon.edit className="h-4 w-4" /> Batch log this plan
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          {tab === "overview" && (
            <OverviewTab
              sessions={sessions}
              logs={logs}
              stats={stats}
              weeklyGymGoal={weeklyGymGoal}
              totalXp={totalXp}
              isRestDay={isRestDay}
              onOpenExercise={setOpenKey}
            />
          )}

          {tab === "plans" && (
            <PlansTab
              sessions={sessions}
              logs={logs}
              stats={stats}
              plans={plans}
              activeBundle={activeBundle}
              openPlanId={openPlanId}
              onOpenPlan={setOpenPlanId}
              onOpenSession={setOpenSessionId}
              onOpenExercise={setOpenKey}
            />
          )}

          {tab === "days" && (
            <DaysTab sessions={sessions} logs={logs} onOpenDay={setOpenDayKey} />
          )}

          {tab === "exercises" && <ExercisesTab stats={stats} onOpenExercise={setOpenKey} />}
        </>
      )}
    </>
  );
}
