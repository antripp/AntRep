/** Plain-language labels used anywhere analytics are shown to non-specialists. */
export const ANALYTICS_TERMS = {
  estimatedMax: {
    short: "Estimated max lift",
    detail: "A safe estimate of the heaviest weight you could lift once, calculated from a normal multi-rep set. You never need to attempt a true one-rep maximum.",
  },
  effort: {
    short: "Effort score",
    detail: "How hard a set felt from 1 to 10. An 8 usually means you could have completed about two more good repetitions.",
  },
  retention: {
    short: "Later-set strength kept",
    detail: "How much of your first set's performance you could still produce in the later sets. Higher means you maintained your output better.",
  },
  volume: {
    short: "Total lifting work",
    detail: "Weight multiplied by repetitions across all sets. It describes how much loaded work you completed, not how strong you are by itself.",
  },
  density: {
    short: "Work rate",
    detail: "How many useful sets you completed per minute. It helps show whether you can do the same work more efficiently.",
  },
} as const;

export function effortLabel(value: number): string {
  return `Effort ${Math.round(value * 10) / 10}/10`;
}
