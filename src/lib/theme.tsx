import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ProfileSettings } from "../data/types";

export type ThemeMode = "light" | "dark";
export type ThemePreference = "auto" | ThemeMode;
export const UI_MODES = ["classic", "minimal", "compact"] as const;
export type UIMode = (typeof UI_MODES)[number];
/** Experimental presentation systems stay local to development builds. */
export const UI_MODES_ENABLED = import.meta.env.DEV;

/**
 * Accent presets. "auto" (the default) derives the accent from whichever
 * colours are picked; choosing a preset pins it, and that applies to every
 * style rather than only to Default + solid as it used to.
 */
export const ACCENTS = [
  { key: "mint", label: "Mint", swatch: "#58cc02", deep: "#46a302" },
  { key: "sky", label: "Sky", swatch: "#1cb0f6", deep: "#1899d6" },
  { key: "grape", label: "Grape", swatch: "#a560f8", deep: "#8a48d8" },
  { key: "punch", label: "Punch", swatch: "#ff4b8b", deep: "#d63771" },
  { key: "sunset", label: "Sunset", swatch: "#ff9600", deep: "#db8100" },
] as const;
export type AccentKey = (typeof ACCENTS)[number]["key"];
export type AccentChoice = AccentKey | "auto";

/**
 * 20 curated background tints — bold-but-subtle, easy on the eyes, with a
 * light and a dark rendition. Selecting one also drives the accent (same
 * hue, deeper), so the whole UI re-tunes to the chosen colour.
 */
export interface BackgroundPalette {
  key: string;
  label: string;
  /** Groups the picker so like sits with like. */
  family: string;
  light: { bg: string; accent: string; deep: string };
  dark: { bg: string; accent: string; deep: string };
}

/**
 * The app's own colours, as a palette. Making "Default" a real entry lets it
 * take part in gradient and duotone like any other choice, instead of being a
 * special case that switches those options off.
 */
export const DEFAULT_PALETTE: BackgroundPalette = {
  key: "default",
  label: "Default",
  family: "Neutral",
  light: { bg: "#f5f7f2", accent: "#58cc02", deep: "#46a302" },
  dark: { bg: "#131f24", accent: "#58cc02", deep: "#46a302" },
};

/** Base surfaces per mode, so a preview can render another mode's chrome. */
export const MODE_SURFACES = {
  light: { bg: "#f5f7f2", surface: "#ffffff", inset: "#f2f4f0", ink: "#3c3c3c", muted: "#82898f", line: "#e5e5e5" },
  dark: { bg: "#131f24", surface: "#202f36", inset: "#17262d", ink: "#f1f7fb", muted: "#8ba5b0", line: "#37464f" },
} as const;

/** Picker order — like sits with like. */
export const BACKGROUND_FAMILIES = [
  "Neutral",
  "Green",
  "Blue",
  "Purple & pink",
  "Red & orange",
  "Yellow & brown",
] as const;

