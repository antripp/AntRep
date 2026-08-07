import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ACCENTS, BACKGROUNDS, PATTERN_STYLES, useTheme, type PatternStyle } from "../lib/theme";
import type { AvatarPref, Role } from "../lib/types";
import { enableRole, useAuth } from "../features/auth/useAuth";
import { Avatar, AVATAR_COLORS, AVATAR_SYMBOLS, Button, Card, Modal, Segmented, TextInput } from "./ui";

/** Appearance: light/dark, background colour (drives accent), or accent. */
export function ThemeCard() {
  const { mode, accent, bg, setMode, setAccent, setBg } = useTheme();
  return (
    <Card>
      <h2 className="mb-2 font-black">Appearance</h2>
      <Segmented
        options={[
          { key: "light", label: "☀️ Light" },
          { key: "dark", label: "🌙 Dark" },
        ]}
        value={mode}
        onChange={setMode}
      />

      <p className="mb-2 mt-3 text-xs font-extrabold uppercase tracking-wide text-muted">Background colour</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBg(null)}
          title="Default"
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-black text-muted ${
            bg === null ? "scale-110 border-ink/40" : "border-line"
          }`}
        >
          ∅
        </button>
        {BACKGROUNDS.map((b) => (
          <button
            key={b.key}
            type="button"
            title={b.label}
            onClick={() => setBg(b.key)}
            className={`h-8 w-8 rounded-full border-2 transition ${
              bg === b.key ? "scale-110 border-ink/40" : "border-line"
            }`}
            style={{ backgroundColor: b[mode].bg, boxShadow: `inset 0 0 0 3px ${b[mode].accent}55` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] font-semibold text-muted">
        Picking a background retunes the accent to match. Both adapt to light & dark mode.
      </p>

      {bg === null && (
        <>
          <p className="mb-2 mt-3 text-xs font-extrabold uppercase tracking-wide text-muted">Accent colour</p>
          <div className="flex gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-label={a.label}
                onClick={() => setAccent(a.key)}
                className={`h-9 w-9 rounded-full border-4 transition ${
                  accent === a.key ? "scale-110 border-ink/30" : "border-transparent"
                }`}
                style={{ backgroundColor: a.swatch }}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/** Dev-only pattern lab: try texture styles and tune size/opacity live. */
export function PatternLabCard() {
  const { pattern, setPattern } = useTheme();
  if (!import.meta.env.DEV) return null;
  return (
    <Card className="border-dashed">
      <h2 className="mb-1 font-black">
        Pattern lab <span className="rounded-full bg-inset px-2 py-0.5 text-[10px] font-black text-muted">DEV</span>
      </h2>
      <p className="mb-2 text-xs font-semibold text-muted">Background texture playground — settings persist locally.</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {PATTERN_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPattern({ ...pattern, style: s as PatternStyle })}
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              pattern.style === s ? "bg-accent text-white" : "border-2 border-line bg-surface text-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="mb-2 block text-xs font-extrabold text-muted">
        Tile size: {pattern.size}px
        <input
          type="range"
          min={16}
          max={64}
          step={4}
          value={pattern.size}
          onChange={(e) => setPattern({ ...pattern, size: Number(e.target.value) })}
          className="mt-1 block w-full accent-[var(--t-accent)]"
        />
      </label>
      <label className="mb-2 block text-xs font-extrabold text-muted">
        Light opacity: {pattern.opacityLight}%
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={pattern.opacityLight}
          onChange={(e) => setPattern({ ...pattern, opacityLight: Number(e.target.value) })}
          className="mt-1 block w-full accent-[var(--t-accent)]"
        />
      </label>
      <label className="block text-xs font-extrabold text-muted">
        Dark opacity: {pattern.opacityDark}%
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={pattern.opacityDark}
          onChange={(e) => setPattern({ ...pattern, opacityDark: Number(e.target.value) })}
          className="mt-1 block w-full accent-[var(--t-accent)]"
        />
      </label>
    </Card>
  );
}

/** Profile picture: initials / symbol / solid colour. Saved on the profile. */
export function AvatarCard() {
  const { profile, refreshProfiles } = useAuth();
  const [draft, setDraft] = useState<AvatarPref>(profile?.avatar ?? {});
  const [saved, setSaved] = useState(false);
  if (!profile) return null;

  const kind = draft.kind ?? "initials";

  async function save(next: AvatarPref) {
    setDraft(next);
    await supabase.from("profiles").update({ avatar: next }).eq("id", profile!.id);
    await refreshProfiles();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-3">
        <Avatar name={profile.display_name} avatar={draft} size="lg" />
        <div>
          <h2 className="font-black">Profile picture {saved && <span className="text-xs text-done-deep">✓</span>}</h2>
          <p className="text-xs font-semibold text-muted">How your connections recognise you.</p>
        </div>
      </div>

      <Segmented
        options={[
          { key: "initials", label: "Initials" },
          { key: "symbol", label: "Symbol" },
          { key: "solid", label: "Colour" },
        ]}
        value={kind}
        onChange={(k) => save({ ...draft, kind: k as AvatarPref["kind"] })}
      />

      {kind === "symbol" && (
        <div className="mt-3 flex flex-wrap gap-1">
          {AVATAR_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => save({ ...draft, kind: "symbol", value: s })}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${
                draft.value === s ? "bg-accent-soft ring-2 ring-accent" : "bg-inset"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="mb-1 mt-3 text-xs font-extrabold uppercase tracking-wide text-muted">Colour</p>
      <div className="flex flex-wrap gap-2">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => save({ ...draft, color: c })}
            className={`h-8 w-8 rounded-full border-2 transition ${
              draft.color === c ? "scale-110 border-ink/40" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </Card>
  );
}

