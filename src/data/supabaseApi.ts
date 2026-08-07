/**
 * Supabase backend. Every table is protected by Row-Level Security, so these
 * queries only ever see rows the signed-in user is allowed to touch.
 */

import { supabase } from "../lib/supabase";
import { localDate, startOfWeek } from "../domain/dates";
import type { Api, AthleteTraining, AthleteWorkspace, AuthResult, CoachWorkspace } from "./api";
import type {
  CheckIn,
  CoachingBoard,
  CoachLink,
  CoachNote,
  DayType,
  ExercisePreset,
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

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T extends object>(v: unknown): T => (v && typeof v === "object" ? (v as T) : ({} as T));

/**
 * Turn an auth error into something a person can act on.
 *
 * supabase-js falls back to `JSON.stringify(body)` when GoTrue answers with no
 * message, so a failed send surfaces as the literal string "{}". That tells the
 * user nothing, and it always means the server broke rather than the input did
 * — nearly always the SMTP send. Say that, and put the real error in the
 * console for whoever is debugging.
 */
function authError(error: { message?: string; status?: number } | null, action: string): string {
  console.error(`[auth] ${action} failed`, error);
  const message = (error?.message ?? "").trim();

  if (!message || message === "{}" || message === "null") {
    return `Couldn't ${action}. The server accepted the request but the email didn't go out — check SMTP settings and the Auth logs in Supabase.`;
  }
  if (/rate|too many|429/i.test(message)) {
    return "Too many emails just went out from this project. Wait a few minutes and try again.";
  }
  if (/redirect|not allowed|invalid.*url/i.test(message)) {
    return "The link's return address isn't on Supabase's allow-list. Add this site under Authentication → URL Configuration.";
  }
  return message;
}

// ---------- row normalizers (rows predating the migration keep working) ----------

function toProfile(r: Row): Profile {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    role: str(r.role, "athlete") as Role,
    display_name: str(r.display_name),
    avatar: obj(r.avatar),
    approved_at: (r.approved_at as string) ?? null,
    requires_email_verification: Boolean(r.requires_email_verification ?? false),
    created_at: (r.created_at as string) ?? undefined,
    total_xp: num(r.total_xp),
    level: num(r.level, 1),
    current_streak: num(r.current_streak),
    best_streak: num(r.best_streak),
    last_active_date: (r.last_active_date as string) ?? null,
    weekly_gym_goal: num(r.weekly_gym_goal, 3),
    weekly_km_goal: num(r.weekly_km_goal),
    daily_calorie_goal: num(r.daily_calorie_goal, 2000),
    settings: obj(r.settings),
  };
}

function toPlan(r: Row): Plan {
  const owner = str(r.owner_id) || str(r.trainer_id);
  return {
    id: str(r.id),
    owner_id: owner,
    trainer_id: str(r.trainer_id) || owner,
    name: str(r.name, "Training plan"),
    is_active: bool(r.is_active, true),
    is_archived: bool(r.is_archived),
    start_date: str(r.start_date, localDate()),
    weeks: num(r.weeks, 1),
    icon_name: str(r.icon_name),
    color_hex: str(r.color_hex),
    notes: str(r.notes),
  };
}

function toDay(r: Row): PlanDay {
  return {
    id: str(r.id),
    plan_id: str(r.plan_id),
    week_index: num(r.week_index, 1),
    weekday: num(r.weekday, 1),
    title: str(r.title),
    day_type: str(r.day_type, "rest") as DayType,
    custom_type_label: str(r.custom_type_label),
    icon_name: str(r.icon_name),
    color_hex: str(r.color_hex),
    is_optional: bool(r.is_optional),
    counts_as_gym: typeof r.counts_as_gym === "boolean" ? r.counts_as_gym : null,
    run_modality: str(r.run_modality, "walk") as PlanDay["run_modality"],
    sort_order: num(r.sort_order),
  };
}

