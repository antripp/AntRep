import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchInboxThreads } from "../../lib/inboxData";
import { localDateString, type Session } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { useAuth } from "../auth/useAuth";
import AthletesPage from "./AthletesPage";
import type { LinkedAthlete } from "./CoachApp";

export default function AthletesHubPage({
  athletes,
  onChanged,
  onOpenAthlete,
  onOpenInbox,
}: {
  athletes: LinkedAthlete[];
  onChanged: () => Promise<void> | void;
  onOpenAthlete: (id: string) => void;
  onOpenInbox: (linkId: string) => void;
}) {
  const { profile } = useAuth();
  const [unreadByAthlete, setUnreadByAthlete] = useState<Map<string, number>>(new Map());
  const [recent, setRecent] = useState<Session[]>([]);

  const loadMeta = useCallback(async () => {
    if (!profile) return;
    const threads = await fetchInboxThreads(profile.id, "coach");
    const map = new Map<string, number>();
    for (const t of threads) {
      if (t.link.athlete_id) map.set(t.link.athlete_id, t.unreadCount);
    }
    setUnreadByAthlete(map);

    if (athletes.length === 0) {
      setRecent([]);
      return;
    }
    const since = new Date();
    since.setDate(since.getDate() - 28);
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .in("athlete_id", athletes.map((a) => a.athlete.id))
      .gte("date", localDateString(since))
      .order("date", { ascending: false });
    setRecent((data as Session[]) ?? []);
  }, [profile, athletes]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useRealtime("athletes-hub", ["messages", "sessions", "coach_links"], loadMeta);

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-black">Athletes</h1>
        <p className="text-sm font-semibold text-muted">Roster, invites, and athlete details</p>
      </header>
      <AthletesPage
        athletes={athletes}
        onChanged={onChanged}
        onSelect={onOpenAthlete}
        onOpenProgress={onOpenAthlete}
        onOpenInbox={onOpenInbox}
        unreadByAthlete={unreadByAthlete}
        recentSessions={recent}
      />
    </>
  );
}