export const BACKGROUNDS: BackgroundPalette[] = [
  { key: "paper",    label: "Paper",    family: "Neutral", light: { bg: "#fafafa", accent: "#6b7280", deep: "#565d68" }, dark: { bg: "#1a1a1c", accent: "#b8bcc4", deep: "#9aa0a8" } },
  { key: "linen",    label: "Linen",    family: "Neutral", light: { bg: "#faf7f2", accent: "#8a7a63", deep: "#736550" }, dark: { bg: "#201d18", accent: "#bfae94", deep: "#a3927a" } },
  { key: "mist",     label: "Mist",     family: "Neutral", light: { bg: "#edf1f2", accent: "#5f8794", deep: "#4e707b" }, dark: { bg: "#171e20", accent: "#8ab3c0", deep: "#7096a2" } },
  { key: "slate",    label: "Slate",    family: "Neutral", light: { bg: "#eceff3", accent: "#5a6c85", deep: "#4a596e" }, dark: { bg: "#181d24", accent: "#8ba0bd", deep: "#71869f" } },
  { key: "charcoal", label: "Charcoal", family: "Neutral", light: { bg: "#ecedee", accent: "#52585f", deep: "#43484e" }, dark: { bg: "#17191b", accent: "#9aa2ab", deep: "#7f8790" } },

  { key: "mint",     label: "Mint",     family: "Green", light: { bg: "#e9f5ec", accent: "#38a169", deep: "#2d8656" }, dark: { bg: "#142219", accent: "#5fc98d", deep: "#4bab75" } },
  { key: "sage",     label: "Sage",     family: "Green", light: { bg: "#eef2e9", accent: "#6a994e", deep: "#588240" }, dark: { bg: "#1a231b", accent: "#8ab17d", deep: "#6f975f" } },
  { key: "jade",     label: "Jade",     family: "Green", light: { bg: "#e6f4ee", accent: "#1f8a5f", deep: "#197250" }, dark: { bg: "#10231c", accent: "#4cb68a", deep: "#3c9a73" } },
  { key: "forest",   label: "Forest",   family: "Green", light: { bg: "#e9f1ea", accent: "#2e7d4f", deep: "#256741" }, dark: { bg: "#12211a", accent: "#57a877", deep: "#448a61" } },
  { key: "moss",     label: "Moss",     family: "Green", light: { bg: "#edf1e5", accent: "#5d7c33", deep: "#4d682a" }, dark: { bg: "#1b2113", accent: "#8fa95f", deep: "#77904d" } },
  { key: "olive",    label: "Olive",    family: "Green", light: { bg: "#f0f1e0", accent: "#7f8c2b", deep: "#697524" }, dark: { bg: "#20220f", accent: "#a3b04a", deep: "#88943c" } },

  { key: "sky",      label: "Sky",      family: "Blue", light: { bg: "#e9f2fb", accent: "#2f80c3", deep: "#276ba4" }, dark: { bg: "#131f2b", accent: "#58a6e8", deep: "#458cc7" } },
  { key: "teal",     label: "Teal",     family: "Blue", light: { bg: "#e5f2f0", accent: "#1f8a7d", deep: "#197267" }, dark: { bg: "#10231f", accent: "#4bb3a4", deep: "#3b9789" } },
  { key: "ocean",    label: "Ocean",    family: "Blue", light: { bg: "#e8f1f5", accent: "#1f7a99", deep: "#196680" }, dark: { bg: "#12222b", accent: "#4aa3c4", deep: "#3a89a7" } },
  { key: "denim",    label: "Denim",    family: "Blue", light: { bg: "#e8eef6", accent: "#3a6ea5", deep: "#305c8a" }, dark: { bg: "#131c26", accent: "#6d9fd4", deep: "#5885b6" } },
  { key: "cobalt",   label: "Cobalt",   family: "Blue", light: { bg: "#e7edfa", accent: "#2b5fd0", deep: "#244fb0" }, dark: { bg: "#121a2d", accent: "#6b92ec", deep: "#567bc9" } },
  { key: "indigo",   label: "Indigo",   family: "Blue", light: { bg: "#eaecf8", accent: "#4a55b2", deep: "#3d4796" }, dark: { bg: "#151827", accent: "#7d88e0", deep: "#6570c2" } },

  { key: "lavender", label: "Lavender", family: "Purple & pink", light: { bg: "#efecf9", accent: "#7b61c9", deep: "#6750ab" }, dark: { bg: "#1c1928", accent: "#a08ae0", deep: "#8671c2" } },
  { key: "violet",   label: "Violet",   family: "Purple & pink", light: { bg: "#f0eafa", accent: "#7a45c4", deep: "#6639a6" }, dark: { bg: "#1d1529", accent: "#a67ae4", deep: "#8d64c4" } },
  { key: "plum",     label: "Plum",     family: "Purple & pink", light: { bg: "#f3eaf4", accent: "#9c4f96", deep: "#83417e" }, dark: { bg: "#241726", accent: "#c47cbd", deep: "#a763a0" } },
  { key: "fuchsia",  label: "Fuchsia",  family: "Purple & pink", light: { bg: "#f9e9f7", accent: "#b13fa8", deep: "#96348e" }, dark: { bg: "#27142a", accent: "#d976cf", deep: "#b962b0" } },
  { key: "pink",     label: "Pink",     family: "Purple & pink", light: { bg: "#fdecf3", accent: "#d94f8c", deep: "#b94175" }, dark: { bg: "#2b1420", accent: "#f07fb0", deep: "#cf6996" } },
  { key: "rose",     label: "Rose",     family: "Purple & pink", light: { bg: "#faecef", accent: "#c94f6d", deep: "#ab415b" }, dark: { bg: "#291418", accent: "#e07a92", deep: "#c1637a" } },

  { key: "crimson",  label: "Crimson",  family: "Red & orange", light: { bg: "#fbe9ec", accent: "#c02f4a", deep: "#a3283e" }, dark: { bg: "#2a1216", accent: "#e56a80", deep: "#c4576b" } },
  { key: "coral",    label: "Coral",    family: "Red & orange", light: { bg: "#fdece9", accent: "#d95f4a", deep: "#b8503e" }, dark: { bg: "#2b1714", accent: "#f0897a", deep: "#cf7166" } },
  { key: "blush",    label: "Blush",    family: "Red & orange", light: { bg: "#fbeee9", accent: "#d1704f", deep: "#b25d40" }, dark: { bg: "#2a1a14", accent: "#e89a7a", deep: "#c98063" } },
  { key: "peach",    label: "Peach",    family: "Red & orange", light: { bg: "#fdeee3", accent: "#e07b39", deep: "#bf672e" }, dark: { bg: "#2a1c11", accent: "#f09b5e", deep: "#d1824a" } },
  { key: "clay",     label: "Clay",     family: "Red & orange", light: { bg: "#f4ebe4", accent: "#a8663b", deep: "#8d5430" }, dark: { bg: "#271c15", accent: "#c98b5e", deep: "#ab724b" } },

  { key: "lemon",    label: "Lemon",    family: "Yellow & brown", light: { bg: "#fdfae0", accent: "#a89a1e", deep: "#8d8119" }, dark: { bg: "#262413", accent: "#cfc04a", deep: "#b0a33e" } },
  { key: "butter",   label: "Butter",   family: "Yellow & brown", light: { bg: "#faf3dd", accent: "#b3922e", deep: "#967a25" }, dark: { bg: "#26210f", accent: "#d4b854", deep: "#b59b42" } },
  { key: "amber",    label: "Amber",    family: "Yellow & brown", light: { bg: "#fdf1de", accent: "#c98a12", deep: "#ab740f" }, dark: { bg: "#2b2110", accent: "#e5b04a", deep: "#c4953e" } },
  { key: "sand",     label: "Sand",     family: "Yellow & brown", light: { bg: "#f7f1e4", accent: "#b98a2f", deep: "#9c7326" }, dark: { bg: "#262014", accent: "#d4a94e", deep: "#b58e3d" } },
  { key: "mocha",    label: "Mocha",    family: "Yellow & brown", light: { bg: "#f1ebe6", accent: "#7d5a44", deep: "#684a38" }, dark: { bg: "#211a15", accent: "#a98268", deep: "#8e6b54" } },
];

