/**
 * Multi-dimensional training intelligence derived from the existing session
 * and set-log model. It deliberately produces estimates, not diagnoses: the
 * UI can explain associations while preserving the raw tables as ground truth.
 */

import { categoryFor } from "../data/catalog";
import type { Session, SetLog } from "../data/types";
import { exerciseStats, weeklySeries } from "./analytics";
import { localDate } from "./dates";
import { analyseConsistency, type ProgressPlanRun } from "./consistency";
import { estimated1RM, nameKey, setHasData, volumeOf, wasTrained } from "./logging";

export type DimensionKey =
  | "strength"
  | "endurance"
  | "consistency"
  | "capacity"
  | "recovery"
  | "stability";

export interface TrainingDimension {
  key: DimensionKey;
  label: string;
  emoji: string;
  score: number;
  change: number | null;
  status: string;
  detail: string;
  confidence: "Building" | "Moderate" | "High";
}

export interface InterferenceInsight {
  id: string;
  earlier: string;
  later: string;
  estimatedImpact: number | null;
  score: number;
  confidence: "Estimated" | "Emerging" | "Personal";
  detail: string;
}

export interface TrainingIntelligence {
  dimensions: TrainingDimension[];
  trend: "Rapid improvement" | "Gradual improvement" | "Stable" | "Plateau" | "High variability" | "Possible regression";
  futureSessions: number;
  analysedSessions: number;
  interference: InterferenceInsight[];
}

export function buildTrainingIntelligence(
  sessions: Session[],
  logs: SetLog[],
  weeklyGoal: number,
  today = new Date(),
  options: { planRuns?: ProgressPlanRun[] } = {},
): TrainingIntelligence {
  const cutoff = localDate(today);
  const currentSessions = sessions.filter((session) => session.date <= cutoff);
  const currentIds = new Set(currentSessions.map((session) => session.id));
  const currentLogs = logs.filter((log) => currentIds.has(log.session_id) && setHasData(log));
  const loggedIds = new Set(currentLogs.map((log) => log.session_id));
  const trained = currentSessions.filter((session) => wasTrained(session, loggedIds));
  const stats = exerciseStats(sessions, logs, today);
  const confidence = confidenceFor(Math.min(trained.length, currentLogs.length / 3));

  const weightedStrength = stats.filter((stat) => stat.best1RM > 0);
  const strengthChange = median(weightedStrength.filter((stat) => stat.sessions >= 4).map((stat) => stat.strengthTrend));
  const enduranceChange = median(
    stats.filter((stat) => stat.sessions >= 4 && stat.setRetention !== null).map((stat) => stat.enduranceTrend),
  );
  const strengthScore = scoreFromChange(strengthChange);
  const enduranceScore = scoreFromChange(enduranceChange);

  const eightWeeks = weeklySeries(currentSessions, currentLogs, 8, today);
  const recentWeeks = eightWeeks.slice(-4);
  const priorWeeks = eightWeeks.slice(0, 4);
  const recentFrequency = average(recentWeeks.map((week) => week.sessions));
  const consistency = analyseConsistency(currentSessions, currentLogs, weeklyGoal, options.planRuns, today);
  const consistencyScore = consistency.score;
  const consistencyChange = consistency.change;

  const recentSets = sum(recentWeeks.map((week) => week.sets));
  const priorSets = sum(priorWeeks.map((week) => week.sets));
  const recentVolume = sum(recentWeeks.map((week) => week.volume));
  const priorVolume = sum(priorWeeks.map((week) => week.volume));
  const capacityChange = median([
    priorSets > 0 ? (recentSets - priorSets) / priorSets : 0,
    priorVolume > 0 ? (recentVolume - priorVolume) / priorVolume : 0,
  ]);
  const qualityShare = currentLogs.length
    ? currentLogs.filter((log) => log.rpe === null || log.rpe <= 8).length / currentLogs.length
    : 0;
  const capacityScore = clamp(Math.round(scoreFromChange(capacityChange) * 0.7 + qualityShare * 100 * 0.3), 0, 100);

  const suppression = recoverySuppression(stats);
  const recoveryScore = clamp(Math.round(92 - suppression.breadth * 8 - Math.max(0, -suppression.change) * 250), 0, 100);
  const stabilityScore = stats.length ? Math.round(average(stats.map((stat) => stat.stabilityScore))) : 50;
  const stabilityChange = median(stats.filter((stat) => stat.sessions >= 4).map((stat) => stat.strengthTrend));

  const dimensions: TrainingDimension[] = [
    dimension("strength", "Strength", "🏋️", strengthScore, strengthChange, confidence,
      weightedStrength.length > 0
        ? "Tracks your estimated max lift, repeat performance and whether the same work feels easier."
        : "Rolling best performance across logged exercises."),
    dimension("endurance", "Muscular endurance", "🔁", enduranceScore, enduranceChange, confidence,
      "How much first-set performance you can keep in later sets across repeated workouts."),
    dimension("consistency", "Consistency", "📅", consistencyScore, consistencyChange, confidence,
      consistency.requiredDays > 0
        ? `${consistency.completedRequiredDays} of ${consistency.requiredDays} required training days included real work; rest and optional days are neutral.`
        : `Averaging ${round(recentFrequency, 1)} training days/week with spacing included.`),
    dimension("capacity", "Training capacity", "⚡", capacityScore, capacityChange, confidence,
      `${recentSets} working sets in the latest four weeks; manageable-effort work is weighted higher.`),
    {
      key: "recovery",
      label: "Recovery",
      emoji: "🌿",
      score: recoveryScore,
      change: suppression.change,
      status: suppression.breadth >= 3 ? "Performance suppression" : suppression.breadth > 0 ? "Watch" : "Normal",
      detail: suppression.breadth >= 3
        ? `${suppression.breadth} exercises are below their rolling baseline. Treat this as a recovery signal, not lost strength.`
        : "No broad, repeated performance suppression detected.",
      confidence,
    },
    {
      key: "stability",
      label: "Progress stability",
      emoji: "〰️",
      score: stabilityScore,
      change: stabilityChange,
      status: stabilityScore >= 80 ? "Repeatable" : stabilityScore >= 60 ? "Steady" : "Variable",
      detail: "Scores rolling baseline repeatability, not isolated peaks.",
      confidence,
    },
  ];
  dimensions[2].status = consistencyScore >= 80 ? "Regular" : consistencyScore >= 55 ? "Building" : "Irregular";

  return {
    dimensions,
    trend: overallTrend(dimensions),
    futureSessions: sessions.filter((session) => session.date > cutoff && wasTrained(session, new Set(logs.map((log) => log.session_id)))).length,
    analysedSessions: trained.length,
    interference: buildInterference(currentSessions, currentLogs),
  };
}

