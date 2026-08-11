/** Detailed, filterable evidence behind each progression dimension. */

import { categoryFor } from "../data/catalog";
import type { ExerciseCategory, Session, SetLog } from "../data/types";
import { exerciseStats, weeklySeries } from "./analytics";
import { addDays, localDate } from "./dates";
import { estimated1RM, nameKey, setHasData, wasTrained } from "./logging";
import {
  buildTrainingIntelligence,
  type DimensionKey,
  type TrainingDimension,
} from "./trainingIntelligence";

export type EffortFilter = "all" | "manageable" | "high";

export interface DimensionMethod {
  title: string;
  summary: string;
  inputs: string[];
  formula: string;
  thresholds: string[];
  caution: string;
}

export interface MuscleLoadPoint {
  category: ExerciseCategory;
  label: string;
  load: number;
  share: number;
  retention: number | null;
  sets: number;
}

export interface ExerciseEvidence {
  key: string;
  name: string;
  sessions: number;
  primary: number;
  change: number;
  stability: number;
  retention: number | null;
  detail: string;
}

export interface SessionEvidence {
  id: string;
  date: string;
  title: string;
  value: number | null;
  unit: string;
  detail: string;
}

export interface DetailedWeek {
  label: string;
  weekStart: string;
  sessions: number;
  sets: number;
  volume: number;
  qualitySets: number;
  avgRpe: number | null;
  density: number;
  performance: number;
  retention: number;
}

export interface DimensionReport {
  dimension: TrainingDimension;
  takeaway: string;
  reflection: string;
  stats: { label: string; value: string }[];
  weeks: DetailedWeek[];
  muscles: MuscleLoadPoint[];
  exercises: ExerciseEvidence[];
  sessions: SessionEvidence[];
  method: DimensionMethod;
  analysedSessions: number;
}

export interface ContextSignals {
  retention: number | null;
  qualityShare: number | null;
  avgRpe: number | null;
  density: number | null;
  stability: number;
  takeaway: string;
  exerciseRetention: { name: string; retention: number; sets: number }[];
}

