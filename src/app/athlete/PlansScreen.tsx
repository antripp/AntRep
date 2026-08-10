/** Plans — sync what a coach assigned, or build your own. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useDraft } from "../usePersisted";
import { api } from "../../data";
import { makePlan, makePreset, newId } from "../../data/factories";
import type { AssignedPlan, PlanBundle, Session } from "../../data/types";
import { formatShortDate, localDate, startOfWeek } from "../../domain/dates";
import {
  blockCount,
  emptyDays,
  isCyclePlan,
  planEnd,
  planIsLive,
  planSlots,
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
} from "../../ui/kit";
import { PlanDetail } from "../plans/PlanDetail";
import { PlanEditor } from "../plans/PlanEditor";
import { useWorkspace } from "../workspace";

type PlanTab = "active" | "coaches" | "mine" | "past";

export default function PlansScreen({ onBatchLog }: { onBatchLog: (planId: string) => void }) {
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
    (b) => !b.plan.is_archived && !planIsLive(b.plan, today),
  );
  const currentAssigned = workspace.assigned.filter(({ bundle, assignment }) =>
    planIsLive(bundle.plan, today, assignment),
  );
  const activeAssigned = currentAssigned.filter(({ assignment }) => assignment.status === "active");
  const pastAssigned = workspace.assigned.filter(({ bundle, assignment }) =>
    !planIsLive(bundle.plan, today, assignment),
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
      start_date: localDate(startOfWeek()),
      is_active: workspace.ownPlans.length === 0,
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

  async function syncPlan(assignmentId: string, status: "active" | "declined") {
    try {
      await api.setAssignmentStatus(assignmentId, status);
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
      <ScreenTitle title="Plans" />

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `Active (${activeAssigned.length + runningOwn.length})` },
            { value: "coaches", label: "Coaches" },
            { value: "mine", label: "My plans" },
            { value: "past", label: `Past (${pastAssigned.length + pastOwn.length})` },
          ]}
        />
      </div>

      {tab === "active" && (
        <>
          <SectionHeader title="Current plans" />
          {activeAssigned.length === 0 && runningOwn.length === 0 ? (
            <EmptyState
              title="No active plans"
              subtitle="Sync a coach plan or activate one of your own plans."
            />
          ) : (
            <div className="space-y-2">
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
            coachGroups.map((group) => (
              <div key={group.id}>
                <SectionHeader title={group.name} />
                <div className="space-y-2">
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
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === "mine" && (
        <>
          <SectionHeader
            title="My current plans"
            action={
              <Button size="sm" variant="ghost" onClick={createPlan}>
                <Icon.plus className="h-4 w-4" /> New
              </Button>
            }
          />
          {runningOwn.length === 0 ? (
            <EmptyState
              title="Build your own plan"
              subtitle="Set up your week, add exercises, and log against it — with or without a coach."
              action={<Button onClick={createPlan}>Create a plan</Button>}
            />
          ) : (
            <div className="space-y-2">
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
            </div>
          )}
        </>
      )}

      {tab === "past" && (
        <>
          <SectionHeader title="Past plans" />
          {pastAssigned.length === 0 && pastOwn.length === 0 ? (
            <EmptyState title="No past plans" subtitle="Plans appear here after they finish or are switched off." />
          ) : (
            <div className="space-y-2">
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
            </div>
          )}
        </>
      )}
    </>
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
              : `ended ${formatShortDate(planEnd(bundle.plan, assignment) ?? bundle.plan.start_date)}`}
          </p>
        </button>
        {live && assignment.status !== "active" ? (
          <Button size="sm" onClick={() => onSync(assignment.id, "active")}>Sync</Button>
        ) : (
          <Pill tint={live ? "var(--t-accent)" : "var(--t-muted)"}>{live ? "Active" : "Past"}</Pill>
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
        {live && assignment.status === "active" && (
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
}: {
  bundle: PlanBundle;
  past?: boolean;
  sessions: Session[];
  loggedIds: Set<string>;
  onView: () => void;
  onBatchLog: (planId: string) => void;
  onRestart?: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile emoji={past ? "📦" : "🗓️"} tint={past ? "var(--t-muted)" : "var(--t-accent)"} />
        <button className="min-w-0 flex-1 text-left" onClick={onView}>
          <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
          <p className="truncate text-xs font-bold text-muted">
            {planShape(bundle)} · {plural(bundle.exercises.length, "exercise")}
            {bundle.plan.end_date && ` · ended ${formatShortDate(bundle.plan.end_date)}`}
          </p>
        </button>
        <Pill tint={past ? "var(--t-muted)" : "var(--t-accent)"}>{past ? "Past" : "Active"}</Pill>
      </div>
      {!past && <WeekStrip bundle={bundle} />}
      <PreservedLogWarning bundle={bundle} sessions={sessions} loggedIds={loggedIds} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onView}>View plan</Button>
        <Button size="sm" variant="secondary" onClick={() => onBatchLog(bundle.plan.id)}>
          <Icon.edit className="h-3.5 w-3.5" /> Batch log
        </Button>
        {onRestart && <Button size="sm" variant="secondary" onClick={onRestart}>Restart</Button>}
      </div>
    </Card>
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
    const base = `${bundle.plan.cycle_length}-day split`;
    return blocks > 1 ? `${base} × ${blocks}` : base;
  }
  return plural(blocks, "week");
}

/**
 * One pass through the plan at a glance: seven weekdays, or every day of the
 * split. A long cycle scrolls sideways rather than squeezing the tiles flat.
 */
export function WeekStrip({ bundle }: { bundle: PlanBundle }) {
  const cycle = isCyclePlan(bundle.plan);
  // The first block: this strip is a shape preview, not the whole programme.
  const pool = bundle.days.filter(
    (d) => (cycle ? d.cycle_day !== null : d.cycle_day === null) && d.week_index === 1,
  );
  const slots = planSlots(bundle.plan);
  const scrolls = slots.length > 7;

  return (
    <div className={`mt-3 flex gap-1 ${scrolls ? "-mx-1 overflow-x-auto px-1 pb-1" : ""}`}>
      {slots.map((slot) => {
        const day = pool.find((d) => slotIndex(bundle.plan, d) === slot);
        const type = day?.day_type ?? "rest";
        const count = day ? resolveSegments(bundle, day).reduce((t, s) => t + s.exercises.length, 0) : 0;
        return (
          <div
            key={slot}
            className={`rounded-xl px-1 py-1.5 text-center ${scrolls ? "w-9 shrink-0" : "flex-1"}`}
            style={{ background: type === "rest" ? "var(--t-inset)" : `${typeColor(type, day?.color_hex)}22` }}
            title={day?.title || "Rest"}
          >
            <p className="text-[9px] font-black uppercase text-muted">
              {slotLabel(bundle.plan, slot, true)}
            </p>
            <p className="text-sm leading-tight">{typeIcon(type, day?.icon_name)}</p>
            {count > 0 && <p className="text-[9px] font-bold text-muted">{count}</p>}
          </div>
        );
      })}
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
