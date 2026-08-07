import { useCallback, useEffect, useMemo, useState } from "react";
import { computeProgressionGrid, currentProgramWeek } from "../../lib/progression";
import { computeProgressionAnalytics } from "../../lib/analytics";
import {
  fetchAthleteLinkContexts,
  fetchProgressionLogs,
  type CoachLinkContext,
} from "../../lib/coachLinkData";
import type { AthleteProgram, CheckIn } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { isSchemaOutdated, MigrationNotice } from "../../components/MigrationNotice";
import { Button, Card, EmptyState, Segmented, Select, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import ProgressionGrid from "../shared/ProgressionGrid";
import ProgressionCharts from "../shared/ProgressionCharts";
import CheckInForm, { CheckInHistory } from "../shared/CheckInForm";
import AssessmentsPanel from "../shared/AssessmentsPanel";

type SubView = "analytics" | "overload" | "checkin" | "assess";

export default function ProgressPage({ onOpenInbox }: { onOpenInbox?: (linkId: string) => void }) {
  const { profile } = useAuth();
  const [view, setView] = useState<SubView>("analytics");
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<CoachLinkContext[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState<ReturnType<typeof computeProgressionGrid>>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof fetchProgressionLogs>>["sessions"]>([]);
  const [setLogs, setSetLogs] = useState<Awaited<ReturnType<typeof fetchProgressionLogs>>["setLogs"]>([]);
  const [schemaOld, setSchemaOld] = useState(false);

  const selected = contexts.find((c) => c.link.id === selectedLinkId) ?? contexts[0] ?? null;

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const ctxs = await fetchAthleteLinkContexts(profile.id);
      setContexts(ctxs);
      setSelectedLinkId((cur) => (cur && ctxs.some((c) => c.link.id === cur) ? cur : (ctxs[0]?.link.id ?? null)));
    } catch (e) {
      if (isSchemaOutdated(e as never)) setSchemaOld(true);
    }
    setLoading(false);
  }, [profile]);

  const loadGrid = useCallback(async () => {
    if (!profile || !selected) {
      setGridRows([]);
      setSessions([]);
      setSetLogs([]);
      return;
    }
    const programStart = selected.program?.start_date ?? selected.planStart;
    const { sessions: sess, setLogs: logs } = await fetchProgressionLogs(
      profile.id,
      programStart,
      selected.durationWeeks,
    );
    setSessions(sess);
    setSetLogs(logs);
    const program: AthleteProgram = selected.program ?? {
      id: "",
      coach_link_id: selected.link.id,
      goals: "",
      duration_weeks: selected.durationWeeks,
      assessment_date: null,
      start_date: programStart,
      progression_metric: "max_weight",
      progression_overrides: {},
    };
    setGridRows(
      computeProgressionGrid(selected.progressionExercises, logs, sess, program, selected.planStart),
    );
  }, [profile, selected]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  useRealtime(
    "athlete-progress",
    ["athlete_programs", "progression_exercises", "check_ins", "coach_notes", "messages", "set_logs", "sessions",
      "athlete_client_profiles", "tracker_templates", "tracker_entries", "plan_assignments", "plans"],
    () => {
      load();
      loadGrid();
    },
  );

  const weekNow = useMemo(() => {
    if (!selected) return 1;
    const start = selected.program?.start_date ?? selected.planStart;
    return currentProgramWeek({ start_date: start, duration_weeks: selected.durationWeeks }, selected.planStart);
  }, [selected]);

  const metric = selected?.program?.progression_metric ?? "max_weight";
  const programStart = selected?.program?.start_date ?? selected?.planStart ?? "";

  const analytics = useMemo(() => {
    if (!selected) return null;
    return computeProgressionAnalytics(
      gridRows,
      sessions,
      setLogs,
      selected.checkIns,
      programStart,
      selected.durationWeeks,
      metric,
    );
  }, [selected, gridRows, sessions, setLogs, programStart, metric]);

  const currentCheckIn = selected?.checkIns.find((c) => c.week_index === weekNow) ?? null;

  function onCheckInSaved(row: CheckIn) {
    setContexts((prev) =>
      prev.map((c) =>
        c.link.id === row.coach_link_id
          ? {
              ...c,
              checkIns: [...c.checkIns.filter((x) => x.week_index !== row.week_index), row].sort(
                (a, b) => a.week_index - b.week_index,
              ),
            }
          : c,
      ),
    );
  }

  if (loading) return <Spinner />;

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-black">Progress</h1>
      </header>

      {schemaOld && (
        <div className="mb-3">
          <MigrationNotice />
        </div>
      )}

      {contexts.length === 0 ? (
        <Card>
          <EmptyState title="Link a coach first" subtitle="Use an invite code in Settings to unlock progress tracking." />
        </Card>
      ) : (
        <>
          {contexts.length > 1 && selected && (
            <div className="mb-3">
              <Select
                value={selected.link.id}
                onChange={setSelectedLinkId}
                options={contexts.map((c) => ({
                  value: c.link.id,
                  label: c.coach.display_name,
                }))}
              />
            </div>
          )}

          {selected && onOpenInbox && (
            <Button variant="secondary" className="mb-3 w-full text-sm" onClick={() => onOpenInbox(selected.link.id)}>
              Message {selected.coach.display_name}
            </Button>
          )}

          <div className="mb-4 w-full overflow-x-auto">
            <Segmented
              options={[
                { key: "analytics", label: "Analytics" },
                { key: "overload", label: "Overload" },
                { key: "checkin", label: "Check-in" },
                { key: "assess", label: "Assess" },
              ]}
              value={view}
              onChange={setView}
            />
          </div>

          {selected && view === "analytics" && analytics && (
            <ProgressionCharts analytics={analytics} metric={metric} />
          )}

          {selected && view === "overload" && (
            <ProgressionGrid rows={gridRows} metric={metric} readOnly />
          )}

          {selected && view === "checkin" && (
            <div className="flex flex-col gap-4">
              <CheckInForm
                coachLinkId={selected.link.id}
                weekIndex={weekNow}
                existing={currentCheckIn}
                onSaved={onCheckInSaved}
              />
              <CheckInHistory checkIns={selected.checkIns.filter((c) => c.week_index !== weekNow)} />
            </div>
          )}

          {selected && view === "assess" && (
            <AssessmentsPanel
              coachLinkId={selected.link.id}
              athleteProfileId={profile!.id}
              programStart={programStart}
              durationWeeks={selected.durationWeeks}
              readOnly
            />
          )}
        </>
      )}
    </>
  );
}
