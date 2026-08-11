/**
 * Exercise library — the logging shape saved per exercise name. Whatever you
 * set here is what you get every time you log that exercise, in or out of a plan.
 */

import { useMemo, useState } from "react";
import { api } from "../../data";
import { makePreset } from "../../data/factories";
import { LOG_TYPE_LABELS, type ExercisePreset, type ProgressGoal } from "../../data/types";
import { Button, Card, Field, Icon, NumberField, Pill, SectionHeader, Sheet, TextField } from "../../ui/kit";
import { CustomFieldsEditor, LogTypePicker } from "../plans/LoggingFields";
import { useWorkspace } from "../workspace";
import { ExerciseCategoryTabs, type ExerciseCategoryFilter } from "../shared/ExerciseCategoryTabs";
import { LibraryExerciseSheet, MatchExerciseSheet } from "./ExerciseLibrarySheets";
import { MuscleFigure } from "./MuscleFigure";
import { useExerciseLibrary } from "./useExerciseLibrary";
import type { ExerciseStat } from "../../domain/analytics";
import { nameKey } from "../../domain/logging";
import { GoalProgressCard, ProgressGoalEditor, type GoalContextOption } from "../progress/ProgressGoalEditor";

export interface ExercisePresetLibraryProps {
  profile: ReturnType<typeof useWorkspace>["profile"];
  presets: ExercisePreset[];
  reload: () => Promise<void>;
  showToast: (message: string) => void;
  usage?: "athlete" | "coach";
  goals?: ProgressGoal[];
  stats?: ExerciseStat[];
  athleteId?: string;
  viewerId?: string;
  onSaveGoal?: (goal: ProgressGoal) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}

export default function LibrarySection() {
  const workspace = useWorkspace();
  return (
    <ExercisePresetLibrary
      profile={workspace.profile}
      presets={workspace.presets}
      reload={workspace.reload}
      showToast={workspace.showToast}
      goals={workspace.goals}
      athleteId={workspace.profile.id}
      viewerId={workspace.profile.id}
      onSaveGoal={async (goal) => { await api.saveProgressGoal(goal); await workspace.reload(); }}
      onDeleteGoal={async (id) => { await api.deleteProgressGoal(id); await workspace.reload(); }}
    />
  );
}