function toSegment(r: Row): PlanSegment {
  return {
    id: str(r.id),
    plan_day_id: str(r.plan_day_id),
    title: str(r.title),
    day_type: str(r.day_type, "fullbody") as DayType,
    custom_type_label: str(r.custom_type_label),
    sort_order: num(r.sort_order),
    icon_name: str(r.icon_name),
    color_hex: str(r.color_hex),
    run_modality: str(r.run_modality, "walk") as PlanSegment["run_modality"],
    counts_as_gym: typeof r.counts_as_gym === "boolean" ? r.counts_as_gym : null,
  };
}

function toExercise(r: Row): PlanExercise {
  return {
    id: str(r.id),
    plan_day_id: str(r.plan_day_id),
    plan_segment_id: (r.plan_segment_id as string) ?? null,
    name: str(r.name),
    sort_order: num(r.sort_order),
    log_type: str(r.log_type, "strength") as PlanExercise["log_type"],
    target_sets: num(r.target_sets, 3),
    target_reps: num(r.target_reps, 10),
    target_weight_kg: num(r.target_weight_kg),
    rest_sec: num(r.rest_sec, 90),
    trainer_notes: str(r.trainer_notes),
    instructions: str(r.instructions),
    is_mandatory: bool(r.is_mandatory, true),
    rep_scheme: str(r.rep_scheme),
    alternate_group_id: str(r.alternate_group_id),
    alternate_label: str(r.alternate_label),
    priority: num(r.priority, 1),
    category: str(r.category, "push") as PlanExercise["category"],
    tempo: str(r.tempo),
    rpe_target: num(r.rpe_target),
    repeat_rule: str(r.repeat_rule, "weekly") as PlanExercise["repeat_rule"],
    scheduled_date: (r.scheduled_date as string) ?? null,
    icon_name: str(r.icon_name),
    color_hex: str(r.color_hex),
    custom_fields: arr(r.custom_fields),
  };
}

function toSession(r: Row): Session {
  return {
    id: str(r.id),
    athlete_id: str(r.athlete_id),
    plan_id: (r.plan_id as string) ?? null,
    plan_day_id: (r.plan_day_id as string) ?? null,
    plan_segment_id: (r.plan_segment_id as string) ?? null,
    day_title: str(r.day_title),
    day_type: str(r.day_type, "fullbody") as DayType,
    date: str(r.date, localDate()),
    status: str(r.status, "in_progress") as Session["status"],
    started_at: str(r.started_at, new Date().toISOString()),
    ended_at: (r.ended_at as string) ?? null,
    athlete_notes: str(r.athlete_notes),
    calories: numOrNull(r.calories),
    counts_as_gym: bool(r.counts_as_gym, true),
    xp_awarded: num(r.xp_awarded),
    timer_segments: arr(r.timer_segments),
    completed_names: arr(r.completed_names),
    extra_exercises: arr(r.extra_exercises),
    shared_with_coach: bool(r.shared_with_coach, true),
    is_late_completion: bool(r.is_late_completion),
  };
}

function toMessage(r: Row): Message {
  return {
    id: str(r.id),
    coach_link_id: str(r.coach_link_id),
    sender_profile_id: str(r.sender_profile_id),
    body: str(r.body),
    created_at: str(r.created_at),
    read_at: (r.read_at as string) ?? null,
  };
}

function toCheckIn(r: Row): CheckIn {
  return {
    id: str(r.id),
    coach_link_id: str(r.coach_link_id),
    week_index: num(r.week_index, 1),
    weight_kg: numOrNull(r.weight_kg),
    sleep: str(r.sleep),
    energy: str(r.energy),
    appetite: str(r.appetite),
    pain: str(r.pain),
    submitted_at: str(r.submitted_at),
  };
}

function toCoachNote(r: Row): CoachNote {
  return {
    id: str(r.id),
    coach_link_id: str(r.coach_link_id),
    note_date: str(r.note_date),
    observation: str(r.observation),
    adjustment: str(r.adjustment),
    reason: str(r.reason),
    next_review: (r.next_review as string) ?? null,
    created_at: str(r.created_at),
  };
}

