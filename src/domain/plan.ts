/**
 * Plan resolution — the port of the iOS `PlanService`.
 *
 * A plan owns days; a day owns ordered segments ("Strength", then "Walk"); a
 * segment owns exercises. Days without explicit segments resolve to one
 * synthetic segment so every screen can treat a day as a list of segments.
 *
 * A day is addressed one of two ways, depending on `plan.schedule_mode`:
 *
 *   weekly  program week (`week_index`) + weekday, Monday-aligned and cycling
 *           every `plan.weeks` weeks.
 *   cycle   a position in a `cycle_length`-day split (`cycle_day`), counted
 *           from the plan's start date — day 1 IS the start date.
 *
 * Screens should not read `weekday` or `cycle_day` directly: `slotIndex`,
 * `slotLabel` and `planSlots` give the same answers in either mode.
 */

import {
  DAY_TYPE_COLORS,
  DAY_TYPE_ICONS,
  DAY_TYPE_LABELS,
  isGymType,
  type DayType,
  type Plan,
  type PlanBundle,
  type PlanDay,
  type PlanExercise,
  type PlanSegment,
} from "../data/types";
import {
  addDays,
  daysBetween,
  isoWeekday,
  localDate,
  parseDate,
  startOfWeek,
  weekdayLabel,
} from "./dates";

export interface ResolvedSegment {
  /** Stable id: the segment row id, or `day:<dayId>` for a legacy single-block day. */
  id: string;
  segmentId: string | null;
  dayId: string;
  /** The plan behind it, so a screen holding a loose segment can still label its slot. */
  plan: Plan;
  /** The day's 1-based position in the plan — its weekday, or its cycle day. */
  slot: number;
  title: string;
  dayType: DayType;
  customTypeLabel: string;
  runModality: string;
  countsAsGym: boolean;
  color: string;
  icon: string;
  exercises: PlanExercise[];
  day: PlanDay;
}

export function typeLabel(dayType: DayType, custom = ""): string {
  const trimmed = custom.trim();
  if (dayType === "custom") return trimmed || DAY_TYPE_LABELS.custom;
  return trimmed || DAY_TYPE_LABELS[dayType];
}

export function typeColor(dayType: DayType, colorHex = ""): string {
  return colorHex.trim() || DAY_TYPE_COLORS[dayType] || DAY_TYPE_COLORS.fullbody;
}

export function typeIcon(dayType: DayType, iconName = ""): string {
  return iconName.trim() || DAY_TYPE_ICONS[dayType] || DAY_TYPE_ICONS.fullbody;
}

// ------------------------------------------------------------------
// Slots — the shape of a plan, whichever schedule it runs on
// ------------------------------------------------------------------

export function isCyclePlan(plan: Pick<Plan, "schedule_mode" | "cycle_length">): boolean {
  return plan.schedule_mode === "cycle" && plan.cycle_length > 0;
}

/** Overall inclusive run length stored on the date-free template. */
export function planDurationDays(
  plan: Pick<Plan, "duration_days" | "weeks" | "schedule_mode" | "cycle_length">,
): number {
  if (plan.duration_days > 0) return Math.max(1, plan.duration_days);
  return isCyclePlan(plan)
    ? Math.max(1, plan.weeks || 1) * Math.max(2, plan.cycle_length || 7)
    : Math.max(1, plan.weeks || 1) * 7;
}

/** Normalized active-day count for each custom split. */
export function planSplitLengths(
  plan: Pick<Plan, "split_lengths" | "weeks" | "cycle_length" | "repeat_mode">,
): number[] {
  const legacyLength = Math.max(2, plan.cycle_length || 7);
  const requested = plan.repeat_mode === "custom" ? Math.max(1, plan.weeks || 1) : 1;
  const source = Array.isArray(plan.split_lengths) && plan.split_lengths.length > 0
    ? plan.split_lengths
    : [legacyLength];
  return Array.from({ length: requested }, (_, index) =>
    Math.max(1, Math.min(60, Number(source[index] ?? source[0] ?? legacyLength) || legacyLength)),
  );
}

