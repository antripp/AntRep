/**
 * Offline demo backend — the whole app running against localStorage.
 *
 * Used for local development and the "Explore the demo" button, so every
 * feature can be exercised without a database. Three seeded accounts (see
 * DEMO_ACCOUNTS) come pre-linked — a coach who also trains, an athlete a month
 * into a 4-week block, and a second athlete who has gone quiet — with plans,
 * history, extra work, custom logging fields, chat, check-ins and trackers.
 */

import { addDays, localDate, startOfWeek } from "../domain/dates";
import { applyAssignmentOverrides } from "../domain/assignmentPlan";
import { dayForDate } from "../domain/plan";
import { setHasData } from "../domain/logging";
import { STARTER_WEEK, type CatalogExercise } from "./catalog";
import {
  makeCheckIn,
  makeCoachNote,
  makeDay,
  makeExercise,
  makePlan,
  makePreset,
  makeProfile,
  makeSegment,
  makeSession,
  makeSet,
  makeTrackerTemplate,
  newId,
} from "./factories";
import type { Api, AthleteTraining, AuthResult, AuthUser } from "./api";
import type {
  ActivityReaction,
  CheckIn,
  CoachingBoard,
  CoachLink,
  CoachNote,
  ExercisePreset,
  ExtraExercise,
  Message,
  Plan,
  PlanAssignment,
  PlanBundle,
  PlanDay,
  PlanExercise,
  PlanSegment,
  Profile,
  Role,
  Session,
  SetLog,
  TrackerEntry,
  TrackerTemplate,
} from "./types";

const STORE_KEY = "antrep-demo-store-v2";
const SESSION_KEY = "antrep-demo-session";

export const DEMO_ACCOUNTS = [
  { email: "athlete@antrep.app", password: "demo1234", role: "athlete" as Role, name: "Alex Reps" },
  { email: "coach@antrep.app", password: "demo1234", role: "coach" as Role, name: "Coach Sam" },
  { email: "priya@antrep.app", password: "demo1234", role: "athlete" as Role, name: "Priya N" },
];

interface DemoUser {
  id: string;
  email: string;
  password: string;
}