/**
 * How the two colours relate.
 *
 *   solid     one colour: background and UI both derive from it
 *   gradient  the background washes from the first colour into the second
 *   duotone   two separate colours — first paints the page, second paints the
 *             cards, insets and accent
 */
export const THEME_STYLES = ["solid", "gradient", "duotone"] as const;
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
  mode: ThemePreference;
  uiMode: UIMode;
  accent: AccentChoice;
  bg: string | null; // BackgroundPalette key, or null = default surface
  style: ThemeStyle;
  /** Second BackgroundPalette key — only read when style is "duotone". */
  bg2: string | null;
  pattern: PatternPref;
}

interface ThemeState extends Omit<ThemePref, "mode"> {
  /** The actual mode being rendered after resolving Auto against the device. */
  mode: ThemeMode;
  /** The user's saved choice. */
  modePreference: ThemePreference;
  setMode: (m: ThemePreference) => void;
  setUiMode: (m: UIMode) => void;
  setAccent: (a: AccentChoice) => void;
  setBg: (b: string | null) => void;
  setStyle: (s: ThemeStyle) => void;
  setBg2: (b: string | null) => void;
  setPattern: (p: PatternPref) => void;
  /** Hydrate appearance from the signed-in profile when one has a saved preference. */
  applyProfileSettings: (settings: ProfileSettings, accountId: string) => void;
  /** Complete appearance payload persisted to every profile for this account. */
  profileSettings: ProfileSettings;
}

const STORAGE_KEY = "antrep-theme";

/** Build a readable chart series from the active UI accent. The first colour
 * stays on-brand; the remaining hues rotate around it so every saved palette
 * gets a distinct but related analytics system instead of fixed app colours. */
function chartPalette(accent: string): string[] {
  const hex = accent.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [accent, "#1cb0f6", "#a560f8", "#ff9600", "#ff4b8b"];

  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;

  const secondarySaturation = Math.max(48, Math.min(76, saturation * 100));
  const secondaryLightness = Math.max(46, Math.min(62, lightness * 100 + 5));
  return [
    accent,
    `hsl(${(hue + 52) % 360} ${secondarySaturation}% ${secondaryLightness}%)`,
    `hsl(${(hue + 116) % 360} ${secondarySaturation}% ${secondaryLightness}%)`,
    `hsl(${(hue + 198) % 360} ${secondarySaturation}% ${secondaryLightness}%)`,
    `hsl(${(hue + 292) % 360} ${secondarySaturation}% ${secondaryLightness}%)`,
  ];
}

