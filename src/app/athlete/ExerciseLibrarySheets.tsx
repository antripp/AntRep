import { useMemo, useState } from "react";
import { suggestedLibraryQuery, type LibraryExercise } from "../../data/exerciseLibrary";
import { Button, EmptyState, Icon, Pill, Sheet, TextField } from "../../ui/kit";
import { MuscleFigure } from "./MuscleFigure";

export function LibraryExerciseSheet({
  exercise,
  actionLabel,
  onAction,
  onClose,
}: {
  exercise: LibraryExercise;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      <MuscleFigure exercise={exercise} />
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Pill tint="var(--t-accent)">{exercise.wgerCategoryName || exercise.category}</Pill>
          {exercise.equipmentNames.map((equipment) => <Pill key={equipment}>{equipment}</Pill>)}
        </div>
        {exercise.primaryMuscles.length > 0 && (
          <MuscleNames title="Primary" names={exercise.primaryMuscles.map((item) => item.name)} />
        )}
        {exercise.secondaryMuscles.length > 0 && (
          <MuscleNames title="Secondary" names={exercise.secondaryMuscles.map((item) => item.name)} />
        )}
      </div>
      {actionLabel && onAction && <Button full className="mt-5" onClick={onAction}>{actionLabel}</Button>}
      <p className="mt-3 text-center text-[10px] font-semibold text-muted">Exercise and muscle data by wger</p>
    </Sheet>
  );
}

function MuscleNames({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="rounded-2xl bg-inset px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{names.join(", ")}</p>
    </div>
  );
}

export function MatchExerciseSheet({
  currentName,
  exercises,
  onMatch,
  onClose,
}: {
  currentName: string;
  exercises: LibraryExercise[];
  onMatch: (exercise: LibraryExercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(() => suggestedLibraryQuery(currentName));
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? exercises.filter((item) => item.name.toLowerCase().includes(q)) : exercises;
  }, [exercises, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Sheet open onClose={onClose} title="Match exercise">
      <p className="mb-3 text-xs font-semibold leading-snug text-muted">
        Link “{currentName}” to its canonical record. Its name, sets, rest, notes, progression and logged history will not change.
      </p>
      <TextField
        autoFocus
        value={query}
        placeholder="Search exercise database"
        onChange={(event) => { setQuery(event.target.value); setPage(1); }}
      />
      {shown.length === 0 ? (
        <EmptyState title="No match" subtitle="Try a shorter or different exercise name." />
      ) : (
        <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {shown.map((exercise) => (
            <button
              key={exercise.wgerId}
              className="flex w-full items-center gap-3 p-3 text-left"
              onClick={() => onMatch(exercise)}
            >
              <MuscleFigure exercise={exercise} compact />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">{exercise.name}</p>
                <p className="truncate text-[11px] font-bold text-muted">
                  {exercise.primaryMuscles.map((item) => item.name).join(", ") || exercise.wgerCategoryName}
                </p>
              </div>
              <Icon.chevron className="h-4 w-4 text-muted" />
            </button>
          ))}
        </div>
      )}
      <PageButtons page={page} pages={pages} onPage={setPage} />
    </Sheet>
  );
}

export function PageButtons({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icon.back className="h-4 w-4" /> Previous
      </Button>
      <span className="text-xs font-black text-muted">{page} / {pages}</span>
      <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <Icon.chevron className="h-4 w-4" />
      </Button>
    </div>
  );
}
