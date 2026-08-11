import type { Plan } from "../data/types";
import { daysBetween, localDate } from "./dates";
import { isCyclePlan, planBlockIndex, planDurationDays, planSplitLengths } from "./plan";

/** Number of progress periods available for assignment guidance. */
export function remarkPeriodCount(plan: Plan): number {
  return isCyclePlan(plan)
    ? planSplitLengths(plan).length
    : Math.max(1, Math.ceil(planDurationDays(plan) / 7));
}

/**
 * The guidance period for a performed date.
 *
 * Weekly templates can repeat one content block for months, but coaching notes
 * still advance through Week 1, Week 2, … across the assignment timeline.
 * Custom cycles use their named split position.
 */
export function remarkPeriodIndex(plan: Plan, date: Date, startOverride?: string | null): number {
  if (isCyclePlan(plan)) return planBlockIndex(plan, date, startOverride);
  const start = startOverride ?? plan.start_date;
  if (!start) return 1;
  return Math.max(1, Math.floor(daysBetween(start, localDate(date)) / 7) + 1);
}

export function remarkPeriodNoun(plan: Plan): "Week" | "Split" {
  return isCyclePlan(plan) ? "Split" : "Week";
}
