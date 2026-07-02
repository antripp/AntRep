import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import type { Role } from "../../lib/types";
import { Button, Card, TextInput } from "../../components/ui";
import { ensureProfile, signUpWithRole, useAuth } from "./useAuth";

const BRAND: Record<Role, { name: string; mascot: string; tagline: string }> = {
  athlete: {
    name: "AntRep",
    mascot: "/mascots/athlete-mascot.png",
    tagline: "Log your reps. Your coach handles the rest.",
  },
  coach: {
    name: "AntRep Coach",
    mascot: "/mascots/coach-mascot.png",
    tagline: "Build plans. Watch sessions roll in.",
  },
};

export default function AuthPage({ role }: { role: Role }) {
  const brand = BRAND[role];
  const { authSession, profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Signed in but no profile yet (e.g. confirmed email in another tab):
  // finish account creation for this portal's role.
  const needsProfile = authSession != null && profile == null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (needsProfile) {
        const err = await ensureProfile(role, name.trim() || email.split("@")[0]);
        if (err) setMessage(err);
        else await refreshProfile();
      } else if (mode === "signup") {
        const { error, needsConfirm } = await signUpWithRole(
          email.trim(),
          password,
          role,
          name.trim() || email.split("@")[0],
        );
        if (error) setMessage(error);
        else if (needsConfirm) setMessage("Check your email to confirm your account, then sign in here.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage(error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mint px-6 py-10">
      <img src={brand.mascot} alt={`${brand.name} mascot`} className="mb-4 h-36 w-36 object-contain" />
      <h1 className="text-3xl font-black tracking-tight text-ink">{brand.name}</h1>
      <p className="mb-6 mt-1 text-sm font-bold text-ink/70">{brand.tagline}</p>

      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {needsProfile ? (
            <>
              <p className="text-sm font-bold">Almost there — pick a display name.</p>
              <TextInput placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            </>
          ) : (
            <>
              {mode === "signup" && (
                <TextInput
                  placeholder="Display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <TextInput
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <TextInput
                type="password"
                required
                minLength={8}
                placeholder="Password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </>
          )}
          {message && <p className="text-xs font-bold text-red-500">{message}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "…" : needsProfile ? "Finish setup" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          {!needsProfile && (
            <button
              type="button"
              className="text-xs font-bold text-chip underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          )}
        </form>
      </Card>

      <a
        href={role === "athlete" ? "/coach" : "/"}
        className="mt-6 text-xs font-bold text-ink/60 underline"
      >
        {role === "athlete" ? "I'm a coach → AntRep Coach" : "I'm an athlete → AntRep"}
      </a>
    </div>
  );
}