interface DemoStore {
  reactions: ActivityReaction[];
  users: DemoUser[];
  profiles: Profile[];
  links: CoachLink[];
  plans: Plan[];
  days: PlanDay[];
  segments: PlanSegment[];
  exercises: PlanExercise[];
  assignments: PlanAssignment[];
  sessions: Session[];
  logs: SetLog[];
  presets: ExercisePreset[];
  messages: Message[];
  checkIns: CheckIn[];
  notes: CoachNote[];
  templates: TrackerTemplate[];
  entries: TrackerEntry[];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ------------------------------------------------------------------
// Seed — one dataset that exercises every feature in the app, so the
// demo accounts can be used to test without a database.
// ------------------------------------------------------------------

interface SeededPlan {
  plan: Plan;
  days: PlanDay[];
  segments: PlanSegment[];
  exercises: PlanExercise[];
}

const emptyPlan = (ownerId: string, name: string, patch: Partial<Plan> = {}): SeededPlan => {
  const plan = makePlan(ownerId, {
    name,
    weeks: 1,
    start_date: localDate(addDays(startOfWeek(), -28)),
    ...patch,
  });
  return { plan, days: [], segments: [], exercises: [] };
};

/** Mon push · Tue walk · Wed pull · Thu walk · Fri legs + walk · Sat optional · Sun rest. */
function planFromStarter(ownerId: string, name: string, patch: Partial<Plan> = {}): SeededPlan {
  const seeded = emptyPlan(ownerId, name, patch);
  const { plan, days, segments, exercises } = seeded;

  for (const template of STARTER_WEEK) {
    const day = makeDay(plan.id, template.weekday, {
      title: template.title,
      day_type: template.dayType,
      is_optional: Boolean(template.optional),
    });
    days.push(day);

    const addExercises = (list: CatalogExercise[], segmentId: string | null) => {
      list.forEach((entry, index) => {
        exercises.push(
          makeExercise(day.id, entry.name, {
            plan_segment_id: segmentId,
            sort_order: index,
            target_sets: entry.sets,
            target_reps: entry.reps,
            target_weight_kg: entry.logType === "strength" ? seedWeightFor(entry.name) : 0,
            rep_scheme: entry.repScheme,
            log_type: entry.logType,
            category: entry.category,
            is_mandatory: !template.optional,
          }),
        );
      });
    };

    if (template.extraSegment) {
      const main = makeSegment(day.id, { title: template.title, day_type: template.dayType, sort_order: 0 });
      const extra = makeSegment(day.id, {
        title: template.extraSegment.title,
        day_type: template.extraSegment.dayType,
        sort_order: 1,
      });
      segments.push(main, extra);
      addExercises(template.exercises, main.id);
      addExercises(template.extraSegment.exercises, extra.id);
    } else {
      addExercises(template.exercises, null);
    }
  }

  return seeded;
}

/** Copy week 1 into weeks 2..n, adding load each block — a real progression. */
function withWeeks(seeded: SeededPlan, weeks: number, loadStepKg = 2.5): SeededPlan {
  seeded.plan.weeks = weeks;
  const baseDays = [...seeded.days];
  const baseSegments = [...seeded.segments];
  const baseExercises = [...seeded.exercises];

  for (let week = 2; week <= weeks; week += 1) {
    const dayIds = new Map<string, string>();
    for (const day of baseDays) {
      const copy = { ...day, id: newId(), week_index: week };
      dayIds.set(day.id, copy.id);
      seeded.days.push(copy);
    }

    const segmentIds = new Map<string, string>();
    for (const segment of baseSegments) {
      const copy = { ...segment, id: newId(), plan_day_id: dayIds.get(segment.plan_day_id)! };
      segmentIds.set(segment.id, copy.id);
      seeded.segments.push(copy);
    }

    for (const exercise of baseExercises) {
      seeded.exercises.push({
        ...exercise,
        id: newId(),
        plan_day_id: dayIds.get(exercise.plan_day_id)!,
        plan_segment_id: exercise.plan_segment_id ? segmentIds.get(exercise.plan_segment_id)! : null,
        target_weight_kg:
          exercise.log_type === "strength" && exercise.target_weight_kg > 0
            ? exercise.target_weight_kg + loadStepKg * (week - 1)
            : exercise.target_weight_kg,
      });
    }
  }
  return seeded;
}

/** Intervals, holds and cardio — the logging methods the starter week doesn't use. */
function conditioningPlan(ownerId: string): SeededPlan {
  const seeded = emptyPlan(ownerId, "Conditioning add-on", {
    is_active: false,
    start_date: localDate(startOfWeek()),
    notes: "Two short sessions to bolt onto the main block.",
  });
  const { plan, days, exercises } = seeded;

  const restDays = [1, 3, 5, 7];
  for (const weekday of restDays) {
    days.push(makeDay(plan.id, weekday, { title: "Rest", day_type: "rest" }));
  }

  const intervals = makeDay(plan.id, 2, { title: "Intervals", day_type: "hiit" });
  days.push(intervals);
  exercises.push(
    makeExercise(intervals.id, "Treadmill intervals", {
      sort_order: 0,
      log_type: "interval",
      target_sets: 6,
      target_reps: 6,
      rep_scheme: "6 rounds · 1 min hard",
      rest_sec: 60,
      trainer_notes: "1 minute hard, 90 seconds easy.",
      custom_fields: [{ key: "incline", label: "Incline", type: "number", unit: "%" }],
    }),
    makeExercise(intervals.id, "Plank", {
      sort_order: 1,
      log_type: "timed",
      target_sets: 3,
      rep_scheme: "3 × 45 sec",
    }),
  );

  const rowCore = makeDay(plan.id, 4, { title: "Row + core", day_type: "fullbody" });
  days.push(rowCore);
  exercises.push(
    makeExercise(rowCore.id, "Rowing machine", {
      sort_order: 0,
      log_type: "cardio",
      target_sets: 1,
      rep_scheme: "2 km steady",
      custom_fields: [{ key: "avg_split", label: "Split", type: "text" }],
    }),
    makeExercise(rowCore.id, "Hanging knee raise", { sort_order: 1, target_sets: 3, target_reps: 12 }),
    makeExercise(rowCore.id, "Side plank", {
      sort_order: 2,
      log_type: "timed",
      target_sets: 2,
      is_mandatory: false,
      rep_scheme: "2 × 30 sec each",
    }),
  );

  const longWalk = makeDay(plan.id, 6, { title: "Long walk", day_type: "run", is_optional: true });
  days.push(longWalk);
  exercises.push(
    makeExercise(longWalk.id, "Walk", { sort_order: 0, log_type: "cardio", is_mandatory: false }),
  );

  return seeded;
}

/** The athlete's own weekend plan: A/B alternates, bodyweight work, an optional hold. */
function weekendPlan(ownerId: string): SeededPlan {
  const seeded = emptyPlan(ownerId, "My weekend plan", {
    is_active: false,
    start_date: localDate(addDays(startOfWeek(), -21)),
  });
  const { plan, days, exercises } = seeded;

  for (const weekday of [1, 2, 3, 4, 5]) {
    days.push(makeDay(plan.id, weekday, { title: "Rest", day_type: "rest" }));
  }

  const saturday = makeDay(plan.id, 6, { title: "Full body A", day_type: "fullbody" });
  const sunday = makeDay(plan.id, 7, { title: "Easy miles", day_type: "run" });
  days.push(saturday, sunday);

  exercises.push(
    // Same slot, pick whichever machine is free.
    makeExercise(saturday.id, "Barbell row", {
      sort_order: 0,
      alternate_group_id: "row",
      alternate_label: "A",
      target_sets: 3,
      target_reps: 10,
      target_weight_kg: 45,
    }),
    makeExercise(saturday.id, "Seated cable row", {
      sort_order: 1,
      alternate_group_id: "row",
      alternate_label: "B",
      target_sets: 3,
      target_reps: 12,
      target_weight_kg: 45,
    }),
    makeExercise(saturday.id, "Push-ups", {
      sort_order: 2,
      log_type: "bodyweight",
      target_sets: 3,
      target_reps: 15,
      rep_scheme: "3 × max clean reps",
    }),
    makeExercise(saturday.id, "Plank", {
      sort_order: 3,
      log_type: "timed",
      target_sets: 2,
      is_mandatory: false,
      rep_scheme: "2 × 45 sec",
    }),
    makeExercise(sunday.id, "Jog", { sort_order: 0, log_type: "cardio", rep_scheme: "5 km easy" }),
  );

  return seeded;
}

function seedWeightFor(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("squat") || n.includes("leg press")) return 70;
  if (n.includes("deadlift")) return 80;
  if (n.includes("bench")) return 55;
  if (n.includes("pulldown") || n.includes("row")) return 45;
  if (n.includes("curl") || n.includes("raise") || n.includes("pushdown")) return 12;
  if (n.includes("press")) return 30;
  return 20;
}

interface HistoryOptions {
  /** The athlete's own start date for the plan — decides which program week applies. */
  planStart?: string;
  /** How far back to start, in days. */
  from?: number;
  /** Stop this many days before today — leaves a gap for "quiet for N days". */
  until?: number;
  /** Skip every Nth day so missed sessions and makeups look real. */
  skipEvery?: number;
  loadStepKg?: number;
}

