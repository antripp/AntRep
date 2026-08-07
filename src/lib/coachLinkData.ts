import { supabase } from "./supabase";
import {
  effectiveStart,
  type AthleteProgram,
  type CheckIn,
  type CoachLink,
  type CoachNote,
  type Message,
  type Plan,
  type AthletePlan,
  type ProgressionExercise,
  type Profile,
  type Session,
  type SetLog,
} from "./types";
import { fetchAthletePlans } from "./athletePlans";
import { activePlanForCoach } from "./planSync";

export interface CoachLinkContext {
  link: CoachLink;
  coach: Profile;
  program: AthleteProgram | null;
  progressionExercises: ProgressionExercise[];
  checkIns: CheckIn[];
  coachNotes: CoachNote[];
  messages: Message[];
  planStart: string;
  durationWeeks: number;
  activePlan: AthletePlan | null;
}

/** Athlete: all active coach links with progression data. */
export async function fetchAthleteLinkContexts(athleteProfileId: string): Promise<CoachLinkContext[]> {
  const { data: links } = await supabase
    .from("coach_links")
    .select("*")
    .eq("athlete_id", athleteProfileId)
    .eq("status", "active");
  const activeLinks = (links as CoachLink[]) ?? [];
  if (activeLinks.length === 0) return [];

  const linkIds = activeLinks.map((l) => l.id);
  const coachIds = activeLinks.map((l) => l.trainer_id);

  const [{ data: coaches }, { data: programs }, { data: progEx }, { data: checkIns }, { data: notes }, { data: msgs }] =
    await Promise.all([
      supabase.from("profiles").select("*").in("id", coachIds),
      supabase.from("athlete_programs").select("*").in("coach_link_id", linkIds),
      supabase.from("progression_exercises").select("*").in("coach_link_id", linkIds).order("sort_order"),
      supabase.from("check_ins").select("*").in("coach_link_id", linkIds).order("week_index"),
      supabase.from("coach_notes").select("*").in("coach_link_id", linkIds).order("note_date", { ascending: false }),
      supabase.from("messages").select("*").in("coach_link_id", linkIds).order("created_at"),
    ]);

  const coachMap = new Map(((coaches as Profile[]) ?? []).map((p) => [p.id, p]));
  const { plans: athletePlans } = await fetchAthletePlans(athleteProfileId);

  return activeLinks.map((link) => {
    const coach = coachMap.get(link.trainer_id)!;
    const program = ((programs as AthleteProgram[]) ?? []).find((p) => p.coach_link_id === link.id) ?? null;
    const ap = activePlanForCoach(athletePlans, link.trainer_id);
    const planStart = ap ? ap.start : new Date().toISOString().slice(0, 10);
    return {
      link,
      coach,
      program,
      progressionExercises: ((progEx as ProgressionExercise[]) ?? []).filter((e) => e.coach_link_id === link.id),
      checkIns: ((checkIns as CheckIn[]) ?? []).filter((c) => c.coach_link_id === link.id),
      coachNotes: ((notes as CoachNote[]) ?? []).filter((n) => n.coach_link_id === link.id),
      messages: ((msgs as Message[]) ?? []).filter((m) => m.coach_link_id === link.id),
      planStart,
      durationWeeks: ap?.plan.weeks ?? program?.duration_weeks ?? 12,
      activePlan: ap,
    };
  });
}

/** Coach: progression data for one linked athlete. */
export async function fetchCoachLinkContext(
  coachProfileId: string,
  athleteProfileId: string,
): Promise<CoachLinkContext | null> {
  const { data: linkRow } = await supabase
    .from("coach_links")
    .select("*")
    .eq("trainer_id", coachProfileId)
    .eq("athlete_id", athleteProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (!linkRow) return null;
  const link = linkRow as CoachLink;

  const [{ data: coachProfile }, { data: program }, { data: progEx }, { data: checkIns }, { data: notes }, { data: msgs }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", coachProfileId).single(),
      supabase.from("athlete_programs").select("*").eq("coach_link_id", link.id).maybeSingle(),
      supabase.from("progression_exercises").select("*").eq("coach_link_id", link.id).order("sort_order"),
      supabase.from("check_ins").select("*").eq("coach_link_id", link.id).order("week_index"),
      supabase.from("coach_notes").select("*").eq("coach_link_id", link.id).order("note_date", { ascending: false }),
      supabase.from("messages").select("*").eq("coach_link_id", link.id).order("created_at"),
    ]);

  const { data: assignment } = await supabase
    .from("plan_assignments")
    .select("*, plans(*)")
    .eq("athlete_id", athleteProfileId)
    .limit(20);

  let planStart = new Date().toISOString().slice(0, 10);
  let durationWeeks = (program as AthleteProgram | null)?.duration_weeks ?? 12;
  let activePlan: AthletePlan | null = null;
  const rows = (assignment as { start_date: string | null; plans: Plan }[]) ?? [];
  const coachPlans = rows.filter((r) => r.plans?.trainer_id === coachProfileId);
  if (coachPlans.length > 0) {
    const best = coachPlans.sort((a, b) =>
      effectiveStart(a.plans, { start_date: a.start_date }) > effectiveStart(b.plans, { start_date: b.start_date }) ? -1 : 1,
    )[0];
    planStart = effectiveStart(best.plans, { start_date: best.start_date });
    durationWeeks = best.plans.weeks ?? (program as AthleteProgram | null)?.duration_weeks ?? 12;
    activePlan = {
      plan: best.plans,
      assignment: { id: "", plan_id: best.plans.id, athlete_id: athleteProfileId, start_date: best.start_date },
      start: planStart,
    };
  }

  return {
    link,
    coach: coachProfile as Profile,
    program: (program as AthleteProgram) ?? null,
    progressionExercises: (progEx as ProgressionExercise[]) ?? [],
    checkIns: (checkIns as CheckIn[]) ?? [],
    coachNotes: (notes as CoachNote[]) ?? [],
    messages: (msgs as Message[]) ?? [],
    planStart,
    durationWeeks,
    activePlan,
  };
}

/** Set logs + sessions for progression grid (coach or athlete). */
export async function fetchProgressionLogs(
  athleteProfileId: string,
  programStart: string,
  durationWeeks: number,
): Promise<{ sessions: Session[]; setLogs: SetLog[] }> {
  const end = new Date(programStart);
  end.setDate(end.getDate() + durationWeeks * 7 + 7);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("athlete_id", athleteProfileId)
    .gte("date", programStart)
    .lte("date", end.toISOString().slice(0, 10))
    .order("date");
  const sessionRows = (sessions as Session[]) ?? [];
  if (sessionRows.length === 0) return { sessions: [], setLogs: [] };
  const { data: logs } = await supabase
    .from("set_logs")
    .select("*")
    .in("session_id", sessionRows.map((s) => s.id));
  return { sessions: sessionRows, setLogs: (logs as SetLog[]) ?? [] };
}

export function unreadMessageCount(messages: Message[], myProfileId: string): number {
  return messages.filter((m) => m.sender_profile_id !== myProfileId && m.read_at == null).length;
}

export async function markMessagesRead(linkId: string, readerProfileId: string) {
  const { data: unread } = await supabase
    .from("messages")
    .select("id")
    .eq("coach_link_id", linkId)
    .neq("sender_profile_id", readerProfileId)
    .is("read_at", null);
  const ids = ((unread as { id: string }[]) ?? []).map((m) => m.id);
  if (ids.length === 0) return;
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids);
}
