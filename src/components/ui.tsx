import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { MASCOTS } from "../lib/brand";
import type { AvatarPref } from "../lib/types";

/* Flat, bordered "Duolingo" card. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border-2 border-line bg-surface p-4 transition-colors ${className}`}>
      {children}
    </div>
  );
}

export function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color ?? "#82898f" }}
    >
      {label}
    </span>
  );
}

/* Chunky button with the pressed 3D bottom edge. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "border-b-4 border-accent-deep bg-accent text-white",
    secondary: "border-2 border-b-4 border-line bg-surface text-accent",
    ghost: "border-b-4 border-transparent bg-transparent text-muted hover:bg-inset",
    danger: "border-2 border-b-4 border-line bg-surface text-danger",
  }[variant];
  return (
    <button
      className={`rounded-2xl px-4 py-2 text-sm font-extrabold tracking-wide transition-all active:translate-y-[3px] active:border-b-0 active:border-b-transparent disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border-2 border-line bg-inset px-3 py-2 text-sm font-semibold text-ink outline-none placeholder:text-muted/70 focus:border-accent ${className}`}
      {...props}
    />
  );
}

/** Custom dropdown — Duolingo-style, theme-aware (replaces native selects). */
export function Select<T extends string>({
  value,
  onChange,
  options,
  className = "",
  placeholder = "Choose…",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border-2 border-b-4 border-line bg-inset px-3 py-2 text-left text-xs font-extrabold text-ink outline-none transition hover:bg-surface focus:border-accent active:translate-y-[2px] active:border-b-2"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border-2 border-line bg-surface p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full rounded-lg px-3 py-2 text-left text-xs font-extrabold transition ${
                o.value === value ? "bg-accent-soft text-accent" : "text-ink hover:bg-inset"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Numeric input you can actually type in: while focused it keeps a raw text
 * buffer, so "12.5" or "107" go in as one edit (no reformat-per-keystroke),
 * accepts comma decimals, and only commits parseable values. Formats on blur.
 */
export function NumInput({
  value,
  onCommit,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={text ?? String(value)}
      onFocus={(e) => {
        setText(String(value || ""));
        e.target.select();
      }}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^-?\d*([.,]\d*)?$/.test(t)) return; // digits + one decimal sep only
        setText(t);
        const n = parseFloat(t.replace(",", "."));
        if (!Number.isNaN(n)) onCommit(n);
        else if (t.trim() === "") onCommit(0);
      }}
      onBlur={() => setText(null)}
      {...props}
    />
  );
}

/** +/- stepper used for weight & reps logging (big touch targets). */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="decrease"
        className="h-9 w-9 shrink-0 rounded-xl border-2 border-b-4 border-line bg-surface text-lg font-extrabold text-accent active:translate-y-[2px] active:border-b-2"
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
      >
        −
      </button>
      <div className="min-w-14 text-center">
        <NumInput
          value={value}
          onCommit={onChange}
          className="w-14 bg-transparent text-center text-base font-extrabold text-ink outline-none"
        />
        {suffix && <div className="-mt-1 text-[10px] font-bold text-muted">{suffix}</div>}
      </div>
      <button
        type="button"
        aria-label="increase"
        className="h-9 w-9 shrink-0 rounded-xl border-2 border-b-4 border-line bg-surface text-lg font-extrabold text-accent active:translate-y-[2px] active:border-b-2"
        onClick={() => onChange(Number((value + step).toFixed(2)))}
      >
        +
      </button>
    </div>
  );
}