export const DIMENSION_METHODS: Record<DimensionKey, DimensionMethod> = {
  strength: {
    title: "How strength is assessed",
    summary: "Shows whether your repeatable lifting performance is improving—not just whether you hit one unusually good set.",
    inputs: ["Estimated max lift from normal multi-rep sets", "Weight or repetitions improved under similar conditions", "How hard each set felt", "Your recent history for each exercise"],
    formula: "The app compares recent sessions with your earlier baseline. Doing more weight or repetitions raises the result; repeating the same work while it feels easier also counts as progress.",
    thresholds: ["Improving: the recent baseline is clearly higher", "Holding steady: normal small changes", "Needs attention: several comparable sessions are repeatedly lower"],
    caution: "Estimated max lift is only a guide, and effort scores are personal. Technique, range of motion and equipment still matter.",
  },
  endurance: {
    title: "How muscular endurance is assessed",
    summary: "Shows how well you keep your performance after the first working set.",
    inputs: ["Weight and repetitions in each set", "Later sets compared with the first", "Number of sets", "Whether later sets felt much harder", "Work completed by muscle group"],
    formula: "Later-set strength kept compares the average of later sets with the first set. For example, keeping 9 reps after starting with 10 is stronger endurance than dropping to 6.",
    thresholds: ["Strong: at least 90% of first-set performance kept", "Moderate drop: 75–89% kept", "Large drop: less than 75% kept"],
    caution: "A deliberately heavy first set followed by lighter sets can lower this number without meaning your endurance is poor.",
  },
  consistency: {
    title: "How consistency is assessed",
    summary: "Rewards showing up on required training days with any real exercise. Rest and optional days are neutral.",
    inputs: ["Required days in active plans", "Days containing real logged work", "Plan-linked completions", "How evenly training is spaced"],
    formula: "The overall score mostly reflects required days on which you logged any real exercise, planned or unplanned. Spacing provides a smaller adjustment. Plan, day and exercise views use their own stricter completion patterns.",
    thresholds: ["Very dependable: 85 or higher", "Mostly regular: 65–84", "Still building: 40–64", "Needs a steadier rhythm: below 40"],
    caution: "Planned deloads, illness and travel are not failures; interpret the pattern in context.",
  },
  capacity: {
    title: "How training capacity is assessed",
    summary: "Estimates productive work tolerated while effort remains manageable.",
    inputs: ["Weekly working sets", "Total lifting work", "Share completed at manageable effort", "Work completed per minute", "Recent weeks compared with earlier weeks"],
    formula: "The score rises when you can complete more useful work without most sets becoming near-maximal effort.",
    thresholds: ["Improving: useful workload rises without a large effort jump", "Stable: workload is broadly unchanged", "Watch: workload repeatedly falls or too much work becomes near-maximal"],
    caution: "More work is not automatically better. The score deliberately discounts consistently maximal-effort volume.",
  },
  recovery: {
    title: "How recovery is assessed",
    summary: "Detects broad temporary performance suppression; it is not a medical recovery score.",
    inputs: ["Two most recent attempts", "Earlier four-attempt baseline", "Number of exercises declining together", "Effort and later-set performance"],
    formula: "Starting from 92, subtract 8 points per exercise more than 4% below baseline and a proportional penalty for median decline.",
    thresholds: ["Normal: no broad repeated suppression", "Watch: one or two exercises suppressed", "Performance suppression: three or more exercises suppressed"],
    caution: "Sleep, illness, nutrition and life stress are not measured directly. Use this as a prompt to reflect, not a diagnosis.",
  },
  stability: {
    title: "How progress stability is assessed",
    summary: "Scores how repeatable the recent baseline is, separately from the highest peak.",
    inputs: ["Last eight exercise outputs", "Rolling mean", "Standard deviation", "Exercise-level sample count"],
    formula: "Exercise stability = clamp[100 − 300 × coefficient of variation]. The overall score is the mean across exercises.",
    thresholds: ["Repeatable: ≥ 80", "Steady: 60–79", "Variable: < 60"],
    caution: "Variation can be intentional when rep ranges, tempo or exercise variations change.",
  },
};