/** Normalized rest interval after each split. */
export function planSplitRests(
  plan: Pick<Plan, "split_rest_days" | "split_lengths" | "weeks" | "cycle_length" | "repeat_mode">,
): number[] {
  const lengths = planSplitLengths(plan);
  const source = Array.isArray(plan.split_rest_days) ? plan.split_rest_days : [];
  return lengths.map((_, index) =>
    Math.max(0, Math.min(30, Number(source[index] ?? source[0] ?? 0) || 0)),
  );
}

/** How many day slots one pass through the plan has: 7 for a week, else the cycle. */
export function slotCount(
  plan: Pick<Plan, "schedule_mode" | "cycle_length" | "split_lengths" | "weeks" | "repeat_mode">,
  blockIndex = 1,
): number {
  return isCyclePlan(plan) ? (planSplitLengths(plan)[Math.max(1, blockIndex) - 1] ?? 1) : 7;
}

/** Every slot position of one pass, in order: 1…7 or 1…cycle_length. */
export function planSlots(
  plan: Pick<Plan, "schedule_mode" | "cycle_length" | "split_lengths" | "weeks" | "repeat_mode">,
  blockIndex = 1,
): number[] {
  return Array.from({ length: slotCount(plan, blockIndex) }, (_, i) => i + 1);
}

/**
 * A day's position in its plan, 1-based.
 *
 * Reading `weekday` or `cycle_day` straight off the row only works in one
 * mode; this works in both, so it is what screens should sort and match on.
 */
export function slotIndex(
  plan: Pick<Plan, "schedule_mode" | "cycle_length">,
  day: Pick<PlanDay, "weekday" | "cycle_day">,
): number {
  return (isCyclePlan(plan) ? day.cycle_day : day.weekday) ?? 1;
}

/** "Monday" / "Mon" for a weekly plan, "Day 9" / "D9" for a cycle. */
export function slotLabel(
  plan: Pick<Plan, "schedule_mode" | "cycle_length">,
  slot: number,
  short = false,
): string {
  if (!isCyclePlan(plan)) return weekdayLabel(slot, short);
  return short ? `D${slot}` : `Day ${slot}`;
}

/** The patch that puts a new day in `slot` — the right column for the mode. */
export function slotFields(
  plan: Pick<Plan, "schedule_mode" | "cycle_length">,
  slot: number,
): Pick<PlanDay, "weekday" | "cycle_day"> {
  return isCyclePlan(plan) ? { weekday: null, cycle_day: slot } : { weekday: slot, cycle_day: null };
}

// ------------------------------------------------------------------
// Resolution — which slot a calendar date lands on
// ------------------------------------------------------------------

/** Which program week of the plan applies on `date` (1-based, cycles). */
export function planWeekIndex(
  plan: Pick<Plan, "start_date" | "weeks" | "repeat_mode">,
  date: Date,
  startOverride?: string | null,
): number {
  const startStr = startOverride ?? plan.start_date;
  if (!startStr) return 1;
  const start = startOfWeek(parseDate(startStr));
  const target = startOfWeek(date);
  const diffWeeks = Math.round((target.getTime() - start.getTime()) / (7 * 86400000));
  if (diffWeeks < 0) return 1;
  return (diffWeeks % blockCount(plan)) + 1;
}

/**
 * The cycle position `date` falls on, 1-based, or null before the plan began.
 *
 * Unlike the weekly path this is not Monday-aligned: a cycle counts whole days
 * from its start date, so day 1 is the start date itself.
 */
export function planCycleDay(
  plan: Pick<Plan, "start_date" | "schedule_mode" | "cycle_length" | "split_lengths" | "split_rest_days" | "weeks" | "repeat_mode" | "duration_days">,
  date: Date,
  startOverride?: string | null,
): number | null {
  const startStr = startOverride ?? plan.start_date;
  if (!startStr) return null;
  const offset = daysBetween(startStr, localDate(date));
  if (offset < 0 || offset >= planDurationDays(plan)) return null;
  return splitPosition(plan, offset)?.slot ?? null;
}

