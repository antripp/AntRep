import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

/* Accent choices used when NO background colour is selected. */
export const ACCENTS = [
  { key: "mint", label: "Mint", swatch: "#58cc02" },
  { key: "sky", label: "Sky", swatch: "#1cb0f6" },
  { key: "grape", label: "Grape", swatch: "#a560f8" },
  { key: "punch", label: "Punch", swatch: "#ff4b8b" },
  { key: "sunset", label: "Sunset", swatch: "#ff9600" },
] as const;
export type AccentKey = (typeof ACCENTS)[number]["key"];

/**
 * 20 curated background tints — bold-but-subtle, easy on the eyes, with a
 * light and a dark rendition. Selecting one also drives the accent (same
 * hue, deeper), so the whole UI re-tunes to the chosen colour.
 */
export interface BackgroundPalette {
  key: string;
  label: string;
  light: { bg: string; accent: string; deep: string };
  dark: { bg: string; accent: string; deep: string };
}

export const BACKGROUNDS: BackgroundPalette[] = [
  { key: "sage",     label: "Sage",     light: { bg: "#eef2e9", accent: "#6a994e", deep: "#588240" }, dark: { bg: "#1a231b", accent: "#8ab17d", deep: "#6f975f" } },
  { key: "forest",   label: "Forest",   light: { bg: "#e9f1ea", accent: "#2e7d4f", deep: "#256741" }, dark: { bg: "#12211a", accent: "#57a877", deep: "#448a61" } },
  { key: "mint",     label: "Mint",     light: { bg: "#e9f5ec", accent: "#38a169", deep: "#2d8656" }, dark: { bg: "#142219", accent: "#5fc98d", deep: "#4bab75" } },
  { key: "olive",    label: "Olive",    light: { bg: "#f0f1e0", accent: "#7f8c2b", deep: "#697524" }, dark: { bg: "#20220f", accent: "#a3b04a", deep: "#88943c" } },
  { key: "teal",     label: "Teal",     light: { bg: "#e5f2f0", accent: "#1f8a7d", deep: "#197267" }, dark: { bg: "#10231f", accent: "#4bb3a4", deep: "#3b9789" } },
  { key: "ocean",    label: "Ocean",    light: { bg: "#e8f1f5", accent: "#1f7a99", deep: "#196680" }, dark: { bg: "#12222b", accent: "#4aa3c4", deep: "#3a89a7" } },
  { key: "sky",      label: "Sky",      light: { bg: "#e9f2fb", accent: "#2f80c3", deep: "#276ba4" }, dark: { bg: "#131f2b", accent: "#58a6e8", deep: "#458cc7" } },
  { key: "denim",    label: "Denim",    light: { bg: "#e8eef6", accent: "#3a6ea5", deep: "#305c8a" }, dark: { bg: "#131c26", accent: "#6d9fd4", deep: "#5885b6" } },
  { key: "indigo",   label: "Indigo",   light: { bg: "#eaecf8", accent: "#4a55b2", deep: "#3d4796" }, dark: { bg: "#151827", accent: "#7d88e0", deep: "#6570c2" } },
  { key: "lavender", label: "Lavender", light: { bg: "#efecf9", accent: "#7b61c9", deep: "#6750ab" }, dark: { bg: "#1c1928", accent: "#a08ae0", deep: "#8671c2" } },
  { key: "plum",     label: "Plum",     light: { bg: "#f3eaf4", accent: "#9c4f96", deep: "#83417e" }, dark: { bg: "#241726", accent: "#c47cbd", deep: "#a763a0" } },
  { key: "rose",     label: "Rose",     light: { bg: "#faecef", accent: "#c94f6d", deep: "#ab415b" }, dark: { bg: "#291418", accent: "#e07a92", deep: "#c1637a" } },
  { key: "blush",    label: "Blush",    light: { bg: "#fbeee9", accent: "#d1704f", deep: "#b25d40" }, dark: { bg: "#2a1a14", accent: "#e89a7a", deep: "#c98063" } },
  { key: "peach",    label: "Peach",    light: { bg: "#fdeee3", accent: "#e07b39", deep: "#bf672e" }, dark: { bg: "#2a1c11", accent: "#f09b5e", deep: "#d1824a" } },
  { key: "clay",     label: "Clay",     light: { bg: "#f4ebe4", accent: "#a8663b", deep: "#8d5430" }, dark: { bg: "#271c15", accent: "#c98b5e", deep: "#ab724b" } },
  { key: "sand",     label: "Sand",     light: { bg: "#f7f1e4", accent: "#b98a2f", deep: "#9c7326" }, dark: { bg: "#262014", accent: "#d4a94e", deep: "#b58e3d" } },
  { key: "butter",   label: "Butter",   light: { bg: "#faf3dd", accent: "#b3922e", deep: "#967a25" }, dark: { bg: "#26210f", accent: "#d4b854", deep: "#b59b42" } },
  { key: "mocha",    label: "Mocha",    light: { bg: "#f1ebe6", accent: "#7d5a44", deep: "#684a38" }, dark: { bg: "#211a15", accent: "#a98268", deep: "#8e6b54" } },
  { key: "slate",    label: "Slate",    light: { bg: "#eceff3", accent: "#5a6c85", deep: "#4a596e" }, dark: { bg: "#181d24", accent: "#8ba0bd", deep: "#71869f" } },
  { key: "mist",     label: "Mist",     light: { bg: "#edf1f2", accent: "#5f8794", deep: "#4e707b" }, dark: { bg: "#171e20", accent: "#8ab3c0", deep: "#7096a2" } },
  { key: "crimson",  label: "Crimson",  light: { bg: "#fbe9ec", accent: "#c02f4a", deep: "#a3283e" }, dark: { bg: "#2a1216", accent: "#e56a80", deep: "#c4576b" } },
  { key: "amber",    label: "Amber",    light: { bg: "#fdf1de", accent: "#c98a12", deep: "#ab740f" }, dark: { bg: "#2b2110", accent: "#e5b04a", deep: "#c4953e" } },
  { key: "jade",     label: "Jade",     light: { bg: "#e6f4ee", accent: "#1f8a5f", deep: "#197250" }, dark: { bg: "#10231c", accent: "#4cb68a", deep: "#3c9a73" } },
  { key: "violet",   label: "Violet",   light: { bg: "#f0eafa", accent: "#7a45c4", deep: "#6639a6" }, dark: { bg: "#1d1529", accent: "#a67ae4", deep: "#8d64c4" } },
  { key: "cobalt",   label: "Cobalt",   light: { bg: "#e7edfa", accent: "#2b5fd0", deep: "#244fb0" }, dark: { bg: "#121a2d", accent: "#6b92ec", deep: "#567bc9" } },
  { key: "coral",    label: "Coral",    light: { bg: "#fdece9", accent: "#d95f4a", deep: "#b8503e" }, dark: { bg: "#2b1714", accent: "#f0897a", deep: "#cf7166" } },
  { key: "moss",     label: "Moss",     light: { bg: "#edf1e5", accent: "#5d7c33", deep: "#4d682a" }, dark: { bg: "#1b2113", accent: "#8fa95f", deep: "#77904d" } },
  { key: "charcoal", label: "Charcoal", light: { bg: "#ecedee", accent: "#52585f", deep: "#43484e" }, dark: { bg: "#17191b", accent: "#9aa2ab", deep: "#7f8790" } },
];

