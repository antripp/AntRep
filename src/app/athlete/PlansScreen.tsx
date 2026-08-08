/** Plans — sync what a coach assigned, or build your own. */

import { useEffect, useRef, useState } from "react";
import { useDraft } from "../usePersisted";
import { api } from "../../data";
import { makeDay, makePlan, makePreset } from "../../data/factories";
import type { PlanBundle } from "../../data/types";
import { localDate, startOfWeek, weekdayLabel } from "../../domain/dates";
import { resolveSegments, typeColor, typeIcon } from "../../domain/plan";
import { plural } from "../../domain/text";
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
  const { profile, workspace, reload, showToast } = useWorkspace();
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
      plan.discard();
      await reload();
      showToast("Plan saved");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft) return;
    await api.deletePlan(draft.plan.id);
    plan.discard();
    await reload();
    showToast("Plan deleted");
  }

  function createPlan() {
    const plan = makePlan(profile.id, {
      name: "My plan",
      start_date: localDate(startOfWeek()),
      is_active: workspace.ownPlans.length === 0,
    });
    setDraft({
      plan,
      days: Array.from({ length: 7 }, (_, i) => makeDay(plan.id, i + 1)),
      segments: [],
      exercises: [],
    });
  }

  async function syncPlan(assignmentId: string, status: "active" | "declined") {
    await api.setAssignmentStatus(assignmentId, status);
    await reload();
    showToast(status === "active" ? "Plan synced — it's on your Home now" : "Plan declined");
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
    return (
      <PlanEditor
        bundle={draft}
        onChange={setDraft}
        onSave={save}
        onDelete={workspace.ownPlans.some((b) => b.plan.id === draft.plan.id) ? remove : undefined}
        onClose={() => setDraft(null)}
        saving={saving}
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
                    {coach?.display_name ?? "Coach"} · {bundle.plan.weeks} week
                    {bundle.plan.weeks === 1 ? "" : "s"} · {plural(bundle.exercises.length, "exercise")}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-accent">
                    View plan <Icon.chevron className="h-3 w-3" />
                  </span>
                </button>
                {assignment.status === "active" ? (
                  <Pill tint="var(--t-accent)">Synced</Pill>
                ) : (
                  <Button size="sm" onClick={() => syncPlan(assignment.id, "active")}>
                    Sync
                  </Button>
                )}
              </div>

              <WeekStrip bundle={bundle} />

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
      {workspace.ownPlans.length === 0 ? (
        <EmptyState
          title="Build your own plan"
          subtitle="Set up your week, add exercises, and log against it — with or without a coach."
          action={<Button onClick={createPlan}>Create a plan</Button>}
        />
      ) : (
        <div className="space-y-2">
          {workspace.ownPlans.map((bundle) => (
            <Card key={bundle.plan.id} onClick={() => setViewing(bundle)}>
              <div className="flex items-center gap-3">
                <IconTile emoji="🗓️" tint="var(--t-accent)" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
                  <p className="truncate text-xs font-bold text-muted">
                    {bundle.plan.weeks} week{bundle.plan.weeks === 1 ? "" : "s"} · {plural(bundle.exercises.length, "exercise")}
                  </p>
                </div>
                {bundle.plan.is_active && <Pill tint="var(--t-accent)">Active</Pill>}
                <Icon.chevron className="h-4 w-4 text-muted" />
              </div>
              <WeekStrip bundle={bundle} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function WeekStrip({ bundle }: { bundle: PlanBundle }) {
  const days = Array.from({ length: 7 }, (_, i) =>
    bundle.days.find((d) => d.week_index === 1 && d.weekday === i + 1),
  );
  return (
    <div className="mt-3 flex gap-1">
      {days.map((day, i) => {
        const type = day?.day_type ?? "rest";
        const count = day ? resolveSegments(bundle, day).reduce((t, s) => t + s.exercises.length, 0) : 0;
        return (
          <div
            key={i}
            className="flex-1 rounded-xl px-1 py-1.5 text-center"
            style={{ background: type === "rest" ? "var(--t-inset)" : `${typeColor(type, day?.color_hex)}22` }}
            title={day?.title || "Rest"}
          >
            <p className="text-[9px] font-black uppercase text-muted">{weekdayLabel(i + 1, true)}</p>
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