/** Split and active slot at an elapsed offset; null means an interval rest day. */
export function splitPosition(
  plan: Pick<Plan, "split_lengths" | "split_rest_days" | "weeks" | "cycle_length" | "repeat_mode">,
  elapsedDays: number,
): { block: number; slot: number } | null {
  const lengths = planSplitLengths(plan);
  const rests = planSplitRests(plan);
  const patternDays = lengths.reduce((total, length, index) => total + length + rests[index], 0);
  if (patternDays <= 0) return null;
  let cursor = ((elapsedDays % patternDays) + patternDays) % patternDays;
  for (let index = 0; index < lengths.length; index += 1) {
    if (cursor < lengths[index]) return { block: index + 1, slot: cursor + 1 };
    cursor -= lengths[index];
    if (cursor < rests[index]) return null;
    cursor -= rests[index];
  }
  return null;
}

/**
 * The date the `occurrence`-th repeat of a slot falls on (1-based both ways).
 *
 * The inverse of `planCycleDay` / `planWeekIndex`, and what lets a spreadsheet
 * say "3rd pull day" instead of a date: a split repeats on a fixed period, so
 * the nth repeat of slot s is start + (s-1) + (n-1) × period.
 *
 * Returns null if the plan has no start date to count from.
 */
export function occurrenceDate(
  plan: Pick<Plan, "start_date" | "schedule_mode" | "cycle_length" | "split_lengths" | "split_rest_days" | "weeks" | "repeat_mode" | "duration_days">,
  slot: number,
  occurrence: number,
  startOverride?: string | null,
): string | null {
  const startStr = startOverride ?? plan.start_date;
  if (!startStr) return null;
  const start = parseDate(startStr);
  const nth = Math.max(1, occurrence) - 1;

  if (isCyclePlan(plan)) {
    // Variable splits and interval rests make the period non-uniform. Walk the
    // bounded template timeline so rest days are never returned as training.
    let seen = 0;
    for (let offset = 0; offset < planDurationDays(plan); offset += 1) {
      if (splitPosition(plan, offset)?.slot !== slot) continue;
      if (seen === nth) return localDate(addDays(start, offset));
      seen += 1;
    }
    return null;
  }

  // Weekly: the slot is an ISO weekday, so find its first occurrence on or
  // after the start date and step a week at a time from there.
  const offset = (slot - isoWeekday(start) + 7) % 7;
  return localDate(addDays(start, offset + nth * 7));
}

// ------------------------------------------------------------------
// Blocks — how many passes the plan runs before repeating itself
// ------------------------------------------------------------------
//
// `plan.weeks` counts the blocks in BOTH modes. A weekly plan's block is one
// calendar week; a cycle's block is one pass through `cycle_length` days. The
// column keeps its name for compatibility, but every screen should go through
// `blockCount` / `blockLabel` so a 4 × 9-day plan reads as "Split 3", not
// "Week 3".

/**
 * How many blocks actually get scheduled.
 *
 * An 'auto' plan repeats its first block forever however many the editor holds,
 * so it schedules exactly one. Everything downstream — the modulo that picks
 * today's block, the chips, the day board — follows from this.
 */
export function blockCount(plan: Pick<Plan, "weeks" | "repeat_mode">): number {
  if (plan.repeat_mode !== "custom") return 1;
  return Math.max(1, plan.weeks || 1);
}

/** Blocks the editor holds, which an 'auto' plan may have more of than it runs. */
export function editableBlockCount(plan: Pick<Plan, "weeks">): number {
  return Math.max(1, plan.weeks || 1);
}

/** The dates one athlete's run of a shared plan uses, when it differs. */
export interface PlanRun {
  start_date: string | null;
  end_date: string | null;
}

