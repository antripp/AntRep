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
import { LibraryExerciseSheet, PageButtons } from "./ExerciseLibrarySheets";
import LibrarySection from "./LibrarySection";
import { MuscleFigure } from "./MuscleFigure";
import { useExerciseLibrary } from "./useExerciseLibrary";

const PAGE_SIZE = 20;

export default function ExercisesScreen() {
  const { profile, sessions, logs, presets, reload, showToast } = useWorkspace();
  const canonical = useExerciseLibrary();
  const [view, setView] = useState<"mine" | "browse">("mine");

  const logged = useMemo(() => {
    const ids = new Set(sessions.map((session) => session.id));
    return new Set(
      logs.filter((log) => ids.has(log.session_id)).map((log) => log.exercise_name.trim().toLowerCase()),
    );
  }, [sessions, logs]);

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
      <ScreenTitle title="Library" />
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

      {view === "mine" && <LibrarySection />}
      {view === "browse" && (
        <BrowseList
          exercises={canonical.exercises}
          loading={canonical.loading}
          error={canonical.error}
          logged={logged}
          presets={presets}
          onRetry={canonical.retry}
          onSave={saveOrMatch}
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
  onRetry,
  onSave,
}: {
  exercises: LibraryExercise[];
  loading: boolean;
  error: string;
  logged: Set<string>;
  presets: ReturnType<typeof useWorkspace>["presets"];
  onRetry: () => void;
  onSave: (exercise: LibraryExercise) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? exercises.filter((item) => item.name.toLowerCase().includes(q)) : exercises;
  }, [exercises, query]);
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
                return (
                  <div key={exercise.wgerId} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2.5">
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelected(exercise)}>
                      <MuscleFigure exercise={exercise} compact />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-ink">{exercise.name}</p>
                        <p className="truncate text-[11px] font-bold uppercase text-muted">
                          {exercise.wgerCategoryName || exercise.category}
                          {logged.has(exercise.name.trim().toLowerCase()) && " · logged"}
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
                  </div>
                );
              })}
            </div>
          )}
          <PageButtons page={Math.min(page, pages)} pages={pages} onPage={setPage} />
        </>
      )}

      <p className="mt-6 text-center text-[11px] font-semibold text-muted">
        Database matching adds canonical names and muscle figures only. Your logged data and progression stay unchanged.
      </p>

      {selected && (
        <LibraryExerciseSheet
          exercise={selected}
          actionLabel={linkedIds.has(selected.wgerId) ? undefined : legacyNames.has(selected.name.toLowerCase()) ? "Match existing exercise" : "Save to my library"}
          onAction={linkedIds.has(selected.wgerId) ? undefined : async () => {
            await onSave(selected);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
