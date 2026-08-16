/* ------------------------------------------------------------------
 * AntRep's design tokens, lifted verbatim from the running app.
 *
 *   surfaces / accents / metric + category colours  src/index.css
 *   accent presets and background palettes          src/lib/theme.tsx
 *   radii, type ramp, icon paths                    src/ui/kit.tsx
 *
 * Keep this file in step with those three. It is the single source the
 * Figma variables and every generated frame read from.
 * ------------------------------------------------------------------ */

/** Semantic surfaces per theme mode — index.css :root and [data-theme="dark"]. */
var SURFACES = {
  Light: {
    bg: "#f5f7f2",
    surface: "#ffffff",
    inset: "#f2f4f0",
    ink: "#3c3c3c",
    muted: "#82898f",
    line: "#e5e5e5",
  },
  Dark: {
    bg: "#131f24",
    surface: "#202f36",
    inset: "#17262d",
    ink: "#f1f7fb",
    muted: "#8ba5b0",
    line: "#37464f",
  },
};

/** Fixed brand colours — identical in both modes. */
var FIXED = {
  danger: "#ff4b4b",
  "danger-deep": "#d33131",
  gold: "#ffc800",
  done: "#58cc02",
  "done-deep": "#46a302",
  white: "#ffffff",
  black: "#000000",
};

/**
 * Progress analytics keep a semantic identity across accents and themes, so
 * these are the one colour family that carries its own light/dark pair.
 */
var METRICS = {
  Light: {
    "metric/strength": "#3978f6",
    "metric/endurance": "#8654df",
    "metric/consistency": "#159a6b",
    "metric/capacity": "#e87918",
    "metric/recovery": "#118c99",
    "metric/stability": "#d94f86",
    "category/push": "#e94a92",
    "category/pull": "#168fa8",
    "category/legs": "#7651d3",
    "category/core": "#bf8710",
    "category/cardio": "#18865f",
  },
  Dark: {
    "metric/strength": "#78a6ff",
    "metric/endurance": "#b38aff",
    "metric/consistency": "#58d6a6",
    "metric/capacity": "#ffb15e",
    "metric/recovery": "#55cbd3",
    "metric/stability": "#ff83b4",
    "category/push": "#ff79b7",
    "category/pull": "#54c8df",
    "category/legs": "#ae8cff",
    "category/core": "#f4c45f",
    "category/cardio": "#5bd5a4",
  },
};

/** Accent presets — theme.tsx ACCENTS. */
var ACCENTS = [
  { key: "mint", label: "Mint", swatch: "#58cc02", deep: "#46a302" },
  { key: "sky", label: "Sky", swatch: "#1cb0f6", deep: "#1899d6" },
  { key: "grape", label: "Grape", swatch: "#a560f8", deep: "#8a48d8" },
  { key: "punch", label: "Punch", swatch: "#ff4b8b", deep: "#d63771" },
  { key: "sunset", label: "Sunset", swatch: "#ff9600", deep: "#db8100" },
];

/** The default chart ramp before the accent-derived rotation kicks in. */
var CHART_FALLBACK = ["#58cc02", "#1cb0f6", "#a560f8", "#ff9600", "#ff4b8b"];

/**
 * The app ships in Denim by default (theme.tsx defaultPref), so that is what
 * the generated screens paint with. Change ACTIVE_BG to regenerate the whole
 * file in any other palette.
 */
var ACTIVE_BG = "denim";

var BACKGROUND_FAMILIES = [
  "Neutral",
  "Green",
  "Blue",
  "Purple & pink",
  "Red & orange",
  "Yellow & brown",
];

