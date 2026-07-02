import { Navigate, Route, Routes } from "react-router-dom";
import { isConfigured } from "./lib/supabase";
import { AuthProvider, useAuth } from "./features/auth/useAuth";
import AuthPage from "./features/auth/AuthPage";
import AthleteApp from "./features/athlete/AthleteApp";
import CoachApp from "./features/coach/CoachApp";
import { Button, Card, Spinner } from "./components/ui";
import type { Role } from "./lib/types";

function SetupScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-mint px-6">
      <Card className="max-w-md">
        <h1 className="mb-2 text-xl font-black">AntRep needs Supabase credentials</h1>
        <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold text-ink/80">
          <li>Create a project at supabase.com</li>
          <li>Run <code className="rounded bg-mint-pale px-1">supabase/schema.sql</code> in the SQL editor</li>
          <li>Copy <code className="rounded bg-mint-pale px-1">.env.example</code> to <code className="rounded bg-mint-pale px-1">.env</code> and fill in the project URL + anon key</li>
          <li>Restart the dev server</li>
        </ol>
      </Card>
    </div>
  );
}

/** Signed in with the wrong account type for this portal. */
function WrongPortal({ expected }: { expected: Role }) {
  const { signOut } = useAuth();
  const other = expected === "athlete" ? "/coach" : "/";
  const otherName = expected === "athlete" ? "AntRep Coach" : "AntRep";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-mint px-6">
      <Card className="max-w-sm text-center">
        <p className="mb-3 text-sm font-bold">
          This account is a {expected === "athlete" ? "coach" : "athlete"} account — it lives in {otherName}.
        </p>
        <div className="flex justify-center gap-2">
          <a href={other}>
            <Button>Open {otherName}</Button>
          </a>
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Portal({ role }: { role: Role }) {
  const { loading, authSession, profile } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-mint">
        <Spinner />
      </div>
    );
  }
  if (!authSession || !profile) return <AuthPage role={role} />;
  if (profile.role !== role) return <WrongPortal expected={role} />;
  return role === "athlete" ? <AthleteApp /> : <CoachApp />;
}

export default function App() {
  if (!isConfigured) return <SetupScreen />;
  return (
    <AuthProvider>
      <Routes>
        <Route path="/coach/*" element={<Portal role="coach" />} />
        <Route path="/*" element={<Portal role="athlete" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
