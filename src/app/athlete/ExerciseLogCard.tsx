/** One exercise in the logger: targets, set rows, and the done button. */

import { useEffect, useMemo, useState } from "react";
import { makeSet } from "../../data/factories";
import type { PlanExercise, Session, SetLog } from "../../data/types";
import { formatDuration } from "../../domain/dates";
import { namesMatch, setHasData } from "../../domain/logging";
import { typeColor } from "../../domain/plan";
import { plural } from "../../domain/text";
import { Icon, IconTile, NumberField, Pill } from "../../ui/kit";
import { setsForExercise, useWorkspace } from "../workspace";
import type { ResolvedSegment } from "../../domain/plan";

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  push: "🏋️",
  pull: "🚣",
  legs: "🦵",
  core: "🧘",
  cardio: "🏃",
};

/** What to show when the plan doesn't spell out a scheme. */
function defaultTarget(exercise: PlanExercise): string {
  switch (exercise.log_type) {
    case "strength":
      return `${exercise.target_sets} × ${exercise.target_reps}`;
    case "bodyweight":
      return `${exercise.target_sets} × ${exercise.target_reps || "max"} reps`;
    case "cardio":
      return "Distance & time";
    case "timed":
      return "Hold";
    case "interval":
      return `${exercise.target_sets} rounds`;
    default:
      return exercise.custom_fields.map((f) => f.label).join(" · ") || "Custom";
  }
}

