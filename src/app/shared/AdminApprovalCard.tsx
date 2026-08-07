/**
 * Admin — approve or reject new signups.
 *
 * On a Supabase deployment every new profile starts unapproved and sees the
 * "Waiting for approval" screen until someone lets them in. This is that
 * someone's control panel.
 *
 * It renders nothing at all unless `check_is_admin` says so, so it's safe to
 * drop into Settings for everyone. The real authorisation lives in the
 * database — `approve_profile` and `reject_profile` re-check admin themselves.
 */

import { useCallback, useEffect, useState } from "react";
import { isDemoMode } from "../../data";
import { supabase } from "../../lib/supabase";
import { Button, Card, Pill, SectionHeader } from "../../ui/kit";

interface PendingProfile {
  id: string;
  role: string;
  display_name: string;
  created_at: string;
}

export default function AdminApprovalCard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: adminFlag } = await supabase.rpc("check_is_admin");
    const admin = Boolean(adminFlag);
    setIsAdmin(admin);
    if (admin) {
      const { data, error } = await supabase.rpc("list_pending_profiles");
      if (error) setMessage(error.message);
      else setPending((data as PendingProfile[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isDemoMode || loading || !isAdmin) return null;

  async function approve(profile: PendingProfile) {
    setBusyId(profile.id);
    setMessage(null);
    const { data, error } = await supabase.rpc("approve_profile", { p_profile_id: profile.id });
    if (error) setMessage(`Couldn't approve ${profile.display_name}: ${error.message}`);
    else if (!data) setMessage("Approve came back false — check the admin setup in Supabase.");
    else setMessage(`${profile.display_name} approved. They can open the app now.`);
    setBusyId(null);
    await load();
  }

  async function reject(profile: PendingProfile) {
    setBusyId(profile.id);
    setMessage(null);
    const { error } = await supabase.rpc("reject_profile", { p_profile_id: profile.id });
    if (error) setMessage(`Couldn't reject ${profile.display_name}: ${error.message}`);
    else setMessage(`${profile.display_name} removed.`);
    setBusyId(null);
    await load();
  }

  return (
    <>
      <SectionHeader title="Admin" />
      <Card tint="var(--color-gold)">
        <div className="mb-2 flex items-center gap-2">
          <p className="flex-1 text-sm font-black text-ink">
            {pending.length === 0
              ? "No accounts waiting"
              : `${pending.length} account${pending.length === 1 ? "" : "s"} waiting`}
          </p>
          <button
            className="rounded-full border border-line px-2.5 py-1 text-[11px] font-black text-muted"
            onClick={load}
          >
            Refresh
          </button>
        </div>

        <p className="mb-3 text-xs font-semibold leading-snug text-muted">
          New signups can't open the app until you approve them. Email addresses are never shown
          here. Once approved, coaches use <code className="rounded bg-inset px-1">/coach</code> and
          athletes use <code className="rounded bg-inset px-1">/</code>.
        </p>

        {message && <p className="mb-2 text-xs font-bold text-accent">{message}</p>}

        <div className="space-y-2">
          {pending.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-inset px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">{profile.display_name}</p>
                <p className="truncate text-[11px] font-bold text-muted">
                  {new Date(profile.created_at).toLocaleString()}
                </p>
              </div>
              <Pill tint="var(--t-accent)">{profile.role}</Pill>
              <Button size="sm" disabled={busyId === profile.id} onClick={() => approve(profile)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busyId === profile.id}
                onClick={() => reject(profile)}
              >
                Reject
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