function toTemplate(r: Row): TrackerTemplate {
  return {
    id: str(r.id),
    coach_link_id: str(r.coach_link_id),
    kind: str(r.kind, "body_assessment") as TrackerTemplate["kind"],
    title: str(r.title),
    metrics: arr(r.metrics),
    column_labels: arr(r.column_labels),
    column_mode: str(r.column_mode, "weekly") as TrackerTemplate["column_mode"],
    sort_order: num(r.sort_order),
    is_active: bool(r.is_active, true),
  };
}

function toEntry(r: Row): TrackerEntry {
  return {
    id: str(r.id),
    template_id: str(r.template_id),
    coach_link_id: str(r.coach_link_id),
    metric_key: str(r.metric_key),
    column_index: num(r.column_index),
    value: str(r.value),
  };
}

function toSetLog(r: Row): SetLog {
  return {
    id: str(r.id),
    session_id: str(r.session_id),
    plan_exercise_id: (r.plan_exercise_id as string) ?? null,
    exercise_name: str(r.exercise_name),
    set_index: num(r.set_index, 1),
    weight_kg: numOrNull(r.weight_kg),
    reps: numOrNull(r.reps),
    rpe: numOrNull(r.rpe),
    distance_km: numOrNull(r.distance_km),
    duration_sec: numOrNull(r.duration_sec),
    incline_percent: numOrNull(r.incline_percent),
    pace_sec_per_km: numOrNull(r.pace_sec_per_km),
    note: str(r.note),
    extra: obj(r.extra),
    completed_at: str(r.completed_at, new Date().toISOString()),
  };
}

function toPreset(r: Row): ExercisePreset {
  return {
    id: str(r.id),
    owner_id: str(r.owner_id),
    name: str(r.name),
    category: str(r.category, "push") as ExercisePreset["category"],
    log_type: str(r.log_type, "strength") as ExercisePreset["log_type"],
    target_sets: num(r.target_sets, 3),
    target_reps: num(r.target_reps, 10),
    target_weight_kg: num(r.target_weight_kg),
    rest_sec: num(r.rest_sec, 90),
    icon_name: str(r.icon_name),
    color_hex: str(r.color_hex),
    is_favorite: bool(r.is_favorite),
    notes: str(r.notes),
    custom_fields: arr(r.custom_fields),
  };
}

function toAssignment(r: Row): PlanAssignment {
  return {
    id: str(r.id),
    plan_id: str(r.plan_id),
    athlete_id: str(r.athlete_id),
    start_date: (r.start_date as string) ?? null,
    status: str(r.status, "active") as PlanAssignment["status"],
    accepted_at: (r.accepted_at as string) ?? null,
    created_at: (r.created_at as string) ?? undefined,
  };
}

function toLink(r: Row): CoachLink {
  return {
    id: str(r.id),
    trainer_id: str(r.trainer_id),
    athlete_id: (r.athlete_id as string) ?? null,
    invite_code: (r.invite_code as string) ?? null,
    status: str(r.status, "pending") as CoachLink["status"],
    is_self_link: bool(r.is_self_link),
    expires_at: (r.expires_at as string) ?? null,
    claimed_at: (r.claimed_at as string) ?? null,
  };
}

// ---------- loaders ----------

