/** Settings — profile, goals, theme, coach linking, account. Shared by both portals. */

import { useEffect, useState } from "react";
import { api, DEMO_ACCOUNTS, disableDemoMode, isDemoMode, resetDemoStore } from "../../data";
import type { CoachLink, Profile, Role } from "../../data/types";
import {
  ACCENTS,
  BACKGROUNDS,
  DEFAULT_PALETTE,
  MODE_SURFACES,
  UI_MODES_ENABLED,
  useTheme,
  type BackgroundPalette,
  type UIMode,
} from "../../lib/theme";
import {
  Button,
  Card,
  Field,
  Icon,
  IconTile,
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
import GuideScreen from "./GuideScreen";

const INTERFACE_OPTIONS: { value: UIMode; label: string; description: string }[] = [
  { value: "classic", label: "Classic", description: "Playful and gamified" },
  { value: "minimal", label: "Minimal", description: "Calm and content-first" },
  { value: "compact", label: "Modern compact", description: "Dense and quick to scan" },
];

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
  /** Preview only — lets you audition a pairing in the other mode. */
  const [previewMode, setPreviewMode] = useState<"light" | "dark">(theme.mode);
  const [showGuide, setShowGuide] = useState(false);
  const [appearanceStatus, setAppearanceStatus] = useState<"saving" | "saved" | "error" | null>(null);

  // ThemeProvider keeps the instant local cache; this debounced write makes
  // the complete choice account-backed. Dual-role accounts receive the same
  // preference on both profiles, so switching portal or device cannot switch
  // their appearance unexpectedly.
  const appearancePayload = JSON.stringify(theme.profileSettings);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setAppearanceStatus("saving");
      try {
        await Promise.all(
          profiles.map((item) =>
            api.updateProfile(item.id, {
              settings: { ...item.settings, ...theme.profileSettings },
            }),
          ),
        );
        setAppearanceStatus("saved");
      } catch {
        setAppearanceStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [appearancePayload, profiles]);

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

  if (showGuide) return <GuideScreen onBack={() => setShowGuide(false)} />;

  return (
    <>
      <ScreenTitle title="Settings" />

      <Card className="mb-3" onClick={() => setShowGuide(true)}>
        <div className="flex items-center gap-3">
          <IconTile emoji="📖" tint="var(--t-accent)" size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">How to use AntRep</p>
            <p className="mt-0.5 text-xs font-semibold leading-snug text-muted">
              The full guide — getting started, every screen, and what the numbers mean.
            </p>
          </div>
          <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
        </div>
      </Card>

      {isDemoMode && (
        <Card className="mb-3" tint="var(--color-gold)">
          <p className="text-sm font-black text-ink">Demo mode</p>
          <p className="mt-1 text-xs font-semibold leading-snug text-muted">
            Everything is stored in this browser — no database, no account needed. Sign in as{" "}
            {DEMO_ACCOUNTS.map((a) => a.email).join(" or ")} with password{" "}
            <code className="rounded bg-inset px-1">demo1234</code>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                resetDemoStore();
                window.location.reload();
              }}
            >
              Reset demo data
            </Button>
            <Button size="sm" onClick={disableDemoMode}>
              Leave demo
            </Button>
          </div>
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
        {UI_MODES_ENABLED && (
          <div className="ui-interface-picker border-b border-line px-4 py-3">
            <div>
              <p className="text-[15px] font-bold text-ink">
                Interface <span className="ml-1 text-[10px] font-black uppercase text-accent">Dev</span>
              </p>
              <p className="text-xs font-semibold text-muted">
                One AntRep, three ways to present the same training data.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Interface style">
              {INTERFACE_OPTIONS.map((option) => {
                const selected = theme.uiMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => theme.setUiMode(option.value)}
                    className={`ui-interface-option min-w-0 rounded-2xl border px-2 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected ? "border-accent bg-accent-soft" : "border-line bg-inset"
                    }`}
                  >
                    <span
                      className={`ui-mode-preview ui-mode-preview-${option.value}`}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="block text-xs font-black leading-tight text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold leading-tight text-muted">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <SettingRow
          title="Theme"
          subtitle={
            theme.modePreference === "auto"
              ? `Auto · ${theme.mode === "dark" ? "Dark" : "Light"} now`
              : theme.modePreference === "dark"
                ? "Dark"
                : "Light"
          }
          right={
            <div className="w-48">
              <Segmented
                value={theme.modePreference}
                onChange={theme.setMode}
                options={[
                  { value: "auto", label: "Auto" },
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
      <p
        className={`mt-1.5 px-1 text-[11px] font-bold ${
          appearanceStatus === "error" ? "text-danger" : "text-muted"
        }`}
      >
        {appearanceStatus === "saving" && "Saving appearance…"}
        {appearanceStatus === "saved" && "Saved to your account · available on every device"}
        {appearanceStatus === "error" && "Couldn't save appearance. Your choice is still stored on this device."}
      </p>

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
      {!isDemoMode && <EmailCard />}
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

      <Sheet
        open={showTheme}
        onClose={() => setShowTheme(false)}
        title="Colour"
        // The sheet follows the preview, not the app: judging a dark pairing
        // through a light panel tells you very little.
        panelStyle={
          {
            "--t-surface": MODE_SURFACES[previewMode].surface,
            "--t-inset": MODE_SURFACES[previewMode].inset,
            "--t-ink": MODE_SURFACES[previewMode].ink,
            "--t-muted": MODE_SURFACES[previewMode].muted,
            "--t-line": MODE_SURFACES[previewMode].line,
          } as React.CSSProperties
        }
      >
        <ColourPicker theme={theme} previewMode={previewMode} onPreviewMode={setPreviewMode} />
      </Sheet>
    </>
  );
}

/** Toggle used by the coach portal to control what athletes may see. */
/**
 * The address the account signs in with, and how to move it.
 *
 * Accounts made before verification existed often carry a placeholder address
 * that can't receive mail. Swapping it is the point of this card: Supabase
 * emails the new address, and only once that link is opened does the change
 * take effect — at which point the old address stops working for sign-in.
 */
function EmailCard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (!user) return null;
  const verified = user.emailConfirmed;

  async function submit() {
    const value = next.trim();
    if (!value || !value.includes("@")) {
      setFailed(true);
      setNote("That doesn't look like an email address.");
      return;
    }
    setBusy(true);
    setNote(null);
    const result = await api.changeEmail(value);
    setFailed(Boolean(result.error));
    setNote(
      result.error ??
        `Confirmation sent to ${value}. Open the link there to finish — until you do, you keep signing in with your current address.`,
    );
    if (!result.error) setNext("");
    setBusy(false);
    // Deliberately no refresh here: the address doesn't change until the link
    // in the email is opened, and reloading would unmount this card — taking
    // the message, including any error, off the screen before it can be read.
  }

  return (
    <Card className="mb-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">Email</p>
          <p className="truncate text-sm font-black text-ink">{user.email}</p>
        </div>
        <Pill tint={verified ? "var(--color-done)" : "var(--color-gold)"}>
          {verified ? "Verified" : "Unverified"}
        </Pill>
      </div>

      {!verified && (
        <p className="mt-2 text-xs font-semibold leading-snug text-muted">
          This address hasn't been confirmed. If it's a placeholder that can't receive mail, change
          it below — you'll need a working address to reset your password or sign in by link.
        </p>
      )}

      {note && (
        <p className={`mt-2 text-xs font-bold ${failed ? "text-danger" : "text-accent"}`}>{note}</p>
      )}

      {open ? (
        <div className="mt-3 space-y-2">
          <Field label="New email">
            <TextField
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={submit}>
              {busy ? "Sending…" : "Send confirmation"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setNote(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Change email
        </Button>
      )}
    </Card>
  );
}

/**
 * Colour, split so each screenful asks one question: which colour, then how to
 * use it. The preview sits above both tabs and never scrolls away, with its own
 * light/dark toggle — you can check a pairing in the other mode without
 * actually switching the app into it.
 */
function ColourPicker({
  theme,
  previewMode,
  onPreviewMode,
}: {
  theme: ReturnType<typeof useTheme>;
  previewMode: "light" | "dark";
  onPreviewMode: (m: "light" | "dark") => void;
}) {
  const [tab, setTab] = useState<"colours" | "style" | "accent">("colours");

  const chosen = BACKGROUNDS.find((b) => b.key === theme.bg) ?? null;
  const primary = chosen ?? DEFAULT_PALETTE;
  const second = BACKGROUNDS.find((b) => b.key === theme.bg2) ?? null;
  const paired = second && second.key !== primary.key ? second : null;
  const needsSecond = theme.style === "gradient" || theme.style === "duotone";

  const page =
    paired && theme.style === "gradient"
      ? `linear-gradient(160deg, ${primary[previewMode].bg} 0%, ${paired[previewMode].bg} 100%)`
      : primary[previewMode].bg;

  // Duotone puts the second colour on the card, not the background, so the
  // preview needs a card on it to show any difference at all.
  const ui = paired && theme.style === "duotone" ? paired : primary;
  const pinned = ACCENTS.find((a) => a.key === theme.accent);
  const previewAccent = pinned ? pinned.swatch : ui[previewMode].accent;
  const cardBg =
    paired && theme.style === "duotone" ? ui[previewMode].bg : previewMode === "dark" ? "#202f36" : "#ffffff";

  const swatch = (bg: BackgroundPalette, selected: boolean, onPick: () => void, blend = false) => (
    <button
      key={bg.key}
      onClick={onPick}
      aria-pressed={selected}
      className={`rounded-2xl border p-2 text-[11px] font-black ${
        selected ? "border-accent" : "border-line"
      }`}
      style={{
        background: blend
          ? `linear-gradient(160deg, ${primary[previewMode].bg} 0%, ${bg[previewMode].bg} 100%)`
          : bg[previewMode].bg,
        color: bg[previewMode].accent,
      }}
    >
      {bg.label}
    </button>
  );

  return (
    <>
      {/* Always on screen: changing anything below should be visible at once. */}
      <div
        className="mb-2 flex h-24 items-center justify-center rounded-card border border-line"
        style={{ background: page }}
      >
        <div
          className="rounded-2xl border border-line px-4 py-2 text-xs font-black"
          style={{ background: cardBg, color: previewAccent }}
        >
          {primary.label}
          {paired && needsSecond && (theme.style === "gradient" ? " → " : " + ") + paired.label}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <p className="flex-1 text-[11px] font-semibold text-muted">
          Preview{previewMode === theme.mode ? "" : ` — ${previewMode} mode`}
        </p>
        <div className="w-32">
          <Segmented
            value={previewMode}
            onChange={onPreviewMode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
      </div>

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "colours", label: "Colours" },
            { value: "style", label: "Style" },
            { value: "accent", label: "Accent" },
          ]}
        />
      </div>

      {tab === "colours" && (
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => theme.setBg(null)}
            aria-pressed={theme.bg === null}
            className={`rounded-2xl border p-2 text-[11px] font-black ${
              theme.bg === null ? "border-accent" : "border-line"
            }`}
            style={{
              background: DEFAULT_PALETTE[previewMode].bg,
              color: DEFAULT_PALETTE[previewMode].accent,
            }}
          >
            Default
          </button>
          {BACKGROUNDS.map((bg) => swatch(bg, theme.bg === bg.key, () => theme.setBg(bg.key)))}
        </div>
      )}

      {tab === "style" && (
        <>
          <Segmented
            value={theme.style}
            onChange={(style) => {
              theme.setStyle(style);
              // Pick a partner so the second colour does something immediately
              // rather than silently behaving like solid.
              if (style !== "solid" && !theme.bg2) {
                const suggestion = BACKGROUNDS.find((b) => b.key !== primary.key);
                if (suggestion) theme.setBg2(suggestion.key);
              }
            }}
            options={[
              { value: "solid", label: "Solid" },
              { value: "gradient", label: "Gradient" },
              { value: "duotone", label: "Duotone" },
            ]}
          />
          <p className="mt-2 text-[11px] font-semibold text-muted">
            {theme.style === "solid" && "One colour for the background and the app."}
            {theme.style === "gradient" && "The background fades from your colour into a second."}
            {theme.style === "duotone" &&
              "Your colour stays on the background; a second one paints the cards and buttons."}
          </p>

          {needsSecond && (
            <>
              <SectionHeader title={theme.style === "gradient" ? "Fades into" : "App colour"} />
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.filter((b) => b.key !== primary.key).map((bg) =>
                  swatch(
                    bg,
                    theme.bg2 === bg.key,
                    () => theme.setBg2(bg.key),
                    theme.style === "gradient",
                  ),
                )}
              </div>
              <p className="mt-2 text-[11px] font-semibold text-muted">
                {theme.style === "gradient"
                  ? "The accent still comes from your first colour, so text stays readable whichever pair you choose."
                  : "This colour drives the cards, insets and buttons — pick one that stands away from your background."}
              </p>
            </>
          )}

        </>
      )}

      {tab === "accent" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => theme.setAccent("auto")}
              aria-pressed={theme.accent === "auto"}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${
                theme.accent === "auto" ? "border-accent" : "border-line"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: ui[previewMode].accent }}
              />
              Auto
            </button>
            {ACCENTS.map((accent) => (
              <button
                key={accent.key}
                onClick={() => theme.setAccent(accent.key)}
                aria-pressed={theme.accent === accent.key}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${
                  theme.accent === accent.key ? "border-accent" : "border-line"
                }`}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: accent.swatch }} />
                {accent.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-muted">
            {theme.accent === "auto"
              ? "Auto takes the accent from the colours you picked — the app colour under duotone, your main colour otherwise."
              : "Pinned. This accent applies whichever colours and style you choose."}
          </p>
        </>
      )}
    </>
  );
}


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
