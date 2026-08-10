/**
 * Plan builder — used by both portals. A coach builds plans for athletes; an
 * athlete builds their own. Same data, same editor.
 */

import { useEffect, useMemo, useState } from "react";
import type { LibraryExercise } from "../../data/exerciseLibrary";
import type { PlanLoggedSession } from "../../data/api";
import { makeDay, makeExercise, makeSegment, newId } from "../../data/factories";
import {
  DAY_TYPES,
  DAY_TYPE_LABELS,
  type DayType,
  type ExercisePreset,
  type PlanBundle,
  type PlanDay,
  type PlanExercise,
  type RepeatMode,
  type ScheduleMode,
  type SetDetail,
  type Session,
} from "../../data/types";
import {
  blockCount,
  blockLabel,
  editableBlockCount,
  isCyclePlan,
  planSlots,
  resolveSegments,
  slotCount,
  slotFields,
  slotIndex,
  slotLabel,
  typeColor,
  typeIcon,
} from "../../domain/plan";
import { prescriptionLabel, setDetails } from "../../domain/logging";
import { rpeColor, rpeMeaning } from "../../domain/rpe";
import { newTimelineImpacts } from "../../domain/timelineSafety";
import { DayBoard } from "./DayBoard";
import { CustomFieldsEditor, LogTypePicker } from "./LoggingFields";
import { PasteImport } from "./PasteImport";
import {
  Button,
  Card,
  Field,
  Icon,
  IconButton,
  IconTile,
  NumberField,
  Pill,
  RpeSlider,
  SectionHeader,
  Segmented,
  Sheet,
  TextField,
  Toggle,
} from "../../ui/kit";
import { useExerciseLibrary } from "../athlete/useExerciseLibrary";
import { ExerciseCategoryTabs, type ExerciseCategoryFilter } from "../shared/ExerciseCategoryTabs";

export type ExercisePickerSetup = Pick<
  ExercisePreset,
  | "category"
  | "log_type"
  | "target_sets"
  | "target_reps"
  | "target_weight_kg"
  | "rest_sec"
  | "custom_fields"
  | "notes"
>;