async function loadBundles(planIds: string[]): Promise<PlanBundle[]> {
  if (planIds.length === 0) return [];
  const [{ data: planRows }, { data: dayRows }] = await Promise.all([
    supabase.from("plans").select("*").in("id", planIds),
    supabase.from("plan_days").select("*").in("plan_id", planIds),
  ]);

  const days = (dayRows ?? []).map((r) => toDay(r as Row));
  const dayIds = days.map((d) => d.id);

  const [{ data: segmentRows }, { data: exerciseRows }] = await Promise.all([
    dayIds.length ? supabase.from("plan_segments").select("*").in("plan_day_id", dayIds) : { data: [] },
    dayIds.length ? supabase.from("plan_exercises").select("*").in("plan_day_id", dayIds) : { data: [] },
  ]);

  const segments = (segmentRows ?? []).map((r) => toSegment(r as Row));
  const exercises = (exerciseRows ?? []).map((r) => toExercise(r as Row));

  return (planRows ?? []).map((r) => {
    const plan = toPlan(r as Row);
    const planDays = days.filter((d) => d.plan_id === plan.id);
    const ids = new Set(planDays.map((d) => d.id));
    return {
      plan,
      days: planDays,
      segments: segments.filter((s) => ids.has(s.plan_day_id)),
      exercises: exercises.filter((e) => ids.has(e.plan_day_id)),
    };
  });
}

async function loadSessionsAndLogs(athleteId: string): Promise<{ sessions: Session[]; logs: SetLog[] }> {
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false });

  const sessions = (sessionRows ?? []).map((r) => toSession(r as Row));
  if (sessions.length === 0) return { sessions, logs: [] };

  const { data: logRows } = await supabase
    .from("set_logs")
    .select("*")
    .in("session_id", sessions.map((s) => s.id));

  return { sessions, logs: (logRows ?? []).map((r) => toSetLog(r as Row)) };
}

/** Upsert the rows we keep and delete the ones the editor removed. */
async function syncRows(
  table: string,
  scopeColumn: string,
  scopeIds: string[],
  rows: Row[],
): Promise<void> {
  if (rows.length > 0) {
    await supabase.from(table).upsert(rows);
  }
  if (scopeIds.length > 0) {
    const keep = rows.map((r) => String(r.id));
    let query = supabase.from(table).delete().in(scopeColumn, scopeIds);
    if (keep.length > 0) query = query.not("id", "in", `(${keep.join(",")})`);
    await query;
  }
}