export function buildDimensionReport({
  key,
  sessions,
  logs,
  weeklyGoal,
  weeks,
  category,
  effort,
  today = new Date(),
}: {
  key: DimensionKey;
  sessions: Session[];
  logs: SetLog[];
  weeklyGoal: number;
  weeks: number;
  category: ExerciseCategory | "all";
  effort: EffortFilter;
  today?: Date;
}): DimensionReport {
  const cutoff = localDate(today);
  const since = localDate(addDays(today, -(weeks * 7 - 1)));
  const inRange = sessions.filter((session) => session.date >= since && session.date <= cutoff);
  const sessionIds = new Set(inRange.map((session) => session.id));
  const selectedLogs = logs.filter((log) => {
    if (!sessionIds.has(log.session_id) || !setHasData(log)) return false;
    // Strength is a load-based signal. Timed holds, running distance and
    // unweighted duration must never appear as kilograms or an estimated max.
    if (key === "strength" && estimated1RM(log.weight_kg ?? 0, log.reps ?? 0) <= 0) return false;
    if (category !== "all" && categoryFor(log.exercise_name) !== category) return false;
    if (effort === "manageable" && log.rpe !== null && log.rpe > 8) return false;
    if (effort === "high" && (log.rpe === null || log.rpe < 8.5)) return false;
    return true;
  });
  const selectedIds = new Set(selectedLogs.map((log) => log.session_id));
  const selectedSessions = inRange.filter((session) => selectedIds.has(session.id) || (category === "all" && wasTrained(session, selectedIds)));
  const intelligence = buildTrainingIntelligence(selectedSessions, selectedLogs, weeklyGoal, today);
  const dimension = intelligence.dimensions.find((item) => item.key === key)!;
  const stats = exerciseStats(selectedSessions, selectedLogs, today);
  const baseWeeks = weeklySeries(selectedSessions, selectedLogs, weeks, today);
  const logsBySession = groupBy(selectedLogs, (log) => log.session_id);

  const detailedWeeks: DetailedWeek[] = baseWeeks.map((week) => {
    const end = localDate(addDays(new Date(`${week.weekStart}T12:00:00`), 6));
    const weekSessions = selectedSessions.filter((session) => session.date >= week.weekStart && session.date <= end);
    const ids = new Set(weekSessions.map((session) => session.id));
    const weekLogs = selectedLogs.filter((log) => ids.has(log.session_id));
    const rpes = weekLogs.flatMap((log) => log.rpe === null ? [] : [log.rpe]);
    const retentions = weekSessions.flatMap((session) => {
      const grouped = groupBy(logsBySession.get(session.id) ?? [], (log) => nameKey(log.exercise_name));
      return [...grouped.values()].flatMap((sets) => {
        const value = retentionOf(sets);
        return value === null ? [] : [value];
      });
    });
    const durationMinutes = Math.max(1, weekSessions.reduce((total, session) => {
      if (!session.ended_at) return total;
      return total + Math.max(0, (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000);
    }, 0));
    const performances = weekSessions.flatMap((session) => {
      const sets = logsBySession.get(session.id) ?? [];
      const value = sessionPerformance(sets);
      return value > 0 ? [value] : [];
    });
    return {
      ...week,
      qualitySets: weekLogs.filter((log) => log.rpe === null || log.rpe <= 8).length,
      avgRpe: rpes.length ? average(rpes) : null,
      density: weekLogs.length / durationMinutes,
      performance: average(performances),
      retention: average(retentions) * 100,
    };
  });

  const muscles = buildMuscleLoads(selectedSessions, selectedLogs);
  const dimensionStats = key === "strength" ? stats.filter((stat) => stat.best1RM > 0) : stats;
  const exercises: ExerciseEvidence[] = dimensionStats
    .map((stat) => ({
      key: stat.key,
      name: stat.name,
      sessions: stat.sessions,
      primary: key === "endurance" ? (stat.setRetention ?? 0) * 100
        : key === "stability" ? stat.stabilityScore
          : key === "recovery" ? recentBaselineChange(stat) * 100
            : stat.best1RM || stat.best,
      change: key === "endurance" ? stat.enduranceTrend : stat.strengthTrend,
      stability: stat.stabilityScore,
      retention: stat.setRetention,
      detail: `${stat.trendLabel} · ${stat.confidence.toLowerCase()} confidence`,
    }))
    .sort((a, b) => key === "recovery" ? a.primary - b.primary : b.change - a.change);

  const evidenceSessions: SessionEvidence[] = [...selectedSessions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.started_at.localeCompare(a.started_at))
    .slice(0, 12)
    .map((session) => {
      const sets = logsBySession.get(session.id) ?? [];
      const sessionRetentions = [...groupBy(sets, (set) => nameKey(set.exercise_name)).values()]
        .flatMap((exerciseSets) => {
          const value = retentionOf(exerciseSets);
          return value === null ? [] : [value];
        });
      const rpes = sets.flatMap((set) => set.rpe === null ? [] : [set.rpe]);
      const value = key === "strength" ? sessionPerformance(sets)
        : key === "endurance" ? (sessionRetentions.length ? average(sessionRetentions) * 100 : null)
          : key === "capacity" ? sets.length
            : key === "recovery" ? average(rpes)
              : key === "stability" ? sessionPerformance(sets)
                : 1;
      const unit = key === "strength" ? "output"
        : key === "endurance" ? "% kept"
          : key === "capacity" ? "sets"
            : key === "recovery" ? "average effort"
              : key === "stability" ? "output"
                : "session";
      return {
        id: session.id,
        date: session.date,
        title: session.day_title || "Workout",
        value,
        unit,
        detail: `${sets.length} sets${rpes.length ? ` · effort ${round(average(rpes), 1)}/10` : ""}`,
      };
    });

  return {
    dimension,
    takeaway: takeawayFor(key, dimension, muscles, exercises, detailedWeeks),
    reflection: reflectionFor(key, dimension),
    stats: reportStats(key, detailedWeeks, muscles, exercises, selectedSessions),
    weeks: detailedWeeks,
    muscles,
    exercises,
    sessions: evidenceSessions,
    method: DIMENSION_METHODS[key],
    analysedSessions: selectedSessions.length,
  };
}

/** Compact indicators reused by session and grouped-day detail pages. */
export function buildContextSignals(sessions: Session[], logs: SetLog[]): ContextSignals {
  const ids = new Set(sessions.map((session) => session.id));
  const selected = logs.filter((log) => ids.has(log.session_id) && setHasData(log));
  const exposures = groupBy(selected, (log) => `${log.session_id}:${nameKey(log.exercise_name)}`);
  const exerciseRetention = new Map<string, { values: number[]; sets: number }>();
  for (const sets of exposures.values()) {
    const retention = retentionOf(sets);
    if (retention === null) continue;
    const name = sets[0].exercise_name;
    const item = exerciseRetention.get(name) ?? { values: [], sets: 0 };
    item.values.push(retention);
    item.sets += sets.length;
    exerciseRetention.set(name, item);
  }
  const retentionRows = [...exerciseRetention.entries()]
    .map(([name, item]) => ({ name, retention: average(item.values), sets: item.sets }))
    .sort((a, b) => a.retention - b.retention);
  const rpes = selected.flatMap((log) => log.rpe === null ? [] : [log.rpe]);
  const quality = selected.length ? selected.filter((log) => log.rpe === null || log.rpe <= 8).length / selected.length : null;
  const durationMinutes = sessions.reduce((total, session) => {
    if (!session.ended_at) return total;
    const minutes = Math.max(0, (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000);
    // Imports and batch-created sessions can have near-identical timestamps.
    // They prove ordering, not a trustworthy workout duration.
    return minutes >= 5 ? total + minutes : total;
  }, 0);
  const sessionLoads = sessions.map((session) => (logs.filter((log) => log.session_id === session.id)).reduce((total, log) => total + loadIndex(log), 0)).filter((value) => value > 0);
  const loadMean = average(sessionLoads);
  const variance = sessionLoads.length >= 2
    ? average(sessionLoads.map((value) => (value - loadMean) ** 2))
    : 0;
  const stability = sessionLoads.length >= 3 && loadMean > 0
    ? Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) / loadMean * 300)))
    : 50;
  const retention = retentionRows.length ? average(retentionRows.map((row) => row.retention)) : null;
  const lowest = retentionRows[0];
  const takeaway = lowest && lowest.retention < 0.8
    ? `${lowest.name} showed the largest later-set drop-off, keeping ${Math.round(lowest.retention * 100)}% of first-set performance.`
    : quality !== null && quality < 0.6
      ? "Most recorded work felt harder than 8/10; treat it as costly work rather than automatically productive work."
      : retention !== null
        ? `Later sets kept ${Math.round(retention * 100)}% of first-set performance on average; fatigue stayed controlled.`
        : "Add at least two working sets per exercise to reveal how performance changes as you tire.";
  return {
    retention,
    qualityShare: quality,
    avgRpe: rpes.length ? average(rpes) : null,
    density: durationMinutes > 0 ? selected.length / durationMinutes : null,
    stability,
    takeaway,
    exerciseRetention: retentionRows,
  };
}

