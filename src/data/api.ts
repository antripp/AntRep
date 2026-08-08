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
  ReactionPreset,
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
  /** Supabase has seen this address confirmed. Always true in demo mode. */
  emailConfirmed: boolean;
}

export interface AuthResult {
  error?: string;
  /** Signed up, but the address has to be confirmed before signing in. */
  needsConfirm?: boolean;
  /** A magic link or verification mail just went out. */
  sent?: boolean;
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
  /** Password-free sign-in: emails a one-tap link. */
  sendMagicLink(email: string): Promise<AuthResult>;
  /** Re-send the confirmation mail for an address that never got verified. */
  resendVerification(email: string): Promise<AuthResult>;
  /**
   * Move the account to a new address. Supabase mails it a confirmation; the
   * change only takes effect once that link is followed, and from then on the
   * old address can no longer sign in.
   */
  changeEmail(newEmail: string): Promise<AuthResult>;
  /** Clear the verification requirement once Supabase reports it confirmed. */
  markEmailVerified(): Promise<boolean>;
  /**
   * Create the profile for a confirmed account if it doesn't exist yet. With
   * email confirmation on there is no session at sign-up time, so the row can
   * only be written once the user comes back through the link.
   */
  ensureProfile(role: Role, displayName: string): Promise<AuthResult>;
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
  /**
   * Leave a preset reaction on a session or check-in. Replaces the coach's
   * previous reaction on that item. Free-text chat was removed in 008.
   */
  saveReaction(input: {
    linkId: string;
    senderProfileId: string;
    sessionId?: string | null;
    checkInId?: string | null;
    preset: ReactionPreset;
  }): Promise<void>;
  removeReaction(id: string): Promise<void>;
  markThreadRead(linkId: string, readerProfileId: string): Promise<void>;
  saveCheckIn(checkIn: CheckIn): Promise<void>;
  saveCoachNote(note: CoachNote): Promise<void>;
  deleteCoachNote(noteId: string): Promise<void>;
  saveTrackerTemplate(template: TrackerTemplate): Promise<void>;
  deleteTrackerTemplate(templateId: string): Promise<void>;
  saveTrackerEntry(entry: TrackerEntry): Promise<void>;
}