export function ExercisePresetLibrary({
  profile,
  presets,
  reload,
  showToast,
  usage = "athlete",
  goals = [],
  stats = [],
  athleteId,
  viewerId,
  onSaveGoal,
  onDeleteGoal,
}: ExercisePresetLibraryProps) {
  const library = useExerciseLibrary();
  const [category, setCategory] = useState<ExerciseCategoryFilter>("all");
  const [editing, setEditing] = useState<ExercisePreset | null>(null);

  const sorted = useMemo(
    () => presets
      .filter((preset) => category === "all" || preset.category === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [category, presets],
  );
  const categoryCounts = useMemo(() => ({
    all: presets.length,
    push: presets.filter((preset) => preset.category === "push").length,
    pull: presets.filter((preset) => preset.category === "pull").length,
    legs: presets.filter((preset) => preset.category === "legs").length,
    core: presets.filter((preset) => preset.category === "core").length,
    cardio: presets.filter((preset) => preset.category === "cardio").length,
  }), [presets]);

  async function save(preset: ExercisePreset) {
    await api.savePreset(preset);
    await reload();
    setEditing(null);
    showToast(`${preset.name} saved to your library`);
  }

  return (
    <>
      <SectionHeader
        title="Saved exercises"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(makePreset(profile.id, ""))}
          >
            <Icon.plus className="h-4 w-4" /> New
          </Button>
        }
      />

      <Card className="p-0">
        <p className="border-b border-line px-4 py-3 text-xs font-semibold leading-snug text-muted">
          {usage === "coach"
            ? "Set how each exercise is prescribed — weight × reps, reps only, time, distance, or your own fields. Saved here, it appears first and seeds the same setup in every plan builder."
            : "Set how each exercise is logged — weight × reps, reps only, time, distance, or your own fields. Saved here, it logs the same way everywhere, including workouts outside your plan."}
        </p>

        <div className="border-b border-line px-3">
          <ExerciseCategoryTabs value={category} counts={categoryCounts} onChange={setCategory} />
        </div>

        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm font-semibold text-muted">
            {presets.length === 0
              ? "Nothing saved yet. Add one, or save an exercise from Browse all."
              : "No saved exercises in this category."}
          </p>
        ) : (
          <div className="divide-y divide-line">
            {sorted.map((preset) => (
              (() => {
                const goal = goals.find((item) => item.scope_type === "exercise" && item.scope_key === nameKey(preset.name) && item.status === "active");
                return (
              <button
                key={preset.id}
                onClick={() => setEditing(preset)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{preset.name}</p>
                  <p className="truncate text-[11px] font-semibold text-muted">
                    {LOG_TYPE_LABELS[preset.log_type]}
                    {preset.custom_fields.length > 0 &&
                      ` · ${preset.custom_fields.map((f) => f.label).join(", ")}`}
                  </p>
                </div>
                {preset.is_favorite && <Pill tint="var(--t-accent)">Favourite</Pill>}
                {goal && <Pill tint="var(--color-done)">{Math.round(goalProgress(goal, stats.find((stat) => stat.key === nameKey(preset.name))))}% to goal</Pill>}
                <Icon.chevron className="h-4 w-4 text-muted" />
              </button>
                );
              })()
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <PresetSheet
          preset={editing}
          library={library.exercises}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={
            presets.some((p) => p.id === editing.id)
              ? async () => {
                  await api.deletePreset(editing.id);
                  await reload();
                  setEditing(null);
                  showToast("Removed from your library");
                }
              : undefined
          }
          usage={usage}
          goal={goals.find((item) => item.scope_type === "exercise" && item.scope_key === nameKey(editing.name) && item.status === "active") ?? null}
          stat={stats.find((item) => item.key === nameKey(editing.name))}
          athleteId={athleteId}
          viewerId={viewerId}
          onSaveGoal={onSaveGoal}
          onDeleteGoal={onDeleteGoal}
        />
      )}
    </>
  );
}

function PresetSheet({
  preset,
  library,
  onSave,
  onDelete,
  onClose,
  usage,
  goal,
  stat,
  athleteId,
  viewerId,
  onSaveGoal,
  onDeleteGoal,
}: {
  preset: ExercisePreset;
  library: ReturnType<typeof useExerciseLibrary>["exercises"];
  onSave: (p: ExercisePreset) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  usage: "athlete" | "coach";
  goal: ProgressGoal | null;
  stat?: ExerciseStat;
  athleteId?: string;
  viewerId?: string;
  onSaveGoal?: (goal: ProgressGoal) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(preset);
  const [matching, setMatching] = useState(false);
  const [showingReference, setShowingReference] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const set = (patch: Partial<ExercisePreset>) => setDraft((d) => ({ ...d, ...patch }));
  const linked = library.find((item) => item.wgerId === draft.wger_exercise_id);

  return (
    <Sheet open onClose={onClose} title={preset.name || "New exercise"}>
      <div className="space-y-3">
        <div className="rounded-2xl border border-line bg-inset p-3">
          {linked ? (
            <>
              <MuscleFigure exercise={linked} />
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-muted">Database match</p>
              <p className="text-sm font-black text-ink">{linked.name}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setShowingReference(true)}>Full reference</Button>
                <Button size="sm" variant="secondary" onClick={() => setMatching(true)}>Change match</Button>
                <Button size="sm" variant="ghost" onClick={() => set({ wger_exercise_id: null })}>Unlink</Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-ink">No database match</p>
                <p className="text-xs font-semibold text-muted">Match manually to add canonical muscle figures.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setMatching(true)}>
                <Icon.link className="h-4 w-4" /> Match
              </Button>
            </div>
          )}
        </div>

        <Field label="Exercise name">
          <TextField
            value={draft.name}
            placeholder="Sled push"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>

        <LogTypePicker value={draft.log_type} onChange={(log_type) => set({ log_type })} />

        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets">
            <NumberField value={draft.target_sets} min={1} max={20} onChange={(v) => set({ target_sets: v ?? 1 })} />
          </Field>
          <Field label="Reps">
            <NumberField value={draft.target_reps} min={0} max={100} onChange={(v) => set({ target_reps: v ?? 0 })} />
          </Field>
          <Field label="Rest">
            <NumberField value={draft.rest_sec} step={15} max={600} suffix="s" onChange={(v) => set({ rest_sec: v ?? 0 })} />
          </Field>
        </div>

        <CustomFieldsEditor
          fields={draft.custom_fields}
          onChange={(custom_fields) => set({ custom_fields })}
        />

        <Field label="Notes">
          <TextField
            value={draft.notes}
            placeholder="Setup, cue, machine number…"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-inset px-3 py-2">
          <p className="text-sm font-bold text-ink">Favourite</p>
          <button
            onClick={() => set({ is_favorite: !draft.is_favorite })}
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              draft.is_favorite ? "bg-accent text-white" : "border border-line text-muted"
            }`}
          >
            {draft.is_favorite ? "Yes" : "No"}
          </button>
        </div>

        {usage === "athlete" && athleteId && viewerId && onSaveGoal && (
          <div>
            {goal && (
              <GoalProgressCard
                goal={goal}
                current={goalCurrent(goal, stat)}
                color="var(--t-accent)"
                onEdit={() => setGoalOpen(true)}
              />
            )}
            {!goal && (
              <Button full variant="secondary" onClick={() => setGoalOpen(true)}>Set a personal record goal</Button>
            )}
          </div>
        )}
      </div>

      <Button full className="mt-4" disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
        Save exercise
      </Button>
      {onDelete && (
        <Button full variant="danger" className="mt-2" onClick={onDelete}>
          <Icon.trash className="h-4 w-4" /> Remove from library
        </Button>
      )}
      {matching && (
        <MatchExerciseSheet
          currentName={draft.name}
          exercises={library}
          onClose={() => setMatching(false)}
          onMatch={(exercise) => {
            set({ wger_exercise_id: exercise.wgerId });
            setMatching(false);
          }}
        />
      )}
      {showingReference && linked && (
        <LibraryExerciseSheet
          exercise={linked}
          allExercises={library}
          coachTip={draft.notes}
          tipLabel={usage === "coach" ? "Your coaching tips" : "Your saved tips"}
          onClose={() => setShowingReference(false)}
        />
      )}
      {goalOpen && athleteId && viewerId && onSaveGoal && (() => {
        const contexts: GoalContextOption[] = [{ scopeType: "exercise", key: nameKey(draft.name), label: draft.name || "Exercise" }];
        return (
          <ProgressGoalEditor
            open
            goal={goal}
            athleteId={athleteId}
            viewerId={viewerId}
            contexts={contexts}
            defaultContext={contexts[0]}
            defaultTargetType={stat?.hasWeight === false ? "reps" : "weight"}
            suggestedTargetValue={stat
              ? stat.hasWeight
                ? Math.max(1, Math.ceil(stat.best * 1.05 / 2.5) * 2.5)
                : Math.max(1, Math.ceil(stat.bestReps * 1.1))
              : undefined}
            metric="exercise_pr"
            onClose={() => setGoalOpen(false)}
            onSave={onSaveGoal}
            onDelete={onDeleteGoal}
          />
        );
      })()}
    </Sheet>
  );
}

function goalCurrent(goal: ProgressGoal, stat?: ExerciseStat): number {
  if (!stat) return 0;
  if (goal.target_type === "reps") return stat.bestReps;
  if (goal.target_type === "estimated_max") return stat.best1RM;
  return stat.best;
}

function goalProgress(goal: ProgressGoal, stat?: ExerciseStat): number {
  return goal.target_value > 0 ? Math.max(0, Math.min(100, goalCurrent(goal, stat) / goal.target_value * 100)) : 0;
}
