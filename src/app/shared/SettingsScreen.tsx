/** Settings — profile, goals, theme, coach linking, account. Shared by both portals. */

import { useState } from "react";
import { api, DEMO_ACCOUNTS, isDemoMode, resetDemoStore } from "../../data";
import type { CoachLink, Profile, Role } from "../../data/types";
import { ACCENTS, BACKGROUNDS, useTheme } from "../../lib/theme";
import {
  Button,
  Card,
  Field,
  Icon,
  NumberField,
  Pill,
  ScreenTitle,
  SectionHeader,
  SettingRow,
  Segmented,
  Sheet,
  TextField,
  Toggle,
} from "../../ui/kit";
import { useAuth } from "../auth";

export default function SettingsScreen({
  profile,
  coaches,
  onReload,
  onSwitchPortal,
  extra,
}: {
  profile: Profile;
  coaches?: { link: CoachLink; coach: Profile }[];
  onReload: () => Promise<void>;
  onSwitchPortal: (role: Role) => void;
  extra?: React.ReactNode;
}) {
  const { profiles, signOut, refresh } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState(profile.display_name);
  const [gymGoal, setGymGoal] = useState(profile.weekly_gym_goal);
  const [kmGoal, setKmGoal] = useState(profile.weekly_km_goal);
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showTheme, setShowTheme] = useState(false);

  const otherRole: Role = profile.role === "athlete" ? "coach" : "athlete";
  const hasOtherRole = profiles.some((p) => p.role === otherRole);

  async function saveProfile() {
    await api.updateProfile(profile.id, {
      display_name: name,
      weekly_gym_goal: gymGoal,
      weekly_km_goal: kmGoal,
    });
    await Promise.all([onReload(), refresh()]);
    setMessage("Saved");
  }

  async function linkCoach() {
    setLinking(true);
    try {
      const result = await api.claimInvite(code);
      setMessage(result.ok ? "Coach linked" : (result.error ?? "That code didn't work"));
      if (result.ok) {
        setCode("");
        await onReload();
      }
    } finally {
      setLinking(false);
    }
  }

  async function enableOtherRole() {
    await api.enableRole(otherRole, profile.display_name);
    await refresh();
    onSwitchPortal(otherRole);
  }

  return (
    <>
      <ScreenTitle title="Settings" />

      {isDemoMode && (
        <Card className="mb-3" tint="var(--color-gold)">
          <p className="text-sm font-black text-ink">Demo mode</p>
          <p className="mt-1 text-xs font-semibold leading-snug text-muted">
            Everything is stored in this browser — no database, no account needed. Sign in as{" "}
            {DEMO_ACCOUNTS.map((a) => a.email).join(" or ")} with password{" "}
            <code className="rounded bg-inset px-1">demo1234</code>.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              resetDemoStore();
              window.location.reload();
            }}
          >
            Reset demo data
          </Button>
        </Card>
      )}

      <SectionHeader title="Profile" />
      <Card className="space-y-3">
        <Field label="Display name">
          <TextField value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sessions / week">
            <NumberField value={gymGoal} min={0} max={14} onChange={(v) => setGymGoal(v ?? 0)} />
          </Field>
          <Field label="Distance / week">
            <NumberField value={kmGoal} min={0} max={300} suffix="km" onChange={(v) => setKmGoal(v ?? 0)} />
          </Field>
        </div>
        <Button full onClick={saveProfile}>
          Save profile
        </Button>
        {message && <p className="text-center text-xs font-bold text-accent">{message}</p>}
      </Card>

      <SectionHeader title="Appearance" />
      <Card className="p-0">
        <SettingRow
          title="Theme"
          subtitle={theme.mode === "dark" ? "Dark" : "Light"}
          right={
            <div className="w-32">
              <Segmented
                value={theme.mode}
                onChange={theme.setMode}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
          }
        />
        <SettingRow
          title="Colour"
          subtitle={BACKGROUNDS.find((b) => b.key === theme.bg)?.label ?? "Default"}
          onClick={() => setShowTheme(true)}
        />
      </Card>

      {profile.role === "athlete" && (
        <>
          <SectionHeader title="Coaches" />
          <Card className="space-y-3">
            {coaches && coaches.length > 0 ? (
              <div className="space-y-2">
                {coaches.map(({ link, coach }) => (
                  <div key={link.id} className="flex items-center gap-3 rounded-2xl bg-inset px-3 py-2">
                    <Icon.people className="h-5 w-5 text-accent" />
                    <p className="min-w-0 flex-1 truncate text-sm font-black text-ink">{coach.display_name}</p>
                    <button
                      className="text-xs font-black text-danger"
                      onClick={async () => {
                        await api.unlink(link.id, "athlete");
                        await onReload();
                      }}
                    >
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-muted">
                Not linked to a coach yet. Ask them for an invite code.
              </p>
            )}
            <div className="flex gap-2">
              <TextField
                placeholder="ABC-123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <Button onClick={linkCoach} disabled={linking || code.trim().length < 4}>
                <Icon.link className="h-4 w-4" /> Link
              </Button>
            </div>
          </Card>
        </>
      )}

      {extra}

      <SectionHeader title="Account" />
      <Card className="p-0">
        <SettingRow
          title={hasOtherRole ? `Switch to ${otherRole} portal` : `Become a ${otherRole} too`}
          subtitle={
            hasOtherRole
              ? "Same account, other side of the app"
              : otherRole === "coach"
                ? "Create plans for other people"
                : "Log your own training"
          }
          onClick={hasOtherRole ? () => onSwitchPortal(otherRole) : enableOtherRole}
        />
        <SettingRow title="Sign out" onClick={signOut} right={<Icon.chevron className="h-4 w-4 text-muted" />} />
      </Card>

      <p className="mt-6 text-center text-[11px] font-bold text-muted">
        AntRep · {profile.role === "coach" ? "Coach" : "Athlete"} portal
      </p>

      <Sheet open={showTheme} onClose={() => setShowTheme(false)} title="Colour">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => theme.setBg(null)}
            className={`rounded-2xl border p-2 text-[11px] font-black ${
              theme.bg === null ? "border-accent text-accent" : "border-line text-muted"
            }`}
          >
            Default
          </button>
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.key}
              onClick={() => theme.setBg(bg.key)}
              className={`rounded-2xl border p-2 text-[11px] font-black ${
                theme.bg === bg.key ? "border-accent" : "border-line"
              }`}
              style={{ background: bg[theme.mode].bg, color: bg[theme.mode].accent }}
            >
              {bg.label}
            </button>
          ))}
        </div>

        <SectionHeader title="Accent (when no colour is set)" />
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((accent) => (
            <button
              key={accent.key}
              onClick={() => theme.setAccent(accent.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${
                theme.accent === accent.key ? "border-accent" : "border-line"
              }`}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: accent.swatch }} />
              {accent.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** Toggle used by the coach portal to control what athletes may see. */
export function ShareToggleRow({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-inset px-3 py-2">
      <div>
        <p className="text-sm font-bold text-ink">Share logs with my coach</p>
        <p className="text-xs font-semibold text-muted">New sessions are visible to linked coaches</p>
      </div>
      <Toggle label="Share logs with my coach" checked={value} onChange={onChange} />
    </div>
  );
}

export function InviteCodeCard({ onCreate }: { onCreate: () => Promise<{ code: string; error?: string }> }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <p className="text-sm font-black text-ink">Invite an athlete</p>
      <p className="mt-1 text-xs font-semibold text-muted">
        Share this one-time code. They enter it in Settings → Coaches.
      </p>
      {code && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-inset px-3 py-2">
          <span className="flex-1 text-center text-2xl font-black tracking-[0.2em] text-ink">{code}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard?.writeText(code)}
          >
            <Icon.copy className="h-4 w-4" /> Copy
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
      <Button
        className="mt-3"
        full
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await onCreate();
            if (result.error) setError(result.error);
            else setCode(result.code);
          } finally {
            setBusy(false);
          }
        }}
      >
        {code ? "New code" : "Create invite code"}
      </Button>
      {code && <Pill className="mt-2" tint="var(--t-muted)">Expires in 30 minutes</Pill>}
    </Card>
  );
}