function defaultPref(): ThemePref {
  return {
    mode: "auto",
    uiMode: "classic",
    accent: "auto",
    bg: "denim",
    style: "solid",
    bg2: null,
    pattern: DEFAULT_PATTERN,
  };
}

function loadPref(): ThemePref {
  const fallback = defaultPref();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      mode: p.mode === "auto" || p.mode === "dark" || p.mode === "light" ? p.mode : fallback.mode,
      uiMode: UI_MODES.includes(p.uiMode) ? p.uiMode : fallback.uiMode,
      // The old accent only took effect with no background colour, so honour a
      // stored one only in that case; otherwise everyone would suddenly have
      // the default pinned across every style.
      accent:
        p.bg === null && ACCENTS.some((a) => a.key === p.accent) ? p.accent : "auto",
      // null is a real choice (Default), distinct from a missing/unknown key.
      bg: p.bg === null ? null : BACKGROUNDS.some((b) => b.key === p.bg) ? p.bg : fallback.bg,
      style: THEME_STYLES.includes(p.style) ? p.style : "solid",
      bg2: BACKGROUNDS.some((b) => b.key === p.bg2) ? p.bg2 : null,
      // The texture picker is gone; everyone gets the standard dotted default.
      pattern: DEFAULT_PATTERN,
    };
  } catch {
    return fallback;
  }
}

function loadCacheOwner(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const owner = JSON.parse(raw)?.accountId;
    return typeof owner === "string" && owner ? owner : null;
  } catch {
    return null;
  }
}