/** theme.tsx BACKGROUNDS — 33 curated palettes, each with a light and dark cut. */
var BACKGROUNDS = [
  { key: "default", label: "Default", family: "Neutral", light: { bg: "#f5f7f2", accent: "#58cc02", deep: "#46a302" }, dark: { bg: "#131f24", accent: "#58cc02", deep: "#46a302" } },
  { key: "paper", label: "Paper", family: "Neutral", light: { bg: "#fafafa", accent: "#6b7280", deep: "#565d68" }, dark: { bg: "#1a1a1c", accent: "#b8bcc4", deep: "#9aa0a8" } },
  { key: "linen", label: "Linen", family: "Neutral", light: { bg: "#faf7f2", accent: "#8a7a63", deep: "#736550" }, dark: { bg: "#201d18", accent: "#bfae94", deep: "#a3927a" } },
  { key: "mist", label: "Mist", family: "Neutral", light: { bg: "#edf1f2", accent: "#5f8794", deep: "#4e707b" }, dark: { bg: "#171e20", accent: "#8ab3c0", deep: "#7096a2" } },
  { key: "slate", label: "Slate", family: "Neutral", light: { bg: "#eceff3", accent: "#5a6c85", deep: "#4a596e" }, dark: { bg: "#181d24", accent: "#8ba0bd", deep: "#71869f" } },
  { key: "charcoal", label: "Charcoal", family: "Neutral", light: { bg: "#ecedee", accent: "#52585f", deep: "#43484e" }, dark: { bg: "#17191b", accent: "#9aa2ab", deep: "#7f8790" } },

  { key: "mint", label: "Mint", family: "Green", light: { bg: "#e9f5ec", accent: "#38a169", deep: "#2d8656" }, dark: { bg: "#142219", accent: "#5fc98d", deep: "#4bab75" } },
  { key: "sage", label: "Sage", family: "Green", light: { bg: "#eef2e9", accent: "#6a994e", deep: "#588240" }, dark: { bg: "#1a231b", accent: "#8ab17d", deep: "#6f975f" } },
  { key: "jade", label: "Jade", family: "Green", light: { bg: "#e6f4ee", accent: "#1f8a5f", deep: "#197250" }, dark: { bg: "#10231c", accent: "#4cb68a", deep: "#3c9a73" } },
  { key: "forest", label: "Forest", family: "Green", light: { bg: "#e9f1ea", accent: "#2e7d4f", deep: "#256741" }, dark: { bg: "#12211a", accent: "#57a877", deep: "#448a61" } },
  { key: "moss", label: "Moss", family: "Green", light: { bg: "#edf1e5", accent: "#5d7c33", deep: "#4d682a" }, dark: { bg: "#1b2113", accent: "#8fa95f", deep: "#77904d" } },
  { key: "olive", label: "Olive", family: "Green", light: { bg: "#f0f1e0", accent: "#7f8c2b", deep: "#697524" }, dark: { bg: "#20220f", accent: "#a3b04a", deep: "#88943c" } },

  { key: "sky", label: "Sky", family: "Blue", light: { bg: "#e9f2fb", accent: "#2f80c3", deep: "#276ba4" }, dark: { bg: "#131f2b", accent: "#58a6e8", deep: "#458cc7" } },
  { key: "teal", label: "Teal", family: "Blue", light: { bg: "#e5f2f0", accent: "#1f8a7d", deep: "#197267" }, dark: { bg: "#10231f", accent: "#4bb3a4", deep: "#3b9789" } },
  { key: "ocean", label: "Ocean", family: "Blue", light: { bg: "#e8f1f5", accent: "#1f7a99", deep: "#196680" }, dark: { bg: "#12222b", accent: "#4aa3c4", deep: "#3a89a7" } },
  { key: "denim", label: "Denim", family: "Blue", light: { bg: "#e8eef6", accent: "#3a6ea5", deep: "#305c8a" }, dark: { bg: "#131c26", accent: "#6d9fd4", deep: "#5885b6" } },
  { key: "cobalt", label: "Cobalt", family: "Blue", light: { bg: "#e7edfa", accent: "#2b5fd0", deep: "#244fb0" }, dark: { bg: "#121a2d", accent: "#6b92ec", deep: "#567bc9" } },
  { key: "indigo", label: "Indigo", family: "Blue", light: { bg: "#eaecf8", accent: "#4a55b2", deep: "#3d4796" }, dark: { bg: "#151827", accent: "#7d88e0", deep: "#6570c2" } },

  { key: "lavender", label: "Lavender", family: "Purple & pink", light: { bg: "#efecf9", accent: "#7b61c9", deep: "#6750ab" }, dark: { bg: "#1c1928", accent: "#a08ae0", deep: "#8671c2" } },
  { key: "violet", label: "Violet", family: "Purple & pink", light: { bg: "#f0eafa", accent: "#7a45c4", deep: "#6639a6" }, dark: { bg: "#1d1529", accent: "#a67ae4", deep: "#8d64c4" } },
  { key: "plum", label: "Plum", family: "Purple & pink", light: { bg: "#f3eaf4", accent: "#9c4f96", deep: "#83417e" }, dark: { bg: "#241726", accent: "#c47cbd", deep: "#a763a0" } },
  { key: "fuchsia", label: "Fuchsia", family: "Purple & pink", light: { bg: "#f9e9f7", accent: "#b13fa8", deep: "#96348e" }, dark: { bg: "#27142a", accent: "#d976cf", deep: "#b962b0" } },
  { key: "pink", label: "Pink", family: "Purple & pink", light: { bg: "#fdecf3", accent: "#d94f8c", deep: "#b94175" }, dark: { bg: "#2b1420", accent: "#f07fb0", deep: "#cf6996" } },
  { key: "rose", label: "Rose", family: "Purple & pink", light: { bg: "#faecef", accent: "#c94f6d", deep: "#ab415b" }, dark: { bg: "#291418", accent: "#e07a92", deep: "#c1637a" } },

  { key: "crimson", label: "Crimson", family: "Red & orange", light: { bg: "#fbe9ec", accent: "#c02f4a", deep: "#a3283e" }, dark: { bg: "#2a1216", accent: "#e56a80", deep: "#c4576b" } },
  { key: "coral", label: "Coral", family: "Red & orange", light: { bg: "#fdece9", accent: "#d95f4a", deep: "#b8503e" }, dark: { bg: "#2b1714", accent: "#f0897a", deep: "#cf7166" } },
  { key: "blush", label: "Blush", family: "Red & orange", light: { bg: "#fbeee9", accent: "#d1704f", deep: "#b25d40" }, dark: { bg: "#2a1a14", accent: "#e89a7a", deep: "#c98063" } },
  { key: "peach", label: "Peach", family: "Red & orange", light: { bg: "#fdeee3", accent: "#e07b39", deep: "#bf672e" }, dark: { bg: "#2a1c11", accent: "#f09b5e", deep: "#d1824a" } },
  { key: "clay", label: "Clay", family: "Red & orange", light: { bg: "#f4ebe4", accent: "#a8663b", deep: "#8d5430" }, dark: { bg: "#271c15", accent: "#c98b5e", deep: "#ab724b" } },

  { key: "lemon", label: "Lemon", family: "Yellow & brown", light: { bg: "#fdfae0", accent: "#a89a1e", deep: "#8d8119" }, dark: { bg: "#262413", accent: "#cfc04a", deep: "#b0a33e" } },
  { key: "butter", label: "Butter", family: "Yellow & brown", light: { bg: "#faf3dd", accent: "#b3922e", deep: "#967a25" }, dark: { bg: "#26210f", accent: "#d4b854", deep: "#b59b42" } },
  { key: "amber", label: "Amber", family: "Yellow & brown", light: { bg: "#fdf1de", accent: "#c98a12", deep: "#ab740f" }, dark: { bg: "#2b2110", accent: "#e5b04a", deep: "#c4953e" } },
  { key: "sand", label: "Sand", family: "Yellow & brown", light: { bg: "#f7f1e4", accent: "#b98a2f", deep: "#9c7326" }, dark: { bg: "#262014", accent: "#d4a94e", deep: "#b58e3d" } },
  { key: "mocha", label: "Mocha", family: "Yellow & brown", light: { bg: "#f1ebe6", accent: "#7d5a44", deep: "#684a38" }, dark: { bg: "#211a15", accent: "#a98268", deep: "#8e6b54" } },
];

