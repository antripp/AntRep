/**
 * Exercise library: user-owned logging presets plus the canonical paginated
 * wger catalogue used by antrip.health. The canonical ID supplies only name
 * and muscle metadata; logged data and progression remain keyed as before.
 */

import { useMemo, useState } from "react";
import { api } from "../../data";
import type { LibraryExercise } from "../../data/exerciseLibrary";
import { makePreset } from "../../data/factories";
import {
  Button,
  EmptyState,
  Icon,
  ScreenTitle,
  SectionHeader,
  Segmented,
  Spinner,
  TextField,
} from "../../ui/kit";
import { useWorkspace } from "../workspace";
import { ExerciseCategoryTabs, type ExerciseCategoryFilter } from "../shared/ExerciseCategoryTabs";
import { LibraryExerciseSheet, PageButtons } from "./ExerciseLibrarySheets";
import { ExercisePresetLibrary } from "./LibrarySection";
import { useExerciseLibrary } from "./useExerciseLibrary";
import { exerciseStats, type ExerciseStat } from "../../domain/analytics";
import type { ProgressGoal } from "../../data/types";
import { ProgressGoalEditor, type GoalContextOption } from "../progress/ProgressGoalEditor";
import { nameKey } from "../../domain/logging";

const PAGE_SIZE = 20;

export default function ExercisesScreen() {
  const { profile, sessions, logs, presets, goals, reload, showToast } = useWorkspace();
  const logged = useMemo(() => {
    const ids = new Set(sessions.map((session) => session.id));
    return new Set(
      logs.filter((log) => ids.has(log.session_id)).map((log) => log.exercise_name.trim().toLowerCase()),
    );
  }, [sessions, logs]);
  const stats = useMemo(() => exerciseStats(sessions, logs), [sessions, logs]);

  return (
    <ExerciseLibraryScreen
      profile={profile}
      presets={presets}
      reload={reload}
      showToast={showToast}
      logged={logged}
      goals={goals}
      stats={stats}
      athleteId={profile.id}
      viewerId={profile.id}
      onSaveGoal={async (goal) => { await api.saveProgressGoal(goal); await reload(); }}
      onDeleteGoal={async (id) => { await api.deleteProgressGoal(id); await reload(); }}
    />
  );
}

export function ExerciseLibraryScreen({
  profile,
  presets,
  reload,
  showToast,
  logged = new Set<string>(),
  title = "Library",
  usage = "athlete",
  goals = [],
  stats = [],
  athleteId,
  viewerId,
  onSaveGoal,
  onDeleteGoal,
}: {
  profile: ReturnType<typeof useWorkspace>["profile"];
  presets: ReturnType<typeof useWorkspace>["presets"];
  reload: () => Promise<void>;
  showToast: (message: string) => void;
  logged?: Set<string>;
  title?: string;
  usage?: "athlete" | "coach";
  goals?: ProgressGoal[];
  stats?: ExerciseStat[];
  athleteId?: string;
  viewerId?: string;
  onSaveGoal?: (goal: ProgressGoal) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}) {
  const canonical = useExerciseLibrary();
  const [view, setView] = useState<"mine" | "browse">("mine");

  async function saveOrMatch(exercise: LibraryExercise) {
    const linked = presets.find((preset) => preset.wger_exercise_id === exercise.wgerId);
    if (linked) return;

    const legacy = presets.find(
      (preset) => !preset.wger_exercise_id && preset.name.trim().toLowerCase() === exercise.name.toLowerCase(),
    );
    if (legacy) {
      await api.savePreset({ ...legacy, wger_exercise_id: exercise.wgerId });
      showToast(`${legacy.name} matched to the exercise database`);
    } else {
      await api.savePreset(makePreset(profile.id, exercise.name, {
        wger_exercise_id: exercise.wgerId,
        category: exercise.category,
        log_type: exercise.logType,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
      }));
      showToast("Saved to your library");
    }
    await reload();
  }

  return (
    <>
      <ScreenTitle title={title} />
      <div className="mb-4">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "mine", label: `Mine (${presets.length})` },
            { value: "browse", label: "Browse all" },
          ]}
        />
      </div>

      {view === "mine" && (
        <ExercisePresetLibrary
          profile={profile}
          presets={presets}
          reload={reload}
          showToast={showToast}
          usage={usage}
          goals={goals}
          stats={stats}
          athleteId={athleteId}
          viewerId={viewerId}
          onSaveGoal={onSaveGoal}
          onDeleteGoal={onDeleteGoal}
        />
      )}
      {view === "browse" && (
        <BrowseList
          exercises={canonical.exercises}
          loading={canonical.loading}
          error={canonical.error}
          logged={logged}
          presets={presets}
          usage={usage}
          onRetry={canonical.retry}
          onSave={saveOrMatch}
          goals={goals}
          stats={stats}
          athleteId={athleteId}
          viewerId={viewerId}
          onSaveGoal={onSaveGoal}
          onDeleteGoal={onDeleteGoal}
        />
      )}
    </>
  );
}

