#!/usr/bin/env node
/**
 * Seeds approved demo coach + athlete accounts with a full plan and progression data.
 *
 * Requires in .env (or environment):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← Project Settings → API → service_role (never commit)
 *
 * Usage:
 *   node scripts/seed-demo.mjs
 *   npm run seed:demo
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(`
Missing Supabase credentials.

Add to .env:
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Project Settings → API → service_role secret)

Then run: npm run seed:demo
`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COACH_EMAIL = "coach.demo@antrep.test";
const ATHLETE_EMAIL = "athlete.demo@antrep.test";
const PASSWORD = "AntRepDemo2026!";

const COACH_NAME = "Aryan Satardekar";
const ATHLETE_NAME = "Rohini Punj";

/** Monday of the week containing `d`. */
function mondayOf(d) {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 7 : x.getDay();
  x.setDate(x.getDate() - (day - 1));
  return x;
}

function localDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const PLAN_NAME = "Warrior Training — 6 Week Demo";
const DURATION_WEEKS = 6;

const DAY_TEMPLATES = [
  { weekday: 1, title: "Mon (Legs)", day_type: "legs" },
  { weekday: 2, title: "Tue (Push)", day_type: "push" },
  { weekday: 3, title: "Wed (Pull)", day_type: "pull" },
  { weekday: 4, title: "Thu (Mobility)", day_type: "core" },
  { weekday: 5, title: "Fri (Cardio)", day_type: "hiit" },
  { weekday: 6, title: "Sat (Active recovery)", day_type: "run" },
  { weekday: 7, title: "Sun (Rest)", day_type: "rest" },
];