/** Believable history against a plan: progressive loads, the odd missed day. */
function seedHistory(
  athleteId: string,
  bundle: SeededPlan,
  { planStart, from = 27, until = 1, skipEvery = 9, loadStepKg = 2.5 }: HistoryOptions = {},
): { sessions: Session[]; logs: SetLog[] } {
  const sessions: Session[] = [];
  const logs: SetLog[] = [];
  const today = new Date();

  for (let back = from; back >= until; back -= 1) {
    const date = addDays(today, -back);
    // Multi-week plans cycle, and a cycle plan counts off its own start: log
    // against whichever day actually applied for this athlete (their
    // assignment start, not always the plan's).
    const day = dayForDate(bundle, date, planStart);
    if (!day || day.day_type === "rest") continue;
    if (skipEvery > 0 && back % skipEvery === 0) continue;

    const daySegments = bundle.segments.filter((s) => s.plan_day_id === day.id);
    const segment = daySegments[0] ?? null;
    const dayExercises = bundle.exercises.filter(
      (e) =>
        e.plan_day_id === day.id &&
        (segment ? e.plan_segment_id === segment.id : !e.plan_segment_id) &&
        !e.alternate_group_id.length,
    );
    // A/B slots: log whichever option is the A choice.
    const alternates = bundle.exercises.filter(
      (e) =>
        e.plan_day_id === day.id &&
        e.alternate_group_id.length > 0 &&
        (e.alternate_label || "A") === "A",
    );
    const logged = [...dayExercises, ...alternates];
    if (logged.length === 0) continue;

    const start = new Date(date);
    start.setHours(18, 0, 0, 0);
    const end = new Date(date);
    end.setHours(19, 5, 0, 0);

    const session = makeSession(athleteId, {
      day_title: day.title,
      day_type: day.day_type,
      plan_id: bundle.plan.id,
      plan_day_id: day.id,
      plan_segment_id: segment?.id ?? null,
      date: localDate(date),
      status: "complete",
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      counts_as_gym: day.day_type !== "run",
      xp_awarded: 85,
      completed_names: logged.map((e) => e.name),
      timer_segments: [{ started_at: start.toISOString(), ended_at: end.toISOString(), paused_seconds: 0 }],
      // One older session was written up days later.
      is_late_completion: back === 12,
      athlete_notes: back === 5 ? "Gym was packed — swapped the order around." : "",
    });
    sessions.push(session);

    const weeksAgo = Math.floor(back / 7);
    for (const exercise of logged) {
      const base = exercise.target_weight_kg || seedWeightFor(exercise.name);
      for (let setIndex = 1; setIndex <= Math.max(1, exercise.target_sets); setIndex += 1) {
        const extra: Record<string, string | number> = {};
        for (const field of exercise.custom_fields) {
          extra[field.key] =
            field.type === "number" ? 2 + (back % 4) : ["2:05", "2:02", "1:58"][back % 3];
        }

        if (exercise.log_type === "cardio") {
          logs.push(
            makeSet(session.id, exercise.name, setIndex, {
              distance_km: Math.round((3 + (back % 5) * 0.4) * 10) / 10,
              duration_sec: 1800 + (back % 5) * 120,
              completed_at: session.started_at,
              extra,
            }),
          );
        } else if (exercise.log_type === "timed") {
          logs.push(
            makeSet(session.id, exercise.name, setIndex, {
              duration_sec: 35 + (3 - weeksAgo) * 3,
              completed_at: session.started_at,
              extra,
            }),
          );
        } else if (exercise.log_type === "interval") {
          logs.push(
            makeSet(session.id, exercise.name, setIndex, {
              reps: 6,
              duration_sec: 60,
              completed_at: session.started_at,
              extra,
            }),
          );
        } else if (exercise.log_type === "bodyweight") {
          logs.push(
            makeSet(session.id, exercise.name, setIndex, {
              reps: Math.max(8, 12 + (3 - weeksAgo) - (setIndex - 1)),
              completed_at: session.started_at,
              extra,
            }),
          );
        } else {
          logs.push(
            makeSet(session.id, exercise.name, setIndex, {
              weight_kg: Math.max(0, base + (3 - weeksAgo) * loadStepKg),
              reps: Math.max(6, exercise.target_reps - (setIndex - 1)),
              rpe: 7 + (setIndex % 2),
              completed_at: session.started_at,
              extra,
            }),
          );
        }
      }
    }
  }

  return { sessions, logs };
}

/** A session with no plan behind it — the "Extra work" flow. */
function extraWorkSession(
  athleteId: string,
  daysAgo: number,
  extras: ExtraExercise[],
  setsFor: (extra: ExtraExercise) => Partial<SetLog>[],
  patch: Partial<Session> = {},
): { session: Session; logs: SetLog[] } {
  const date = addDays(new Date(), -daysAgo);
  const start = new Date(date);
  start.setHours(7, 30, 0, 0);

  const session = makeSession(athleteId, {
    day_title: "Extra work",
    day_type: "custom",
    date: localDate(date),
    status: "complete",
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + 40 * 60000).toISOString(),
    xp_awarded: 45,
    extra_exercises: extras,
    completed_names: extras.map((e) => e.name),
    is_late_completion: daysAgo > 2,
    ...patch,
  });

  const logs = extras.flatMap((extra) =>
    setsFor(extra).map((patchSet, index) =>
      makeSet(session.id, extra.name, index + 1, { completed_at: session.started_at, ...patchSet }),
    ),
  );

  return { session, logs };
}

