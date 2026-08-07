import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchAthleteLinkContexts, unreadMessageCount } from "../../lib/coachLinkData";
import { computeProgressionAnalytics } from "../../lib/analytics";
import { computeProgressionGrid, currentProgramWeek } from "../../lib/progression";
import { fetchProgressionLogs } from "../../lib/coachLinkData";
import { localDateString, type AthleteProgram, type Session } from "../../lib/types";
import { dailyQuote } from "../../lib/quotes";
import { useRealtime } from "../../lib/useRealtime";
import { isSchemaOutdated, MigrationNotice } from "../../components/MigrationNotice";
import { Card, Chip, EmptyState, SettingRow, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import TodayPage from "./TodayPage";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage({
  onGoProgress,
  onGoInbox,
}: {
  onGoProgress?: () => void;
  onGoInbox?: () => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<Awaited<ReturnType<typeof fetchAthleteLinkContexts>>>([]);
  const [sessionsWeek, setSessionsWeek] = useState(0);
  const [topGainer, setTopGainer] = useState<string | null>(null);
  const [schemaOld, setSchemaOld] = useState(false);
  const today = useMemo(() => new Date(), []);
  const dateStr = localDateString(today);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const ctxs = await fetchAthleteLinkContexts(profile.id);
      setContexts(ctxs);

      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() === 0 ? 7 : monday.getDay()) - 1));
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("athlete_id", profile.id)
        .gte("date", localDateString(monday))
        .eq("status", "complete");
      setSessionsWeek(((data as Session[]) ?? []).length);

      const c = ctxs[0];
      if (c) {
        const programStart = c.program?.start_date ?? c.planStart;
        const { sessions, setLogs } = await fetchProgressionLogs(profile.id, programStart, c.durationWeeks);
        const program: AthleteProgram = c.program ?? {
          id: "",
          coach_link_id: c.link.id,
          goals: "",
          duration_weeks: c.durationWeeks,
          assessment_date: null,
          start_date: programStart,
          progression_metric: "max_weight",
          progression_overrides: {},
        };
        const grid = computeProgressionGrid(c.progressionExercises, setLogs, sessions, program, c.planStart);
        const analytics = computeProgressionAnalytics(
          grid,
          sessions,
          setLogs,
          c.checkIns,
          programStart,
          c.durationWeeks,
          program.progression_metric,
        );
        setTopGainer(analytics.summary.topGainer?.name ?? null);
      }
    } catch (e) {
      if (isSchemaOutdated(e as never)) setSchemaOld(true);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(
    "athlete-dashboard",
    ["athlete_programs", "check_ins", "coach_notes", "messages", "sessions", "set_logs"],
    load,
  );

  const totalUnread = useMemo(
    () => contexts.reduce((n, c) => n + unreadMessageCount(c.messages, profile?.id ?? ""), 0),
    [contexts, profile?.id],
  );

  const checkInDue = useMemo(() => {
    return contexts.some((c) => {
      const start = c.program?.start_date ?? c.planStart;
      const week = currentProgramWeek({ start_date: start, duration_weeks: c.durationWeeks }, c.planStart);
      return !c.checkIns.some((ci) => ci.week_index === week);
    });
  }, [contexts]);

  const latestNote = contexts.flatMap((c) => c.coachNotes).sort((a, b) => b.note_date.localeCompare(a.note_date))[0];

  if (loading) return <Spinner />;

  return (
    <>
      <header className="mb-4">
        <p className="text-sm font-bold text-muted">
          {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-black">
          {greeting(today.getHours())}, {profile?.display_name || "athlete"}
        </h1>
        <p className="font-quote mt-3 border-l-2 border-accent/60 pl-3 text-base italic leading-snug text-ink/75">
          {dailyQuote(dateStr + (profile?.id ?? ""))}
        </p>
      </header>

      {schemaOld && (
        <div className="mb-4">
          <MigrationNotice />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-2xl font-black">{sessionsWeek}</p>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Sessions this week</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-black">{totalUnread}</p>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Unread</p>
          </Card>
        </div>

        {topGainer && (
          <Card className="border-accent/30 bg-accent-soft">
            <p className="text-xs font-extrabold uppercase tracking-wide text-accent">Top progress</p>
            <p className="text-sm font-extrabold">{topGainer}</p>
          </Card>
        )}

        {checkInDue && (
          <Card className="border-accent/40 bg-accent-soft">
            <p className="text-sm font-extrabold text-accent">Check-in due</p>
            <p className="text-xs font-semibold text-muted">Submit on the Progress tab.</p>
          </Card>
        )}

        {latestNote && (
          <Card>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Latest coach note</p>
            <p className="mt-1 text-sm font-extrabold">{latestNote.observation || latestNote.adjustment}</p>
          </Card>
        )}

        {contexts.map((c) => {
          const start = c.program?.start_date ?? c.planStart;
          const week = currentProgramWeek({ start_date: start, duration_weeks: c.durationWeeks }, c.planStart);
          return (
            <Card key={c.link.id}>
              <div className="mb-1 flex items-center gap-2">
                <p className="font-extrabold">{c.coach.display_name}</p>
                <Chip label={`Week ${week} / ${c.durationWeeks}`} />
              </div>
              {c.program?.goals && <p className="text-xs font-semibold text-muted">{c.program.goals}</p>}
            </Card>
          );
        })}

        <div className="flex flex-col gap-2">
          {onGoInbox && (
            <SettingRow icon="💬" label="Inbox" hint="Messages and updates" onClick={onGoInbox} />
          )}
          {onGoProgress && (
            <SettingRow icon="📈" label="Progress & analytics" hint="Charts and tracking" onClick={onGoProgress} />
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-black">Today's workout</h2>
      {contexts.length === 0 ? (
        <Card>
          <EmptyState title="No coach linked" subtitle="Enter an invite code in Settings to get your programme." />
        </Card>
      ) : (
        <TodayPage embedded />
      )}
    </>
  );
}