function dimension(
  key: DimensionKey,
  label: string,
  emoji: string,
  score: number,
  change: number | null,
  confidence: TrainingDimension["confidence"],
  detail: string,
): TrainingDimension {
  return {
    key,
    label,
    emoji,
    score,
    change,
    confidence,
    status: change === null || Math.abs(change) < 0.015 ? "Stable" : change > 0 ? "Improving" : "Watch",
    detail,
  };
}

function buildInterference(sessions: Session[], logs: SetLog[]): InterferenceInsight[] {
  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) bySession.set(log.session_id, [...(bySession.get(log.session_id) ?? []), log]);
  const fresh = new Map<string, number[]>();
  const pairs = new Map<string, {
    earlier: string;
    later: string;
    after: number[];
    generic: number[];
  }>();

  for (const session of [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80)) {
    const sessionLogs = bySession.get(session.id) ?? [];
    const exercises = orderedExercises(session, sessionLogs);
    if (exercises.length === 0) continue;
    const first = exercises[0];
    fresh.set(first.key, [...(fresh.get(first.key) ?? []), exercisePerformance(first.logs)]);

    for (let laterIndex = 1; laterIndex < exercises.length; laterIndex += 1) {
      const later = exercises[laterIndex];
      for (let earlierIndex = 0; earlierIndex < laterIndex; earlierIndex += 1) {
        const earlier = exercises[earlierIndex];
        const score = genericInterference(earlier.name, later.name, earlier.logs, laterIndex - earlierIndex);
        if (score < 0.18) continue;
        const key = `${earlier.key}→${later.key}`;
        const pair = pairs.get(key) ?? { earlier: earlier.name, later: later.name, after: [], generic: [] };
        pair.after.push(exercisePerformance(later.logs));
        pair.generic.push(score);
        pairs.set(key, pair);
      }
    }
  }

  return [...pairs.entries()]
    .map(([id, pair]): InterferenceInsight => {
      const baseline = fresh.get(nameKey(pair.later)) ?? [];
      const afterMean = average(pair.after.filter((value) => value > 0));
      const freshMean = average(baseline.filter((value) => value > 0));
      const enoughPersonal = pair.after.length >= 2 && baseline.length >= 2 && freshMean > 0;
      const impact = enoughPersonal ? (afterMean - freshMean) / freshMean : null;
      const score = average(pair.generic);
      const confidence: InterferenceInsight["confidence"] = enoughPersonal
        ? pair.after.length + baseline.length >= 8 ? "Personal" : "Emerging"
        : "Estimated";
      return {
        id,
        earlier: pair.earlier,
        later: pair.later,
        estimatedImpact: impact,
        score,
        confidence,
        detail: impact !== null
          ? `${pair.later} averages ${Math.abs(Math.round(impact * 100))}% ${impact < 0 ? "lower" : "higher"} after ${pair.earlier} across comparable observations.`
          : `${pair.earlier} may suppress ${pair.later} through ${interferenceReason(pair.earlier, pair.later)}. More fresh comparisons are needed.`,
      };
    })
    .filter((insight) => insight.estimatedImpact === null || insight.estimatedImpact < -0.02)
    .sort((a, b) => {
      const personalA = a.estimatedImpact === null ? 0 : Math.abs(a.estimatedImpact) + 1;
      const personalB = b.estimatedImpact === null ? 0 : Math.abs(b.estimatedImpact) + 1;
      return personalB - personalA || b.score - a.score;
    })
    .slice(0, 4);
}

