import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card bg-white/95 p-4 shadow-[0_2px_12px_rgba(49,49,49,0.08)] ${className}`}>
      {children}
    </div>
  );
}

export function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color ?? "#66757f" }}
    >
      {label}
    </span>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-mint-deep text-white hover:bg-done-back active:scale-[0.98]",
    secondary: "bg-mint-pale text-mint-deep hover:bg-mint/60 active:scale-[0.98]",
    ghost: "bg-transparent text-chip hover:bg-black/5",
    danger: "bg-red-100 text-red-600 hover:bg-red-200",
  }[variant];
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-extrabold transition disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-mint/60 bg-white px-3 py-2 text-sm outline-none focus:border-mint-deep ${className}`}
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
  decimals = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  decimals?: number;
}) {
  const fmt = (v: number) => v.toFixed(decimals);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="decrease"
        className="h-9 w-9 shrink-0 rounded-full bg-mint-pale text-lg font-extrabold text-mint-deep active:scale-95"
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
      >
        −
      </button>
      <div className="min-w-14 text-center">
        <input
          type="number"
          inputMode="decimal"
          className="w-14 bg-transparent text-center text-base font-extrabold outline-none"
          value={fmt(value)}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        {suffix && <div className="-mt-1 text-[10px] font-bold text-chip">{suffix}</div>}
      </div>
      <button
        type="button"
        aria-label="increase"
        className="h-9 w-9 shrink-0 rounded-full bg-mint-pale text-lg font-extrabold text-mint-deep active:scale-95"
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
        done ? "border-done-back bg-done text-white" : "border-check-back bg-check-front text-transparent"
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
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-mint-pale border-t-mint-deep" />
    </div>
  );
}

export function EmptyState({ mascot, title, subtitle }: { mascot?: boolean; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {mascot && <img src="/mascots/athlete-mascot.png" alt="" className="h-28 w-28 opacity-90" />}
      <p className="text-base font-extrabold">{title}</p>
      {subtitle && <p className="max-w-xs text-sm font-semibold text-chip">{subtitle}</p>}
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
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-mint-deep/20 bg-mint-deep pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:left-0 md:right-auto md:w-20 md:border-r md:border-t-0 md:pb-0">
      <div className="mx-auto flex max-w-md justify-around md:mt-6 md:flex-col md:justify-start md:gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-extrabold text-tab-label transition md:flex-none ${
              active === t.key ? "opacity-100" : "opacity-60 hover:opacity-90"
            }`}
          >
            <span className={`rounded-xl px-3 py-1 ${active === t.key ? "bg-white/20" : ""}`}>{t.icon}</span>
            {t.label}
          </button>
        ))}
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
};