export function CheckCircle({ done, onClick }: { done: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={done ? "completed" : "not completed"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        done ? "border-done-deep bg-done text-white" : "border-line bg-inset text-transparent"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3.5">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
    </div>
  );
}

export function EmptyState({ mascot, title, subtitle }: { mascot?: boolean; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {mascot && <img src={MASCOTS.athlete} alt="" className="h-28 w-28 object-contain opacity-90" />}
      <p className="text-base font-extrabold">{title}</p>
      {subtitle && <p className="max-w-xs text-sm font-semibold text-muted">{subtitle}</p>}
    </div>
  );
}

/* ---------- avatars (initials / symbol / solid colour) ---------- */

export const AVATAR_COLORS = [
  "#e0533d", "#e07b39", "#d9a521", "#6a994e", "#2e9e77", "#1f8a9d",
  "#2f80c3", "#4a55b2", "#7b61c9", "#b0509d", "#d14f74", "#6e7f92",
];

export const AVATAR_SYMBOLS = [
  "💪", "🔥", "⚡", "🦍", "🐆", "🦅", "🚀", "🏔️", "🌊", "☀️", "🌙", "⭐",
  "🎯", "🥇", "🛡️", "🍀", "🌶️", "🫐", "🐉", "👑", "🎧", "🏋️", "🥊", "🏃",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Profile picture used to tell connections apart at a glance. */
export function Avatar({
  name,
  avatar,
  size = "md",
}: {
  name: string;
  avatar?: AvatarPref | null;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-base", lg: "h-14 w-14 text-xl" }[size];
  const color = avatar?.color || AVATAR_COLORS[hashStr(name) % AVATAR_COLORS.length];
  const kind = avatar?.kind ?? "initials";

  if (kind === "solid") {
    return <div className={`${dims} shrink-0 rounded-xl`} style={{ backgroundColor: color }} aria-label={name} />;
  }
  if (kind === "symbol") {
    return (
      <div
        className={`${dims} flex shrink-0 items-center justify-center rounded-xl`}
        style={{ backgroundColor: `${color}33` }}
        aria-label={name}
      >
        {avatar?.value || "💪"}
      </div>
    );
  }
  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-xl font-black text-white`}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initialsOf(name)}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Small rounded icon square, like the option rows in StarDo. */
export function IconBadge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
      style={{ backgroundColor: color ?? "var(--t-accent-soft)" }}
    >
      {children}
    </span>
  );
}

/** Settings-style row: icon badge, label/hint, trailing control. */
export function SettingRow({
  icon,
  iconColor,
  label,
  hint,
  children,
  onClick,
}: {
  icon: ReactNode;
  iconColor?: string;
  label: string;
  hint?: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <IconBadge color={iconColor}>{icon}</IconBadge>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-extrabold">{label}</p>
        {hint && <p className="truncate text-xs font-semibold text-muted">{hint}</p>}
      </div>
      {children}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-card border-2 border-line bg-surface p-3 text-left transition-colors hover:bg-inset">
        {body}
      </button>
    );
  }
  return <div className="flex items-center gap-3 rounded-card border-2 border-line bg-surface p-3">{body}</div>;
}

/** Two-or-more option pill switch (used for light/dark, log types…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl border-2 border-line bg-inset p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
            o.key === value ? "bg-surface text-accent shadow-sm" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom-sheet / centered modal with a dimmed backdrop. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-6" onClick={onClose}>
      <div
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border-2 border-line bg-surface p-4 md:rounded-3xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-inset text-sm font-black text-muted"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export interface TabItem {
  key: string;
  label: string;
  icon: ReactNode;
}

/** Bottom tab bar on phones; becomes a left rail on md+ screens. */
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
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:left-0 md:right-auto md:w-20 md:border-r-2 md:border-t-0 md:pb-0">
      <div className="mx-auto flex max-w-md justify-around md:mt-6 md:flex-col md:justify-start md:gap-2">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-extrabold transition md:flex-none ${
                isActive ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              <span className={`rounded-xl px-3 py-1 ${isActive ? "bg-accent-soft" : ""}`}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Simple inline SVG icons (no icon dependency). */
export const Icons = {
  today: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  week: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 17h2M11 17h2" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  ),
  athletes: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
      <circle cx="17.5" cy="9.5" r="2.5" />
      <path d="M15.5 14.5a5 5 0 0 1 6 4.5" strokeLinecap="round" />
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" strokeLinecap="round" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-3M12 15V8M16 15v-5" strokeLinecap="round" />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  import: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  ),
};
