import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachLink, Profile } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { Icons, TabBar } from "../../components/ui";
import { athleteDisplayName } from "./AthletesPage";
import PlansPage from "./PlansPage";
import SessionsPage from "./SessionsPage";
import CoachSettingsPage from "./CoachSettingsPage";

export interface LinkedAthlete {
  link: CoachLink;
  athlete: Profile;
}

export default function CoachApp() {
  const [tab, setTab] = useState("plans");
  const [athletes, setAthletes] = useState<LinkedAthlete[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    setSelectedId((current) =>
      current && result.some((r) => r.athlete.id === current) ? current : (result[0]?.athlete.id ?? null),
    );
  }, []);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);
  useRealtime("coach-athletes", ["coach_links", "profiles"], loadAthletes);

  return (
    <div className="pattern-bg min-h-dvh bg-bg">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-4xl md:pb-10 md:pl-28 lg:max-w-5xl">
        {tab === "plans" && (
          <PlansPage
            athletes={athletes}
            onAthletesChanged={loadAthletes}
            onOpenSessions={(id) => {
              setSelectedId(id);
              setTab("sessions");
            }}
          />
        )}
        {tab === "sessions" && (
          <SessionsPage athletes={athletes} selectedId={selectedId} onSelectAthlete={setSelectedId} />
        )}
        {tab === "settings" && <CoachSettingsPage />}
      </main>
      <TabBar
        active={tab}
        onSelect={setTab}
        tabs={[
          { key: "plans", label: "Plans", icon: Icons.plan },
          { key: "sessions", label: "Sessions", icon: Icons.sessions },
          { key: "settings", label: "Settings", icon: Icons.settings },
        ]}
      />
    </div>
  );
}

/** Small athlete picker shown on the Sessions tab. */
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
          {athleteDisplayName(a.link, a.athlete)}
        </button>
      ))}
    </div>
  );
}