function exercisesForDay(weekday, weekIndex) {
  const bonus = (weekIndex - 1) * 2;
  switch (weekday) {
    case 1:
      return [
        { name: "Leg Extension", sort_order: 0, target_sets: 3, target_reps: 12, target_weight_kg: 15 + bonus, trainer_notes: "2s hold at top" },
        { name: "Leg Press", sort_order: 1, target_sets: 3, target_reps: 12, target_weight_kg: 30 + bonus * 2 },
        { name: "Seated Leg Curl", sort_order: 2, target_sets: 3, target_reps: 12, target_weight_kg: 25 + bonus },
        { name: "Hip Abductor", sort_order: 3, target_sets: 3, target_reps: 15, target_weight_kg: 25 + bonus },
      ];
    case 2:
      return [
        { name: "Inc Chest Press", sort_order: 0, target_sets: 3, target_reps: 10, target_weight_kg: 20 + bonus },
        { name: "Shoulder Press", sort_order: 1, target_sets: 3, target_reps: 12, target_weight_kg: 15 + bonus },
        { name: "Lateral Raise", sort_order: 2, target_sets: 3, target_reps: 15, target_weight_kg: 8 + bonus, trainer_notes: "Controlled tempo" },
        { name: "Tricep Pushdown", sort_order: 3, target_sets: 3, target_reps: 12, target_weight_kg: 20 + bonus },
      ];
    case 3:
      return [
        { name: "Lat Pulldown", sort_order: 0, target_sets: 3, target_reps: 12, target_weight_kg: 25 + bonus },
        { name: "Seated Row", sort_order: 1, target_sets: 3, target_reps: 12, target_weight_kg: 22 + bonus },
        { name: "Face Pull", sort_order: 2, target_sets: 3, target_reps: 15, target_weight_kg: 15 + bonus },
        { name: "Bicep Curl", sort_order: 3, target_sets: 3, target_reps: 12, target_weight_kg: 12 + bonus },
      ];
    case 4:
      return [
        { name: "Plank", sort_order: 0, target_sets: 3, target_reps: 1, target_weight_kg: 0, trainer_notes: "45–60 sec holds" },
        { name: "Bird Dog", sort_order: 1, target_sets: 3, target_reps: 10, target_weight_kg: 0, trainer_notes: "Each side" },
        { name: "Glute Bridge", sort_order: 2, target_sets: 3, target_reps: 15, target_weight_kg: 0, trainer_notes: "Squeeze at top" },
        { name: "Hamstring Stretch", sort_order: 3, target_sets: 2, target_reps: 1, target_weight_kg: 0, trainer_notes: "30s each leg" },
      ];
    case 5:
      return [
        { name: "Stationary Bike", sort_order: 0, target_sets: 1, target_reps: 1, target_weight_kg: 0, trainer_notes: `20–25 min, RPE ${5 + Math.min(weekIndex, 3)}` },
        { name: "Cable Crunch", sort_order: 1, target_sets: 3, target_reps: 15, target_weight_kg: 20 + bonus },
        { name: "Dead Bug", sort_order: 2, target_sets: 3, target_reps: 12, target_weight_kg: 0 },
      ];
    case 6:
      return [
        { name: "Walking", sort_order: 0, target_sets: 1, target_reps: 1, target_weight_kg: 0, trainer_notes: "30 min easy pace" },
        { name: "Light Cycling", sort_order: 1, target_sets: 1, target_reps: 1, target_weight_kg: 0, trainer_notes: "15 min optional" },
      ];
    default:
      return [];
  }
}

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function getOrCreateUser(email, password) {
  let user = await findUserByEmail(email);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    return user;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function upsertProfile(userId, role, displayName) {
  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("profiles")
      .update({ display_name: displayName, approved_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("profiles")
    .insert({
      user_id: userId,
      role,
      display_name: displayName,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getOrCreateLink(coachId, athleteId) {
  const { data: existing } = await admin
    .from("coach_links")
    .select("*")
    .eq("trainer_id", coachId)
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "active") {
      await admin.from("coach_links").update({ status: "active" }).eq("id", existing.id);
    }
    return existing;
  }

  const { data, error } = await admin
    .from("coach_links")
    .insert({
      trainer_id: coachId,
      athlete_id: athleteId,
      invite_code_hash: "demo-seed-link",
      status: "active",
      claimed_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  console.log("AntRep demo seed — creating coach, athlete, plan & progression data…\n");

  const coachUser = await getOrCreateUser(COACH_EMAIL, PASSWORD);
  const athleteUser = await getOrCreateUser(ATHLETE_EMAIL, PASSWORD);
  console.log("✓ Auth users");

  const coachProfile = await upsertProfile(coachUser.id, "coach", COACH_NAME);
  const athleteProfile = await upsertProfile(athleteUser.id, "athlete", ATHLETE_NAME);
  console.log("✓ Approved profiles");

  const link = await getOrCreateLink(coachProfile.id, athleteProfile.id);
  console.log("✓ Coach–athlete link");

  // Program starts 2 weeks ago — athlete is in week 3 of a 6-week plan
  const programStart = mondayOf(addDays(new Date(), -14));
  const startDate = localDateString(programStart);
  const durationWeeks = DURATION_WEEKS;

  // Plan — find by new name or legacy name
  const { data: existingPlans } = await admin
    .from("plans")
    .select("id, name")
    .eq("trainer_id", coachProfile.id)
    .in("name", [PLAN_NAME, "Warrior Training — Demo"])
    .limit(1);

  let planId = existingPlans?.[0]?.id;
  if (!planId) {
    const { data: plan, error } = await admin
      .from("plans")
      .insert({
        trainer_id: coachProfile.id,
        name: PLAN_NAME,
        is_active: true,
        start_date: startDate,
        weeks: durationWeeks,
      })
      .select()
      .single();
    if (error) throw error;
    planId = plan.id;
  } else {
    await admin
      .from("plans")
      .update({ name: PLAN_NAME, start_date: startDate, weeks: durationWeeks, is_active: true })
      .eq("id", planId);
  }
  console.log("✓ Plan");

  // Assignment
  await admin
    .from("plan_assignments")
    .upsert(
      { plan_id: planId, athlete_id: athleteProfile.id, start_date: startDate },
      { onConflict: "plan_id,athlete_id" },
    )
    .select()
    .single();

  // Rebuild full 6-week plan (Mon–Sun × 6 weeks)
  const { data: oldDays } = await admin.from("plan_days").select("id").eq("plan_id", planId);
  if (oldDays?.length) {
    await admin.from("plan_exercises").delete().in("plan_day_id", oldDays.map((d) => d.id));
    await admin.from("plan_days").delete().eq("plan_id", planId);
  }

  let legDayId;
  for (let week = 1; week <= durationWeeks; week++) {
    for (const tmpl of DAY_TEMPLATES) {
      const { data: dayRow, error: dayErr } = await admin
        .from("plan_days")
        .insert({
          plan_id: planId,
          week_index: week,
          weekday: tmpl.weekday,
          title: tmpl.title,
          day_type: tmpl.day_type,
          sort_order: tmpl.weekday - 1,
        })
        .select()
        .single();
      if (dayErr) throw dayErr;
      if (week === 1 && tmpl.weekday === 1) legDayId = dayRow.id;

      const exercises = exercisesForDay(tmpl.weekday, week);
      if (exercises.length) {
        const { error: exErr } = await admin.from("plan_exercises").insert(
          exercises.map((ex) => ({ plan_day_id: dayRow.id, ...ex })),
        );
        if (exErr) throw exErr;
      }
    }
  }
  console.log(`✓ ${durationWeeks}-week plan (${durationWeeks * 7} days with exercises)`);

  // Athlete program
  await admin.from("athlete_programs").upsert(
    {
      coach_link_id: link.id,
      goals: "Joint strength, cardio, flexibility — 6 week block",
      duration_weeks: durationWeeks,
      start_date: startDate,
      assessment_date: startDate,
      progression_metric: "max_weight",
      progression_overrides: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "coach_link_id" },
  );

  // Progression exercises
  const progExercises = ["Leg Press", "Leg Extension", "Seated Leg Curl", "Inc Chest Press", "Lat Pulldown", "Seated Row"];
  for (const [i, name] of progExercises.entries()) {
    await admin.from("progression_exercises").upsert(
      { coach_link_id: link.id, exercise_name: name, sort_order: i },
      { onConflict: "coach_link_id,exercise_name" },
    );
  }
  console.log("✓ Program & progression exercises");

  // Clear old demo sessions for idempotent re-runs
  const { data: oldSessions } = await admin
    .from("sessions")
    .select("id")
    .eq("athlete_id", athleteProfile.id)
    .gte("date", startDate);
  if (oldSessions?.length) {
    await admin.from("sessions").delete().in("id", oldSessions.map((s) => s.id));
  }

  // Simulated leg sessions — weeks 1–4, increasing weights
  const legProgression = [
    { week: 1, legPress: 30, legExt: 15, legCurl: 25 },
    { week: 2, legPress: 35, legExt: 17, legCurl: 28 },
    { week: 3, legPress: 40, legExt: 20, legCurl: 30 },
    { week: 4, legPress: 42, legExt: 22, legCurl: 32 },
  ];

  const { data: planExercises } = await admin
    .from("plan_exercises")
    .select("id, name")
    .eq("plan_day_id", legDayId);

  const exByName = new Map((planExercises ?? []).map((e) => [e.name, e.id]));

  for (const w of legProgression) {
    const sessionDate = localDateString(addDays(programStart, (w.week - 1) * 7));
    const started = new Date(`${sessionDate}T10:00:00`).toISOString();
    const ended = new Date(`${sessionDate}T11:15:00`).toISOString();

    const { data: session, error: sErr } = await admin
      .from("sessions")
      .insert({
        athlete_id: athleteProfile.id,
        plan_day_id: legDayId,
        day_title: "Mon (Legs)",
        date: sessionDate,
        status: "complete",
        started_at: started,
        ended_at: ended,
        athlete_notes: w.week === 2 ? "Knee felt better today, slight stiffness on extensions." : "",
        calories: 280 + w.week * 15,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    const sets = [
      { name: "Leg Press", weight: w.legPress, reps: 12, pain: w.week === 1 ? 4 : 2 },
      { name: "Leg Extension", weight: w.legExt, reps: 12, pain: w.week === 1 ? 5 : 3 },
      { name: "Seated Leg Curl", weight: w.legCurl, reps: 12, pain: 2 },
      { name: "Hip Abductor", weight: 25 + w.week, reps: 15, pain: 0 },
    ];

    for (const ex of sets) {
      for (let setIndex = 1; setIndex <= 3; setIndex++) {
        await admin.from("set_logs").insert({
          session_id: session.id,
          plan_exercise_id: exByName.get(ex.name) ?? null,
          exercise_name: ex.name,
          set_index: setIndex,
          weight_kg: ex.weight,
          reps: ex.reps - (setIndex - 1),
          rpe: 6 + setIndex,
          pain: ex.pain > 0 ? ex.pain : null,
          note: setIndex === 3 && ex.pain > 3 ? "Felt it in knee" : "",
        });
      }
    }
  }
  console.log("✓ 4 weeks of leg sessions + set logs");

  // Check-ins
  await admin.from("check_ins").delete().eq("coach_link_id", link.id);
  const checkIns = [
    { week: 1, weight: 68.5, sleep: "6h, restless", energy: "Low", appetite: "Normal", pain: "Knee 5/10" },
    { week: 2, weight: 68.2, sleep: "7h", energy: "Moderate", appetite: "Good", pain: "Knee 4/10" },
    { week: 3, weight: 67.8, sleep: "7.5h", energy: "Good", appetite: "Normal", pain: "Knee 3/10" },
    { week: 4, weight: 67.5, sleep: "8h", energy: "High", appetite: "Good", pain: "Knee 2/10" },
  ];
  for (const c of checkIns) {
    await admin.from("check_ins").insert({
      coach_link_id: link.id,
      week_index: c.week,
      weight_kg: c.weight,
      sleep: c.sleep,
      energy: c.energy,
      appetite: c.appetite,
      pain: c.pain,
    });
  }
  console.log("✓ Weekly check-ins");

  // Coach notes
  await admin.from("coach_notes").delete().eq("coach_link_id", link.id);
  await admin.from("coach_notes").insert([
    {
      coach_link_id: link.id,
      note_date: localDateString(addDays(programStart, 0)),
      observation: "Initial assessment — knee discomfort on extension, good mobility otherwise.",
      adjustment: "Start conservative on leg extension weight, focus on tempo.",
      reason: "Arthritis in knee — gradual loading protocol.",
      next_review: localDateString(addDays(programStart, 14)),
    },
    {
      coach_link_id: link.id,
      note_date: localDateString(addDays(programStart, 21)),
      observation: "Pain scores improving week over week. Leg press progressing well.",
      adjustment: "Increase leg press 5 kg next week. Keep extension weight steady.",
      reason: "Progressive overload on compound before isolation.",
      next_review: localDateString(addDays(programStart, 35)),
    },
  ]);
  console.log("✓ Coach notes");

  // Messages
  await admin.from("messages").delete().eq("coach_link_id", link.id);
  const msgBase = addDays(programStart, 3);
  const thread = [
    { from: "coach", body: "Great first session! How did your knee feel afterwards?", offset: 0 },
    { from: "athlete", body: "A bit stiff but manageable. Ice helped.", offset: 1 },
    { from: "coach", body: "Good — keep logging pain scores so we can track it.", offset: 2 },
    { from: "athlete", body: "Will do! Check-in submitted for week 2.", offset: 7 },
  ];
  for (const m of thread) {
    const at = addDays(msgBase, m.offset);
    at.setHours(14, 30, 0, 0);
    await admin.from("messages").insert({
      coach_link_id: link.id,
      sender_profile_id: m.from === "coach" ? coachProfile.id : athleteProfile.id,
      body: m.body,
      created_at: at.toISOString(),
      read_at: m.from === "coach" ? at.toISOString() : null,
    });
  }
  console.log("✓ Message thread");

  await admin.from("coach_settings").upsert({
    trainer_id: coachProfile.id,
    custom_fields: [],
    export_columns: [],
    updated_at: new Date().toISOString(),
  });

  console.log(`
══════════════════════════════════════════════════════════
  Demo accounts ready — sign in to test progression features
══════════════════════════════════════════════════════════

  COACH (https://your-app/coach or /coach)
    Email:    ${COACH_EMAIL}
    Password: ${PASSWORD}

  ATHLETE (https://your-app/)
    Email:    ${ATHLETE_EMAIL}
    Password: ${PASSWORD}

  Plan:     ${PLAN_NAME} (${durationWeeks} weeks, started ${startDate})
  Data:     ${durationWeeks * 7} plan days, 4 weeks leg sessions, check-ins, notes, messages

  Coach → Plans / Athletes → Rohini Punj → Program
  Athlete → Program tab (Schedule + Plan)
══════════════════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  if (err.message?.includes("athlete_programs") || err.code === "42P01") {
    console.error("\nTip: Run supabase/migrations/001_progression_hub.sql in SQL Editor first.");
  }
  process.exit(1);
});