export const supabaseApi: Api = {
  isDemo: false,

  async currentUser() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    return user
      ? { id: user.id, email: user.email ?? "", emailConfirmed: Boolean(user.email_confirmed_at) }
      : null;
  },

  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      cb(
        user
          ? { id: user.id, email: user.email ?? "", emailConfirmed: Boolean(user.email_confirmed_at) }
          : null,
      );
    });
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  },

  /**
   * The profile row is written on the first signed-in load, not here — with
   * email confirmation on there is no session yet at this point, so an insert
   * would be rejected by RLS. See `ensureProfile`.
   */
  async signUp(email, password, role, displayName): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${role === "coach" ? "/coach" : "/"}`,
        data: { pending_role: role, pending_name: displayName },
      },
    });
    if (error) return { error: error.message };
    if (!data.session) return { needsConfirm: true };
    return await this.ensureProfile(role, displayName);
  },

  /**
   * Create the profile for a freshly confirmed account. Safe to call on every
   * load: it does nothing when the role already exists.
   */
  async ensureProfile(role: Role, displayName: string): Promise<AuthResult> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { error: "Not signed in." };

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", role);
    if (existing && existing.length > 0) return {};

    const meta = user.user_metadata ?? {};
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      role,
      display_name: displayName || (meta.pending_name as string) || (user.email ?? "").split("@")[0],
    });
    return error ? { error: error.message } : {};
  },

  async sendMagicLink(email): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    return error ? { error: authError(error, "send that sign-in link") } : { sent: true };
  },

  async resendVerification(email): Promise<AuthResult> {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    return error ? { error: authError(error, "resend that confirmation") } : { sent: true };
  },

  async changeEmail(newEmail): Promise<AuthResult> {
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: window.location.origin + window.location.pathname },
    );
    return error ? { error: authError(error, "change your email") } : { sent: true };
  },

  async markEmailVerified() {
    const { data, error } = await supabase.rpc("mark_email_verified");
    return !error && data === true;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async myProfiles() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    const { data } = await supabase.from("profiles").select("*").eq("user_id", auth.user.id);
    return (data ?? []).map((r) => toProfile(r as Row));
  },

  async enableRole(role) {
    await supabase.rpc("enable_role", { p_role: role });
  },

  async updateProfile(id, patch) {
    await supabase.from("profiles").update(patch).eq("id", id);
  },

  async createInvite() {
    const { data, error } = await supabase.rpc("create_invite");
    if (error) return { code: "", expiresAt: null, error: error.message };
    const row = Array.isArray(data) ? (data[0] as Row) : (data as Row);
    return { code: str(row?.invite_code), expiresAt: (row?.expires_at as string) ?? null };
  },

  async claimInvite(code) {
    const { data, error } = await supabase.rpc("claim_invite", { p_code: code });
    if (error) return { ok: false, error: error.message };
    return data === true ? { ok: true } : { ok: false, error: "That code isn't valid any more." };
  },

  async unlink(linkId, role) {
    await supabase.rpc(role === "coach" ? "unlink_athlete" : "unlink_coach", { p_link_id: linkId });
  },

  async athleteWorkspace(profile): Promise<AthleteWorkspace> {
    const [{ data: ownPlanRows }, { data: assignmentRows }, { data: presetRows }, { data: linkRows }] =
      await Promise.all([
        supabase.from("plans").select("id").eq("owner_id", profile.id),
        supabase.from("plan_assignments").select("*").eq("athlete_id", profile.id),
        supabase.from("exercise_presets").select("*").eq("owner_id", profile.id),
        supabase.from("coach_links").select("*").eq("athlete_id", profile.id).eq("status", "active"),
      ]);

    const assignments = (assignmentRows ?? []).map((r) => toAssignment(r as Row));
    const ownIds = (ownPlanRows ?? []).map((r) => str((r as Row).id));
    const assignedIds = assignments.map((a) => a.plan_id).filter((id) => !ownIds.includes(id));

    const [ownBundles, assignedBundles, training] = await Promise.all([
      loadBundles(ownIds),
      loadBundles(assignedIds),
      loadSessionsAndLogs(profile.id),
    ]);

    const links = (linkRows ?? []).map((r) => toLink(r as Row)).filter((l) => !l.is_self_link);
    let coaches: { link: CoachLink; coach: Profile }[] = [];
    const ownerIds = [...new Set([...assignedBundles.map((b) => b.plan.owner_id), ...links.map((l) => l.trainer_id)])];
    if (ownerIds.length > 0) {
      const { data: coachRows } = await supabase.from("profiles").select("*").in("id", ownerIds);
      const profiles = (coachRows ?? []).map((r) => toProfile(r as Row));
      coaches = links
        .map((link) => {
          const coach = profiles.find((p) => p.id === link.trainer_id);
          return coach ? { link, coach } : null;
        })
        .filter((x): x is { link: CoachLink; coach: Profile } => Boolean(x));

      return {
        ownPlans: ownBundles,
        assigned: assignedBundles.map((bundle) => ({
          bundle,
          assignment: assignments.find((a) => a.plan_id === bundle.plan.id)!,
          coach: profiles.find((p) => p.id === bundle.plan.owner_id) ?? null,
        })),
        sessions: training.sessions,
        logs: training.logs,
        presets: (presetRows ?? []).map((r) => toPreset(r as Row)),
        coaches,
      };
    }

    return {
      ownPlans: ownBundles,
      assigned: [],
      sessions: training.sessions,
      logs: training.logs,
      presets: (presetRows ?? []).map((r) => toPreset(r as Row)),
      coaches: [],
    };
  },

  async coachWorkspace(profile): Promise<CoachWorkspace> {
    const [{ data: linkRows }, { data: planRows }] = await Promise.all([
      supabase.from("coach_links").select("*").eq("trainer_id", profile.id),
      supabase.from("plans").select("id").eq("owner_id", profile.id),
    ]);

    const links = (linkRows ?? []).map((r) => toLink(r as Row));
    const activeLinks = links.filter((l) => l.status === "active" && l.athlete_id);
    const athleteIds = activeLinks.map((l) => l.athlete_id as string);

    const [{ data: athleteRows }, plans] = await Promise.all([
      athleteIds.length ? supabase.from("profiles").select("*").in("id", athleteIds) : { data: [] },
      loadBundles((planRows ?? []).map((r) => str((r as Row).id))),
    ]);

    const athleteProfiles = (athleteRows ?? []).map((r) => toProfile(r as Row));
    const planIds = plans.map((p) => p.plan.id);
    const { data: assignmentRows } = planIds.length
      ? await supabase.from("plan_assignments").select("*").in("plan_id", planIds)
      : { data: [] };

    return {
      plans,
      athletes: activeLinks
        .map((link) => {
          const athlete = athleteProfiles.find((p) => p.id === link.athlete_id);
          return athlete ? { link, profile: athlete } : null;
        })
        .filter((x): x is { link: CoachLink; profile: Profile } => Boolean(x)),
      pendingInvites: links.filter((l) => l.status === "pending"),
      assignments: (assignmentRows ?? []).map((r) => toAssignment(r as Row)),
    };
  },

  async athleteTraining(athleteId): Promise<AthleteTraining> {
    const [training, { data: profileRows }, { data: assignmentRows }, { data: ownPlanRows }] =
      await Promise.all([
        loadSessionsAndLogs(athleteId),
        supabase.from("profiles").select("*").eq("id", athleteId),
        supabase.from("plan_assignments").select("*").eq("athlete_id", athleteId),
        supabase.from("plans").select("id").eq("owner_id", athleteId),
      ]);

    const assignments = (assignmentRows ?? []).map((r) => toAssignment(r as Row));
    const planIds = [
      ...new Set([
        ...assignments.map((a) => a.plan_id),
        ...((ownPlanRows ?? []).map((r) => str((r as Row).id))),
      ]),
    ];

    return {
      sessions: training.sessions,
      logs: training.logs,
      plans: await loadBundles(planIds),
      assignments,
      profile: profileRows?.[0] ? toProfile(profileRows[0] as Row) : null,
    };
  },

  async savePlan(bundle) {
    const { plan, days, segments, exercises } = bundle;
    await supabase.from("plans").upsert({
      id: plan.id,
      owner_id: plan.owner_id,
      trainer_id: plan.trainer_id || plan.owner_id,
      name: plan.name,
      is_active: plan.is_active,
      is_archived: plan.is_archived,
      start_date: plan.start_date,
      weeks: plan.weeks,
      icon_name: plan.icon_name,
      color_hex: plan.color_hex,
      notes: plan.notes,
    });

    await syncRows("plan_days", "plan_id", [plan.id], days as unknown as Row[]);

    const dayIds = days.map((d) => d.id);
    await syncRows("plan_segments", "plan_day_id", dayIds, segments as unknown as Row[]);
    await syncRows("plan_exercises", "plan_day_id", dayIds, exercises as unknown as Row[]);

    if (plan.is_active) {
      await supabase
        .from("plans")
        .update({ is_active: false })
        .eq("owner_id", plan.owner_id)
        .neq("id", plan.id);
    }
  },

  async deletePlan(planId) {
    await supabase.from("plans").delete().eq("id", planId);
  },

  async assignPlan(planId, athleteId) {
    await supabase.from("plan_assignments").upsert(
      {
        plan_id: planId,
        athlete_id: athleteId,
        start_date: localDate(startOfWeek()),
        status: "offered",
      },
      { onConflict: "plan_id,athlete_id" },
    );
  },

  async unassignPlan(assignmentId) {
    await supabase.from("plan_assignments").delete().eq("id", assignmentId);
  },

  async setAssignmentStatus(assignmentId, status, startDate) {
    const patch: Row = { status, accepted_at: status === "active" ? new Date().toISOString() : null };
    if (startDate !== undefined) patch.start_date = startDate;
    await supabase.from("plan_assignments").update(patch).eq("id", assignmentId);
  },

  async saveSession(session) {
    const { data } = await supabase.from("sessions").upsert(session).select().single();
    return data ? toSession(data as Row) : session;
  },

  async deleteSession(sessionId) {
    await supabase.from("sessions").delete().eq("id", sessionId);
  },

  async replaceSets(sessionId, exerciseName, sets) {
    await supabase.from("set_logs").delete().eq("session_id", sessionId).eq("exercise_name", exerciseName);
    if (sets.length > 0) {
      await supabase.from("set_logs").insert(sets);
    }
  },

  async savePreset(preset) {
    await supabase.from("exercise_presets").upsert(preset);
  },

  async deletePreset(presetId) {
    await supabase.from("exercise_presets").delete().eq("id", presetId);
  },

  async addXp(profileId, amount, reason) {
    const { data } = await supabase.from("profiles").select("total_xp").eq("id", profileId).single();
    const total = num((data as Row)?.total_xp) + amount;
    await Promise.all([
      supabase.from("profiles").update({ total_xp: total }).eq("id", profileId),
      supabase.from("xp_events").insert({ profile_id: profileId, amount, reason }),
    ]);
  },

  async coachingBoard(linkId): Promise<CoachingBoard> {
    const [messages, checkIns, notes, templates, entries] = await Promise.all([
      supabase.from("messages").select("*").eq("coach_link_id", linkId).order("created_at"),
      supabase.from("check_ins").select("*").eq("coach_link_id", linkId).order("week_index"),
      supabase.from("coach_notes").select("*").eq("coach_link_id", linkId).order("note_date", { ascending: false }),
      supabase.from("tracker_templates").select("*").eq("coach_link_id", linkId).order("sort_order"),
      supabase.from("tracker_entries").select("*").eq("coach_link_id", linkId),
    ]);

    return {
      messages: (messages.data ?? []).map((r) => toMessage(r as Row)),
      checkIns: (checkIns.data ?? []).map((r) => toCheckIn(r as Row)),
      notes: (notes.data ?? []).map((r) => toCoachNote(r as Row)),
      templates: (templates.data ?? []).map((r) => toTemplate(r as Row)),
      entries: (entries.data ?? []).map((r) => toEntry(r as Row)),
    };
  },

  async unreadCounts(linkIds, readerProfileId) {
    if (linkIds.length === 0) return {};
    const { data } = await supabase
      .from("messages")
      .select("coach_link_id, sender_profile_id, read_at")
      .in("coach_link_id", linkIds)
      .is("read_at", null);

    const counts: Record<string, number> = Object.fromEntries(linkIds.map((id) => [id, 0]));
    for (const row of (data ?? []) as Row[]) {
      if (str(row.sender_profile_id) === readerProfileId) continue;
      const id = str(row.coach_link_id);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  },

  async sendMessage(linkId, senderProfileId, body) {
    const { data } = await supabase
      .from("messages")
      .insert({ coach_link_id: linkId, sender_profile_id: senderProfileId, body: body.trim() })
      .select()
      .single();
    return toMessage((data ?? {}) as Row);
  },

  async markThreadRead(linkId, readerProfileId) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("coach_link_id", linkId)
      .is("read_at", null)
      .neq("sender_profile_id", readerProfileId);
  },

  async saveCheckIn(checkIn) {
    await supabase.from("check_ins").upsert(checkIn, { onConflict: "coach_link_id,week_index" });
  },

  async saveCoachNote(note) {
    await supabase.from("coach_notes").upsert(note);
  },

  async deleteCoachNote(noteId) {
    await supabase.from("coach_notes").delete().eq("id", noteId);
  },

  async saveTrackerTemplate(template) {
    await supabase.from("tracker_templates").upsert(template);
  },

  async deleteTrackerTemplate(templateId) {
    await supabase.from("tracker_templates").delete().eq("id", templateId);
  },

  async saveTrackerEntry(entry) {
    await supabase
      .from("tracker_entries")
      .upsert(entry, { onConflict: "template_id,metric_key,column_index" });
  },
};