export function PlanEditor({
  bundle,
  onChange,
  onSave,
  onDelete,
  onClose,
  saving,
  onSaveExerciseToLibrary,
  exerciseLibrary = [],
  timelineBaseline,
  loggedSessions = [],
  timelineSessionContexts = [],
}: {
  bundle: PlanBundle;
  onChange: (next: PlanBundle) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  saving?: boolean;
  /** Offered only where the saved library is visible (the athlete's settings). */
  onSaveExerciseToLibrary?: (exercise: PlanExercise) => Promise<void> | void;
  /** Saved setups appear first in the exercise picker and seed logging fields. */
  exerciseLibrary?: ExercisePreset[];
  /** Existing saved shape + real logs enable the accidental-date-change guard. */
  timelineBaseline?: PlanBundle;
  loggedSessions?: Session[];
  /** Coach view: each athlete may have independent assignment dates. */
  timelineSessionContexts?: PlanLoggedSession[];
}) {
  const [week, setWeek] = useState(1);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [timelineAcknowledged, setTimelineAcknowledged] = useState(false);

  const cycle = isCyclePlan(bundle.plan);
  const auto = bundle.plan.repeat_mode !== "custom";
  const slots = planSlots(bundle.plan);
  const dateImpacts = timelineBaseline
    ? [
        ...newTimelineImpacts({ before: timelineBaseline, after: bundle, sessions: loggedSessions }),
        ...timelineSessionContexts.flatMap(({ session, start, end }) =>
          newTimelineImpacts({
            before: timelineBaseline,
            after: bundle,
            sessions: [session],
            beforeStart: start,
            afterStart: start,
            beforeEnd: end,
            afterEnd: end,
          }),
        ),
      ]
    : [];

  useEffect(() => {
    setTimelineAcknowledged(false);
  }, [
    bundle.plan.start_date,
    bundle.plan.end_date,
    bundle.plan.schedule_mode,
    bundle.plan.cycle_length,
    bundle.plan.weeks,
    bundle.plan.repeat_mode,
  ]);

  /** One entry per slot of the block on screen — `null` where nothing is set up. */
  const slotDays = useMemo(() => {
    // Both modes block by `week_index`; only the length of a block differs.
    const pool = bundle.days.filter(
      (d) => (cycle ? d.cycle_day !== null : d.cycle_day === null) && d.week_index === week,
    );
    return slots.map((slot) => pool.find((d) => slotIndex(bundle.plan, d) === slot) ?? null);
  }, [bundle.days, bundle.plan, cycle, slots, week]);

  function updatePlan(patch: Partial<PlanBundle["plan"]>) {
    onChange({ ...bundle, plan: { ...bundle.plan, ...patch } });
  }

  function ensureDay(slot: number): PlanDay {
    const existing = slotDays[slot - 1];
    if (existing) return existing;
    const day = makeDay(bundle.plan.id, slot, {
      week_index: week,
      ...slotFields(bundle.plan, slot),
    });
    onChange({ ...bundle, days: [...bundle.days, day] });
    return day;
  }

  /**
   * Switch between a calendar week and a free-length cycle.
   *
   * The days are re-addressed rather than thrown away: slot 1 stays slot 1, so
   * a 7-day week becomes days 1–7 of a cycle with all its exercises intact.
   * Blocks 2+ are dropped and the count reset — the two modes measure a block
   * differently, so carrying them across would silently change their length.
   */
  function setScheduleMode(mode: ScheduleMode) {
    if (mode === bundle.plan.schedule_mode) return;
    const toCycle = mode === "cycle";
    const length = toCycle ? Math.max(2, bundle.plan.cycle_length || 7) : 0;
    const plan = {
      ...bundle.plan,
      schedule_mode: mode,
      cycle_length: length,
      weeks: toCycle ? 1 : bundle.plan.weeks,
    };

    const kept = toCycle ? bundle.days.filter((d) => d.week_index === 1) : bundle.days;
    const days = kept
      .map((day) => {
        const slot = slotIndex(bundle.plan, day);
        if (slot > slotCount(plan)) return null;
        return { ...day, week_index: 1, ...slotFields(plan, slot) };
      })
      .filter((d): d is PlanDay => d !== null);

    const keptIds = new Set(days.map((d) => d.id));
    onChange({
      ...bundle,
      plan,
      days,
      segments: bundle.segments.filter((s) => keptIds.has(s.plan_day_id)),
      exercises: bundle.exercises.filter((e) => keptIds.has(e.plan_day_id)),
    });
    setWeek(1);
  }

  /**
   * Switch between repeating the first block and cycling through several.
   *
   * Going custom seeds a second block from the first, because "varying blocks"
   * with one block is the state the user just left. Going back to auto keeps
   * the extra blocks on the row rather than deleting them — the plan simply
   * stops scheduling them, so flipping back and forth costs no work.
   */
  function setRepeatMode(mode: RepeatMode) {
    if (mode === bundle.plan.repeat_mode) return;
    setWeek(1);
    if (mode === "auto") {
      onChange({ ...bundle, plan: { ...bundle.plan, repeat_mode: "auto" } });
      return;
    }
    updatePlan({ repeat_mode: "custom" });
    if (editableBlockCount(bundle.plan) < 2) setWeeks(2, "custom");
  }

  /** Grow or shrink the cycle, dropping any day that falls off the end. */
  function setCycleLength(count: number) {
    const length = Math.max(2, Math.min(60, count));
    const days = bundle.days.filter((d) => slotIndex(bundle.plan, d) <= length);
    const keptIds = new Set(days.map((d) => d.id));
    onChange({
      ...bundle,
      plan: { ...bundle.plan, cycle_length: length },
      days,
      segments: bundle.segments.filter((s) => keptIds.has(s.plan_day_id)),
      exercises: bundle.exercises.filter((e) => keptIds.has(e.plan_day_id)),
    });
  }

  /**
   * Set how many blocks the plan runs — weeks, or passes through the split.
   *
   * Every missing block is filled in one pass. This used to build one block and
   * return, which the +/− stepper hid because it only ever moves by one; typing
   * "4" straight into the field produced a plan claiming four blocks with two
   * of them empty.
   */
  function setWeeks(count: number, repeatMode: RepeatMode = bundle.plan.repeat_mode) {
    const weeks = Math.max(1, Math.min(52, count));
    const days = bundle.days.filter((d) => d.week_index <= weeks);
    const segments = [...bundle.segments];
    const exercises = [...bundle.exercises];

    // A new block starts as a copy of the first, so it is quick to tweak.
    const base = bundle.days.filter((d) => d.week_index === 1);
    for (let w = 2; w <= weeks; w += 1) {
      if (days.some((d) => d.week_index === w)) continue;

      const dayIds = new Map<string, string>();
      for (const day of base) {
        const id = newId();
        dayIds.set(day.id, id);
        days.push({ ...day, id, week_index: w });
      }

      const segmentIds = new Map<string, string>();
      for (const segment of bundle.segments) {
        const dayId = dayIds.get(segment.plan_day_id);
        if (!dayId) continue;
        const id = newId();
        segmentIds.set(segment.id, id);
        segments.push({ ...segment, id, plan_day_id: dayId });
      }

      for (const exercise of bundle.exercises) {
        const dayId = dayIds.get(exercise.plan_day_id);
        if (!dayId) continue;
        exercises.push({
          ...exercise,
          id: newId(),
          plan_day_id: dayId,
          plan_segment_id: exercise.plan_segment_id
            ? (segmentIds.get(exercise.plan_segment_id) ?? null)
            : null,
        });
      }
    }

    const keptIds = new Set(days.map((d) => d.id));
    onChange({
      ...bundle,
      plan: { ...bundle.plan, weeks, repeat_mode: repeatMode },
      days,
      segments: segments.filter((s) => keptIds.has(s.plan_day_id)),
      exercises: exercises.filter((e) => keptIds.has(e.plan_day_id)),
    });
  }

  const editing = bundle.days.find((d) => d.id === editingDay) ?? null;

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back" onClick={onClose}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-xl font-black text-ink">{bundle.plan.name}</h1>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving || (dateImpacts.length > 0 && !timelineAcknowledged)}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {dateImpacts.length > 0 && (
        <Card className="mb-3" tint="var(--color-gold)">
          <p className="text-sm font-black text-ink">
            This date change affects {dateImpacts.length} recorded session{dateImpacts.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">
            Work logged on {dateImpacts.slice(0, 4).map(({ session }) => session.date).join(", ")}
            {dateImpacts.length > 4 ? ` and ${dateImpacts.length - 4} more` : ""} will stay on
            its original dates. AntRep will not move, overwrite, or delete it.
          </p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => setTimelineAcknowledged(true)}>
            {timelineAcknowledged ? "Safety confirmed" : "Preserve those logs and allow save"}
          </Button>
        </Card>
      )}

      <Card className="mb-3 space-y-3">
        <Field label="Plan name">
          <TextField value={bundle.plan.name} onChange={(e) => updatePlan({ name: e.target.value })} />
        </Field>
        <Field
          label="Repeats on"
          hint={
            cycle
              ? "Day 1 is the start date, and the split repeats from there — weekdays don't come into it"
              : "A calendar week, Monday to Sunday"
          }
        >
          <Segmented
            value={bundle.plan.schedule_mode}
            onChange={setScheduleMode}
            options={[
              { value: "weekly", label: "Week" },
              { value: "cycle", label: "Custom split" },
            ]}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" hint={cycle ? "This day is day 1" : undefined}>
            <TextField
              type="date"
              value={bundle.plan.start_date}
              onChange={(e) => updatePlan({ start_date: e.target.value })}
            />
          </Field>
          {/* Optional: an open-ended plan is still the common case, so this
              stays empty until someone means it. */}
          <Field
            label="Ends"
            hint={
              bundle.plan.end_date
                ? "Moves to past plans after this day"
                : "Optional — runs until you stop it"
            }
          >
            <div className="flex items-center gap-1.5">
              <TextField
                type="date"
                value={bundle.plan.end_date ?? ""}
                min={bundle.plan.start_date}
                onChange={(e) => updatePlan({ end_date: e.target.value || null })}
              />
              {bundle.plan.end_date && (
                <IconButton label="Clear end date" onClick={() => updatePlan({ end_date: null })}>
                  <Icon.close className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </Field>
          {cycle && (
            <Field label="Days per split" hint="Starts over on the next day">
              <NumberField
                value={bundle.plan.cycle_length}
                min={2}
                max={60}
                onChange={(v) => setCycleLength(v ?? 2)}
              />
            </Field>
          )}
        </div>

        {/* How the plan repeats. The block count alone can't say: four weeks
            with only week 1 filled in means "repeat this week", not "three
            blank weeks then back to the first". */}
        <Field
          label="Repeats"
          hint={
            auto
              ? `The same ${cycle ? "split" : "week"} runs again every time`
              : `${blockCount(bundle.plan)} ${cycle ? "splits" : "weeks"} in turn, then back to the first`
          }
        >
          <Segmented
            value={bundle.plan.repeat_mode}
            onChange={setRepeatMode}
            options={[
              { value: "auto", label: cycle ? "Same split" : "Same week" },
              { value: "custom", label: "Varying blocks" },
            ]}
          />
        </Field>

        {!auto && (
          <Field
            label={cycle ? "Splits in the plan" : "Week blocks"}
            hint={
              cycle
                ? `${blockCount(bundle.plan) * (bundle.plan.cycle_length || 0)} days, then back to split 1`
                : "Weeks cycle after the last one"
            }
          >
            <NumberField value={bundle.plan.weeks} min={2} max={52} onChange={(v) => setWeeks(v ?? 2)} />
          </Field>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Active plan</p>
            <p className="text-xs font-semibold text-muted">Drives Home and today's schedule</p>
          </div>
          <Toggle
            label="Active plan"
            checked={bundle.plan.is_active}
            onChange={(v) => updatePlan({ is_active: v })}
          />
        </div>
      </Card>

      {blockCount(bundle.plan) > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: blockCount(bundle.plan) }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                w === week ? "bg-accent text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              {blockLabel(bundle.plan, w)}
            </button>
          ))}
        </div>
      )}

      <SectionHeader title={cycle ? `${bundle.plan.cycle_length}-day split` : "Week schedule"} />
      <DayBoard
        label="Plan days"
        columns={slotDays.map((day, index) => {
          const slot = index + 1;
          const segments = day ? resolveSegments(bundle, day) : [];
          const exercises = segments.flatMap((s) => s.exercises);
          const type = day?.day_type ?? "rest";
          return {
            key: String(slot),
            chip: slotLabel(bundle.plan, slot, true),
            empty: exercises.length === 0,
            content: (
              <DayColumn
                title={day?.title || DAY_TYPE_LABELS[type]}
                subtitle={
                  DAY_TYPE_LABELS[type] +
                  (segments.length > 1 ? ` · ${segments.length} blocks` : "") +
                  (day?.is_optional ? " · optional" : "")
                }
                slotLabel={slotLabel(bundle.plan, slot, true)}
                emoji={typeIcon(type, day?.icon_name)}
                tint={typeColor(type, day?.color_hex)}
                exercises={exercises}
                onOpen={() => setEditingDay(ensureDay(slot).id)}
              />
            ),
          };
        })}
      />

      {onDelete && (
        <Button variant="danger" full className="mt-6" onClick={onDelete}>
          <Icon.trash className="h-4 w-4" /> Delete plan
        </Button>
      )}

      {editing && (
        <DayEditor
          bundle={bundle}
          day={editing}
          onChange={onChange}
          onClose={() => setEditingDay(null)}
          onSaveExerciseToLibrary={onSaveExerciseToLibrary}
          exerciseLibrary={exerciseLibrary}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------

function DayEditor({
  bundle,
  day,
  onChange,
  onClose,
  onSaveExerciseToLibrary,
  exerciseLibrary,
}: {
  bundle: PlanBundle;
  day: PlanDay;
  onChange: (next: PlanBundle) => void;
  onClose: () => void;
  onSaveExerciseToLibrary?: (exercise: PlanExercise) => Promise<void> | void;
  exerciseLibrary: ExercisePreset[];
}) {
  const [picker, setPicker] = useState<{ segmentId: string | null } | null>(null);
  const [pasting, setPasting] = useState<{ segmentId: string | null } | null>(null);
  const [editingExercise, setEditingExercise] = useState<PlanExercise | null>(null);
  const segments = resolveSegments(bundle, day);

  function patchDay(patch: Partial<PlanDay>) {
    onChange({ ...bundle, days: bundle.days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)) });
  }

  function addSegment() {
    const existing = bundle.segments.filter((s) => s.plan_day_id === day.id);
    const next = [...bundle.segments];
    // First split: turn the implicit block into a real one so both are editable.
    if (existing.length === 0) {
      const base = makeSegment(day.id, { title: day.title, day_type: day.day_type, sort_order: 0 });
      next.push(base);
      onChange({
        ...bundle,
        segments: [...next, makeSegment(day.id, { title: "Second block", day_type: "run", sort_order: 1 })],
        exercises: bundle.exercises.map((e) =>
          e.plan_day_id === day.id && !e.plan_segment_id ? { ...e, plan_segment_id: base.id } : e,
        ),
      });
      return;
    }
    onChange({
      ...bundle,
      segments: [
        ...next,
        makeSegment(day.id, { title: "New block", day_type: "run", sort_order: existing.length }),
      ],
    });
  }

  function removeSegment(segmentId: string) {
    onChange({
      ...bundle,
      segments: bundle.segments.filter((s) => s.id !== segmentId),
      exercises: bundle.exercises.filter((e) => e.plan_segment_id !== segmentId),
    });
  }

  function addExercise(name: string, segmentId: string | null, preset?: ExercisePickerSetup) {
    const siblings = bundle.exercises.filter(
      (e) => e.plan_day_id === day.id && e.plan_segment_id === segmentId,
    );
    onChange({
      ...bundle,
      exercises: [
        ...bundle.exercises,
        makeExercise(day.id, name, {
          plan_segment_id: segmentId,
          sort_order: siblings.length,
          ...(preset ? {
            log_type: preset.log_type,
            category: preset.category,
            target_sets: preset.target_sets,
            target_reps: preset.target_reps,
            target_weight_kg: preset.target_weight_kg,
            rest_sec: preset.rest_sec,
            custom_fields: preset.custom_fields,
            trainer_notes: preset.notes,
          } : {}),
        }),
      ],
    });
  }

  function patchExercise(id: string, patch: Partial<PlanExercise>) {
    onChange({
      ...bundle,
      exercises: bundle.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  function removeExercise(id: string) {
    onChange({ ...bundle, exercises: bundle.exercises.filter((e) => e.id !== id) });
  }

  function moveExercise(exercise: PlanExercise, direction: -1 | 1) {
    const siblings = bundle.exercises
      .filter((e) => e.plan_day_id === day.id && e.plan_segment_id === exercise.plan_segment_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((e) => e.id === exercise.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const orders = new Map(reordered.map((e, i) => [e.id, i]));
    onChange({
      ...bundle,
      exercises: bundle.exercises.map((e) => (orders.has(e.id) ? { ...e, sort_order: orders.get(e.id)! } : e)),
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        isCyclePlan(bundle.plan)
          ? slotLabel(bundle.plan, slotIndex(bundle.plan, day))
          : `${slotLabel(bundle.plan, slotIndex(bundle.plan, day))} · week ${day.week_index}`
      }
      wide
    >
      <div className="space-y-3">
        <Field label="Day title">
          <TextField
            value={day.title}
            placeholder="Push day"
            onChange={(e) => patchDay({ title: e.target.value })}
          />
        </Field>

        <Field label="Type">
          <div className="flex flex-wrap gap-1.5">
            {DAY_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => patchDay({ day_type: t as DayType })}
                className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  day.day_type === t ? "text-white" : "border border-line bg-inset text-muted"
                }`}
                style={day.day_type === t ? { background: typeColor(t as DayType) } : undefined}
              >
                {DAY_TYPE_LABELS[t as DayType]}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-inset px-3 py-2">
          <div>
            <p className="text-sm font-bold text-ink">Optional day</p>
            <p className="text-xs font-semibold text-muted">Skipping it won't break the streak</p>
          </div>
          <Toggle label="Optional day" checked={day.is_optional} onChange={(v) => patchDay({ is_optional: v })} />
        </div>

        {segments.map((segment) => (
          <div key={segment.id} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              {segment.segmentId ? (
                <TextField
                  value={bundle.segments.find((s) => s.id === segment.segmentId)?.title ?? ""}
                  placeholder="Block name"
                  className="h-9"
                  onChange={(e) =>
                    onChange({
                      ...bundle,
                      segments: bundle.segments.map((s) =>
                        s.id === segment.segmentId ? { ...s, title: e.target.value } : s,
                      ),
                    })
                  }
                />
              ) : (
                <p className="flex-1 text-sm font-black text-ink">Exercises</p>
              )}
              {segment.segmentId && (
                <IconButton label="Remove block" onClick={() => removeSegment(segment.segmentId!)}>
                  <Icon.trash className="h-4 w-4" />
                </IconButton>
              )}
            </div>

            <div className="space-y-1.5">
              {segment.exercises
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((exercise) => (
                  <div key={exercise.id} className="flex items-center gap-2 rounded-xl bg-inset px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{exercise.name}</p>
                      <p className="truncate text-[11px] font-semibold text-muted">
                        {exercise.rep_scheme || `${exercise.target_sets} × ${exercise.target_reps}`}
                        {exercise.target_weight_kg > 0 && ` · ${exercise.target_weight_kg} kg`}
                        {!exercise.is_mandatory && " · optional"}
                      </p>
                    </div>
                    <button
                      aria-label="Move up"
                      className="text-muted"
                      onClick={() => moveExercise(exercise, -1)}
                    >
                      ↑
                    </button>
                    <button
                      aria-label="Move down"
                      className="text-muted"
                      onClick={() => moveExercise(exercise, 1)}
                    >
                      ↓
                    </button>
                    <IconButton label="Edit exercise" onClick={() => setEditingExercise(exercise)}>
                      <Icon.edit className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Remove exercise" onClick={() => removeExercise(exercise.id)}>
                      <Icon.trash className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPicker({ segmentId: segment.segmentId })}
              >
                <Icon.plus className="h-4 w-4" /> Add exercise
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPasting({ segmentId: segment.segmentId })}
              >
                <Icon.copy className="h-4 w-4" /> Paste from Excel
              </Button>
            </div>
          </div>
        ))}

        <Button size="sm" variant="ghost" onClick={addSegment}>
          <Icon.plus className="h-4 w-4" /> Add another block (e.g. a walk after lifting)
        </Button>
      </div>

      {pasting && (
        <PasteImport
          dayId={day.id}
          segmentId={pasting.segmentId}
          startSortOrder={
            bundle.exercises.filter(
              (e) => e.plan_day_id === day.id && e.plan_segment_id === pasting.segmentId,
            ).length
          }
          onClose={() => setPasting(null)}
          onImport={(exercises) => {
            onChange({ ...bundle, exercises: [...bundle.exercises, ...exercises] });
            setPasting(null);
          }}
        />
      )}

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(null)}
          library={exerciseLibrary}
          onPick={(name, preset) => {
            addExercise(name, picker.segmentId, preset);
            setPicker(null);
          }}
        />
      )}

      {editingExercise && (
        <ExerciseEditor
          exercise={bundle.exercises.find((e) => e.id === editingExercise.id) ?? editingExercise}
          onChange={(patch) => patchExercise(editingExercise.id, patch)}
          onClose={() => setEditingExercise(null)}
          onSaveToLibrary={onSaveExerciseToLibrary}
        />
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------

export function ExercisePicker({
  onPick,
  onClose,
  library = [],
}: {
  onPick: (name: string, preset?: ExercisePickerSetup) => void;
  onClose: () => void;
  /** Your saved exercises come first — they carry their own logging setup. */
  library?: ExercisePreset[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<ExerciseCategoryFilter>("all");
  const canonical = useExerciseLibrary();
  const pageSize = 15;

  const setupForCanonical = (exercise: LibraryExercise): ExercisePickerSetup => ({
    category: exercise.category,
    log_type: exercise.logType,
    target_sets: exercise.sets,
    target_reps: exercise.reps,
    target_weight_kg: 0,
    rest_sec: 90,
    custom_fields: [],
    notes: "",
  });

  const options = useMemo(() => {
    const saved = library.map((entry) => ({
      name: entry.name,
      category: entry.category,
      detail: `${entry.target_sets} × ${entry.target_reps} · in your library`,
      setup: entry as ExercisePickerSetup,
      saved: true,
    }));
    const savedNames = new Set(saved.map((s) => s.name.toLowerCase()));
    const database = canonical.exercises.filter((exercise) => !savedNames.has(exercise.name.toLowerCase())).map((exercise) => ({
      name: exercise.name,
      category: exercise.category as string,
      detail: exercise.wgerCategoryName || "exercise database",
      saved: false,
      setup: setupForCanonical(exercise),
    }));
    return [...saved, ...database];
  }, [canonical.exercises, library]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((entry) =>
      (category === "all" || entry.category === category) &&
      (!q || entry.name.toLowerCase().includes(q)),
    );
  }, [category, options, query]);
  const categoryCounts = useMemo(() => ({
    all: options.length,
    push: options.filter((entry) => entry.category === "push").length,
    pull: options.filter((entry) => entry.category === "pull").length,
    legs: options.filter((entry) => entry.category === "legs").length,
    core: options.filter((entry) => entry.category === "core").length,
    cardio: options.filter((entry) => entry.category === "cardio").length,
  }), [options]);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const shown = matches.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Sheet open onClose={onClose} title="Add exercise">
      <TextField
        autoFocus
        placeholder="Search or type a new name"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
      />
      <ExerciseCategoryTabs
        value={category}
        counts={categoryCounts}
        onChange={(next) => { setCategory(next); setPage(1); }}
      />
      {query.trim() && !canonical.loading && !matches.some((m) => m.name.toLowerCase() === query.trim().toLowerCase()) && (
        <Button full className="mt-2" onClick={() => onPick(query.trim())}>
          <Icon.plus className="h-4 w-4" /> Create “{query.trim()}”
        </Button>
      )}
      <div className="mt-3 max-h-[50dvh] space-y-1.5 overflow-y-auto">
        {shown.map((entry) => (
          <button
            key={`${entry.saved ? "saved" : "database"}:${entry.name}`}
            onClick={() => onPick(entry.name, entry.setup)}
            className="flex w-full items-center gap-2 rounded-xl bg-inset px-3 py-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{entry.name}</p>
              <p className="truncate text-[11px] font-semibold text-muted">
                {entry.category} · {entry.detail}
              </p>
            </div>
            {entry.saved && <Pill tint="var(--t-accent)">Saved</Pill>}
            {!entry.saved && <Pill>Database</Pill>}
            <Icon.plus className="h-4 w-4 text-muted" />
          </button>
        ))}
        {canonical.loading && (
          <p className="py-3 text-center text-xs font-bold text-muted">Loading exercise database…</p>
        )}
        {!canonical.loading && shown.length === 0 && (
          <p className="py-5 text-center text-sm font-bold text-muted">No exercises found.</p>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <Icon.back className="h-4 w-4" /> Previous
          </Button>
          <span className="text-xs font-black text-muted">{page} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next <Icon.chevron className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------

export function ExerciseEditor({
  exercise,
  onChange,
  onClose,
  onSaveToLibrary,
}: {
  exercise: PlanExercise;
  onChange: (patch: Partial<PlanExercise>) => void;
  onClose: () => void;
  /** Store this logging shape under the exercise name so it's reused everywhere. */
  onSaveToLibrary?: (exercise: PlanExercise) => Promise<void> | void;
}) {
  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      <div className="space-y-3">
        <Field label="Name">
          <TextField value={exercise.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>

        <LogTypePicker value={exercise.log_type} onChange={(v) => onChange({ log_type: v })} />

        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets">
            <NumberField value={exercise.target_sets} min={1} max={20} onChange={(v) => onChange({ target_sets: v ?? 1 })} />
          </Field>
          <Field label="Reps">
            <NumberField value={exercise.target_reps} min={0} max={100} onChange={(v) => onChange({ target_reps: v ?? 0 })} />
          </Field>
          <Field label="Weight">
            <NumberField
              value={exercise.target_weight_kg}
              step={2.5}
              max={500}
              suffix="kg"
              onChange={(v) => onChange({ target_weight_kg: v ?? 0 })}
            />
          </Field>
        </div>

        <Field label="Scheme shown to the athlete" hint="Free text, e.g. 3 x 10-12">
          <TextField
            value={exercise.rep_scheme}
            placeholder={`${exercise.target_sets} x ${exercise.target_reps}`}
            onChange={(e) => onChange({ rep_scheme: e.target.value })}
          />
        </Field>

        <Field label="Rest">
          <NumberField value={exercise.rest_sec} step={15} max={600} suffix="sec" onChange={(v) => onChange({ rest_sec: v ?? 0 })} />
        </Field>

        <Field label="Target effort" hint="Marked on the athlete's slider as they log each set">
          <RpeSlider
            value={exercise.rpe_target || null}
            onChange={(v) => onChange({ rpe_target: v ?? 0 })}
            meaning={rpeMeaning(exercise.rpe_target)}
            color={rpeColor(exercise.rpe_target)}
          />
        </Field>

        <SetTargetsEditor exercise={exercise} onChange={onChange} />

        <Field label="Notes for the athlete">
          <TextField
            value={exercise.trainer_notes}
            placeholder="Cue, tempo, or setup"
            onChange={(e) => onChange({ trainer_notes: e.target.value })}
          />
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-inset px-3 py-2">
          <div>
            <p className="text-sm font-bold text-ink">Required</p>
            <p className="text-xs font-semibold text-muted">Counts toward session completion</p>
          </div>
          <Toggle
            label="Required"
            checked={exercise.is_mandatory}
            onChange={(v) => onChange({ is_mandatory: v })}
          />
        </div>

        <Field label="Alternate group" hint="Same code on two exercises = pick one (A/B options)">
          <div className="flex gap-2">
            <TextField
              value={exercise.alternate_group_id}
              placeholder="e.g. row"
              onChange={(e) => onChange({ alternate_group_id: e.target.value })}
            />
            <TextField
              value={exercise.alternate_label}
              placeholder="A"
              className="w-20"
              onChange={(e) => onChange({ alternate_label: e.target.value })}
            />
          </div>
        </Field>

        <CustomFieldsEditor
          fields={exercise.custom_fields}
          onChange={(custom_fields) => onChange({ custom_fields })}
        />

        <div className="flex flex-wrap gap-1.5">
          {(["weekly", "biweekly", "monthly", "once"] as const).map((rule) => (
            <button
              key={rule}
              onClick={() => onChange({ repeat_rule: rule })}
              className={`rounded-full px-3 py-1.5 text-xs font-black ${
                exercise.repeat_rule === rule ? "bg-accent text-white" : "border border-line bg-inset text-muted"
              }`}
            >
              {rule}
            </button>
          ))}
        </div>
      </div>

      {onSaveToLibrary && (
        <Button
          full
          variant="secondary"
          className="mt-4"
          onClick={() => onSaveToLibrary(exercise)}
        >
          <Icon.copy className="h-4 w-4" /> Save this setup to my library
        </Button>
      )}

      <Button full className="mt-2" onClick={onClose}>
        Done
      </Button>
    </Sheet>
  );
}

/**
 * One day of the board: the header opens the day editor, and the exercises are
 * listed underneath so the column shows what's actually in the day rather than
 * just how many things are.
 */
function DayColumn({
  title,
  subtitle,
  slotLabel: slot,
  emoji,
  tint,
  exercises,
  onOpen,
}: {
  title: string;
  subtitle: string;
  slotLabel: string;
  emoji: string;
  tint: string;
  exercises: PlanExercise[];
  onOpen: () => void;
}) {
  const sorted = [...exercises].sort((a, b) => a.sort_order - b.sort_order);
  // Columns sit side by side, so one long day must not stretch the whole board.
  const shown = sorted.slice(0, 7);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <button onClick={onOpen} className="flex items-center gap-2 p-2.5 text-left">
        <IconTile emoji={emoji} tint={tint} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-black text-ink">{title}</p>
          <p className="truncate text-[10px] font-bold text-muted">{subtitle}</p>
        </div>
        <span className="shrink-0 text-[10px] font-black uppercase text-muted">{slot}</span>
      </button>

      <div className="flex-1 space-y-1 px-2.5">
        {shown.map((exercise) => (
          <div key={exercise.id} className="rounded-lg bg-inset px-2 py-1.5">
            <p className="truncate text-[11px] font-bold text-ink">{exercise.name}</p>
            <p className="truncate text-[10px] font-semibold text-muted">
              {prescriptionLabel(exercise)}
            </p>
          </div>
        ))}
        {sorted.length > shown.length && (
          <p className="px-1 text-[10px] font-black text-muted">
            +{sorted.length - shown.length} more
          </p>
        )}
        {sorted.length === 0 && (
          <p className="rounded-lg bg-inset px-2 py-3 text-center text-[10px] font-bold text-muted">
            Nothing scheduled
          </p>
        )}
      </div>

      <button
        onClick={onOpen}
        className="m-2.5 mt-2 rounded-lg border border-dashed border-line py-1.5 text-[11px] font-black text-muted active:text-ink"
      >
        <Icon.plus className="mr-1 inline h-3 w-3" />
        {sorted.length === 0 ? "Set up day" : "Edit day"}
      </button>
    </div>
  );
}

/**
 * Per-set targets — "12 @ 40, 10 @ 45, 8 @ 50" instead of a flat 3 × 10.
 *
 * Off by default: most exercises are the same every set, and the flat targets
 * above say so more clearly. Switching on seeds the rows from those targets, so
 * turning it on and editing one number is the common case.
 */
function SetTargetsEditor({
  exercise,
  onChange,
}: {
  exercise: PlanExercise;
  onChange: (patch: Partial<PlanExercise>) => void;
}) {
  const details = setDetails(exercise);
  const on = details.length > 0;

  function toggle(next: boolean) {
    onChange({
      set_details: next
        ? Array.from({ length: Math.max(1, exercise.target_sets) }, () => ({
            reps: exercise.target_reps,
            weight_kg: exercise.target_weight_kg,
          }))
        : [],
    });
  }

  function patchSet(index: number, patch: Partial<SetDetail>) {
    onChange({ set_details: details.map((d, i) => (i === index ? { ...d, ...patch } : d)) });
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Different targets per set</p>
          <p className="text-xs font-semibold text-muted">
            For pyramids and ramp-ups — the athlete's logger opens with these
          </p>
        </div>
        <Toggle label="Different targets per set" checked={on} onChange={toggle} />
      </div>

      {on && (
        <div className="mt-3 space-y-1.5">
          {details.map((detail, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[11px] font-black uppercase text-muted">
                Set {index + 1}
              </span>
              <NumberField
                value={detail.reps}
                step={1}
                max={100}
                suffix="reps"
                onChange={(v) => patchSet(index, { reps: v ?? 0 })}
              />
              <NumberField
                value={detail.weight_kg}
                step={2.5}
                max={500}
                suffix="kg"
                onChange={(v) => patchSet(index, { weight_kg: v ?? 0 })}
              />
              <button
                aria-label={`Remove set ${index + 1}`}
                className="shrink-0 text-muted active:text-danger"
                onClick={() => onChange({ set_details: details.filter((_, i) => i !== index) })}
              >
                <Icon.trash className="h-4 w-4" />
              </button>
            </div>
          ))}

          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onChange({
                set_details: [...details, details.at(-1) ?? { reps: exercise.target_reps, weight_kg: 0 }],
              })
            }
          >
            <Icon.plus className="h-4 w-4" /> Add set
          </Button>
        </div>
      )}
    </div>
  );
}

export function PlanSummaryPill({ bundle }: { bundle: PlanBundle }) {
  const exercises = bundle.exercises.length;
  // The first block only — later blocks are variations on it, and counting
  // them all would report a 4-split plan as having four times the days.
  const firstPass = bundle.days.filter(
    (d) => (isCyclePlan(bundle.plan) ? d.cycle_day !== null : d.cycle_day === null) && d.week_index === 1,
  );
  const trainingDays = new Set(
    firstPass.filter((d) => d.day_type !== "rest").map((d) => slotIndex(bundle.plan, d)),
  ).size;
  return (
    <Pill tint="var(--t-muted)">
      {trainingDays} days · {exercises} exercises
    </Pill>
  );
}