/**
 * The last day this plan schedules for one athlete.
 *
 * An assignment's own end date wins, so a coach can wind one athlete's run down
 * without touching anyone else following the same plan.
 *
 * A run that BEGINS after the plan's end date ignores that end date entirely.
 * That is what a restart is: the coach moved this athlete's start to today, and
 * the plan-level end belongs to the earlier timeline. Inheriting it would end
 * the new run before its first session.
 */
export function planEnd(
  plan: Pick<Plan, "end_date" | "start_date" | "duration_days" | "weeks" | "schedule_mode" | "cycle_length">,
  run?: PlanRun | null,
): string | null {
  if (run?.end_date) return run.end_date;
  const start = run?.start_date ?? plan.start_date;
  if (start) return localDate(addDays(parseDate(start), planDurationDays(plan) - 1));
  if (plan.end_date && run?.start_date && run.start_date > plan.end_date) return null;
  return plan.end_date ?? null;
}

/** Has this plan run past its end date? Never true for an open-ended plan. */
export function planHasEnded(
  plan: Pick<Plan, "end_date" | "start_date" | "duration_days" | "weeks" | "schedule_mode" | "cycle_length">,
  today: Date | string = new Date(),
  run?: PlanRun | null,
): boolean {
  const end = planEnd(plan, run);
  if (!end) return false;
  const day = typeof today === "string" ? today : localDate(today);
  return day > end;
}

/**
 * Should this plan drive today's schedule?
 *
 * Being active is a setting; having ended is a fact about the calendar. Both
 * have to hold, and keeping them separate is what lets a finished plan stay
 * readable in past plans instead of being switched off and forgotten.
 */
export function planIsLive(
  plan: Pick<Plan, "end_date" | "start_date" | "duration_days" | "weeks" | "schedule_mode" | "cycle_length" | "is_active" | "is_archived">,
  today: Date | string = new Date(),
  run?: PlanRun | null,
): boolean {
  // `is_active` is only the activation switch for athlete-owned plans. A
  // coach template is activated by its assignment run, not globally.
  if ((!run && !plan.is_active) || plan.is_archived) return false;
  const day = typeof today === "string" ? today : localDate(today);
  const start = run?.start_date ?? plan.start_date;
  if (!start || day < start) return false;
  return !planHasEnded(plan, today, run);
}

/** "Week 3" for a calendar plan, "Split 3" for a custom cycle. */
export function blockLabel(
  plan: Pick<Plan, "schedule_mode" | "cycle_length">,
  index: number,
  short = false,
): string {
  const noun = isCyclePlan(plan) ? "Split" : "Week";
  return short ? `${noun.charAt(0)}${index}` : `${noun} ${index}`;
}

/**
 * Which block of the plan `date` falls in, 1-based, cycling.
 *
 * The unified form of `planWeekIndex`: a cycle's blocks are `cycle_length` days
 * long rather than 7 and are counted from the start date rather than from a
 * Monday, but the modulo is the same idea.
 */
export function planBlockIndex(
  plan: Pick<Plan, "start_date" | "weeks" | "repeat_mode" | "schedule_mode" | "cycle_length" | "split_lengths" | "split_rest_days" | "duration_days">,
  date: Date,
  startOverride?: string | null,
): number {
  if (!isCyclePlan(plan)) return planWeekIndex(plan, date, startOverride);

  const startStr = startOverride ?? plan.start_date;
  if (!startStr) return 1;
  const offset = daysBetween(startStr, localDate(date));
  if (offset < 0) return 1;
  return splitPosition(plan, offset)?.block ?? 1;
}

/** The plan's days that are in play on `date`, in slot order. */
export function daysForDate(bundle: PlanBundle, date: Date, startOverride?: string | null): PlanDay[] {
  const { plan } = bundle;
  const bySlot = (a: PlanDay, b: PlanDay) => slotIndex(plan, a) - slotIndex(plan, b);
  const block = planBlockIndex(plan, date, startOverride);

  const pool = bundle.days.filter((d) =>
    isCyclePlan(plan) ? d.cycle_day !== null : d.cycle_day === null,
  );
  // A plan whose later blocks were never filled in falls back to the first, so
  // "4 splits" doesn't leave three of them blank until they're edited.
  const inBlock = pool.filter((d) => d.week_index === block);
  const source = inBlock.length > 0 ? inBlock : pool.filter((d) => d.week_index === 1);
  return [...source].sort(bySlot);
}