/**
 * Type ramp, read off the Tailwind classes the kit actually uses. Line heights
 * follow Tailwind's leading-tight / leading-snug / default where the kit sets
 * them, otherwise 1.4x rounded.
 */
var TYPE = [
  { name: "Display", size: 92, weight: "black", lh: 92, note: "Countdown numeral" },
  { name: "Title/XL", size: 24, weight: "black", lh: 29, note: "ScreenTitle h1" },
  { name: "Title/L", size: 20, weight: "black", lh: 26, note: "Role gate, sheet headings" },
  { name: "Title/M", size: 18, weight: "black", lh: 24, note: "Sheet + dialog title" },
  { name: "Body/L", size: 16, weight: "black", lh: 22, note: "EmptyState title" },
  { name: "Body/M", size: 15, weight: "bold", lh: 21, note: "Setting row, text field" },
  { name: "Body/S", size: 14, weight: "semibold", lh: 19, note: "Card copy, dialog message" },
  { name: "Label/M", size: 13, weight: "black", lh: 17, note: "Segmented, small button" },
  { name: "Label/S", size: 12, weight: "black", lh: 16, note: "Field label, hints" },
  { name: "Label/XS", size: 11, weight: "black", lh: 14, note: "Stat tile caption" },
  { name: "Caption", size: 10, weight: "black", lh: 13, note: "Tab label, pill" },
  { name: "Micro", size: 9, weight: "bold", lh: 12, note: "RPE scale ends" },
  { name: "Quote", size: 16, weight: "regular", lh: 22, note: "font-quote italic", quote: true },
];

