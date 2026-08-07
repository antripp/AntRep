/**
 * The one interface the whole app talks to.
 *
 * Two implementations satisfy it: Supabase (the real backend) and an offline
 * demo store (local dev without a database). Screens never import either one
 * directly — they import `api` from `./index`.
 */

import type {
  AssignedPlan,
  CheckIn,
  CoachingBoard,
  CoachLink,
  CoachNote,
  ExercisePreset,
  LinkedAthlete,
  Message,
  PlanAssignment,
  PlanBundle,
  Profile,
  Role,
  Session,
  SetLog,
  TrackerEntry,
  TrackerTemplate,
} from "./types";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  error?: string;
  needsConfirm?: boolean;
}

export interface AthleteWorkspace {
  /** Plans this athlete built themselves. */
  ownPlans: PlanBundle[];
  /** Plans a coach assigned — `assignment.status` says whether they synced it. */
  assigned: AssignedPlan[];
  sessions: Session[];
  logs: SetLog[];
  presets: ExercisePreset[];
  coaches: { link: CoachLink; coach: Profile }[];
}

export interface CoachWorkspace {
  plans: PlanBundle[];
  athletes: LinkedAthlete[];
  pendingInvites: CoachLink[];
  assignments: PlanAssignment[];
}

export interface AthleteTraining {
  sessions: Session[];
  logs: SetLog[];
  /** Plans the athlete follows (coach-assigned and self-made). */
  plans: PlanBundle[];
  /** When each assigned plan started for them — adherence ignores earlier weeks. */
  assignments: PlanAssignment[];
  profile: Profile | null;
}

export interface Api {
  readonly isDemo: boolean;

  // ---- auth ----
  currentUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string, role: Role, displayName: string): Promise<AuthResult>;
  signOut(): Promise<void>;

  // ---- profiles ----
  myProfiles(): Promise<Profile[]>;
  enableRole(role: Role, displayName?: string): Promise<void>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>;

  // ---- coach <-> athlete linking ----
  createInvite(): Promise<{ code: string; expiresAt: string | null; error?: string }>;
  claimInvite(code: string): Promise<{ ok: boolean; error?: string }>;
  unlink(linkId: string, role: Role): Promise<void>;

  // ---- workspaces ----
  athleteWorkspace(profile: Profile): Promise<AthleteWorkspace>;
  coachWorkspace(profile: Profile): Promise<CoachWorkspace>;
  athleteTraining(athleteId: string): Promise<AthleteTraining>;

  // ---- plans ----
  savePlan(bundle: PlanBundle): Promise<void>;
  deletePlan(planId: string): Promise<void>;
  assignPlan(planId: string, athleteId: string): Promise<void>;
  unassignPlan(assignmentId: string): Promise<void>;
  setAssignmentStatus(
    assignmentId: string,
    status: PlanAssignment["status"],
    startDate?: string | null,
  ): Promise<void>;

  // ---- sessions ----
  saveSession(session: Session): Promise<Session>;
  deleteSession(sessionId: string): Promise<void>;
  replaceSets(sessionId: string, exerciseName: string, sets: SetLog[]): Promise<void>;

  // ---- library ----
  savePreset(preset: ExercisePreset): Promise<void>;
  deletePreset(presetId: string): Promise<void>;

  // ---- gamification ----
  addXp(profileId: string, amount: number, reason: string): Promise<void>;

  // ---- coaching tools (chat, check-ins, notes, trackers) ----
  coachingBoard(linkId: string): Promise<CoachingBoard>;
  /** Unread counts per link for the given reader. */
  unreadCounts(linkIds: string[], readerProfileId: string): Promise<Record<string, number>>;
  sendMessage(linkId: string, senderProfileId: string, body: string): Promise<Message>;
  markThreadRead(linkId: string, readerProfileId: string): Promise<void>;
  saveCheckIn(checkIn: CheckIn): Promise<void>;
  saveCoachNote(note: CoachNote): Promise<void>;
  deleteCoachNote(noteId: string): Promise<void>;
  saveTrackerTemplate(template: TrackerTemplate): Promise<void>;
  deleteTrackerTemplate(templateId: string): Promise<void>;
  saveTrackerEntry(entry: TrackerEntry): Promise<void>;
}
