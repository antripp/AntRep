/** Plans — sync what a coach assigned, or build your own. */

import { useEffect, useRef, useState } from "react";
import { useDraft } from "../usePersisted";
import { api } from "../../data";
import { makePlan, makePreset, newId } from "../../data/factories";
import type { PlanBundle, Session } from "../../data/types";
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
  Spinner,
} from "../../ui/kit";
import { PlanDetail } from "../plans/PlanDetail";
import { PlanEditor } from "../plans/PlanEditor";
import { useWorkspace } from "../workspace";

export default function PlansScreen() {
  const { profile, workspace, sessions, logs, reload, showToast } = useWorkspace();
  const loggedIds = loggedSessionIds(logs);
  // A plan is a lot of typing. Keep it across reloads, per profile, and drop it
  // only once it has actually reached the server.
  const plan = useDraft<PlanBundle>(`plan-draft:${profile.id}`);
  const draft = plan.value;
  const setDraft = plan.set;
  const [viewing, setViewing] = useState<PlanBundle | null>(null);
  const [saving, setSaving] = useState(false);

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

      <SectionHeader title="From your coach" />
      {workspace.assigned.length === 0 ? (
        <EmptyState
          title="No coach plans yet"
          subtitle="Link a coach in Settings, then their plans show up here to sync."
        />
      ) : (
        <div className="space-y-2">
          {workspace.assigned.map(({ bundle, assignment, coach }) => (
            <Card key={assignment.id}>
              <div className="flex items-center gap-3">
                <IconTile emoji="📋" tint="var(--t-accent)" />
                <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(bundle)}>
                  <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
                  <p className="truncate text-xs font-bold text-muted">
                    {coach?.display_name ?? "Coach"} · {planShape(bundle)} ·{" "}
                    {planIsLive(bundle.plan, today, assignment)
                      ? plural(bundle.exercises.length, "exercise")
                      : `ended ${formatShortDate(planEnd(bundle.plan, assignment) ?? bundle.plan.start_date)} — your coach can restart it`}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-accent">
                    View plan <Icon.chevron className="h-3 w-3" />
                  </span>
                </button>
                {/* A finished coach plan is read-only here: restarting someone
                    else's programme is the coach's call, not the athlete's. */}
                {planIsLive(bundle.plan, today, assignment) ? (
                  assignment.status === "active" ? (
                    <Pill tint="var(--t-accent)">Synced</Pill>
                  ) : (
                    <Button size="sm" onClick={() => syncPlan(assignment.id, "active")}>
                      Sync
                    </Button>
                  )
                ) : (
                  <Pill tint="var(--t-muted)">Finished</Pill>
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

              {assignment.status === "active" && (
                <button
                  className="mt-2 text-xs font-black text-muted"
                  onClick={() => syncPlan(assignment.id, "declined")}
                >
                  Stop following this plan
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <SectionHeader
        title="My plans"
        action={
          <Button size="sm" variant="ghost" onClick={createPlan}>
            <Icon.plus className="h-4 w-4" /> New
          </Button>
        }
      />
      {runningOwn.length === 0 && pastOwn.length === 0 ? (
        <EmptyState
          title="Build your own plan"
          subtitle="Set up your week, add exercises, and log against it — with or without a coach."
          action={<Button onClick={createPlan}>Create a plan</Button>}
        />
      ) : (
        <div className="space-y-2">
          {runningOwn.map((bundle) => (
            <Card key={bundle.plan.id} onClick={() => setViewing(bundle)}>
              <div className="flex items-center gap-3">
                <IconTile emoji="🗓️" tint="var(--t-accent)" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
                  <p className="truncate text-xs font-bold text-muted">
                    {planShape(bundle)} · {plural(bundle.exercises.length, "exercise")}
                    {bundle.plan.end_date && ` · ends ${formatShortDate(bundle.plan.end_date)}`}
                  </p>
                </div>
                {bundle.plan.is_active && <Pill tint="var(--t-accent)">Active</Pill>}
                <Icon.chevron className="h-4 w-4 text-muted" />
              </div>
              <WeekStrip bundle={bundle} />
              <PreservedLogWarning bundle={bundle} sessions={sessions} loggedIds={loggedIds} />
            </Card>
          ))}
        </div>
      )}

      {/* Finished plans stay readable — and restartable, which is the whole
          point of ending one rather than deleting it. */}
      {pastOwn.length > 0 && (
        <>
          <SectionHeader title="Past plans" />
          <div className="space-y-2">
            {pastOwn.map((bundle) => (
              <Card key={bundle.plan.id}>
                <div className="flex items-center gap-3">
                  <IconTile emoji="📦" tint="var(--t-muted)" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(bundle)}>
                    <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
                    <p className="truncate text-xs font-bold text-muted">
                      {planShape(bundle)} ·{" "}
                      {bundle.plan.end_date
                        ? `ended ${formatShortDate(bundle.plan.end_date)}`
                        : "not running"}
                    </p>
                  </button>
                  <Button size="sm" variant="secondary" onClick={() => restartPlan(bundle)}>
                    Restart
                  </Button>
                </div>
                <PreservedLogWarning bundle={bundle} sessions={sessions} loggedIds={loggedIds} />
              </Card>
            ))}
          </div>
        </>
      )}
    </>
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