export function ExerciseLogCard({
  exercise,
  segment,
  session,
  editable,
  onNeedSession,
  alternates,
  onPickAlternate,
  tint: tintOverride,
  onRemove,
}: {
  exercise: PlanExercise;
  /** Omitted for extra work logged outside the plan. */
  segment?: ResolvedSegment;
  session: Session | undefined;
  editable: boolean;
  onNeedSession: () => Promise<Session>;
  alternates?: PlanExercise[];
  onPickAlternate?: (exercise: PlanExercise) => void;
  tint?: string;
  onRemove?: () => void;
}) {
  const { logs, saveSets, setExerciseDone } = useWorkspace();
  const stored = useMemo(() => setsForExercise(logs, session?.id, exercise.name), [logs, session?.id, exercise.name]);
  const [draft, setDraft] = useState<SetLog[]>(stored);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** True while the row holds edits that haven't reached the backend yet. */
  const [dirty, setDirty] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  // While the card is open the rows on screen stay put — including one you've
  // just emptied, so you can fill it back in. Saved sets re-sync on reopen.
  useEffect(() => {
    if (!dirty && !open) setDraft(stored);
  }, [stored, dirty, open]);

  const done = Boolean(session?.completed_names.some((n) => namesMatch(n, exercise.name)));
  const tint =
    tintOverride ??
    (segment ? typeColor(segment.dayType, exercise.color_hex || segment.day.color_hex) : "var(--t-accent)");
  const target = exercise.rep_scheme || defaultTarget(exercise);

  /**
   * Blank rows stay on screen so you can fill them in, but they are never
   * saved — otherwise an accidental empty set shifts every later set number.
   *
   * Throws if the write fails: the caller decides what to say, and the sets
   * stay on screen so nothing typed is lost while the problem is fixed.
   */
  async function commit(next: SetLog[]) {
    setDraft(next);
    setDirty(false);
    const active = session ?? (await onNeedSession());
    await saveSets(
      active,
      exercise.name,
      next.filter(setHasData),
    );
  }

  // Edits save themselves shortly after you stop typing — no Save press needed.
  // A failure here has no click behind it to report to, so it says so inline:
  // silence is what made a dead database look like a working one.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      commit(draft).catch((error) => {
        setHint(error instanceof Error ? error.message : "Couldn't save those sets.");
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, draft]);

  /** A fresh row, carrying forward whatever the last real set used. */
  function seedSet(active: Session) {
    const previous = [...draft].reverse().find(setHasData);
    const seeded = makeSet(active.id, exercise.name, draft.length + 1, {
      weight_kg: previous?.weight_kg ?? (exercise.target_weight_kg || null),
      reps:
        previous?.reps ??
        (exercise.log_type === "strength" || exercise.log_type === "bodyweight"
          ? exercise.target_reps
          : null),
      rpe: previous?.rpe ?? (exercise.rpe_target || null),
    });
    setDraft((current) => [...current, seeded]);
    setDirty(true);
  }

  async function addSet() {
    setOpen(true);
    setHint(null);
    // An empty row is already waiting — fill that one instead of adding another.
    const lastEmpty = draft.length > 0 && !setHasData(draft[draft.length - 1]);
    if (lastEmpty) {
      setHint(`Fill set ${draft.length} first`);
      return;
    }
    try {
      const active = session ?? (await onNeedSession());
      seedSet(active);
    } catch (error) {
      setHint(error instanceof Error ? error.message : "Couldn't start that session.");
    }
  }

  /**
   * `extraPatch` merges into the set's custom fields from the *latest* state, so
   * editing two fields in quick succession can't clobber one another.
   */
  function updateSet(
    index: number,
    patch: Partial<SetLog>,
    extraPatch?: Record<string, string | number>,
  ) {
    setHint(null);
    setDraft((current) =>
      current.map((s, i) =>
        i === index
          ? { ...s, ...patch, extra: extraPatch ? { ...s.extra, ...extraPatch } : s.extra }
          : s,
      ),
    );
    setDirty(true);
  }

  async function removeSet(index: number) {
    try {
      await commit(draft.filter((_, i) => i !== index));
    } catch (error) {
      setHint(error instanceof Error ? error.message : "Couldn't remove that set.");
    }
  }

  /**
   * Blank rows are dropped on save, so pressing Save with nothing filled in
   * used to look like the button was broken. Say what happened instead.
   */
  async function saveNow() {
    const withData = draft.filter(setHasData).length;
    if (withData === 0) {
      setHint("Nothing to save yet — put a number in a set first.");
      return;
    }
    try {
      await commit(draft);
      setHint(`${plural(withData, "set")} saved.`);
    } catch (error) {
      setHint(error instanceof Error ? error.message : "Couldn't save those sets.");
    }
  }

  async function toggleDone() {
    if (busy) return;
    setBusy(true);
    try {
      const active = session ?? (await onNeedSession());
      // Flush pending edits first so the sets and the tick save together.
      if (dirty) {
        setDirty(false);
        await saveSets(active, exercise.name, draft);
      }
      const nowDone = !done;
      await setExerciseDone(active, exercise, nowDone, segment);

      // Ticking an exercise you haven't logged yet opens it with a row ready,
      // so the numbers can go in rather than the tick being the whole story.
      if (nowDone && draft.filter(setHasData).length === 0) {
        setOpen(true);
        if (draft.length === 0) seedSet(active);
        setHint("Add your numbers — the tick alone doesn't record any sets.");
      }
    } catch (error) {
      setHint(error instanceof Error ? error.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  const loggedCount = draft.filter(setHasData).length;

  return (
    <div
      className="rounded-2xl border bg-surface"
      style={{ borderColor: done ? `${tint}66` : "var(--t-line)" }}
    >
      <div className="flex items-center gap-3 p-3">
        <IconTile emoji={CATEGORY_EMOJI[exercise.category] ?? "🏋️"} tint={tint} size={38} />

        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((v) => !v)}>
          <p className="truncate text-[15px] font-black text-ink">{exercise.name}</p>
          <p className="truncate text-xs font-bold text-muted">
            {target}
            {loggedCount > 0 && ` · ${loggedCount} set${loggedCount === 1 ? "" : "s"} logged`}
            {!exercise.is_mandatory && " · optional"}
          </p>
        </button>

        {exercise.rpe_target > 0 && <Pill tint={tint}>RPE {exercise.rpe_target}</Pill>}

        {editable && onRemove && (
          <button
            aria-label={`Remove ${exercise.name}`}
            onClick={onRemove}
            className="shrink-0 text-muted transition active:text-danger"
          >
            <Icon.trash className="h-4 w-4" />
          </button>
        )}

        {editable && (
          <button
            onClick={toggleDone}
            aria-label={done ? `Mark ${exercise.name} not done` : `Mark ${exercise.name} done`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-95"
            style={{
              background: done ? tint : "var(--t-inset)",
              borderColor: done ? tint : "var(--t-line)",
              color: done ? "#fff" : "var(--t-muted)",
            }}
          >
            <Icon.check className="h-5 w-5" />
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          {(exercise.trainer_notes || exercise.instructions) && (
            <p className="mb-2 rounded-xl bg-inset px-3 py-2 text-xs font-semibold leading-snug text-muted">
              {exercise.trainer_notes || exercise.instructions}
            </p>
          )}

          {alternates && alternates.length > 1 && onPickAlternate && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {alternates.map((alt) => (
                <button
                  key={alt.id}
                  onClick={() => onPickAlternate(alt)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                    alt.id === exercise.id ? "text-white" : "border border-line bg-inset text-muted"
                  }`}
                  style={alt.id === exercise.id ? { background: tint } : undefined}
                >
                  {alt.alternate_label || alt.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {draft.map((set, index) => (
              <div key={set.id} className="flex flex-wrap items-center gap-2">
                <span
                  className={`w-9 shrink-0 text-[11px] font-black uppercase ${
                    setHasData(set) ? "text-muted" : "text-muted/60"
                  }`}
                  title={setHasData(set) ? undefined : "Empty — fill it in or remove it"}
                >
                  Set {index + 1}
                </span>

                {/* Built-in fields for the exercise's logging method */}
                {(exercise.log_type === "strength" || exercise.log_type === "bodyweight") && (
                  <>
                    <NumberField
                      value={set.weight_kg}
                      step={2.5}
                      suffix={exercise.log_type === "bodyweight" ? "+kg" : "kg"}
                      onChange={(v) => updateSet(index, { weight_kg: v })}
                    />
                    <NumberField
                      value={set.reps}
                      step={1}
                      suffix="reps"
                      onChange={(v) => updateSet(index, { reps: v })}
                    />
                  </>
                )}

                {exercise.log_type === "cardio" && (
                  <>
                    <NumberField
                      value={set.distance_km}
                      step={0.5}
                      suffix="km"
                      onChange={(v) => updateSet(index, { distance_km: v })}
                    />
                    <NumberField
                      value={set.duration_sec ? Math.round(set.duration_sec / 60) : null}
                      step={5}
                      suffix="min"
                      onChange={(v) => updateSet(index, { duration_sec: v === null ? null : v * 60 })}
                    />
                  </>
                )}

                {exercise.log_type === "timed" && (
                  <NumberField
                    value={set.duration_sec}
                    step={5}
                    suffix="sec"
                    onChange={(v) => updateSet(index, { duration_sec: v })}
                  />
                )}

                {exercise.log_type === "interval" && (
                  <>
                    <NumberField
                      value={set.reps}
                      step={1}
                      suffix="rounds"
                      onChange={(v) => updateSet(index, { reps: v })}
                    />
                    <NumberField
                      value={set.duration_sec}
                      step={10}
                      suffix="sec"
                      onChange={(v) => updateSet(index, { duration_sec: v })}
                    />
                  </>
                )}

                {/* Effort. Applies to every logging method, and the plan's
                    target seeds it so the usual case is one tap to confirm. */}
                <NumberField
                  value={set.rpe}
                  step={0.5}
                  min={0}
                  max={10}
                  suffix="RPE"
                  placeholder={exercise.rpe_target > 0 ? String(exercise.rpe_target) : "—"}
                  onChange={(v) => updateSet(index, { rpe: v })}
                />

                {/* Whatever the coach (or you) defined for this exercise */}
                {exercise.custom_fields.map((field) =>
                  field.type === "number" ? (
                    <NumberField
                      key={field.key}
                      value={toNumberOrNull(set.extra?.[field.key])}
                      step={1}
                      suffix={field.unit || field.label}
                      onChange={(v) => updateSet(index, {}, { [field.key]: v === null ? "" : v })}
                    />
                  ) : (
                    <input
                      key={field.key}
                      value={String(set.extra?.[field.key] ?? "")}
                      placeholder={field.label}
                      onChange={(e) => updateSet(index, {}, { [field.key]: e.target.value })}
                      className="h-11 min-w-24 flex-1 rounded-2xl border border-line bg-inset px-3 text-[15px] font-bold text-ink outline-none placeholder:font-semibold placeholder:text-muted focus:border-accent"
                    />
                  ),
                )}

                <button
                  aria-label={`Remove set ${index + 1}`}
                  onClick={() => removeSet(index)}
                  className="shrink-0 text-muted active:text-danger"
                >
                  <Icon.trash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {hint && <p className="mt-2 text-[11px] font-black text-accent">{hint}</p>}

          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={addSet}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-inset px-3 py-1.5 text-xs font-black text-ink"
            >
              <Icon.plus className="h-3.5 w-3.5" /> Add set
            </button>
            {draft.length > 0 && (
              <button
                onClick={saveNow}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black text-white"
                style={{ background: tint }}
              >
                Save sets
              </button>
            )}
            {exercise.rest_sec > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                <Icon.clock className="h-3.5 w-3.5" /> {formatDuration(exercise.rest_sec)} rest
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