function buildMuscleLoads(sessions: Session[], logs: SetLog[]): MuscleLoadPoint[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const groups = groupBy(logs, (log) => categoryFor(log.exercise_name));
  const raw = [...groups.entries()].map(([category, sets]) => {
    const byExposure = groupBy(sets, (set) => `${set.session_id}:${nameKey(set.exercise_name)}`);
    const retentions = [...byExposure.values()].flatMap((exerciseSets) => {
      const value = retentionOf(exerciseSets);
      return value === null ? [] : [value];
    });
    const load = sets.reduce((total, set) => total + loadIndex(set), 0);
    return {
      category,
      label: category[0].toUpperCase() + category.slice(1),
      load,
      share: 0,
      retention: retentions.length ? average(retentions) : null,
      sets: sets.filter((set) => sessionById.has(set.session_id)).length,
    };
  });
  const total = raw.reduce((sum, point) => sum + point.load, 0) || 1;
  return raw.map((point) => ({ ...point, share: point.load / total })).sort((a, b) => b.load - a.load);
}

function loadIndex(set: SetLog): number {
  const volume = (set.weight_kg ?? 0) * (set.reps ?? 0);
  if (volume > 0) return volume;
  if ((set.reps ?? 0) > 0) return (set.reps ?? 0) * 10;
  if ((set.distance_km ?? 0) > 0) return (set.distance_km ?? 0) * 100;
  return (set.duration_sec ?? 0) / 6;
}

