import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchCoachLinkContext } from "../../lib/coachLinkData";
import { localDateString, type AthleteProgram, type CoachLink, type Session } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { isSchemaOutdated, MigrationNotice } from "../../components/MigrationNotice";
import { Avatar, Button, Card, EmptyState } from "../../components/ui";
import { UnlinkModal } from "../../components/SettingsShared";
import { useAuth } from "../auth/useAuth";
import type { LinkedAthlete } from "./CoachApp";

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const mins = Math.ceil(ms / 60000);
  return mins === 1 ? "1 min left" : `${mins} min left`;
}

/** Label for roster — self-linked coach-athlete shows as "My Workout". */
export function athleteDisplayName(link: CoachLink, athlete: { display_name: string }): string {
  if (link.is_self_link) return "My Workout";
  return athlete.display_name;
}

export default function AthletesPage({
  athletes,
  onChanged,
  onSelect,
  onOpenProgress,
  onOpenInbox,
  unreadByAthlete = new Map(),
  recentSessions = [],
}: {
  athletes: LinkedAthlete[];
  onChanged: () => Promise<void> | void;
  onSelect: (athleteId: string) => void;
  onOpenProgress: (athleteId: string) => void;
  onOpenInbox?: (linkId: string) => void;
  unreadByAthlete?: Map<string, number>;
  recentSessions?: Session[];
}) {
  const { profile } = useAuth();
  const [pending, setPending] = useState<(CoachLink & { invite_code: string })[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedAthlete | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Map<string, AthleteProgram | null>>(new Map());
  const [schemaOld, setSchemaOld] = useState(false);

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from("coach_links").select("*").eq("status", "pending");
    setPending(((data as CoachLink[]) ?? []).filter((l) => l.invite_code) as (CoachLink & { invite_code: string })[]);
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);
  useRealtime("coach-roster", ["coach_links", "sessions", "athlete_programs"], () => {
    loadPending();
    loadPrograms();
  });

  const loadPrograms = useCallback(async () => {
    if (!profile || athletes.length === 0) return;
    const progMap = new Map<string, AthleteProgram | null>();
    for (const { link, athlete } of athletes) {
      try {
        const ctx = await fetchCoachLinkContext(profile.id, athlete.id);
        progMap.set(link.id, ctx?.program ?? null);
      } catch (e) {
        if (isSchemaOutdated(e as never)) setSchemaOld(true);
      }
    }
    setPrograms(progMap);
  }, [profile, athletes]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  async function createInvite() {
    setBusy(true);
    setInviteError(null);
    const { data, error } = await supabase.rpc("create_invite");
    if (error) {
      const msg =
        error.code === "PGRST202" || error.message.includes("404")
          ? "Invite RPC missing in Supabase — run the invite database setup in the SQL editor."
          : error.message;
      setInviteError(msg);
    } else if (data?.[0]) {
      await loadPending();
    }
    setBusy(false);
  }

  async function regenerateInvite(linkId: string) {
    const { error } = await supabase.rpc("regenerate_invite", { p_link_id: linkId });
    if (!error) await loadPending();
  }

  async function deleteInvite(id: string) {
    await supabase.from("coach_links").delete().eq("id", id);
    await loadPending();
  }

  async function unlinkAthlete(linkId: string) {
    const { data, error } = await supabase.rpc("unlink_athlete", { p_link_id: linkId });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not unlink — try again.");
    await onChanged();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  function athleteStats(athleteId: string): string {
    const sessions = recentSessions.filter((s) => s.athlete_id === athleteId);
    if (sessions.length === 0) return "No sessions in the last 4 weeks";
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() === 0 ? 7 : monday.getDay()) - 1));
    const thisWeek = sessions.filter((s) => s.date >= localDateString(monday)).length;
    const last = sessions[0];
    const lastLabel = new Date(`${last.date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${thisWeek} session${thisWeek === 1 ? "" : "s"} this week · last: ${lastLabel}`;
  }

  return (
    <>
      {schemaOld && (
        <div className="mb-3">
          <MigrationNotice />
        </div>
      )}
      <div className="flex flex-col gap-3">
        {athletes.length === 0 && pending.length === 0 && (
          <Card>
            <EmptyState
              title="No athletes yet"
              subtitle="Create an invite code and send it to your athlete — codes expire in 30 minutes."
            />
          </Card>
        )}

        {athletes.map(({ link, athlete }) => (
          <Card key={link.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => onSelect(athlete.id)}
            >
              <Avatar name={athleteDisplayName(link, athlete)} avatar={athlete.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-extrabold">{athleteDisplayName(link, athlete)}</p>
                  {(unreadByAthlete.get(athlete.id) ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black text-white">
                      {unreadByAthlete.get(athlete.id)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-semibold text-muted">{athleteStats(athlete.id)}</p>
                {programs.get(link.id)?.goals && (
                  <p className="mt-0.5 truncate text-xs font-semibold text-accent">{programs.get(link.id)!.goals}</p>
                )}
              </div>
              <span className="text-muted">›</span>
            </button>
            <div className="mt-2 flex flex-wrap gap-2 border-t-2 border-line pt-2">
              <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => onOpenProgress(athlete.id)}>
                Details
              </Button>
              {onOpenInbox && (
                <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => onOpenInbox(link.id)}>
                  Message
                </Button>
              )}
              {!link.is_self_link && (
                <Button variant="ghost" className="px-2 py-1 text-xs text-danger" onClick={() => setUnlinkTarget({ link, athlete })}>
                  Unlink
                </Button>
              )}
            </div>
          </Card>
        ))}

        {pending.length > 0 && (
          <Card>
            <h2 className="mb-2 font-black">Pending invites</h2>
            <p className="mb-2 text-xs font-semibold text-muted">One-time codes · expire in 30 minutes</p>
            <div className="flex flex-col gap-2">
              {pending.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-inset px-3 py-2">
                  <code className="text-base font-black tracking-widest">{l.invite_code}</code>
                  <span className="text-xs font-bold text-muted">
                    {l.expires_at ? formatExpiry(l.expires_at) : ""}
                  </span>
                  <Button variant="secondary" onClick={() => copyCode(l.invite_code!)}>
                    {copied === l.invite_code ? "Copied!" : "Copy"}
                  </Button>
                  <Button variant="ghost" className="text-xs" onClick={() => regenerateInvite(l.id)}>
                    Regenerate
                  </Button>
                  <Button variant="ghost" onClick={() => deleteInvite(l.id)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Button onClick={createInvite} disabled={busy}>
          {busy ? "…" : "+ New invite code"}
        </Button>
        {inviteError && (
          <p className="text-xs font-bold text-danger">{inviteError}</p>
        )}
      </div>

      {unlinkTarget && (
        <UnlinkModal
          title={`Unlink ${athleteDisplayName(unlinkTarget.link, unlinkTarget.athlete)}?`}
          description="Their plan assignments to your plans will be removed. Their logged sessions stay on their account."
          confirmLabel="UNLINK"
          onConfirm={() => unlinkAthlete(unlinkTarget.link.id)}
          onClose={() => setUnlinkTarget(null)}
        />
      )}
    </>
  );
}
