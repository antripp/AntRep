import type { ExerciseCategory, LogType } from "./types";

/** Canonical exercise metadata from the same wger feed used by antrip.health. */
export interface MuscleInfo {
  id: number;
  name: string;
  isFront: boolean;
  imageURLMain: string;
  imageURLSecondary: string;
}

export interface LibraryExercise {
  wgerId: number;
  name: string;
  category: ExerciseCategory;
  wgerCategoryName: string;
  equipmentNames: string[];
  primaryMuscles: MuscleInfo[];
  secondaryMuscles: MuscleInfo[];
  logType: LogType;
  sets: number;
  reps: number;
}

interface WgerPage<T> {
  next: string | null;
  results: T[];
}

interface WgerMuscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
  image_url_main: string;
  image_url_secondary: string;
}

interface WgerExerciseInfo {
  id: number;
  category: { id: number; name: string };
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: { id: number; name: string }[];
  translations: { name: string; language: number }[];
}

const ENDPOINT = "https://wger.de/api/v2/exerciseinfo/?language=2&limit=100";
const CACHE_KEY = "antrep.exercise-library.wger.v2";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let request: Promise<LibraryExercise[]> | null = null;

function muscle(m: WgerMuscle): MuscleInfo {
  const absolute = (path: string) => path ? new URL(path, "https://wger.de/").href : "";
  return {
    id: m.id,
    name: m.name_en.trim() || m.name,
    isFront: m.is_front,
    imageURLMain: absolute(m.image_url_main),
    imageURLSecondary: absolute(m.image_url_secondary),
  };
}

function isEnglishName(name: string): boolean {
  const blocked = ["supino", "sentadilla", "arraché", "étape", "fentes", "haltère"];
  if (blocked.some((word) => name.toLowerCase().includes(word))) return false;
  const letters = [...name].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return true;
  return letters.filter((char) => char.codePointAt(0)! <= 127).length / letters.length >= 0.85;
}

function categoryForWger(name: string, categoryId: number): ExerciseCategory {
  const n = name.toLowerCase();
  if (categoryId === 15 || /(run|walk|jog|cycl|bike|swim|cardio|treadmill|rowing)/.test(n)) return "cardio";
  if (categoryId === 9 || categoryId === 14 || /(squat|lunge|leg|calf|deadlift|glute|hamstring)/.test(n)) return "legs";
  if (categoryId === 10 || /(plank|crunch|core|ab |abs|dead bug|sit-up)/.test(n)) return "core";
  if (categoryId === 12 || /(row|pull|curl|lat|chin)/.test(n)) return "pull";
  return "push";
}

function defaults(name: string, category: ExerciseCategory): Pick<LibraryExercise, "logType" | "sets" | "reps"> {
  if (category === "cardio") return { logType: "cardio", sets: 1, reps: 0 };
  if (/(plank|hold|stretch|mobility|yoga)/i.test(name)) return { logType: "timed", sets: 3, reps: 0 };
  return { logType: "strength", sets: 3, reps: /(curl|raise|extension)/i.test(name) ? 12 : 10 };
}

function mapInfo(info: WgerExerciseInfo): LibraryExercise | null {
  const translation = info.translations.find((item) => item.language === 2);
  const name = translation?.name.trim() ?? "";
  if (!name || !isEnglishName(name)) return null;
  const category = categoryForWger(name, info.category.id);
  return {
    wgerId: info.id,
    name,
    category,
    wgerCategoryName: info.category.name,
    equipmentNames: info.equipment.map((item) => item.name),
    primaryMuscles: info.muscles.map(muscle),
    secondaryMuscles: info.muscles_secondary.map(muscle),
    ...defaults(name, category),
  };
}

function metadataScore(item: LibraryExercise): number {
  return item.primaryMuscles.length * 2 + item.secondaryMuscles.length + item.equipmentNames.length;
}

function readCache(): LibraryExercise[] | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as
      | { savedAt: number; exercises: LibraryExercise[] }
      | null;
    return value && Date.now() - value.savedAt < CACHE_MAX_AGE_MS ? value.exercises : null;
  } catch {
    return null;
  }
}

async function fetchAllPages(): Promise<LibraryExercise[]> {
  const all: WgerExerciseInfo[] = [];
  let next: string | null = ENDPOINT;
  while (next) {
    const response = await fetch(next, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Exercise database returned ${response.status}`);
    const page = (await response.json()) as WgerPage<WgerExerciseInfo>;
    all.push(...page.results);
    next = page.next;
  }

  const byName = new Map<string, LibraryExercise>();
  for (const info of all) {
    const item = mapInfo(info);
    if (!item) continue;
    const key = item.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || metadataScore(item) > metadataScore(existing) ||
        (metadataScore(item) === metadataScore(existing) && item.wgerId < existing.wgerId)) {
      byName.set(key, item);
    }
  }
  const exercises = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), exercises }));
  } catch {
    // Private browsing/storage limits should not make the online library unusable.
  }
  return exercises;
}

export function loadExerciseLibrary(force = false): Promise<LibraryExercise[]> {
  if (force) {
    localStorage.removeItem(CACHE_KEY);
    request = null;
  }
  const cached = readCache();
  if (cached) return Promise.resolve(cached);
  request ??= fetchAllPages().catch((error) => {
    request = null;
    throw error;
  });
  return request;
}

export function libraryExerciseById(items: LibraryExercise[], wgerId?: number | null) {
  return wgerId ? items.find((item) => item.wgerId === wgerId) : undefined;
}

/** Starter/legacy aliases copied from antrip.health; the athlete still confirms the match. */
const LEGACY_ALIASES: Record<string, string> = {
  "flat bench press": "Bench Press",
  "incline dumbbell press": "Incline Dumbbell Press",
  "overhead dumbbell press": "Single-arm dumbbell shoulder press",
  "lateral raises": "Lateral Raises",
  "tricep pushdowns (cable)": "Tricep Pushdown on Cable",
  "overhead tricep extension": "Overhead Triceps Extension",
  "lat pulldown or pull-ups": "Close-grip lat pulldown",
  "seated cable row": "Seated Cable Row",
  "single-arm dumbbell row": "Bent Over Dumbbell Rows",
  "face pulls (cable)": "Face pulls with yellow/green band",
  "barbell or dumbbell curl": "Dumbbell Curl",
  "hammer curls": "Hammer Curls",
  "barbell or goblet squat": "Barbell Full Squat",
  "leg press": "Leg Press",
  "romanian deadlift": "Romanian Deadlift",
  "leg curl (machine)": "Leg Curls (sitting)",
  "calf raises": "Standing Calf Raises",
  "walking lunges": "Dumbbell Lunges Walking",
  "push-ups": "Push-Up",
  "dumbbell row": "Bent Over Dumbbell Rows",
  "plank or dead bug": "Front Plank",
};

export function suggestedLibraryQuery(name: string): string {
  return LEGACY_ALIASES[name.trim().toLowerCase()] ?? name;
}
