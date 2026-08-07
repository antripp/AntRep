/**
 * Plan resolution — the port of the iOS `PlanService`.
 *
 * A plan owns days (per program week + weekday); a day owns ordered segments
 * ("Strength", then "Walk"); a segment owns exercises. Days without explicit
 * segments resolve to one synthetic segment so every screen can treat a day as
 * a list of segments.
 */

import {
  DAY_TYPE_COLORS,
  DAY_TYPE_ICONS,
  DAY_TYPE_LABELS,
  isGymType,
  type DayType,
  type PlanBundle,
  type PlanDay,
  type PlanExercise,
  type PlanSegment,
} from "../data/types";
import { isoWeekday, localDate, parseDate, startOfWeek } from "./dates";

export interface ResolvedSegment {
  /** Stable id: the segment row id, or `day:<dayId>` for a legacy single-block day. */
  id: string;
  segmentId: string | null;
  dayId: string;
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

/** Which program week of the plan applies on `date` (1-based, cycles). */
export function planWeekIndex(
  plan: { start_date: string; weeks: number },
  date: Date,
  startOverride?: string | null,
): number {
  const startStr = startOverride ?? plan.start_date;
  if (!startStr) return 1;
  const start = startOfWeek(parseDate(startStr));
  const target = startOfWeek(date);
  const diffWeeks = Math.round((target.getTime() - start.getTime()) / (7 * 86400000));
  if (diffWeeks < 0) return 1;
  const weeks = Math.max(1, plan.weeks || 1);
  return (diffWeeks % weeks) + 1;
}

/** Days of the program week that applies on `date`, falling back to week 1. */
export function daysForDate(bundle: PlanBundle, date: Date, startOverride?: string | null): PlanDay[] {
  const week = planWeekIndex(bundle.plan, date, startOverride);
  const inWeek = bundle.days.filter((d) => d.week_index === week);
  const source = inWeek.length > 0 ? inWeek : bundle.days.filter((d) => d.week_index === 1);
  return [...source].sort((a, b) => a.weekday - b.weekday);
}

export function dayForDate(
  bundle: PlanBundle,
  date: Date,
  startOverride?: string | null,
): PlanDay | null {
  const weekday = isoWeekday(date);
  return daysForDate(bundle, date, startOverride).find((d) => d.weekday === weekday) ?? null;
}

/** Ordered segments of a day — always at least one. */
export function resolveSegments(bundle: PlanBundle, day: PlanDay): ResolvedSegment[] {
  const segments = bundle.segments
    .filter((s) => s.plan_day_id === day.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const dayExercises = bundle.exercises
    .filter((e) => e.plan_day_id === day.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (segments.length === 0) {
    return [
      {
        id: `day:${day.id}`,
        segmentId: null,
        dayId: day.id,
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

/** Empty plan skeleton for a new plan (7 rest days, week 1). */
export function emptyWeek(planId: string, weekIndex: number, newId: () => string): PlanDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: newId(),
    plan_id: planId,
    week_index: weekIndex,
    weekday: i + 1,
    title: "Rest",
    day_type: "rest" as DayType,
    custom_type_label: "",
    icon_name: "",
    color_hex: "",
    is_optional: false,
    counts_as_gym: null,
    run_modality: "walk" as const,
    sort_order: i,
  }));
}
