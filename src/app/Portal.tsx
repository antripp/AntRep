/** One portal (athlete or coach): auth gate → role gate → the app. */

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

  // Supabase deployments require an admin to approve a new profile.
  if (!forRole.approved_at && !isDemoMode) {
    return (
      <div className="pattern-bg flex min-h-dvh items-center justify-center bg-bg px-5">
        <Card className="max-w-sm text-center">
          <h1 className="text-xl font-black text-ink">Waiting for approval</h1>
          <p className="mt-1 text-sm font-semibold leading-snug text-muted">
            Your {role} profile has been created. An admin needs to approve it before you can start.
          </p>
        </Card>
      </div>
    );
  }

  return role === "athlete" ? (
    <AthleteApp profile={forRole} onSwitchPortal={switchPortal} />
  ) : (
    <CoachApp profile={forRole} onSwitchPortal={switchPortal} />
  );
}
