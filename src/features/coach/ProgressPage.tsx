import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  computeProgressionGrid,
  currentProgramWeek,
  overrideKey,
} from "../../lib/progression";
import { computeProgressionAnalytics } from "../../lib/analytics";
import {
  fetchCoachLinkContext,
  fetchProgressionLogs,
  type CoachLinkContext,
} from "../../lib/coachLinkData";
import {
  computePlanProgramMismatch,
  fetchPlanExerciseNames,
  hasPlanProgramMismatch,
  syncProgramFromPlan,
} from "../../lib/planSync";
import { isSchemaOutdated, MigrationNotice } from "../../components/MigrationNotice";
import { useRealtime } from "../../lib/useRealtime";
import { Card, EmptyState, Segmented, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { AthletePicker, type LinkedAthlete } from "./CoachApp";
import { athleteDisplayName } from "./AthletesPage";
import ProgramSetupForm from "./ProgramSetupForm";
import ProgressionExerciseEditor from "./ProgressionExerciseEditor";
import ProgressionGrid from "../shared/ProgressionGrid";
import ProgressionCharts from "../shared/ProgressionCharts";
import PlanProgramBanner from "../shared/PlanProgramBanner";
import { CheckInHistory } from "../shared/CheckInForm";
import CoachNotesList from "../shared/CoachNotesList";
import AssessmentsPanel from "../shared/AssessmentsPanel";
import MessageThread from "../shared/MessageThread";
import { exportWarriorWorkbook } from "../../lib/exportXlsx";
import type { ClientProfileData } from "../../lib/trackers";
import { Button } from "../../components/ui";
import type { AthleteProgram, Message, Session, SetLog } from "../../lib/types";

export default function ProgressPage({
  athletes,
  selectedId,
  onSelectAthlete,
}: {
  athletes: LinkedAthlete[];
  selectedId: string | null;
  onSelectAthlete: (id: string) => void;
}) {
  const { profile } = useAuth();
  const [view, setView] = useState<"track" | "analytics" | "assess" | "connect">("track");
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<CoachLinkContext | null>(null);
  const [gridRows, setGridRows] = useState<ReturnType<typeof computeProgressionGrid>>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [planExerciseNames, setPlanExerciseNames] = useState<string[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [schemaOld, setSchemaOld] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!profile || !selectedId) {
      setCtx(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const context = await fetchCoachLinkContext(profile.id, selectedId);
      setCtx(context);
      if (context) {
        const programStart = context.program?.start_date ?? context.planStart;
        const { sessions: sess, setLogs: logs } = await fetchProgressionLogs(
          selectedId,
          programStart,
          context.durationWeeks,
        );
        setSessions(sess);
        setSetLogs(logs);
        const program: AthleteProgram = context.program ?? {
          id: "",
          coach_link_id: context.link.id,
          goals: "",
          duration_weeks: context.durationWeeks,
          assessment_date: null,
          start_date: programStart,
          progression_metric: "max_weight",
          progression_overrides: {},
        };
        setGridRows(
          computeProgressionGrid(
            context.progressionExercises,
            logs,
            sess,
            program,
            context.planStart,
          ),
        );
        if (context.activePlan) {
          const names = await fetchPlanExerciseNames(context.activePlan.plan.id);
          setPlanExerciseNames(names);
        } else {
          setPlanExerciseNames([]);
        }
      }
    } catch (e) {
      const err = e as { code?: string };
      setSchemaOld(isSchemaOutdated(err as never));
    }
    setLoading(false);
  }, [profile, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(
    "coach-progress",
    ["athlete_programs", "progression_exercises", "check_ins", "coach_notes", "messages", "set_logs", "sessions",
      "athlete_client_profiles", "tracker_templates", "tracker_entries", "plan_assignments", "plans", "plan_exercises"],
    () => load(true),
  );

  const selectedAthlete = athletes.find((a) => a.athlete.id === selectedId);
  const program = ctx?.program;
  const programStart = program?.start_date ?? ctx?.planStart ?? "";
  const metric = program?.progression_metric ?? "max_weight";
  const weekNow = ctx
    ? currentProgramWeek({ start_date: programStart, duration_weeks: ctx.durationWeeks }, ctx.planStart)
    : 1;
  const currentCheckIn = ctx?.checkIns.find((c) => c.week_index === weekNow) ?? null;

  const mismatch = useMemo(() => {
    if (!ctx?.activePlan) return null;
    return computePlanProgramMismatch(
      ctx.activePlan.plan,
      ctx.activePlan.assignment.start_date,
      ctx.program,
      ctx.progressionExercises,
      planExerciseNames,
    );
  }, [ctx, planExerciseNames]);

  const analytics = useMemo(() => {
    if (!ctx) return null;
    return computeProgressionAnalytics(
      gridRows,
      sessions,
      setLogs,
      ctx.checkIns,
      programStart,
      ctx.durationWeeks,
      metric,
    );
  }, [ctx, gridRows, sessions, setLogs, programStart, metric]);

  async function saveOverride(exerciseName: string, weekIndex: number, value: number | null) {
    if (!ctx?.program) return;
    const key = overrideKey(exerciseName, weekIndex);
    const next = { ...(ctx.program.progression_overrides ?? {}) };
    if (value == null) delete next[key];
    else next[key] = value;
    await supabase
      .from("athlete_programs")
      .update({ progression_overrides: next, updated_at: new Date().toISOString() })
      .eq("id", ctx.program.id);
    await load(true);
  }

  async function ensureProgram(saved: AthleteProgram) {
    setCtx((c) => (c ? { ...c, program: saved } : c));
    await load(true);
  }

  function onNewMessage(msg: Message) {
    setCtx((c) => (c ? { ...c, messages: [...c.messages, msg] } : c));
  }

  async function handleSyncFromPlan() {
    if (!ctx?.activePlan) return;
    setSyncBusy(true);
    await syncProgramFromPlan(
      ctx.link.id,
      ctx.activePlan.plan,
      ctx.activePlan.assignment.start_date,
    );
    await load(true);
    setSyncBusy(false);
  }

  async function handleExport() {
    if (!ctx || !selectedAthlete || !ctx.program) return;
    const [{ data: cp }, { data: tpls }, { data: ents }] = await Promise.all([
      supabase.from("athlete_client_profiles").select("profile").eq("coach_link_id", ctx.link.id).maybeSingle(),
      supabase.from("tracker_templates").select("*").eq("coach_link_id", ctx.link.id).eq("is_active", true),
      supabase.from("tracker_entries").select("*").eq("coach_link_id", ctx.link.id),
    ]);
    exportWarriorWorkbook({
      athleteName: athleteDisplayName(selectedAthlete.link, selectedAthlete.athlete),
      coachName: profile?.display_name ?? "Coach",
      program: ctx.program,
      grid: gridRows,
      checkIns: ctx.checkIns,
      coachNotes: ctx.coachNotes,
      metric: ctx.program.progression_metric,
      clientProfile: (cp as { profile?: ClientProfileData })?.profile,
      templates: (tpls as never) ?? [],
      trackerEntries: (ents as never) ?? [],
    });
  }

  if (athletes.length === 0) {
    return (
      <Card>
        <EmptyState title="Link an athlete first" subtitle="Create an invite code on the Athletes tab." />
      </Card>
    );
  }

  return (
    <>
      <h1 className="mb-3 text-2xl font-black">Progress</h1>
      <AthletePicker athletes={athletes} selectedId={selectedId} onSelect={onSelectAthlete} />

      {schemaOld && (
        <div className="mb-3">
          <MigrationNotice />
        </div>
      )}

      <div className="mb-3 w-full overflow-x-auto">
        <Segmented
          options={[
            { key: "track", label: "Track" },
            { key: "analytics", label: "Analytics" },
            { key: "assess", label: "Assess" },
            { key: "connect", label: "Connect" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : !ctx || !selectedAthlete ? (
        <Card>
          <EmptyState title="Select an athlete" />
        </Card>
      ) : view === "analytics" && analytics ? (
        <ProgressionCharts analytics={analytics} metric={metric} />
      ) : view === "assess" ? (
        <AssessmentsPanel
          coachLinkId={ctx.link.id}
          athleteProfileId={selectedAthlete.athlete.id}
          programStart={programStart}
          durationWeeks={ctx.durationWeeks}
        />
      ) : view === "connect" ? (
        <div className="flex flex-col gap-4">
          <CoachNotesList notes={ctx.coachNotes} coachLinkId={ctx.link.id} onChanged={() => load(true)} />
          <Card>
            <h3 className="mb-2 font-black">Messages</h3>
            <MessageThread
              coachLinkId={ctx.link.id}
              messages={ctx.messages}
              myProfile={profile!}
              otherName={athleteDisplayName(selectedAthlete.link, selectedAthlete.athlete)}
              onNewMessage={onNewMessage}
            />
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mismatch && hasPlanProgramMismatch(mismatch) && (
            <PlanProgramBanner mismatch={mismatch} onSync={handleSyncFromPlan} busy={syncBusy} />
          )}
          <ProgramSetupForm
            coachLinkId={ctx.link.id}
            program={ctx.program}
            defaultStartDate={ctx.planStart}
            onSaved={ensureProgram}
          />
          <ProgressionExerciseEditor
            coachLinkId={ctx.link.id}
            exercises={ctx.progressionExercises}
            activePlan={ctx.activePlan}
            onChanged={() => load(true)}
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-black">Progressive overload</h3>
              {ctx.program && gridRows.length > 0 && (
                <Button variant="secondary" className="text-xs" onClick={handleExport}>
                  Export workbook
                </Button>
              )}
            </div>
            <ProgressionGrid
              rows={gridRows}
              metric={metric}
              readOnly={!ctx.program}
              onCellEdit={ctx.program ? saveOverride : undefined}
            />
          </div>
          <Card>
            <h3 className="mb-2 font-black">Check-ins — week {weekNow}</h3>
            {currentCheckIn ? (
              <CheckInHistory checkIns={[currentCheckIn]} />
            ) : (
              <p className="text-sm font-semibold text-muted">Athlete hasn't submitted this week yet.</p>
            )}
          </Card>
          {ctx.checkIns.length > 0 && <CheckInHistory checkIns={ctx.checkIns} />}
        </div>
      )}
    </>
  );
}
