import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachLink, Profile } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { Avatar, Button, Card, TextInput } from "../../components/ui";
import {
  AdminApprovalCard,
  AvatarCard,
  DeleteAccountCard,
  PatternLabCard,
  RoleSwitchCard,
  ThemeCard,
  UnlinkModal,
} from "../../components/SettingsShared";
import { useAuth } from "../auth/useAuth";

export default function AthleteSettingsPage() {
  const { profile, refreshProfiles, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [code, setCode] = useState("");
  const [links, setLinks] = useState<(CoachLink & { coach?: Profile })[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<(CoachLink & { coach?: Profile }) | null>(null);

  const loadLinks = useCallback(async () => {
    const { data } = await supabase.from("coach_links").select("*").eq("status", "active");
    const linkRows = ((data as CoachLink[]) ?? []).filter((l) => !l.is_self_link);
    let coaches: Profile[] = [];
    if (linkRows.length > 0) {
      const { data: coachRows } = await supabase
        .from("profiles")
        .select("*")
        .in("id", linkRows.map((l) => l.trainer_id));
      coaches = (coachRows as Profile[]) ?? [];
    }
    setLinks(linkRows.map((l) => ({ ...l, coach: coaches.find((c) => c.id === l.trainer_id) })));
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);
  useRealtime("athlete-settings", ["coach_links"], loadLinks);

  async function saveName() {
    if (!profile) return;
    await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile.id);
    await refreshProfiles();
    setMessage("Saved!");
  }

  async function claim() {
    setMessage(null);
    const { data, error } = await supabase.rpc("claim_invite", { p_code: code.trim() });
    if (error) setMessage(error.message);
    else if (data === true) {
      setMessage("Linked to your coach! 🎉");
      setCode("");
      await loadLinks();
    } else {
      setMessage("That code didn't work — it may have expired. Ask your coach for a fresh one.");
    }
  }

  async function unlinkCoach(linkId: string) {
    const { data, error } = await supabase.rpc("unlink_coach", { p_link_id: linkId });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not unlink — try again.");
    await loadLinks();
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-black">Settings</h1>
      <div className="flex flex-col gap-3">
        <Card>
          <h2 className="mb-2 font-black">Display name</h2>
          <div className="flex gap-2">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={saveName}>Save</Button>
          </div>
        </Card>

        <AvatarCard />
        <ThemeCard />
        <PatternLabCard />
        <RoleSwitchCard />
        <AdminApprovalCard />

        <Card>
          <h2 className="mb-1 font-black">Your coaches</h2>
          <p className="mb-2 text-xs font-semibold text-muted">
            You can train with more than one coach — each plan shows up as its own segment on Today.
          </p>
          {links.map((l) => (
            <div key={l.id} className="mb-1 flex items-center gap-3 rounded-xl bg-inset px-3 py-2">
              <Avatar name={l.coach?.display_name ?? "Coach"} avatar={l.coach?.avatar} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-extrabold">{l.coach?.display_name ?? "Your coach"}</p>
              <Button variant="ghost" className="px-2 py-1 text-xs text-danger" onClick={() => setUnlinkTarget(l)}>
                Unlink
              </Button>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <TextInput
              placeholder="Invite code (e.g. ABC-123)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
            />
            <Button onClick={claim} disabled={code.trim().length === 0}>
              Link
            </Button>
          </div>
          {message && <p className="mt-2 text-xs font-bold text-accent">{message}</p>}
        </Card>

        <Card>
          <h2 className="mb-2 font-black">Privacy</h2>
          <p className="text-xs font-semibold text-muted">
            Your logs are stored in a locked-down database only you and your linked coaches can read. Nothing is stored
            on this device and there are no trackers.
          </p>
        </Card>

        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>

        <DeleteAccountCard onDeleted={() => window.location.assign("/")} />
      </div>

      {unlinkTarget && (
        <UnlinkModal
          title={`Unlink ${unlinkTarget.coach?.display_name ?? "coach"}?`}
          description="Your plan assignments from this coach will be removed. Your logged sessions stay on your account."
          confirmLabel="UNLINK"
          onConfirm={() => unlinkCoach(unlinkTarget.id)}
          onClose={() => setUnlinkTarget(null)}
        />
      )}
    </>
  );
}
