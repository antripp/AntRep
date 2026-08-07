/** Sign in / create an account for one portal, plus the offline demo entry. */

import { useState } from "react";
import {
  api,
  DEMO_ACCOUNTS,
  enableDemoMode,
  isDemoMode,
  isMissingBackend,
  showDemoUi,
} from "../data";
import type { Role } from "../data/types";
import { MASCOTS } from "../lib/brand";
import { Button, Card, Field, Icon, Segmented, TextField } from "../ui/kit";

export default function AuthPage({ role }: { role: Role }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result =
        mode === "signin"
          ? await api.signIn(email, password)
          : await api.signUp(email, password, role, name);
      if (result.error) setError(result.error);
      else if (result.needsConfirm)
        setNotice(
          `We've emailed a confirmation link to ${email.trim()}. Open it to finish setting up — check spam if it's not there.`,
        );
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await api.sendMagicLink(email);
    if (result.error) setError(result.error);
    else setNotice(`Link sent to ${email.trim()}. Open it on this device to sign in.`);
    setBusy(false);
  }

  return (
    <div className="pattern-bg flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src={MASCOTS[role]} alt="" className="mx-auto h-24 w-24 object-contain" />
          <h1 className="mt-3 text-3xl font-black text-ink">AntRep{role === "coach" && " Coach"}</h1>
          <p className="mt-1 text-sm font-bold text-muted">
            {role === "coach"
              ? "Build plans, track every set your athletes log."
              : "Your plan, your logs, your progress."}
          </p>
        </div>

        <Card>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />

          <form className="mt-4 space-y-3" onSubmit={submit}>
            {mode === "signup" && (
              <Field label="Your name">
                <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
              </Field>
            )}
            <Field label="Email">
              <TextField
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <TextField
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>

            {error && <p className="text-xs font-bold text-danger">{error}</p>}
            {notice && <p className="text-xs font-bold text-accent">{notice}</p>}

            <Button type="submit" full disabled={busy}>
              {busy ? "Working…" : mode === "signin" ? "Sign in" : `Create ${role} account`}
            </Button>
          </form>

          {mode === "signin" && (
            <>
              <div className="my-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] font-black uppercase tracking-wide text-muted">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" full disabled={busy} onClick={magicLink}>
                <Icon.send className="h-4 w-4" /> Email me a sign-in link
              </Button>
              <p className="mt-2 text-center text-[11px] font-semibold text-muted">
                No password needed — the link signs you straight in.
              </p>
            </>
          )}
        </Card>

        {isMissingBackend && (
          <Card className="mt-3" tint="var(--color-danger)">
            <p className="text-sm font-black text-ink">No database configured</p>
            <p className="mt-1 text-xs font-semibold leading-snug text-muted">
              This build has no Supabase credentials, so it can only run on offline demo data —
              real accounts can't sign in and new sign-ups are saved to this browser only. Set{" "}
              <code className="rounded bg-inset px-1">VITE_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-inset px-1">VITE_SUPABASE_ANON_KEY</code> in the hosting
              environment and deploy again.
            </p>
          </Card>
        )}

        {/*
          Safe to show whenever the demo is actually running: since the switch
          moved to sessionStorage, production only gets here via an explicit
          ?demo=1 (or a build with no credentials, which says so above).
        */}
        {isDemoMode ? (
          <Card className="mt-3">
            <p className="text-sm font-black text-ink">Demo accounts</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              No database needed — everything is stored in this browser.
            </p>
            <div className="mt-2 space-y-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  className="flex w-full items-center gap-2 rounded-xl bg-inset px-3 py-2 text-left"
                  onClick={async () => {
                    setBusy(true);
                    await api.signIn(account.email, account.password);
                    setBusy(false);
                  }}
                >
                  <Icon.play className="h-4 w-4 text-accent" />
                  <span className="flex-1 text-xs font-black text-ink">
                    {account.name} · {account.role}
                  </span>
                  <span className="text-[11px] font-bold text-muted">{account.email}</span>
                </button>
              ))}
            </div>
          </Card>
        ) : (
          showDemoUi && (
            <button
              onClick={enableDemoMode}
              className="mt-4 w-full text-center text-xs font-black text-muted underline"
            >
              Explore the demo without an account
            </button>
          )
        )}

        <p className="mt-5 text-center text-[11px] font-bold text-muted">
          {role === "coach" ? (
            <a href="/">Athlete portal →</a>
          ) : (
            <a href="/coach">Coach portal →</a>
          )}
        </p>
      </div>
    </div>
  );
}
