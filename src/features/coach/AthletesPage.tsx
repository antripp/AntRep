import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachLink } from "../../lib/types";
import { Button, Card, EmptyState } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import type { LinkedAthlete } from "./CoachApp";

export default function AthletesPage({
  athletes,
  onChanged,
  onSelect,
}: {
  athletes: LinkedAthlete[];
  onChanged: () => Promise<void> | void;
  onSelect: (athleteId: string) => void;
}) {
  const { profile, signOut } = useAuth();
  const [pending, setPending] = useState<CoachLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadPending() {
    const { data } = await supabase.from("coach_links").select("*").eq("status", "pending");
    setPending((data as CoachLink[]) ?? []);
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function createInvite() {
    if (!profile) return;
    await supabase.from("coach_links").insert({ trainer_id: profile.id });
    await loadPending();
  }

  async function deleteInvite(id: string) {
    await supabase.from("coach_links").delete().eq("id", id);
    await loadPending();
  }

  async function unlink(id: string) {
    await supabase.from("coach_links").delete().eq("id", id);
    await onChanged();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <header className="mb-4 flex items-center gap-3">
        <img src="/mascots/coach-mascot.png" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-black">Your athletes</h1>
          <p className="text-xs font-bold text-ink/60">Hey {profile?.display_name}!</p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {athletes.length === 0 && pending.length === 0 && (
          <Card>
            <EmptyState
              title="No athletes yet"
              subtitle="Create an invite code and send it to your athlete — they enter it in AntRep → Settings."
            />
          </Card>
        )}

        {athletes.map(({ link, athlete }) => (
          <Card key={link.id} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-lg font-black text-white">
              {athlete.display_name.slice(0, 1).toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{athlete.display_name}</p>
              <p className="text-xs font-semibold text-chip">Linked</p>
            </div>
            <Button variant="secondary" onClick={() => onSelect(athlete.id)}>
              Open plan
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm(`Unlink ${athlete.display_name}? They keep their logs; you lose access.`))
                  unlink(link.id);
              }}
            >
              ✕
            </Button>
          </Card>
        ))}

        {pending.length > 0 && (
          <Card>
            <h2 className="mb-2 font-black">Pending invites</h2>
            <div className="flex flex-col gap-2">
              {pending.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl bg-mint-pale/60 px-3 py-2">
                  <code className="flex-1 text-base font-black tracking-widest">{l.invite_code}</code>
                  <Button variant="secondary" onClick={() => copyCode(l.invite_code)}>
                    {copied === l.invite_code ? "Copied!" : "Copy"}
                  </Button>
                  <Button variant="ghost" onClick={() => deleteInvite(l.id)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Button onClick={createInvite}>+ New invite code</Button>
        <Button variant="danger" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </>
  );
}
