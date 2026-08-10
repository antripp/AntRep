/**
 * Training state for one athlete profile: plans in effect, sessions, logs and
 * every mutation the logger performs (start/stop the timer, save sets, mark an
 * exercise done, award XP). Screens stay declarative; the rules live here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../data";
import type { AthleteWorkspace } from "../data/api";
import { writeImport, type ImportOutcome } from "../data/importWriter";
import { makeSession } from "../data/factories";
import type {
  ExercisePreset,
  ExtraExercise,
  PlanAssignment,
  PlanBundle,
  PlanExercise,
  Profile,
  Session,
  SetLog,
} from "../data/types";
import { localDate } from "../domain/dates";
import { planEnd, planIsLive } from "../domain/plan";
import { exerciseXp, XP } from "../domain/gamification";
import { nameKey, namesMatch, progressFor, sessionFor } from "../domain/logging";
import type { ImportSession } from "../domain/importLog";
import type { ResolvedSegment } from "../domain/plan";

/** A plan that can schedule days, with the start date that applies to this athlete. */
export interface PlanView {
  bundle: PlanBundle;
  start: string;
  /** Effective last day — the assignment's override, else the plan's. */
  end?: string | null;
  /** Set when the plan reaches this athlete through a coach. */
  assignment?: PlanAssignment | null;
  /** False once the end date has passed, or the plan was switched off. */
  live?: boolean;
}

interface WorkspaceValue {
  profile: Profile;
  loading: boolean;
  workspace: AthleteWorkspace;
  /** Plans that drive today's schedule: the athlete's active plan + synced coach plans. */
  bundles: PlanBundle[];
  /** The same plans, with the start date that applies — a plan schedules nothing before it began. */
  planViews: PlanView[];
  /** Finished plans: still readable, still restartable, scheduling nothing. */
  pastViews: PlanView[];
  /** Every plan the athlete has ever followed, for reading back old sessions. */
  allBundles: PlanBundle[];
  sessions: Session[];
  logs: SetLog[];
  presets: ExercisePreset[];
  reload: () => Promise<void>;
  sessionForSegment: (segment: ResolvedSegment, date?: string) => Session | undefined;
  ensureSession: (segment: ResolvedSegment, date?: string) => Promise<Session>;
  /** The catch-all session for a date — extra work that isn't in the plan. */
  freeSession: (date?: string) => Session | undefined;
  ensureFreeSession: (date?: string) => Promise<Session>;
  addExtraExercise: (extra: ExtraExercise, date?: string) => Promise<Session>;
  removeExtraExercise: (session: Session, name: string) => Promise<void>;
  patchSession: (session: Session, patch: Partial<Session>) => Promise<Session>;
  saveSets: (session: Session, exerciseName: string, sets: SetLog[]) => Promise<void>;
  /** Write a reviewed spreadsheet import. Resolves with what actually landed. */
  importSessions: (
    batch: ImportSession[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<ImportOutcome>;
  /** `segment` is omitted for extra work that isn't part of a plan day. */
  setExerciseDone: (
    session: Session,
    exercise: PlanExercise,
    done: boolean,
    segment?: ResolvedSegment,
    loggedSetCount?: number,
  ) => Promise<void>;
  startTimer: (segment: ResolvedSegment) => Promise<Session>;
  pauseTimer: (session: Session) => Promise<void>;
  resumeTimer: (session: Session) => Promise<void>;
  endTimer: (session: Session) => Promise<void>;
  toast: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
}

const emptyWorkspace: AthleteWorkspace = {
  ownPlans: [],
  assigned: [],
  sessions: [],
  logs: [],
  presets: [],
  coaches: [],
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [workspace, setWorkspace] = useState<AthleteWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await api.athleteWorkspace(profile);
    setWorkspace(next);
    setLoading(false);
  }, [profile]);