function buildSeed(): DemoStore {
  const users: DemoUser[] = DEMO_ACCOUNTS.map((account) => ({
    id: newId(),
    email: account.email,
    password: account.password,
  }));
  const [athleteUser, coachUser, secondUser] = users;

  const athlete = makeProfile(athleteUser.id, "athlete", DEMO_ACCOUNTS[0].name);
  const coach = makeProfile(coachUser.id, "coach", DEMO_ACCOUNTS[1].name);
  // The coach trains too: their own athlete profile powers "My training".
  const coachAthlete = makeProfile(coachUser.id, "athlete", DEMO_ACCOUNTS[1].name);
  const second = makeProfile(secondUser.id, "athlete", DEMO_ACCOUNTS[2].name);

  athlete.total_xp = 1840;
  athlete.level = 5;
  athlete.weekly_gym_goal = 4;
  coachAthlete.total_xp = 640;
  coachAthlete.level = 3;
  second.total_xp = 320;
  second.level = 2;
  second.weekly_gym_goal = 3;

  const link = (trainerId: string, athleteId: string | null, patch: Partial<CoachLink> = {}): CoachLink => ({
    id: newId(),
    trainer_id: trainerId,
    athlete_id: athleteId,
    invite_code: null,
    status: "active",
    is_self_link: false,
    expires_at: null,
    claimed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    ...patch,
  });

  const alexLink = link(coach.id, athlete.id);
  const selfLink = link(coach.id, coachAthlete.id, { is_self_link: true });
  const secondLink = link(coach.id, second.id, {
    claimed_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  });
  const pendingInvite = link(coach.id, null, {
    status: "pending",
    invite_code: "TRY-DMO",
    claimed_at: null,
    expires_at: new Date(Date.now() + 25 * 60000).toISOString(),
  });

  // ---- plans ----
  const mainPlan = withWeeks(planFromStarter(coach.id, "Hypertrophy block A"), 4);
  const conditioning = conditioningPlan(coach.id);
  const ownPlan = weekendPlan(athlete.id);
  const coachOwnPlan = planFromStarter(coachAthlete.id, "Coach's own training", {
    start_date: localDate(addDays(startOfWeek(), -21)),
  });

  const mainStart = localDate(addDays(startOfWeek(), -28));
  const secondStart = localDate(addDays(startOfWeek(), -14));

  const assignments: PlanAssignment[] = [
    {
      id: newId(),
      plan_id: mainPlan.plan.id,
      athlete_id: athlete.id,
      end_date: null,
      start_date: mainStart,
      status: "active",
      exercise_overrides: {},
      accepted_at: new Date(Date.now() - 28 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    },
    // Sent but not synced yet — the athlete sees a Sync button.
    {
      id: newId(),
      plan_id: conditioning.plan.id,
      athlete_id: athlete.id,
      end_date: null,
      start_date: localDate(startOfWeek()),
      status: "offered",
      exercise_overrides: {},
      accepted_at: null,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: newId(),
      plan_id: mainPlan.plan.id,
      athlete_id: second.id,
      end_date: null,
      start_date: secondStart,
      status: "active",
      exercise_overrides: {},
      accepted_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ];

  // ---- training history ----
  const mainHistory = seedHistory(athlete.id, mainPlan, { from: 27, until: 1, planStart: mainStart });
  // The athlete's own plan gets weekend sessions, so Progress has two scopes.
  const ownHistory = seedHistory(athlete.id, ownPlan, { from: 20, until: 1, skipEvery: 0 });
  const coachHistory = seedHistory(coachAthlete.id, coachOwnPlan, { from: 21, until: 1, skipEvery: 7 });
  // Priya trains less and has been quiet for a week — the coach should see it.
  const secondHistory = seedHistory(second.id, mainPlan, {
    from: 13,
    until: 7,
    skipEvery: 4,
    planStart: secondStart,
  });

  const sledPush: ExtraExercise = {
    name: "Sled push",
    log_type: "custom",
    category: "legs",
    target_sets: 4,
    custom_fields: [
      { key: "distance", label: "Distance", type: "number", unit: "m" },
      { key: "sled_load", label: "Sled load", type: "number", unit: "kg" },
    ],
  };
  const swim: ExtraExercise = { name: "Swim", log_type: "cardio", category: "cardio", target_sets: 1 };
  const treadmill: ExtraExercise = {
    name: "Treadmill intervals",
    log_type: "interval",
    category: "cardio",
    target_sets: 6,
    custom_fields: [{ key: "incline", label: "Incline", type: "number", unit: "%" }],
  };
  const yoga: ExtraExercise = { name: "Yoga", log_type: "timed", category: "core", target_sets: 1 };
  const pullUps: ExtraExercise = {
    name: "Pull-ups",
    log_type: "bodyweight",
    category: "pull",
    target_sets: 3,
    target_reps: 8,
  };

  const extraToday = extraWorkSession(athlete.id, 2, [sledPush, swim], (extra) =>
    extra.name === "Sled push"
      ? [
          { extra: { distance: 20, sled_load: 60 } },
          { extra: { distance: 20, sled_load: 70 } },
          { extra: { distance: 20, sled_load: 80 } },
        ]
      : [{ distance_km: 1.2, duration_sec: 1800 }],
  );
  // Intervals with a custom field, logged twice so the trend has something to say.
  const extraIntervals = [6, 3].map((daysAgo, i) =>
    extraWorkSession(athlete.id, daysAgo, [treadmill], () =>
      Array.from({ length: 6 }, () => ({
        reps: 6,
        duration_sec: 60,
        extra: { incline: 4 + i },
      })),
    ),
  );
  const extraBackfilled = extraWorkSession(athlete.id, 9, [yoga], () => [{ duration_sec: 2700 }]);
  const extraPrivate = extraWorkSession(
    athlete.id,
    5,
    [pullUps],
    () => [{ reps: 9 }, { reps: 8 }, { reps: 6 }],
    { shared_with_coach: false, day_title: "Extra work (private)" },
  );

  // ---- library ----
  const presets: ExercisePreset[] = [
    makePreset(athlete.id, "Sled push", {
      log_type: "custom",
      category: "legs",
      target_sets: 4,
      custom_fields: sledPush.custom_fields ?? [],
      notes: "Turf lane, add 10 kg each round.",
      is_favorite: true,
    }),
    makePreset(athlete.id, "Pull-ups", { log_type: "bodyweight", category: "pull", target_reps: 8 }),
    makePreset(athlete.id, "Plank", { log_type: "timed", category: "core", target_sets: 3 }),
    makePreset(athlete.id, "Treadmill intervals", {
      log_type: "interval",
      category: "cardio",
      target_sets: 6,
      custom_fields: [{ key: "incline", label: "Incline", type: "number", unit: "%" }],
    }),
    makePreset(athlete.id, "Flat bench press", { is_favorite: true }),
    makePreset(athlete.id, "Barbell or goblet squat"),
    makePreset(athlete.id, "Lat pulldown or pull-ups"),
    makePreset(athlete.id, "Swim", { log_type: "cardio", category: "cardio", target_sets: 1 }),
  ];

  // ---- coaching board ----
  const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  const messages: Message[] = [
    {
      id: newId(),
      coach_link_id: alexLink.id,
      sender_profile_id: coach.id,
      body: "Welcome aboard! Hypertrophy block A is in your Plans tab — hit Sync and it drives your Home screen.",
      created_at: days(28),
      read_at: days(28),
    },
    {
      id: newId(),
      coach_link_id: alexLink.id,
      sender_profile_id: athlete.id,
      body: "Synced. Bench felt heavy on the last set — dropped to 8 reps.",
      created_at: days(21),
      read_at: days(21),
    },
    {
      id: newId(),
      coach_link_id: alexLink.id,
      sender_profile_id: coach.id,
      body: "Perfect. Hold that load one more week, then we add 2.5 kg.",
      created_at: days(20),
      read_at: days(20),
    },
    {
      id: newId(),
      coach_link_id: alexLink.id,
      sender_profile_id: athlete.id,
      body: "Added a sled push session on Saturday, logged it under Extra work.",
      created_at: days(6),
      read_at: days(6),
    },
    {
      id: newId(),
      coach_link_id: alexLink.id,
      sender_profile_id: coach.id,
      body: "Saw it — nice. Keep the sled under 80 kg so it doesn't eat into leg day.",
      created_at: days(5),
      read_at: days(5),
    },
    {
      id: newId(),
      coach_link_id: alexLink.id,
      sender_profile_id: athlete.id,
      body: "Shoulder feels good this week. Ready for the conditioning add-on?",
      created_at: days(1),
      read_at: null,
    },
    {
      id: newId(),
      coach_link_id: secondLink.id,
      sender_profile_id: coach.id,
      body: "Checking in — anything getting in the way this week?",
      created_at: days(3),
      read_at: null,
    },
  ];

  const checkIns: CheckIn[] = [
    makeCheckIn(alexLink.id, 1, {
      weight_kg: 80.1,
      sleep: "7h, solid",
      energy: "Good",
      appetite: "Normal",
      pain: "None",
      submitted_at: days(28),
    }),
    makeCheckIn(alexLink.id, 2, {
      weight_kg: 79.4,
      sleep: "6h, broken",
      energy: "Flat midweek",
      appetite: "Up",
      pain: "Left shoulder on press",
      submitted_at: days(21),
    }),
    makeCheckIn(alexLink.id, 3, {
      weight_kg: 78.9,
      sleep: "7.5h",
      energy: "Good",
      appetite: "Normal",
      pain: "Shoulder settled",
      submitted_at: days(14),
    }),
    makeCheckIn(alexLink.id, 4, {
      weight_kg: 78.4,
      sleep: "8h",
      energy: "Strong",
      appetite: "Normal",
      pain: "None",
      submitted_at: days(7),
    }),
    makeCheckIn(secondLink.id, 1, {
      weight_kg: 64.2,
      sleep: "6h",
      energy: "Low",
      appetite: "Low",
      pain: "Knee on squats",
      submitted_at: days(10),
    }),
  ];

  const notes: CoachNote[] = [
    makeCoachNote(alexLink.id, {
      note_date: localDate(addDays(new Date(), -20)),
      observation: "Bench top set slowed down at rep 8.",
      adjustment: "Hold 55 kg for another week before adding load.",
      reason: "Bar speed dropped before technique did.",
      next_review: localDate(addDays(new Date(), -13)),
      created_at: days(20),
    }),
    makeCoachNote(alexLink.id, {
      note_date: localDate(addDays(new Date(), -13)),
      observation: "Shoulder pain gone after the grip change.",
      adjustment: "Back to a normal bench grip, add 2.5 kg.",
      reason: "Pain was setup, not load.",
      created_at: days(13),
    }),
    makeCoachNote(alexLink.id, {
      note_date: localDate(addDays(new Date(), -4)),
      observation: "Volume is climbing week on week without extra fatigue.",
      adjustment: "Send the conditioning add-on.",
      reason: "Room for two short sessions.",
      next_review: localDate(addDays(new Date(), 10)),
      created_at: days(4),
    }),
    makeCoachNote(secondLink.id, {
      note_date: localDate(addDays(new Date(), -8)),
      observation: "Knee complaint on squats.",
      adjustment: "Swap back squat for leg press this block.",
      reason: "Keep loading the legs without the knee angle.",
      created_at: days(8),
    }),
  ];

  const bodyTracker = makeTrackerTemplate(alexLink.id, {
    title: "Body assessment",
    kind: "body_assessment",
    sort_order: 0,
    metrics: [
      { key: "weight", label: "Weight", unit: "kg" },
      { key: "waist", label: "Waist", unit: "cm" },
      { key: "chest", label: "Chest", unit: "cm" },
      { key: "arm", label: "Arm", unit: "cm" },
    ],
    column_labels: ["Start", "Week 4", "Week 8", "Week 12"],
  });

  const mobilityTracker = makeTrackerTemplate(alexLink.id, {
    title: "Mobility & pain",
    kind: "mobility_pain",
    sort_order: 1,
    column_mode: "weekly",
    metrics: [
      { key: "shoulder", label: "Shoulder pain", unit: "0-10" },
      { key: "hip_hinge", label: "Hip hinge", unit: "0-10" },
      { key: "ankle", label: "Ankle range", unit: "cm" },
    ],
    column_labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
  });

  const secondTracker = makeTrackerTemplate(secondLink.id, {
    title: "Body assessment",
    sort_order: 0,
    column_labels: ["Start", "Week 4", "Week 8", "Week 12"],
  });

  const entry = (template: TrackerTemplate, metric: string, column: number, value: string): TrackerEntry => ({
    id: newId(),
    template_id: template.id,
    coach_link_id: template.coach_link_id,
    metric_key: metric,
    column_index: column,
    value,
  });

  const entries: TrackerEntry[] = [
    entry(bodyTracker, "weight", 0, "80.1"),
    entry(bodyTracker, "weight", 1, "78.4"),
    entry(bodyTracker, "waist", 0, "86"),
    entry(bodyTracker, "waist", 1, "84"),
    entry(bodyTracker, "chest", 0, "101"),
    entry(bodyTracker, "chest", 1, "102"),
    entry(bodyTracker, "arm", 0, "35"),
    entry(bodyTracker, "arm", 1, "35.5"),
    entry(mobilityTracker, "shoulder", 0, "4"),
    entry(mobilityTracker, "shoulder", 1, "3"),
    entry(mobilityTracker, "shoulder", 2, "1"),
    entry(mobilityTracker, "hip_hinge", 0, "6"),
    entry(mobilityTracker, "hip_hinge", 1, "7"),
    entry(mobilityTracker, "hip_hinge", 2, "8"),
    entry(mobilityTracker, "ankle", 0, "9"),
    entry(mobilityTracker, "ankle", 1, "10"),
  ];

  const plans = [mainPlan, conditioning, ownPlan, coachOwnPlan];

  return {
    reactions: [],
    users,
    profiles: [athlete, coach, coachAthlete, second],
    links: [alexLink, selfLink, secondLink, pendingInvite],
    plans: plans.map((p) => p.plan),
    days: plans.flatMap((p) => p.days),
    segments: plans.flatMap((p) => p.segments),
    exercises: plans.flatMap((p) => p.exercises),
    assignments,
    sessions: [
      ...mainHistory.sessions,
      ...ownHistory.sessions,
      ...coachHistory.sessions,
      ...secondHistory.sessions,
      extraToday.session,
      extraBackfilled.session,
      extraPrivate.session,
      ...extraIntervals.map((e) => e.session),
    ],
    logs: [
      ...mainHistory.logs,
      ...ownHistory.logs,
      ...coachHistory.logs,
      ...secondHistory.logs,
      ...extraToday.logs,
      ...extraBackfilled.logs,
      ...extraPrivate.logs,
      ...extraIntervals.flatMap((e) => e.logs),
    ],
    presets,
    messages,
    checkIns,
    notes,
    templates: [bodyTracker, mobilityTracker, secondTracker],
    entries,
  };
}

// ------------------------------------------------------------------
// Store
// ------------------------------------------------------------------

let store: DemoStore | null = null;

function load(): DemoStore {
  if (store) return store;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      store = JSON.parse(raw) as DemoStore;
      return store;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  store = buildSeed();
  persist();
  return store;
}

function persist() {
  if (!store) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full / private mode — demo still works in memory */
  }
}

export function resetDemoStore() {
  store = buildSeed();
  persist();
}

let currentUserId: string | null = (() => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
})();

