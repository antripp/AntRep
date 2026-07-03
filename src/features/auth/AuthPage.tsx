import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Button, Card, TextInput } from "../../components/ui";
import { MASCOTS } from "../../lib/brand";
import type { Role } from "../../lib/types";
import { ensureProfile, signUpWithRole, useAuth } from "./useAuth";

const BRAND: Record<Role, { name: string; tagline: string }> = {
  athlete: {
    name: "AntRep",
    tagline: "Log your reps. Your coach handles the rest.",
  },
  coach: {
    name: "AntRep Coach",
    tagline: "Build plans. Watch sessions roll in.",
  },
};

export default function AuthPage({ role }: { role: Role }) {
  const brand = BRAND[role];
  const { authSession, allProfiles, refreshProfiles } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const portalProfile = allProfiles.find((p) => p.role === role);
  const needsProfile = authSession != null && !portalProfile;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (needsProfile) {
        const err = await ensureProfile(role, name.trim() || email.split("@")[0]);
        if (err) setMessage(err);
        else await refreshProfiles();
      } else if (mode === "signup") {
        const { error, needsConfirm } = await signUpWithRole(
          email.trim(),
          password,
          role,
          name.trim() || email.split("@")[0],
        );
        if (error) setMessage(error);
        else if (needsConfirm) setMessage("Check your email to confirm your account, then sign in here.");
        else await refreshProfiles();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage(error.message);
        else await refreshProfiles();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pattern-bg flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10">
      <img
        src={MASCOTS[role]}
        alt={`${brand.name} mascot`}
        className="mb-4 h-36 w-36 object-contain"
      />
      <h1 className="text-3xl font-black tracking-tight text-ink">{brand.name}</h1>
      <p className="mb-6 mt-1 text-sm font-bold text-muted">{brand.tagline}</p>

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
        {mode === "signup" && !needsProfile && (
          <p className="mt-3 text-center text-[11px] font-semibold text-muted">
            New accounts require admin approval before you can use the app.
          </p>
        )}
      </Card>

      <a
        href={role === "athlete" ? "/coach" : "/"}
        className="mt-6 text-xs font-bold text-muted underline"
      >
        {role === "athlete" ? "I'm a coach → AntRep Coach" : "I'm an athlete → AntRep"}
      </a>
    </div>
  );
}
