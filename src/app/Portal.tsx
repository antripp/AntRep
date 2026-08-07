/** One portal (athlete or coach): auth gate → role gate → the app. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, isDemoMode } from "../data";
import type { Role } from "../data/types";
import { Button, Card, LoadingScreen } from "../ui/kit";
import AthleteApp from "./athlete/AthleteApp";
import AuthPage from "./AuthPage";
import CoachApp from "./coach/CoachApp";
import { AuthProvider, useAuth } from "./auth";

export default function Portal({ role }: { role: Role }) {
  return (
    <AuthProvider role={role}>
      <PortalBody role={role} />
    </AuthProvider>
  );
}

function PortalBody({ role }: { role: Role }) {
  const { loading, user, profiles, refresh } = useAuth();
  const navigate = useNavigate();

  const switchPortal = (next: Role) => navigate(next === "coach" ? "/coach" : "/");

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthPage role={role} />;

  const forRole = profiles.find((p) => p.role === role);

  // Signed in, but this side of the app isn't set up yet.
  if (!forRole) {
    return (
      <div className="pattern-bg flex min-h-dvh items-center justify-center bg-bg px-5">
        <Card className="max-w-sm">
          <h1 className="text-xl font-black text-ink">
            {role === "coach" ? "Coach side" : "Athlete side"}
          </h1>
          <p className="mt-1 text-sm font-semibold leading-snug text-muted">
            {role === "coach"
              ? "Turn on coaching to build plans and track athletes with this same account."
              : "Turn on your athlete profile to follow plans and log your own training."}
          </p>
          <Button
            className="mt-4"
            full
            onClick={async () => {
              await api.enableRole(role, profiles[0]?.display_name ?? "");
              await refresh();
            }}
          >
            Enable {role} profile
          </Button>
          <Button
            className="mt-2"
            variant="secondary"
            full
            onClick={() => switchPortal(role === "coach" ? "athlete" : "coach")}
          >
            Back to the {role === "coach" ? "athlete" : "coach"} portal
          </Button>
        </Card>
      </div>
    );
  }

  // New accounts confirm their address before they can use the app. Accounts
  // that existed before verification arrived carry `requires_email_verification`
  // false, so nobody who was already training gets locked out.
  if (!isDemoMode && forRole.requires_email_verification && !user.emailConfirmed) {
    return <VerifyEmailWall email={user.email} />;
  }

  return role === "athlete" ? (
    <AthleteApp profile={forRole} onSwitchPortal={switchPortal} />
  ) : (
    <CoachApp profile={forRole} onSwitchPortal={switchPortal} />
  );
}

/** Shown until Supabase reports the address confirmed. */
function VerifyEmailWall({ email }: { email: string }) {
  const { refresh, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setNote(null);
    const result = await api.resendVerification(email);
    setNote(result.error ?? "Sent — check your inbox, and your spam folder.");
    setBusy(false);
  }

  return (
    <div className="pattern-bg flex min-h-dvh items-center justify-center bg-bg px-5">
      <Card className="max-w-sm text-center">
        <h1 className="text-xl font-black text-ink">Confirm your email</h1>
        <p className="mt-1 text-sm font-semibold leading-snug text-muted">
          We sent a link to <span className="font-black text-ink">{email}</span>. Open it and you're
          in — nothing else to do.
        </p>
        {note && <p className="mt-3 text-xs font-bold text-accent">{note}</p>}
        <Button className="mt-4" full disabled={busy} onClick={refresh}>
          I've confirmed it
        </Button>
        <Button className="mt-2" variant="secondary" full disabled={busy} onClick={resend}>
          Send it again
        </Button>
        <Button className="mt-2" variant="ghost" full onClick={signOut}>
          Use a different account
        </Button>
      </Card>
    </div>
  );
}