function retentionOf(sets: SetLog[]): number | null {
  const ordered = [...sets].sort((a, b) => a.set_index - b.set_index);
  if (ordered.length < 2) return null;
  const score = (set: SetLog) => loadIndex(set);
  const first = score(ordered[0]);
  if (first <= 0) return null;
  const later = ordered.slice(1).map(score).filter((value) => value > 0);
  return later.length ? average(later) / first : null;
}

function sessionPerformance(sets: SetLog[]): number {
  const e1rm = sets.reduce((best, set) => Math.max(best, estimated1RM(set.weight_kg ?? 0, set.reps ?? 0)), 0);
  if (e1rm > 0) {
    const rpes = sets.flatMap((set) => set.rpe === null ? [] : [set.rpe]);
    return e1rm * (rpes.length ? 1 + Math.max(0, 10 - average(rpes)) * 0.015 : 1);
  }
  return Math.max(0, ...sets.map(loadIndex));
}

function recentBaselineChange(stat: ReturnType<typeof exerciseStats>[number]): number {
  const values = stat.history.filter((entry) => !entry.future).map((entry) => entry.e1RM || entry.best).filter((value) => value > 0);
  if (values.length < 5) return 0;
  const recent = average(values.slice(-2));
  const baseline = average(values.slice(-6, -2));
  return baseline > 0 ? (recent - baseline) / baseline : 0;
}

function takeawayFor(
  key: DimensionKey,
  dimension: TrainingDimension,
  muscles: MuscleLoadPoint[],
  exercises: ExerciseEvidence[],
  weeks: DetailedWeek[],
): string {
  const topMuscle = muscles[0];
  const topExercise = exercises[0];
  const recent = weeks.at(-1);
  switch (key) {
    case "strength":
      return dimension.change && dimension.change > 0.02
        ? `Your repeatable strength output is rising. ${topExercise ? `${topExercise.name} is the clearest contributor.` : "Keep the current progression pace."}`
        : "Your strength baseline is holding. Look for matched-load improvements before forcing a load jump.";
    case "endurance":
      return topMuscle
        ? `${topMuscle.label} carries ${Math.round(topMuscle.share * 100)}% of analysed work${topMuscle.retention !== null ? ` while keeping ${Math.round(topMuscle.retention * 100)}% of first-set performance` : ""}. Consider the balance before judging the overall score.`
        : "Log at least two working sets per exercise to see how well later sets hold up.";
    case "consistency":
      return dimension.score >= 80
        ? "Your training exposure is regular enough for trends to be trustworthy. Protect the spacing, not just the streak."
        : "The biggest progression opportunity is a more repeatable weekly rhythm, not a harder session.";
    case "capacity":
      return recent
        ? `The latest week held ${recent.sets} sets, ${recent.qualitySets} at manageable effort. Add more work only while performance and effort stay controlled.`
        : "Capacity needs several weeks of workload before it can be judged.";
    case "recovery":
      return dimension.status === "Performance suppression"
        ? "Several exercises are below baseline together. Consider reducing load or volume briefly, then reassess across repeated exposures."
        : "No broad suppression pattern is established. One poor exercise is not being treated as systemic fatigue.";
    case "stability":
      return dimension.score >= 80
        ? "Your recent baseline is repeatable; a new peak is more likely to reflect real progress."
        : "Your peaks and baseline are far apart. Standardise setup, effort and exercise order before judging progression.";
  }
}

