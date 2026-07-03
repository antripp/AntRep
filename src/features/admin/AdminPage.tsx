import { useState } from "react";
import { AdminApprovalCard } from "../../components/SettingsShared";
import { Button, Card, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";

/**
 * Standalone admin console — dev only at /admin (redirects home in production).
 * Use Settings → Admin approval when running locally; use Supabase SQL in production.
 */
export default function AdminPage() {
  const { loading, authSession, allProfiles, isAdmin, refreshProfiles, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }

  if (!authSession) {
    return (
      <div className="pattern-bg flex min-h-dvh items-center justify-center bg-bg px-6">
        <Card className="max-w-sm text-center">
          <h1 className="mb-2 text-xl font-black">Admin console</h1>
          <p className="mb-4 text-sm font-semibold text-muted">Sign in first, then open this page again.</p>
          <a href="/">
            <Button className="w-full">Go to sign in</Button>
          </a>
        </Card>
      </div>
    );
  }

  const uid = authSession.user.id;
  const pendingOwn = allProfiles.filter((p: Profile) => !p.approved_at);

  async function activateAllMine() {
    setBusy(true);
    setMessage(null);
    for (const p of pendingOwn) {
      const { error } = await supabase.rpc("approve_profile", { p_profile_id: p.id });
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
    }
    await refreshProfiles();
    setMessage("Activated! You can open the app now.");
    setBusy(false);
  }

  return (
    <div className="pattern-bg min-h-dvh bg-bg px-6 py-10">
      <div className="mx-auto max-w-md space-y-3">
        <Card>
          <h1 className="mb-1 text-2xl font-black">Admin console</h1>
          <p className="text-xs font-semibold text-muted">
            Bookmark this page: <code className="rounded bg-inset px-1">/admin</code>
          </p>
        </Card>

        {!isAdmin ? (
          <Card className="border-gold">
            <h2 className="mb-2 font-black">Admin not configured</h2>
            <p className="mb-2 text-sm font-semibold text-muted">
              You're signed in, but this account isn't recognised as admin yet. Run this in Supabase SQL
              Editor (use your UID below):
            </p>
            <pre className="mb-3 overflow-x-auto rounded-xl bg-inset p-3 text-[11px] font-semibold">
{`insert into public.app_config (key, value) values
  ('admin_user_id', '${uid}'),
  ('invite_pepper', '<random-string>')
on conflict (key) do update set value = excluded.value;`}
            </pre>
            <p className="mb-2 text-xs font-bold text-muted">Your auth UID:</p>
            <code className="block break-all rounded-xl bg-inset p-2 text-xs font-black">{uid}</code>
            <Button variant="secondary" onClick={() => refreshProfiles()} className="mt-3 w-full">
              I ran the SQL — refresh
            </Button>
          </Card>
        ) : (
          <>
            {pendingOwn.length > 0 && (
              <Card>
                <h2 className="mb-2 font-black">Your profiles</h2>
                <p className="mb-3 text-xs font-semibold text-muted">
                  You have {pendingOwn.length} pending profile(s) on this account.
                </p>
                {message && <p className="mb-2 text-xs font-bold text-accent">{message}</p>}
                <Button onClick={activateAllMine} disabled={busy} className="w-full">
                  {busy ? "…" : "Activate all my profiles"}
                </Button>
                <div className="mt-3 flex gap-2">
                  <a href="/" className="flex-1">
                    <Button variant="secondary" className="w-full">
                      Open Athlete app
                    </Button>
                  </a>
                  <a href="/coach" className="flex-1">
                    <Button variant="secondary" className="w-full">
                      Open Coach app
                    </Button>
                  </a>
                </div>
              </Card>
            )}
            {pendingOwn.length === 0 && (
              <Card>
                <p className="mb-3 text-sm font-semibold text-muted">Your profiles are active.</p>
                <div className="flex gap-2">
                  <a href="/" className="flex-1">
                    <Button className="w-full">Athlete app</Button>
                  </a>
                  <a href="/coach" className="flex-1">
                    <Button variant="secondary" className="w-full">
                      Coach app
                    </Button>
                  </a>
                </div>
              </Card>
            )}
            <AdminApprovalCard />
          </>
        )}

        <Button variant="ghost" onClick={signOut} className="w-full">
          Sign out
        </Button>
      </div>
    </div>
  );
}
