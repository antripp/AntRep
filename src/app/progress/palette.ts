import type { ExerciseCategory } from "../../data/types";
import type { DimensionKey } from "../../domain/trainingIntelligence";

/** Semantic chart colours stay recognizable when the global accent changes. */
export const DIMENSION_COLORS: Record<DimensionKey, string> = {
  strength: "var(--metric-strength)",
  endurance: "var(--metric-endurance)",
  consistency: "var(--metric-consistency)",
  capacity: "var(--metric-capacity)",
  recovery: "var(--metric-recovery)",
  stability: "var(--metric-stability)",
};

export const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  push: "var(--category-push)",
  pull: "var(--category-pull)",
  legs: "var(--category-legs)",
  core: "var(--category-core)",
  cardio: "var(--category-cardio)",
};

export function analyticsColor(
  dimension: DimensionKey,
  category: ExerciseCategory | "all" = "all",
): string {
  return category === "all" ? DIMENSION_COLORS[dimension] : CATEGORY_COLORS[category];
}
