import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachLink, Profile } from "../../lib/types";
import { Button, Card, TextInput } from "../../components/ui";
import { useAuth } from "../auth/useAuth";

export default function AthleteSettingsPage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [code, setCode] = useState("");
  const [links, setLinks] = useState<(CoachLink & { coach?: Profile })[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadLinks() {
    const { data } = await supabase.from("coach_links").select("*").eq("status", "active");
    const linkRows = (data as CoachLink[]) ?? [];
    const withCoach = await Promise.all(
      linkRows.map(async (l) => {
        const { data: coach } = await supabase
          .from("profiles")
          .select("id, role, display_name")
          .eq("id", l.trainer_id)
          .maybeSingle();
        return { ...l, coach: (coach as Profile) ?? undefined };
      }),
    );
    setLinks(withCoach);
  }

  useEffect(() => {
    loadLinks();
  }, []);

  async function saveName() {
    if (!profile) return;
    await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile.id);
    await refreshProfile();
    setMessage("Saved!");
  }

  async function claim() {
    setMessage(null);
    const { data, error } = await supabase.rpc("claim_invite", { code: code.trim() });
    if (error) setMessage(error.message);
    else if (data === true) {
      setMessage("Linked to your coach! 🎉");
      setCode("");
      await loadLinks();
    } else {
      setMessage("That code didn't work — double-check it with your coach.");
    }
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

        <Card>
          <h2 className="mb-1 font-black">Your coach</h2>
          {links.length > 0 ? (
            <p className="text-sm font-bold text-mint-deep">
              ✓ Linked to {links.map((l) => l.coach?.display_name ?? "your coach").join(", ")}
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold text-chip">
                Enter the invite code your coach shared with you.
              </p>
              <div className="flex gap-2">
                <TextInput
                  placeholder="Invite code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoCapitalize="none"
                />
                <Button onClick={claim} disabled={code.trim().length === 0}>
                  Link
                </Button>
              </div>
            </>
          )}
          {message && <p className="mt-2 text-xs font-bold text-mint-deep">{message}</p>}
        </Card>

        <Card>
          <h2 className="mb-2 font-black">Privacy</h2>
          <p className="text-xs font-semibold text-chip">
            Your logs are stored in a locked-down database only you and your linked coach can read.
            Nothing is stored on this device and there are no trackers.
          </p>
        </Card>

        <Button variant="danger" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </>
  );
}