function orderedExercises(session: Session, logs: SetLog[]) {
  const grouped = new Map<string, { key: string; name: string; logs: SetLog[]; time: string; completedIndex: number }>();
  for (const log of logs) {
    const key = nameKey(log.exercise_name);
    const completedIndex = session.completed_names.findIndex((name) => nameKey(name) === key);
    const item = grouped.get(key) ?? {
      key,
      name: log.exercise_name,
      logs: [],
      time: log.completed_at || "",
      completedIndex: completedIndex < 0 ? Number.MAX_SAFE_INTEGER : completedIndex,
    };
    item.logs.push(log);
    if (log.completed_at && (!item.time || log.completed_at < item.time)) item.time = log.completed_at;
    grouped.set(key, item);
  }
  return [...grouped.values()].sort((a, b) => {
    if (a.completedIndex !== b.completedIndex) return a.completedIndex - b.completedIndex;
    return a.time.localeCompare(b.time);
  });
}

function genericInterference(earlier: string, later: string, sets: SetLog[], distance: number): number {
  const a = exerciseProfile(earlier);
  const b = exerciseProfile(later);
  const shared = [...a.muscles].filter((muscle) => b.muscles.has(muscle)).length;
  const union = new Set([...a.muscles, ...b.muscles]).size || 1;
  const muscleOverlap = shared / union;
  const movementOverlap = a.pattern === b.pattern ? 1 : 0;
  const secondary = (a.grip && b.grip ? 0.15 : 0) + (a.axial && b.axial ? 0.15 : 0);
  const effort = average(sets.flatMap((set) => set.rpe ? [set.rpe / 10] : [])) || 0.75;
  const dose = clamp(sets.length / 4, 0.35, 1);
  const proximity = 1 / Math.max(1, distance);
  return clamp((muscleOverlap * 0.5 + movementOverlap * 0.2 + secondary) * effort * dose * a.systemic * (0.65 + 0.35 * proximity), 0, 1);
}