/** Solid uses one colour; duotone washes it into a second. */
export const THEME_STYLES = ["solid", "duotone"] as const;
export type ThemeStyle = (typeof THEME_STYLES)[number];

/* Background texture (item: dev-tunable pattern lab). */
export const PATTERN_STYLES = ["checker", "dots", "grid", "diag", "none"] as const;
export type PatternStyle = (typeof PATTERN_STYLES)[number];

export interface PatternPref {
  style: PatternStyle;
  size: number; // px tile
  opacityLight: number; // percent, 0–12
  opacityDark: number; // percent, 0–12
}

const DEFAULT_PATTERN: PatternPref = { style: "dots", size: 28, opacityLight: 10, opacityDark: 4 };

interface ThemePref {
  mode: ThemeMode;
  accent: AccentKey;
  bg: string | null; // BackgroundPalette key, or null = default surface
  style: ThemeStyle;
  /** Second BackgroundPalette key — only read when style is "duotone". */
  bg2: string | null;
  pattern: PatternPref;
}

interface ThemeState extends ThemePref {
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentKey) => void;
  setBg: (b: string | null) => void;
  setStyle: (s: ThemeStyle) => void;
  setBg2: (b: string | null) => void;
  setPattern: (p: PatternPref) => void;
}

const STORAGE_KEY = "antrep-theme";