function reflectionFor(key: DimensionKey, dimension: TrainingDimension): string {
  const prompts: Record<DimensionKey, string> = {
    strength: "Could you repeat the same work with cleaner technique or less effort?",
    endurance: "Which muscle group loses the most work after the first set—and is that intentional?",
    consistency: "Are your training gaps planned, or are sessions bunching together?",
    capacity: "Did added work stay productive, or did it simply become harder?",
    recovery: "Do sleep, soreness or stress explain the exercises currently below baseline?",
    stability: "What changed on the high-variance days: setup, order, rest, tempo or effort?",
  };
  return `${prompts[key]} Current signal: ${dimension.status.toLowerCase()}.`;
}

function reportStats(
  key: DimensionKey,
  weeks: DetailedWeek[],
  muscles: MuscleLoadPoint[],
  exercises: ExerciseEvidence[],
  sessions: Session[],
): { label: string; value: string }[] {
  const activeWeeks = weeks.filter((week) => week.sessions > 0);
  const totalSets = weeks.reduce((total, week) => total + week.sets, 0);
  const qualitySets = weeks.reduce((total, week) => total + week.qualitySets, 0);
  if (key === "endurance") return [
    { label: "Later-set strength kept", value: `${Math.round(average(muscles.flatMap((point) => point.retention === null ? [] : [point.retention])) * 100)}%` },
    { label: "Analysed sets", value: String(totalSets) },
    { label: "Top load group", value: muscles[0]?.label ?? "—" },
    { label: "Exercises", value: String(exercises.length) },
  ];
  if (key === "consistency") return [
    { label: "Active weeks", value: `${activeWeeks.length}/${weeks.length}` },
    { label: "Sessions", value: String(sessions.length) },
    { label: "Avg / active week", value: round(average(activeWeeks.map((week) => week.sessions)), 1).toString() },
    { label: "Longest quiet run", value: `${longestZeroRun(weeks)}w` },
  ];
  if (key === "capacity") return [
    { label: "Working sets", value: String(totalSets) },
    { label: "Manageable", value: totalSets ? `${Math.round(qualitySets / totalSets * 100)}%` : "—" },
    { label: "Work rate", value: `${round(average(weeks.map((week) => week.density)), 1)} sets/min` },
    { label: "Total lifting work", value: Math.round(weeks.reduce((total, week) => total + week.volume, 0)).toLocaleString() },
  ];
  if (key === "recovery") return [
    { label: "Suppressed", value: String(exercises.filter((exercise) => exercise.primary < -4).length) },
    { label: "Average effort", value: round(average(weeks.flatMap((week) => week.avgRpe === null ? [] : [week.avgRpe])), 1).toString() },
    { label: "Exercises", value: String(exercises.length) },
    { label: "Sessions", value: String(sessions.length) },
  ];
  if (key === "stability") return [
    { label: "Repeatable", value: String(exercises.filter((exercise) => exercise.stability >= 80).length) },
    { label: "Variable", value: String(exercises.filter((exercise) => exercise.stability < 60).length) },
    { label: "Exercises", value: String(exercises.length) },
    { label: "Sessions", value: String(sessions.length) },
  ];
  return [
    { label: "Best estimated max", value: `${round(Math.max(0, ...exercises.map((exercise) => exercise.primary)), 1)} kg` },
    { label: "Improving", value: String(exercises.filter((exercise) => exercise.change > 0.025).length) },
    { label: "Exercises", value: String(exercises.length) },
    { label: "Sessions", value: String(sessions.length) },
  ];
}

function longestZeroRun(weeks: DetailedWeek[]): number {
  let longest = 0;
  let current = 0;
  for (const week of weeks) {
    current = week.sessions === 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function groupBy<T, K>(values: T[], keyOf: (value: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    out.set(key, [...(out.get(key) ?? []), value]);
  }
  return out;
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
