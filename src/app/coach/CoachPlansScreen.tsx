/** Coach → plan library: build a plan, then assign it to athletes. */

import { useState } from "react";
import { api } from "../../data";
import type { AthleteTraining, CoachWorkspace, PlanLoggedSession } from "../../data/api";
import { makePlan, makePreset, newId } from "../../data/factories";
import type { PlanBundle, Profile } from "../../data/types";
import { addDays, formatShortDate, localDate, parseDate } from "../../domain/dates";
import { emptyDays, planDurationDays } from "../../domain/plan";
import { plural } from "../../domain/text";
import { Button, Card, EmptyState, Field, Icon, IconTile, Pill, ScreenTitle, SectionHeader, Segmented, Sheet, TextField } from "../../ui/kit";
import { PlanListGroup, planShape, WeekStrip } from "../athlete/PlansScreen";
import { PlanDetail } from "../plans/PlanDetail";
import { PlanEditor } from "../plans/PlanEditor";
import { AthletePlanCustomizer } from "./AthletePlanCustomizer";

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
  const [customizingSelf, setCustomizingSelf] = useState<{
    template: PlanBundle;
    assignment: CoachWorkspace["assignments"][number];
  } | null>(null);
  const [selfTraining, setSelfTraining] = useState<AthleteTraining | null>(null);
  const [timelineBaseline, setTimelineBaseline] = useState<PlanBundle | null>(null);
  const [timelineSessions, setTimelineSessions] = useState<PlanLoggedSession[]>([]);

  function createPlan() {
    const plan = makePlan(coach.id, {
      name: "New plan",
      start_date: null,
      end_date: null,
      is_active: false,
    });
    setDraft({ plan, days: emptyDays(plan, 1, newId), segments: [], exercises: [] });
    setTimelineBaseline(null);
    setTimelineSessions([]);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.savePlan({
        ...draft,
        plan: { ...draft.plan, start_date: null, end_date: null, is_active: false },
      });
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

  async function customizeSelf(
    template: PlanBundle,
    assignment: CoachWorkspace["assignments"][number],
  ) {
    if (!workspace.selfAthlete) return;
    setSelfTraining(await api.athleteTraining(workspace.selfAthlete.id));
    setCustomizingSelf({ template, assignment });
    setAssigning(null);
  }

  if (customizingSelf && workspace.selfAthlete && selfTraining) {
    return (
      <AthletePlanCustomizer
        open
        athleteName={`${coach.display_name || "Coach"} · self`}
        template={customizingSelf.template}
        assignment={customizingSelf.assignment}
        coachId={coach.id}
        remarks={selfTraining.remarks}
        loggedSessions={selfTraining.sessions}
        onClose={() => setCustomizingSelf(null)}
        onSaved={async () => {
          await onReload();
          setSelfTraining(await api.athleteTraining(workspace.selfAthlete!.id));
        }}
        onToast={onToast}
      />
    );
  }

  if (viewing) {
    return (
      <PlanDetail
        bundle={viewing}
        onClose={() => setViewing(null)}
        onEdit={async () => {
          const logged = await api.planLoggedSessions(viewing.plan.id);
          setTimelineBaseline(structuredClone(viewing));
          setTimelineSessions(logged);
          setDraft({
            ...structuredClone(viewing),
            plan: { ...viewing.plan, start_date: null, end_date: null, is_active: false },
          });
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
        timelineBaseline={timelineBaseline ?? undefined}
        timelineSessionContexts={timelineSessions}
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
        <div className="space-y-4">
          {[
            {
              key: "assigned",
              title: "Assigned outlines",
              subtitle: "Reusable plans currently sent to an athlete or to your own training profile",
              icon: "📤",
              tint: "var(--t-accent)",
              plans: workspace.plans.filter((bundle) =>
                workspace.assignments.some((assignment) => assignment.plan_id === bundle.plan.id),
              ),
            },
            {
              key: "library",
              title: "Unassigned outlines",
              subtitle: "Private coach-library plans that no athlete can see yet",
              icon: "🗂️",
              tint: "var(--t-muted)",
              plans: workspace.plans.filter((bundle) =>
                !workspace.assignments.some((assignment) => assignment.plan_id === bundle.plan.id),
              ),
            },
          ].filter((group) => group.plans.length > 0).map((group) => (
            <PlanListGroup
              key={group.key}
              title={group.title}
              subtitle={group.subtitle}
              icon={group.icon}
              tint={group.tint}
              count={group.plans.length}
            >
              {group.plans.map((bundle) => {
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
            </PlanListGroup>
          ))}
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
          {!workspace.selfAthlete && workspace.athletes.length === 0 ? (
            <EmptyState title="No training profiles available" subtitle="Enable My training for yourself, or invite an athlete first." />
          ) : (
            <div className="space-y-2">
              {workspace.selfAthlete && (
                <>
                  <SectionHeader title="Your training profile" />
                  <AssignAthleteRow
                    profile={workspace.selfAthlete}
                    plan={assigning}
                    existing={workspace.assignments.find(
                      (assignment) => assignment.plan_id === assigning.plan.id && assignment.athlete_id === workspace.selfAthlete!.id,
                    )}
                    self
                    onCustomize={(assignment) => customizeSelf(assigning, assignment)}
                    onReload={onReload}
                    onToast={onToast}
                  />
                </>
              )}
              {workspace.athletes.length > 0 && <SectionHeader title="Linked athletes" />}
              {workspace.athletes.map(({ profile }) => {
                const existing = workspace.assignments.find(
                  (a) => a.plan_id === assigning.plan.id && a.athlete_id === profile.id,
                );
                return <AssignAthleteRow key={profile.id} profile={profile} plan={assigning} existing={existing} onReload={onReload} onToast={onToast} />;
              })}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

function AssignAthleteRow({
  profile,
  plan,
  existing,
  self = false,
  onCustomize,
  onReload,
  onToast,
}: {
  profile: Profile;
  plan: PlanBundle;
  existing: CoachWorkspace["assignments"][number] | undefined;
  self?: boolean;
  onCustomize?: (assignment: CoachWorkspace["assignments"][number]) => void;
  onReload: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [mode, setMode] = useState<"scheduled" | "manual">("scheduled");
  const [start, setStart] = useState(localDate());
  const [sending, setSending] = useState(false);
  const end = formatShortDate(localDate(addDays(parseDate(start), planDurationDays(plan.plan) - 1)));

  if (existing) {
    return (
      <div className="rounded-2xl bg-inset px-3 py-2">
        <div className="flex items-center gap-3">
          <IconTile emoji="🏋️" tint="var(--t-accent)" size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-ink">{self ? "Assign to myself" : profile.display_name || "Athlete"}</p>
            {self && <p className="text-[10px] font-semibold text-muted">Same account · athlete training identity</p>}
          </div>
          <Pill tint="var(--t-accent)">{existing.status === "active" ? "Scheduled" : "Waiting"}</Pill>
          {onCustomize && <Button size="sm" variant="secondary" onClick={() => onCustomize(existing)}>Customize</Button>}
        </div>
        {existing.start_date && (
          <p className="mt-1 pl-12 text-xs font-bold text-muted">
            {formatShortDate(existing.start_date)} → {existing.end_date ? formatShortDate(existing.end_date) : "automatic end"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-inset px-3 py-3">
      <div className="flex items-center gap-3">
        <IconTile emoji="🏋️" tint="var(--t-accent)" size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-ink">{self ? "Assign to myself" : profile.display_name || "Athlete"}</p>
          {self && <p className="text-[10px] font-semibold text-muted">Creates a real self-assignment with notes and independent dates</p>}
        </div>
      </div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "scheduled", label: "Start by date" },
          { value: "manual", label: "Athlete starts" },
        ]}
      />
      {mode === "scheduled" && (
        <Field label="Athlete start date" hint={`Ends ${end} from the ${planDurationDays(plan.plan)}-day duration`}>
          <TextField
            type="date"
            value={start}
            onInput={(event) => setStart(event.currentTarget.value)}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
      )}
      <Button
        full
        size="sm"
        disabled={sending || (mode === "scheduled" && !start)}
        onClick={async () => {
          setSending(true);
          try {
            await api.assignPlan(plan.plan.id, profile.id, {
              activation_mode: mode,
              start_date: mode === "scheduled" ? start : null,
            });
            await onReload();
            onToast(mode === "scheduled" ? `Scheduled for ${profile.display_name || "athlete"}` : `Sent to ${profile.display_name || "athlete"}`);
          } catch (error) {
            onToast(error instanceof Error ? error.message : "Couldn't assign that plan.");
          } finally {
            setSending(false);
          }
        }}
      >
        {sending ? "Assigning…" : mode === "scheduled" ? "Assign schedule" : "Send for activation"}
      </Button>
    </div>
  );
}
