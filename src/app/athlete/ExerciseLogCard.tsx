/** One exercise in the logger: targets, set rows, and the done button. */

import { useEffect, useMemo, useState } from "react";
import { makeSet } from "../../data/factories";
import type { PlanExercise, Session, SetLog } from "../../data/types";
import { formatShortDate } from "../../domain/dates";
import {
  lastPerformance,
  namesMatch,
  plannedSetCount,
  prescriptionLabel,
  setHasData,
  targetForSet,
} from "../../domain/logging";
import { formatSetCell } from "../../domain/planLog";
import { typeColor } from "../../domain/plan";
import { rpeColor, rpeMeaning } from "../../domain/rpe";
import { plural } from "../../domain/text";
import { Icon, IconTile, NumberField, Pill, RpeSlider } from "../../ui/kit";
import { RestTimerBar, RestTimerPill, useRestTimer } from "./RestTimer";
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
    case "bodyweight":
      return prescriptionLabel(exercise);
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
  const { logs, sessions, saveSets, setExerciseDone } = useWorkspace();
  const stored = useMemo(() => setsForExercise(logs, session?.id, exercise.name), [logs, session?.id, exercise.name]);
  const lastTime = useMemo(
    () => lastPerformance(sessions, logs, exercise.name, session?.id),
    [sessions, logs, exercise.name, session?.id],
  );

  /**
   * The rows the card opens with: one per planned set, so the prescription is
   * visible without having to build the card up a tap at a time.
   *
   * They are deliberately EMPTY. The target shows as placeholder text and the
   * per-set tick fills it in — because a row carrying real numbers would count
   * as data to `setHasData`, and the autosave would quietly log sets nobody
   * performed. Showing the plan and claiming it happened are different things.
   */
  const rowsFor = useMemo(() => {
    return (logged: SetLog[]): SetLog[] => {
      // Top the logged sets up to the number the plan asks for, so set 2 and 3
      // are already waiting once set 1 is in — rather than making you press
      // "Add set" for work the plan already prescribed.
      const missing = plannedSetCount(exercise) - logged.length;
      if (missing <= 0) return logged;
      return [
        ...logged,
        ...Array.from({ length: missing }, (_, i) =>
          makeSet(session?.id ?? "", exercise.name, logged.length + i + 1),
        ),
      ];
    };
  }, [exercise, session?.id]);

  const [draft, setDraft] = useState<SetLog[]>(() => rowsFor(stored));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** True while the row holds edits that haven't reached the backend yet. */
  const [dirty, setDirty] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  // Lives on the card, not inside the collapsible body, so collapsing the
  // exercise to look at the next one doesn't cancel a rest already running.
  const restTimer = useRestTimer(exercise.rest_sec);

  // While the card is open the rows on screen stay put — including one you've
  // just emptied, so you can fill it back in. Saved sets re-sync on reopen,
  // falling back to the prescription once everything logged has been removed.
  useEffect(() => {
    if (!dirty && !open) setDraft(rowsFor(stored));
  }, [stored, rowsFor, dirty, open]);

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

  /**
   * A fresh row beyond the prescription, carrying forward whatever the last
   * real set used. This one IS pre-filled: you asked for an extra set, so the
   * last set's numbers are the best guess at what it will be.
   */
  function seedSet(active: Session) {
    const previous = [...draft].reverse().find(setHasData);
    const target = targetForSet(exercise, draft.length + 1);
    const seeded = makeSet(active.id, exercise.name, draft.length + 1, {
      weight_kg: previous?.weight_kg ?? target.weight,
      reps: previous?.reps ?? target.reps,
      rpe: previous?.rpe ?? target.rpe,
    });
    setDraft((current) => [...current, seeded]);
    setDirty(true);
  }

  /** Fill a prescribed row with exactly what the plan asked for. */
  function confirmTarget(index: number) {
    const target = targetForSet(exercise, index + 1);
    if (target.reps === null && target.weight === null) return;
    updateSet(index, { weight_kg: target.weight, reps: target.reps, rpe: target.rpe });
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

        {/* Only while collapsed — open, the full bar below already shows it. */}
        {!open && <RestTimerPill timer={restTimer} tint={tint} />}

        {exercise.rpe_target > 0 && (open || !(restTimer.running || restTimer.finished)) && (
          <Pill tint={tint}>RPE {exercise.rpe_target}</Pill>
        )}

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

          {/* What you did last time — the number today's load is chosen from. */}
          {lastTime && (
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-inset px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-muted">
                Last time
              </span>
              <span className="text-[11px] font-bold text-muted">
                {formatShortDate(lastTime.date)}
              </span>
              <span className="text-[11px] font-black text-ink">
                {lastTime.sets.map((s) => formatSetCell(s, exercise.log_type, true)).join("  ·  ")}
              </span>
            </div>
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
            {draft.map((set, index) => {
              const target = targetForSet(exercise, index + 1);
              const logged = setHasData(set);
              const canConfirm = !logged && (target.weight !== null || target.reps !== null);
              const targetText = [
                target.weight !== null ? `${target.weight} kg` : null,
                target.reps !== null ? `${target.reps} reps` : null,
              ]
                .filter(Boolean)
                .join(" × ");

              return (
                <div
                  key={set.id}
                  className="rounded-2xl border p-2.5"
                  style={{
                    borderColor: logged ? `${tint}55` : "var(--t-line)",
                    background: logged ? `${tint}0f` : "transparent",
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`text-[11px] font-black uppercase ${logged ? "text-ink" : "text-muted/70"}`}
                    >
                      Set {index + 1}
                    </span>

                    {/* The prescription, and one tap to say you hit it. */}
                    {canConfirm && (
                      <button
                        onClick={() => confirmTarget(index)}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-inset px-2 py-0.5 text-[11px] font-black text-muted active:scale-95"
                        title={`Log this set as ${targetText}`}
                      >
                        <Icon.check className="h-3 w-3" /> {targetText}
                      </button>
                    )}
                    {logged && set.rpe ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{ background: `${rpeColor(set.rpe)}22`, color: rpeColor(set.rpe) }}
                      >
                        RPE {set.rpe}
                      </span>
                    ) : null}

                    <button
                      aria-label={`Remove set ${index + 1}`}
                      onClick={() => removeSet(index)}
                      className="ml-auto shrink-0 text-muted active:text-danger"
                    >
                      <Icon.trash className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Built-in fields for the exercise's logging method. The
                        target shows as placeholder, so an empty row reads as
                        "this is what was asked for" rather than as a result. */}
                    {(exercise.log_type === "strength" || exercise.log_type === "bodyweight") && (
                      <>
                        <NumberField
                          value={set.weight_kg}
                          step={2.5}
                          suffix={exercise.log_type === "bodyweight" ? "+kg" : "kg"}
                          placeholder={target.weight !== null ? String(target.weight) : undefined}
                          onChange={(v) => updateSet(index, { weight_kg: v })}
                        />
                        <NumberField
                          value={set.reps}
                          step={1}
                          suffix="reps"
                          placeholder={target.reps !== null ? String(target.reps) : undefined}
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
                          placeholder={target.reps !== null ? String(target.reps) : undefined}
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
                  </div>

                  {/* Effort, per set. On its own line so the scale has room to
                      be read and thumbed mid-workout. */}
                  <div className="mt-2">
                    <RpeSlider
                      value={set.rpe}
                      onChange={(v) => updateSet(index, { rpe: v })}
                      meaning={rpeMeaning(set.rpe ?? target.rpe)}
                      color={rpeColor(set.rpe)}
                      target={exercise.rpe_target || null}
                    />
                  </div>
                </div>
              );
            })}
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
              <RestTimerBar timer={restTimer} seconds={exercise.rest_sec} tint={tint} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
