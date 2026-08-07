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
import { makeSession } from "../data/factories";
import type {
  ExercisePreset,
  ExtraExercise,
  PlanBundle,
  PlanExercise,
  Profile,
  Session,
  SetLog,
} from "../data/types";
import { localDate } from "../domain/dates";
import { exerciseXp, XP } from "../domain/gamification";
import { nameKey, namesMatch, progressFor, sessionFor } from "../domain/logging";
import type { ResolvedSegment } from "../domain/plan";

/** A plan that can schedule days, with the start date that applies to this athlete. */
export interface PlanView {
  bundle: PlanBundle;
  start: string;
}

interface WorkspaceValue {
  profile: Profile;
  loading: boolean;
  workspace: AthleteWorkspace;
  /** Plans that drive today's schedule: the athlete's active plan + synced coach plans. */
  bundles: PlanBundle[];
  /** The same plans, with the start date that applies — a plan schedules nothing before it began. */
  planViews: PlanView[];
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
  /** `segment` is omitted for extra work that isn't part of a plan day. */
  setExerciseDone: (
    session: Session,
    exercise: PlanExercise,
    done: boolean,
    segment?: ResolvedSegment,
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

  /** Own active plan + coach plans the athlete has synced, with their start dates. */
  const planViews = useMemo<PlanView[]>(() => {
    const own = workspace.ownPlans
      .filter((b) => b.plan.is_active && !b.plan.is_archived)
      .map((bundle) => ({ bundle, start: bundle.plan.start_date }));
    const synced = workspace.assigned
      .filter((a) => a.assignment.status === "active" && a.bundle.plan.is_active)
      .map((a) => ({
        bundle: a.bundle,
        start: a.assignment.start_date ?? a.bundle.plan.start_date,
      }));
    return [...synced, ...own];
  }, [workspace]);

  const bundles = useMemo(() => planViews.map((p) => p.bundle), [planViews]);

  /** Includes archived / swapped-out plans so old sessions still resolve. */
  const allBundles = useMemo(
    () => [...workspace.assigned.map((a) => a.bundle), ...workspace.ownPlans],
    [workspace],
  );

  const showToast = useCallback((message: string) => setToast(message), []);

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

  const setExerciseDone = useCallback(
    async (session: Session, exercise: PlanExercise, done: boolean, segment?: ResolvedSegment) => {
      const others = session.completed_names.filter((n) => !namesMatch(n, exercise.name));
      const names = done ? [...others, exercise.name] : others;

      const progress = segment
        ? progressFor(segment, new Date(), { ...session, completed_names: names })
        : null;
      const complete = progress ? progress.isComplete : session.status === "complete";
      const justCompleted = Boolean(progress?.isComplete) && session.status !== "complete";
      const next = await patchSession(session, {
        completed_names: names,
        status: complete ? "complete" : "in_progress",
        ended_at: complete ? (session.ended_at ?? new Date().toISOString()) : session.ended_at,
      });

      if (done) {
        const setCount = workspace.logs.filter(
          (l) => l.session_id === session.id && namesMatch(l.exercise_name, exercise.name),
        ).length;
        await api.addXp(profile.id, exerciseXp(setCount || 1, exercise.priority), exercise.name);
      }
      if (justCompleted) {
        await api.addXp(profile.id, XP.sessionComplete, "Session complete");
        showToast(`Session complete · +${XP.sessionComplete} XP`);
      }
      return void next;
    },
    [patchSession, profile.id, saveSets, showToast, workspace.logs],
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
      await patchSession(session, {
        extra_exercises: session.extra_exercises.filter((e) => nameKey(e.name) !== nameKey(name)),
        completed_names: session.completed_names.filter((n) => nameKey(n) !== nameKey(name)),
      });
      await api.replaceSets(session.id, name, []);
      setWorkspace((w) => ({
        ...w,
        logs: w.logs.filter((l) => l.session_id !== session.id || nameKey(l.exercise_name) !== nameKey(name)),
      }));
    },
    [patchSession],
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
      await patchSession(session, { timer_segments: segments });
    },
    [patchSession],
  );

  const resumeTimer = useCallback(
    async (session: Session) => {
      await patchSession(session, {
        timer_segments: [
          ...session.timer_segments,
          { started_at: new Date().toISOString(), ended_at: null, paused_seconds: 0 },
        ],
      });
    },
    [patchSession],
  );

  const endTimer = useCallback(
    async (session: Session) => {
      const now = new Date().toISOString();
      const segments = session.timer_segments.map((s) => (s.ended_at ? s : { ...s, ended_at: now }));
      await patchSession(session, { timer_segments: segments, ended_at: now });
    },
    [patchSession],
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      profile,
      loading,
      workspace,
      bundles,
      planViews,
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
