import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { computeProgressionGrid, currentProgramWeek, overrideKey } from "../../lib/progression";
import { computeProgressionAnalytics } from "../../lib/analytics";
import { fetchCoachLinkContext, fetchProgressionLogs } from "../../lib/coachLinkData";
import {
  computePlanProgramMismatch,
  fetchPlanExerciseNames,
  hasPlanProgramMismatch,
  syncProgramFromPlan,
} from "../../lib/planSync";
import { isSchemaOutdated, MigrationNotice } from "../../components/MigrationNotice";
import { useRealtime } from "../../lib/useRealtime";
import { Avatar, Button, Card, Chip, EmptyState, Segmented, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { athleteDisplayName } from "./AthletesPage";
import type { LinkedAthlete } from "./CoachApp";
import ProgramSetupForm from "./ProgramSetupForm";
import ProgressionExerciseEditor from "./ProgressionExerciseEditor";
import AthleteSessionsPanel from "./AthleteSessionsPanel";
import ProgressionGrid from "../shared/ProgressionGrid";
import ProgressionCharts from "../shared/ProgressionCharts";
import PlanProgramBanner from "../shared/PlanProgramBanner";
import { CheckInHistory } from "../shared/CheckInForm";
import CoachNotesList from "../shared/CoachNotesList";
import AssessmentsPanel from "../shared/AssessmentsPanel";
import { exportWarriorWorkbook } from "../../lib/exportXlsx";
import type { ClientProfileData } from "../../lib/trackers";
import type { AthleteProgram, Session, SetLog } from "../../lib/types";

type DetailView = "overview" | "sessions" | "program" | "progress" | "analytics" | "assess";

export default function AthleteDetailPage({
  athlete,
  initialView = "overview",
  onBack,
  onOpenInbox,
}: {
  athlete: LinkedAthlete;
  initialView?: DetailView;
  onBack: () => void;
  onOpenInbox: (linkId: string) => void;
}) {
  const { profile } = useAuth();
  const [view, setView] = useState<DetailView>(initialView);
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof fetchCoachLinkContext>>>(null);
  const [gridRows, setGridRows] = useState<ReturnType<typeof computeProgressionGrid>>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [planExerciseNames, setPlanExerciseNames] = useState<string[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [schemaOld, setSchemaOld] = useState(false);

  const name = athleteDisplayName(athlete.link, athlete.athlete);

  const load = useCallback(async (silent = false) => {
    if (!profile) return;
    if (!silent) setLoading(true);
    try {
      const context = await fetchCoachLinkContext(profile.id, athlete.athlete.id);
      setCtx(context);
      if (context) {
        const programStart = context.program?.start_date ?? context.planStart;
        const { sessions: sess, setLogs: logs } = await fetchProgressionLogs(
          athlete.athlete.id,
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
          computeProgressionGrid(context.progressionExercises, logs, sess, program, context.planStart),
        );
        if (context.activePlan) {
          setPlanExerciseNames(await fetchPlanExerciseNames(context.activePlan.plan.id));
        } else setPlanExerciseNames([]);
      }
    } catch (e) {
      setSchemaOld(isSchemaOutdated(e as never));
    }
    setLoading(false);
  }, [profile, athlete.athlete.id]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(
    `athlete-detail-${athlete.athlete.id}`,
    ["athlete_programs", "progression_exercises", "check_ins", "coach_notes", "set_logs", "sessions",
      "athlete_client_profiles", "tracker_templates", "tracker_entries", "plan_assignments", "plans"],
    () => load(true),
  );

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
    return computeProgressionAnalytics(gridRows, sessions, setLogs, ctx.checkIns, programStart, ctx.durationWeeks, metric);
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

  async function handleSyncFromPlan() {
    if (!ctx?.activePlan) return;
    setSyncBusy(true);
    await syncProgramFromPlan(ctx.link.id, ctx.activePlan.plan, ctx.activePlan.assignment.start_date);
    await load(true);
    setSyncBusy(false);
  }

  async function handleExport() {
    if (!ctx?.program) return;
    const [{ data: cp }, { data: tpls }, { data: ents }] = await Promise.all([
      supabase.from("athlete_client_profiles").select("profile").eq("coach_link_id", ctx.link.id).maybeSingle(),
      supabase.from("tracker_templates").select("*").eq("coach_link_id", ctx.link.id).eq("is_active", true),
      supabase.from("tracker_entries").select("*").eq("coach_link_id", ctx.link.id),
    ]);
    exportWarriorWorkbook({
      athleteName: name,
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

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm font-extrabold text-accent">
          ← Back
        </button>
        <Avatar name={name} avatar={athlete.athlete.avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black">{name}</h1>
        </div>
        <Button variant="secondary" className="text-xs" onClick={() => onOpenInbox(athlete.link.id)}>
          Message
        </Button>
      </div>

      {schemaOld && (
        <div className="mb-3">
          <MigrationNotice />
        </div>
      )}

      <div className="mb-4 overflow-x-auto">
        <Segmented
          options={[
            { key: "overview", label: "Overview" },
            { key: "sessions", label: "Sessions" },
            { key: "program", label: "Program" },
            { key: "progress", label: "Progress" },
            { key: "analytics", label: "Analytics" },
            { key: "assess", label: "Assess" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : !ctx ? (
        <Card>
          <EmptyState title="Couldn't load athlete data" />
        </Card>
      ) : view === "overview" ? (
        <div className="flex flex-col gap-3">
          <Card>
            <div className="mb-2 flex flex-wrap gap-2">
              <Chip label={`Week ${weekNow} / ${ctx.durationWeeks}`} />
              {ctx.activePlan && <Chip label={ctx.activePlan.plan.name} />}
            </div>
            {program?.goals ? (
              <p className="text-sm font-semibold text-muted">{program.goals}</p>
            ) : (
              <p className="text-sm font-semibold text-muted">No program goals set yet.</p>
            )}
          </Card>
          <Card>
            <h3 className="mb-1 font-black">This week check-in</h3>
            {currentCheckIn ? (
              <CheckInHistory checkIns={[currentCheckIn]} />
            ) : (
              <p className="text-sm font-semibold text-muted">Not submitted yet.</p>
            )}
          </Card>
          {ctx.coachNotes[0] && (
            <Card>
              <h3 className="mb-1 font-black">Latest note</h3>
              <p className="text-sm font-semibold">{ctx.coachNotes[0].observation || ctx.coachNotes[0].adjustment}</p>
            </Card>
          )}
        </div>
      ) : view === "sessions" ? (
        <AthleteSessionsPanel athleteId={athlete.athlete.id} athleteName={name} />
      ) : view === "program" ? (
        <div className="flex flex-col gap-4">
          {mismatch && hasPlanProgramMismatch(mismatch) && (
            <PlanProgramBanner mismatch={mismatch} onSync={handleSyncFromPlan} busy={syncBusy} />
          )}
          <ProgramSetupForm
            coachLinkId={ctx.link.id}
            program={ctx.program}
            defaultStartDate={ctx.planStart}
            onSaved={() => load(true)}
          />
          <ProgressionExerciseEditor
            coachLinkId={ctx.link.id}
            exercises={ctx.progressionExercises}
            activePlan={ctx.activePlan}
            onChanged={() => load(true)}
          />
          <CoachNotesList notes={ctx.coachNotes} coachLinkId={ctx.link.id} onChanged={() => load(true)} />
        </div>
      ) : view === "progress" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
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
          {ctx.checkIns.length > 0 && <CheckInHistory checkIns={ctx.checkIns} />}
        </div>
      ) : view === "analytics" && analytics ? (
        <ProgressionCharts analytics={analytics} metric={metric} />
      ) : view === "assess" ? (
        <AssessmentsPanel
          coachLinkId={ctx.link.id}
          athleteProfileId={athlete.athlete.id}
          programStart={programStart}
          durationWeeks={ctx.durationWeeks}
        />
      ) : null}
    </>
  );
}