function exerciseProfile(name: string) {
  const n = name.toLowerCase();
  const category = categoryFor(name);
  const muscles = new Set<string>([category]);
  if (/(bench|press|push-up|dip|fly)/.test(n)) muscles.add("chest");
  if (/(press|dip|tricep|pushdown)/.test(n)) muscles.add("triceps");
  if (/(overhead|incline|lateral|front delt|shoulder)/.test(n)) muscles.add("front-delts");
  if (/(row|pull|chin|lat)/.test(n)) muscles.add("back");
  if (/(row|pull|chin|curl)/.test(n)) muscles.add("biceps");
  if (/(squat|lunge|leg press|extension)/.test(n)) muscles.add("quads");
  if (/(deadlift|hinge|good morning|leg curl)/.test(n)) muscles.add("posterior-chain");
  const compound = /(squat|deadlift|bench|row|press|pull-up|chin|dip|lunge|leg press)/.test(n);
  return {
    muscles,
    pattern: /(deadlift|romanian|hinge|good morning)/.test(n) ? "hinge"
      : /(squat|lunge|leg press)/.test(n) ? "squat"
        : /(bench|push-up|fly|dip)/.test(n) ? "horizontal-push"
          : /(overhead|shoulder press)/.test(n) ? "vertical-push"
            : /(row)/.test(n) ? "horizontal-pull"
              : /(pull-up|chin|pulldown)/.test(n) ? "vertical-pull"
                : category,
    grip: /(deadlift|row|pull|chin|curl|carry|dumbbell)/.test(n),
    axial: /(deadlift|squat|barbell row|good morning)/.test(n),
    systemic: compound ? 1 : 0.65,
  };
}

function interferenceReason(earlier: string, later: string): string {
  const a = exerciseProfile(earlier);
  const b = exerciseProfile(later);
  const reasons: string[] = [];
  if ([...a.muscles].some((muscle) => b.muscles.has(muscle))) reasons.push("shared muscle demand");
  if (a.pattern === b.pattern) reasons.push("movement-pattern overlap");
  if (a.grip && b.grip) reasons.push("grip fatigue");
  if (a.axial && b.axial) reasons.push("bracing/lower-back demand");
  return reasons.slice(0, 2).join(" and ") || "accumulated session fatigue";
}

function exercisePerformance(sets: SetLog[]): number {
  const e1rm = sets.reduce((best, set) => Math.max(best, estimated1RM(set.weight_kg ?? 0, set.reps ?? 0)), 0);
  if (e1rm > 0) return e1rm;
  const volume = volumeOf(sets);
  if (volume > 0) return volume;
  return sets.reduce((total, set) => total + (set.reps ?? 0) + (set.distance_km ?? 0) + (set.duration_sec ?? 0) / 60, 0);
}

function recoverySuppression(stats: ReturnType<typeof exerciseStats>) {
  const declines: number[] = [];
  for (const stat of stats) {
    const history = stat.history.filter((entry) => !entry.future);
    if (history.length < 5) continue;
    const performance = history.map((entry) => entry.e1RM || entry.best).filter((value) => value > 0);
    if (performance.length < 5) continue;
    const recent = average(performance.slice(-2));
    const baseline = average(performance.slice(-6, -2));
    if (baseline > 0) declines.push((recent - baseline) / baseline);
  }
  const suppressed = declines.filter((change) => change < -0.04);
  return { breadth: suppressed.length, change: median(declines) };
}

function overallTrend(dimensions: TrainingDimension[]): TrainingIntelligence["trend"] {
  const performance = dimensions.filter((dimension) => ["strength", "endurance", "capacity"].includes(dimension.key));
  const changes = performance.flatMap((dimension) => dimension.change === null ? [] : [dimension.change]);
  const change = median(changes);
  const stability = dimensions.find((dimension) => dimension.key === "stability")?.score ?? 50;
  if (stability < 50) return "High variability";
  if (change >= 0.08) return "Rapid improvement";
  if (change >= 0.02) return "Gradual improvement";
  if (change <= -0.04) return "Possible regression";
  if (Math.abs(change) < 0.01 && performance.every((dimension) => dimension.confidence === "High")) return "Plateau";
  return "Stable";
}

function confidenceFor(observations: number): TrainingDimension["confidence"] {
  return observations >= 16 ? "High" : observations >= 6 ? "Moderate" : "Building";
}

function scoreFromChange(change: number | null): number {
  return change === null ? 50 : clamp(Math.round(50 + change * 250), 0, 100);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
