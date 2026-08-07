import { supabase } from "./supabase";
import { currentProgramWeek } from "./progression";
import { fetchCoachLinkContext, unreadMessageCount } from "./coachLinkData";
import { localDateString, type CheckIn, type Message, type Session } from "./types";

export interface CoachDashboardStats {
  athleteCount: number;
  sessionsThisWeek: number;
  unreadMessages: number;
  pendingCheckIns: number;
  recentActivity: { kind: "session" | "check_in"; at: string; label: string; athleteName: string }[];
}

export async function fetchCoachDashboardStats(
  trainerId: string,
  athleteIds: string[],
  athleteNames: Map<string, string>,
): Promise<CoachDashboardStats> {
  if (athleteIds.length === 0) {
    return { athleteCount: 0, sessionsThisWeek: 0, unreadMessages: 0, pendingCheckIns: 0, recentActivity: [] };
  }

  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() === 0 ? 7 : monday.getDay()) - 1));
  const weekStart = localDateString(monday);

  const { data: links } = await supabase
    .from("coach_links")
    .select("id, athlete_id")
    .eq("trainer_id", trainerId)
    .eq("status", "active")
    .in("athlete_id", athleteIds);
  const linkRows = (links as { id: string; athlete_id: string }[]) ?? [];
  const linkIds = linkRows.map((l) => l.id);

  const [{ data: sessions }, { data: msgs }, { data: checkIns }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .in("athlete_id", athleteIds)
      .eq("status", "complete")
      .gte("date", weekStart)
      .order("date", { ascending: false }),
    linkIds.length > 0
      ? supabase.from("messages").select("*").in("coach_link_id", linkIds)
      : Promise.resolve({ data: [] }),
    linkIds.length > 0
      ? supabase.from("check_ins").select("*").in("coach_link_id", linkIds).order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const sessionRows = (sessions as Session[]) ?? [];
  const messageRows = (msgs as Message[]) ?? [];
  const checkInRows = (checkIns as CheckIn[]) ?? [];

  let unreadMessages = 0;
  for (const linkId of linkIds) {
    const linkMsgs = messageRows.filter((m) => m.coach_link_id === linkId);
    unreadMessages += unreadMessageCount(linkMsgs, trainerId);
  }

  let pendingCheckIns = 0;
  for (const link of linkRows) {
    const ctx = await fetchCoachLinkContext(trainerId, link.athlete_id);
    if (!ctx) continue;
    const start = ctx.program?.start_date ?? ctx.planStart;
    const week = currentProgramWeek(
      { start_date: start, duration_weeks: ctx.durationWeeks },
      ctx.planStart,
    );
    const hasCheckIn = ctx.checkIns.some((c) => c.week_index === week);
    if (!hasCheckIn) pendingCheckIns++;
  }

  const recentActivity: CoachDashboardStats["recentActivity"] = [];
  for (const s of sessionRows.slice(0, 5)) {
    recentActivity.push({
      kind: "session",
      at: s.ended_at ?? `${s.date}T12:00:00Z`,
      label: s.day_title || "Workout",
      athleteName: athleteNames.get(s.athlete_id) ?? "Athlete",
    });
  }
  for (const c of checkInRows.slice(0, 5)) {
    const link = linkRows.find((l) => l.id === c.coach_link_id);
    recentActivity.push({
      kind: "check_in",
      at: c.submitted_at,
      label: `Week ${c.week_index} check-in`,
      athleteName: link ? (athleteNames.get(link.athlete_id) ?? "Athlete") : "Athlete",
    });
  }
  recentActivity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    athleteCount: athleteIds.length,
    sessionsThisWeek: sessionRows.length,
    unreadMessages,
    pendingCheckIns,
    recentActivity: recentActivity.slice(0, 8),
  };
}