  // Only the very first load blanks the screen. Later reloads keep the current
  // data on screen and swap it when the new data lands — otherwise any refresh
  // flashes a full-page spinner and unmounts whatever the user was reading.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!loadedOnce.current) setLoading(true);
    reload().finally(() => {
      loadedOnce.current = true;
    });
  }, [reload]);

  /**
   * Every plan the athlete follows, running or finished, with the dates that
   * apply to them. A finished plan keeps its entry so it can still be read —
   * `live` is what decides whether it schedules anything today.
   */
  const allViews = useMemo<PlanView[]>(() => {
    const today = localDate();
    const own = workspace.ownPlans
      .filter((b) => !b.plan.is_archived)
      .map((bundle) => ({
        bundle,
        start: bundle.plan.start_date,
        end: bundle.plan.end_date,
        assignment: null,
        live: planIsLive(bundle.plan, today),
      }));
    const synced = workspace.assigned
      .filter((a) => a.assignment.status === "active")
      .map((a) => ({
        bundle: a.bundle,
        start: a.assignment.start_date ?? a.bundle.plan.start_date,
        end: planEnd(a.bundle.plan, a.assignment),
        assignment: a.assignment,
        live: planIsLive(a.bundle.plan, today, a.assignment),
      }));
    return [...synced, ...own];
  }, [workspace]);

  /** The plans that drive Home and today's schedule. */
  const planViews = useMemo(() => allViews.filter((v) => v.live), [allViews]);

  /** Ran its course — readable, restartable, but scheduling nothing. */
  const pastViews = useMemo(() => allViews.filter((v) => !v.live), [allViews]);

  const bundles = useMemo(() => planViews.map((p) => p.bundle), [planViews]);

  /** Includes archived / swapped-out plans so old sessions still resolve. */
  const allBundles = useMemo(
    () => [...workspace.assigned.map((a) => a.bundle), ...workspace.ownPlans],
    [workspace],
  );

  const showToast = useCallback((message: string) => setToast(message), []);

  /**
   * Run a best-effort mutation: report a failed write as a toast instead of
   * rejecting. For the actions with no natural place to show an error — the
   * timer buttons, adding a scratch exercise — a rejected promise would be
   * swallowed by the click handler, which is the silence this whole fix exists
   * to remove. The logging path deliberately does NOT use this: it throws, so
   * the set row can say so where the numbers are.
   */
  const reportFailure = useCallback(
    (error: unknown, fallback: string) => {
      showToast(error instanceof Error ? error.message : fallback);
    },
    [showToast],
  );

  const sessionForSegment = useCallback(
    (segment: ResolvedSegment, date = localDate()) => sessionFor(workspace.sessions, segment, date),
    [workspace.sessions],
  );

  const upsertLocalSession = useCallback((session: Session) => {
    setWorkspace((w) => ({
      ...w,
      sessions: w.sessions.some((s) => s.id === session.id)
        ? w.sessions.map((s) => (s.id === session.id ? session : s))
        : [session, ...w.sessions],
    }));
  }, []);

  const ensureSession = useCallback(
    async (segment: ResolvedSegment, date = localDate()) => {
      const existing = sessionFor(workspace.sessions, segment, date);
      if (existing) return existing;

      const bundle = bundles.find((b) => b.days.some((d) => d.id === segment.dayId));
      const session = makeSession(profile.id, {
        day_title: segment.title,
        day_type: segment.dayType,
        plan_id: bundle?.plan.id ?? null,
        plan_day_id: segment.dayId,
        plan_segment_id: segment.segmentId,
        date,
        counts_as_gym: segment.countsAsGym,
        xp_awarded: XP.sessionStart,
        is_late_completion: date < localDate(),
      });
      const saved = await api.saveSession(session);
      upsertLocalSession(saved);
      await api.addXp(profile.id, XP.sessionStart, "Session started");
      return saved;
    },
    [workspace.sessions, bundles, profile.id, upsertLocalSession],
  );

  const freeSession = useCallback(
    (date = localDate()) =>
      workspace.sessions.find((s) => s.date === date && !s.plan_day_id && !s.plan_segment_id),
    [workspace.sessions],
  );

  const ensureFreeSession = useCallback(
    async (date = localDate()) => {
      const existing = freeSession(date);
      if (existing) return existing;
      const session = makeSession(profile.id, {
        day_title: "Extra work",
        day_type: "custom",
        date,
        counts_as_gym: true,
        xp_awarded: XP.sessionStart,
        is_late_completion: date < localDate(),
      });
      const saved = await api.saveSession(session);
      upsertLocalSession(saved);
      await api.addXp(profile.id, XP.sessionStart, "Extra session");
      return saved;
    },
    [freeSession, profile.id, upsertLocalSession],
  );

  const patchSession = useCallback(
    async (session: Session, patch: Partial<Session>) => {
      const next = { ...session, ...patch };
      upsertLocalSession(next);
      return api.saveSession(next);
    },
    [upsertLocalSession],
  );

  const saveSets = useCallback(
    async (session: Session, exerciseName: string, sets: SetLog[]) => {
      const numbered = sets.map((s, i) => ({ ...s, set_index: i + 1, session_id: session.id }));
      setWorkspace((w) => ({
        ...w,
        logs: [
          ...w.logs.filter((l) => l.session_id !== session.id || !namesMatch(l.exercise_name, exerciseName)),
          ...numbered,
        ],
      }));
      await api.replaceSets(session.id, exerciseName, numbered);
    },
    [],
  );

  /**
   * Write a reviewed import, keeping the on-screen data in step as it lands.
   *
   * The athlete owns these rows, so existing sessions are rewritten rather than
   * skipped — re-importing a corrected file updates it instead of duplicating.
   */
  const importSessions = useCallback(
    (batch: ImportSession[], onProgress?: (done: number, total: number) => void) =>
      writeImport({
        athleteId: profile.id,
        batch,
        allowUpdateExisting: true,
        onProgress,
        onSessionSaved: upsertLocalSession,
        onSetsSaved: (sessionId, exerciseName, sets) => {
          setWorkspace((w) => ({
            ...w,
            logs: [
              ...w.logs.filter(
                (l) => l.session_id !== sessionId || !namesMatch(l.exercise_name, exerciseName),
              ),
              ...sets,
            ],
          }));
        },
      }),
    [profile.id, upsertLocalSession],
  );

  const setExerciseDone = useCallback(
    async (
      session: Session,
      exercise: PlanExercise,
      done: boolean,
      segment?: ResolvedSegment,
      loggedSetCount?: number,
    ) => {
      // A save can be followed by another save before the caller receives the
      // refreshed session object. Always compare against the newest local row,
      // and make completion idempotent so editing an already-logged exercise
      // cannot create another XP/activity event.
      const current = workspace.sessions.find((s) => s.id === session.id) ?? session;
      const alreadyDone = current.completed_names.some((n) => namesMatch(n, exercise.name));
      if (alreadyDone === done) return;

      const others = current.completed_names.filter((n) => !namesMatch(n, exercise.name));
      const names = done ? [...others, exercise.name] : others;

      const progress = segment
        ? progressFor(segment, new Date(), { ...current, completed_names: names })
        : null;
      const complete = progress ? progress.isComplete : current.status === "complete";
      const justCompleted = Boolean(progress?.isComplete) && current.status !== "complete";
      const next = await patchSession(current, {
        completed_names: names,
        status: complete ? "complete" : "in_progress",
        ended_at: complete ? (current.ended_at ?? new Date().toISOString()) : current.ended_at,
      });

      if (done) {
        const setCount =
          loggedSetCount ??
          workspace.logs.filter(
            (l) => l.session_id === current.id && namesMatch(l.exercise_name, exercise.name),
          ).length;
        await api.addXp(profile.id, exerciseXp(setCount || 1, exercise.priority), exercise.name);
      }
      if (justCompleted) {
        await api.addXp(profile.id, XP.sessionComplete, "Session complete");
        showToast(`Session complete · +${XP.sessionComplete} XP`);
      }
      return void next;
    },
    [patchSession, profile.id, showToast, workspace.logs, workspace.sessions],
  );

  const addExtraExercise = useCallback(
    async (extra: ExtraExercise, date = localDate()) => {
      const session = await ensureFreeSession(date);
      if (session.extra_exercises.some((e) => nameKey(e.name) === nameKey(extra.name))) return session;
      return patchSession(session, { extra_exercises: [...session.extra_exercises, extra] });
    },
    [ensureFreeSession, patchSession],
  );

  const removeExtraExercise = useCallback(
    async (session: Session, name: string) => {
      try {
        await patchSession(session, {
          extra_exercises: session.extra_exercises.filter((e) => nameKey(e.name) !== nameKey(name)),
          completed_names: session.completed_names.filter((n) => nameKey(n) !== nameKey(name)),
        });
        await api.replaceSets(session.id, name, []);
        setWorkspace((w) => ({
          ...w,
          logs: w.logs.filter(
            (l) => l.session_id !== session.id || nameKey(l.exercise_name) !== nameKey(name),
          ),
        }));
      } catch (error) {
        reportFailure(error, `Couldn't remove ${name}.`);
      }
    },
    [patchSession, reportFailure],
  );

  const startTimer = useCallback(
    async (segment: ResolvedSegment) => {
      const session = await ensureSession(segment);
      const next = await patchSession(session, {
        timer_segments: [
          ...session.timer_segments,
          { started_at: new Date().toISOString(), ended_at: null, paused_seconds: 0 },
        ],
        started_at: session.started_at ?? new Date().toISOString(),
      });
      return next;
    },
    [ensureSession, patchSession],
  );

  const pauseTimer = useCallback(
    async (session: Session) => {
      const segments = [...session.timer_segments];
      const index = segments.findIndex((s) => !s.ended_at);
      if (index < 0) return;
      segments[index] = { ...segments[index], ended_at: new Date().toISOString() };
      try {
        await patchSession(session, { timer_segments: segments });
      } catch (error) {
        reportFailure(error, "Couldn't pause the timer.");
      }
    },
    [patchSession, reportFailure],
  );

  const resumeTimer = useCallback(
    async (session: Session) => {
      try {
        await patchSession(session, {
          timer_segments: [
            ...session.timer_segments,
            { started_at: new Date().toISOString(), ended_at: null, paused_seconds: 0 },
          ],
        });
      } catch (error) {
        reportFailure(error, "Couldn't resume the timer.");
      }
    },
    [patchSession, reportFailure],
  );

  const endTimer = useCallback(
    async (session: Session) => {
      const now = new Date().toISOString();
      const segments = session.timer_segments.map((s) => (s.ended_at ? s : { ...s, ended_at: now }));
      try {
        await patchSession(session, { timer_segments: segments, ended_at: now });
      } catch (error) {
        reportFailure(error, "Couldn't stop the timer.");
      }
    },
    [patchSession, reportFailure],
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      profile,
      loading,
      workspace,
      bundles,
      planViews,
      pastViews,
      allBundles,
      sessions: workspace.sessions,
      logs: workspace.logs,
      presets: workspace.presets,
      reload,
      sessionForSegment,
      ensureSession,
      freeSession,
      ensureFreeSession,
      addExtraExercise,
      removeExtraExercise,
      patchSession,
      saveSets,
      importSessions,
      setExerciseDone,
      startTimer,
      pauseTimer,
      resumeTimer,
      endTimer,
      toast,
      showToast,
      clearToast: () => setToast(null),
    }),
    [
      profile,
      loading,
      workspace,
      bundles,
      planViews,
      pastViews,
      allBundles,
      reload,
      sessionForSegment,
      ensureSession,
      freeSession,
      ensureFreeSession,
      addExtraExercise,
      removeExtraExercise,
      patchSession,
      saveSets,
      importSessions,
      setExerciseDone,
      startTimer,
      pauseTimer,
      resumeTimer,
      endTimer,
      toast,
      showToast,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

/** Sets already logged for an exercise in a session, ordered. */
export function setsForExercise(logs: SetLog[], sessionId: string | undefined, name: string): SetLog[] {
  if (!sessionId) return [];
  return logs
    .filter((l) => l.session_id === sessionId && nameKey(l.exercise_name) === nameKey(name))
    .sort((a, b) => a.set_index - b.set_index);
}
