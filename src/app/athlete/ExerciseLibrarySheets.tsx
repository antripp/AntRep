import { useMemo, useState } from "react";
import { suggestedLibraryQuery, type LibraryExercise } from "../../data/exerciseLibrary";
import { Button, EmptyState, Icon, Pill, Sheet, TextField } from "../../ui/kit";
import { MuscleFigure } from "./MuscleFigure";

export function LibraryExerciseSheet({
  exercise,
  allExercises = [],
  coachTip,
  tipLabel = "Coach tips",
  actionLabel,
  onAction,
  onClose,
}: {
  exercise: LibraryExercise;
  allExercises?: LibraryExercise[];
  coachTip?: string;
  tipLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  const [reference, setReference] = useState<"muscles" | "photo" | "video">("muscles");
  const photo = [...exercise.images].sort((a, b) => Number(b.isMain) - Number(a.isMain))[0];
  const video = [...exercise.videos].sort((a, b) => Number(b.isMain) - Number(a.isMain))[0];
  const related = exercise.variationGroup
    ? allExercises.filter((item) => item.wgerId !== exercise.wgerId && item.variationGroup === exercise.variationGroup).slice(0, 12)
    : [];
  const references = [
    { value: "muscles" as const, label: "Muscles", available: true },
    { value: "photo" as const, label: "Photo", available: Boolean(photo) },
    { value: "video" as const, label: "Video", available: Boolean(video) },
  ].filter((item) => item.available);

  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      {coachTip?.trim() && (
        <InfoBlock title={tipLabel} className="mb-3 border border-accent/30 bg-accent-soft" text={coachTip.trim()} />
      )}

      <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-muted">Reference</p>
      <div className="mb-3 flex gap-1.5">
        {references.map((item) => (
          <button
            key={item.value}
            onClick={() => setReference(item.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              reference === item.value ? "bg-accent text-white" : "border border-line bg-surface text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {reference === "muscles" && <MuscleFigure exercise={exercise} />}
      {reference === "photo" && photo && (
        <div>
          <img src={photo.url} alt={`${exercise.name} reference`} className="max-h-72 w-full rounded-2xl bg-inset object-contain" />
          <MediaCredit author={photo.licenseAuthor} source={photo.licenseObjectURL} ai={photo.isAiGenerated} />
        </div>
      )}
      {reference === "video" && video && (
        <div>
          <video src={video.url} controls playsInline preload="metadata" className="max-h-72 w-full rounded-2xl bg-black" />
          <MediaCredit author={video.licenseAuthor} source={video.licenseObjectURL} />
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Pill tint="var(--t-accent)">{exercise.wgerCategoryName || exercise.category}</Pill>
        </div>
        {exercise.primaryMuscles.length > 0 && (
          <MuscleNames title="Primary" names={exercise.primaryMuscles.map((item) => item.name)} />
        )}
        {exercise.secondaryMuscles.length > 0 && (
          <MuscleNames title="Secondary" names={exercise.secondaryMuscles.map((item) => item.name)} />
        )}
        {exercise.description && <InfoBlock title="Description & instructions" text={exercise.description} />}
        {exercise.equipmentNames.length > 0 && <InfoBlock title="Equipment" text={exercise.equipmentNames.join(", ")} />}
        {exercise.tips.length > 0 && <InfoBlock title="Reference tips" text={exercise.tips.join("\n\n")} />}
        {related.length > 0 && (
          <div className="rounded-2xl bg-inset px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted">Variations & related movements</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {related.map((item) => <Pill key={item.wgerId}>{item.name}</Pill>)}
            </div>
          </div>
        )}
        {exercise.aliases.length > 0 && <InfoBlock title="Alternative names & aliases" text={exercise.aliases.join(", ")} />}
        <Attribution exercise={exercise} />
      </div>
      {actionLabel && onAction && <Button full className="mt-5" onClick={onAction}>{actionLabel}</Button>}
      <p className="mt-3 text-center text-[10px] font-semibold text-muted">Exercise and muscle data by wger</p>
    </Sheet>
  );
}

function InfoBlock({ title, text, className = "bg-inset" }: { title: string; text: string; className?: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function MediaCredit({ author, source, ai = false }: { author: string; source: string; ai?: boolean }) {
  if (!author && !source && !ai) return null;
  return (
    <p className="mt-1 text-center text-[10px] font-semibold text-muted">
      {author && `By ${author}`}{author && (source || ai) && " · "}{ai && "AI-generated"}
      {source && <>{(author || ai) && " · "}<a href={source} target="_blank" rel="noreferrer" className="underline">Source</a></>}
    </p>
  );
}

function Attribution({ exercise }: { exercise: LibraryExercise }) {
  const updateDate = exercise.lastUpdated ? new Date(exercise.lastUpdated) : null;
  const updated = updateDate && !Number.isNaN(updateDate.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(updateDate)
    : "Unknown";
  return (
    <div className="border-t border-line pt-3 text-[11px] font-semibold leading-relaxed text-muted">
      <p>
        Data by wger
        {exercise.licenseAuthor && ` · ${exercise.licenseAuthor}`}
        {exercise.license && <> · <a href={exercise.license.url} target="_blank" rel="noreferrer" className="underline">{exercise.license.shortName || exercise.license.fullName}</a></>}
      </p>
      <p>Last updated {updated}{exercise.uuid && ` · Reference ${exercise.uuid.slice(0, 8)}`}</p>
    </div>
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
