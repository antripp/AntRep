/** Coach → one athlete: their week, their logs, their numbers, plan assignment. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../data";
import type { AthleteTraining, CoachWorkspace } from "../../data/api";
import type { LinkedAthlete, PlanAssignment, PlanBundle, Profile, Session } from "../../data/types";
import { formatShortDate, isoWeekday, localDate, weekdayLabel } from "../../domain/dates";
import { currentStreak, levelFor } from "../../domain/gamification";
import { coachFlags, offPlanCount, planAdherence } from "../../domain/adherence";
import { lifetimeTotals, recentRecords, exerciseStats, weeklySeries } from "../../domain/analytics";
import { compactKg } from "../../domain/text";
import { AdherenceBars, Sparkline } from "../../ui/charts";
import { loggedSessionIds, progressFor, sessionFor } from "../../domain/logging";
import {
  dayForDate,
  planEnd,
  planIsLive,
  resolveSegments,
  restDayPredicate,
  typeIcon,
} from "../../domain/plan";
import { plural } from "../../domain/text";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  IconTile,
  Pill,
  ProgressRing,
  SectionHeader,
  Segmented,
  Sheet,
  Spinner,
  StatTile,
} from "../../ui/kit";
import { ActivityFeed } from "../shared/ActivityFeed";
import { ProgressBody } from "../progress/ProgressScreen";
import { WeekStrip } from "../athlete/PlansScreen";
import { SessionList } from "../shared/SessionHistory";
import { PlanDetail } from "../plans/PlanDetail";
import {
  BoardLoading,
  CheckInsPanel,
  currentWeekIndex,
  NotesPanel,
  TrackersPanel,
  useCoachingBoard,
} from "../shared/CoachingPanels";
import { exportAthleteCsv, exportAthleteWorkbook } from "../../domain/export";
import { writeImport } from "../../data/importWriter";
import { ImportSheet } from "../shared/ImportSheet";
import { BatchLogPage } from "../shared/BatchLogSheet";
import { AthletePlanCustomizer } from "./AthletePlanCustomizer";

export default function AthleteDetailScreen({
  athlete,
  coach,
  workspace,
  onBack,
  onChanged,
  onToast,
}: {
  athlete: LinkedAthlete;
  coach: Profile;
  workspace: CoachWorkspace;
  onBack: () => void;
  onChanged: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [training, setTraining] = useState<AthleteTraining | null>(null);
  // Sessions and per-plan analytics live inside Progress now — "assign" is plan
  // management (send a plan, take one back), not another read on their numbers.
  const [view, setView] = useState<"overview" | "progress" | "assign" | "coaching">("overview");
  const [coachingView, setCoachingView] = useState<"chat" | "checkin" | "notes" | "trackers">("chat");
  const [viewingPlan, setViewingPlan] = useState<PlanBundle | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [customizing, setCustomizing] = useState<{
    template: PlanBundle;
    assignment: PlanAssignment;
  } | null>(null);

  const { board, loading: boardLoading, reload: reloadBoard } = useCoachingBoard(athlete.link.id);
  const weekIndex = currentWeekIndex(athlete.link.claimed_at);

  const load = useCallback(async () => {
    setTraining(await api.athleteTraining(athlete.profile.id));
  }, [athlete.profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date();
  const todayStr = localDate(today);
  const currentSessions = useMemo(
    () => (training?.sessions ?? []).filter((session) => session.date <= todayStr),
    [training, todayStr],
  );
  const todaySegments = useMemo(() => {
    if (!training) return [];
    // Only plans the athlete is actually following drive "today".
    return training.plans
      .filter((bundle) => bundle.plan.is_active && !bundle.plan.is_archived)
      .flatMap((bundle) => {
        const day = dayForDate(bundle, today);
        return day ? resolveSegments(bundle, day) : [];
      });
  }, [training, today]);

  // Streak and level are derived from the logs, not the stored profile counters,
  // so the coach always sees the same numbers the athlete does — including the
  // rest days of their plan, which bridge the chain instead of breaking it.
  const isRestDay = useMemo(
    () => restDayPredicate((training?.plans ?? []).map((bundle) => ({ bundle }))),
    [training],
  );
  // Recorded sets count as training even when nothing was ticked off.
  const loggedIds = useMemo(() => loggedSessionIds(training?.logs ?? []), [training]);
  const liveStreak = training
    ? currentStreak(training.sessions, isRestDay, today, loggedIds)
    : 0;
  const level = levelFor(athlete.profile.total_xp);

  const assignmentsForAthlete = workspace.assignments.filter((a) => a.athlete_id === athlete.profile.id);
  const otherCoachAssignments = (training?.assignments ?? []).filter((assignment) => {
    const bundle = training?.plans.find((plan) => plan.plan.id === assignment.plan_id);
    return Boolean(
      bundle &&
      bundle.plan.owner_id !== coach.id &&
      bundle.plan.owner_id !== athlete.profile.id,
    );
  });

  async function assign(planId: string) {
    await api.assignPlan(planId, athlete.profile.id, { activation_mode: "manual" });
    await Promise.all([onChanged(), load()]);
    onToast("Plan sent — the athlete syncs it from their Plans tab");
  }

  /**
   * Put the athlete back on a finished plan, starting today.
   *
   * Only the assignment moves — the plan itself is shared, so restarting it for
   * one athlete must not drag everyone else's dates with it.
   */
  async function restartFor(assignmentId: string, planName: string) {
    try {
      await api.setAssignmentDates(assignmentId, { start_date: todayStr, end_date: null });
      await api.setAssignmentStatus(assignmentId, "active", todayStr);
      await Promise.all([onChanged(), load()]);
      onToast(`${planName} restarted from today`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Couldn't restart that plan.");
    }
  }

  async function unassign(assignmentId: string) {
    await api.unassignPlan(assignmentId);
    await Promise.all([onChanged(), load()]);
    onToast("Plan removed");
  }

  async function clearAthleteSession(sessionId: string) {
    await api.deleteSession(sessionId);
    await load();
    onToast("Logged session cleared");
  }

  async function clearAthleteExercise(sessionId: string, exerciseName: string) {
    await api.clearExercise(sessionId, exerciseName);
    await load();
    onToast(`${exerciseName} sets cleared`);
  }

  if ((showBatch || editingSession !== null) && training) {
    return (
      <BatchLogPage
        onBack={() => {
          setShowBatch(false);
          setEditingSession(null);
        }}
        athleteId={athlete.profile.id}
        athleteName={athlete.profile.display_name || "this athlete"}
        initialDate={editingSession?.date ?? todayStr}
        initialPlanId={editingSession?.plan_id}
        plans={training.plans.map((bundle) => {
          const assignment = training.assignments.find((item) => item.plan_id === bundle.plan.id);
          return {
            bundle,
            start: assignment?.start_date ?? bundle.plan.start_date ?? todayStr,
            end: planEnd(bundle.plan, assignment),
          };
        })}
        sessions={training.sessions}
        logs={training.logs}
        onSaved={load}
        onToast={onToast}
      />
    );
  }

  if (viewingPlan) {
    const ownedAssignment = workspace.assignments.find(
      (assignment) =>
        assignment.plan_id === viewingPlan.plan.id && assignment.athlete_id === athlete.profile.id,
    );
    const ownedTemplate = workspace.plans.find((bundle) => bundle.plan.id === viewingPlan.plan.id);
    return (
      <PlanDetail
        bundle={viewingPlan}
        subtitle={`Followed by ${athlete.profile.display_name || "this athlete"}`}
        onClose={() => setViewingPlan(null)}
        footer={ownedAssignment && ownedTemplate ? (
          <Button
            full
            onClick={() => {
              setCustomizing({ template: ownedTemplate, assignment: ownedAssignment });
              setViewingPlan(null);
            }}
          >
            <Icon.edit className="h-4 w-4" /> Customize for {athlete.profile.display_name || "athlete"}
          </Button>
        ) : undefined}
      />
    );
  }

  if (customizing && training) {
    return (
      <AthletePlanCustomizer
        open
        athleteName={athlete.profile.display_name || "athlete"}
        template={customizing.template}
        assignment={customizing.assignment}
        coachId={coach.id}
        remarks={training.remarks}
        loggedSessions={training.sessions.filter((session) => loggedIds.has(session.id))}
        onClose={() => setCustomizing(null)}
        onSaved={async () => {
          await Promise.all([onChanged(), load()]);
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-ink">{athlete.profile.display_name || "Athlete"}</h1>
          <p className="text-xs font-bold text-muted">
            Level {level} · {liveStreak}-day streak
          </p>
        </div>
        <IconButton label="Import training" onClick={() => setShowImport(true)}>
          <Icon.plus className="h-4 w-4" />
        </IconButton>
        <IconButton label="Batch log plan" onClick={() => setShowBatch(true)}>
          <Icon.edit className="h-4 w-4" />
        </IconButton>
        <IconButton label="Export report" onClick={() => setShowExport(true)}>
          <Icon.share className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="mb-4">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "overview", label: "Overview" },
            { value: "progress", label: "Progress" },
            { value: "assign", label: "Plans" },
            { value: "coaching", label: "Coaching" },
          ]}
        />
      </div>

      {!training ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {view === "overview" && (
            <>
              <CoachOverview
                athleteName={athlete.profile.display_name || "This athlete"}
                training={training}
                weeklyGoal={athlete.profile.weekly_gym_goal}
                streak={liveStreak}
                today={today}
              />

              <SectionHeader title={`${weekdayLabel(isoWeekday(today))}'s work`} />
              {todaySegments.length === 0 ? (
                <EmptyState title="Nothing scheduled today" subtitle="Rest day, or no synced plan." />
              ) : (
                <div className="space-y-2">
                  {todaySegments.map((segment) => {
                    const session = sessionFor(training.sessions, segment, localDate(today));
                    const progress = progressFor(segment, today, session);
                    return (
                      <Card key={segment.id}>
                        <div className="flex items-center gap-3">
                          <IconTile emoji={typeIcon(segment.dayType, segment.day.icon_name)} tint={segment.color} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-ink">{segment.title}</p>
                            <p className="text-xs font-bold text-muted">
                              {progress.completed}/{progress.total} exercise
                              {progress.total === 1 ? "" : "s"}
                              {session?.status === "complete" && " · complete"}
                            </p>
                          </div>
                          <ProgressRing ratio={progress.ratio} size={40} stroke={6} color={segment.color} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              <SectionHeader title="Latest sessions" />
              <SessionList sessions={currentSessions} logs={training.logs} limit={4} />
            </>
          )}

          {view === "progress" && (
            <ProgressBody
              sessions={training.sessions}
              logs={training.logs}
              plans={training.plans}
              weeklyGymGoal={athlete.profile.weekly_gym_goal}
              totalXp={athlete.profile.total_xp}
              title={null}
              onClearSession={(session) => clearAthleteSession(session.id)}
              onClearExercise={(session, exerciseName) =>
                clearAthleteExercise(session.id, exerciseName)
              }
              onEditSession={setEditingSession}
              planRuns={training.plans.flatMap((bundle) => {
                const assignment = training.assignments.find((item) => item.plan_id === bundle.plan.id);
                const start = assignment?.start_date ?? bundle.plan.start_date;
                return start ? [{ bundle, start, end: planEnd(bundle.plan, assignment) }] : [];
              })}
              athleteId={athlete.profile.id}
              viewerId={coach.id}
              goals={training.goals}
              onSaveGoal={async (goal) => { await api.saveProgressGoal(goal); await load(); }}
              onDeleteGoal={async (id) => { await api.deleteProgressGoal(id); await load(); }}
            />
          )}

          {view === "coaching" && (
            <>
              <div className="mb-4">
                <Segmented
                  value={coachingView}
                  onChange={setCoachingView}
                  options={[
                    { value: "chat", label: "Activity" },
                    { value: "checkin", label: "Check-ins" },
                    { value: "notes", label: "Notes" },
                    { value: "trackers", label: "Trackers" },
                  ]}
                />
              </div>

              {boardLoading ? (
                <BoardLoading />
              ) : (
                <>
                  {coachingView === "chat" && (
                    <ActivityFeed
                      linkId={athlete.link.id}
                      board={board}
                      meProfileId={coach.id}
                      isCoach
                      otherName={athlete.profile.display_name || "your athlete"}
                      sessions={training.sessions}
                      logs={training.logs}
                      coachPlans={workspace.plans}
                      onChanged={reloadBoard}
                    />
                  )}
                  {coachingView === "checkin" && (
                    <CheckInsPanel
                      linkId={athlete.link.id}
                      board={board}
                      canSubmit={false}
                      weekIndex={weekIndex}
                      onChanged={reloadBoard}
                    />
                  )}
                  {coachingView === "notes" && (
                    <NotesPanel linkId={athlete.link.id} board={board} canEdit onChanged={reloadBoard} />
                  )}
                  {coachingView === "trackers" && (
                    <TrackersPanel linkId={athlete.link.id} board={board} canEdit onChanged={reloadBoard} />
                  )}
                </>
              )}
            </>
          )}

          {view === "assign" && (
            <>
              <SectionHeader title="Assigned by you" />
              {assignmentsForAthlete.length === 0 ? (
                <EmptyState title="No plan assigned" subtitle="Send one of your plans below." />
              ) : (
                <div className="space-y-2">
                  {assignmentsForAthlete.map((assignment) => {
                    const bundle = workspace.plans.find((p) => p.plan.id === assignment.plan_id);
                    if (!bundle) return null;
                    const athleteBundle = training.plans.find((p) => p.plan.id === assignment.plan_id) ?? bundle;
                    const customized = Object.keys(assignment.exercise_overrides ?? {}).length;
                    return (
                      <Card key={assignment.id}>
                        <div className="flex items-center gap-3">
                          <IconTile emoji="📋" tint="var(--t-accent)" />
                          <button className="min-w-0 flex-1 text-left" onClick={() => setViewingPlan(athleteBundle)}>
                            <p className="truncate text-sm font-black text-ink">{bundle.plan.name}</p>
                            <p className="text-xs font-bold text-muted">
                              {!planIsLive(bundle.plan, todayStr, assignment)
                                ? `Finished ${formatShortDate(
                                    planEnd(bundle.plan, assignment) ?? assignment.start_date ?? todayStr,
                                  )}`
                                : assignment.status === "active"
                                  ? `Synced ${assignment.accepted_at ? formatShortDate(assignment.accepted_at.slice(0, 10)) : ""}`
                                  : assignment.status === "declined"
                                    ? "Declined"
                                    : "Waiting for the athlete to sync"}
                              {customized > 0 && ` · ${plural(customized, "custom exercise")}`}
                            </p>
                          </button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setCustomizing({ template: bundle, assignment })}
                          >
                            Customize
                          </Button>
                          {/* Only the coach who wrote the plan can put an
                              athlete back on it. */}
                          {!planIsLive(bundle.plan, todayStr, assignment) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => restartFor(assignment.id, bundle.plan.name)}
                            >
                              Restart
                            </Button>
                          )}
                          <button className="text-xs font-black text-danger" onClick={() => unassign(assignment.id)}>
                            Remove
                          </button>
                        </div>
                        <WeekStrip bundle={athleteBundle} />
                      </Card>
                    );
                  })}
                </div>
              )}

              {otherCoachAssignments.length > 0 && (
                <>
                  <SectionHeader title="Assigned by other coaches" />
                  <div className="space-y-2">
                    {otherCoachAssignments.map((assignment) => {
                      const bundle = training.plans.find((plan) => plan.plan.id === assignment.plan_id);
                      if (!bundle) return null;
                      const owner = training.planOwners.find((profile) => profile.id === bundle.plan.owner_id);
                      return (
                        <Card key={assignment.id} onClick={() => setViewingPlan(bundle)}>
                          <div className="flex items-center gap-3">
                            <IconTile emoji="👀" tint="var(--t-muted)" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-ink">{bundle.plan.name}</p>
                              <p className="text-xs font-bold text-muted">
                                {owner?.display_name || "Another coach"} · {assignment.status === "active" ? "active" : assignment.status}
                              </p>
                            </div>
                            <Pill tint="var(--t-muted)">Read only</Pill>
                          </div>
                          <WeekStrip bundle={bundle} />
                          <p className="mt-2 text-[10px] font-semibold text-muted">
                            Visible because you coach {athlete.profile.display_name || "this athlete"}. Only the plan owner can change its schedule, workload, or remarks.
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}

              <SectionHeader title="Send another plan" />
              {workspace.plans.length === 0 ? (
                <EmptyState title="No plans built yet" subtitle="Create one in the Plans tab first." />
              ) : (
                <div className="space-y-2">
                  {workspace.plans
                    .filter((bundle) => !assignmentsForAthlete.some((a) => a.plan_id === bundle.plan.id))
                    .map((bundle) => (
                      <Card key={bundle.plan.id}>
                        <div className="flex items-center gap-3">
                          <IconTile emoji="🗓️" tint="var(--t-accent)" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-ink">{bundle.plan.name}</p>
                            <p className="text-xs font-bold text-muted">
                              {bundle.plan.weeks} week{bundle.plan.weeks === 1 ? "" : "s"} ·{" "}
                              {plural(bundle.exercises.length, "exercise")}
                            </p>
                          </div>
                          <Button size="sm" onClick={() => assign(bundle.plan.id)}>
                            <Icon.send className="h-4 w-4" /> Assign
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              )}

              {training.plans.some((b) => b.plan.owner_id === athlete.profile.id) && (
                <>
                  <SectionHeader title="Their own plans" />
                  <div className="space-y-2">
                    {training.plans
                      .filter((b) => b.plan.owner_id === athlete.profile.id)
                      .map((bundle) => (
                        <Card key={bundle.plan.id} onClick={() => setViewingPlan(bundle)}>
                          <div className="flex items-center gap-3">
                            <IconTile emoji="🧑‍💻" tint="var(--t-muted)" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-ink">{bundle.plan.name}</p>
                              <p className="text-xs font-bold text-muted">Built by the athlete</p>
                            </div>
                            {bundle.plan.is_active && <Pill tint="var(--t-accent)">Active</Pill>}
                          </div>
                          <WeekStrip bundle={bundle} />
                        </Card>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <p className="mt-8 text-center text-[11px] font-bold text-muted">
        Coached by {coach.display_name || "you"}
      </p>

      {showExport && (
        <Sheet open onClose={() => setShowExport(false)} title="Export report">
          <p className="mb-3 text-xs font-semibold leading-snug text-muted">
            Everything {athlete.profile.display_name || "this athlete"} has shared: sessions, every set,
            per-exercise records, check-ins, trackers and your notes.
          </p>
          <div className="space-y-2">
            <Button
              full
              onClick={() => {
                if (!training) return;
                exportAthleteWorkbook({
                  athleteName: athlete.profile.display_name || "athlete",
                  sessions: training.sessions,
                  logs: training.logs,
                  board,
                });
                setShowExport(false);
                onToast("Workbook downloaded");
              }}
            >
              Excel workbook (.xlsx)
            </Button>
            <Button
              full
              variant="secondary"
              onClick={() => {
                if (!training) return;
                exportAthleteCsv({
                  athleteName: athlete.profile.display_name || "athlete",
                  sessions: training.sessions,
                  logs: training.logs,
                });
                setShowExport(false);
                onToast("CSV downloaded");
              }}
            >
              Set-by-set CSV
            </Button>
          </div>
        </Sheet>
      )}

      {/* Importing on an athlete's behalf: adds history they never logged, and
          skips anything already in their log — a coach can add, never erase. */}
      <ImportSheet
        open={showImport}
        onClose={() => setShowImport(false)}
        bundles={(training?.plans ?? []).map((bundle) => ({ bundle }))}
        existingSessions={training?.sessions ?? []}
        onImport={async (batch, onProgress) => {
          const outcome = await writeImport({
            athleteId: athlete.profile.id,
            batch,
            allowUpdateExisting: false,
            onProgress,
          });
          await load();
          return outcome;
        }}
        onToast={onToast}
      />

    </>
  );
}

/** The coach's read on one athlete: are they training, and is it working? */
function CoachOverview({
  athleteName,
  training,
  weeklyGoal,
  streak,
  today,
}: {
  athleteName: string;
  training: AthleteTraining;
  weeklyGoal: number;
  streak: number;
  today: Date;
}) {
  const cutoff = localDate(today);
  const currentSessions = useMemo(
    () => training.sessions.filter((session) => session.date <= cutoff),
    [training.sessions, cutoff],
  );
  const plans = useMemo(
    () =>
      training.plans
        .map((bundle) => ({
          bundle,
          assignment: training.assignments.find((a) => a.plan_id === bundle.plan.id),
        }))
        .filter(({ bundle, assignment }) =>
          !bundle.plan.is_archived && assignment?.status === "active" && Boolean(assignment.start_date),
        )
        .map(({ bundle, assignment }) => ({
          bundle,
          // Weeks before this athlete joined the plan aren't their misses.
          start: assignment!.start_date!,
        })),
    [training.plans, training.assignments],
  );

  const logged = useMemo(() => loggedSessionIds(training.logs), [training.logs]);
  const adherence = useMemo(
    () => planAdherence(plans, training.sessions, 4, today, logged),
    [plans, training.sessions, today, logged],
  );
  const flags = useMemo(
    () =>
      coachFlags({
        plans,
        sessions: training.sessions,
        logs: training.logs,
        weeklyGoal,
        today,
      }),
    [plans, training.sessions, training.logs, weeklyGoal, today],
  );

  const series = useMemo(
    () => weeklySeries(training.sessions, training.logs, 8, today),
    [training.sessions, training.logs, today],
  );
  const totals = useMemo(
    () => lifetimeTotals(training.sessions, training.logs, today),
    [training.sessions, training.logs, today],
  );
  const records = useMemo(
    () => recentRecords(exerciseStats(training.sessions, training.logs), 21, today),
    [training.sessions, training.logs, today],
  );

  const thisWeek = adherence.at(-1);
  const lastSession = currentSessions.reduce<string | null>(
    (newest, s) => (!newest || s.date > newest ? s.date : newest),
    null,
  );
  const offPlan = offPlanCount(currentSessions, logged);
  const doneRatio = thisWeek && thisWeek.planned > 0 ? thisWeek.completed / thisWeek.planned : 0;

  return (
    <>
      <Card className="mb-3">
        <div className="flex items-center gap-4">
          <ProgressRing
            ratio={doneRatio}
            label={thisWeek ? `${thisWeek.completed}/${thisWeek.planned}` : "—"}
            sublabel="this week"
            size={78}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">
              {thisWeek && thisWeek.planned > 0
                ? `${Math.round(doneRatio * 100)}% of the plan done`
                : "No plan scheduled this week"}
            </p>
            <p className="mt-0.5 text-xs font-bold text-muted">
              {lastSession ? `Last session ${formatShortDate(lastSession)}` : "No sessions yet"} ·{" "}
              {streak}-day streak
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Sparkline values={series.map((p) => p.volume)} />
              <span className="text-[11px] font-bold text-muted">
                {compactKg(series.at(-1)?.volume ?? 0)} kg this week
              </span>
            </div>
          </div>
        </div>
      </Card>

      {flags.length > 0 && (
        <div className="mb-3 space-y-2">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className="flex items-start gap-2 rounded-2xl px-3 py-2"
              style={{
                background:
                  flag.tone === "good"
                    ? "color-mix(in srgb, var(--color-done) 14%, transparent)"
                    : flag.tone === "warn"
                      ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
                      : "var(--t-inset)",
              }}
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{
                  background:
                    flag.tone === "good"
                      ? "var(--color-done)"
                      : flag.tone === "warn"
                        ? "var(--color-danger)"
                        : "var(--t-muted)",
                }}
              />
              <div className="min-w-0">
                <p className="text-xs font-black text-ink">{flag.title}</p>
                <p className="text-[11px] font-semibold text-muted">{flag.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Plan adherence" />
      <Card>
        <AdherenceBars weeks={adherence} />
        <p className="mt-2 text-[11px] font-semibold text-muted">
          Filled bars are planned sessions completed; the faint bar on top is work {athleteName} logged
          outside the plan{offPlan > 0 ? ` (${offPlan} all time)` : ""}.
        </p>
      </Card>

      <SectionHeader title="Totals" />
      <Card>
        <div className="flex gap-2">
          <StatTile value={totals.volume.toLocaleString()} label="kg lifted" />
          <StatTile value={String(totals.sessions)} label="sessions" />
          <StatTile value={String(totals.sets)} label="sets" />
          <StatTile value={`${totals.distanceKm}`} label="km" />
        </div>
      </Card>

      {records.length > 0 && (
        <>
          <SectionHeader title="Records in the last 3 weeks" icon={<Icon.trophy className="h-4 w-4" />} />
          <div className="space-y-2">
            {records.slice(0, 4).map((record) => (
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
    </>
  );
}
