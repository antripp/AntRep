import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isConfigured } from "./lib/supabase";
import { AuthProvider, useAuth } from "./features/auth/useAuth";
import AuthPage from "./features/auth/AuthPage";
import AdminPage from "./features/admin/AdminPage";
import AthleteApp from "./features/athlete/AthleteApp";
import CoachApp from "./features/coach/CoachApp";
import { Card, Spinner } from "./components/ui";
import { EnableRoleCard, PendingApprovalScreen } from "./components/SettingsShared";
import type { Role } from "./lib/types";

function SetupScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <Card className="max-w-md">
        <h1 className="mb-2 text-xl font-black">AntRep needs Supabase credentials</h1>
        <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold text-ink/80">
          <li>Create a project at supabase.com</li>
          <li>
            Run your database setup SQL in the Supabase SQL editor (kept locally, not in this repo)
          </li>
          <li>
            Bootstrap admin:{" "}
            <code className="rounded bg-mint-pale px-1">
              insert into app_config (key, value) values ('admin_user_id', '&lt;your-uuid&gt;'), ('invite_pepper',
              '&lt;random-string&gt;');
            </code>
          </li>
          <li>
            Copy <code className="rounded bg-mint-pale px-1">.env.example</code> to{" "}
            <code className="rounded bg-mint-pale px-1">.env</code> and fill in the project URL + anon key
          </li>
          <li>Restart the dev server</li>
        </ol>
      </Card>
    </div>
  );
}

function Portal({ role }: { role: Role }) {
  const { loading, authSession, allProfiles, activeRole, setActiveRole } = useAuth();

  useEffect(() => {
    if (activeRole !== role) setActiveRole(role);
  }, [role, activeRole, setActiveRole]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }

  if (!authSession) return <AuthPage role={role} />;

  const portalProfile = allProfiles.find((p) => p.role === role);
  const approvedHere = portalProfile?.approved_at ? portalProfile : null;

  // Approved on this portal → app
  if (approvedHere) {
    return role === "athlete" ? <AthleteApp /> : <CoachApp />;
  }

  // No profile for this portal — create / activate the other role (instant if already approved elsewhere)
  if (!portalProfile) {
    return (
      <div className="pattern-bg flex min-h-dvh items-center justify-center bg-bg px-6">
        <div className="w-full max-w-sm">
          <EnableRoleCard role={role} />
        </div>
      </div>
    );
  }

  // Profile exists but still pending approval
  return <PendingApprovalScreen role={role} />;
}

export default function App() {
  if (!isConfigured) return <SetupScreen />;
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/admin"
          element={import.meta.env.DEV ? <AdminPage /> : <Navigate to="/" replace />}
        />
        <Route path="/coach/*" element={<Portal role="coach" />} />
        <Route path="/*" element={<Portal role="athlete" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
