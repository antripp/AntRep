/** Built-in exercise catalog + starter plan — ported from the iOS app. */

import type { ExerciseCategory, LogType } from "./types";

export interface CatalogExercise {
  name: string;
  category: ExerciseCategory;
  sets: number;
  reps: number;
  repScheme: string;
  logType: LogType;
}

const strength = (
  name: string,
  category: ExerciseCategory,
  sets: number,
  reps: number,
  repScheme: string,
): CatalogExercise => ({ name, category, sets, reps, repScheme, logType: "strength" });

export const PUSH_EXERCISES: CatalogExercise[] = [
  strength("Flat bench press", "push", 3, 12, "3 x 10-12"),
  strength("Incline dumbbell press", "push", 3, 12, "3 x 10-12"),
  strength("Overhead dumbbell press", "push", 3, 10, "3 x 10"),
  strength("Lateral raises", "push", 3, 15, "3 x 15"),
  strength("Tricep pushdowns (cable)", "push", 3, 12, "3 x 12"),
  strength("Overhead tricep extension", "push", 2, 12, "2 x 12"),
  strength("Push-ups", "push", 3, 15, "3 x max clean reps"),
  strength("Dips", "push", 3, 10, "3 x 10"),
  strength("Chest fly (machine)", "push", 3, 12, "3 x 12"),
];

export const PULL_EXERCISES: CatalogExercise[] = [
  strength("Lat pulldown or pull-ups", "pull", 3, 12, "3 x 10-12"),
  strength("Seated cable row", "pull", 3, 12, "3 x 10-12"),
  strength("Single-arm dumbbell row", "pull", 3, 10, "3 x 10 each"),
  strength("Face pulls (cable)", "pull", 3, 15, "3 x 15"),
  strength("Barbell or dumbbell curl", "pull", 3, 12, "3 x 12"),
  strength("Hammer curls", "pull", 2, 12, "2 x 12"),
  strength("Barbell row", "pull", 3, 10, "3 x 10"),
  strength("Rear delt fly", "pull", 3, 15, "3 x 15"),
];

export const LEG_EXERCISES: CatalogExercise[] = [
  strength("Barbell or goblet squat", "legs", 3, 10, "3 x 10"),
  strength("Leg press", "legs", 3, 12, "3 x 12"),
  strength("Romanian deadlift", "legs", 3, 10, "3 x 10"),
  strength("Leg curl (machine)", "legs", 3, 12, "3 x 12"),
  strength("Calf raises", "legs", 3, 15, "3 x 15"),
  strength("Walking lunges", "legs", 3, 12, "3 x 12 each"),
  strength("Leg extension", "legs", 3, 12, "3 x 12"),
];

export const CORE_EXERCISES: CatalogExercise[] = [
  { name: "Plank", category: "core", sets: 3, reps: 0, repScheme: "3 x 40 sec", logType: "timed" },
  { name: "Dead bug", category: "core", sets: 3, reps: 12, repScheme: "3 x 12", logType: "strength" },
  { name: "Hanging knee raise", category: "core", sets: 3, reps: 12, repScheme: "3 x 12", logType: "strength" },
  { name: "Cable crunch", category: "core", sets: 3, reps: 15, repScheme: "3 x 15", logType: "strength" },
  { name: "Side plank", category: "core", sets: 2, reps: 0, repScheme: "2 x 30 sec each", logType: "timed" },
];

export const CARDIO_EXERCISES: CatalogExercise[] = [
  { name: "Walk", category: "cardio", sets: 1, reps: 0, repScheme: "30 min", logType: "cardio" },
  { name: "Jog", category: "cardio", sets: 1, reps: 0, repScheme: "5 km", logType: "cardio" },
  { name: "Run", category: "cardio", sets: 1, reps: 0, repScheme: "5 km", logType: "cardio" },
  { name: "Cycling", category: "cardio", sets: 1, reps: 0, repScheme: "20 km", logType: "cardio" },
  { name: "Rowing machine", category: "cardio", sets: 1, reps: 0, repScheme: "2 km", logType: "cardio" },
  { name: "Treadmill intervals", category: "cardio", sets: 6, reps: 0, repScheme: "6 x 1 min", logType: "cardio" },
];

export const CATALOG: CatalogExercise[] = [
  ...PUSH_EXERCISES,
  ...PULL_EXERCISES,
  ...LEG_EXERCISES,
  ...CORE_EXERCISES,
  ...CARDIO_EXERCISES,
];

export function catalogEntry(name: string): CatalogExercise | undefined {
  const key = name.trim().toLowerCase();
  return CATALOG.find((e) => e.name.toLowerCase() === key);
}

/** Best-guess muscle category for an exercise name (analytics fallback). */
export function categoryFor(name: string): ExerciseCategory {
  const found = catalogEntry(name);
  if (found) return found.category;
  const n = name.toLowerCase();
  if (/(run|walk|jog|cycl|row machine|bike|cardio|treadmill)/.test(n)) return "cardio";
  if (/(squat|lunge|leg|calf|deadlift|glute|hamstring)/.test(n)) return "legs";
  if (/(row|pull|curl|lat|face pull|chin)/.test(n)) return "pull";
  if (/(plank|crunch|core|ab |abs|dead bug)/.test(n)) return "core";
  return "push";
}

export function inferLogType(name: string): LogType {
  return catalogEntry(name)?.logType ?? (categoryFor(name) === "cardio" ? "cardio" : "strength");
}

/** The iOS starter week: Mon push · Tue walk · Wed pull · Thu walk · Fri legs + walk · Sat optional · Sun rest. */
export interface StarterDay {
  weekday: number;
  title: string;
  dayType: "push" | "pull" | "legs" | "fullbody" | "run" | "rest";
  optional?: boolean;
  exercises: CatalogExercise[];
  /** Second block of the day, e.g. legs then a walk. */
  extraSegment?: { title: string; dayType: "run"; exercises: CatalogExercise[] };
}

export const STARTER_WEEK: StarterDay[] = [
  { weekday: 1, title: "Push day", dayType: "push", exercises: PUSH_EXERCISES.slice(0, 6) },
  { weekday: 2, title: "Walk, run or jog", dayType: "run", exercises: [CARDIO_EXERCISES[0]] },
  { weekday: 3, title: "Pull day", dayType: "pull", exercises: PULL_EXERCISES.slice(0, 6) },
  { weekday: 4, title: "Walk, run or jog", dayType: "run", exercises: [CARDIO_EXERCISES[0]] },
  {
    weekday: 5,
    title: "Leg day",
    dayType: "legs",
    exercises: LEG_EXERCISES.slice(0, 5),
    extraSegment: { title: "Walk, run or jog", dayType: "run", exercises: [CARDIO_EXERCISES[0]] },
  },
  {
    weekday: 6,
    title: "Optional full body",
    dayType: "fullbody",
    optional: true,
    exercises: [LEG_EXERCISES[5], PUSH_EXERCISES[6], PULL_EXERCISES[2], CORE_EXERCISES[0]],
  },
  { weekday: 7, title: "Rest", dayType: "rest", exercises: [] },
];
