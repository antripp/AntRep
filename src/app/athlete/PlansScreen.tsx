/** Plans — sync what a coach assigned, or build your own. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDraft } from "../usePersisted";
import { api } from "../../data";
import { makePlan, makePreset, newId } from "../../data/factories";
import type { AssignedPlan, PlanBundle, Session } from "../../data/types";
import { addDays, formatShortDate, localDate, parseDate } from "../../domain/dates";
import {
  blockCount,
  emptyDays,
  isCyclePlan,
  planEnd,
  planDurationDays,
  planIsLive,
  planSlots,
  planSplitLengths,
  planSplitRests,
  resolveSegments,
  slotIndex,
  slotLabel,
  typeColor,
  typeIcon,
} from "../../domain/plan";
import { plural } from "../../domain/text";
import { loggedSessionIds } from "../../domain/logging";
import { timelineImpacts } from "../../domain/timelineSafety";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconTile,
  Pill,
  ScreenTitle,
  SectionHeader,
  Segmented,
  Spinner,
  Field,
  Sheet,
  TextField,
} from "../../ui/kit";
import { PlanDetail } from "../plans/PlanDetail";
import { PlanEditor } from "../plans/PlanEditor";
import { useWorkspace } from "../workspace";

type PlanTab = "active" | "coaches" | "mine" | "past";

export default function PlansScreen({
  onBatchLog,
  context = "athlete",
}: {
  onBatchLog: (planId: string) => void;
  context?: "athlete" | "coach-training";
}) {
  const { profile, workspace, sessions, logs, reload, showToast } = useWorkspace();
  const loggedIds = loggedSessionIds(logs);
  // A plan is a lot of typing. Keep it across reloads, per profile, and drop it
  // only once it has actually reached the server.
  const plan = useDraft<PlanBundle>(`plan-draft:${profile.id}`);
  const draft = plan.value;
  const setDraft = plan.set;
  const [viewing, setViewing] = useState<PlanBundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<PlanTab>("active");
  const [activating, setActivating] = useState<PlanBundle | null>(null);

  // Say so when work comes back, or a restored draft looks like a bug.
  const announced = useRef(false);
  useEffect(() => {
    if (plan.restored && plan.value && !announced.current) {
      announced.current = true;
      showToast("Picked up your unsaved plan");
    }
  }, [plan.restored, plan.value, showToast]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.savePlan(draft);
      // Only drop the local draft once the server has actually taken it —
      // otherwise a failed save quietly throws the plan away.
      plan.discard();
      await reload();
      showToast("Plan saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't save that plan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft) return;
    try {
      await api.deletePlan(draft.plan.id);
      plan.discard();
      await reload();
      showToast("Plan deleted");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't delete that plan.");
    }
  }

  // A plan is "past" once its end date has gone by, or it was switched off.
  const today = localDate();
  const runningOwn = workspace.ownPlans.filter(
    (b) => !b.plan.is_archived && planIsLive(b.plan, today),
  );
  const pastOwn = workspace.ownPlans.filter(
    (b) => !b.plan.is_archived && b.plan.is_active && Boolean(b.plan.start_date) && !planIsLive(b.plan, today),
  );
  const ownTemplates = workspace.ownPlans.filter(
    (b) => !b.plan.is_archived && (!b.plan.is_active || !b.plan.start_date),
  );
  const currentAssigned = workspace.assigned.filter(({ assignment }) =>
    assignment.status !== "declined" && (!assignment.end_date || assignment.end_date >= today),
  );
  const activeAssigned = currentAssigned.filter(({ assignment }) => assignment.status === "active");
  const pastAssigned = workspace.assigned.filter(({ assignment }) =>
    assignment.status === "declined" || Boolean(assignment.end_date && assignment.end_date < today),
  );
  const coachGroups = useMemo(() => {
    const groups = new Map<string, { name: string; plans: AssignedPlan[] }>();
    for (const assigned of currentAssigned) {
      const key = assigned.coach?.id ?? assigned.bundle.plan.owner_id;
      const name = assigned.coach?.display_name || "Coach";
      const group = groups.get(key) ?? { name, plans: [] };
      group.plans.push(assigned);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
  }, [currentAssigned]);

  function createPlan() {
    const plan = makePlan(profile.id, {
      name: "My plan",
      start_date: null,
      end_date: null,
      is_active: false,
    });
    setDraft({ plan, days: emptyDays(plan, 1, newId), segments: [], exercises: [] });
  }

  /**
   * Run a finished plan again from today.
   *
   * The end date is cleared rather than pushed out by the old duration: how
   * long it ran last time says nothing about how long you want it now, and an
   * end date silently reappearing weeks later is worse than none.
   */
  async function restartPlan(bundle: PlanBundle) {
    try {
      const plan = {
        ...bundle.plan,
        start_date: localDate(),
        end_date: null,
        is_active: true,
        is_archived: false,
      };
      await api.savePlan({ ...bundle, plan });
      await reload();
      showToast(`${plan.name} restarted from today`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't restart that plan.");
    }
  }

  async function activateOwnPlan(bundle: PlanBundle, startDate: string) {
    try {
      const endDate = localDate(addDays(parseDate(startDate), planDurationDays(bundle.plan) - 1));
      await api.savePlan({
        ...bundle,
        plan: { ...bundle.plan, start_date: startDate, end_date: endDate, is_active: true, is_archived: false },
      });
      setActivating(null);
      await reload();
      showToast(startDate === localDate() ? `${bundle.plan.name} is active now` : `${bundle.plan.name} scheduled for ${formatShortDate(startDate)}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't activate that plan.");
    }
  }

  async function syncPlan(assignmentId: string, status: "active" | "declined") {
    try {
      const assignment = workspace.assigned.find((item) => item.assignment.id === assignmentId)?.assignment;
      await api.setAssignmentStatus(
        assignmentId,
        status,
        status === "active" && !assignment?.start_date ? localDate() : undefined,
      );
      await reload();
      showToast(status === "active" ? "Plan synced — it's on your Home now" : "Plan declined");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't update that plan.");
    }
  }

  if (viewing) {
    const own = workspace.ownPlans.some((b) => b.plan.id === viewing.plan.id);
    const from = workspace.assigned.find((a) => a.bundle.plan.id === viewing.plan.id);
    return (
      <PlanDetail
        bundle={viewing}
        subtitle={from ? `From ${from.coach?.display_name ?? "your coach"}` : undefined}
        onClose={() => setViewing(null)}
        onEdit={
          own
            ? () => {
                setDraft(structuredClone(viewing));
                setViewing(null);
              }
            : undefined
        }
        footer={
          from && from.assignment.status !== "active" ? (
            <Button
              full
              onClick={async () => {
                await syncPlan(from.assignment.id, "active");
                setViewing(null);
              }}
            >
              Sync this plan
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (draft) {
    const baseline = workspace.ownPlans.find((item) => item.plan.id === draft.plan.id);
    return (
      <PlanEditor
        bundle={draft}
        onChange={setDraft}
        onSave={save}
        onDelete={workspace.ownPlans.some((b) => b.plan.id === draft.plan.id) ? remove : undefined}
        onClose={() => setDraft(null)}
        saving={saving}
        exerciseLibrary={workspace.presets}
        timelineBaseline={baseline}
        loggedSessions={sessions.filter((session) => loggedIds.has(session.id))}
        onSaveExerciseToLibrary={async (exercise) => {
          await api.savePreset(
            makePreset(profile.id, exercise.name, {
              log_type: exercise.log_type,
              category: exercise.category,
              target_sets: exercise.target_sets,
              target_reps: exercise.target_reps,
              target_weight_kg: exercise.target_weight_kg,
              rest_sec: exercise.rest_sec,
              custom_fields: exercise.custom_fields,
              notes: exercise.trainer_notes,
            }),
          );
          await reload();
          showToast(`${exercise.name} saved to your library`);
        }}
      />
    );
  }

  return (
    <>
      <ScreenTitle title={context === "coach-training" ? "My training plans" : "Plans"} />

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `Active (${activeAssigned.length + runningOwn.length})` },
            { value: "coaches", label: context === "coach-training" ? "Self-coached" : "By coach" },
            { value: "mine", label: context === "coach-training" ? "My outlines" : "Created by me" },
            { value: "past", label: `History (${pastAssigned.length + pastOwn.length})` },
          ]}
        />
      </div>

      {tab === "active" && (
        <>
          {activeAssigned.length === 0 && runningOwn.length === 0 ? (
            <EmptyState
              title="No active plans"
              subtitle="Sync a coach plan or activate one of your own plans."
            />
          ) : (
            <div className="space-y-4">
              {activeAssigned.length > 0 && (
                <PlanListGroup
                  title={context === "coach-training" ? "Self-assigned" : "From your coaches"}
                  subtitle={context === "coach-training" ? "Coach outlines assigned to your training profile" : "Plans prescribed and progressed by a coach"}
                  icon={context === "coach-training" ? "🪞" : "👥"}
                  tint="var(--t-accent)"
                  count={activeAssigned.length}
                >
                  {activeAssigned.map((assigned) => (
                    <CoachPlanCard
                      key={assigned.assignment.id}
                      assigned={assigned}
                      today={today}
                      sessions={sessions}
                      loggedIds={loggedIds}
                      onView={() => setViewing(assigned.bundle)}
                      onSync={syncPlan}
                      onBatchLog={onBatchLog}
                    />
                  ))}
                </PlanListGroup>
              )}
              {runningOwn.length > 0 && (
                <PlanListGroup
                  title={context === "coach-training" ? "Athlete-side plans" : "Created by you"}
                  subtitle="Plans owned and activated from this training profile"
                  icon="🗓️"
                  tint="var(--color-done)"
                  count={runningOwn.length}
                >
                  {runningOwn.map((bundle) => (
                    <OwnPlanCard
                      key={bundle.plan.id}
                      bundle={bundle}
                      sessions={sessions}
                      loggedIds={loggedIds}
                      onView={() => setViewing(bundle)}
                      onBatchLog={onBatchLog}
                    />
                  ))}
                </PlanListGroup>
              )}
            </div>
          )}
        </>
      )}

      {tab === "coaches" && (
        <>
          {coachGroups.length === 0 ? (
            <EmptyState
              title="No current coach plans"
              subtitle="Link a coach in Settings, then their assigned plans appear here under their name."
            />
          ) : (
            <div className="space-y-4">
              {coachGroups.map((group) => (
                <PlanListGroup
                  key={group.id}
                  title={context === "coach-training" ? "Assigned by you" : group.name}
                  subtitle={context === "coach-training" ? "Your coach outlines running on your own athlete profile" : `Plans and progression owned by ${group.name}`}
                  icon={context === "coach-training" ? "🪞" : "🧑‍🏫"}
                  tint="var(--t-accent)"
                  count={group.plans.length}
                >
                  {group.plans.map((assigned) => (
                    <CoachPlanCard
                      key={assigned.assignment.id}
                      assigned={assigned}
                      today={today}
                      sessions={sessions}
                      loggedIds={loggedIds}
                      onView={() => setViewing(assigned.bundle)}
                      onSync={syncPlan}
                      onBatchLog={onBatchLog}
                    />
                  ))}
                </PlanListGroup>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "mine" && (
        <>
          <SectionHeader
            title={context === "coach-training" ? "Training-profile outlines" : "Your plan outlines"}
            action={
              <Button size="sm" variant="ghost" onClick={createPlan}>
                <Icon.plus className="h-4 w-4" /> New
              </Button>
            }
          />
          {runningOwn.length === 0 && ownTemplates.length === 0 ? (
            <EmptyState
              title="Build your own plan"
              subtitle="Set up your week, add exercises, and log against it — with or without a coach."
              action={<Button onClick={createPlan}>Create a plan</Button>}
            />
          ) : (
            <PlanListGroup
              title={context === "coach-training" ? "Owned by your athlete profile" : "Created by you"}
              subtitle="Reusable outlines you can activate independently"
              icon="✍️"
              tint="var(--color-done)"
              count={runningOwn.length + ownTemplates.length}
            >
              {[...runningOwn, ...ownTemplates].map((bundle) => (
                <OwnPlanCard
                  key={bundle.plan.id}
                  bundle={bundle}
                  sessions={sessions}
                  loggedIds={loggedIds}
                  onView={() => setViewing(bundle)}
                  onBatchLog={onBatchLog}
                  inactive={!bundle.plan.is_active || !bundle.plan.start_date}
                  onActivate={() => setActivating(bundle)}
                />
              ))}
            </PlanListGroup>
          )}
        </>
      )}

      {tab === "past" && (
        <>
          <SectionHeader title="Plan history" />
          {pastAssigned.length === 0 && pastOwn.length === 0 ? (
            <EmptyState title="No past plans" subtitle="Plans appear here after they finish or are switched off." />
          ) : (
            <div className="space-y-4">
              {pastAssigned.length > 0 && <PlanListGroup title="Previously assigned" subtitle="Finished or stopped coach plans" icon="📦" tint="var(--t-muted)" count={pastAssigned.length}>
                {pastAssigned.map((assigned) => (
                <CoachPlanCard
                  key={assigned.assignment.id}
                  assigned={assigned}
                  today={today}
                  sessions={sessions}
                  loggedIds={loggedIds}
                  onView={() => setViewing(assigned.bundle)}
                  onSync={syncPlan}
                  onBatchLog={onBatchLog}
                />
                ))}
              </PlanListGroup>}
              {pastOwn.length > 0 && <PlanListGroup title="Your finished plans" subtitle="Plans previously activated by you" icon="🗃️" tint="var(--t-muted)" count={pastOwn.length}>
                {pastOwn.map((bundle) => (
                <OwnPlanCard
                  key={bundle.plan.id}
                  bundle={bundle}
                  past
                  sessions={sessions}
                  loggedIds={loggedIds}
                  onView={() => setViewing(bundle)}
                  onBatchLog={onBatchLog}
                  onRestart={() => restartPlan(bundle)}
                />
                ))}
              </PlanListGroup>}
            </div>
          )}
        </>
      )}


      {activating && (
        <ActivatePlanSheet
          bundle={activating}
          onClose={() => setActivating(null)}
          onActivate={(startDate) => activateOwnPlan(activating, startDate)}
        />
      )}
    </>
  );
}

/** A role-labelled collection whose plans remain separate, scannable cards. */
export function PlanListGroup({
  title,
  subtitle,
  icon,
  tint,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  tint: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div
        className="flex items-center gap-3 rounded-[1.35rem] border border-line px-4 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
        style={{ background: `${tint}12` }}
      >
        <IconTile emoji={icon} tint={tint} size={36} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-ink">{title}</h2>
          <p className="truncate text-[11px] font-semibold text-muted">{subtitle}</p>
        </div>
        <Pill tint={tint}>{plural(count, "plan")}</Pill>
      </div>
      <div className="space-y-3 [&>.ui-card]:overflow-hidden [&>.ui-card]:border-line [&>.ui-card]:shadow-[0_2px_8px_rgba(0,0,0,0.035)]">
        {children}
      </div>
    </section>
  );
}

function CoachPlanCard({
  assigned,
  today,
  sessions,
  loggedIds,
  onView,
  onSync,
  onBatchLog,
}: {
  assigned: AssignedPlan;
  today: string;
  sessions: Session[];
  loggedIds: Set<string>;
  onView: () => void;
  onSync: (assignmentId: string, status: "active" | "declined") => Promise<void>;
  onBatchLog: (planId: string) => void;
}) {
  const { bundle, assignment, coach } = assigned;
  const live = planIsLive(bundle.plan, today, assignment);
  const upcoming = Boolean(assignment.start_date && assignment.start_date > today);
  const waiting = assignment.status === "offered" || !assignment.start_date;
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile emoji={live ? "📋" : "📦"} tint={live ? "var(--t-accent)" : "var(--t-muted)"} />
        <button className="min-w-0 flex-1 text-left" onClick={onView}>
          <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
          <p className="truncate text-xs font-bold text-muted">
            {coach?.display_name ?? "Coach"} · {planShape(bundle)} ·{" "}
            {live
              ? plural(bundle.exercises.length, "exercise")
              : upcoming
                ? `starts ${formatShortDate(assignment.start_date!)}`
                : waiting
                  ? "waiting for you to activate"
                  : `ended ${formatShortDate(planEnd(bundle.plan, assignment) ?? today)}`}
          </p>
        </button>
        {waiting ? (
          <Button size="sm" onClick={() => onSync(assignment.id, "active")}>Sync</Button>
        ) : (
          <Pill tint={live ? "var(--t-accent)" : "var(--t-muted)"}>{live ? "Active" : upcoming ? "Scheduled" : "Past"}</Pill>
        )}
      </div>
      <WeekStrip bundle={bundle} />
      <PreservedLogWarning
        bundle={bundle}
        sessions={sessions}
        loggedIds={loggedIds}
        startOverride={assignment.start_date}
        endOverride={assignment.end_date}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onView}>View plan</Button>
        {assignment.status === "active" && (
          <Button size="sm" variant="secondary" onClick={() => onBatchLog(bundle.plan.id)}>
            <Icon.edit className="h-3.5 w-3.5" /> Batch log
          </Button>
        )}
        {(live || upcoming) && assignment.status === "active" && (
          <button className="ml-auto text-xs font-black text-muted" onClick={() => onSync(assignment.id, "declined")}>
            Stop following
          </button>
        )}
      </div>
    </Card>
  );
}

function OwnPlanCard({
  bundle,
  past = false,
  sessions,
  loggedIds,
  onView,
  onBatchLog,
  onRestart,
  inactive = false,
  onActivate,
}: {
  bundle: PlanBundle;
  past?: boolean;
  sessions: Session[];
  loggedIds: Set<string>;
  onView: () => void;
  onBatchLog: (planId: string) => void;
  onRestart?: () => void;
  inactive?: boolean;
  onActivate?: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile emoji={past ? "📦" : "🗓️"} tint={past || inactive ? "var(--t-muted)" : "var(--t-accent)"} />
        <button className="min-w-0 flex-1 text-left" onClick={onView}>
          <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
          <p className="truncate text-xs font-bold text-muted">
            {planShape(bundle)} · {plural(bundle.exercises.length, "exercise")}
            {bundle.plan.end_date && ` · ended ${formatShortDate(bundle.plan.end_date)}`}
          </p>
        </button>
        <Pill tint={past || inactive ? "var(--t-muted)" : "var(--t-accent)"}>{past ? "Past" : inactive ? "Template" : "Active"}</Pill>
      </div>
      {!past && <WeekStrip bundle={bundle} />}
      <PreservedLogWarning bundle={bundle} sessions={sessions} loggedIds={loggedIds} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onView}>View plan</Button>
        {!inactive && <Button size="sm" variant="secondary" onClick={() => onBatchLog(bundle.plan.id)}>
          <Icon.edit className="h-3.5 w-3.5" /> Batch log
        </Button>}
        {onActivate && inactive && <Button size="sm" onClick={onActivate}>Activate</Button>}
        {onRestart && <Button size="sm" variant="secondary" onClick={onRestart}>Restart</Button>}
      </div>
    </Card>
  );
}

function ActivatePlanSheet({
  bundle,
  onClose,
  onActivate,
}: {
  bundle: PlanBundle;
  onClose: () => void;
  onActivate: (startDate: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [start, setStart] = useState(localDate());
  const effectiveStart = mode === "now" ? localDate() : start;
  const end = effectiveStart
    ? localDate(addDays(parseDate(effectiveStart), planDurationDays(bundle.plan) - 1))
    : null;

  return (
    <Sheet open onClose={onClose} title={`Activate ${bundle.plan.name}`}>
      <div className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "now", label: "Switch now" },
            { value: "scheduled", label: "Start by date" },
          ]}
        />
        {mode === "scheduled" && (
          <Field label="Start date" hint={end ? `Automatically ends ${formatShortDate(end)}` : undefined}>
            <TextField type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
        )}
        {mode === "now" && (
          <Card>
            <p className="text-sm font-black text-ink">Starts today</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              {planDurationDays(bundle.plan)} days · ends {end ? formatShortDate(end) : "automatically"}
            </p>
          </Card>
        )}
        <Button full disabled={!effectiveStart} onClick={() => onActivate(effectiveStart)}>
          {mode === "now" ? "Make active now" : "Schedule activation"}
        </Button>
      </div>
    </Sheet>
  );
}

function PreservedLogWarning({
  bundle,
  sessions,
  loggedIds,
  startOverride,
  endOverride,
}: {
  bundle: PlanBundle;
  sessions: Session[];
  loggedIds: Set<string>;
  startOverride?: string | null;
  endOverride?: string | null;
}) {
  const impacted = timelineImpacts(bundle, sessions, startOverride, endOverride).filter(({ session }) =>
    loggedIds.has(session.id),
  );
  if (impacted.length === 0) return null;
  const dates = impacted.map(({ session }) => formatShortDate(session.date));
  return (
    <div className="mt-2 rounded-xl bg-[color-mix(in_srgb,var(--color-gold)_14%,transparent)] px-3 py-2">
      <p className="text-[11px] font-black text-ink">
        {plural(impacted.length, "recorded session")} preserved on original dates
      </p>
      <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted">
        The schedule changed after logging {dates.slice(0, 3).join(", ")}
        {dates.length > 3 ? ` and ${dates.length - 3} more` : ""}. Nothing was moved or deleted;
        these remain in Progress and session history.
      </p>
    </div>
  );
}

/** "3 weeks" / "9-day split × 4" — how a plan repeats, in a phrase. */
export function planShape(bundle: PlanBundle): string {
  const blocks = blockCount(bundle.plan);
  if (isCyclePlan(bundle.plan)) {
    const lengths = planSplitLengths(bundle.plan);
    const rests = planSplitRests(bundle.plan);
    const base = lengths
      .map((length, index) => `${length} day${length === 1 ? "" : "s"}${rests[index] ? ` + ${rests[index]} rest` : ""}`)
      .join(" / ");
    // The list card describes the actual split pattern. Overall duration is
    // assignment metadata and belongs on the detail/customization screen.
    return blocks > 1 ? `${blocks} splits · ${base}` : `${base} split`;
  }
  return plural(bundle.plan.weeks, "week");
}

/**
 * The schedule at a glance. Weekly plans show seven weekdays; custom plans
 * show every main split as a horizontally scrollable carousel.
 */
export function WeekStrip({ bundle }: { bundle: PlanBundle }) {
  const cycle = isCyclePlan(bundle.plan);
  if (cycle) {
    const lengths = planSplitLengths(bundle.plan);
    const rests = planSplitRests(bundle.plan);
    return (
      <div className="-mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
        {lengths.map((length, index) => {
          const block = index + 1;
          const slots = planSlots(bundle.plan, block);
          const ownPool = bundle.days.filter(
            (day) => day.cycle_day !== null && day.week_index === block,
          );
          const fallbackPool = bundle.days.filter(
            (day) => day.cycle_day !== null && day.week_index === 1,
          );
          const pool = ownPool.length > 0 ? ownPool : fallbackPool;
          return (
            <div key={block} className="w-[17rem] shrink-0 snap-start rounded-2xl border border-line bg-inset/60 p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 text-[11px] font-black uppercase tracking-wide text-ink">Split {block}</p>
                <Pill tint="var(--t-accent)">{plural(length, "day")}</Pill>
                {rests[index] > 0 && <Pill tint="var(--t-muted)">+ {plural(rests[index], "rest day")}</Pill>}
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {slots.map((slot) => {
                  const day = pool.find((candidate) => slotIndex(bundle.plan, candidate) === slot);
                  return <PreviewDay key={slot} bundle={bundle} day={day} slot={slot} compact />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const pool = bundle.days.filter((day) => day.cycle_day === null && day.week_index === 1);
  const slots = planSlots(bundle.plan);

  return (
    <div className="mt-3 flex gap-1">
      {slots.map((slot) => {
        const day = pool.find((d) => slotIndex(bundle.plan, d) === slot);
        return <PreviewDay key={slot} bundle={bundle} day={day} slot={slot} />;
      })}
    </div>
  );
}

function PreviewDay({
  bundle,
  day,
  slot,
  compact = false,
}: {
  bundle: PlanBundle;
  day: PlanBundle["days"][number] | undefined;
  slot: number;
  compact?: boolean;
}) {
  const type = day?.day_type ?? "rest";
  const count = day ? resolveSegments(bundle, day).reduce((total, segment) => total + segment.exercises.length, 0) : 0;
  return (
    <div
      className={`rounded-xl px-1 py-1.5 text-center ${compact ? "w-9 shrink-0" : "flex-1"}`}
      style={{ background: type === "rest" ? "var(--t-inset)" : `${typeColor(type, day?.color_hex)}22` }}
      title={day?.title || "Rest"}
    >
      <p className="text-[9px] font-black uppercase text-muted">{slotLabel(bundle.plan, slot, true)}</p>
      <p className="text-sm leading-tight">{typeIcon(type, day?.icon_name)}</p>
      {count > 0 && <p className="text-[9px] font-bold text-muted">{count}</p>}
    </div>
  );
}

export function PlansLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
