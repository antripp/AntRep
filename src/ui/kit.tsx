/**
 * AntRep UI kit — the iOS app's visual language on the web: tinted patterned
 * canvas, soft rounded cards, capsule actions, progress rings and a bottom tab
 * bar. Colours come from the theme tokens in index.css.
 */

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

// ------------------------------------------------------------------
// Icons (inline so nothing loads from the network)
// ------------------------------------------------------------------

type IconProps = { className?: string; style?: CSSProperties };
const svg = (path: ReactNode, viewBox = "0 0 24 24") =>
  function Icon({ className = "h-5 w-5", style }: IconProps) {
    return (
      <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
        {path}
      </svg>
    );
  };

export const Icon = {
  home: svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  plan: svg(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></>),
  progress: svg(<><path d="M3 20h18" /><path d="M6 20V10M12 20V4M18 20v-7" /></>),
  dumbbell: svg(<><path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8" /></>),
  settings: svg(<><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.6-1H1a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 3 8.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8.6 3 1.7 1.7 0 0 0 10 1.4V1a2 2 0 1 1 4 0v.2A1.7 1.7 0 0 0 16.9 3a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 22.6 10H23a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" /></>),
  people: svg(<><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 5.3a3.4 3.4 0 0 1 0 6.4M18 20a6.4 6.4 0 0 0-2-4.7" /></>),
  plus: svg(<><path d="M12 5v14M5 12h14" /></>),
  check: svg(<><path d="m5 13 4 4L19 7" /></>),
  chevron: svg(<><path d="m9 6 6 6-6 6" /></>),
  chevronDown: svg(<><path d="m6 9 6 6 6-6" /></>),
  play: svg(<><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></>),
  pause: svg(<><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" /></>),
  stop: svg(<><rect x="6" y="6" width="12" height="12" rx="2.4" fill="currentColor" stroke="none" /></>),
  flame: svg(<><path d="M12 3s5 4.3 5 9a5 5 0 0 1-10 0c0-1.9 1-3.4 2-4.4 0 2 1 3 2 3 1.3 0 1.6-1.4 1-3.3-.4-1.5-.5-3-0-4.3z" /></>),
  star: svg(<><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" /></>),
  trophy: svg(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 5H5v1.5A3.5 3.5 0 0 0 8 10M16 5h3v1.5A3.5 3.5 0 0 1 16 10M10 13h4l.5 4h-5z" /><path d="M8 20h8" /></>),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>),
  calendarClock: svg(<><path d="M20 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6" /><path d="M8 2v4M16 2v4M3 10h17" /><circle cx="17.5" cy="17.5" r="4.5" /><path d="M17.5 15.5v2.2l1.5 1" /></>),
  link: svg(<><path d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3" /><path d="M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.7l1.3-1.3" /></>),
  trash: svg(<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" /></>),
  edit: svg(<><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /></>),
  back: svg(<><path d="M15 6 9 12l6 6" /></>),
  copy: svg(<><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
  send: svg(<><path d="m4 12 16-8-6 16-2.5-6z" /></>),
  search: svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></>),
  close: svg(<><path d="M6 6l12 12M18 6 6 18" /></>),
  alert: svg(<><path d="M12 3.8 2.6 20h18.8z" /><path d="M12 10v4.2M12 17.2v.2" /></>),
  share: svg(<><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>),
};

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pattern-bg min-h-dvh bg-bg ${className}`}>
      <div className="mx-auto w-full max-w-lg px-4 pb-32 pt-5 md:max-w-3xl">{children}</div>
    </div>
  );
}

export function ScreenTitle({
  date,
  title,
  quote,
  right,
}: {
  date?: string;
  title: string;
  quote?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {date && <p className="font-quote text-base italic text-ink/85">{date}</p>}
          <h1 className="text-2xl font-black leading-tight text-ink">{title}</h1>
        </div>
        {right}
      </div>
      {quote && <p className="mt-3 font-quote text-base italic leading-snug text-ink/80">“{quote}”</p>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  onClick,
  tint,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  tint?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      style={tint ? { borderColor: `${tint}38` } : undefined}
      className={`w-full rounded-card border border-line bg-surface p-4 text-left shadow-[0_1px_0_0_rgba(0,0,0,0.04)] ${
        onClick ? "transition active:scale-[0.99]" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  action,
  icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-muted">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function IconTile({
  emoji,
  tint,
  size = 40,
}: {
  emoji: string;
  tint: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[30%]"
      style={{ width: size, height: size, background: `${tint}22`, fontSize: size * 0.5 }}
    >
      <span aria-hidden="true">{emoji}</span>
    </div>
  );
}

export function Pill({
  children,
  tint,
  className = "",
}: {
  children: ReactNode;
  tint?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}
      style={tint ? { color: tint, background: `${tint}24` } : undefined}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------
// Buttons
// ------------------------------------------------------------------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  tint?: string;
  full?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  tint,
  full,
  className = "",
  style,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-black transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";
  const sizes = size === "sm" ? "px-3.5 h-8 text-[13px]" : "px-5 h-11 text-[15px]";
  const variants: Record<string, string> = {
    primary: "text-white",
    secondary: "border border-line bg-surface text-ink",
    ghost: "text-accent",
    danger: "bg-danger text-white",
  };
  const tinted =
    variant === "primary"
      ? { background: tint ?? "var(--t-accent)", ...style }
      : variant === "ghost" && tint
        ? { color: tint, ...style }
        : style;
  return (
    <button
      className={`${base} ${sizes} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
      style={tinted}
      {...props}
    />
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition active:scale-95 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// Inputs
// ------------------------------------------------------------------

export function TextField({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-11 w-full rounded-2xl border border-line bg-inset px-3 text-[15px] font-bold text-ink outline-none placeholder:font-semibold placeholder:text-muted focus:border-accent ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-semibold text-muted">{hint}</span>}
    </label>
  );
}

export function NumberField({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  placeholder?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));

  // Rapid taps must accumulate even if React hasn't re-rendered with the new
  // prop yet, so steppers work off the last value this field emitted.
  const latest = useRef(value);
  latest.current = value;

  // What's being typed, kept verbatim until the field is left. Without this the
  // controlled value round-trips through Number() on every keystroke, so "52."
  // renders back as "52" and the decimal point can never be followed by digits.
  const [draft, setDraft] = useState<string | null>(null);

  const bump = (delta: number) => {
    const next = clamp((latest.current ?? 0) + delta);
    latest.current = next;
    setDraft(null);
    onChange(next);
  };

  return (
    <div className="flex h-11 items-center rounded-2xl border border-line bg-inset">
      <button
        type="button"
        aria-label="Decrease"
        className="h-full w-9 text-lg font-black text-muted active:text-ink"
        onClick={() => bump(-step)}
      >
        −
      </button>
      <input
        inputMode="decimal"
        value={draft ?? (value === null ? "" : String(value))}
        placeholder={placeholder ?? "0"}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (raw === "") {
            setDraft("");
            latest.current = null;
            return onChange(null);
          }
          // Digits with at most one decimal point — anything else is a typo, and
          // rejecting it leaves the previous draft on screen.
          if (!/^\d*\.?\d*$/.test(raw)) return;
          setDraft(raw);
          const n = Number(raw);
          if (Number.isFinite(n)) {
            latest.current = n;
            onChange(n);
          }
        }}
        onBlur={() => setDraft(null)}
        // The placeholder is often a prescribed target sitting in an empty
        // field. It has to read as "what was asked for", not as a recorded
        // number, so it is deliberately lighter than an entered value.
        className="h-full w-full min-w-0 bg-transparent text-center text-[15px] font-black text-ink outline-none placeholder:font-bold placeholder:text-muted/50"
      />
      {suffix && <span className="pr-1 text-xs font-bold text-muted">{suffix}</span>}
      <button
        type="button"
        aria-label="Increase"
        className="h-full w-9 text-lg font-black text-muted active:text-ink"
        onClick={() => bump(step)}
      >
        +
      </button>
    </div>
  );
}

/**
 * Effort, on the reps-in-reserve scale.
 *
 * A slider rather than a number field: the useful range is 5–10 in half steps,
 * which is 11 positions — quicker to thumb than to type, and it shows the whole
 * scale so the number has context. The meaning is spelled out under it, because
 * "8" only means something once you know it's "2 reps left".
 *
 * `null` is a real state (not rated), so the track stays grey until touched.
 */
export function RpeSlider({
  value,
  onChange,
  meaning,
  color = "var(--t-accent)",
  target,
  compact = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  /** Text for the current value — from `rpeMeaning()`. */
  meaning: string;
  color?: string;
  /** The coach's prescribed effort, marked on the track. */
  target?: number | null;
  compact?: boolean;
}) {
  const MIN = 0;
  const MAX = 10;
  // 0 is a real rating, so only null counts as unrated.
  const rated = value !== null;
  const shown = rated ? value : 7;
  const pct = ((shown - MIN) / (MAX - MIN)) * 100;
  const targetPct =
    target && target >= MIN && target <= MAX ? ((target - MIN) / (MAX - MIN)) * 100 : null;

  return (
    <div className="w-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-muted">RPE</span>
        <span
          className="text-[15px] font-black tabular-nums"
          style={{ color: rated ? color : "var(--t-muted)" }}
        >
          {rated ? shown : "—"}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-muted">{meaning}</span>
        )}
        {rated && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-[10px] font-black uppercase text-muted active:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative mt-1.5 h-5">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-inset" />
        {rated && (
          <div
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-[width]"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
        {/* What the coach asked for */}
        {targetPct !== null && (
          <div
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-ink/40"
            style={{ left: `${targetPct}%` }}
            title={`Target RPE ${target}`}
          />
        )}
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.5}
          value={shown}
          aria-label="RPE"
          aria-valuetext={rated ? `RPE ${shown}, ${meaning}` : "Not rated"}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rpe-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
          style={{ ["--rpe-thumb" as string]: rated ? color : "var(--t-muted)" }}
        />
      </div>

      {compact && <p className="mt-0.5 truncate text-[11px] font-bold text-muted">{meaning}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full border border-line bg-inset p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-black transition ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function SettingRow({
  title,
  subtitle,
  right,
  onClick,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-ink">{title}</p>
        {subtitle && <p className="text-xs font-semibold text-muted">{subtitle}</p>}
      </div>
      {right}
      {onClick && !right && <Icon.chevron className="h-4 w-4 text-muted" />}
    </Tag>
  );
}

// ------------------------------------------------------------------
// Feedback
// ------------------------------------------------------------------

export function ProgressRing({
  ratio,
  size = 72,
  stroke = 9,
  color = "var(--t-accent)",
  label,
  sublabel,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio || 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.16} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <span className="text-sm font-black leading-none text-ink">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[10px] font-bold uppercase text-muted">{sublabel}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ ratio, color = "var(--t-accent)" }: { ratio: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: `${color}22` }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: color }}
      />
    </div>
  );
}

export function StatTile({
  value,
  label,
  tint,
  icon,
}: {
  value: string;
  label: string;
  tint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-inset px-3 py-2.5 text-center">
      {icon && <div className="mb-1 flex justify-center" style={{ color: tint }}>{icon}</div>}
      <p className="text-lg font-black leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="text-base font-black text-ink">{title}</p>
      {subtitle && <p className="mx-auto mt-1 max-w-xs text-sm font-semibold text-muted">{subtitle}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-[3px] border-line border-t-accent ${className}`} role="status" aria-label="Loading" />
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

// ------------------------------------------------------------------
// Overlays
// ------------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  panelStyle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Theme variable overrides for the panel — lets a sheet preview another mode. */
  panelStyle?: CSSProperties;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <Icon.close className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
        {footer && <div className="sticky bottom-0 mt-4 bg-surface pt-2">{footer}</div>}
      </div>
    </div>
  );
}

export interface DialogAction {
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
}

/** iOS-style confirmation dialog (a stack of full-width choices). */
export function ActionDialog({
  open,
  title,
  message,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  actions: DialogAction[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-ink">{title}</h2>
        {message && <p className="mt-1 text-sm font-semibold leading-snug text-muted">{message}</p>}
        <div className="mt-4 space-y-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                a.onClick();
                onClose();
              }}
              className={`h-11 w-full rounded-full text-[15px] font-black transition active:scale-[0.98] ${
                a.tone === "primary"
                  ? "bg-accent text-white"
                  : a.tone === "danger"
                    ? "bg-danger/10 text-danger"
                    : "border border-line bg-inset text-ink"
              }`}
            >
              {a.label}
            </button>
          ))}
          <button onClick={onClose} className="h-11 w-full rounded-full text-[15px] font-black text-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="rounded-full bg-ink px-4 py-2 text-sm font-black text-bg shadow-lg">{message}</div>
    </div>
  );
}

/** Full-screen 3-2-1 countdown before a timed workout starts. */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const done = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      setN((v) => {
        if (v <= 1) {
          clearInterval(t);
          if (!done.current) {
            done.current = true;
            setTimeout(onDone, 350);
          }
          return 0;
        }
        return v - 1;
      });
    }, 800);
    return () => clearInterval(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/95 backdrop-blur">
      <p key={n} className="animate-[pop_.4s_ease] text-[92px] font-black text-accent">
        {n === 0 ? "GO" : n}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------
// Tab bar
// ------------------------------------------------------------------

export interface TabItem {
  key: string;
  label: string;
  icon: (p: IconProps) => JSX.Element;
}

export function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabItem[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 md:max-w-3xl">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const on = tab.key === active;
          return (
            <button
              key={tab.key}
              onClick={() => onSelect(tab.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 transition ${
                on ? "text-accent" : "text-muted"
              }`}
              aria-current={on ? "page" : undefined}
            >
              <TabIcon className="h-[22px] w-[22px]" />
              <span className="text-[10px] font-black uppercase tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
