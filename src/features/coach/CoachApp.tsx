import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachLink, Profile } from "../../lib/types";
import { Icons, TabBar } from "../../components/ui";
import AthletesPage from "./AthletesPage";
import PlanEditorPage from "./PlanEditorPage";
import SessionsPage from "./SessionsPage";
import CoachSettingsPage from "./CoachSettingsPage";

export interface LinkedAthlete {
  link: CoachLink;
  athlete: Profile;
}

export default function CoachApp() {
  const [tab, setTab] = useState("athletes");
  const [athletes, setAthletes] = useState<LinkedAthlete[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function loadAthletes() {
    const { data } = await supabase.from("coach_links").select("*").eq("status", "active");
    const links = (data as CoachLink[]) ?? [];
    const result: LinkedAthlete[] = [];
    for (const link of links) {
      if (!link.athlete_id) continue;
      const { data: athlete } = await supabase
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", link.athlete_id)
        .maybeSingle();
      if (athlete) result.push({ link, athlete: athlete as Profile });
    }
    setAthletes(result);
    setSelectedId((current) => current ?? result[0]?.athlete.id ?? null);
  }

  useEffect(() => {
    loadAthletes();
  }, []);

  const selected = athletes.find((a) => a.athlete.id === selectedId) ?? null;

  return (
    <div className="min-h-dvh bg-mint">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-3xl md:pb-10 md:pl-28 lg:max-w-4xl">
        {tab === "athletes" && (
          <AthletesPage
            athletes={athletes}
            onChanged={loadAthletes}
            onSelect={(id) => {
              setSelectedId(id);
              setTab("plan");
            }}
          />
        )}
        {tab === "plan" && (
          <PlanEditorPage athletes={athletes} selectedId={selectedId} onSelectAthlete={setSelectedId} />
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
          { key: "athletes", label: "Athletes", icon: Icons.athletes },
          { key: "plan", label: "Plan", icon: Icons.plan },
          { key: "sessions", label: "Sessions", icon: Icons.sessions },
          { key: "settings", label: "Settings", icon: Icons.settings },
        ]}
      />
      {selected && tab !== "athletes" && tab !== "settings" && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-10 flex justify-center md:pl-20">
          <span className="rounded-b-2xl bg-ink px-4 py-1 text-xs font-extrabold text-white">
            {selected.athlete.display_name}
          </span>
        </div>
      )}
    </div>
  );
}

/** Small athlete picker shown on Plan & Sessions tabs. */
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
          className={`rounded-full px-3 py-1 text-xs font-extrabold ${
            a.athlete.id === selectedId ? "bg-ink text-white" : "bg-white/70 text-ink"
          }`}
        >
          {a.athlete.display_name}
        </button>
      ))}
    </div>
  );
}
