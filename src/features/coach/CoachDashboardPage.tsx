import { useCallback, useEffect, useState } from "react";
import { fetchCoachDashboardStats } from "../../lib/coachDashboard";
import { useRealtime } from "../../lib/useRealtime";
import { Avatar, Card, SettingRow, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import type { LinkedAthlete } from "./CoachApp";
import { athleteDisplayName } from "./AthletesPage";

export default function CoachDashboardPage({
  athletes,
  onOpenAthlete,
  onOpenInbox,
  onOpenAthletes,
}: {
  athletes: LinkedAthlete[];
  onOpenAthlete: (id: string) => void;
  onOpenInbox: () => void;
  onOpenAthletes: () => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchCoachDashboardStats>> | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const names = new Map(athletes.map((a) => [a.athlete.id, athleteDisplayName(a.link, a.athlete)]));
    const s = await fetchCoachDashboardStats(
      profile.id,
      athletes.map((a) => a.athlete.id),
      names,
    );
    setStats(s);
    setLoading(false);
  }, [profile, athletes]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime("coach-dashboard", ["coach_links", "sessions", "messages", "check_ins"], load);

  if (loading) return <Spinner />;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-black">Home</h1>
        <p className="text-sm font-semibold text-muted">Your coaching dashboard</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-black">{stats?.athleteCount ?? 0}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Athletes</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-black">{stats?.sessionsThisWeek ?? 0}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Sessions this week</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-black">{stats?.unreadMessages ?? 0}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Unread messages</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-black">{stats?.pendingCheckIns ?? 0}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Check-ins due</p>
        </Card>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <SettingRow icon="👥" label="Manage athletes" hint="Roster, invites, athlete details" onClick={onOpenAthletes} />
        <SettingRow icon="💬" label="Inbox" hint="Messages and activity" onClick={onOpenInbox} />
      </div>

      {stats && stats.recentActivity.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-black">Recent activity</h2>
          <ul className="flex flex-col gap-2">
            {stats.recentActivity.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-xs font-semibold">
                <span>{a.kind === "session" ? "💪" : "📋"}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-extrabold">{a.athleteName}</span> — {a.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {athletes.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-black">Athletes</h2>
          <div className="flex flex-col gap-2">
            {athletes.map(({ link, athlete }) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onOpenAthlete(athlete.id)}
                className="flex items-center gap-3 rounded-xl bg-inset px-3 py-2 text-left transition hover:opacity-90"
              >
                <Avatar name={athleteDisplayName(link, athlete)} avatar={athlete.avatar} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                  {athleteDisplayName(link, athlete)}
                </span>
                <span className="text-muted">›</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
