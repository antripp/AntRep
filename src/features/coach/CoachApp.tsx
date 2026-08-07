import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachLink, Profile } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { Icons, TabBar } from "../../components/ui";
import CoachDashboardPage from "./CoachDashboardPage";
import AthletesHubPage from "./AthletesHubPage";
import AthleteDetailPage from "./AthleteDetailPage";
import PlansPage from "./PlansPage";
import CoachSettingsPage from "./CoachSettingsPage";
import InboxPage from "../shared/InboxPage";

export interface LinkedAthlete {
  link: CoachLink;
  athlete: Profile;
}

export default function CoachApp() {
  const [tab, setTab] = useState("home");
  const [athletes, setAthletes] = useState<LinkedAthlete[]>([]);
  const [athleteDetailId, setAthleteDetailId] = useState<string | null>(null);
  const [athleteDetailView, setAthleteDetailView] = useState<"overview" | "sessions" | "program" | "progress" | "analytics" | "assess">("overview");
  const [inboxLinkId, setInboxLinkId] = useState<string | null>(null);

  const loadAthletes = useCallback(async () => {
    const { data } = await supabase.from("coach_links").select("*").eq("status", "active");
    const links = ((data as CoachLink[]) ?? []).filter((l) => l.athlete_id);
    let profiles: Profile[] = [];
    if (links.length > 0) {
      const { data: rows } = await supabase
        .from("profiles")
        .select("*")
        .in("id", links.map((l) => l.athlete_id as string));
      profiles = (rows as Profile[]) ?? [];
    }
    const result = links
      .map((link) => ({ link, athlete: profiles.find((p) => p.id === link.athlete_id) }))
      .filter((x): x is LinkedAthlete => Boolean(x.athlete));
    setAthletes(result);
  }, []);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);
  useRealtime("coach-athletes", ["coach_links", "profiles"], loadAthletes);

  function openAthlete(id: string, view: typeof athleteDetailView = "overview") {
    setAthleteDetailId(id);
    setAthleteDetailView(view);
    setTab("athletes");
  }

  function openInbox(linkId?: string) {
    setInboxLinkId(linkId ?? null);
    setTab("inbox");
  }

  const detailAthlete = athletes.find((a) => a.athlete.id === athleteDetailId) ?? null;

  return (
    <div className="pattern-bg min-h-dvh bg-bg">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-4xl md:pb-10 md:pl-28 lg:max-w-5xl">
        {tab === "home" && (
          <CoachDashboardPage
            athletes={athletes}
            onOpenAthlete={(id) => openAthlete(id)}
            onOpenInbox={() => openInbox()}
            onOpenAthletes={() => setTab("athletes")}
          />
        )}
        {tab === "athletes" && (
          detailAthlete ? (
            <AthleteDetailPage
              athlete={detailAthlete}
              initialView={athleteDetailView}
              onBack={() => setAthleteDetailId(null)}
              onOpenInbox={openInbox}
            />
          ) : (
            <AthletesHubPage
              athletes={athletes}
              onChanged={loadAthletes}
              onOpenAthlete={(id) => openAthlete(id)}
              onOpenInbox={openInbox}
            />
          )
        )}
        {tab === "plans" && <PlansPage athletes={athletes} onAthletesChanged={loadAthletes} />}
        {tab === "inbox" && (
          <InboxPage role="coach" initialLinkId={inboxLinkId} onLinkOpened={() => setInboxLinkId(null)} />
        )}
        {tab === "settings" && <CoachSettingsPage />}
      </main>
      <TabBar
        active={tab}
        onSelect={(t) => {
          setTab(t);
          if (t !== "athletes") setAthleteDetailId(null);
        }}
        tabs={[
          { key: "home", label: "Home", icon: Icons.home },
          { key: "athletes", label: "Athletes", icon: Icons.athletes },
          { key: "plans", label: "Plans", icon: Icons.plan },
          { key: "inbox", label: "Inbox", icon: Icons.inbox },
          { key: "settings", label: "Settings", icon: Icons.settings },
        ]}
      />
    </div>
  );
}

/** Small athlete picker — kept for any legacy use. */
export function AthletePicker({
  athletes,
  selectedId,
  onSelect,
}: {
  athletes: LinkedAthlete[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (athletes.length <= 1) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {athletes.map((a) => (
        <button
          key={a.athlete.id}
          onClick={() => onSelect(a.athlete.id)}
          className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
            a.athlete.id === selectedId ? "bg-accent text-white" : "border-2 border-line bg-surface text-muted"
          }`}
        >
          {a.athlete.display_name}
        </button>
      ))}
    </div>
  );
}
