/** Coach → plan library: build a plan, then assign it to athletes. */

import { useState } from "react";
import { api } from "../../data";
import type { CoachWorkspace } from "../../data/api";
import { makePlan, makePreset, newId } from "../../data/factories";
import type { PlanBundle, Profile } from "../../data/types";
import { localDate, startOfWeek } from "../../domain/dates";
import { emptyDays } from "../../domain/plan";
import { plural } from "../../domain/text";
import { Button, Card, EmptyState, Icon, IconTile, Pill, ScreenTitle, SectionHeader, Sheet } from "../../ui/kit";
import { planShape, WeekStrip } from "../athlete/PlansScreen";
import { PlanDetail } from "../plans/PlanDetail";
import { PlanEditor } from "../plans/PlanEditor";

export default function CoachPlansScreen({
  coach,
  workspace,
  onReload,
  onToast,
}: {
  coach: Profile;
  workspace: CoachWorkspace;
  onReload: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState<PlanBundle | null>(null);
  const [viewing, setViewing] = useState<PlanBundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState<PlanBundle | null>(null);

  function createPlan() {
    const plan = makePlan(coach.id, {
      name: "New plan",
      start_date: localDate(startOfWeek()),
      is_active: true,
    });
    setDraft({ plan, days: emptyDays(plan, 1, newId), segments: [], exercises: [] });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.savePlan(draft);
      await onReload();
      onToast("Plan saved");
      // Keep the editor open on failure so the work isn't thrown away.
      setDraft(null);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Couldn't save that plan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft) return;
    try {
      await api.deletePlan(draft.plan.id);
      await onReload();
      setDraft(null);
      onToast("Plan deleted");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Couldn't delete that plan.");
    }
  }

  if (viewing) {
    return (
      <PlanDetail
        bundle={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => {
          setDraft(structuredClone(viewing));
          setViewing(null);
        }}
        footer={
          <Button full variant="secondary" onClick={() => setAssigning(viewing)}>
            <Icon.send className="h-4 w-4" /> Assign to an athlete
          </Button>
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
        onDelete={workspace.plans.some((p) => p.plan.id === draft.plan.id) ? remove : undefined}
        onClose={() => setDraft(null)}
        saving={saving}
        exerciseLibrary={workspace.presets}
        onSaveExerciseToLibrary={async (exercise) => {
          const existing = workspace.presets.find(
            (preset) => preset.name.trim().toLowerCase() === exercise.name.trim().toLowerCase(),
          );
          await api.savePreset({
            ...makePreset(coach.id, exercise.name),
            ...(existing ?? {}),
            log_type: exercise.log_type,
            category: exercise.category,
            target_sets: exercise.target_sets,
            target_reps: exercise.target_reps,
            target_weight_kg: exercise.target_weight_kg,
            rest_sec: exercise.rest_sec,
            custom_fields: exercise.custom_fields,
            notes: exercise.trainer_notes,
          });
          await onReload();
          onToast(`${exercise.name} saved to your exercise library`);
        }}
      />
    );
  }

  return (
    <>
      <ScreenTitle
        title="Plans"
        right={
          <Button size="sm" onClick={createPlan}>
            <Icon.plus className="h-4 w-4" /> New plan
          </Button>
        }
      />

      {workspace.plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          subtitle="Build a weekly plan, then assign it to as many athletes as you like."
          action={<Button onClick={createPlan}>Create your first plan</Button>}
        />
      ) : (
        <div className="space-y-2">
          {workspace.plans.map((bundle) => {
            const assigned = workspace.assignments.filter((a) => a.plan_id === bundle.plan.id);
            const synced = assigned.filter((a) => a.status === "active").length;
            return (
              <Card key={bundle.plan.id}>
                <div className="flex items-center gap-3">
                  <IconTile emoji="📋" tint="var(--t-accent)" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(bundle)}>
                    <p className="truncate text-[15px] font-black text-ink">{bundle.plan.name}</p>
                    <p className="truncate text-xs font-bold text-muted">
                      {planShape(bundle)} · {plural(bundle.exercises.length, "exercise")} · {assigned.length} assigned
                      {assigned.length > 0 && ` (${synced} synced)`}
                    </p>
                  </button>
                  <Button size="sm" variant="secondary" onClick={() => setAssigning(bundle)}>
                    <Icon.send className="h-4 w-4" /> Assign
                  </Button>
                </div>
                <WeekStrip bundle={bundle} />
              </Card>
            );
          })}
        </div>
      )}

      <SectionHeader title="How assignment works" />
      <Card>
        <p className="text-xs font-semibold leading-relaxed text-muted">
          Assigning sends the plan to the athlete's Plans tab. They tap <strong>Sync</strong> to start following
          it — from then on it drives their Home screen, and every set they log flows back to you here.
        </p>
      </Card>

      {assigning && (
        <Sheet open onClose={() => setAssigning(null)} title={`Assign ${assigning.plan.name}`}>
          {workspace.athletes.length === 0 ? (
            <EmptyState title="No athletes linked" subtitle="Invite one from the Athletes tab first." />
          ) : (
            <div className="space-y-2">
              {workspace.athletes.map(({ profile }) => {
                const existing = workspace.assignments.find(
                  (a) => a.plan_id === assigning.plan.id && a.athlete_id === profile.id,
                );
                return (
                  <div key={profile.id} className="flex items-center gap-3 rounded-2xl bg-inset px-3 py-2">
                    <IconTile emoji="🏋️" tint="var(--t-accent)" size={34} />
                    <p className="min-w-0 flex-1 truncate text-sm font-black text-ink">
                      {profile.display_name || "Athlete"}
                    </p>
                    {existing ? (
                      <Pill tint="var(--t-accent)">{existing.status === "active" ? "Synced" : "Sent"}</Pill>
                    ) : (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await api.assignPlan(assigning.plan.id, profile.id);
                            await onReload();
                            onToast(`Sent to ${profile.display_name || "athlete"}`);
                          } catch (error) {
                            onToast(
                              error instanceof Error ? error.message : "Couldn't assign that plan.",
                            );
                          }
                        }}
                      >
                        Send
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