const listeners = new Set<(u: AuthUser | null) => void>();

function setSession(userId: string | null) {
  currentUserId = userId;
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  const user = userId ? toAuthUser(userId) : null;
  listeners.forEach((cb) => cb(user));
}

function toAuthUser(userId: string): AuthUser | null {
  const u = load().users.find((x) => x.id === userId);
  // The demo store has no mail, so nothing is ever waiting on a link.
  return u ? { id: u.id, email: u.email, emailConfirmed: true } : null;
}

function bundleFor(db: DemoStore, plan: Plan): PlanBundle {
  const days = db.days.filter((d) => d.plan_id === plan.id);
  const dayIds = new Set(days.map((d) => d.id));
  return {
    plan: clone(plan),
    days: clone(days),
    segments: clone(db.segments.filter((s) => dayIds.has(s.plan_day_id))),
    exercises: clone(db.exercises.filter((e) => dayIds.has(e.plan_day_id))),
  };
}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------

export const demoApi: Api = {
  isDemo: true,

  async currentUser() {
    return currentUserId ? toAuthUser(currentUserId) : null;
  },

  onAuthChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  async signIn(email, password): Promise<AuthResult> {
    const db = load();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) return { error: "Wrong email or password." };
    setSession(user.id);
    return {};
  },

  async signUp(email, password, role, displayName): Promise<AuthResult> {
    const db = load();
    const exists = db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (exists) return { error: "That email already has a demo account." };
    const user: DemoUser = { id: newId(), email: email.trim(), password };
    db.users.push(user);
    db.profiles.push(makeProfile(user.id, role, displayName || email.split("@")[0]));
    persist();
    setSession(user.id);
    return {};
  },

  // Email flows need a mail server; the demo store has none. Each returns the
  // shape the UI expects and says plainly that it did nothing.
  async sendMagicLink(): Promise<AuthResult> {
    return { error: "Magic links need a real account — the demo has no email." };
  },

  async resendVerification(): Promise<AuthResult> {
    return { error: "Demo accounts are already verified." };
  },

  async changeEmail(newEmail): Promise<AuthResult> {
    const db = load();
    if (!currentUserId) return { error: "Not signed in." };
    const taken = db.users.some(
      (u) => u.id !== currentUserId && u.email.toLowerCase() === newEmail.trim().toLowerCase(),
    );
    if (taken) return { error: "That email already has a demo account." };
    const user = db.users.find((u) => u.id === currentUserId);
    if (user) user.email = newEmail.trim();
    persist();
    setSession(currentUserId);
    return {};
  },

  async markEmailVerified() {
    return true;
  },

  async ensureProfile(): Promise<AuthResult> {
    return {};
  },

  async signOut() {
    setSession(null);
  },

  async myProfiles() {
    const db = load();
    if (!currentUserId) return [];
    return clone(db.profiles.filter((p) => p.user_id === currentUserId));
  },

  async enableRole(role, displayName) {
    const db = load();
    if (!currentUserId) return;
    if (db.profiles.some((p) => p.user_id === currentUserId && p.role === role)) return;
    const base = db.profiles.find((p) => p.user_id === currentUserId);
    const profile = makeProfile(currentUserId, role, displayName || base?.display_name || "");
    db.profiles.push(profile);

    // Both roles on one account are auto-linked, so "My workout" works.
    const coach = db.profiles.find((p) => p.user_id === currentUserId && p.role === "coach");
    const athlete = db.profiles.find((p) => p.user_id === currentUserId && p.role === "athlete");
    if (coach && athlete && !db.links.some((l) => l.trainer_id === coach.id && l.athlete_id === athlete.id)) {
      db.links.push({
        id: newId(),
        trainer_id: coach.id,
        athlete_id: athlete.id,
        invite_code: null,
        status: "active",
        is_self_link: true,
        expires_at: null,
        claimed_at: new Date().toISOString(),
      });
    }
    persist();
  },

  async updateProfile(id, patch) {
    const db = load();
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) return;
    Object.assign(profile, patch);
    persist();
  },

  async createInvite() {
    const db = load();
    const coach = db.profiles.find((p) => p.user_id === currentUserId && p.role === "coach");
    if (!coach) return { code: "", expiresAt: null, error: "Not a coach profile." };
    const code = `${randomChunk()}-${randomChunk()}`;
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
    db.links.push({
      id: newId(),
      trainer_id: coach.id,
      athlete_id: null,
      invite_code: code,
      status: "pending",
      is_self_link: false,
      expires_at: expiresAt,
      claimed_at: null,
    });
    persist();
    return { code, expiresAt };
  },

  async claimInvite(code) {
    const db = load();
    const athlete = db.profiles.find((p) => p.user_id === currentUserId && p.role === "athlete");
    if (!athlete) return { ok: false, error: "No athlete profile." };
    const normalized = code.trim().toUpperCase();
    const link = db.links.find(
      (l) => l.status === "pending" && (l.invite_code ?? "").toUpperCase() === normalized,
    );
    if (!link) return { ok: false, error: "That code isn't valid any more." };
    link.athlete_id = athlete.id;
    link.status = "active";
    link.claimed_at = new Date().toISOString();
    link.invite_code = null;
    persist();
    return { ok: true };
  },

  async unlink(linkId) {
    const db = load();
    db.links = db.links.filter((l) => l.id !== linkId || l.is_self_link);
    persist();
  },

  async athleteWorkspace(profile) {
    const db = load();
    const accountProfileIds = new Set(
      db.profiles.filter((p) => p.user_id === profile.user_id).map((p) => p.id),
    );
    const ownPlans = db.plans
      .filter((p) => accountProfileIds.has(p.owner_id))
      .map((p) => bundleFor(db, p));

    const assigned = db.assignments
      .filter((a) => a.athlete_id === profile.id)
      .map((assignment) => {
        const plan = db.plans.find((p) => p.id === assignment.plan_id);
        if (!plan) return null;
        const coach = db.profiles.find((p) => p.id === plan.owner_id) ?? null;
        return {
          bundle: applyAssignmentOverrides(bundleFor(db, plan), assignment),
          assignment: clone(assignment),
          coach: coach ? clone(coach) : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const sessions = db.sessions.filter((s) => s.athlete_id === profile.id);
    const sessionIds = new Set(sessions.map((s) => s.id));

    const coaches = db.links
      .filter((l) => l.athlete_id === profile.id && l.status === "active" && !l.is_self_link)
      .map((link) => {
        const coach = db.profiles.find((p) => p.id === link.trainer_id);
        return coach ? { link: clone(link), coach: clone(coach) } : null;
      })
      .filter((x): x is { link: CoachLink; coach: Profile } => Boolean(x));

    return {
      ownPlans,
      assigned,
      sessions: clone(sessions),
      logs: clone(db.logs.filter((l) => sessionIds.has(l.session_id))),
      presets: clone(db.presets.filter((p) => p.owner_id === profile.id)),
      coaches,
    };
  },

  async coachWorkspace(profile) {
    const db = load();
    const links = db.links.filter((l) => l.trainer_id === profile.id);
    const athletes = links
      .filter((l) => l.status === "active" && l.athlete_id && !l.is_self_link)
      .map((link) => {
        const athlete = db.profiles.find((p) => p.id === link.athlete_id);
        return athlete ? { link: clone(link), profile: clone(athlete) } : null;
      })
      .filter((x): x is { link: CoachLink; profile: Profile } => Boolean(x));

    const plans = db.plans.filter((p) => p.owner_id === profile.id).map((p) => bundleFor(db, p));
    const planIds = new Set(plans.map((p) => p.plan.id));

    return {
      plans,
      presets: clone(db.presets.filter((preset) => preset.owner_id === profile.id)),
      athletes,
      pendingInvites: clone(links.filter((l) => l.status === "pending")),
      assignments: clone(db.assignments.filter((a) => planIds.has(a.plan_id))),
    };
  },

  async athleteTraining(athleteId): Promise<AthleteTraining> {
    const db = load();
    const sessions = db.sessions.filter((s) => s.athlete_id === athleteId && s.shared_with_coach);
    const sessionIds = new Set(sessions.map((s) => s.id));
    const assignments = db.assignments.filter((a) => a.athlete_id === athleteId);
    const assignedPlanIds = assignments.map((a) => a.plan_id);
    const plans = db.plans
      .filter((p) => p.owner_id === athleteId || assignedPlanIds.includes(p.id))
      .map((p) => {
        const bundle = bundleFor(db, p);
        return applyAssignmentOverrides(
          bundle,
          assignments.find((assignment) => assignment.plan_id === p.id),
        );
      });
    const profile = db.profiles.find((p) => p.id === athleteId) ?? null;

    return {
      sessions: clone(sessions),
      logs: clone(db.logs.filter((l) => sessionIds.has(l.session_id))),
      plans,
      assignments: clone(assignments),
      profile: profile ? clone(profile) : null,
    };
  },

  async planLoggedSessions(planId) {
    const db = load();
    const sessions = db.sessions.filter((session) => session.plan_id === planId);
    const logged = new Set(
      db.logs.filter(setHasData).map((log) => log.session_id),
    );
    return clone(
      sessions
        .filter((session) => logged.has(session.id))
        .map((session) => {
          const assignment = db.assignments.find(
            (item) => item.plan_id === planId && item.athlete_id === session.athlete_id,
          );
          return {
            session,
            start: assignment?.start_date ?? null,
            end: assignment?.end_date ?? null,
          };
        }),
    );
  },

  async savePlan(bundle) {
    const db = load();
    const index = db.plans.findIndex((p) => p.id === bundle.plan.id);
    if (index >= 0) db.plans[index] = clone(bundle.plan);
    else db.plans.push(clone(bundle.plan));

    const keepDays = new Set(bundle.days.map((d) => d.id));
    const staleDays = db.days.filter((d) => d.plan_id === bundle.plan.id && !keepDays.has(d.id));
    const staleDayIds = new Set(staleDays.map((d) => d.id));
    db.days = db.days.filter((d) => d.plan_id !== bundle.plan.id || keepDays.has(d.id));
    db.segments = db.segments.filter((s) => !staleDayIds.has(s.plan_day_id));
    db.exercises = db.exercises.filter((e) => !staleDayIds.has(e.plan_day_id));

    for (const day of bundle.days) {
      const i = db.days.findIndex((d) => d.id === day.id);
      if (i >= 0) db.days[i] = clone(day);
      else db.days.push(clone(day));
    }

    const dayIds = new Set(bundle.days.map((d) => d.id));
    db.segments = db.segments.filter((s) => !dayIds.has(s.plan_day_id));
    db.segments.push(...clone(bundle.segments));
    db.exercises = db.exercises.filter((e) => !dayIds.has(e.plan_day_id));
    db.exercises.push(...clone(bundle.exercises));

    // Only one active plan per owner, like the iOS app.
    if (bundle.plan.is_active) {
      for (const plan of db.plans) {
        if (plan.owner_id === bundle.plan.owner_id && plan.id !== bundle.plan.id) plan.is_active = false;
      }
    }
    persist();
  },

  async deletePlan(planId) {
    const db = load();
    const dayIds = new Set(db.days.filter((d) => d.plan_id === planId).map((d) => d.id));
    db.plans = db.plans.filter((p) => p.id !== planId);
    db.days = db.days.filter((d) => d.plan_id !== planId);
    db.segments = db.segments.filter((s) => !dayIds.has(s.plan_day_id));
    db.exercises = db.exercises.filter((e) => !dayIds.has(e.plan_day_id));
    db.assignments = db.assignments.filter((a) => a.plan_id !== planId);
    persist();
  },

  async assignPlan(planId, athleteId) {
    const db = load();
    if (db.assignments.some((a) => a.plan_id === planId && a.athlete_id === athleteId)) return;
    db.assignments.push({
      id: newId(),
      plan_id: planId,
      athlete_id: athleteId,
      end_date: null,
      start_date: null,
      status: "offered",
      exercise_overrides: {},
      accepted_at: null,
      created_at: new Date().toISOString(),
    });
    persist();
  },

  async unassignPlan(assignmentId) {
    const db = load();
    db.assignments = db.assignments.filter((a) => a.id !== assignmentId);
    persist();
  },

  async setAssignmentStatus(assignmentId, status, startDate) {
    const db = load();
    const assignment = db.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    assignment.status = status;
    assignment.accepted_at = status === "active" ? new Date().toISOString() : null;
    if (startDate !== undefined) assignment.start_date = startDate;
    persist();
  },

  async setAssignmentDates(assignmentId, dates) {
    const db = load();
    const assignment = db.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    if (dates.start_date !== undefined) assignment.start_date = dates.start_date;
    if (dates.end_date !== undefined) assignment.end_date = dates.end_date;
    persist();
  },

  async setAssignmentExerciseOverrides(assignmentId, overrides) {
    const db = load();
    const assignment = db.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    assignment.exercise_overrides = clone(overrides);
    persist();
  },

  async saveSession(session) {
    const db = load();
    const index = db.sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) db.sessions[index] = clone(session);
    else db.sessions.push(clone(session));
    persist();
    return clone(session);
  },

  async deleteSession(sessionId) {
    const db = load();
    db.sessions = db.sessions.filter((s) => s.id !== sessionId);
    db.logs = db.logs.filter((l) => l.session_id !== sessionId);
    persist();
  },

  async clearExercise(sessionId, exerciseName) {
    const db = load();
    const key = exerciseName.trim().toLowerCase().replace(/\s+/g, " ");
    db.logs = db.logs.filter(
      (l) =>
        l.session_id !== sessionId ||
        l.exercise_name.trim().toLowerCase().replace(/\s+/g, " ") !== key,
    );
    const session = db.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.completed_names = session.completed_names.filter(
        (name) => name.trim().toLowerCase().replace(/\s+/g, " ") !== key,
      );
      if (session.status === "complete") {
        session.status = "in_progress";
        session.ended_at = null;
      }
    }
    persist();
  },

  async replaceSets(sessionId, exerciseName, sets) {
    const db = load();
    const key = exerciseName.trim().toLowerCase();
    db.logs = db.logs.filter(
      (l) => l.session_id !== sessionId || l.exercise_name.trim().toLowerCase() !== key,
    );
    db.logs.push(...clone(sets));
    persist();
  },

  async savePreset(preset) {
    const db = load();
    const index = db.presets.findIndex((p) => p.id === preset.id);
    if (index >= 0) db.presets[index] = clone(preset);
    else db.presets.push(clone(preset));
    persist();
  },

  async deletePreset(presetId) {
    const db = load();
    db.presets = db.presets.filter((p) => p.id !== presetId);
    persist();
  },

  async addXp(profileId, amount) {
    const db = load();
    const profile = db.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    profile.total_xp += amount;
    persist();
  },

  async coachingBoard(linkId): Promise<CoachingBoard> {
    const db = load();
    return {
      // Chat is frozen; the feed comes from sessions and check-ins instead.
      messages: [],
      reactions: clone((db.reactions ?? []).filter((r) => r.coach_link_id === linkId)),
      checkIns: clone(
        db.checkIns.filter((c) => c.coach_link_id === linkId).sort((a, b) => a.week_index - b.week_index),
      ),
      notes: clone(
        db.notes
          .filter((n) => n.coach_link_id === linkId)
          .sort((a, b) => b.note_date.localeCompare(a.note_date)),
      ),
      templates: clone(
        db.templates.filter((t) => t.coach_link_id === linkId).sort((a, b) => a.sort_order - b.sort_order),
      ),
      entries: clone(db.entries.filter((e) => e.coach_link_id === linkId)),
    };
  },

  async unreadCounts(linkIds, readerProfileId) {
    const db = load();
    const counts: Record<string, number> = {};
    for (const id of linkIds) {
      counts[id] = db.messages.filter(
        (m) => m.coach_link_id === id && !m.read_at && m.sender_profile_id !== readerProfileId,
      ).length;
    }
    return counts;
  },

  async saveReaction({ linkId, senderProfileId, sessionId, checkInId, preset }) {
    const db = load();
    db.reactions = db.reactions ?? [];
    const match = (r: ActivityReaction) =>
      r.coach_link_id === linkId &&
      r.sender_profile_id === senderProfileId &&
      (r.session_id ?? null) === (sessionId ?? null) &&
      (r.check_in_id ?? null) === (checkInId ?? null);
    const existing = db.reactions.find(match);
    if (existing) existing.preset = preset;
    else
      db.reactions.push({
        id: newId(),
        coach_link_id: linkId,
        sender_profile_id: senderProfileId,
        session_id: sessionId ?? null,
        check_in_id: checkInId ?? null,
        preset,
        created_at: new Date().toISOString(),
      });
    persist();
  },

  async removeReaction(id) {
    const db = load();
    db.reactions = (db.reactions ?? []).filter((r) => r.id !== id);
    persist();
  },

  async markThreadRead(linkId, readerProfileId) {
    const db = load();
    let changed = false;
    for (const message of db.messages) {
      if (message.coach_link_id === linkId && !message.read_at && message.sender_profile_id !== readerProfileId) {
        message.read_at = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) persist();
  },

  async saveCheckIn(checkIn) {
    const db = load();
    const index = db.checkIns.findIndex(
      (c) => c.coach_link_id === checkIn.coach_link_id && c.week_index === checkIn.week_index,
    );
    if (index >= 0) db.checkIns[index] = clone(checkIn);
    else db.checkIns.push(clone(checkIn));
    persist();
  },

  async saveCoachNote(note) {
    const db = load();
    const index = db.notes.findIndex((n) => n.id === note.id);
    if (index >= 0) db.notes[index] = clone(note);
    else db.notes.push(clone(note));
    persist();
  },

  async deleteCoachNote(noteId) {
    const db = load();
    db.notes = db.notes.filter((n) => n.id !== noteId);
    persist();
  },

  async saveTrackerTemplate(template) {
    const db = load();
    const index = db.templates.findIndex((t) => t.id === template.id);
    if (index >= 0) db.templates[index] = clone(template);
    else db.templates.push(clone(template));
    persist();
  },

  async deleteTrackerTemplate(templateId) {
    const db = load();
    db.templates = db.templates.filter((t) => t.id !== templateId);
    db.entries = db.entries.filter((e) => e.template_id !== templateId);
    persist();
  },

  async saveTrackerEntry(entry) {
    const db = load();
    const index = db.entries.findIndex(
      (e) =>
        e.template_id === entry.template_id &&
        e.metric_key === entry.metric_key &&
        e.column_index === entry.column_index,
    );
    if (index >= 0) db.entries[index] = clone(entry);
    else db.entries.push(clone(entry));
    persist();
  },
};

function randomChunk(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