export function dayForDate(
  bundle: PlanBundle,
  date: Date,
  startOverride?: string | null,
): PlanDay | null {
  const { plan } = bundle;
  const slot = isCyclePlan(plan)
    ? planCycleDay(plan, date, startOverride)
    : isoWeekday(date);
  if (slot === null) return null;
  return daysForDate(bundle, date, startOverride).find((d) => slotIndex(plan, d) === slot) ?? null;
}

/**
 * How many days back the last scheduled occurrence of `day` was, relative to
 * `from` — 0 when it is today's day. Null if the plan hadn't started yet.
 *
 * Weekly plans wrap within the week; a cycle wraps on its own length, which is
 * why "last Tuesday" reasoning cannot be used for one.
 */
export function daysSinceSlot(
  plan: Pick<Plan, "start_date" | "schedule_mode" | "cycle_length" | "split_lengths" | "split_rest_days" | "duration_days" | "weeks" | "repeat_mode">,
  day: Pick<PlanDay, "weekday" | "cycle_day" | "week_index">,
  from: Date,
  startOverride?: string | null,
): number | null {
  const target = slotIndex(plan, day);
  if (isCyclePlan(plan)) {
    const start = startOverride ?? plan.start_date;
    if (!start) return null;
    const elapsed = daysBetween(start, localDate(from));
    if (elapsed < 0) return null;
    const patternLimit = planSplitLengths(plan).reduce(
      (total, length, index) => total + length + planSplitRests(plan)[index],
      0,
    );
    for (let back = 0; back <= Math.min(elapsed, Math.max(1, patternLimit)); back += 1) {
      const position = splitPosition(plan, elapsed - back);
      if (position?.block === day.week_index && position.slot === target) return back;
    }
    return null;
  }
  return (isoWeekday(from) - target + 7) % 7;
}