const ThemeContext = createContext<ThemeState>({
  mode: "light",
  modePreference: "auto",
  uiMode: "classic",
  accent: "auto",
  bg: null,
  style: "solid",
  bg2: null,
  pattern: DEFAULT_PATTERN,
  setMode: () => {},
  setUiMode: () => {},
  setAccent: () => {},
  setBg: () => {},
  setStyle: () => {},
  setBg2: () => {},
  setPattern: () => {},
  applyProfileSettings: () => {},
  profileSettings: { theme_mode: "auto", ui_mode: "classic" },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState(loadPref);
  const [cacheOwner, setCacheOwner] = useState(loadCacheOwner);
  const [systemMode, setSystemMode] = useState<ThemeMode>(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const mode: ThemeMode = pref.mode === "auto" ? systemMode : pref.mode;
  const uiMode: UIMode = UI_MODES_ENABLED ? pref.uiMode : "classic";

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const changed = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);

  const applyProfileSettings = useCallback((settings: ProfileSettings, accountId: string) => {
    // An old profile with no appearance fields should keep the local choice;
    // visiting Settings will migrate that complete choice to the account.
    const hasSavedTheme = [
      "theme_mode",
      "ui_mode",
      "accent",
      "background",
      "background_secondary",
      "theme_style",
    ].some((key) => Object.prototype.hasOwnProperty.call(settings, key));
    if (!hasSavedTheme) {
      // A legacy cache has no owner: adopt it once so an existing user's
      // chosen appearance is not lost. A cache owned by someone else must not
      // leak onto a new account; that account starts in Auto as promised.
      if (cacheOwner && cacheOwner !== accountId) setPref(defaultPref());
      setCacheOwner(accountId);
      return;
    }

    setCacheOwner(accountId);

    setPref((current) => ({
      ...current,
      mode:
        settings.theme_mode === "auto" ||
        settings.theme_mode === "light" ||
        settings.theme_mode === "dark"
          ? settings.theme_mode
          : current.mode,
      uiMode:
        settings.ui_mode && UI_MODES.includes(settings.ui_mode)
          ? settings.ui_mode
          : current.uiMode,
      accent:
        settings.accent === "auto" || ACCENTS.some((accent) => accent.key === settings.accent)
          ? (settings.accent as AccentChoice)
          : current.accent,
      bg:
        settings.background === null || BACKGROUNDS.some((bg) => bg.key === settings.background)
          ? (settings.background ?? null)
          : current.bg,
      bg2:
        settings.background_secondary === null ||
        BACKGROUNDS.some((bg) => bg.key === settings.background_secondary)
          ? (settings.background_secondary ?? null)
          : current.bg2,
      style:
        settings.theme_style && THEME_STYLES.includes(settings.theme_style)
          ? settings.theme_style
          : current.style,
    }));
  }, [cacheOwner]);

  const profileSettings: ProfileSettings = {
    theme_mode: pref.mode,
    ui_mode: pref.uiMode,
    accent: pref.accent,
    background: pref.bg,
    background_secondary: pref.bg2,
    theme_style: pref.style,
  };

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.ui = uiMode;
    root.dataset.themeStyle = pref.style;
    if (pref.accent === "auto") delete root.dataset.accent;
    else root.dataset.accent = pref.accent;
    root.dataset.pattern = pref.pattern.style;

    // Background palette overrides bg + accent inline (inline wins over the
    // data-accent CSS); clearing it falls back to the plain theme.
    // `bg: null` means the app's own colours — which are a palette too, so
    // gradient and duotone work from Default exactly as from anything else.
    const chosen = BACKGROUNDS.find((b) => b.key === pref.bg) ?? null;
    const palette = chosen ?? DEFAULT_PALETTE;
    if (chosen) {
      const c = palette[mode];
      root.style.setProperty("--t-bg", c.bg);
      root.style.setProperty("--t-accent", c.accent);
      root.style.setProperty("--t-accent-deep", c.deep);
    } else {
      root.style.removeProperty("--t-bg");
      root.style.removeProperty("--t-accent");
      root.style.removeProperty("--t-accent-deep");
    }

    // The second colour only means something once a first one is chosen and the
    // two actually differ; otherwise both styles collapse back to solid.
    const second = BACKGROUNDS.find((b) => b.key === pref.bg2);
    const paired = second && second.key !== palette.key ? second : null;

    if (paired && pref.style === "gradient") {
      root.dataset.bgstyle = "gradient";
      root.style.setProperty(
        "--t-bg-gradient",
        `linear-gradient(160deg, ${palette[mode].bg} 0%, ${paired[mode].bg} 100%)`,
      );
    } else {
      delete root.dataset.bgstyle;
      root.style.removeProperty("--t-bg-gradient");
    }

    // Duotone keeps the colours apart: the page stays the first colour while
    // every card, inset and accent moves to the second.
    if (paired && pref.style === "duotone") {
      const ui = paired[mode];
      root.style.setProperty("--t-surface", ui.bg);
      root.style.setProperty("--t-inset", `color-mix(in srgb, ${ui.bg} 86%, ${ui.accent} 14%)`);
      root.style.setProperty("--t-accent", ui.accent);
      root.style.setProperty("--t-accent-deep", ui.deep);
    } else {
      root.style.removeProperty("--t-surface");
      root.style.removeProperty("--t-inset");
    }

    root.style.setProperty("--pattern-size", `${pref.pattern.size}px`);
    const opacity = mode === "dark" ? pref.pattern.opacityDark : pref.pattern.opacityLight;
    const alpha = (opacity / 100).toFixed(3);
    root.style.setProperty(
      "--t-checker",
      mode === "dark" ? `rgba(255,255,255,${alpha})` : `rgba(40,40,40,${alpha})`,
    );

    // Last word: a pinned accent overrides whatever the palette or duotone
    // pairing decided, for every style.
    const accent = ACCENTS.find((a) => a.key === pref.accent);
    if (accent) {
      root.style.setProperty("--t-accent", accent.swatch);
      root.style.setProperty("--t-accent-deep", accent.deep);
    }

    const activeAccent = accent?.swatch ?? (paired && pref.style === "duotone" ? paired[mode].accent : palette[mode].accent);
    chartPalette(activeAccent).forEach((color, index) => {
      root.style.setProperty(`--t-chart-${index + 1}`, color);
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...pref, accountId: cacheOwner }));
  }, [pref, mode, uiMode, cacheOwner]);

  return (
    <ThemeContext.Provider
      value={{
        ...pref,
        uiMode,
        mode,
        modePreference: pref.mode,
        setMode: (mode) => setPref((p) => ({ ...p, mode })),
        setUiMode: (nextUiMode) => {
          if (UI_MODES_ENABLED) setPref((p) => ({ ...p, uiMode: nextUiMode }));
        },
        setAccent: (accent) => setPref((p) => ({ ...p, accent })),
        setBg: (bg) => setPref((p) => ({ ...p, bg })),
        setStyle: (style) => setPref((p) => ({ ...p, style })),
        setBg2: (bg2) => setPref((p) => ({ ...p, bg2 })),
        setPattern: (pattern) => setPref((p) => ({ ...p, pattern })),
        applyProfileSettings,
        profileSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