function BrowseList({
  exercises,
  loading,
  error,
  logged,
  presets,
  usage,
  onRetry,
  onSave,
  goals,
  stats,
  athleteId,
  viewerId,
  onSaveGoal,
  onDeleteGoal,
}: {
  exercises: LibraryExercise[];
  loading: boolean;
  error: string;
  logged: Set<string>;
  presets: ReturnType<typeof useWorkspace>["presets"];
  usage: "athlete" | "coach";
  onRetry: () => void;
  onSave: (exercise: LibraryExercise) => Promise<void>;
  goals: ProgressGoal[];
  stats: ExerciseStat[];
  athleteId?: string;
  viewerId?: string;
  onSaveGoal?: (goal: ProgressGoal) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategoryFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [goalExercise, setGoalExercise] = useState<LibraryExercise | null>(null);
  const [editingGoal, setEditingGoal] = useState<ProgressGoal | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((item) =>
      (category === "all" || item.category === category) &&
      (!q || item.name.toLowerCase().includes(q)),
    );
  }, [category, exercises, query]);
  const categoryCounts = useMemo(() => ({
    all: exercises.length,
    push: exercises.filter((item) => item.category === "push").length,
    pull: exercises.filter((item) => item.category === "pull").length,
    legs: exercises.filter((item) => item.category === "legs").length,
    core: exercises.filter((item) => item.category === "core").length,
    cardio: exercises.filter((item) => item.category === "cardio").length,
  }), [exercises]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const linkedIds = useMemo(
    () => new Set(presets.map((preset) => preset.wger_exercise_id).filter(Boolean)),
    [presets],
  );
  const legacyNames = useMemo(
    () => new Set(presets.filter((preset) => !preset.wger_exercise_id).map((preset) => preset.name.trim().toLowerCase())),
    [presets],
  );

  return (
    <>
      <TextField
        placeholder="Search the exercise database"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(1); }}
      />
      <ExerciseCategoryTabs
        value={category}
        counts={categoryCounts}
        onChange={(next) => { setCategory(next); setPage(1); }}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-sm font-bold text-muted">
          <Spinner /> Loading exercise database…
        </div>
      ) : error ? (
        <EmptyState
          title="Library unavailable"
          subtitle={error}
          action={<Button variant="secondary" onClick={onRetry}>Try again</Button>}
        />
      ) : (
        <>
          <SectionHeader title={`${filtered.length} exercises`} />
          {shown.length === 0 ? (
            <EmptyState title="No match" subtitle="Try a shorter or different exercise name." />
          ) : (
            <div className="space-y-1.5">
              {shown.map((exercise) => {
                const saved = linkedIds.has(exercise.wgerId);
                const legacy = legacyNames.has(exercise.name.toLowerCase());
                const key = nameKey(exercise.name);
                const goal = goals.find((item) => item.scope_type === "exercise" && item.scope_key === key && item.status === "active");
                const stat = stats.find((item) => item.key === key);
                return (
                  <div key={exercise.wgerId} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2.5">
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelected(exercise)}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-ink">{exercise.name}</p>
                        <p className="truncate text-[11px] font-bold uppercase text-muted">
                          {exercise.wgerCategoryName || exercise.category}
                          {logged.has(exercise.name.trim().toLowerCase()) && " · logged"}
                          {goal && ` · ${Math.round(goalProgress(goal, stat))}% to goal`}
                        </p>
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant={saved ? "secondary" : "ghost"}
                      disabled={saved}
                      onClick={() => void onSave(exercise)}
                    >
                      {saved ? <Icon.check className="h-4 w-4" /> : legacy ? <Icon.link className="h-4 w-4" /> : <Icon.plus className="h-4 w-4" />}
                      {saved ? "Saved" : legacy ? "Match" : "Save"}
                    </Button>
                    {usage === "athlete" && athleteId && viewerId && onSaveGoal && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setEditingGoal(goal ?? null); setGoalExercise(exercise); }}
                      >
                        {goal ? "Goal ✓" : "Set goal"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <PageButtons page={Math.min(page, pages)} pages={pages} onPage={setPage} />
        </>
      )}

      <p className="mt-6 text-center text-[11px] font-semibold text-muted">
        Database matching adds canonical reference data only. Your logged data and progression stay unchanged.
      </p>

      {selected && (
        <LibraryExerciseSheet
          exercise={selected}
          allExercises={exercises}
          coachTip={presets.find((preset) =>
            preset.wger_exercise_id === selected.wgerId ||
            preset.name.trim().toLowerCase() === selected.name.toLowerCase(),
          )?.notes}
          tipLabel={usage === "coach" ? "Your coaching tips" : "Your saved tips"}
          actionLabel={linkedIds.has(selected.wgerId) ? undefined : legacyNames.has(selected.name.toLowerCase()) ? "Match existing exercise" : "Save to my library"}
          onAction={linkedIds.has(selected.wgerId) ? undefined : async () => {
            await onSave(selected);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {goalExercise && athleteId && viewerId && onSaveGoal && (() => {
        const contexts: GoalContextOption[] = [{ scopeType: "exercise", key: nameKey(goalExercise.name), label: goalExercise.name }];
        const exerciseStat = stats.find((item) => item.key === nameKey(goalExercise.name));
        return (
          <ProgressGoalEditor
            open
            goal={editingGoal}
            athleteId={athleteId}
            viewerId={viewerId}
            contexts={contexts}
            defaultContext={contexts[0]}
            defaultTargetType={exerciseStat?.hasWeight === false ? "reps" : "weight"}
            suggestedTargetValue={exerciseStat
              ? exerciseStat.hasWeight
                ? Math.max(1, Math.ceil(exerciseStat.best * 1.05 / 2.5) * 2.5)
                : Math.max(1, Math.ceil(exerciseStat.bestReps * 1.1))
              : undefined}
            metric="exercise_pr"
            onClose={() => setGoalExercise(null)}
            onSave={onSaveGoal}
            onDelete={onDeleteGoal}
          />
        );
      })()}
    </>
  );
}

function goalProgress(goal: ProgressGoal, stat?: ExerciseStat): number {
  if (!stat || goal.target_value <= 0) return 0;
  const current = goal.target_type === "reps" ? stat.bestReps
    : goal.target_type === "estimated_max" ? stat.best1RM
      : stat.best;
  return Math.max(0, Math.min(100, current / goal.target_value * 100));
}