/**
 * Delete account — safeguarded: requires typing DELETE, then calls the
 * delete_account() function which removes the auth user and cascades
 * through every table.
 */
export function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("delete_account");
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    onDeleted();
  }

  return (
    <>
      <Card className="border-danger/40">
        <h2 className="mb-1 font-black text-danger">Danger zone</h2>
        <p className="mb-3 text-xs font-semibold text-muted">
          Deleting your account permanently removes your profile, plans, sessions and every logged set. This cannot be
          undone.
        </p>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </Card>

      {open && (
        <Modal title="Delete your account?" onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm font-semibold text-muted">
            All of your data will be erased immediately — profile, coach links, plans, sessions and set logs. Type{" "}
            <span className="font-black text-danger">DELETE</span> to confirm.
          </p>
          <TextInput
            placeholder="Type DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoCapitalize="characters"
          />
          {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1 border-danger-deep bg-danger text-white"
              disabled={confirmText.trim() !== "DELETE" || busy}
              onClick={deleteAccount}
            >
              {busy ? "Deleting…" : "Delete everything"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Shown when a portal role profile doesn't exist yet — request it (pending approval). */
export function EnableRoleCard({ role }: { role: Role }) {
  const { allProfiles, refreshProfiles, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const other: Role = role === "athlete" ? "coach" : "athlete";
  const hasApprovedOther = allProfiles.some((p) => p.role === other && p.approved_at);

  async function request() {
    setBusy(true);
    setMessage(null);
    const { error } = await enableRole(role);
    if (error) {
      setMessage(error);
      setBusy(false);
      return;
    }
    await refreshProfiles();
    window.location.assign(role === "coach" ? "/coach" : "/");
  }

  return (
    <Card>
      <h1 className="mb-2 text-xl font-black">
        {role === "athlete" ? "Athlete mode" : "Coach mode"}
      </h1>
      <p className="mb-3 text-sm font-semibold text-muted">
        {hasApprovedOther
          ? `You're already approved as a ${other} — ${role} mode activates instantly. Coaches can log workouts in athlete mode and review them as "My Workout" in coach mode.`
          : `Create your ${role} profile to get started. An admin will review and approve your account before you can use the app.`}
      </p>
      {message && <p className="mb-2 text-xs font-bold text-danger">{message}</p>}
      <Button onClick={request} disabled={busy} className="w-full">
        {busy ? "…" : hasApprovedOther ? `Activate ${role} mode` : `Enable ${role} mode`}
      </Button>
      <Button variant="ghost" onClick={signOut} className="mt-2 w-full">
        Sign out
      </Button>
      {role === "athlete" && (
        <a href="/coach" className="mt-4 block text-center text-xs font-bold text-muted underline">
          Signed up as a coach? → AntRep Coach
        </a>
      )}
      {role === "coach" && (
        <a href="/" className="mt-4 block text-center text-xs font-bold text-muted underline">
          Need athlete mode? → AntRep
        </a>
      )}
    </Card>
  );
}

/** Waiting screen after signup / role request until admin approves. */
export function PendingApprovalScreen({ role }: { role: Role }) {
  const { allProfiles, refreshProfiles, signOut, isAdmin } = useAuth();
  const portalProfile = allProfiles.find((p) => p.role === role);
  const other: Role = role === "athlete" ? "coach" : "athlete";
  const approvedOther = allProfiles.some((p) => p.role === other && p.approved_at);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => refreshProfiles(), 15000);
    return () => clearInterval(t);
  }, [refreshProfiles]);

  async function activateMyAccount() {
    if (!portalProfile) return;
    setActivating(true);
    setError(null);
    if (approvedOther) {
      const { error: err } = await enableRole(role);
      if (err) setError(err);
      else {
        await refreshProfiles();
        window.location.assign(role === "coach" ? "/coach" : "/");
      }
      setActivating(false);
      return;
    }
    const { data, error: err } = await supabase.rpc("approve_profile", {
      p_profile_id: portalProfile.id,
    });
    if (err) setError(err.message);
    else if (!data) setError("Could not activate — check admin setup in Supabase.");
    else await refreshProfiles();
    setActivating(false);
  }

  return (
    <div className="pattern-bg flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-sm space-y-3">
        <Card className="text-center">
          <h1 className="mb-2 text-xl font-black">
            {isAdmin ? "Admin account" : approvedOther ? "Activate mode" : "Awaiting approval"}
          </h1>
          <p className="mb-1 text-sm font-semibold text-muted">
            {approvedOther
              ? `You're already approved as a ${other} — tap below to activate ${role} mode.`
              : `Your ${role} profile (${portalProfile?.display_name ?? "…"}) needs to be activated.`}
          </p>
          {isAdmin || approvedOther ? (
            <>
              {isAdmin && !approvedOther && (
                <p className="mb-4 text-xs font-semibold text-muted">
                  You're the site admin — you don't need to wait for anyone else.
                </p>
              )}
              {error && <p className="mb-2 text-xs font-bold text-danger">{error}</p>}
              <Button onClick={activateMyAccount} disabled={activating} className="w-full">
                {activating ? "…" : approvedOther ? `Activate ${role} mode` : "Activate my account"}
              </Button>
            </>
          ) : (
            <p className="mb-4 text-xs font-semibold text-muted">
              You'll get access once an admin approves your profile. This page refreshes automatically.
            </p>
          )}
          <Button variant="secondary" onClick={() => refreshProfiles()} className="mt-2 w-full">
            Check again
          </Button>
          <Button variant="ghost" onClick={signOut} className="mt-2 w-full">
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
}

/** Switch between coach and athlete portals (each keeps its own profile). */
export function RoleSwitchCard() {
  const { allProfiles, activeRole, refreshProfiles } = useAuth();
  const other: Role = activeRole === "athlete" ? "coach" : "athlete";
  const otherProfile = allProfiles.find((p) => p.role === other);
  const approvedHere = allProfiles.some((p) => p.role === activeRole && p.approved_at);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function activateOther() {
    setBusy(true);
    const { error } = await enableRole(other);
    if (!error) {
      await refreshProfiles();
      window.location.assign(other === "coach" ? "/coach" : "/");
    }
    setBusy(false);
  }

  if (!otherProfile?.approved_at) {
    const pending = otherProfile && !otherProfile.approved_at;
    const canInstantActivate = approvedHere;
    return (
      <Card>
        <h2 className="mb-1 font-black">{other === "coach" ? "Coach mode" : "Athlete mode"}</h2>
        <p className="mb-2 text-xs font-semibold text-muted">
          {canInstantActivate
            ? `${other === "coach" ? "Coach" : "Athlete"} mode activates instantly — you're already approved on this account.`
            : pending
              ? `Your ${other} profile is awaiting approval.`
              : `Enable ${other} mode to log your own workouts or manage athletes from one account.`}
        </p>
        {canInstantActivate ? (
          <Button onClick={activateOther} disabled={busy} className="w-full">
            {busy ? "…" : `Activate ${other} mode`}
          </Button>
        ) : !otherProfile ? (
          <a href={other === "coach" ? "/coach" : "/"}>
            <Button variant="secondary" className="w-full">
              Set up {other} mode
            </Button>
          </a>
        ) : null}
      </Card>
    );
  }

  return (
    <>
      <Card>
        <h2 className="mb-1 font-black">Switch mode</h2>
        <p className="mb-2 text-xs font-semibold text-muted">
          Jump to {other === "coach" ? "AntRep Coach" : "AntRep"} — your {other} profile stays separate.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
          Open {other === "coach" ? "Coach" : "Athlete"} mode →
        </Button>
      </Card>

      {open && (
        <Modal title={`Switch to ${other} mode?`} onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm font-semibold text-muted">
            You'll leave this portal and open{" "}
            {other === "coach" ? "AntRep Coach" : "AntRep"} with your {other} profile (
            {otherProfile.display_name}).
          </p>
          <div className="flex gap-2">
            <a href={other === "coach" ? "/coach" : "/"} className="flex-1">
              <Button className="w-full">Switch</Button>
            </a>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Admin-only: approve pending coach/athlete profiles (no emails shown). */
/** Safeguarded unlink — athlete or coach side. */
export function UnlinkModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unlink");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-3 text-sm font-semibold text-muted">{description}</p>
      <p className="mb-2 text-xs font-extrabold text-muted">
        Type <span className="font-black text-danger">{confirmLabel}</span> to confirm:
      </p>
      <TextInput
        placeholder={confirmLabel}
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoCapitalize="characters"
      />
      {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          variant="danger"
          className="flex-1"
          disabled={confirmText.trim() !== confirmLabel || busy}
          onClick={confirm}
        >
          {busy ? "…" : "Unlink"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