function loadPref(): ThemePref {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const fallback: ThemePref = {
    mode: prefersDark ? "dark" : "light",
    accent: "mint",
    bg: "denim",
    style: "solid",
    bg2: null,
    pattern: DEFAULT_PATTERN,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      mode: p.mode === "dark" || p.mode === "light" ? p.mode : fallback.mode,
      accent: ACCENTS.some((a) => a.key === p.accent) ? p.accent : "mint",
      bg: BACKGROUNDS.some((b) => b.key === p.bg) ? p.bg : fallback.bg,
      style: THEME_STYLES.includes(p.style) ? p.style : "solid",
      bg2: BACKGROUNDS.some((b) => b.key === p.bg2) ? p.bg2 : null,
      // The texture picker is gone; everyone gets the standard dotted default.
      pattern: DEFAULT_PATTERN,
    };
  } catch {
    return fallback;
  }
}


const ThemeContext = createContext<ThemeState>({
  mode: "light",
  accent: "mint",
  bg: null,
  style: "solid",
  bg2: null,
  pattern: DEFAULT_PATTERN,
  setMode: () => {},
  setAccent: () => {},
  setBg: () => {},
  setStyle: () => {},
  setBg2: () => {},
  setPattern: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState(loadPref);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = pref.mode;
    root.dataset.accent = pref.accent;
    root.dataset.pattern = pref.pattern.style;

    // Background palette overrides bg + accent inline (inline wins over the
    // data-accent CSS); clearing it falls back to the plain theme.
    const palette = BACKGROUNDS.find((b) => b.key === pref.bg);
    if (palette) {
      const c = palette[pref.mode];
      root.style.setProperty("--t-bg", c.bg);
      root.style.setProperty("--t-accent", c.accent);
      root.style.setProperty("--t-accent-deep", c.deep);
    } else {
      root.style.removeProperty("--t-bg");
      root.style.removeProperty("--t-accent");
      root.style.removeProperty("--t-accent-deep");
    }

    // Duotone washes the primary into a second colour. The accent still comes
    // from the primary, so contrast stays predictable whatever the pairing.
    const second = BACKGROUNDS.find((b) => b.key === pref.bg2);
    const duotone = pref.style === "duotone" && palette && second && second.key !== palette.key;
    if (duotone) {
      root.dataset.duotone = "on";
      root.style.setProperty(
        "--t-bg-gradient",
        `linear-gradient(160deg, ${palette[pref.mode].bg} 0%, ${second[pref.mode].bg} 100%)`,
      );
    } else {
      delete root.dataset.duotone;
      root.style.removeProperty("--t-bg-gradient");
    }

    root.style.setProperty("--pattern-size", `${pref.pattern.size}px`);
    const opacity = pref.mode === "dark" ? pref.pattern.opacityDark : pref.pattern.opacityLight;
    const alpha = (opacity / 100).toFixed(3);
    root.style.setProperty(
      "--t-checker",
      pref.mode === "dark" ? `rgba(255,255,255,${alpha})` : `rgba(40,40,40,${alpha})`,
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  }, [pref]);

  return (
    <ThemeContext.Provider
      value={{
        ...pref,
        setMode: (mode) => setPref((p) => ({ ...p, mode })),
        setAccent: (accent) => setPref((p) => ({ ...p, accent })),
        setBg: (bg) => setPref((p) => ({ ...p, bg })),
        setStyle: (style) => setPref((p) => ({ ...p, style })),
        setBg2: (bg2) => setPref((p) => ({ ...p, bg2 })),
        setPattern: (pattern) => setPref((p) => ({ ...p, pattern })),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