/** Ordered segments of a day — always at least one. */
export function resolveSegments(bundle: PlanBundle, day: PlanDay): ResolvedSegment[] {
  const segments = bundle.segments
    .filter((s) => s.plan_day_id === day.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const dayExercises = bundle.exercises
    .filter((e) => e.plan_day_id === day.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const slot = slotIndex(bundle.plan, day);

  if (segments.length === 0) {
    return [
      {
        id: `day:${day.id}`,
        segmentId: null,
        dayId: day.id,
        plan: bundle.plan,
        slot,
        title: day.title || typeLabel(day.day_type, day.custom_type_label),
        dayType: day.day_type,
        customTypeLabel: day.custom_type_label,
        runModality: day.run_modality,
        countsAsGym: day.counts_as_gym ?? isGymType(day.day_type),
        color: typeColor(day.day_type, day.color_hex),
        icon: typeIcon(day.day_type, day.icon_name),
        exercises: dayExercises.filter((e) => !e.plan_segment_id),
        day,
      },
    ];
  }

  return segments.map((s: PlanSegment) => ({
    id: s.id,
    segmentId: s.id,
    dayId: day.id,
    plan: bundle.plan,
    slot,
    title: s.title || typeLabel(s.day_type, s.custom_type_label),
    dayType: s.day_type,
    customTypeLabel: s.custom_type_label,
    runModality: s.run_modality,
    countsAsGym: s.counts_as_gym ?? isGymType(s.day_type),
    color: typeColor(s.day_type, s.color_hex),
    icon: typeIcon(s.day_type, s.icon_name),
    exercises: dayExercises.filter((e) => e.plan_segment_id === s.id),
    day,
  }));
}

export function primarySegment(bundle: PlanBundle, day: PlanDay): ResolvedSegment {
  return resolveSegments(bundle, day)[0];
}

/** Every exercise of a day, across all its segments. */
export function dayExercises(bundle: PlanBundle, day: PlanDay): PlanExercise[] {
  return resolveSegments(bundle, day).flatMap((s) => s.exercises);
}

/** Whether a repeat rule makes the exercise visible on `date` (iOS ExerciseScheduling). */
export function isVisibleOn(exercise: PlanExercise, date: Date): boolean {
  switch (exercise.repeat_rule) {
    case "weekly":
      return true;
    case "once":
      return Boolean(exercise.scheduled_date) && exercise.scheduled_date === localDate(date);
    case "biweekly": {
      if (!exercise.scheduled_date) return true;
      const anchor = startOfWeek(parseDate(exercise.scheduled_date));
      const week = startOfWeek(date);
      const weeks = Math.round((week.getTime() - anchor.getTime()) / (7 * 86400000));
      return weeks % 2 === 0;
    }
    case "monthly": {
      if (!exercise.scheduled_date) return true;
      const anchor = parseDate(exercise.scheduled_date);
      const sameWeekOfMonth =
        Math.floor((anchor.getDate() - 1) / 7) === Math.floor((date.getDate() - 1) / 7);
      return sameWeekOfMonth && isoWeekday(anchor) === isoWeekday(date);
    }
    default:
      return true;
  }
}

export function visibleExercises(segment: ResolvedSegment, date: Date): PlanExercise[] {
  return segment.exercises.filter((e) => isVisibleOn(e, date));
}

/**
 * Group exercises into logging slots: A/B/C alternates of the same movement
 * count as ONE slot (you do one of them), everything else is its own slot.
 */
export function loggingSlots(exercises: PlanExercise[]): PlanExercise[][] {
  const slots: PlanExercise[][] = [];
  const byGroup = new Map<string, PlanExercise[]>();
  for (const ex of exercises) {
    const group = ex.alternate_group_id.trim();
    if (!group) {
      slots.push([ex]);
      continue;
    }
    const existing = byGroup.get(group);
    if (existing) {
      existing.push(ex);
    } else {
      const slot = [ex];
      byGroup.set(group, slot);
      slots.push(slot);
    }
  }
  return slots;
}

export function slotPrimary(slot: PlanExercise[]): PlanExercise {
  return slot[0];
}

/** A day worth training (the picker and Home both skip empty rest days). */
export function hasTrainableContent(bundle: PlanBundle, day: PlanDay): boolean {
  if (day.day_type === "run" || day.day_type === "sport") return true;
  return dayExercises(bundle, day).length > 0;
}

/** Empty skeleton for one pass of a plan: a rest day in every slot. */
export function emptyDays(plan: Plan, weekIndex: number, newId: () => string): PlanDay[] {
  return planSlots(plan, weekIndex).map((slot) => ({
    id: newId(),
    plan_id: plan.id,
    week_index: weekIndex,
    ...slotFields(plan, slot),
    title: "Rest",
    day_type: "rest" as DayType,
    custom_type_label: "",
    icon_name: "",
    color_hex: "",
    is_optional: false,
    counts_as_gym: null,
    run_modality: "walk" as const,
    sort_order: slot - 1,
  }));
}

/**
 * Was a rest (or optional) day scheduled on `date` by any of these plans?
 *
 * The streak uses this to bridge a planned day off. It has to be asked per
 * date rather than per weekday: a cycle's rest days land on a different
 * weekday every time round.
 */
export function restDayPredicate(
  plans: { bundle: PlanBundle; start?: string | null }[],
): (date: Date) => boolean {
  if (plans.length === 0) return () => false;
  return (date: Date) => {
    const scheduled = plans
      .map(({ bundle, start }) => dayForDate(bundle, date, start))
      .filter((day): day is PlanDay => Boolean(day));
    // If another active plan requires work on the same date, that required day
    // wins over an optional/rest day in a companion plan.
    return scheduled.length > 0 && scheduled.every((day) => day.day_type === "rest" || day.is_optional);
  };
}
