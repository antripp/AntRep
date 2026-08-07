import { supabase } from "./supabase";
import { unreadMessageCount } from "./coachLinkData";
import type { CheckIn, CoachLink, CoachNote, Message, Profile, Role, Session, SetLog } from "./types";

export interface InboxThread {
  link: CoachLink;
  other: Profile;
  unreadCount: number;
  preview: string;
  previewAt: string;
}

export type ActivityKind = "session" | "check_in" | "coach_note";

export interface ActivityItem {
  kind: "activity";
  id: string;
  activityKind: ActivityKind;
  at: string;
  title: string;
  detail: string;
}

export interface MessageItem {
  kind: "message";
  id: string;
  message: Message;
}

export type ThreadItem = MessageItem | ActivityItem;

export async function fetchInboxThreads(
  profileId: string,
  role: Role,
): Promise<InboxThread[]> {
  const col = role === "coach" ? "trainer_id" : "athlete_id";
  const { data: links } = await supabase
    .from("coach_links")
    .select("*")
    .eq(col, profileId)
    .eq("status", "active");
  const linkRows = ((links as CoachLink[]) ?? []).filter((l) => l.athlete_id);
  if (linkRows.length === 0) return [];

  const linkIds = linkRows.map((l) => l.id);
  const otherIds = linkRows.map((l) => (role === "coach" ? l.athlete_id! : l.trainer_id));

  const [{ data: profiles }, { data: msgs }, timelines] = await Promise.all([
    supabase.from("profiles").select("*").in("id", otherIds),
    supabase.from("messages").select("*").in("coach_link_id", linkIds).order("created_at", { ascending: false }),
    Promise.all(linkRows.map((l) => fetchThreadTimeline(l.id, l.athlete_id!))),
  ]);

  const profileMap = new Map(((profiles as Profile[]) ?? []).map((p) => [p.id, p]));
  const msgsByLink = new Map<string, Message[]>();
  for (const m of (msgs as Message[]) ?? []) {
    const arr = msgsByLink.get(m.coach_link_id) ?? [];
    arr.push(m);
    msgsByLink.set(m.coach_link_id, arr);
  }

  return linkRows
    .map((link, i) => {
      const otherId = role === "coach" ? link.athlete_id! : link.trainer_id;
      const other = profileMap.get(otherId);
      if (!other) return null;
      const messages = msgsByLink.get(link.id) ?? [];
      const timeline = timelines[i];
      const last = timeline[timeline.length - 1];
      const preview =
        last?.kind === "message"
          ? last.message.body
          : last?.kind === "activity"
            ? last.title
            : "No messages yet";
      const previewAt =
        last?.kind === "message"
          ? last.message.created_at
          : last?.kind === "activity"
            ? last.at
            : link.claimed_at ?? new Date().toISOString();
      return {
        link,
        other,
        unreadCount: unreadMessageCount(messages, profileId),
        preview,
        previewAt,
      };
    })
    .filter((t): t is InboxThread => t != null)
    .sort((a, b) => b.previewAt.localeCompare(a.previewAt));
}

export async function fetchThreadTimeline(
  coachLinkId: string,
  athleteProfileId: string,
): Promise<ThreadItem[]> {
  const [{ data: msgs }, { data: checkIns }, { data: notes }, { data: sessions }] = await Promise.all([
    supabase.from("messages").select("*").eq("coach_link_id", coachLinkId).order("created_at"),
    supabase.from("check_ins").select("*").eq("coach_link_id", coachLinkId).order("submitted_at"),
    supabase.from("coach_notes").select("*").eq("coach_link_id", coachLinkId).order("created_at"),
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", athleteProfileId)
      .eq("status", "complete")
      .order("date", { ascending: false })
      .limit(40),
  ]);

  const sessionRows = (sessions as Session[]) ?? [];
  let setCountBySession = new Map<string, number>();
  if (sessionRows.length > 0) {
    const { data: logs } = await supabase
      .from("set_logs")
      .select("session_id")
      .in("session_id", sessionRows.map((s) => s.id));
    for (const log of (logs as Pick<SetLog, "session_id">[]) ?? []) {
      setCountBySession.set(log.session_id, (setCountBySession.get(log.session_id) ?? 0) + 1);
    }
  }

  const items: ThreadItem[] = [];

  for (const m of (msgs as Message[]) ?? []) {
    items.push({ kind: "message", id: m.id, message: m });
  }

  for (const c of (checkIns as CheckIn[]) ?? []) {
    const weight = c.weight_kg != null ? `${c.weight_kg} kg` : "";
    const pain = c.pain ? `, pain ${c.pain}` : "";
    items.push({
      kind: "activity",
      id: `checkin-${c.id}`,
      activityKind: "check_in",
      at: c.submitted_at,
      title: `Week ${c.week_index} check-in submitted`,
      detail: [weight, pain].filter(Boolean).join("") || "Check-in recorded",
    });
  }

  for (const n of (notes as CoachNote[]) ?? []) {
    const text = n.adjustment || n.observation || "Coach note";
    items.push({
      kind: "activity",
      id: `note-${n.id}`,
      activityKind: "coach_note",
      at: n.created_at ?? `${n.note_date}T12:00:00Z`,
      title: "Coach note added",
      detail: text,
    });
  }

  for (const s of sessionRows) {
    const sets = setCountBySession.get(s.id) ?? 0;
    const ended = s.ended_at ?? `${s.date}T12:00:00Z`;
    items.push({
      kind: "activity",
      id: `session-${s.id}`,
      activityKind: "session",
      at: ended,
      title: `Completed ${s.day_title || "workout"}`,
      detail: sets > 0 ? `${sets} set${sets === 1 ? "" : "s"} logged` : "Session complete",
    });
  }

  items.sort((a, b) => {
    const atA = a.kind === "message" ? a.message.created_at : a.at;
    const atB = b.kind === "message" ? b.message.created_at : b.at;
    return atA.localeCompare(atB);
  });

  return items;
}