/** Corner radii used across the kit. */
var RADIUS = {
  card: 16, // --radius-card: 1rem
  sheet: 24, // rounded-3xl
  field: 16, // rounded-2xl
  tile: 16,
  pill: 999,
  tab: 16,
};

/** The 4px spacing rhythm the screens are laid out on. */
var SPACE = { "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48 };

/** Device frame — iPhone 14/15 logical size, which the app's max-w-lg fits inside. */
var DEVICE = { w: 390, h: 844, statusBar: 44, tabBar: 68, gutter: 16 };

/* ------------------------------------------------------------------
 * Icons — the exact markup from `Icon` in src/ui/kit.tsx. Rendered
 * through figma.createNodeFromSvg so arcs, rects and circles all survive.
 * ------------------------------------------------------------------ */

var ICON_SVG = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  plan: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  progress: '<path d="M3 20h18"/><path d="M6 20V10M12 20V4M18 20v-7"/>',
  dumbbell: '<path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.6-1H1a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 3 8.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8.6 3 1.7 1.7 0 0 0 10 1.4V1a2 2 0 1 1 4 0v.2A1.7 1.7 0 0 0 16.9 3a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 22.6 10H23a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z"/>',
  people:
    '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16.5 5.3a3.4 3.4 0 0 1 0 6.4M18 20a6.4 6.4 0 0 0-2-4.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="CURRENT" stroke="none"/>',
  pause:
    '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="CURRENT" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="CURRENT" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.4" fill="CURRENT" stroke="none"/>',
  flame: '<path d="M12 3s5 4.3 5 9a5 5 0 0 1-10 0c0-1.9 1-3.4 2-4.4 0 2 1 3 2 3 1.3 0 1.6-1.4 1-3.3-.4-1.5-.5-3-0-4.3z"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
  trophy:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v1.5A3.5 3.5 0 0 0 8 10M16 5h3v1.5A3.5 3.5 0 0 1 16 10M10 13h4l.5 4h-5z"/><path d="M8 20h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  calendarClock:
    '<path d="M20 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6"/><path d="M8 2v4M16 2v4M3 10h17"/><circle cx="17.5" cy="17.5" r="4.5"/><path d="M17.5 15.5v2.2l1.5 1"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.7l1.3-1.3"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>',
  back: '<path d="M15 6 9 12l6 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  send: '<path d="m4 12 16-8-6 16-2.5-6z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M12 3.8 2.6 20h18.8z"/><path d="M12 10v4.2M12 17.2v.2"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
};

var ICON_KEYS = Object.keys(ICON_SVG);
