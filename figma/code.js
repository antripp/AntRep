/**
 * AntRep Design System — generated bundle. Do not edit.
 *
 * Source of truth: figma/src/*.js
 * Rebuild:         node scripts/build-figma-plugin.mjs
 */

/* ==== 00-util.js ================================================== */
/* ------------------------------------------------------------------
 * Shared helpers.
 *
 * Everything here is plain script scope — the build script concatenates
 * figma/src/*.js in filename order into figma/code.js, so there are no
 * imports and each file may use anything declared in a lower-numbered one.
 * ------------------------------------------------------------------ */

/** Populated by 20-variables.js: token name -> Figma Variable. */
var V = {};

/**
 * Type families resolved at boot, so a missing Google font can't kill the
 * run. `quoteStyle` is tracked separately: when the quote face falls back to
 * the sans family there may be no italic loaded for it, and asking for one
 * would throw on the first quote line.
 */
var FONT = { sans: "Nunito", quote: "Libre Baskerville", quoteStyle: "Italic" };

var WEIGHT = {
  regular: "Regular",
  semibold: "SemiBold",
  bold: "Bold",
  extrabold: "ExtraBold",
  black: "Black",
};

/** "#58cc02" (or "#58cc0233") -> { r, g, b } in 0..1, ignoring any alpha. */
function hexRgb(hex) {
  var h = String(hex).replace("#", "").trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** Alpha carried in an 8-digit hex, else 1. */
function hexAlpha(hex) {
  var h = String(hex).replace("#", "").trim();
  return h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
}

/** Blend `hex` over `over` at `pct` percent — stands in for CSS color-mix(). */
function mix(hex, over, pct) {
  var a = hexRgb(hex);
  var b = hexRgb(over);
  var t = pct / 100;
  var to255 = function (n) {
    var s = Math.round(n * 255).toString(16);
    return s.length === 1 ? "0" + s : s;
  };
  return (
    "#" +
    to255(a.r * t + b.r * (1 - t)) +
    to255(a.g * t + b.g * (1 - t)) +
    to255(a.b * t + b.b * (1 - t))
  );
}

/**
 * A paint for either a token name ("ink", "accent") or a literal hex.
 * Token paints are bound to the Theme variable, so switching a frame's mode
 * to Dark re-colours everything the way the real app does.
 */
function paint(color, opacity) {
  var solid = { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: opacity === undefined ? 1 : opacity };
  if (typeof color === "string" && color.charAt(0) === "#") {
    solid.color = hexRgb(color);
    if (opacity === undefined) solid.opacity = hexAlpha(color);
    return solid;
  }
  var variable = V[color];
  if (!variable) {
    // Unknown token: fail loud in the console but keep generating.
    console.warn("unknown colour token: " + color);
    return solid;
  }
  return figma.variables.setBoundVariableForPaint(solid, "color", variable);
}

function setFills(node, color, opacity) {
  node.fills = color === null ? [] : [paint(color, opacity)];
}

function setStroke(node, color, weight, opacity) {
  if (color === null) {
    node.strokes = [];
    return;
  }
  node.strokes = [paint(color, opacity)];
  node.strokeWeight = weight === undefined ? 1 : weight;
  node.strokeAlign = "INSIDE";
}

/**
 * An auto-layout frame.
 *
 *   F("Card", { dir: "v", gap: 8, pad: 16, fill: "surface", radius: 16 })
 *
 * `w`/`h` accept a number, "fill" (stretch along the parent's main axis) or
 * "hug" (size to content, the default).
 */
function F(name, o) {
  o = o || {};
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.dir === "h" ? "HORIZONTAL" : o.dir === "none" ? "NONE" : "VERTICAL";
  if (f.layoutMode !== "NONE") {
    f.itemSpacing = o.gap || 0;
    var p = o.pad === undefined ? 0 : o.pad;
    if (typeof p === "number") {
      f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = p;
    } else {
      f.paddingTop = p.t || 0;
      f.paddingBottom = p.b || 0;
      f.paddingLeft = p.l || 0;
      f.paddingRight = p.r || 0;
    }
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    f.primaryAxisAlignItems = o.justify || "MIN";
    f.counterAxisAlignItems = o.align || "MIN";
  }

  // Wrapping needs a bounded main axis — Figma rejects WRAP while the frame
  // still hugs — so a wrapping row defaults to filling its parent.
  if (o.wrap && o.w === undefined) o.w = "fill";

  f.fills = [];
  if (o.fill) setFills(f, o.fill, o.fillOpacity);
  if (o.stroke) setStroke(f, o.stroke, o.strokeWeight, o.strokeOpacity);
  if (o.radius !== undefined) f.cornerRadius = o.radius;
  if (o.radii) {
    f.topLeftRadius = o.radii[0];
    f.topRightRadius = o.radii[1];
    f.bottomRightRadius = o.radii[2];
    f.bottomLeftRadius = o.radii[3];
  }
  if (o.clip !== undefined) f.clipsContent = o.clip;
  if (o.shadow) f.effects = [o.shadow];
  if (o.opacity !== undefined) f.opacity = o.opacity;

  // A fixed size has to switch the matching axis off AUTO first, or auto-layout
  // resizes straight back to hug.
  var vertical = f.layoutMode === "VERTICAL";
  if (typeof o.w === "number" && f.layoutMode !== "NONE") {
    f[vertical ? "counterAxisSizingMode" : "primaryAxisSizingMode"] = "FIXED";
  }
  if (typeof o.h === "number" && f.layoutMode !== "NONE") {
    f[vertical ? "primaryAxisSizingMode" : "counterAxisSizingMode"] = "FIXED";
  }
  if (typeof o.w === "number" || typeof o.h === "number") {
    f.resize(typeof o.w === "number" ? o.w : f.width, typeof o.h === "number" ? o.h : f.height);
  }

  if (o.wrap) {
    // FILL is applied on append, so give the axis a provisional fixed width
    // now — WRAP is only legal once the main axis has stopped hugging.
    if (o.w === "fill") {
      f.primaryAxisSizingMode = "FIXED";
      f.resize(o.wrapWidth || 600, f.height);
    }
    f.layoutWrap = "WRAP";
    if (o.crossGap !== undefined) f.counterAxisSpacing = o.crossGap;
  }

  // "fill" can only be applied once the node is inside an auto-layout parent,
  // so it is recorded here and `add` applies it on append.
  if (o.w === "fill") f.__w = "fill";
  if (o.h === "fill") f.__h = "fill";

  return f;
}

/** Sizing that has to run after the node is inside its auto-layout parent. */
function applySizing(node, w, h) {
  try {
    if (w === "fill") node.layoutSizingHorizontal = "FILL";
    if (h === "fill") node.layoutSizingVertical = "FILL";
  } catch (e) {
    /* not in an auto-layout parent — the fixed size already set stands */
  }
}

/** Append children, applying any deferred "fill" sizing once they're parented. */
function add(parent, children) {
  var list = Array.isArray(children) ? children : [children];
  for (var i = 0; i < list.length; i++) {
    var child = list[i];
    if (!child) continue;
    parent.appendChild(child);
    if (child.__w || child.__h) applySizing(child, child.__w, child.__h);
  }
  return parent;
}

/** Mark a node so `add` stretches it once it has a parent. */
function fillW(node) {
  node.__w = "fill";
  return node;
}
function fillH(node) {
  node.__h = "fill";
  return node;
}

/**
 * A text node.
 *
 *   T("Today", { size: 24, weight: "black", color: "ink" })
 */
function T(chars, o) {
  o = o || {};
  var t = figma.createText();
  var family = o.quote ? FONT.quote : FONT.sans;
  var style = o.quote ? FONT.quoteStyle : WEIGHT[o.weight || "bold"] || "Bold";
  t.fontName = { family: family, style: style };
  t.characters = o.upper ? String(chars).toUpperCase() : String(chars);
  t.fontSize = o.size || 15;
  t.name = t.characters.slice(0, 40) || "text";
  setFills(t, o.color || "ink", o.opacity);

  if (o.lineHeight) t.lineHeight = { value: o.lineHeight, unit: "PIXELS" };
  if (o.tracking) t.letterSpacing = { value: o.tracking, unit: "PERCENT" };
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.w === "fill") {
    t.textAutoResize = "HEIGHT";
    t.__w = "fill";
  } else if (typeof o.w === "number") {
    t.textAutoResize = "HEIGHT";
    t.resize(o.w, t.height);
  } else {
    t.textAutoResize = "WIDTH_AND_HEIGHT";
  }
  // Truncation is meaningless while the node still grows sideways, and Figma
  // rejects the combination — so it only applies to a width-bounded node.
  if (o.truncate && t.textAutoResize === "HEIGHT") t.textTruncation = "ENDING";
  return t;
}

/** A rectangle — for tracks, bars, dividers and chart marks. */
function R(name, w, h, o) {
  o = o || {};
  var r = figma.createRectangle();
  r.name = name;
  r.resize(Math.max(0.01, w), Math.max(0.01, h));
  r.fills = [];
  if (o.fill) setFills(r, o.fill, o.fillOpacity);
  if (o.stroke) setStroke(r, o.stroke, o.strokeWeight);
  if (o.radius !== undefined) r.cornerRadius = o.radius;
  if (o.w === "fill") r.__w = "fill";
  return r;
}

/** An ellipse, optionally as a ring via arc data. */
function E(name, d, o) {
  o = o || {};
  var e = figma.createEllipse();
  e.name = name;
  e.resize(d, o.h || d);
  e.fills = [];
  if (o.fill) setFills(e, o.fill, o.fillOpacity);
  if (o.stroke) setStroke(e, o.stroke, o.strokeWeight);
  if (o.arc) e.arcData = o.arc;
  return e;
}

/**
 * An icon from the kit's `Icon` table, at `px` square and tinted with a
 * token name or hex.
 *
 * Figma's own SVG parser does the work — `vectorPaths` only understands a
 * subset of path syntax and would drop the arcs in settings/clock/link, and
 * it has no answer at all for the <rect> and <circle> primitives the kit uses.
 */
function icon(key, px, color) {
  px = px || 20;
  color = color || "ink";
  var markup = ICON_SVG[key];
  if (!markup) {
    console.warn("unknown icon: " + key);
    return F("icon/missing", { dir: "none", w: px, h: px });
  }

  // Solid marks (play/pause/stop) carry fill="CURRENT" in the table; every
  // other mark is a 2px round stroke, exactly as the kit renders them.
  var body = markup.replace(/CURRENT/g, "#000000");
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" ' +
    'fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    body +
    "</svg>";

  var node = figma.createNodeFromSvg(svg);
  node.name = "icon/" + key;
  node.fills = [];
  tint(node, color);
  // rescale, not resize: resizing the wrapper frame would crop the vectors
  // rather than scale them, and the stroke weight has to come down with it.
  if (px !== 24) node.rescale(px / 24);
  return node;
}

/** Recolour every stroke and fill inside a node — used to tint parsed SVG. */
function tint(node, color) {
  var stack = [node];
  while (stack.length) {
    var n = stack.pop();
    if ("strokes" in n && n.strokes && n.strokes.length) {
      n.strokes = n.strokes.map(function () {
        return paint(color);
      });
    }
    if ("fills" in n && Array.isArray(n.fills) && n.fills.length) {
      n.fills = n.fills.map(function () {
        return paint(color);
      });
    }
    if ("children" in n) {
      for (var i = 0; i < n.children.length; i++) stack.push(n.children[i]);
    }
  }
}

var SHADOW_CARD = {
  type: "DROP_SHADOW",
  color: { r: 0, g: 0, b: 0, a: 0.04 },
  offset: { x: 0, y: 1 },
  radius: 0,
  spread: 0,
  visible: true,
  blendMode: "NORMAL",
};

var SHADOW_SHEET = {
  type: "DROP_SHADOW",
  color: { r: 0, g: 0, b: 0, a: 0.18 },
  offset: { x: 0, y: -4 },
  radius: 24,
  spread: 0,
  visible: true,
  blendMode: "NORMAL",
};

var SHADOW_TOAST = {
  type: "DROP_SHADOW",
  color: { r: 0, g: 0, b: 0, a: 0.22 },
  offset: { x: 0, y: 6 },
  radius: 16,
  spread: 0,
  visible: true,
  blendMode: "NORMAL",
};

/* ==== 10-tokens.js ================================================ */
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

/* ==== 20-variables.js ============================================= */
/* ------------------------------------------------------------------
 * Figma Variables.
 *
 * Three collections, all find-or-create so re-running the plugin updates
 * values in place instead of stacking duplicates:
 *
 *   AntRep/Theme   modes Light + Dark — the semantic tokens every frame binds to
 *   AntRep/Brand   modes Light + Dark — the 5 accents and 33 background palettes
 *   AntRep/Size    no modes — radii, spacing, type sizes
 * ------------------------------------------------------------------ */

/**
 * The accent-derived chart ramp, ported from `chartPalette()` in
 * src/lib/theme.tsx so Figma shows the same five series the app renders.
 */
function chartPalette(accent) {
  var hex = String(accent).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return CHART_FALLBACK.slice();

  var rgb = [0, 2, 4].map(function (offset) {
    return parseInt(hex.slice(offset, offset + 2), 16) / 255;
  });
  var r = rgb[0];
  var g = rgb[1];
  var b = rgb[2];
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var delta = max - min;
  var lightness = (max + min) / 2;
  var saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  var hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;

  var s = Math.max(48, Math.min(76, saturation * 100));
  var l = Math.max(46, Math.min(62, lightness * 100 + 5));
  return [
    accent,
    hslHex((hue + 52) % 360, s, l),
    hslHex((hue + 116) % 360, s, l),
    hslHex((hue + 198) % 360, s, l),
    hslHex((hue + 292) % 360, s, l),
  ];
}

/** hsl() in the same terms CSS uses, back out as hex. */
function hslHex(h, s, l) {
  s /= 100;
  l /= 100;
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - c / 2;
  var rgb =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return (
    "#" +
    rgb
      .map(function (v) {
        var s2 = Math.round((v + m) * 255).toString(16);
        return s2.length === 1 ? "0" + s2 : s2;
      })
      .join("")
  );
}

/** The palette the generated screens paint with (theme.tsx default: denim). */
function activePalette() {
  for (var i = 0; i < BACKGROUNDS.length; i++) {
    if (BACKGROUNDS[i].key === ACTIVE_BG) return BACKGROUNDS[i];
  }
  return BACKGROUNDS[0];
}

/** Find a local collection by name, or make one. */
async function collection(name, modeNames) {
  var existing = await figma.variables.getLocalVariableCollectionsAsync();
  var col = null;
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].name === name) col = existing[i];
  }
  if (!col) col = figma.variables.createVariableCollection(name);

  col.renameMode(col.modes[0].modeId, modeNames[0]);
  for (var m = 1; m < modeNames.length; m++) {
    var found = col.modes.filter(function (mode) {
      return mode.name === modeNames[m];
    })[0];
    if (!found) col.addMode(modeNames[m]);
  }

  var byName = {};
  for (var k = 0; k < col.modes.length; k++) byName[col.modes[k].name] = col.modes[k].modeId;
  return { col: col, modes: byName };
}

/** Find a variable in a collection by name, or make one. */
async function variable(name, col, type) {
  var ids = col.variableIds;
  for (var i = 0; i < ids.length; i++) {
    var found = await figma.variables.getVariableByIdAsync(ids[i]);
    if (found && found.name === name) return found;
  }
  // The 2024+ signature takes the collection; older builds took its id.
  try {
    return figma.variables.createVariable(name, col, type);
  } catch (e) {
    return figma.variables.createVariable(name, col.id, type);
  }
}

/** Register a colour variable under `key` in V, with a value per mode. */
async function colorVar(name, col, modes, valuesByMode, key) {
  var v = await variable(name, col, "COLOR");
  v.scopes = ["ALL_SCOPES"];
  var modeNames = Object.keys(valuesByMode);
  for (var i = 0; i < modeNames.length; i++) {
    var modeId = modes[modeNames[i]];
    if (modeId) v.setValueForMode(modeId, hexRgb(valuesByMode[modeNames[i]]));
  }
  V[key === undefined ? name : key] = v;
  return v;
}

async function buildVariables() {
  var palette = activePalette();

  /* ---------- AntRep/Theme ---------- */
  var theme = await collection("AntRep/Theme", ["Light", "Dark"]);
  THEME_MODES = theme.modes;
  THEME_COLLECTION = theme.col;

  var both = function (light, dark) {
    return { Light: light, Dark: dark === undefined ? light : dark };
  };

  var surfaceKeys = ["bg", "surface", "inset", "ink", "muted", "line"];
  for (var i = 0; i < surfaceKeys.length; i++) {
    var key = surfaceKeys[i];
    await colorVar("surface/" + key, theme.col, theme.modes,
      both(SURFACES.Light[key], SURFACES.Dark[key]), key);
  }

  await colorVar("accent/base", theme.col, theme.modes,
    both(palette.light.accent, palette.dark.accent), "accent");
  await colorVar("accent/deep", theme.col, theme.modes,
    both(palette.light.deep, palette.dark.deep), "accent-deep");
  // color-mix(in srgb, accent 13%, surface) — index.css --t-accent-soft.
  await colorVar("accent/soft", theme.col, theme.modes,
    both(
      mix(palette.light.accent, SURFACES.Light.surface, 13),
      mix(palette.dark.accent, SURFACES.Dark.surface, 13),
    ), "accent-soft");
  // The accent at 22% over the surface — the app's `${tint}22` card wash.
  await colorVar("accent/wash", theme.col, theme.modes,
    both(
      mix(palette.light.accent, SURFACES.Light.surface, 14),
      mix(palette.dark.accent, SURFACES.Dark.surface, 14),
    ), "accent-wash");

  var fixedKeys = Object.keys(FIXED);
  for (var f = 0; f < fixedKeys.length; f++) {
    await colorVar("fixed/" + fixedKeys[f], theme.col, theme.modes,
      both(FIXED[fixedKeys[f]]), fixedKeys[f]);
  }

  var ramp = { Light: chartPalette(palette.light.accent), Dark: chartPalette(palette.dark.accent) };
  for (var c = 0; c < 5; c++) {
    await colorVar("chart/" + (c + 1), theme.col, theme.modes,
      both(ramp.Light[c], ramp.Dark[c]), "chart-" + (c + 1));
  }

  var metricKeys = Object.keys(METRICS.Light);
  for (var m = 0; m < metricKeys.length; m++) {
    var mk = metricKeys[m];
    await colorVar(mk, theme.col, theme.modes,
      both(METRICS.Light[mk], METRICS.Dark[mk]), mk);
  }

  /* ---------- AntRep/Brand ---------- */
  var brand = await collection("AntRep/Brand", ["Light", "Dark"]);
  for (var a = 0; a < ACCENTS.length; a++) {
    var preset = ACCENTS[a];
    await colorVar("accent-preset/" + preset.label + "/base", brand.col, brand.modes,
      both(preset.swatch), "preset-" + preset.key);
    await colorVar("accent-preset/" + preset.label + "/deep", brand.col, brand.modes,
      both(preset.deep), "preset-" + preset.key + "-deep");
  }
  for (var p = 0; p < BACKGROUNDS.length; p++) {
    var bg = BACKGROUNDS[p];
    var stem = "palette/" + bg.family + "/" + bg.label + "/";
    await colorVar(stem + "bg", brand.col, brand.modes, both(bg.light.bg, bg.dark.bg), "pal-" + bg.key + "-bg");
    await colorVar(stem + "accent", brand.col, brand.modes, both(bg.light.accent, bg.dark.accent), "pal-" + bg.key + "-accent");
    await colorVar(stem + "deep", brand.col, brand.modes, both(bg.light.deep, bg.dark.deep), "pal-" + bg.key + "-deep");
  }

  /* ---------- AntRep/Size ---------- */
  var sizes = await collection("AntRep/Size", ["Value"]);
  var valueMode = sizes.modes.Value;
  var numberVar = async function (name, value, scopes) {
    var v = await variable(name, sizes.col, "FLOAT");
    v.scopes = scopes;
    v.setValueForMode(valueMode, value);
    return v;
  };
  var radiusKeys = Object.keys(RADIUS);
  for (var r = 0; r < radiusKeys.length; r++) {
    await numberVar("radius/" + radiusKeys[r], RADIUS[radiusKeys[r]], ["CORNER_RADIUS"]);
  }
  var spaceKeys = Object.keys(SPACE);
  for (var s = 0; s < spaceKeys.length; s++) {
    await numberVar("space/" + spaceKeys[s], SPACE[spaceKeys[s]], ["GAP", "WIDTH_HEIGHT"]);
  }
  for (var t = 0; t < TYPE.length; t++) {
    await numberVar("text/" + TYPE[t].name, TYPE[t].size, ["FONT_SIZE"]);
  }

  return { theme: theme, brand: brand, sizes: sizes };
}

var THEME_MODES = null;
var THEME_COLLECTION = null;

/** Pin a frame to a theme mode so Dark specimens really render dark. */
function setMode(node, modeName) {
  if (!THEME_COLLECTION || !THEME_MODES || !THEME_MODES[modeName]) return;
  try {
    node.setExplicitVariableModeForCollection(THEME_COLLECTION, THEME_MODES[modeName]);
  } catch (e) {
    // Builds before the collection-object signature took the collection id.
    try {
      node.setExplicitVariableModeForCollection(THEME_COLLECTION.id, THEME_MODES[modeName]);
    } catch (e2) {
      console.warn("could not pin mode " + modeName + ": " + e2.message);
    }
  }
}

/* ==== 30-components.js ============================================ */
/* ------------------------------------------------------------------
 * The AntRep kit, rebuilt as Figma nodes.
 *
 * Every function mirrors a component in src/ui/kit.tsx — same paddings,
 * radii, weights and colours. Screens compose these, and 35-library.js
 * publishes them as real Figma components with variants.
 * ------------------------------------------------------------------ */

/* ---------- layout ---------- */

/** The dotted canvas texture (`pattern-bg`, dots at 28px, 10% / 4% ink). */
function patternTile(w, h, mode) {
  var g = F("pattern", { dir: "none", w: w, h: h });
  g.clipsContent = true;
  g.fills = [];
  var step = 28;
  var alpha = mode === "Dark" ? 0.04 : 0.1;
  for (var y = 6; y < h; y += step) {
    for (var x = 6; x < w; x += step) {
      var dot = E("dot", 3, { fill: mode === "Dark" ? "#ffffff" : "#282828", fillOpacity: alpha });
      g.appendChild(dot);
      dot.x = x;
      dot.y = y;
    }
  }
  return g;
}

/** iOS status bar — time, and the signal/wifi/battery cluster. */
function statusBar() {
  var bar = F("Status bar", {
    dir: "h", w: DEVICE.w, h: DEVICE.statusBar,
    pad: { l: 28, r: 20, t: 14, b: 0 }, justify: "SPACE_BETWEEN", align: "MIN",
  });
  add(bar, T("9:41", { size: 15, weight: "black", color: "ink" }));

  var right = F("indicators", { dir: "h", gap: 5, align: "CENTER" });
  var signal = F("signal", { dir: "h", gap: 2, align: "MAX" });
  for (var i = 0; i < 4; i++) {
    add(signal, R("bar", 3, 4 + i * 2.5, { fill: "ink", radius: 1 }));
  }
  add(right, signal);
  add(right, R("wifi", 15, 11, { fill: "ink", radius: 2 }));
  var battery = F("battery", { dir: "none", w: 25, h: 12, radius: 3, stroke: "ink", strokeWeight: 1 });
  var level = R("level", 18, 8, { fill: "ink", radius: 2 });
  battery.appendChild(level);
  level.x = 2;
  level.y = 2;
  add(right, battery);
  add(bar, right);
  return bar;
}

/**
 * A phone-sized screen frame: patterned canvas, a scroll column at the
 * app's `max-w-lg px-4 pt-5 pb-32` rhythm, and room for the tab bar.
 */
function screen(name, o) {
  o = o || {};
  var mode = o.mode || RENDER_MODE;
  var f = F(name, { dir: "none", w: DEVICE.w, h: o.h || DEVICE.h, fill: "bg" });
  f.clipsContent = true;
  setMode(f, mode);

  var pattern = patternTile(DEVICE.w, o.h || DEVICE.h, mode);
  f.appendChild(pattern);

  if (o.chrome !== false) {
    var bar = statusBar();
    f.appendChild(bar);
    bar.x = 0;
    bar.y = 0;
  }

  var column = F("content", {
    dir: "v", gap: o.gap === undefined ? 12 : o.gap,
    pad: { l: DEVICE.gutter, r: DEVICE.gutter, t: 0, b: 0 },
    w: DEVICE.w,
  });
  f.appendChild(column);
  column.x = 0;
  column.y = o.chrome === false ? 0 : DEVICE.statusBar + 8;
  f.__column = column;
  f.__mode = mode;
  return f;
}

/** Drop the tab bar onto a screen, pinned to the bottom. */
function attachTabBar(screenNode, tabs, active) {
  var bar = tabBar(tabs, active);
  screenNode.appendChild(bar);
  bar.x = 0;
  bar.y = screenNode.height - bar.height;
  return bar;
}

function screenTitle(o) {
  var head = F("ScreenTitle", { dir: "v", gap: 0, w: "fill", pad: { b: 8 } });
  var row = F("row", { dir: "h", gap: 12, w: "fill", justify: "SPACE_BETWEEN", align: "MIN" });
  var left = F("left", { dir: "v", gap: 0, w: "fill" });
  if (o.date) add(left, T(o.date, { size: 16, quote: true, color: "ink", opacity: 0.85 }));
  add(left, T(o.title, { size: 24, weight: "black", color: "ink", lineHeight: 29, w: "fill" }));
  add(row, left);
  if (o.right) add(row, o.right);
  add(head, row);
  if (o.quote) {
    add(head, T("“" + o.quote + "”", {
      size: 16, quote: true, color: "ink", opacity: 0.8, lineHeight: 22, w: "fill",
    }));
  }
  return head;
}

function sectionHeader(title, action, iconKey) {
  var row = F("SectionHeader", {
    dir: "h", gap: 8, w: "fill", justify: "SPACE_BETWEEN", align: "CENTER",
    pad: { t: 12, b: 2 },
  });
  var left = F("label", { dir: "h", gap: 6, align: "CENTER" });
  if (iconKey) add(left, icon(iconKey, 14, "muted"));
  add(left, T(title, { size: 12, weight: "black", color: "muted", upper: true, tracking: 3 }));
  add(row, left);
  if (action) add(row, action);
  return row;
}

function card(o) {
  o = o || {};
  var c = F(o.name || "Card", {
    dir: "v", gap: o.gap === undefined ? 8 : o.gap, pad: o.pad === undefined ? 16 : o.pad,
    fill: "surface", stroke: o.tint || "line", radius: RADIUS.card, w: "fill",
    shadow: SHADOW_CARD,
  });
  if (o.children) add(c, o.children);
  return c;
}

/* ---------- actions ---------- */

function button(label, o) {
  o = o || {};
  var variant = o.variant || "primary";
  var small = o.size === "sm";
  var h = small ? 32 : 44;

  var fill = variant === "primary" ? (o.tint || "accent") : variant === "danger" ? "danger" : variant === "secondary" ? "surface" : null;
  var ink = variant === "primary" || variant === "danger" ? "white" : variant === "ghost" ? (o.tint || "accent") : "ink";

  var b = F("Button/" + variant, {
    dir: "h", gap: 6, h: h, radius: RADIUS.pill,
    pad: { l: small ? 14 : 20, r: small ? 14 : 20 },
    fill: fill, stroke: variant === "secondary" ? "line" : null,
    justify: "CENTER", align: "CENTER",
    w: o.full ? "fill" : undefined,
    opacity: o.disabled ? 0.4 : 1,
  });
  if (o.icon) add(b, icon(o.icon, small ? 14 : 16, ink));
  add(b, T(label, { size: small ? 13 : 15, weight: "black", color: ink }));
  return b;
}

function iconButton(key, o) {
  o = o || {};
  var b = F("IconButton", {
    dir: "h", w: 36, h: 36, radius: RADIUS.pill,
    fill: "surface", stroke: "line", justify: "CENTER", align: "CENTER",
  });
  add(b, icon(key, 16, o.color || "ink"));
  return b;
}

function pill(label, tint) {
  var p = F("Pill", {
    dir: "h", gap: 4, h: 18, radius: RADIUS.pill,
    pad: { l: 8, r: 8 }, justify: "CENTER", align: "CENTER",
    fill: tint ? "accent-wash" : "inset",
  });
  if (tint && tint.charAt(0) === "#") setFills(p, tint, 0.16);
  add(p, T(label, { size: 10, weight: "black", color: tint || "muted", upper: true, tracking: 3 }));
  return p;
}

function iconTile(emoji, tint, px) {
  px = px || 40;
  var t = F("IconTile", { dir: "h", w: px, h: px, radius: px * 0.3, justify: "CENTER", align: "CENTER" });
  setFills(t, tint || "accent", 0.13);
  add(t, T(emoji, { size: px * 0.5, weight: "regular", color: "ink" }));
  return t;
}

/* ---------- inputs ---------- */

function textField(value, o) {
  o = o || {};
  var f = F("TextField", {
    dir: "h", h: 44, radius: RADIUS.field, pad: { l: 12, r: 12 },
    fill: "inset", stroke: o.focus ? "accent" : "line", align: "CENTER", w: "fill",
  });
  add(f, T(value, {
    size: 15,
    weight: o.placeholder ? "semibold" : "bold",
    color: o.placeholder ? "muted" : "ink",
    w: "fill",
  }));
  if (o.trailing) add(f, o.trailing);
  return f;
}

function field(label, child, hint) {
  var f = F("Field", { dir: "v", gap: 4, w: "fill" });
  add(f, T(label, { size: 12, weight: "black", color: "muted", upper: true, tracking: 3 }));
  add(f, child);
  if (hint) add(f, T(hint, { size: 12, weight: "semibold", color: "muted", w: "fill" }));
  return f;
}

function numberField(value, o) {
  o = o || {};
  var f = F("NumberField", {
    dir: "h", h: 44, radius: RADIUS.field, fill: "inset", stroke: "line",
    align: "CENTER", w: o.w || "fill",
  });
  var minus = F("dec", { dir: "h", w: 36, h: 44, justify: "CENTER", align: "CENTER" });
  add(minus, T("−", { size: 18, weight: "black", color: "muted" }));
  add(f, minus);
  add(f, T(value === null ? (o.placeholder || "0") : String(value), {
    size: 15, weight: "black", align: "CENTER", w: "fill",
    color: value === null ? "muted" : "ink",
    opacity: value === null ? 0.5 : 1,
  }));
  if (o.suffix) add(f, T(o.suffix, { size: 12, weight: "bold", color: "muted" }));
  var plus = F("inc", { dir: "h", w: 36, h: 44, justify: "CENTER", align: "CENTER" });
  add(plus, T("+", { size: 18, weight: "black", color: "muted" }));
  add(f, plus);
  return f;
}

/** Effort on the reps-in-reserve scale — 0–10 in half steps, `null` = unrated. */
function rpeSlider(value, meaning, o) {
  o = o || {};
  var wrap = F("RpeSlider", { dir: "v", gap: 6, w: "fill" });

  var head = F("head", { dir: "h", gap: 8, w: "fill", align: "CENTER" });
  add(head, T("Effort (RPE)", { size: 10, weight: "black", color: "muted", upper: true, tracking: 3 }));
  var info = F("info", { dir: "h", w: 16, h: 16, radius: 8, stroke: "line", justify: "CENTER", align: "CENTER" });
  add(info, T("i", { size: 9, weight: "black", color: "muted" }));
  add(head, info);
  add(head, T(value === null ? "—" : value + "/10", {
    size: 13, weight: "black", color: value === null ? "muted" : "accent",
  }));
  if (meaning) add(head, T(meaning, { size: 11, weight: "bold", color: "muted", w: "fill", truncate: true }));
  if (value !== null) add(head, T("Clear", { size: 10, weight: "black", color: "muted", upper: true }));
  add(wrap, head);

  var trackW = o.trackW || (DEVICE.w - DEVICE.gutter * 2 - 32);
  var lane = F("track", { dir: "none", w: "fill", h: 20 });
  var base = R("base", trackW, 6, { fill: "inset", radius: 3 });
  lane.appendChild(base);
  base.x = 0;
  base.y = 7;

  if (value !== null) {
    var fillW2 = Math.max(2, (value / 10) * trackW);
    var done = R("value", fillW2, 6, { fill: "accent", radius: 3 });
    lane.appendChild(done);
    done.x = 0;
    done.y = 7;
  }
  if (o.target) {
    var mark = R("target", 2, 14, { fill: "ink", fillOpacity: 0.4, radius: 1 });
    lane.appendChild(mark);
    mark.x = (o.target / 10) * trackW;
    mark.y = 3;
  }
  var thumb = E("thumb", 18, { fill: value === null ? "muted" : "accent", stroke: "surface", strokeWeight: 2 });
  lane.appendChild(thumb);
  thumb.x = Math.min(trackW - 18, Math.max(0, ((value === null ? 7 : value) / 10) * trackW - 9));
  thumb.y = 1;
  add(wrap, lane);

  var scale = F("scale", { dir: "h", w: "fill", justify: "SPACE_BETWEEN" });
  add(scale, T("Easy · plenty left", { size: 9, weight: "bold", color: "muted" }));
  add(scale, T("Maximum · nothing left", { size: 9, weight: "bold", color: "muted" }));
  add(wrap, scale);
  return wrap;
}

function segmented(options, activeIndex, o) {
  o = o || {};
  var compact = !!o.compact;
  var s = F("Segmented", {
    dir: "h", gap: 0, pad: compact ? 2 : 4, radius: RADIUS.pill,
    fill: "inset", stroke: "line", w: o.w || "fill",
  });
  for (var i = 0; i < options.length; i++) {
    var on = i === activeIndex;
    var seg = F("segment", {
      dir: "h", h: compact ? 30 : 32, radius: RADIUS.pill,
      pad: { l: 12, r: 12 }, justify: "CENTER", align: "CENTER",
      fill: on ? "surface" : null, w: o.scroll ? undefined : "fill",
      shadow: on ? SHADOW_CARD : undefined,
    });
    add(seg, T(options[i], {
      size: compact ? 11 : 13, weight: "black", color: on ? "ink" : "muted",
    }));
    add(s, seg);
  }
  return s;
}

function toggle(checked) {
  var t = F("Toggle", { dir: "none", w: 48, h: 28, radius: 14, fill: checked ? "accent" : "line" });
  var knob = E("knob", 24, { fill: "white" });
  knob.effects = [SHADOW_CARD];
  t.appendChild(knob);
  knob.x = checked ? 22 : 2;
  knob.y = 2;
  return t;
}

function settingRow(title, o) {
  o = o || {};
  var row = F("SettingRow", {
    dir: "h", gap: 12, w: "fill", align: "CENTER",
    pad: { l: 16, r: 16, t: 12, b: 12 },
  });
  if (o.divider !== false) {
    row.strokes = [paint("line")];
    row.strokeBottomWeight = 1;
    row.strokeTopWeight = 0;
    row.strokeLeftWeight = 0;
    row.strokeRightWeight = 0;
    row.strokeAlign = "INSIDE";
  }
  var text = F("text", { dir: "v", gap: 0, w: "fill" });
  add(text, T(title, { size: 15, weight: "bold", color: "ink" }));
  if (o.subtitle) add(text, T(o.subtitle, { size: 12, weight: "semibold", color: "muted", w: "fill" }));
  add(row, text);
  if (o.right) add(row, o.right);
  else add(row, icon("chevron", 16, "muted"));
  return row;
}

/* ---------- feedback ---------- */

/**
 * A ring built from two arc *fills* rather than strokes.
 *
 * An ellipse with arcData already describes a donut segment through
 * innerRadius; stroking it instead would outline the segment's radial edges
 * too, which is not what the app draws.
 */
function progressRing(ratio, o) {
  o = o || {};
  var d = o.size || 72;
  var stroke = o.stroke || 6;
  var color = o.color || "accent";
  var clamped = Math.max(0, Math.min(1, ratio));

  var wrap = F("ProgressRing", { dir: "none", w: d, h: d });
  var inner = Math.max(0, Math.min(0.99, (d / 2 - stroke) / (d / 2)));

  var track = E("track", d, {});
  track.fills = [paint(color, 0.16)];
  track.strokes = [];
  track.arcData = { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: inner };
  wrap.appendChild(track);

  if (clamped > 0) {
    var arc = E("value", d, {});
    arc.fills = [paint(color)];
    arc.strokes = [];
    arc.arcData = {
      startingAngle: -Math.PI / 2,
      // A full ring must not close to a zero-length sweep.
      endingAngle: -Math.PI / 2 + Math.min(clamped, 0.9999) * Math.PI * 2,
      innerRadius: inner,
    };
    wrap.appendChild(arc);
  }

  var label = F("label", { dir: "v", gap: 2, w: d, h: d, justify: "CENTER", align: "CENTER" });
  if (o.label) add(label, T(o.label, { size: 14, weight: "black", color: "ink" }));
  if (o.sublabel) add(label, T(o.sublabel, { size: 10, weight: "black", color: "muted", upper: true }));
  wrap.appendChild(label);
  label.x = 0;
  label.y = 0;
  return wrap;
}

/**
 * `w` may be a number or "fill". A filled bar still needs a pixel width for
 * the value mark, so it falls back to the width a card's content column
 * actually gets: the screen minus the page gutter and the card padding.
 */
function progressBar(ratio, o) {
  o = o || {};
  var color = o.color || "accent";
  var CONTENT_W = DEVICE.w - DEVICE.gutter * 2 - 32;
  var px = typeof o.w === "number" ? o.w : CONTENT_W;

  var track = F("ProgressBar", { dir: "none", w: o.w === "fill" ? undefined : px, h: 8, radius: 4 });
  setFills(track, color, 0.13);
  if (o.w === "fill") {
    track.resize(px, 8);
    track.__w = "fill";
  }
  var value = R("value", Math.max(2, px * Math.max(0, Math.min(1, ratio))), 8, { fill: color, radius: 4 });
  track.appendChild(value);
  value.x = 0;
  value.y = 0;
  return track;
}

function statTile(value, label, o) {
  o = o || {};
  var t = F("StatTile", {
    dir: "v", gap: 4, pad: { l: 12, r: 12, t: 10, b: 10 },
    radius: RADIUS.field, fill: "inset", align: "CENTER", w: "fill",
  });
  if (o.icon) add(t, icon(o.icon, 16, o.tint || "accent"));
  add(t, T(value, { size: 18, weight: "black", color: "ink", align: "CENTER" }));
  add(t, T(label, { size: 11, weight: "black", color: "muted", upper: true, tracking: 3, align: "CENTER" }));
  return t;
}

function emptyState(title, subtitle, action) {
  var e = F("EmptyState", {
    dir: "v", gap: 4, pad: { l: 24, r: 24, t: 40, b: 40 },
    radius: RADIUS.card, align: "CENTER", w: "fill",
  });
  e.strokes = [paint("line")];
  e.strokeWeight = 1;
  e.dashPattern = [6, 5];
  add(e, T(title, { size: 16, weight: "black", color: "ink", align: "CENTER" }));
  if (subtitle) add(e, T(subtitle, { size: 14, weight: "semibold", color: "muted", align: "CENTER", w: 240, lineHeight: 19 }));
  if (action) {
    var slot = F("action", { dir: "h", pad: { t: 12 }, justify: "CENTER", w: "fill" });
    add(slot, action);
    add(e, slot);
  }
  return e;
}

function spinner(px) {
  px = px || 32;
  var s = E("Spinner", px, {});
  s.fills = [paint("accent")];
  s.strokes = [];
  s.arcData = {
    startingAngle: -Math.PI / 2,
    endingAngle: Math.PI * 0.75,
    innerRadius: Math.max(0, Math.min(0.99, (px / 2 - 3) / (px / 2))),
  };
  return s;
}

function toast(message) {
  var t = F("Toast", {
    dir: "h", h: 34, radius: RADIUS.pill, pad: { l: 16, r: 16 },
    fill: "ink", justify: "CENTER", align: "CENTER", shadow: SHADOW_TOAST,
  });
  add(t, T(message, { size: 14, weight: "black", color: "bg" }));
  return t;
}

/* ---------- overlays ---------- */

/** A bottom sheet panel — pair with `scrim` to sit it over a screen. */
function sheetPanel(title, children, footer, o) {
  o = o || {};
  var panel = F("Sheet", {
    dir: "v", gap: 12, pad: 16, fill: "surface",
    radii: [RADIUS.sheet, RADIUS.sheet, 0, 0], w: DEVICE.w, shadow: SHADOW_SHEET,
  });
  var head = F("head", { dir: "h", gap: 12, w: "fill", justify: "SPACE_BETWEEN", align: "CENTER" });
  add(head, T(title, { size: 18, weight: "black", color: "ink" }));
  add(head, iconButton("close"));
  add(panel, head);
  add(panel, children);
  if (footer) add(panel, footer);
  return panel;
}

/** iOS-style confirmation — a stack of full-width choices. */
function actionDialog(title, message, actions) {
  var d = F("ActionDialog", {
    dir: "v", gap: 8, pad: 20, fill: "surface", radius: RADIUS.sheet,
    w: DEVICE.w - 64, shadow: SHADOW_SHEET,
  });
  add(d, T(title, { size: 18, weight: "black", color: "ink" }));
  if (message) add(d, T(message, { size: 14, weight: "semibold", color: "muted", lineHeight: 19, w: "fill" }));
  var stack = F("actions", { dir: "v", gap: 8, w: "fill", pad: { t: 8 } });
  for (var i = 0; i < actions.length; i++) {
    var a = actions[i];
    var tone = a.tone || "default";
    var b = F("action", {
      dir: "h", h: 44, radius: RADIUS.pill, w: "fill", justify: "CENTER", align: "CENTER",
      fill: tone === "primary" ? "accent" : tone === "danger" ? "danger" : "inset",
      fillOpacity: tone === "danger" ? 0.1 : 1,
      stroke: tone === "default" ? "line" : null,
    });
    add(b, T(a.label, {
      size: 15, weight: "black",
      color: tone === "primary" ? "white" : tone === "danger" ? "danger" : "ink",
    }));
    add(stack, b);
  }
  var cancel = F("cancel", { dir: "h", h: 44, radius: RADIUS.pill, w: "fill", justify: "CENTER", align: "CENTER" });
  add(cancel, T("Cancel", { size: 15, weight: "black", color: "muted" }));
  add(stack, cancel);
  add(d, stack);
  return d;
}

/** Dim the screen behind an overlay. */
function scrim(h) {
  var s = R("scrim", DEVICE.w, h || DEVICE.h, { fill: "#000000", fillOpacity: 0.4 });
  return s;
}

/* ---------- tab bar ---------- */

function tabBar(tabs, active) {
  var bar = F("TabBar", {
    dir: "h", w: DEVICE.w, h: DEVICE.tabBar, fill: "surface",
    pad: { l: 8, r: 8, t: 8, b: 18 }, justify: "CENTER", align: "MIN",
  });
  bar.strokes = [paint("line")];
  bar.strokeTopWeight = 1;
  bar.strokeBottomWeight = 0;
  bar.strokeLeftWeight = 0;
  bar.strokeRightWeight = 0;
  bar.strokeAlign = "INSIDE";

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    var on = tab.key === active;
    var color = on ? "accent" : "muted";
    var cell = F("tab", { dir: "v", gap: 3, w: "fill", justify: "CENTER", align: "CENTER" });
    add(cell, icon(tab.icon, 22, color));
    add(cell, T(tab.label, { size: 10, weight: "black", color: color, upper: true, tracking: 3 }));
    add(bar, cell);
  }
  return bar;
}

var ATHLETE_TABS = [
  { key: "home", label: "Home", icon: "home" },
  { key: "plans", label: "Plans", icon: "plan" },
  { key: "coach", label: "Coach", icon: "people" },
  { key: "progress", label: "Progress", icon: "progress" },
  { key: "exercises", label: "Library", icon: "dumbbell" },
  { key: "settings", label: "Settings", icon: "settings" },
];

var COACH_TABS = [
  { key: "athletes", label: "Athletes", icon: "people" },
  { key: "plans", label: "Plans", icon: "plan" },
  { key: "exercises", label: "Exercises", icon: "dumbbell" },
  { key: "training", label: "My training", icon: "dumbbell" },
  { key: "settings", label: "Settings", icon: "settings" },
];

/** Which theme mode the generated screens paint in — set from the UI. */
var RENDER_MODE = "Light";

/* ==== 35-library.js =============================================== */
/* ------------------------------------------------------------------
 * Foundations and the component library.
 *
 * Foundations documents the token system; Components publishes the kit as
 * real Figma components (variant sets where the React prop is an enum), so
 * the screens on the flow pages are instances, not copies.
 * ------------------------------------------------------------------ */

/** A titled board — the unit both pages are laid out from. */
function board(title, note, o) {
  o = o || {};
  var b = F(title, {
    dir: "v", gap: 20, pad: 32, fill: "surface", radius: 24, stroke: "line",
    w: o.w || undefined,
  });
  setMode(b, o.mode || "Light");
  var head = F("head", { dir: "v", gap: 4, w: "fill" });
  add(head, T(title, { size: 24, weight: "black", color: "ink" }));
  if (note) add(head, T(note, { size: 14, weight: "semibold", color: "muted", w: o.w ? o.w - 64 : 560, lineHeight: 19 }));
  add(b, head);
  return b;
}

function subhead(text) {
  return T(text, { size: 12, weight: "black", color: "muted", upper: true, tracking: 4 });
}

/** A colour chip with its name and hex. */
function swatch(label, token, hex, o) {
  o = o || {};
  var s = F("swatch/" + label, { dir: "v", gap: 6, w: o.w || 132 });
  var chip = F("chip", { dir: "none", w: o.w || 132, h: o.h || 56, radius: 12, fill: token, stroke: "line" });
  add(s, chip);
  add(s, T(label, { size: 12, weight: "black", color: "ink" }));
  if (hex) add(s, T(hex, { size: 11, weight: "semibold", color: "muted" }));
  return s;
}

/* ---------- Foundations ---------- */

async function buildFoundations(page) {
  var y = 0;
  var place = function (node) {
    page.appendChild(node);
    node.x = 0;
    node.y = y;
    y += node.height + 48;
  };

  place(coverBoard());
  place(semanticBoard());
  place(accentBoard());
  place(paletteBoard());
  place(analyticsBoard());
  place(typeBoard());
  place(shapeBoard());
  place(iconBoard());
}

function coverBoard() {
  var b = F("Cover", { dir: "v", gap: 16, pad: 48, fill: "bg", radius: 24, w: 1240, stroke: "line" });
  setMode(b, "Light");
  add(b, T("AntRep", { size: 64, weight: "black", color: "ink" }));
  add(b, T("Design system and end-to-end user flows", { size: 22, weight: "bold", color: "muted" }));
  var meta = F("meta", { dir: "h", gap: 10, pad: { t: 12 } });
  add(meta, pill("Athlete", "accent"));
  add(meta, pill("Coach", "accent"));
  add(meta, pill("Light + Dark", "muted"));
  add(meta, pill(BACKGROUNDS.length + " palettes", "muted"));
  add(b, meta);
  add(b, T(
    "Generated from the live app — tokens from src/index.css and src/lib/theme.tsx, components from src/ui/kit.tsx, screens from src/app. Re-run the plugin after a UI change to refresh.",
    { size: 14, weight: "semibold", color: "muted", w: 720, lineHeight: 20 },
  ));
  return b;
}

function semanticBoard() {
  var b = board("Semantic colour", "The six surfaces every screen is built from, plus the accent trio. Bound to the AntRep/Theme collection, so switching a frame to Dark repaints it exactly as the app does.", { w: 1240 });

  var keys = ["bg", "surface", "inset", "ink", "muted", "line", "accent", "accent-deep", "accent-soft"];
  var modes = ["Light", "Dark"];
  for (var m = 0; m < modes.length; m++) {
    var mode = modes[m];
    var group = F(mode, { dir: "v", gap: 12, w: "fill" });
    add(group, subhead(mode));
    var row = F("row", { dir: "h", gap: 12, wrap: true, w: "fill" });
    var strip = F("strip", { dir: "h", gap: 12, pad: 16, radius: 16, fill: "bg" });
    setMode(strip, mode);
    for (var i = 0; i < keys.length; i++) {
      var hex = SURFACES[mode][keys[i]];
      if (!hex) {
        var pal = activePalette()[mode.toLowerCase()];
        hex = keys[i] === "accent" ? pal.accent : keys[i] === "accent-deep" ? pal.deep : mix(pal.accent, SURFACES[mode].surface, 13);
      }
      add(strip, swatch(keys[i], keys[i], hex));
    }
    add(row, strip);
    add(group, row);
    add(b, group);
  }

  var fixed = F("Fixed", { dir: "v", gap: 12, w: "fill" });
  add(fixed, subhead("Fixed — identical in both modes"));
  var fixedRow = F("row", { dir: "h", gap: 12, wrap: true });
  var fixedKeys = ["danger", "danger-deep", "gold", "done", "done-deep"];
  for (var f = 0; f < fixedKeys.length; f++) {
    add(fixedRow, swatch(fixedKeys[f], fixedKeys[f], FIXED[fixedKeys[f]]));
  }
  add(fixed, fixedRow);
  add(b, fixed);
  return b;
}

function accentBoard() {
  var b = board("Accent presets", "Five pinnable accents. “Auto” (the default) derives the accent from the chosen background palette instead.", { w: 1240 });
  var row = F("row", { dir: "h", gap: 16, wrap: true, w: "fill" });
  for (var i = 0; i < ACCENTS.length; i++) {
    var a = ACCENTS[i];
    var cell = F(a.label, { dir: "v", gap: 8, pad: 16, radius: 16, fill: "inset", w: 220 });
    var chips = F("chips", { dir: "h", gap: 8 });
    var base = F("base", { dir: "none", w: 88, h: 56, radius: 12 });
    setFills(base, a.swatch);
    var deep = F("deep", { dir: "none", w: 88, h: 56, radius: 12 });
    setFills(deep, a.deep);
    add(chips, [base, deep]);
    add(cell, chips);
    add(cell, T(a.label, { size: 15, weight: "black", color: "ink" }));
    add(cell, T(a.swatch + " · " + a.deep, { size: 11, weight: "semibold", color: "muted" }));
    add(row, cell);
  }
  add(b, row);
  return b;
}

function paletteBoard() {
  var b = board(
    "Background palettes",
    BACKGROUNDS.length + " curated tints across " + BACKGROUND_FAMILIES.length +
      " families. Each carries a light and a dark rendition and drives the accent, so picking one re-tunes the whole UI. Denim is the shipped default.",
    { w: 1240 },
  );

  for (var f = 0; f < BACKGROUND_FAMILIES.length; f++) {
    var family = BACKGROUND_FAMILIES[f];
    var group = F(family, { dir: "v", gap: 10, w: "fill" });
    add(group, subhead(family));
    var row = F("row", { dir: "h", gap: 12, wrap: true, w: "fill" });
    for (var i = 0; i < BACKGROUNDS.length; i++) {
      var p = BACKGROUNDS[i];
      if (p.family !== family) continue;
      var cell = F(p.label, { dir: "v", gap: 6, w: 168, pad: 10, radius: 14, fill: "inset" });
      var pair = F("pair", { dir: "h", gap: 6, w: "fill" });
      var lightChip = F("light", { dir: "none", w: 70, h: 44, radius: 10, stroke: "line" });
      setFills(lightChip, p.light.bg);
      var lightDot = E("accent", 16, {});
      setFills(lightDot, p.light.accent);
      lightChip.appendChild(lightDot);
      lightDot.x = 46;
      lightDot.y = 22;
      var darkChip = F("dark", { dir: "none", w: 70, h: 44, radius: 10, stroke: "line" });
      setFills(darkChip, p.dark.bg);
      var darkDot = E("accent", 16, {});
      setFills(darkDot, p.dark.accent);
      darkChip.appendChild(darkDot);
      darkDot.x = 46;
      darkDot.y = 22;
      add(pair, [lightChip, darkChip]);
      add(cell, pair);
      var name = T(p.label + (p.key === ACTIVE_BG ? "  ·  default" : ""), {
        size: 12, weight: "black", color: p.key === ACTIVE_BG ? "accent" : "ink",
      });
      add(cell, name);
      add(row, cell);
    }
    add(group, row);
    add(b, group);
  }
  return b;
}

function analyticsBoard() {
  var b = board(
    "Analytics colour",
    "Training dimensions and exercise categories keep a semantic identity across every accent and both modes — they are the one family that never re-tunes. The five-step chart ramp does rotate, derived from the active accent.",
    { w: 1240 },
  );

  var groups = [
    { label: "Training dimensions", prefix: "metric/" },
    { label: "Exercise categories", prefix: "category/" },
  ];
  for (var g = 0; g < groups.length; g++) {
    var group = F(groups[g].label, { dir: "v", gap: 10, w: "fill" });
    add(group, subhead(groups[g].label));
    var row = F("row", { dir: "h", gap: 12, wrap: true });
    var keys = Object.keys(METRICS.Light);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(groups[g].prefix) !== 0) continue;
      var name = keys[i].split("/")[1];
      add(row, swatch(name, keys[i], METRICS.Light[keys[i]] + " / " + METRICS.Dark[keys[i]], { w: 150 }));
    }
    add(group, row);
    add(b, group);
  }

  var ramp = F("Chart ramp", { dir: "v", gap: 10, w: "fill" });
  add(ramp, subhead("Chart series 1–5 · derived from " + activePalette().label));
  var rampRow = F("row", { dir: "h", gap: 12 });
  var colors = chartPalette(activePalette().light.accent);
  for (var c = 0; c < 5; c++) {
    add(rampRow, swatch("chart/" + (c + 1), "chart-" + (c + 1), colors[c], { w: 150 }));
  }
  add(ramp, rampRow);
  add(b, ramp);
  return b;
}

function typeBoard() {
  var b = board(
    "Type",
    "Nunito throughout — the app's rounded voice — with Baskerville italic reserved for the date line and the daily quote. Weights run bold and black; there is almost no regular text in the product.",
    { w: 1240 },
  );
  for (var i = 0; i < TYPE.length; i++) {
    var t = TYPE[i];
    var row = F(t.name, { dir: "h", gap: 32, w: "fill", align: "CENTER", pad: { t: 8, b: 8 } });
    row.strokes = [paint("line")];
    row.strokeBottomWeight = 1;
    row.strokeTopWeight = 0;
    row.strokeLeftWeight = 0;
    row.strokeRightWeight = 0;
    var meta = F("meta", { dir: "v", gap: 2, w: 200 });
    add(meta, T(t.name, { size: 13, weight: "black", color: "ink" }));
    add(meta, T(t.size + "px · " + t.weight + " · " + t.lh + "/lh", { size: 11, weight: "semibold", color: "muted" }));
    add(row, meta);
    var sample = T(t.quote ? "Consistency beats intensity" : "Push · Pull · Legs", {
      size: t.size, weight: t.weight, quote: t.quote, color: "ink", lineHeight: t.lh, w: "fill",
    });
    add(row, sample);
    add(row, T(t.note, { size: 11, weight: "semibold", color: "muted", w: 200 }));
    add(b, row);
  }
  return b;
}

function shapeBoard() {
  var b = board("Shape and rhythm", "Radii and the 4px spacing scale the screens are laid out on.", { w: 1240 });

  var radii = F("Radius", { dir: "v", gap: 10, w: "fill" });
  add(radii, subhead("Radius"));
  var rRow = F("row", { dir: "h", gap: 16, wrap: true });
  var rKeys = Object.keys(RADIUS);
  for (var i = 0; i < rKeys.length; i++) {
    var cell = F(rKeys[i], { dir: "v", gap: 6 });
    var box = F("box", { dir: "none", w: 96, h: 64, radius: Math.min(RADIUS[rKeys[i]], 32), fill: "inset", stroke: "line" });
    add(cell, box);
    add(cell, T(rKeys[i] + " · " + (RADIUS[rKeys[i]] === 999 ? "full" : RADIUS[rKeys[i]] + "px"), {
      size: 12, weight: "black", color: "ink",
    }));
    add(rRow, cell);
  }
  add(radii, rRow);
  add(b, radii);

  var spacing = F("Spacing", { dir: "v", gap: 10, w: "fill" });
  add(spacing, subhead("Spacing"));
  var sRow = F("row", { dir: "h", gap: 16, align: "MAX", wrap: true });
  var sKeys = Object.keys(SPACE);
  for (var s = 0; s < sKeys.length; s++) {
    var sCell = F(sKeys[s], { dir: "v", gap: 6, align: "CENTER" });
    var bar = F("bar", { dir: "none", w: SPACE[sKeys[s]], h: 48, radius: 3, fill: "accent" });
    add(sCell, bar);
    add(sCell, T(SPACE[sKeys[s]] + "", { size: 12, weight: "black", color: "ink" }));
    add(sRow, sCell);
  }
  add(spacing, sRow);
  add(b, spacing);
  return b;
}

function iconBoard() {
  var b = board("Icons", ICON_KEYS.length + " inline icons, 2px round strokes on a 24 grid — no network requests in the app, no icon font here.", { w: 1240 });
  var row = F("row", { dir: "h", gap: 12, wrap: true, w: "fill" });
  for (var i = 0; i < ICON_KEYS.length; i++) {
    var key = ICON_KEYS[i];
    var cell = F(key, { dir: "v", gap: 8, pad: 12, radius: 14, fill: "inset", w: 108, align: "CENTER" });
    add(cell, icon(key, 24, "ink"));
    add(cell, T(key, { size: 10, weight: "black", color: "muted", align: "CENTER", w: "fill" }));
    add(row, cell);
  }
  add(b, row);
  return b;
}

/* ---------- Components ---------- */

/** Turn a built frame into a component named for its variant combination. */
function asComponent(node, name) {
  var comp = figma.createComponentFromNode(node);
  comp.name = name;
  return comp;
}

/** Build a variant set from a list of { name, node } and title it. */
function variantSet(page, title, items, description) {
  var comps = [];
  for (var i = 0; i < items.length; i++) {
    page.appendChild(items[i].node);
    comps.push(asComponent(items[i].node, items[i].name));
  }
  var set = figma.combineAsVariants(comps, page);
  set.name = title;
  if (description) set.description = description;
  set.layoutMode = "HORIZONTAL";
  set.itemSpacing = 24;
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
  // WRAP requires a bounded main axis, so the width is fixed before it is set.
  set.primaryAxisSizingMode = "FIXED";
  set.counterAxisSizingMode = "AUTO";
  set.resize(Math.min(1200, Math.max(320, set.width)), set.height);
  set.layoutWrap = "WRAP";
  set.counterAxisSpacing = 24;
  set.fills = [];
  set.strokes = [paint("line")];
  set.strokeWeight = 1;
  set.dashPattern = [6, 4];
  set.cornerRadius = 16;
  return set;
}

/** A single component (no variants) with a caption. */
function singleComponent(page, name, node, description) {
  page.appendChild(node);
  var comp = asComponent(node, name);
  if (description) comp.description = description;
  return comp;
}

async function buildComponentLibrary(page) {
  var y = 0;
  var x = 0;
  var rowHeight = 0;
  var COLUMN = 1320;

  var place = function (node, label) {
    var wrap = F(label, { dir: "v", gap: 10 });
    setMode(wrap, "Light");
    page.appendChild(wrap);
    add(wrap, T(label, { size: 16, weight: "black", color: "ink" }));
    wrap.appendChild(node);
    wrap.x = x;
    wrap.y = y;
    rowHeight = Math.max(rowHeight, wrap.height);
    x += wrap.width + 64;
    if (x > COLUMN) {
      x = 0;
      y += rowHeight + 64;
      rowHeight = 0;
    }
    return wrap;
  };

  /* Button — the one component with a real variant matrix. */
  var buttonItems = [];
  var variants = ["primary", "secondary", "ghost", "danger"];
  var sizes = ["md", "sm"];
  var states = ["default", "disabled"];
  for (var v = 0; v < variants.length; v++) {
    for (var s = 0; s < sizes.length; s++) {
      for (var st = 0; st < states.length; st++) {
        buttonItems.push({
          name: "Variant=" + variants[v] + ", Size=" + sizes[s] + ", State=" + states[st],
          node: button(
            variants[v] === "danger" ? "Delete" : variants[v] === "ghost" ? "Skip" : "Start now",
            { variant: variants[v], size: sizes[s], disabled: states[st] === "disabled" },
          ),
        });
      }
    }
  }
  place(variantSet(page, "Button", buttonItems, "src/ui/kit.tsx · Button — capsule, font-black, active:scale-[0.97]"), "Button");

  /* Pill */
  var pillItems = [
    { name: "Tone=accent", node: pill("Active", "accent") },
    { name: "Tone=muted", node: pill("Optional", "muted") },
    { name: "Tone=done", node: pill("Today", "done") },
    { name: "Tone=danger", node: pill("Missed", "danger") },
  ];
  place(variantSet(page, "Pill", pillItems, "src/ui/kit.tsx · Pill — 10px black uppercase on a 24%-alpha tint"), "Pill");

  /* Segmented */
  var segItems = [
    { name: "Items=2, Active=0", node: segmented(["Sign in", "Create account"], 0, { w: 320 }) },
    { name: "Items=3, Active=1", node: segmented(["Auto", "Light", "Dark"], 1, { w: 320 }) },
    { name: "Items=4, Active=0", node: segmented(["Overview", "Plans", "Days", "Exercises"], 0, { w: 320 }) },
  ];
  place(variantSet(page, "Segmented", segItems, "src/ui/kit.tsx · Segmented"), "Segmented");

  /* Toggle */
  place(variantSet(page, "Toggle", [
    { name: "Checked=true", node: toggle(true) },
    { name: "Checked=false", node: toggle(false) },
  ], "src/ui/kit.tsx · Toggle"), "Toggle");

  /* Inputs */
  var inputs = F("inputs", { dir: "v", gap: 16, w: 320 });
  add(inputs, singleComponent(page, "TextField/filled", textField("alex@example.com"), "src/ui/kit.tsx · TextField"));
  add(inputs, singleComponent(page, "TextField/placeholder", textField("you@example.com", { placeholder: true })));
  add(inputs, singleComponent(page, "TextField/focus", textField("ABC-123", { focus: true })));
  add(inputs, singleComponent(page, "NumberField", numberField(52.5, { suffix: "kg" }), "src/ui/kit.tsx · NumberField"));
  add(inputs, singleComponent(page, "NumberField/empty", numberField(null, { suffix: "reps", placeholder: "8" })));
  add(inputs, singleComponent(page, "Field", field("Display name", textField("Alex"), "Shown to your coach")));
  place(inputs, "Inputs");

  /* RpeSlider */
  var rpe = F("rpe", { dir: "v", gap: 20, w: 340, pad: 16, fill: "surface", radius: 16, stroke: "line" });
  add(rpe, singleComponent(page, "RpeSlider/rated", rpeSlider(8, "2 reps left", { target: 7, trackW: 300 }), "src/ui/kit.tsx · RpeSlider — 0–10 in half steps, null renders unrated"));
  add(rpe, singleComponent(page, "RpeSlider/unrated", rpeSlider(null, "Not rated", { trackW: 300 })));
  place(rpe, "Effort");

  /* Progress */
  var progress = F("progress", { dir: "h", gap: 24, align: "CENTER" });
  add(progress, singleComponent(page, "ProgressRing/72", progressRing(0.68, { label: "4/6", sublabel: "week" }), "src/ui/kit.tsx · ProgressRing"));
  add(progress, singleComponent(page, "ProgressRing/44", progressRing(0.4, { size: 44, stroke: 6 })));
  add(progress, singleComponent(page, "ProgressRing/empty", progressRing(0, { size: 44, stroke: 6 })));
  add(progress, singleComponent(page, "ProgressBar", progressBar(0.62, { w: 180 }), "src/ui/kit.tsx · ProgressBar"));
  place(progress, "Progress");

  /* Tiles and rows */
  var tiles = F("tiles", { dir: "h", gap: 12, w: 480 });
  add(tiles, singleComponent(page, "StatTile/plain", statTile("12,480", "kg lifted"), "src/ui/kit.tsx · StatTile"));
  add(tiles, singleComponent(page, "StatTile/icon", statTile("18", "sessions", { icon: "flame", tint: "accent" })));
  add(tiles, singleComponent(page, "IconTile", iconTile("🏋️", "accent"), "src/ui/kit.tsx · IconTile"));
  place(tiles, "Tiles");

  var rows = F("rows", { dir: "v", gap: 0, w: 360, fill: "surface", radius: 16, stroke: "line" });
  add(rows, singleComponent(page, "SettingRow/chevron", settingRow("Colour", { subtitle: "Denim" }), "src/ui/kit.tsx · SettingRow"));
  add(rows, singleComponent(page, "SettingRow/toggle", settingRow("Share logs with my coach", { right: toggle(true) })));
  add(rows, singleComponent(page, "SettingRow/segmented", settingRow("Theme", { subtitle: "Follows your device", right: segmented(["Auto", "Light", "Dark"], 0, { w: 180, compact: true }) })));
  place(rows, "Setting rows");

  /* Cards and structure */
  var structure = F("structure", { dir: "v", gap: 16, w: 360 });
  add(structure, singleComponent(page, "ScreenTitle", screenTitle({
    date: "Thursday, 13 August", title: "Evening, Alex", quote: "Consistency beats intensity",
  }), "src/ui/kit.tsx · ScreenTitle"));
  add(structure, singleComponent(page, "SectionHeader", sectionHeader("Recent records", null, "trophy"), "src/ui/kit.tsx · SectionHeader"));
  var sample = card({ children: [
    T("Upper A", { size: 16, weight: "black", color: "ink" }),
    T("3/5 · strength · Thu 13 Aug", { size: 12, weight: "bold", color: "muted" }),
  ] });
  add(structure, singleComponent(page, "Card", sample, "src/ui/kit.tsx · Card"));
  add(structure, singleComponent(page, "EmptyState", emptyState("No plan yet", "Build your own plan or sync one from your coach.", button("Go to plans", { size: "sm" })), "src/ui/kit.tsx · EmptyState"));
  place(structure, "Structure");

  /* Overlays */
  var overlays = F("overlays", { dir: "v", gap: 20, w: 400 });
  add(overlays, singleComponent(page, "Toast", toast("Saved — 3 sets logged"), "src/ui/kit.tsx · Toast"));
  add(overlays, singleComponent(page, "ActionDialog", actionDialog(
    "Start workout?",
    "We'll run a timer while you log. Your coach sees the session when it's shared.",
    [
      { label: "Start workout", tone: "primary" },
      { label: "Start another day's workout…" },
      { label: "Just log without a timer" },
    ],
  ), "src/ui/kit.tsx · ActionDialog"));
  add(overlays, singleComponent(page, "Spinner", spinner(32), "src/ui/kit.tsx · Spinner"));
  place(overlays, "Overlays");

  /* Navigation */
  var nav = F("nav", { dir: "v", gap: 16 });
  add(nav, singleComponent(page, "TabBar/athlete", tabBar(ATHLETE_TABS, "home"), "src/ui/kit.tsx · TabBar — athlete"));
  add(nav, singleComponent(page, "TabBar/coach", tabBar(COACH_TABS, "athletes"), "src/ui/kit.tsx · TabBar — coach"));
  add(nav, singleComponent(page, "StatusBar", statusBar()));
  place(nav, "Navigation");
}

/* ==== 40-blocks.js ================================================ */
/* ------------------------------------------------------------------
 * Composite blocks — the recurring furniture of the product, one level
 * above the kit: the day's segment, a logging card, a plan row, an
 * athlete row, the analytics charts.
 * ------------------------------------------------------------------ */

/** Back-date control on Home — arrows either side of a searchable date. */
function dateSwitcher(label, isToday) {
  var bar = F("DateSwitcher", {
    dir: "h", gap: 4, pad: 4, radius: RADIUS.pill, fill: "surface", stroke: "line",
    align: "CENTER", w: "fill",
  });
  var prev = F("prev", { dir: "h", w: 32, h: 32, radius: 16, justify: "CENTER", align: "CENTER" });
  add(prev, icon("back", 16, "muted"));
  add(bar, prev);

  var mid = F("search", { dir: "h", gap: 8, w: "fill", justify: "CENTER", align: "CENTER", pad: { t: 6, b: 6 } });
  add(mid, icon("search", 16, "muted"));
  add(mid, T(label, { size: 14, weight: "black", color: "ink" }));
  add(bar, mid);

  if (!isToday) {
    var today = F("today", { dir: "h", radius: RADIUS.pill, pad: { l: 12, r: 12, t: 4, b: 4 }, align: "CENTER" });
    add(today, T("Today", { size: 12, weight: "black", color: "accent" }));
    add(bar, today);
  }

  var next = F("next", { dir: "h", w: 32, h: 32, radius: 16, justify: "CENTER", align: "CENTER", opacity: isToday ? 0.3 : 1 });
  add(next, icon("chevron", 16, "muted"));
  add(bar, next);
  return bar;
}

/** The "logging a past day" notice. */
function lateLogNotice(dayLabel) {
  var n = F("late log", {
    dir: "h", gap: 8, pad: { l: 12, r: 12, t: 8, b: 8 }, radius: RADIUS.field,
    fill: "surface", align: "CENTER", w: "fill",
  });
  n.strokes = [paint("line")];
  n.strokeWeight = 1;
  n.dashPattern = [5, 4];
  add(n, icon("calendarClock", 16, "accent"));
  var text = F("t", { dir: "h", gap: 3, w: "fill", wrap: true });
  add(text, T("Logging " + dayLabel, { size: 12, weight: "bold", color: "ink" }));
  add(text, T("— saved as a late log", { size: 12, weight: "semibold", color: "muted" }));
  add(n, text);
  add(n, T("Back to today", { size: 12, weight: "black", color: "accent" }));
  return n;
}

/** The day heading on Home: icon tile, title, meta, optional action. */
function dayHeading(emoji, tint, title, meta, action) {
  var row = F("day heading", { dir: "h", gap: 12, w: "fill", align: "CENTER", pad: { t: 8 } });
  add(row, iconTile(emoji, tint));
  var text = F("t", { dir: "v", gap: 1, w: "fill" });
  add(text, T(title, { size: 17, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(text, T(meta, { size: 12, weight: "bold", color: "muted", w: "fill" }));
  add(row, text);
  if (action) add(row, action);
  return row;
}

/** One scheduled block of the day, with its exercises. */
function segmentBlock(o) {
  var s = F("SegmentBlock", {
    dir: "v", gap: 12, pad: 12, radius: RADIUS.card, fill: "surface",
    fillOpacity: 0.55, stroke: o.tint || "accent", strokeOpacity: 0.22, w: "fill",
  });

  var head = F("head", { dir: "h", gap: 12, w: "fill", align: "CENTER" });
  var text = F("t", { dir: "v", gap: 2, w: "fill" });
  var titleRow = F("title", { dir: "h", gap: 8, align: "CENTER", w: "fill" });
  add(titleRow, T(o.title, { size: 16, weight: "black", color: "ink" }));
  if (o.pills) {
    for (var p = 0; p < o.pills.length; p++) add(titleRow, pill(o.pills[p].label, o.pills[p].tint));
  }
  add(text, titleRow);
  add(text, T(o.meta, { size: 12, weight: "bold", color: "muted", w: "fill" }));
  add(head, text);
  if (o.ratio !== undefined) add(head, progressRing(o.ratio, { size: 44, stroke: 6, color: o.tint || "accent" }));
  if (o.action) add(head, o.action);
  add(s, head);

  if (o.exercises) add(s, o.exercises);
  return s;
}

/**
 * A logging card — the busiest surface in the app: the exercise, what the
 * coach prescribed, a set grid and the effort slider.
 */
function exerciseLogCard(o) {
  var c = F("ExerciseLogCard", {
    dir: "v", gap: 10, pad: 12, radius: RADIUS.card, fill: "surface", stroke: "line", w: "fill",
  });

  var head = F("head", { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(head, iconTile(o.emoji || "🏋️", o.tint || "accent", 34));
  var text = F("t", { dir: "v", gap: 1, w: "fill" });
  add(text, T(o.name, { size: 15, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(text, T(o.target, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(head, text);
  if (o.done) add(head, icon("check", 18, "done"));
  add(head, icon("chevronDown", 16, "muted"));
  add(c, head);

  if (o.sets) {
    var grid = F("sets", { dir: "v", gap: 6, w: "fill" });
    var header = F("cols", { dir: "h", gap: 6, w: "fill" });
    var cols = o.columns || ["Set", "kg", "Reps"];
    for (var h = 0; h < cols.length; h++) {
      add(header, T(cols[h], {
        size: 10, weight: "black", color: "muted", upper: true, tracking: 3,
        w: h === 0 ? 30 : "fill",
      }));
    }
    add(grid, header);

    for (var i = 0; i < o.sets.length; i++) {
      var row = F("set " + (i + 1), { dir: "h", gap: 6, w: "fill", align: "CENTER" });
      add(row, T(String(i + 1), { size: 13, weight: "black", color: "muted", w: 30 }));
      for (var v = 0; v < o.sets[i].length; v++) {
        add(row, numberField(o.sets[i][v], { placeholder: "—" }));
      }
      add(grid, row);
    }
    add(c, grid);
  }

  if (o.rpe !== undefined) add(c, rpeSlider(o.rpe, o.rpeMeaning || "2 reps left", { target: o.rpeTarget, trackW: 300 }));

  if (o.footer !== false) {
    var foot = F("foot", { dir: "h", gap: 8, w: "fill" });
    add(foot, button("Add set", { size: "sm", variant: "secondary", icon: "plus" }));
    add(foot, button("Save", { size: "sm" }));
    add(c, foot);
  }
  return c;
}

/** A grouped list header used all over Plans. */
function listGroup(title, subtitle, emoji, count, countNoun, tint) {
  var g = F("group", { dir: "h", gap: 10, w: "fill", align: "CENTER", pad: { t: 8, b: 4 } });
  add(g, iconTile(emoji, tint || "muted", 32));
  var text = F("t", { dir: "v", gap: 1, w: "fill" });
  add(text, T(title, { size: 14, weight: "black", color: "ink" }));
  if (subtitle) add(text, T(subtitle, { size: 11, weight: "semibold", color: "muted", w: "fill" }));
  add(g, text);
  if (count !== undefined) add(g, pill(count + " " + countNoun + (count === 1 ? "" : "s"), tint || "muted"));
  return g;
}

/** A plan row — name, dates, status pill, actions. */
function planCard(o) {
  var actions = F("actions", { dir: "h", gap: 8, w: "fill", pad: { t: 4 } });
  if (o.actions) {
    for (var i = 0; i < o.actions.length; i++) {
      add(actions, button(o.actions[i].label, { size: "sm", variant: o.actions[i].variant || "secondary" }));
    }
  }
  var head = F("head", { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  var text = F("t", { dir: "v", gap: 2, w: "fill" });
  add(text, T(o.name, { size: 15, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(text, T(o.meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(head, text);
  if (o.status) add(head, pill(o.status.label, o.status.tint));

  return card({
    name: "PlanCard/" + o.name,
    gap: 6,
    pad: 12,
    children: o.actions ? [head, actions] : [head],
  });
}

/** An athlete row on the coach's list. */
function athleteRow(o) {
  var head = F("head", { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(head, iconTile(o.emoji || "🙂", o.tint || "accent", 38));
  var text = F("t", { dir: "v", gap: 2, w: "fill" });
  var nameRow = F("n", { dir: "h", gap: 6, align: "CENTER", w: "fill" });
  add(nameRow, T(o.name, { size: 15, weight: "black", color: "ink" }));
  if (o.pills) {
    for (var i = 0; i < o.pills.length; i++) add(nameRow, pill(o.pills[i].label, o.pills[i].tint));
  }
  add(text, nameRow);
  add(text, T(o.meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(head, text);
  if (o.ratio !== undefined) add(head, progressRing(o.ratio, { size: 40, stroke: 5 }));
  add(head, icon("chevron", 16, "muted"));
  return card({ name: "Athlete/" + o.name, pad: 12, children: [head] });
}

/* ---------- analytics ---------- */

/** A column chart. `values` are 0..1 of the tallest bar. */
function barChart(values, o) {
  o = o || {};
  var h = o.h || 96;
  var wrap = F("BarChart", { dir: "h", gap: o.gap || 6, h: h, align: "MAX", w: "fill", justify: "SPACE_BETWEEN" });
  for (var i = 0; i < values.length; i++) {
    var col = F("col", { dir: "v", gap: 4, w: "fill", align: "CENTER", justify: "MAX" });
    var barH = Math.max(3, values[i] * (h - 16));
    var bar = R("bar", 10, barH, {
      fill: o.color || "accent", radius: 4,
      fillOpacity: o.dim && o.dim.indexOf(i) >= 0 ? 0.28 : 1,
    });
    bar.__w = "fill";
    add(col, bar);
    if (o.labels) add(col, T(o.labels[i], { size: 9, weight: "bold", color: "muted" }));
    add(wrap, col);
  }
  return wrap;
}

/**
 * A sparkline-style trend, drawn as a polyline over a baseline.
 *
 * As with progressBar, "fill" still needs a pixel width to plot against, so
 * it falls back to the width a card's content column actually gets.
 */
function lineChart(points, o) {
  o = o || {};
  var w = typeof o.w === "number" ? o.w : DEVICE.w - DEVICE.gutter * 2 - 32;
  var h = o.h || 90;
  var wrap = F("LineChart", { dir: "none", w: o.w === "fill" ? undefined : w, h: h });
  if (o.w === "fill") {
    wrap.resize(w, h);
    wrap.__w = "fill";
  }

  var baseline = R("baseline", w, 1, { fill: "line" });
  wrap.appendChild(baseline);
  baseline.x = 0;
  baseline.y = h - 1;

  var d = "";
  for (var i = 0; i < points.length; i++) {
    var px = (i / (points.length - 1)) * w;
    var py = h - 8 - points[i] * (h - 20);
    d += (i === 0 ? "M " : " L ") + px.toFixed(1) + " " + py.toFixed(1);
  }
  var line = figma.createVector();
  line.name = "trend";
  line.vectorPaths = [{ windingRule: "NONE", data: d }];
  line.fills = [];
  line.strokes = [paint(o.color || "accent")];
  line.strokeWeight = 2.5;
  line.strokeCap = "ROUND";
  line.strokeJoin = "ROUND";
  wrap.appendChild(line);
  line.x = 0;
  line.y = 0;

  var last = E("head", 8, { fill: o.color || "accent", stroke: "surface", strokeWeight: 2 });
  wrap.appendChild(last);
  last.x = w - 4;
  last.y = h - 8 - points[points.length - 1] * (h - 20) - 4;
  return wrap;
}

/** A dimension score ring — Strength, Endurance, and the rest. */
function dimensionCard(label, score, token, delta) {
  var c = F("Dimension/" + label, {
    dir: "v", gap: 6, pad: 12, radius: RADIUS.field, fill: "inset", align: "CENTER", w: "fill",
  });
  add(c, progressRing(score / 100, { size: 56, stroke: 6, color: token, label: String(score) }));
  add(c, T(label, { size: 11, weight: "black", color: "ink", align: "CENTER", w: "fill" }));
  if (delta) {
    add(c, T(delta, { size: 10, weight: "black", color: delta.charAt(0) === "+" ? "done" : "muted", align: "CENTER", w: "fill" }));
  }
  return c;
}

/** Muscle balance — a labelled horizontal bar. */
function balanceRow(label, ratio, token) {
  var row = F("balance/" + label, { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(row, T(label, { size: 12, weight: "black", color: "ink", w: 74 }));
  add(row, progressBar(ratio, { color: token, w: 180 }));
  add(row, T(Math.round(ratio * 100) + "%", { size: 11, weight: "black", color: "muted" }));
  return row;
}

/** A personal-record line. */
function recordRow(name, value, when) {
  var row = F("record/" + name, { dir: "h", gap: 10, w: "fill", align: "CENTER", pad: { t: 6, b: 6 } });
  add(row, icon("trophy", 16, "gold"));
  var text = F("t", { dir: "v", gap: 1, w: "fill" });
  add(text, T(name, { size: 13, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(text, T(when, { size: 10, weight: "semibold", color: "muted" }));
  add(row, text);
  add(row, pill(value, "accent"));
  return row;
}

/** The week strip — seven day chips with their state. */
function weekStrip(days) {
  var strip = F("WeekStrip", { dir: "h", gap: 6, w: "fill", justify: "SPACE_BETWEEN" });
  for (var i = 0; i < days.length; i++) {
    var d = days[i];
    var cell = F(d.label, { dir: "v", gap: 4, align: "CENTER", w: "fill" });
    add(cell, T(d.label, { size: 10, weight: "black", color: "muted", upper: true, align: "CENTER", w: "fill" }));
    var dot = F("state", { dir: "h", w: 32, h: 32, radius: 12, justify: "CENTER", align: "CENTER" });
    if (d.state === "done") {
      setFills(dot, "accent");
      add(dot, icon("check", 16, "white"));
    } else if (d.state === "today") {
      setFills(dot, "accent", 0.14);
      setStroke(dot, "accent", 2);
      add(dot, T(d.date, { size: 12, weight: "black", color: "accent" }));
    } else if (d.state === "rest") {
      setFills(dot, "inset");
      add(dot, T("·", { size: 14, weight: "black", color: "muted" }));
    } else {
      setFills(dot, "inset");
      add(dot, T(d.date, { size: 12, weight: "black", color: "muted" }));
    }
    add(cell, dot);
    add(strip, cell);
  }
  return strip;
}

/** A row in the coach↔athlete activity thread. */
function activityRow(o) {
  var row = F("activity", { dir: "h", gap: 10, w: "fill", pad: { t: 8, b: 8 } });
  add(row, iconTile(o.emoji || "💬", o.tint || "muted", 30));
  var text = F("t", { dir: "v", gap: 2, w: "fill" });
  var head = F("h", { dir: "h", gap: 6, align: "CENTER", w: "fill" });
  add(head, T(o.who, { size: 12, weight: "black", color: "ink" }));
  add(head, T(o.when, { size: 10, weight: "semibold", color: "muted" }));
  add(text, head);
  add(text, T(o.body, { size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17 }));
  add(row, text);
  return row;
}

/** A dense spreadsheet row — the batch logger and the session tables. */
function gridRow(cells, o) {
  o = o || {};
  var row = F("row", { dir: "h", gap: 4, w: "fill", align: "CENTER", pad: { t: 4, b: 4 } });
  for (var i = 0; i < cells.length; i++) {
    var c = cells[i];
    if (o.header) {
      add(row, T(c, { size: 9, weight: "black", color: "muted", upper: true, tracking: 3, w: i === 0 ? 96 : "fill" }));
    } else if (i === 0) {
      add(row, T(c, { size: 12, weight: "black", color: "ink", w: 96, truncate: true }));
    } else {
      var cell = F("cell", { dir: "h", h: 30, radius: 8, fill: "inset", stroke: "line", justify: "CENTER", align: "CENTER", w: "fill" });
      add(cell, T(c === null ? "—" : String(c), {
        size: 12, weight: "black", color: c === null ? "muted" : "ink", opacity: c === null ? 0.5 : 1,
      }));
      add(row, cell);
    }
  }
  return row;
}

/* ==== 50-athlete.js =============================================== */
/* ------------------------------------------------------------------
 * The athlete journey, end to end.
 *
 * Grouped by tab in the order the tab bar presents them, with the shared
 * auth path first. Every frame registers itself in SCREENS so 70-flow.js
 * can draw the arrows and set the prototype links.
 * ------------------------------------------------------------------ */

/** id -> frame, for the flow wiring pass. */
var SCREENS = {};

/** Register and return a screen frame. */
function reg(id, frame) {
  frame.name = id;
  SCREENS[id] = frame;
  return frame;
}

/**
 * Lay screens out as labelled rows on a page.
 * `groups` is [{ label, note, ids }] — ids already present in SCREENS.
 */
function layoutRows(page, groups, startY) {
  var GAP_X = 56;
  var GAP_Y = 132;
  var y = startY || 0;

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];

    var head = F("— " + group.label, { dir: "v", gap: 4 });
    setMode(head, "Light");
    add(head, T(group.label, { size: 28, weight: "black", color: "ink" }));
    if (group.note) add(head, T(group.note, { size: 14, weight: "semibold", color: "muted", w: 720, lineHeight: 19 }));
    page.appendChild(head);
    head.x = 0;
    head.y = y;
    y += head.height + 24;

    var x = 0;
    for (var i = 0; i < group.ids.length; i++) {
      var frame = SCREENS[group.ids[i]];
      if (!frame) continue;
      page.appendChild(frame);
      frame.x = x;
      frame.y = y;

      var caption = T(group.ids[i], { size: 13, weight: "black", color: "muted" });
      page.appendChild(caption);
      caption.x = x;
      caption.y = y - 24;

      x += frame.width + GAP_X;
    }
    y += DEVICE.h + GAP_Y;
  }
  return y;
}

/** Sugar: append to a screen's content column. */
function col(screenNode, children) {
  add(screenNode.__column, children);
  return screenNode;
}

/** Drop an overlay (sheet, dialog, scrim) on top of a screen. */
function overlay(screenNode, node, o) {
  o = o || {};
  screenNode.appendChild(node);
  node.x = o.x === undefined ? (DEVICE.w - node.width) / 2 : o.x;
  node.y = o.y === undefined ? DEVICE.h - node.height : o.y;
  return node;
}

/* ================= shared entry ================= */

function buildEntryScreens() {
  /* Loading */
  var loading = reg("Loading", screen("Loading", { chrome: true }));
  var spin = spinner(36);
  loading.appendChild(spin);
  spin.x = (DEVICE.w - 36) / 2;
  spin.y = (DEVICE.h - 36) / 2;

  /* Auth — sign in. The coach portal's own sign-in is built alongside the
     coach screens, since that is the page it gets laid out on. */
  var signin = reg("Auth · Sign in", authScreen("signin", "athlete"));
  var signup = reg("Auth · Create account", authScreen("signup", "athlete"));

  /* Verify email */
  var verify = reg("Verify email", screen("Verify email"));
  var vCard = card({
    pad: 20,
    gap: 6,
    children: [
      T("Confirm your email", { size: 20, weight: "black", color: "ink", align: "CENTER", w: "fill" }),
      T("We sent a link to alex@example.com. Open it and you're in — nothing else to do.", {
        size: 14, weight: "semibold", color: "muted", align: "CENTER", w: "fill", lineHeight: 19,
      }),
      button("I've confirmed it", { full: true }),
      button("Send it again", { variant: "secondary", full: true }),
      button("Use a different account", { variant: "ghost", full: true }),
    ],
  });
  var vWrap = F("center", { dir: "v", w: "fill", pad: { t: 220 } });
  add(vWrap, vCard);
  col(verify, vWrap);

  /* Role gate */
  var gate = reg("Role gate", screen("Role gate"));
  var gCard = card({
    pad: 20,
    gap: 6,
    children: [
      T("Athlete side", { size: 20, weight: "black", color: "ink" }),
      T("Turn on your athlete profile to follow plans and log your own training.", {
        size: 14, weight: "semibold", color: "muted", w: "fill", lineHeight: 19,
      }),
      button("Enable athlete profile", { full: true }),
      button("Back to the coach portal", { variant: "secondary", full: true }),
    ],
  });
  var gWrap = F("center", { dir: "v", w: "fill", pad: { t: 240 } });
  add(gWrap, gCard);
  col(gate, gWrap);

  return [loading, signin, signup, verify, gate];
}

function authScreen(mode, role) {
  var s = screen("Auth", { gap: 0 });
  var wrap = F("center", { dir: "v", gap: 16, w: "fill", pad: { t: 120 } });

  var brand = F("brand", { dir: "v", gap: 8, w: "fill", align: "CENTER" });
  add(brand, iconTile("🐜", "accent", 64));
  add(brand, T("AntRep" + (role === "coach" ? " Coach" : ""), { size: 30, weight: "black", color: "ink" }));
  add(brand, T(
    role === "coach" ? "Build plans, track every athlete." : "Follow your plan. Log every rep.",
    { size: 14, weight: "semibold", color: "muted" },
  ));
  add(wrap, brand);

  var fields = [];
  if (mode === "signup") fields.push(field("Your name", textField("Alex", { placeholder: true })));
  fields.push(field("Email", textField("you@example.com", { placeholder: true })));
  fields.push(field("Password", textField(
    mode === "signup" ? "At least 8 characters" : "••••••••",
    { placeholder: mode === "signup" },
  )));

  var form = card({
    pad: 20,
    gap: 14,
    children: [segmented(["Sign in", "Create account"], mode === "signin" ? 0 : 1)]
      .concat(fields)
      .concat([button(mode === "signin" ? "Sign in" : "Create account", { full: true })]),
  });
  add(wrap, form);

  add(wrap, T(
    role === "coach" ? "Athlete instead? Open antrep.app" : "Coaching too? Open antrep.app/coach",
    { size: 12, weight: "bold", color: "muted", align: "CENTER", w: "fill" },
  ));
  col(s, wrap);
  return s;
}

/* ================= Home ================= */

function buildHomeScreens() {
  /* Home — a normal training day */
  var home = reg("Home · Today", screen("Home"));
  col(home, screenTitle({
    date: "Thursday, 13 August",
    title: "Evening, Alex",
    quote: "Consistency beats intensity",
  }));
  col(home, dateSwitcher("Today", true));
  col(home, dayHeading("🏋️", "accent", "Upper A · Push", "Thu · 13 August · today · 5 exercises",
    button("Another day", { size: "sm", variant: "secondary", icon: "calendarClock" })));
  col(home, segmentBlock({
    title: "Upper A",
    meta: "2/5 · STRENGTH · Thu 13 Aug",
    ratio: 0.4,
    exercises: [
      exerciseLogCard({
        name: "Bench press", target: "4 × 8 · 60kg · RPE 8", emoji: "🏋️", done: true,
        sets: [[60, 8], [60, 8], [62.5, 7]], rpe: 8, rpeTarget: 8, footer: false,
      }),
      exerciseLogCard({ name: "Incline dumbbell press", target: "3 × 10 · 22.5kg", emoji: "💪", footer: false }),
      exerciseLogCard({ name: "Cable fly", target: "3 × 12", emoji: "🔗", footer: false }),
    ],
    action: button("Start now", { size: "sm" }),
  }));
  col(home, extraWorkBlock());
  attachTabBar(home, ATHLETE_TABS, "home");

  /* Home — rest day */
  var rest = reg("Home · Rest day", screen("Home rest"));
  col(rest, screenTitle({ date: "Sunday, 17 August", title: "Morning, Alex", quote: "Rest is part of the work" }));
  col(rest, dateSwitcher("Today", true));
  col(rest, dayHeading("😴", "muted", "Rest day", "Sun · 17 August · today · 0 exercises"));
  col(rest, emptyState(
    "Rest day",
    "Nothing scheduled. You can still log extra work, or train another day's workout.",
    button("Train another day"),
  ));
  col(rest, extraWorkBlock());
  attachTabBar(rest, ATHLETE_TABS, "home");

  /* Home — no plan at all */
  var noPlan = reg("Home · No plan", screen("Home empty"));
  col(noPlan, screenTitle({ date: "Thursday, 13 August", title: "Evening, Alex", quote: "Start where you are" }));
  col(noPlan, dateSwitcher("Today", true));
  col(noPlan, dayHeading("📋", "muted", "No plan scheduled", "Thu · 13 August · today · 0 exercises"));
  col(noPlan, emptyState(
    "No plan yet",
    "Build your own plan or sync one from your coach — or just log an exercise below.",
    button("Go to plans"),
  ));
  col(noPlan, extraWorkBlock());
  attachTabBar(noPlan, ATHLETE_TABS, "home");

  /* Home — live workout */
  var live = reg("Home · Workout live", screen("Home live"));
  col(live, screenTitle({ date: "Thursday, 13 August", title: "Evening, Alex" }));
  var livePanel = card({
    tint: "accent",
    gap: 10,
    children: (function () {
      var head = F("h", { dir: "h", gap: 10, w: "fill", align: "CENTER" });
      add(head, iconTile("⏱️", "accent", 40));
      var t = F("t", { dir: "v", gap: 1, w: "fill" });
      add(t, T("Upper A · running", { size: 15, weight: "black", color: "ink" }));
      add(t, T("Started 19:04 · 3 of 5 done", { size: 11, weight: "bold", color: "muted" }));
      add(head, t);
      add(head, T("24:18", { size: 22, weight: "black", color: "accent" }));
      var actions = F("a", { dir: "h", gap: 8, w: "fill" });
      add(actions, button("Pause", { size: "sm", variant: "secondary", icon: "pause", full: true }));
      add(actions, button("Finish", { size: "sm", icon: "stop", full: true }));
      return [head, progressBar(0.6, { w: "fill" }), actions];
    })(),
  });
  col(live, livePanel);
  col(live, dateSwitcher("Today", true));
  col(live, segmentBlock({
    title: "Upper A",
    meta: "3/5 · STRENGTH · Thu 13 Aug",
    ratio: 0.6,
    exercises: [
      exerciseLogCard({
        name: "Overhead press", target: "4 × 6 · 40kg · RPE 8", emoji: "🏋️",
        sets: [[40, 6], [40, 6], [null, null]], rpe: null, rpeMeaning: "Not rated",
      }),
    ],
  }));
  attachTabBar(live, ATHLETE_TABS, "home");

  /* Home — back-dated */
  var backdate = reg("Home · Late log", screen("Home backdate"));
  col(backdate, screenTitle({ date: "Thursday, 13 August", title: "Evening, Alex" }));
  col(backdate, dateSwitcher("Mon 10 August", false));
  col(backdate, lateLogNotice("Monday, 10 August"));
  col(backdate, dayHeading("🦵", "#7651d3", "Lower A · Legs", "Mon · 10 August · 4 exercises"));
  col(backdate, segmentBlock({
    title: "Lower A",
    tint: "#7651d3",
    meta: "0/4 · STRENGTH · Mon 10 Aug",
    ratio: 0,
    exercises: [
      exerciseLogCard({ name: "Back squat", target: "5 × 5 · 90kg", emoji: "🦵", tint: "#7651d3", footer: false }),
      exerciseLogCard({ name: "Romanian deadlift", target: "3 × 8 · 70kg", emoji: "🦵", tint: "#7651d3", footer: false }),
    ],
  }));
  attachTabBar(backdate, ATHLETE_TABS, "home");

  /* Overlays over Home */
  var startDialog = reg("Home · Start dialog", cloneOverlayOf(home, "Home start dialog"));
  overlay(startDialog, scrim(), { x: 0, y: 0 });
  overlay(startDialog, actionDialog(
    "Start workout?",
    "We'll run a timer while you log. Your coach sees the session when it's shared.",
    [
      { label: "Start workout", tone: "primary" },
      { label: "Start another day's workout…" },
      { label: "Just log without a timer" },
    ],
  ), { y: DEVICE.h - 330 });

  var countdown = reg("Home · Countdown", screen("Countdown"));
  var cScrim = R("veil", DEVICE.w, DEVICE.h, { fill: "bg", fillOpacity: 0.95 });
  countdown.appendChild(cScrim);
  cScrim.x = 0;
  cScrim.y = 0;
  var three = T("3", { size: 92, weight: "black", color: "accent" });
  countdown.appendChild(three);
  three.x = (DEVICE.w - three.width) / 2;
  three.y = (DEVICE.h - three.height) / 2;

  var dateSheet = reg("Home · Date search", cloneOverlayOf(home, "Home date search"));
  overlay(dateSheet, scrim(), { x: 0, y: 0 });
  overlay(dateSheet, sheetPanel("Go to a date", [
    field("Pick a date", (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, textField("2026-08-13"));
      add(r, button("Go"));
      return r;
    })(), "Anything up to today — past days save as a late log"),
    sectionHeader("Jump to"),
    chipRow(["Today", "Yesterday", "2 days ago", "A week ago"]),
    sectionHeader("Days you trained"),
    chipRow(["Wed 12 Aug", "Mon 10 Aug", "Sat 8 Aug", "Thu 6 Aug", "Tue 4 Aug"]),
  ]));

  var makeup = reg("Home · Another day", cloneOverlayOf(home, "Home makeup"));
  overlay(makeup, scrim(), { x: 0, y: 0 });
  overlay(makeup, sheetPanel("Train another day", [
    T("Days from your plan you haven't logged yet. Pick one and it runs as today's workout.", {
      size: 13, weight: "semibold", color: "muted", w: "fill", lineHeight: 18,
    }),
    makeupRow("Lower A", "Monday 10 August · 4 exercises", "🦵", "#7651d3"),
    makeupRow("Upper B", "Tuesday 11 August · 5 exercises", "💪", "accent"),
    makeupRow("Conditioning", "Wednesday 12 August · 3 exercises", "🏃", "#18865f"),
  ]));

  return [home, rest, noPlan, live, backdate, startDialog, countdown, dateSheet, makeup];
}

/** A fresh screen that reuses a built one as its backdrop. */
function cloneOverlayOf(source, name) {
  var copy = source.clone();
  copy.name = name;
  return copy;
}

function extraWorkBlock() {
  var s = F("Extra work", { dir: "v", gap: 8, pad: 12, radius: RADIUS.card, w: "fill" });
  s.strokes = [paint("line")];
  s.strokeWeight = 1;
  s.dashPattern = [6, 5];
  var head = F("h", { dir: "h", gap: 8, w: "fill", align: "CENTER" });
  add(head, icon("plus", 16, "muted"));
  var title = F("t", { dir: "h", gap: 4, w: "fill", align: "CENTER" });
  add(title, T("Extra work", { size: 14, weight: "black", color: "ink" }));
  add(title, T("· Thu 13 Aug", { size: 12, weight: "bold", color: "muted" }));
  add(head, title);
  add(head, button("Log an exercise", { size: "sm", variant: "secondary" }));
  add(s, head);
  add(s, T(
    "Anything beyond the plan — a class, a swim, an extra lift — lands here and counts toward your totals. Works on past days too.",
    { size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17 },
  ));
  return s;
}

function chipRow(labels) {
  var row = F("chips", { dir: "h", gap: 6, wrap: true, w: "fill" });
  for (var i = 0; i < labels.length; i++) {
    var chip = F("chip", {
      dir: "h", radius: RADIUS.pill, pad: { l: 12, r: 12, t: 6, b: 6 },
      fill: "inset", stroke: "line", align: "CENTER",
    });
    add(chip, T(labels[i], { size: 12, weight: "black", color: "ink" }));
    add(row, chip);
  }
  return row;
}

function makeupRow(title, meta, emoji, tint) {
  var row = F("makeup/" + title, {
    dir: "h", gap: 10, pad: 12, radius: RADIUS.field, fill: "inset", align: "CENTER", w: "fill",
  });
  add(row, iconTile(emoji, tint, 34));
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  add(t, T(title, { size: 14, weight: "black", color: "ink" }));
  add(t, T(meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(row, t);
  add(row, button("Start", { size: "sm" }));
  return row;
}

/* ================= Plans ================= */

function buildPlanScreens() {
  var plans = reg("Plans · Current", screen("Plans"));
  col(plans, screenTitle({ title: "Plans" }));
  col(plans, segmented(["Current", "History"], 0));
  col(plans, listGroup("From your coaches", "Plans prescribed and progressed by a coach", "🧑‍🏫", 2, "plan", "accent"));
  col(plans, planCard({
    name: "Hypertrophy Block 2",
    meta: "From Coach Sam · 13 Aug – 24 Sep · week 2 of 6",
    status: { label: "Active", tint: "accent" },
    actions: [{ label: "View plan" }, { label: "Batch log" }],
  }));
  col(plans, planCard({
    name: "Deload week",
    meta: "From Coach Sam · starts 25 Sep",
    status: { label: "Scheduled", tint: "muted" },
    actions: [{ label: "Sync", variant: "primary" }],
  }));
  col(plans, listGroup("Created by you", "Reusable outlines you can activate independently", "✍️", 1, "plan", "muted"));
  col(plans, planCard({
    name: "Summer conditioning",
    meta: "Own plan · 3 days / week · 12 exercises",
    status: { label: "Template", tint: "muted" },
    actions: [{ label: "View plan" }, { label: "Activate", variant: "primary" }],
  }));
  attachTabBar(plans, ATHLETE_TABS, "plans");

  var history = reg("Plans · History", screen("Plans history"));
  col(history, screenTitle({ title: "Plans" }));
  col(history, segmented(["Current", "History"], 1));
  col(history, sectionHeader("Plan history"));
  col(history, listGroup("Previously assigned", "Finished or stopped coach plans", "📦", 3, "plan", "muted"));
  col(history, planCard({ name: "Hypertrophy Block 1", meta: "From Coach Sam · 1 Jul – 12 Aug · completed", status: { label: "Past", tint: "muted" }, actions: [{ label: "View plan" }] }));
  col(history, planCard({ name: "Base building", meta: "From Coach Sam · 1 May – 30 Jun", status: { label: "Past", tint: "muted" }, actions: [{ label: "View plan" }] }));
  col(history, listGroup("Your finished plans", "Plans previously activated by you", "🗃️", 1, "plan", "muted"));
  col(history, planCard({ name: "Winter strength", meta: "Own plan · ended 30 April", status: { label: "Past", tint: "muted" }, actions: [{ label: "View plan" }, { label: "Restart" }] }));
  attachTabBar(history, ATHLETE_TABS, "plans");

  /* Plan detail */
  var detail = reg("Plan detail", screen("Plan detail"));
  col(detail, backHeader("Hypertrophy Block 2", [iconButton("share"), iconButton("edit")]));
  col(detail, card({
    gap: 10,
    children: [
      (function () {
        var grid = F("facts", { dir: "h", gap: 8, wrap: true, w: "fill" });
        var facts = [
          ["Duration", "42 days"], ["Week blocks", "6"], ["Training days", "4 / week"],
          ["Exercises / week", "22"], ["Timeline", "Set per athlete"], ["This split", "4 active days"],
        ];
        for (var i = 0; i < facts.length; i++) {
          var cell = F("f", { dir: "v", gap: 2, w: 100 });
          add(cell, T(facts[i][0], { size: 10, weight: "black", color: "muted", upper: true, tracking: 3 }));
          add(cell, T(facts[i][1], { size: 14, weight: "black", color: "ink" }));
          add(grid, cell);
        }
        return grid;
      })(),
    ],
  }));
  col(detail, sectionHeader("Plan days", segmented(["Week 1", "Week 2", "Week 3"], 1, { compact: true, w: 200 })));
  col(detail, planDayRow("Monday", "Lower A", "🦵", "#7651d3", "5 exercises"));
  col(detail, planDayRow("Tuesday", "Upper A", "🏋️", "accent", "5 exercises"));
  col(detail, planDayRow("Wednesday", "Rest", "😴", "muted", "Optional mobility"));
  col(detail, planDayRow("Thursday", "Lower B", "🦵", "#7651d3", "5 exercises"));
  col(detail, planDayRow("Friday", "Upper B", "💪", "accent", "6 exercises"));

  /* Plan editor */
  var editor = reg("Plan editor", screen("Plan editor"));
  col(editor, backHeader("Edit plan", [iconButton("copy"), iconButton("trash")]));
  col(editor, field("Plan name", textField("Hypertrophy Block 2")));
  col(editor, (function () {
    var r = F("r", { dir: "h", gap: 8, w: "fill" });
    add(r, field("Weeks", numberField(6)));
    add(r, field("Days / week", numberField(4)));
    return r;
  })());
  col(editor, sectionHeader("Tuesday · Upper A", button("Add exercise", { size: "sm", variant: "secondary", icon: "plus" })));
  col(editor, editorExerciseRow("Bench press", "4 × 8 · 60kg · RPE 8"));
  col(editor, editorExerciseRow("Incline dumbbell press", "3 × 10 · 22.5kg"));
  col(editor, editorExerciseRow("Cable fly", "3 × 12"));
  col(editor, editorExerciseRow("Lat pulldown", "4 × 10 · 50kg"));
  col(editor, (function () {
    var r = F("r", { dir: "h", gap: 8, w: "fill", pad: { t: 8 } });
    add(r, button("Paste import", { variant: "secondary", icon: "copy", full: true }));
    add(r, button("Save plan", { full: true }));
    return r;
  })());

  /* Paste import */
  var paste = reg("Paste import", screen("Paste import"));
  col(paste, backHeader("Paste import", []));
  col(paste, T("Paste a plan from a spreadsheet or a message. One exercise per line — we read sets, reps, load and effort.", {
    size: 13, weight: "semibold", color: "muted", w: "fill", lineHeight: 18,
  }));
  col(paste, (function () {
    var box = F("paste area", {
      dir: "v", gap: 4, pad: 12, radius: RADIUS.field, fill: "inset", stroke: "line", w: "fill", h: 200,
    });
    var lines = [
      "Bench press 4x8 60kg @8",
      "Incline DB press 3x10 22.5",
      "Cable fly 3x12",
      "Lat pulldown 4x10 50kg",
      "Face pull 3x15",
    ];
    for (var i = 0; i < lines.length; i++) {
      add(box, T(lines[i], { size: 13, weight: "bold", color: "ink", w: "fill" }));
    }
    return box;
  })());
  col(paste, sectionHeader("Preview", pill("5 exercises", "accent")));
  col(paste, gridRow(["Exercise", "Sets", "Reps", "kg", "RPE"], { header: true }));
  col(paste, gridRow(["Bench press", 4, 8, 60, 8]));
  col(paste, gridRow(["Incline DB press", 3, 10, 22.5, null]));
  col(paste, gridRow(["Cable fly", 3, 12, null, null]));
  col(paste, button("Import 5 exercises", { full: true }));

  /* Activate sheet */
  var activate = reg("Plans · Activate", cloneOverlayOf(plans, "Plans activate"));
  overlay(activate, scrim(), { x: 0, y: 0 });
  overlay(activate, sheetPanel("Activate Summer conditioning", [
    segmented(["Start by date", "Start today"], 0),
    field("Start date", textField("2026-08-18"), "Automatically ends 29 Sep"),
    T("Your plan days line up from the start date. Rest days are counted, so a 4-day split lands on the same weekdays each block.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
  ], button("Activate plan", { full: true })));

  return [plans, history, detail, editor, paste, activate];
}

function backHeader(title, actions) {
  var h = F("header", { dir: "h", gap: 10, w: "fill", align: "CENTER", pad: { b: 8 } });
  add(h, iconButton("back"));
  add(h, T(title, { size: 20, weight: "black", color: "ink", w: "fill", truncate: true }));
  if (actions) add(h, actions);
  return h;
}

function planDayRow(weekday, title, emoji, tint, meta) {
  var row = F("day/" + weekday, { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(row, iconTile(emoji, tint, 36));
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  var titleRow = F("tr", { dir: "h", gap: 6, align: "CENTER", w: "fill" });
  add(titleRow, T(title, { size: 14, weight: "black", color: "ink" }));
  if (title === "Rest") add(titleRow, pill("Optional", "muted"));
  add(t, titleRow);
  add(t, T(weekday + " · " + meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(row, t);
  add(row, icon("chevron", 16, "muted"));
  return card({ name: "PlanDay/" + weekday, pad: 12, children: [row] });
}

function editorExerciseRow(name, target) {
  var row = F("ex/" + name, { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(row, icon("dumbbell", 18, "muted"));
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  add(t, T(name, { size: 14, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(t, T(target, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(row, t);
  add(row, icon("edit", 16, "muted"));
  add(row, icon("trash", 16, "muted"));
  return card({ name: "Editor/" + name, pad: 12, children: [row] });
}

/* ================= Coach tab ================= */

function buildAthleteCoachScreens() {
  var none = reg("Coach · Not linked", screen("Coach empty"));
  col(none, screenTitle({ title: "Coach" }));
  col(none, emptyState(
    "No coach linked",
    "Ask your coach for an invite code, then enter it in Settings → Coaches. Your activity feed, check-ins and trackers appear here.",
    button("Open settings"),
  ));
  attachTabBar(none, ATHLETE_TABS, "coach");

  var feed = reg("Coach · Activity", screen("Coach feed"));
  col(feed, screenTitle({ title: "Coach" }));
  col(feed, (function () {
    var head = F("coach", { dir: "h", gap: 10, w: "fill", align: "CENTER" });
    add(head, iconTile("🧑‍🏫", "accent", 44));
    var t = F("t", { dir: "v", gap: 2, w: "fill" });
    add(t, T("Coach Sam", { size: 16, weight: "black", color: "ink" }));
    add(t, T("Hypertrophy Block 2 · week 2 of 6", { size: 11, weight: "bold", color: "muted" }));
    add(head, t);
    add(head, pill("Week 2", "accent"));
    return card({ pad: 12, children: [head] });
  })());
  col(feed, segmented(["Activity", "Check-ins", "Trackers"], 0));
  col(feed, card({
    gap: 0,
    children: [
      activityRow({ who: "Coach Sam", when: "2h ago", body: "Nice work holding RPE 8 on bench — keep the same load next session.", emoji: "🧑‍🏫", tint: "accent" }),
      activityRow({ who: "You", when: "Yesterday", body: "Shoulder felt tight on the last set of overhead press.", emoji: "🙂" }),
      activityRow({ who: "Coach Sam", when: "2 days ago", body: "Added a deload week after block 2 — you'll see it in Plans.", emoji: "🧑‍🏫", tint: "accent" }),
    ],
  }));
  col(feed, (function () {
    var r = F("compose", { dir: "h", gap: 8, w: "fill", align: "CENTER" });
    add(r, textField("Message your coach", { placeholder: true }));
    add(r, iconButton("send", { color: "accent" }));
    return r;
  })());
  attachTabBar(feed, ATHLETE_TABS, "coach");

  var checkin = reg("Coach · Check-ins", screen("Coach check-ins"));
  col(checkin, screenTitle({ title: "Coach" }));
  col(checkin, segmented(["Activity", "Check-ins", "Trackers"], 1));
  col(checkin, card({
    gap: 12,
    children: [
      T("Weekly check-in", { size: 15, weight: "black", color: "ink" }),
      T("Due Sunday · Coach Sam", { size: 11, weight: "bold", color: "muted" }),
      field("Bodyweight", numberField(78.4, { suffix: "kg" })),
      field("Sleep quality", segmented(["Poor", "OK", "Good"], 2)),
      field("How did the week feel?", textField("Strong, shoulder a bit tight", { placeholder: false })),
      button("Send check-in", { full: true, icon: "send" }),
    ],
  }));
  col(checkin, sectionHeader("Previous"));
  col(checkin, card({ pad: 12, gap: 4, children: [
    T("Week 1 · 6 August", { size: 13, weight: "black", color: "ink" }),
    T("78.9kg · sleep good · “Felt strong all week”", { size: 11, weight: "semibold", color: "muted", w: "fill" }),
  ] }));
  attachTabBar(checkin, ATHLETE_TABS, "coach");

  return [none, feed, checkin];
}

/* ================= Progress ================= */

function buildProgressScreens() {
  var overview = reg("Progress · Overview", screen("Progress overview"));
  col(overview, screenTitle({ title: "Progress" }));
  col(overview, segmented(["Overview", "Plans", "Days", "Exercises"], 0));
  col(overview, card({
    gap: 12,
    children: [
      (function () {
        var r = F("r", { dir: "h", gap: 14, w: "fill", align: "CENTER" });
        add(r, progressRing(0.66, { label: "4/6", sublabel: "week" }));
        var t = F("t", { dir: "v", gap: 3, w: "fill" });
        add(t, T("18-day streak", { size: 18, weight: "black", color: "ink" }));
        add(t, T("Level 7 · 2 sessions to your weekly goal", { size: 12, weight: "bold", color: "muted", w: "fill" }));
        add(t, progressBar(0.72, { w: "fill" }));
        add(r, t);
        return r;
      })(),
      (function () {
        var tiles = F("tiles", { dir: "h", gap: 8, w: "fill" });
        add(tiles, statTile("12,480", "kg lifted"));
        add(tiles, statTile("162", "sets"));
        add(tiles, statTile("18", "sessions"));
        add(tiles, statTile("24.6", "km"));
        return tiles;
      })(),
    ],
  }));
  col(overview, sectionHeader("Training dimensions"));
  col(overview, (function () {
    var grid = F("dimensions", { dir: "h", gap: 8, wrap: true, w: "fill" });
    var dims = [
      ["Strength", 78, "metric/strength", "+6"],
      ["Endurance", 64, "metric/endurance", "+2"],
      ["Consistency", 91, "metric/consistency", "+4"],
      ["Capacity", 57, "metric/capacity", "−1"],
      ["Recovery", 72, "metric/recovery", "+3"],
      ["Stability", 48, "metric/stability", "0"],
    ];
    for (var i = 0; i < dims.length; i++) {
      var cell = dimensionCard(dims[i][0], dims[i][1], dims[i][2], dims[i][3]);
      cell.__w = undefined;
      cell.resize(108, cell.height);
      add(grid, cell);
    }
    return grid;
  })());
  col(overview, sectionHeader("Read-outs"));
  col(overview, card({ pad: 12, gap: 6, children: [
    T("Your push volume is climbing faster than pull", { size: 13, weight: "black", color: "ink", w: "fill" }),
    T("Push is up 18% over three weeks while pull is flat. Balanced shoulders like a closer ratio.", { size: 11, weight: "semibold", color: "muted", w: "fill", lineHeight: 16 }),
  ] }));
  col(overview, sectionHeader("Muscle balance"));
  col(overview, card({ gap: 10, children: [
    balanceRow("Push", 0.82, "category/push"),
    balanceRow("Pull", 0.61, "category/pull"),
    balanceRow("Legs", 0.74, "category/legs"),
    balanceRow("Core", 0.39, "category/core"),
    balanceRow("Cardio", 0.55, "category/cardio"),
  ] }));
  col(overview, sectionHeader("Recent records", null, "trophy"));
  col(overview, card({ gap: 0, children: [
    recordRow("Bench press", "62.5 kg × 8", "Thursday 13 August"),
    recordRow("Back squat", "100 kg × 5", "Monday 10 August"),
    recordRow("5 km run", "24:18", "Saturday 8 August"),
  ] }));
  attachTabBar(overview, ATHLETE_TABS, "progress");

  var plansTab = reg("Progress · Plans", screen("Progress plans"));
  col(plansTab, screenTitle({ title: "Progress" }));
  col(plansTab, segmented(["Overview", "Plans", "Days", "Exercises"], 1));
  col(plansTab, card({ gap: 10, children: [
    T("Hypertrophy Block 2", { size: 15, weight: "black", color: "ink" }),
    T("Week 2 of 6 · adherence 86%", { size: 11, weight: "bold", color: "muted" }),
    progressBar(0.86, { w: "fill" }),
    barChart([0.9, 1, 0.75, 0.5, 0.85, 0.3, 0], { labels: ["M", "T", "W", "T", "F", "S", "S"], dim: [6] }),
  ] }));
  col(plansTab, sectionHeader("Plan adherence"));
  col(plansTab, card({ gap: 8, children: [
    balanceRow("Week 1", 0.92, "accent"),
    balanceRow("Week 2", 0.8, "accent"),
    balanceRow("Week 3", 0, "muted"),
  ] }));
  attachTabBar(plansTab, ATHLETE_TABS, "progress");

  var daysTab = reg("Progress · Days", screen("Progress days"));
  col(daysTab, screenTitle({ title: "Progress" }));
  col(daysTab, segmented(["Overview", "Plans", "Days", "Exercises"], 2));
  col(daysTab, weekStrip([
    { label: "Mon", date: "10", state: "done" },
    { label: "Tue", date: "11", state: "done" },
    { label: "Wed", date: "12", state: "rest" },
    { label: "Thu", date: "13", state: "today" },
    { label: "Fri", date: "14", state: "planned" },
    { label: "Sat", date: "15", state: "planned" },
    { label: "Sun", date: "16", state: "rest" },
  ]));
  col(daysTab, sectionHeader("Logged days"));
  col(daysTab, dayLogRow("Thursday 13 August", "Upper A · 3 of 5 · 24:18", 0.6, "accent"));
  col(daysTab, dayLogRow("Tuesday 11 August", "Upper B · 6 of 6 · 41:02", 1, "accent"));
  col(daysTab, dayLogRow("Monday 10 August", "Lower A · 4 of 4 · 52:30", 1, "#7651d3"));
  col(daysTab, dayLogRow("Saturday 8 August", "5 km run · 24:18", 1, "#18865f"));
  attachTabBar(daysTab, ATHLETE_TABS, "progress");

  var exercisesTab = reg("Progress · Exercises", screen("Progress exercises"));
  col(exercisesTab, screenTitle({ title: "Progress" }));
  col(exercisesTab, segmented(["Overview", "Plans", "Days", "Exercises"], 3));
  col(exercisesTab, textField("Search your exercises", { placeholder: true, trailing: icon("search", 16, "muted") }));
  col(exercisesTab, sectionHeader("Most trained"));
  col(exercisesTab, exerciseTrendRow("Bench press", "62.5 kg · +8% in 4 weeks", [0.3, 0.42, 0.5, 0.62, 0.7, 0.85]));
  col(exercisesTab, exerciseTrendRow("Back squat", "100 kg · +12% in 4 weeks", [0.2, 0.35, 0.4, 0.58, 0.72, 0.9], "#7651d3"));
  col(exercisesTab, exerciseTrendRow("Lat pulldown", "55 kg · flat", [0.5, 0.52, 0.48, 0.5, 0.52, 0.5], "category/pull"));
  attachTabBar(exercisesTab, ATHLETE_TABS, "progress");

  /* Drill-downs */
  var dimension = reg("Dimension detail", screen("Dimension detail"));
  col(dimension, backHeader("Strength", [iconButton("share")]));
  col(dimension, card({ gap: 12, children: [
    (function () {
      var r = F("r", { dir: "h", gap: 14, w: "fill", align: "CENTER" });
      add(r, progressRing(0.78, { size: 80, label: "78", sublabel: "score", color: "metric/strength" }));
      var t = F("t", { dir: "v", gap: 3, w: "fill" });
      add(t, T("+6 in 4 weeks", { size: 16, weight: "black", color: "done" }));
      add(t, T("Built from load, top sets and effort across your compound lifts.", {
        size: 11, weight: "semibold", color: "muted", w: "fill", lineHeight: 16,
      }));
      add(r, t);
      return r;
    })(),
    lineChart([0.35, 0.42, 0.4, 0.55, 0.62, 0.7, 0.78], { w: "fill", color: "metric/strength" }),
  ] }));
  col(dimension, sectionHeader("What moves this"));
  col(dimension, card({ gap: 0, children: [
    settingRow("Back squat", { subtitle: "Contributes 32% · 100 kg × 5", right: pill("+12%", "done") }),
    settingRow("Bench press", { subtitle: "Contributes 26% · 62.5 kg × 8", right: pill("+8%", "done") }),
    settingRow("Deadlift", { subtitle: "Contributes 24% · 120 kg × 3", right: pill("+3%", "muted") }),
    settingRow("Overhead press", { subtitle: "Contributes 18% · 40 kg × 6", right: pill("flat", "muted"), divider: false }),
  ] }));

  var exerciseDetail = reg("Exercise detail", screen("Exercise detail"));
  col(exerciseDetail, backHeader("Bench press", [iconButton("star"), iconButton("share")]));
  col(exerciseDetail, segmented(["Load", "Volume", "Effort"], 0, { compact: true }));
  col(exerciseDetail, card({ gap: 12, children: [
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, statTile("62.5", "best kg"));
      add(r, statTile("8", "reps"));
      add(r, statTile("+8%", "4 weeks"));
      return r;
    })(),
    lineChart([0.3, 0.38, 0.36, 0.5, 0.55, 0.68, 0.8], { w: "fill" }),
  ] }));
  col(exerciseDetail, sectionHeader("Every set"));
  col(exerciseDetail, gridRow(["Date", "kg", "Reps", "RPE"], { header: true }));
  col(exerciseDetail, gridRow(["13 Aug", 62.5, 8, 8]));
  col(exerciseDetail, gridRow(["9 Aug", 60, 8, 8]));
  col(exerciseDetail, gridRow(["6 Aug", 60, 7, 9]));
  col(exerciseDetail, gridRow(["2 Aug", 57.5, 8, 8]));

  var sessionDetail = reg("Session detail", screen("Session detail"));
  col(sessionDetail, backHeader("Upper A", [iconButton("share"), iconButton("edit")]));
  col(sessionDetail, T("Thursday 13 August · 24:18 · RPE 8 average", { size: 12, weight: "bold", color: "muted", w: "fill" }));
  col(sessionDetail, card({ gap: 8, children: [
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, statTile("3,240", "kg lifted"));
      add(r, statTile("14", "sets"));
      add(r, statTile("24:18", "duration"));
      return r;
    })(),
  ] }));
  col(sessionDetail, sectionHeader("Exercises"));
  col(sessionDetail, gridRow(["Exercise", "Sets", "Top", "RPE"], { header: true }));
  col(sessionDetail, gridRow(["Bench press", 4, "62.5", 8]));
  col(sessionDetail, gridRow(["Incline DB", 3, "22.5", 8]));
  col(sessionDetail, gridRow(["Cable fly", 3, "17.5", 7]));
  col(sessionDetail, gridRow(["Lat pulldown", 4, "55", 8]));
  col(sessionDetail, sectionHeader("Coach note"));
  col(sessionDetail, card({ pad: 12, children: [
    activityRow({ who: "Coach Sam", when: "1h ago", body: "Good top set. Hold 62.5 next week and chase the extra rep.", emoji: "🧑‍🏫", tint: "accent" }),
  ] }));

  var dayDetail = reg("Day detail", screen("Day detail"));
  col(dayDetail, backHeader("Thursday 13 August", []));
  col(dayDetail, card({ gap: 8, children: [
    T("Upper A", { size: 15, weight: "black", color: "ink" }),
    T("3 of 5 exercises · 24:18 · late log", { size: 11, weight: "bold", color: "muted" }),
    progressBar(0.6, { w: "fill" }),
  ] }));
  col(dayDetail, sectionHeader("Also logged"));
  col(dayDetail, card({ pad: 12, gap: 4, children: [
    T("Extra work · 5 km run", { size: 13, weight: "black", color: "ink" }),
    T("24:18 · 5.0 km · zone 2", { size: 11, weight: "semibold", color: "muted" }),
  ] }));

  return [overview, plansTab, daysTab, exercisesTab, dimension, exerciseDetail, sessionDetail, dayDetail];
}

function dayLogRow(date, meta, ratio, tint) {
  var row = F("day/" + date, { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(row, progressRing(ratio, { size: 38, stroke: 5, color: tint }));
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  add(t, T(date, { size: 14, weight: "black", color: "ink", w: "fill" }));
  add(t, T(meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(row, t);
  add(row, icon("chevron", 16, "muted"));
  return card({ name: "DayLog/" + date, pad: 12, children: [row] });
}

function exerciseTrendRow(name, meta, points, tint) {
  var row = F("trend/" + name, { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  add(t, T(name, { size: 14, weight: "black", color: "ink", w: "fill" }));
  add(t, T(meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(row, t);
  add(row, lineChart(points, { w: 96, h: 40, color: tint || "accent" }));
  add(row, icon("chevron", 16, "muted"));
  return card({ name: "Trend/" + name, pad: 12, children: [row] });
}

/* ================= Library ================= */

function buildLibraryScreens() {
  var library = reg("Library · Yours", screen("Library"));
  col(library, screenTitle({ title: "Library" }));
  col(library, segmented(["Your exercises", "Database"], 0));
  col(library, textField("Search your exercises", { placeholder: true, trailing: icon("search", 16, "muted") }));
  col(library, sectionHeader("Push", pill("6", "category/push")));
  col(library, libraryRow("Bench press", "Barbell · 4 × 8 · load + reps", "category/push"));
  col(library, libraryRow("Incline dumbbell press", "Dumbbell · 3 × 10", "category/push"));
  col(library, libraryRow("Overhead press", "Barbell · 4 × 6", "category/push"));
  col(library, sectionHeader("Pull", pill("5", "category/pull")));
  col(library, libraryRow("Lat pulldown", "Cable · 4 × 10", "category/pull"));
  col(library, libraryRow("Barbell row", "Barbell · 4 × 8", "category/pull"));
  col(library, sectionHeader("Legs", pill("4", "category/legs")));
  col(library, libraryRow("Back squat", "Barbell · 5 × 5", "category/legs"));
  attachTabBar(library, ATHLETE_TABS, "exercises");

  var database = reg("Library · Database", screen("Library database"));
  col(database, screenTitle({ title: "Library" }));
  col(database, segmented(["Your exercises", "Database"], 1));
  col(database, textField("Search the exercise database", { placeholder: true, trailing: icon("search", 16, "muted") }));
  col(database, (function () {
    var r = F("filters", { dir: "h", gap: 6, wrap: true, w: "fill" });
    var cats = ["All", "Push", "Pull", "Legs", "Core", "Cardio"];
    for (var i = 0; i < cats.length; i++) {
      var chip = F("c", {
        dir: "h", radius: RADIUS.pill, pad: { l: 12, r: 12, t: 6, b: 6 },
        fill: i === 0 ? "accent" : "inset", stroke: i === 0 ? null : "line", align: "CENTER",
      });
      add(chip, T(cats[i], { size: 12, weight: "black", color: i === 0 ? "white" : "muted" }));
      add(r, chip);
    }
    return r;
  })());
  col(database, sectionHeader("284 exercises"));
  col(database, libraryRow("Bulgarian split squat", "Dumbbell · legs", "category/legs", true));
  col(database, libraryRow("Face pull", "Cable · pull", "category/pull", true));
  col(database, libraryRow("Hanging leg raise", "Bodyweight · core", "category/core", true));
  col(database, libraryRow("Rowing machine", "Machine · cardio", "category/cardio", true));
  attachTabBar(database, ATHLETE_TABS, "exercises");

  var setup = reg("Library · Setup sheet", cloneOverlayOf(library, "Library setup"));
  overlay(setup, scrim(), { x: 0, y: 0 });
  overlay(setup, sheetPanel("Set up Bench press", [
    field("Category", segmented(["Push", "Pull", "Legs", "Core"], 0, { compact: true })),
    field("How it logs", segmented(["Load + reps", "Reps", "Time", "Distance"], 0, { compact: true })),
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, field("Target sets", numberField(4)));
      add(r, field("Target reps", numberField(8)));
      return r;
    })(),
    field("Extra fields", chipRow(["Tempo", "Rest", "Band", "+ Add"])),
  ], button("Save to my library", { full: true })));

  return [library, database, setup];
}

function libraryRow(name, meta, tint, addable) {
  var row = F("lib/" + name, { dir: "h", gap: 10, w: "fill", align: "CENTER" });
  add(row, iconTile("🏋️", tint, 34));
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  add(t, T(name, { size: 14, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(t, T(meta, { size: 11, weight: "bold", color: "muted", w: "fill" }));
  add(row, t);
  if (addable) add(row, button("Add", { size: "sm", variant: "secondary", icon: "plus" }));
  else add(row, icon("chevron", 16, "muted"));
  return card({ name: "Library/" + name, pad: 12, children: [row] });
}

/* ================= Settings ================= */

function buildSettingsScreens(role) {
  var isCoach = role === "coach";
  var id = isCoach ? "Coach settings" : "Settings";
  var s = reg(id, screen(id));
  col(s, screenTitle({ title: "Settings" }));
  col(s, sectionHeader("Profile"));
  col(s, card({ gap: 12, children: [
    field("Display name", textField(isCoach ? "Coach Sam" : "Alex")),
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, field("Sessions / week", numberField(4)));
      add(r, field("Distance / week", numberField(20, { suffix: "km" })));
      return r;
    })(),
  ] }));

  col(s, sectionHeader("Appearance"));
  col(s, card({ pad: 0, gap: 0, children: [
    settingRow("Theme", { subtitle: "Follows your device", right: segmented(["Auto", "Light", "Dark"], 0, { w: 170, compact: true }) }),
    settingRow("Colour", { subtitle: "Denim" }),
    settingRow("Style", { subtitle: "Solid", divider: false }),
  ] }));

  if (!isCoach) {
    col(s, sectionHeader("Coaches"));
    col(s, card({ pad: 0, gap: 0, children: [
      settingRow("Coach Sam", { subtitle: "Linked 1 July · sharing logs", right: toggle(true) }),
      settingRow("Enter an invite code", { subtitle: "Ask your coach for their code", right: pill("ABC-123", "muted"), divider: false }),
    ] }));
    col(s, sectionHeader("Data"));
    col(s, card({ pad: 0, gap: 0, children: [
      settingRow("Batch log a plan", { subtitle: "Fill in a whole block at once" }),
      settingRow("Import training", { subtitle: "Paste or upload past sessions" }),
      settingRow("Export a report", { subtitle: "Spreadsheet of every logged set", divider: false }),
    ] }));
  } else {
    col(s, sectionHeader("Coaching"));
    col(s, card({ pad: 0, gap: 0, children: [
      settingRow("Invite codes", { subtitle: "3 active · 1 unclaimed" }),
      settingRow("Default plan template", { subtitle: "Hypertrophy Block 2" }),
      settingRow("Export athlete reports", { subtitle: "One spreadsheet per athlete", divider: false }),
    ] }));
  }

  col(s, sectionHeader("Account"));
  col(s, card({ pad: 0, gap: 0, children: [
    settingRow(isCoach ? "Switch to athlete portal" : "Switch to coach portal", {
      subtitle: isCoach ? "Log your own training too" : "Build plans and track athletes",
    }),
    settingRow("Change email", { subtitle: "alex@example.com" }),
    settingRow("Guide", { subtitle: "How AntRep works" }),
    settingRow("Sign out", { divider: false }),
  ] }));
  attachTabBar(s, isCoach ? COACH_TABS : ATHLETE_TABS, "settings");

  if (isCoach) return [s];

  var colour = reg("Settings · Colour", cloneOverlayOf(s, "Settings colour"));
  overlay(colour, scrim(), { x: 0, y: 0 });
  overlay(colour, sheetPanel("Colour", [
    segmented(["Light", "Dark"], 0, { compact: true }),
    segmented(["Colours", "Style", "Accent"], 0),
    sectionHeader("Blue"),
    paletteGrid(["Sky", "Teal", "Ocean", "Denim", "Cobalt", "Indigo"], 3),
    sectionHeader("Green"),
    paletteGrid(["Mint", "Sage", "Jade", "Forest", "Moss", "Olive"], -1),
  ]));

  return [s, colour];
}

function paletteGrid(labels, activeIndex) {
  var grid = F("palette grid", { dir: "h", gap: 8, wrap: true, w: "fill" });
  for (var i = 0; i < labels.length; i++) {
    var pal = null;
    for (var b = 0; b < BACKGROUNDS.length; b++) {
      if (BACKGROUNDS[b].label === labels[i]) pal = BACKGROUNDS[b];
    }
    if (!pal) continue;
    var cell = F(pal.label, { dir: "v", gap: 4, w: 100, align: "CENTER" });
    var chip = F("chip", {
      dir: "none", w: 100, h: 52, radius: 12,
      stroke: i === activeIndex ? "accent" : "line",
      strokeWeight: i === activeIndex ? 2 : 1,
    });
    setFills(chip, pal.light.bg);
    var dot = E("accent", 18, {});
    setFills(dot, pal.light.accent);
    chip.appendChild(dot);
    dot.x = 70;
    dot.y = 26;
    add(cell, chip);
    add(cell, T(pal.label, { size: 11, weight: "black", color: i === activeIndex ? "accent" : "ink" }));
    add(grid, cell);
  }
  return grid;
}

/* ================= full-screen tools ================= */

function buildToolScreens() {
  var batch = reg("Batch log", screen("Batch log"));
  col(batch, backHeader("Batch log", []));
  col(batch, T("Hypertrophy Block 2", { size: 12, weight: "bold", color: "muted", w: "fill" }));
  col(batch, (function () {
    var r = F("range", { dir: "h", gap: 8, w: "fill" });
    add(r, field("From", textField("2026-08-01")));
    add(r, field("Through", textField("2026-08-13")));
    return r;
  })());
  col(batch, (function () {
    var r = F("pills", { dir: "h", gap: 6, wrap: true, w: "fill" });
    add(r, pill("48 scheduled exercises", "accent"));
    add(r, pill("112 filled sets", "done"));
    add(r, pill("maximum 366 days at once", "muted"));
    return r;
  })());
  col(batch, textField("Search exercise name", { placeholder: true, trailing: icon("search", 16, "muted") }));
  col(batch, (function () {
    var group = F("group", {
      dir: "h", gap: 8, pad: { l: 10, r: 10, t: 6, b: 6 }, radius: 10,
      fill: "accent", fillOpacity: 0.12, align: "CENTER", w: "fill",
    });
    add(group, T("Upper A · Thu 13 Aug", { size: 12, weight: "black", color: "accent", w: "fill" }));
    add(group, icon("chevronDown", 14, "accent"));
    return group;
  })());
  col(batch, gridRow(["Exercise", "kg", "Reps", "RPE"], { header: true }));
  col(batch, gridRow(["Bench press", 60, 8, 8]));
  col(batch, gridRow(["Bench press", 60, 8, 8]));
  col(batch, gridRow(["Bench press", 62.5, 7, 9]));
  col(batch, gridRow(["Incline DB", 22.5, 10, null]));
  col(batch, gridRow(["Cable fly", null, null, null]));
  col(batch, (function () {
    var r = F("save", { dir: "h", gap: 8, w: "fill", pad: { t: 8 } });
    add(r, button("Discard", { variant: "secondary", full: true }));
    add(r, button("Save 112 sets", { full: true }));
    return r;
  })());

  var guide = reg("Guide", screen("Guide"));
  col(guide, backHeader("Guide", []));
  col(guide, segmented(["Athlete", "Coach"], 0));
  col(guide, sectionHeader("Getting started"));
  col(guide, card({ gap: 6, children: [
    T("1 · Link your coach", { size: 14, weight: "black", color: "ink" }),
    T("Settings → Coaches → enter the invite code they send you. Their plans then appear in Plans.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
  ] }));
  col(guide, card({ gap: 6, children: [
    T("2 · Log the day's work", { size: 14, weight: "black", color: "ink" }),
    T("Home shows today's block. Start the timer or just fill in the sets — both count the same.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
  ] }));
  col(guide, card({ gap: 6, children: [
    T("3 · Catch up on missed days", { size: 14, weight: "black", color: "ink" }),
    T("Use the date arrows to back-date, or “Another day” to run a workout you skipped. Batch log fills a whole block at once.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
  ] }));

  var importSheet = reg("Import training", screen("Import"));
  col(importSheet, backHeader("Import training", []));
  col(importSheet, segmented(["Paste", "Upload"], 0));
  col(importSheet, T("Paste rows from a spreadsheet. We match exercises to your library and flag anything unknown.", {
    size: 13, weight: "semibold", color: "muted", w: "fill", lineHeight: 18,
  }));
  col(importSheet, (function () {
    var box = F("paste", { dir: "v", gap: 4, pad: 12, radius: RADIUS.field, fill: "inset", stroke: "line", w: "fill", h: 160 });
    var lines = ["2026-08-06  Bench press  60  8  8", "2026-08-06  Cable fly  17.5  12  7", "2026-08-04  Back squat  95  5  8"];
    for (var i = 0; i < lines.length; i++) add(box, T(lines[i], { size: 12, weight: "bold", color: "ink", w: "fill" }));
    return box;
  })());
  col(importSheet, sectionHeader("Matched", pill("3 of 3", "done")));
  col(importSheet, gridRow(["Date", "Exercise", "kg", "Reps"], { header: true }));
  col(importSheet, gridRow(["6 Aug", "Bench press", 60, 8]));
  col(importSheet, gridRow(["6 Aug", "Cable fly", 17.5, 12]));
  col(importSheet, gridRow(["4 Aug", "Back squat", 95, 5]));
  col(importSheet, button("Import 3 sessions", { full: true }));

  return [batch, guide, importSheet];
}

/* ================= page ================= */

async function buildAthletePage(page) {
  buildEntryScreens();
  buildHomeScreens();
  buildPlanScreens();
  buildAthleteCoachScreens();
  buildProgressScreens();
  buildLibraryScreens();
  buildSettingsScreens("athlete");
  buildToolScreens();

  layoutRows(page, [
    {
      label: "1 · Getting in",
      note: "Shared by both portals. The role gate is what a coach sees on the athlete side before enabling it, and the reverse.",
      ids: ["Loading", "Auth · Sign in", "Auth · Create account", "Verify email", "Role gate"],
    },
    {
      label: "2 · Home — what am I doing today?",
      note: "The one question Home answers. Streak and weekly tiles moved to Progress → Overview.",
      ids: ["Home · Today", "Home · Start dialog", "Home · Countdown", "Home · Workout live", "Home · Rest day", "Home · No plan"],
    },
    {
      label: "3 · Home — filling in the past",
      note: "Back-dating is a first-class path, not a recovery mode: the date switcher, the search sheet, and running a skipped day as a makeup.",
      ids: ["Home · Date search", "Home · Late log", "Home · Another day", "Batch log", "Import training"],
    },
    {
      label: "4 · Plans",
      note: "Coach-assigned plans and the athlete's own outlines live in one list, split by who owns them.",
      ids: ["Plans · Current", "Plans · Activate", "Plans · History", "Plan detail", "Plan editor", "Paste import"],
    },
    {
      label: "5 · Coach",
      note: "The athlete's side of the relationship: activity thread, check-ins and trackers.",
      ids: ["Coach · Not linked", "Coach · Activity", "Coach · Check-ins"],
    },
    {
      label: "6 · Progress",
      note: "Four tabs over one dataset, each drilling into a detail screen.",
      ids: ["Progress · Overview", "Progress · Plans", "Progress · Days", "Progress · Exercises",
        "Dimension detail", "Exercise detail", "Session detail", "Day detail"],
    },
    {
      label: "7 · Library and Settings",
      note: "The athlete's own exercise setups, the shared database, and the appearance system.",
      ids: ["Library · Yours", "Library · Database", "Library · Setup sheet", "Settings", "Settings · Colour", "Guide"],
    },
  ]);
}

/* ==== 60-coach.js ================================================= */
/* ------------------------------------------------------------------
 * The coach journey, end to end.
 *
 * The coach portal is the same shell with a different tab set, and its
 * "My training" tab re-enters the athlete app against the coach's own
 * athlete profile — so those three screens are the athlete ones, reached
 * from a different place.
 * ------------------------------------------------------------------ */

function buildCoachEntryScreens() {
  // The coach sign-in is built with the athlete entry screens but laid out
  // here, so it has to exist even when only the coach flow is generated.
  if (!SCREENS["Auth · Coach portal"]) {
    reg("Auth · Coach portal", authScreen("signin", "coach"));
  }

  var gate = reg("Coach role gate", screen("Coach role gate"));
  var gCard = card({
    pad: 20,
    gap: 6,
    children: [
      T("Coach side", { size: 20, weight: "black", color: "ink" }),
      T("Turn on coaching to build plans and track athletes with this same account.", {
        size: 14, weight: "semibold", color: "muted", w: "fill", lineHeight: 19,
      }),
      button("Enable coach profile", { full: true }),
      button("Back to the athlete portal", { variant: "secondary", full: true }),
    ],
  });
  var wrap = F("center", { dir: "v", w: "fill", pad: { t: 240 } });
  add(wrap, gCard);
  col(gate, wrap);
  return [gate];
}

/* ================= Athletes ================= */

function buildAthletesScreens() {
  var empty = reg("Athletes · Empty", screen("Athletes empty"));
  col(empty, screenTitle({ title: "Athletes", right: button("Invite", { size: "sm", icon: "plus" }) }));
  col(empty, emptyState(
    "No athletes yet",
    "Create an invite code above and share it — they enter it in Settings → Coaches.",
    button("Create an invite code"),
  ));
  attachTabBar(empty, COACH_TABS, "athletes");

  var list = reg("Athletes · List", screen("Athletes"));
  col(list, screenTitle({ title: "Athletes", right: button("Invite", { size: "sm", icon: "plus" }) }));
  col(list, sectionHeader("Waiting to be claimed"));
  col(list, (function () {
    var row = F("invite", { dir: "h", gap: 10, w: "fill", align: "CENTER" });
    add(row, iconTile("🔗", "muted", 34));
    var t = F("t", { dir: "v", gap: 1, w: "fill" });
    add(t, T("ABC-123", { size: 14, weight: "black", color: "ink" }));
    add(t, T("Created 2 days ago · never used", { size: 11, weight: "bold", color: "muted" }));
    add(row, t);
    add(row, pill("Pending", "muted"));
    add(row, iconButton("copy"));
    return card({ pad: 12, children: [row] });
  })());
  col(list, sectionHeader("4 linked"));
  col(list, athleteRow({
    name: "Alex", meta: "Hypertrophy Block 2 · week 2 · logged 24:18 today", ratio: 0.66,
    pills: [{ label: "Today", tint: "done" }, { label: "2 new", tint: "accent" }], emoji: "🙂",
  }));
  col(list, athleteRow({ name: "Jordan", meta: "Base building · week 5 · last logged 2 days ago", ratio: 0.4, emoji: "🙃" }));
  col(list, athleteRow({
    name: "Priya", meta: "Deload week · week 1 · check-in due", ratio: 0.85,
    pills: [{ label: "1 new", tint: "accent" }], emoji: "😌",
  }));
  col(list, athleteRow({ name: "Sam T.", meta: "No plan assigned · linked 3 days ago", ratio: 0, emoji: "🙂" }));
  attachTabBar(list, COACH_TABS, "athletes");

  var invite = reg("Athletes · Invite", cloneOverlayOf(list, "Athletes invite"));
  overlay(invite, scrim(), { x: 0, y: 0 });
  overlay(invite, sheetPanel("Invite an athlete", [
    T("Share this code. They enter it in Settings → Coaches and your plans start flowing to them.", {
      size: 13, weight: "semibold", color: "muted", w: "fill", lineHeight: 18,
    }),
    (function () {
      var box = F("code", {
        dir: "h", gap: 10, pad: 20, radius: RADIUS.field, fill: "inset", stroke: "line",
        justify: "CENTER", align: "CENTER", w: "fill",
      });
      add(box, T("DXK-729", { size: 32, weight: "black", color: "accent", tracking: 8 }));
      return box;
    })(),
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, button("Copy code", { variant: "secondary", icon: "copy", full: true }));
      add(r, button("Share", { icon: "share", full: true }));
      return r;
    })(),
  ]));

  return [empty, list, invite];
}

/* ================= Athlete detail ================= */

function athleteDetailShell(name, tabIndex) {
  var s = screen(name);
  var head = F("header", { dir: "h", gap: 8, w: "fill", align: "CENTER", pad: { b: 8 } });
  add(head, iconButton("back"));
  add(head, T("Alex", { size: 20, weight: "black", color: "ink", w: "fill", truncate: true }));
  add(head, iconButton("send"));
  add(head, iconButton("calendarClock"));
  add(head, iconButton("share"));
  col(s, head);
  col(s, segmented(["Overview", "Progress", "Plans", "Coaching"], tabIndex, { compact: true }));
  return s;
}

function buildAthleteDetailScreens() {
  /* Overview */
  var overview = reg("Athlete · Overview", athleteDetailShell("Athlete overview", 0));
  col(overview, card({ gap: 12, children: [
    (function () {
      var r = F("r", { dir: "h", gap: 14, w: "fill", align: "CENTER" });
      add(r, progressRing(0.66, { label: "4/6", sublabel: "this week" }));
      var t = F("t", { dir: "v", gap: 3, w: "fill" });
      add(t, T("Hypertrophy Block 2", { size: 15, weight: "black", color: "ink" }));
      add(t, T("Week 2 of 6 · adherence 86% · 18-day streak", { size: 11, weight: "bold", color: "muted", w: "fill" }));
      add(t, progressBar(0.86, { w: "fill" }));
      add(r, t);
      return r;
    })(),
  ] }));
  col(overview, sectionHeader("Thursday's work"));
  col(overview, card({ gap: 8, children: [
    T("Upper A", { size: 14, weight: "black", color: "ink" }),
    T("3 of 5 done · 24:18 · RPE 8 average", { size: 11, weight: "bold", color: "muted" }),
    gridRow(["Exercise", "Sets", "Top", "RPE"], { header: true }),
    gridRow(["Bench press", 4, "62.5", 8]),
    gridRow(["Incline DB", 3, "22.5", 8]),
    gridRow(["Cable fly", 3, "17.5", 7]),
  ] }));
  col(overview, sectionHeader("Latest sessions"));
  col(overview, dayLogRow("Thursday 13 August", "Upper A · 3 of 5 · 24:18", 0.6, "accent"));
  col(overview, dayLogRow("Tuesday 11 August", "Upper B · 6 of 6 · 41:02", 1, "accent"));
  col(overview, dayLogRow("Monday 10 August", "Lower A · 4 of 4 · 52:30", 1, "#7651d3"));
  attachTabBar(overview, COACH_TABS, "athletes");

  /* Progress */
  var progress = reg("Athlete · Progress", athleteDetailShell("Athlete progress", 1));
  col(progress, sectionHeader("Plan adherence"));
  col(progress, card({ gap: 10, children: [
    barChart([0.92, 0.8, 0.6, 0.95, 0.7, 0.4], { labels: ["W1", "W2", "W3", "W4", "W5", "W6"], dim: [2, 4, 5] }),
    T("86% over the block so far", { size: 11, weight: "bold", color: "muted" }),
  ] }));
  col(progress, sectionHeader("Totals"));
  col(progress, card({ children: [
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, statTile("12,480", "kg lifted"));
      add(r, statTile("18", "sessions"));
      add(r, statTile("162", "sets"));
      add(r, statTile("24.6", "km"));
      return r;
    })(),
  ] }));
  col(progress, sectionHeader("Training dimensions"));
  col(progress, (function () {
    var grid = F("dimensions", { dir: "h", gap: 8, wrap: true, w: "fill" });
    var dims = [["Strength", 78, "metric/strength", "+6"], ["Endurance", 64, "metric/endurance", "+2"],
      ["Consistency", 91, "metric/consistency", "+4"], ["Capacity", 57, "metric/capacity", "−1"]];
    for (var i = 0; i < dims.length; i++) {
      var cell = dimensionCard(dims[i][0], dims[i][1], dims[i][2], dims[i][3]);
      cell.__w = undefined;
      cell.resize(108, cell.height);
      add(grid, cell);
    }
    return grid;
  })());
  col(progress, sectionHeader("Records in the last 3 weeks", null, "trophy"));
  col(progress, card({ gap: 0, children: [
    recordRow("Bench press", "62.5 kg × 8", "Thursday 13 August"),
    recordRow("Back squat", "100 kg × 5", "Monday 10 August"),
  ] }));
  attachTabBar(progress, COACH_TABS, "athletes");

  /* Plans */
  var plans = reg("Athlete · Plans", athleteDetailShell("Athlete plans", 2));
  col(plans, sectionHeader("Assigned by you"));
  col(plans, planCard({
    name: "Hypertrophy Block 2",
    meta: "13 Aug – 24 Sep · week 2 of 6 · synced",
    status: { label: "Active", tint: "accent" },
    actions: [{ label: "Customise" }, { label: "Stop" }],
  }));
  col(plans, planCard({
    name: "Deload week",
    meta: "Starts 25 Sep · not yet synced",
    status: { label: "Scheduled", tint: "muted" },
    actions: [{ label: "Edit dates" }, { label: "Withdraw" }],
  }));
  col(plans, sectionHeader("Assigned by other coaches"));
  col(plans, planCard({
    name: "Mobility routine",
    meta: "From Coach Rae · 1 Aug – ongoing",
    status: { label: "Read only", tint: "muted" },
  }));
  col(plans, sectionHeader("Send another plan"));
  col(plans, planCard({ name: "Base building", meta: "6 weeks · 4 days / week", actions: [{ label: "Assign", variant: "primary" }] }));
  col(plans, planCard({ name: "Summer conditioning", meta: "4 weeks · 3 days / week", actions: [{ label: "Assign", variant: "primary" }] }));
  col(plans, sectionHeader("Their own plans"));
  col(plans, planCard({ name: "Winter strength", meta: "Owned by Alex · inactive", status: { label: "Template", tint: "muted" } }));
  attachTabBar(plans, COACH_TABS, "athletes");

  /* Coaching */
  var coaching = reg("Athlete · Coaching", athleteDetailShell("Athlete coaching", 3));
  col(coaching, segmented(["Activity", "Check-ins", "Notes", "Trackers"], 0, { compact: true }));
  col(coaching, card({ gap: 0, children: [
    activityRow({ who: "You", when: "1h ago", body: "Good top set. Hold 62.5 next week and chase the extra rep.", emoji: "🧑‍🏫", tint: "accent" }),
    activityRow({ who: "Alex", when: "2h ago", body: "Shoulder felt tight on the last set of overhead press.", emoji: "🙂" }),
    activityRow({ who: "You", when: "2 days ago", body: "Added a deload week after block 2.", emoji: "🧑‍🏫", tint: "accent" }),
  ] }));
  col(coaching, (function () {
    var r = F("compose", { dir: "h", gap: 8, w: "fill", align: "CENTER" });
    add(r, textField("Message Alex", { placeholder: true }));
    add(r, iconButton("send", { color: "accent" }));
    return r;
  })());
  col(coaching, sectionHeader("Trackers"));
  col(coaching, card({ gap: 10, children: [
    T("Bodyweight", { size: 13, weight: "black", color: "ink" }),
    lineChart([0.9, 0.85, 0.8, 0.78, 0.72, 0.7], { w: "fill", color: "metric/recovery" }),
    T("78.4 kg · −1.2 kg over 6 weeks", { size: 11, weight: "bold", color: "muted" }),
  ] }));
  attachTabBar(coaching, COACH_TABS, "athletes");

  /* Customiser */
  var customise = reg("Athlete · Customise plan", screen("Plan customiser"));
  col(customise, backHeader("Customise for Alex", [iconButton("copy")]));
  col(customise, T("Hypertrophy Block 2 · changes apply only to Alex's copy", {
    size: 12, weight: "semibold", color: "muted", w: "fill",
  }));
  col(customise, segmented(["Week 1", "Week 2", "Week 3"], 1, { compact: true }));
  col(customise, sectionHeader("Tuesday · Upper A"));
  col(customise, card({ gap: 10, children: [
    T("Bench press", { size: 14, weight: "black", color: "ink" }),
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, field("Sets", numberField(4)));
      add(r, field("Reps", numberField(8)));
      add(r, field("kg", numberField(62.5)));
      return r;
    })(),
    rpeSlider(8, "2 reps left", { target: 8, trackW: 290 }),
  ] }));
  col(customise, card({ gap: 10, children: [
    T("Incline dumbbell press", { size: 14, weight: "black", color: "ink" }),
    (function () {
      var r = F("r", { dir: "h", gap: 8, w: "fill" });
      add(r, field("Sets", numberField(3)));
      add(r, field("Reps", numberField(10)));
      add(r, field("kg", numberField(22.5)));
      return r;
    })(),
  ] }));
  col(customise, sectionHeader("Note for this week"));
  col(customise, textField("Shoulder tight — drop overhead press to 3 sets", { placeholder: false }));
  col(customise, button("Save for Alex", { full: true }));

  /* Export */
  var exportSheet = reg("Athlete · Export", cloneOverlayOf(overview, "Athlete export"));
  overlay(exportSheet, scrim(), { x: 0, y: 0 });
  overlay(exportSheet, sheetPanel("Export report", [
    field("Range", segmented(["This block", "Last 90 days", "Everything"], 0, { compact: true })),
    field("Include", (function () {
      var v = F("v", { dir: "v", gap: 0, w: "fill" });
      add(v, settingRow("Every logged set", { right: toggle(true) }));
      add(v, settingRow("Coach notes", { right: toggle(true) }));
      add(v, settingRow("Check-ins and trackers", { right: toggle(false), divider: false }));
      return v;
    })()),
    T("Downloads as a styled spreadsheet — one sheet per exercise, plus a summary.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
  ], button("Export spreadsheet", { full: true, icon: "share" })));

  return [overview, progress, plans, coaching, customise, exportSheet];
}

/* ================= Coach plans ================= */

function buildCoachPlansScreens() {
  var empty = reg("Coach plans · Empty", screen("Coach plans empty"));
  col(empty, screenTitle({ title: "Plans", right: button("New plan", { size: "sm", icon: "plus" }) }));
  col(empty, emptyState(
    "No plans yet",
    "Build a weekly plan, then assign it to as many athletes as you like.",
    button("Create a plan"),
  ));
  attachTabBar(empty, COACH_TABS, "plans");

  var list = reg("Coach plans · List", screen("Coach plans"));
  col(list, screenTitle({ title: "Plans", right: button("New plan", { size: "sm", icon: "plus" }) }));
  col(list, listGroup("Running now", "Assigned and in progress", "🟢", 2, "plan", "accent"));
  col(list, planCard({
    name: "Hypertrophy Block 2",
    meta: "6 weeks · 4 days / week · 3 athletes",
    status: { label: "Assigned", tint: "accent" },
    actions: [{ label: "Assign", variant: "primary" }, { label: "Edit" }],
  }));
  col(list, planCard({
    name: "Base building",
    meta: "8 weeks · 3 days / week · 1 athlete",
    status: { label: "Assigned", tint: "accent" },
    actions: [{ label: "Assign", variant: "primary" }, { label: "Edit" }],
  }));
  col(list, listGroup("Templates", "Not currently assigned to anyone", "📄", 2, "plan", "muted"));
  col(list, planCard({ name: "Deload week", meta: "1 week · 3 days / week", actions: [{ label: "Assign", variant: "primary" }, { label: "Edit" }] }));
  col(list, planCard({ name: "Summer conditioning", meta: "4 weeks · 3 days / week", actions: [{ label: "Assign", variant: "primary" }, { label: "Edit" }] }));
  col(list, sectionHeader("How assignment works"));
  col(list, card({ gap: 6, children: [
    T("One plan, many athletes", { size: 13, weight: "black", color: "ink" }),
    T("Assigning copies the outline to that athlete. Customising it afterwards changes only their copy — the template stays clean.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
  ] }));
  attachTabBar(list, COACH_TABS, "plans");

  var assign = reg("Coach plans · Assign", cloneOverlayOf(list, "Coach plans assign"));
  overlay(assign, scrim(), { x: 0, y: 0 });
  overlay(assign, sheetPanel("Assign Hypertrophy Block 2", [
    segmented(["Start by date", "Athlete starts"], 0),
    field("Athlete start date", textField("2026-08-18"), "Ends 29 Sep from the 42-day duration"),
    sectionHeader("Your training profile"),
    assignRow("Coach Sam", "Your own athlete side", "🧑‍🏫", false),
    sectionHeader("Linked athletes"),
    assignRow("Alex", "Hypertrophy Block 2 running", "🙂", true),
    assignRow("Jordan", "Base building · week 5", "🙃", false),
    assignRow("Priya", "Deload week · week 1", "😌", false),
    assignRow("Sam T.", "No plan assigned", "🙂", false),
  ], button("Assign to 1 athlete", { full: true })));

  var editor = reg("Coach plan editor", screen("Coach plan editor"));
  col(editor, backHeader("Hypertrophy Block 2", [iconButton("copy"), iconButton("trash")]));
  col(editor, (function () {
    var r = F("r", { dir: "h", gap: 8, w: "fill" });
    add(r, field("Weeks", numberField(6)));
    add(r, field("Days / week", numberField(4)));
    add(r, field("Rest after", numberField(1)));
    return r;
  })());
  col(editor, segmented(["Week 1", "Week 2", "Week 3", "Week 4"], 1, { compact: true, scroll: true }));
  col(editor, sectionHeader("Days"));
  col(editor, planDayRow("Monday", "Lower A", "🦵", "#7651d3", "5 exercises"));
  col(editor, planDayRow("Tuesday", "Upper A", "🏋️", "accent", "5 exercises"));
  col(editor, planDayRow("Thursday", "Lower B", "🦵", "#7651d3", "5 exercises"));
  col(editor, planDayRow("Friday", "Upper B", "💪", "accent", "6 exercises"));
  col(editor, sectionHeader("Progression"));
  col(editor, card({ gap: 8, children: [
    T("Bench press", { size: 13, weight: "black", color: "ink" }),
    gridRow(["Week", "Sets", "Reps", "kg"], { header: true }),
    gridRow(["W1", 4, 8, 60]),
    gridRow(["W2", 4, 8, 62.5]),
    gridRow(["W3", 4, 6, 65]),
  ] }));
  col(editor, (function () {
    var r = F("r", { dir: "h", gap: 8, w: "fill", pad: { t: 8 } });
    add(r, button("Paste import", { variant: "secondary", icon: "copy", full: true }));
    add(r, button("Save plan", { full: true }));
    return r;
  })());

  return [empty, list, assign, editor];
}

function assignRow(name, meta, emoji, alreadyAssigned) {
  var row = F("assign/" + name, {
    dir: "h", gap: 10, pad: 10, radius: RADIUS.field, fill: "inset", align: "CENTER", w: "fill",
  });
  add(row, iconTile(emoji, "accent", 32));
  var t = F("t", { dir: "v", gap: 1, w: "fill" });
  add(t, T(name, { size: 13, weight: "black", color: "ink" }));
  add(t, T(meta, { size: 10, weight: "semibold", color: "muted", w: "fill" }));
  add(row, t);
  if (alreadyAssigned) add(row, pill("Scheduled", "accent"));
  else add(row, toggle(false));
  return row;
}

/* ================= Coach exercises ================= */

function buildCoachExerciseScreens() {
  var s = reg("Coach exercises", screen("Coach exercises"));
  col(s, screenTitle({ title: "Exercises", right: button("New", { size: "sm", icon: "plus" }) }));
  col(s, segmented(["Your exercises", "Database"], 0));
  col(s, textField("Search your exercises", { placeholder: true, trailing: icon("search", 16, "muted") }));
  col(s, T("Exercises you set up here become the defaults on every plan you write, and every athlete you assign to.", {
    size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
  }));
  col(s, sectionHeader("Push", pill("8", "category/push")));
  col(s, libraryRow("Bench press", "Barbell · 4 × 8 · load + reps", "category/push"));
  col(s, libraryRow("Incline dumbbell press", "Dumbbell · 3 × 10", "category/push"));
  col(s, libraryRow("Overhead press", "Barbell · 4 × 6", "category/push"));
  col(s, sectionHeader("Pull", pill("7", "category/pull")));
  col(s, libraryRow("Lat pulldown", "Cable · 4 × 10", "category/pull"));
  col(s, libraryRow("Barbell row", "Barbell · 4 × 8", "category/pull"));
  col(s, sectionHeader("Legs", pill("6", "category/legs")));
  col(s, libraryRow("Back squat", "Barbell · 5 × 5", "category/legs"));
  col(s, libraryRow("Romanian deadlift", "Barbell · 3 × 8", "category/legs"));
  attachTabBar(s, COACH_TABS, "exercises");
  return [s];
}

/* ================= Coach's own training ================= */

function buildCoachTrainingScreens() {
  var off = reg("My training · Off", screen("Coach training off"));
  col(off, screenTitle({ title: "My training" }));
  col(off, card({ gap: 6, children: [
    T("Train with AntRep too", { size: 14, weight: "black", color: "ink" }),
    T("Turn on your athlete side to log your own workouts against your own plan. Same account.", {
      size: 12, weight: "semibold", color: "muted", w: "fill", lineHeight: 17,
    }),
    button("Enable my athlete profile", { full: true }),
  ] }));
  attachTabBar(off, COACH_TABS, "training");

  var today = reg("My training · Today", screen("Coach training today"));
  col(today, segmented(["Today", "My plans", "Progress"], 0, { compact: true, w: 240 }));
  col(today, screenTitle({ date: "Thursday, 13 August", title: "Evening, Sam", quote: "Coach yourself first" }));
  col(today, dateSwitcher("Today", true));
  col(today, dayHeading("🦵", "#7651d3", "Lower B", "Thu · 13 August · today · 4 exercises"));
  col(today, segmentBlock({
    title: "Lower B", tint: "#7651d3", meta: "1/4 · STRENGTH · Thu 13 Aug", ratio: 0.25,
    exercises: [
      exerciseLogCard({ name: "Front squat", target: "4 × 6 · 80kg · RPE 8", emoji: "🦵", tint: "#7651d3", sets: [[80, 6], [80, 6]], rpe: 8, footer: false }),
      exerciseLogCard({ name: "Leg press", target: "3 × 12 · 160kg", emoji: "🦵", tint: "#7651d3", footer: false }),
    ],
  }));
  attachTabBar(today, COACH_TABS, "training");

  var myPlans = reg("My training · Plans", screen("Coach training plans"));
  col(myPlans, segmented(["Today", "My plans", "Progress"], 1, { compact: true, w: 240 }));
  col(myPlans, screenTitle({ title: "My training plans" }));
  col(myPlans, segmented(["Current", "History"], 0));
  col(myPlans, listGroup("Self-assigned", "Coach outlines assigned to your training profile", "🧑‍🏫", 1, "plan", "accent"));
  col(myPlans, planCard({
    name: "Hypertrophy Block 2", meta: "Self-assigned · 13 Aug – 24 Sep · week 2 of 6",
    status: { label: "Active", tint: "accent" }, actions: [{ label: "View plan" }, { label: "Batch log" }],
  }));
  col(myPlans, listGroup("Athlete-side plans", "Plans owned and activated from this training profile", "✍️", 1, "plan", "muted"));
  col(myPlans, planCard({ name: "Weekend conditioning", meta: "Own plan · 2 days / week", status: { label: "Template", tint: "muted" }, actions: [{ label: "Activate", variant: "primary" }] }));
  attachTabBar(myPlans, COACH_TABS, "training");

  var myProgress = reg("My training · Progress", screen("Coach training progress"));
  col(myProgress, segmented(["Today", "My plans", "Progress"], 2, { compact: true, w: 240 }));
  col(myProgress, screenTitle({ title: "Progress" }));
  col(myProgress, segmented(["Overview", "Plans", "Days", "Exercises"], 0));
  col(myProgress, card({ gap: 12, children: [
    (function () {
      var r = F("r", { dir: "h", gap: 14, w: "fill", align: "CENTER" });
      add(r, progressRing(0.5, { label: "2/4", sublabel: "week" }));
      var t = F("t", { dir: "v", gap: 3, w: "fill" });
      add(t, T("9-day streak", { size: 18, weight: "black", color: "ink" }));
      add(t, T("Level 4 · 2 sessions to your weekly goal", { size: 12, weight: "bold", color: "muted", w: "fill" }));
      add(t, progressBar(0.5, { w: "fill" }));
      add(r, t);
      return r;
    })(),
    (function () {
      var tiles = F("tiles", { dir: "h", gap: 8, w: "fill" });
      add(tiles, statTile("8,120", "kg lifted"));
      add(tiles, statTile("96", "sets"));
      add(tiles, statTile("11", "sessions"));
      add(tiles, statTile("12.0", "km"));
      return tiles;
    })(),
  ] }));
  col(myProgress, sectionHeader("Recent records", null, "trophy"));
  col(myProgress, card({ gap: 0, children: [
    recordRow("Front squat", "80 kg × 6", "Thursday 13 August"),
    recordRow("Deadlift", "140 kg × 3", "Monday 10 August"),
  ] }));
  attachTabBar(myProgress, COACH_TABS, "training");

  return [off, today, myPlans, myProgress];
}

/* ================= page ================= */

async function buildCoachPage(page) {
  buildCoachEntryScreens();
  buildAthletesScreens();
  buildAthleteDetailScreens();
  buildCoachPlansScreens();
  buildCoachExerciseScreens();
  buildCoachTrainingScreens();
  buildSettingsScreens("coach");

  layoutRows(page, [
    {
      label: "1 · Getting in",
      note: "Same auth as the athlete portal, reached at /coach. The role gate appears when the account has no coach profile yet.",
      ids: ["Auth · Coach portal", "Coach role gate"],
    },
    {
      label: "2 · Athletes — the home tab",
      note: "The coach's default landing. Invite codes sit above the roster; an unread badge marks anyone who has written since you last looked.",
      ids: ["Athletes · Empty", "Athletes · List", "Athletes · Invite"],
    },
    {
      label: "3 · One athlete, four lenses",
      note: "Overview answers “what did they do”, Progress “are they improving”, Plans “what are they on”, Coaching “what have we said”.",
      ids: ["Athlete · Overview", "Athlete · Progress", "Athlete · Plans", "Athlete · Coaching",
        "Athlete · Customise plan", "Athlete · Export"],
    },
    {
      label: "4 · Plans — build once, assign many",
      note: "Assigning copies the outline onto the athlete, so customising afterwards never edits the template.",
      ids: ["Coach plans · Empty", "Coach plans · List", "Coach plans · Assign", "Coach plan editor"],
    },
    {
      label: "5 · Exercises",
      note: "The coach's own setups become the defaults on every plan they write.",
      ids: ["Coach exercises"],
    },
    {
      label: "6 · My training — the coach as athlete",
      note: "This tab re-enters the athlete app against the coach's own athlete profile, with a three-way switch instead of the tab bar.",
      ids: ["My training · Off", "My training · Today", "My training · Plans", "My training · Progress"],
    },
    {
      label: "7 · Settings",
      note: "Same appearance system as the athlete side, plus invite management and report export.",
      ids: ["Coach settings"],
    },
  ]);
}

/* ==== 70-flow.js ================================================== */
/* ------------------------------------------------------------------
 * The flow map, and the prototype links between the real screens.
 *
 * Figma Design has no connector node — figma.createConnector() is FigJam
 * only — so the arrows are drawn as vectors with an arrow stroke cap.
 * ------------------------------------------------------------------ */

var NODE_W = 190;
var NODE_H = 74;
var COL_W = 268;
var ROW_H = 108;

/** id -> node box on the flow map. */
var FLOW_NODES = {};

/** A box on the map. `kind` tints it: screen, overlay, decision, exit. */
function flowNode(page, id, o) {
  o = o || {};
  var tint = o.kind === "decision" ? "gold"
    : o.kind === "overlay" ? "muted"
    : o.kind === "exit" ? "danger"
    : "accent";

  var n = F(id, {
    dir: "v", gap: 3, w: NODE_W, h: o.kind === "decision" ? NODE_H : NODE_H,
    pad: { l: 12, r: 12, t: 10, b: 10 }, radius: o.kind === "decision" ? 20 : 14,
    fill: "surface", stroke: tint, strokeWeight: 2, justify: "CENTER",
  });
  setMode(n, "Light");
  add(n, T(o.label || id, { size: 13, weight: "black", color: "ink", w: "fill", lineHeight: 16 }));
  if (o.note) add(n, T(o.note, { size: 10, weight: "semibold", color: "muted", w: "fill", lineHeight: 13 }));

  page.appendChild(n);
  n.x = o.col * COL_W;
  n.y = o.row * ROW_H;
  FLOW_NODES[id] = n;
  return n;
}

/** A lane heading above a band of the map. */
function laneLabel(page, text, note, x, y) {
  var l = F("lane/" + text, { dir: "v", gap: 4 });
  setMode(l, "Light");
  add(l, T(text, { size: 30, weight: "black", color: "ink" }));
  if (note) add(l, T(note, { size: 14, weight: "semibold", color: "muted", w: 720, lineHeight: 19 }));
  page.appendChild(l);
  l.x = x;
  l.y = y;
  return l;
}

/**
 * An arrow from one map node to another. Routes straight when the two are
 * level, and as an elbow otherwise, so nothing crosses a node box.
 *
 * The arrowhead is a per-vertex stroke cap set through the vector network:
 * a VectorNode's `strokeCap` applies to *both* ends, which would put a head
 * on the tail as well.
 */
async function flowArrow(page, fromId, toId, label, o) {
  o = o || {};
  var a = FLOW_NODES[fromId];
  var b = FLOW_NODES[toId];
  if (!a || !b) {
    console.warn("flow arrow missing node: " + fromId + " -> " + toId);
    return null;
  }

  var side = o.side || (b.x >= a.x + a.width ? "right" : b.x + b.width <= a.x ? "left" : "down");
  var x1, y1, x2, y2;
  if (side === "right") {
    x1 = a.x + a.width; y1 = a.y + a.height / 2;
    x2 = b.x; y2 = b.y + b.height / 2;
  } else if (side === "left") {
    x1 = a.x; y1 = a.y + a.height / 2;
    x2 = b.x + b.width; y2 = b.y + b.height / 2;
  } else {
    x1 = a.x + a.width / 2; y1 = a.y + a.height;
    x2 = b.x + b.width / 2; y2 = b.y;
  }

  // Waypoints: an elbow unless the two ends already line up.
  var pts;
  if (side === "down") {
    var midY = (y1 + y2) / 2;
    pts = [[x1, y1], [x1, midY], [x2, midY], [x2, y2]];
  } else if (Math.abs(y1 - y2) < 2) {
    pts = [[x1, y1], [x2, y2]];
  } else {
    var midX = (x1 + x2) / 2;
    pts = [[x1, y1], [midX, y1], [midX, y2], [x2, y2]];
  }

  // Vector geometry is in the node's own space, so shift to a local origin
  // and move the node there instead.
  var minX = pts[0][0], minY = pts[0][1];
  for (var p = 1; p < pts.length; p++) {
    minX = Math.min(minX, pts[p][0]);
    minY = Math.min(minY, pts[p][1]);
  }

  var vertices = [];
  var segments = [];
  for (var i = 0; i < pts.length; i++) {
    vertices.push({
      x: pts[i][0] - minX,
      y: pts[i][1] - minY,
      strokeCap: i === pts.length - 1 ? "ARROW_LINES" : "NONE",
      strokeJoin: "ROUND",
      cornerRadius: 8,
    });
    if (i > 0) segments.push({ start: i - 1, end: i });
  }

  var v = figma.createVector();
  v.name = fromId + " → " + toId;
  v.fills = [];
  v.strokes = [paint(o.tint || "muted")];
  v.strokeWeight = 2;
  v.strokeJoin = "ROUND";
  if (o.dashed) v.dashPattern = [6, 5];
  page.appendChild(v);
  await v.setVectorNetworkAsync({ vertices: vertices, segments: segments, regions: [] });
  v.x = minX;
  v.y = minY;

  if (label) {
    var chip = F("label", {
      dir: "h", pad: { l: 8, r: 8, t: 3, b: 3 }, radius: RADIUS.pill,
      fill: "bg", stroke: "line", align: "CENTER",
    });
    setMode(chip, "Light");
    add(chip, T(label, { size: 10, weight: "black", color: "muted" }));
    page.appendChild(chip);
    chip.x = (x1 + x2) / 2 - chip.width / 2;
    chip.y = (y1 + y2) / 2 - chip.height / 2;
  }
  return v;
}

/** A legend so the map reads without explanation. */
function flowLegend(page, x, y) {
  var l = F("Legend", { dir: "h", gap: 20, pad: 16, radius: 14, fill: "surface", stroke: "line", align: "CENTER" });
  setMode(l, "Light");
  var kinds = [
    ["accent", "Screen"],
    ["muted", "Sheet or dialog"],
    ["gold", "Decision"],
    ["danger", "Leaves the portal"],
  ];
  for (var i = 0; i < kinds.length; i++) {
    var item = F("i", { dir: "h", gap: 8, align: "CENTER" });
    var chip = F("c", { dir: "none", w: 22, h: 16, radius: 5, fill: "surface", stroke: kinds[i][0], strokeWeight: 2 });
    add(item, chip);
    add(item, T(kinds[i][1], { size: 12, weight: "bold", color: "ink" }));
    add(l, item);
  }
  page.appendChild(l);
  l.x = x;
  l.y = y;
  return l;
}

/* ================= the map ================= */

async function buildFlowMap(page) {
  laneLabel(page, "Athlete", "Signed out to fully logged, including the back-dating paths that make the app usable after a missed week.", 0, -160);
  flowLegend(page, 0, -80);

  /* --- athlete lane --- */
  flowNode(page, "a.open", { label: "Open antrep.app", note: "Portal · role = athlete", col: 0, row: 0 });
  flowNode(page, "a.session", { label: "Signed in?", kind: "decision", col: 1, row: 0 });
  flowNode(page, "a.auth", { label: "Auth · Sign in", note: "or Create account", col: 2, row: -1 });
  flowNode(page, "a.verify", { label: "Verify email", note: "New accounts only", col: 3, row: -1 });
  flowNode(page, "a.profile", { label: "Athlete profile on?", kind: "decision", col: 2, row: 1 });
  flowNode(page, "a.gate", { label: "Role gate", note: "Enable athlete profile", col: 3, row: 2 });
  flowNode(page, "a.home", { label: "Home · Today", note: "Default tab", col: 4, row: 0 });

  await flowArrow(page, "a.open", "a.session");
  await flowArrow(page, "a.session", "a.auth", "no");
  await flowArrow(page, "a.auth", "a.verify");
  await flowArrow(page, "a.session", "a.profile", "yes");
  await flowArrow(page, "a.profile", "a.gate", "no");
  await flowArrow(page, "a.profile", "a.home", "yes");
  await flowArrow(page, "a.verify", "a.home");
  await flowArrow(page, "a.gate", "a.home");

  /* Home branches */
  flowNode(page, "a.start", { label: "Start dialog", kind: "overlay", note: "Timer, or log only", col: 5, row: -2 });
  flowNode(page, "a.countdown", { label: "Countdown", kind: "overlay", note: "3 · 2 · 1 · GO", col: 6, row: -2 });
  flowNode(page, "a.live", { label: "Workout live", note: "Timer + inline logging", col: 7, row: -2 });
  flowNode(page, "a.datesheet", { label: "Date search", kind: "overlay", note: "Jump to any past day", col: 5, row: 0 });
  flowNode(page, "a.late", { label: "Late log", note: "Back-dated session", col: 6, row: 0 });
  flowNode(page, "a.makeup", { label: "Another day", kind: "overlay", note: "Run a skipped workout", col: 5, row: 2 });

  await flowArrow(page, "a.home", "a.start", "tap Start now");
  await flowArrow(page, "a.start", "a.countdown");
  await flowArrow(page, "a.countdown", "a.live");
  await flowArrow(page, "a.home", "a.datesheet", "tap the date");
  await flowArrow(page, "a.datesheet", "a.late");
  await flowArrow(page, "a.home", "a.makeup", "Another day");
  await flowArrow(page, "a.makeup", "a.countdown", null, { dashed: true });

  /* Tabs */
  flowNode(page, "a.plans", { label: "Plans", note: "Current · History", col: 4, row: 4 });
  flowNode(page, "a.plandetail", { label: "Plan detail", col: 5, row: 4 });
  flowNode(page, "a.planeditor", { label: "Plan editor", col: 6, row: 4 });
  flowNode(page, "a.paste", { label: "Paste import", col: 7, row: 4 });
  flowNode(page, "a.activate", { label: "Activate plan", kind: "overlay", col: 5, row: 5 });

  flowNode(page, "a.coach", { label: "Coach", note: "Activity · Check-ins", col: 4, row: 6 });
  flowNode(page, "a.nocoach", { label: "No coach linked", note: "Empty state", col: 5, row: 6 });

  flowNode(page, "a.progress", { label: "Progress", note: "Overview · Plans · Days · Exercises", col: 4, row: 8 });
  flowNode(page, "a.dimension", { label: "Dimension detail", col: 5, row: 7 });
  flowNode(page, "a.exercise", { label: "Exercise detail", col: 5, row: 8 });
  flowNode(page, "a.session2", { label: "Session detail", col: 5, row: 9 });
  flowNode(page, "a.day", { label: "Day detail", col: 5, row: 10 });

  flowNode(page, "a.library", { label: "Library", note: "Yours · Database", col: 4, row: 12 });
  flowNode(page, "a.setup", { label: "Exercise setup", kind: "overlay", col: 5, row: 12 });

  flowNode(page, "a.settings", { label: "Settings", col: 4, row: 14 });
  flowNode(page, "a.colour", { label: "Colour sheet", kind: "overlay", note: "33 palettes · light + dark", col: 5, row: 13 });
  flowNode(page, "a.batch", { label: "Batch log", note: "A whole block at once", col: 5, row: 14 });
  flowNode(page, "a.import", { label: "Import training", col: 5, row: 15 });
  flowNode(page, "a.guide", { label: "Guide", col: 5, row: 16 });
  flowNode(page, "a.tocoach", { label: "Coach portal", kind: "exit", note: "Same account, other side", col: 6, row: 17 });

  var tabTargets = ["a.plans", "a.coach", "a.progress", "a.library", "a.settings"];
  for (var t = 0; t < tabTargets.length; t++) {
    await flowArrow(page, "a.home", tabTargets[t], t === 0 ? "tab bar" : null, { side: "down", dashed: true });
  }

  await flowArrow(page, "a.plans", "a.plandetail");
  await flowArrow(page, "a.plandetail", "a.planeditor");
  await flowArrow(page, "a.planeditor", "a.paste");
  await flowArrow(page, "a.plans", "a.activate", "Activate");
  await flowArrow(page, "a.coach", "a.nocoach", "no coach");
  await flowArrow(page, "a.progress", "a.dimension");
  await flowArrow(page, "a.progress", "a.exercise");
  await flowArrow(page, "a.progress", "a.session2");
  await flowArrow(page, "a.progress", "a.day");
  await flowArrow(page, "a.library", "a.setup");
  await flowArrow(page, "a.settings", "a.colour");
  await flowArrow(page, "a.settings", "a.batch");
  await flowArrow(page, "a.settings", "a.import");
  await flowArrow(page, "a.settings", "a.guide");
  await flowArrow(page, "a.settings", "a.tocoach", "switch portal");
  await flowArrow(page, "a.plans", "a.batch", null, { dashed: true });

  /* --- coach lane --- */
  var OFFSET = 21 * ROW_H;
  laneLabel(page, "Coach", "One roster, one plan library, and the coach's own training on the same account.", 0, OFFSET - 160);

  var coachNode = function (id, o) {
    o.row = o.row + 21;
    return flowNode(page, id, o);
  };

  coachNode("c.open", { label: "Open antrep.app/coach", note: "Portal · role = coach", col: 0, row: 0 });
  coachNode("c.session", { label: "Signed in?", kind: "decision", col: 1, row: 0 });
  coachNode("c.auth", { label: "Auth · Coach portal", col: 2, row: -1 });
  coachNode("c.profile", { label: "Coach profile on?", kind: "decision", col: 2, row: 1 });
  coachNode("c.gate", { label: "Coach role gate", note: "Enable coach profile", col: 3, row: 2 });
  coachNode("c.athletes", { label: "Athletes", note: "Default tab · roster", col: 4, row: 0 });

  await flowArrow(page, "c.open", "c.session");
  await flowArrow(page, "c.session", "c.auth", "no");
  await flowArrow(page, "c.session", "c.profile", "yes");
  await flowArrow(page, "c.profile", "c.gate", "no");
  await flowArrow(page, "c.profile", "c.athletes", "yes");
  await flowArrow(page, "c.auth", "c.athletes");
  await flowArrow(page, "c.gate", "c.athletes");

  coachNode("c.invite", { label: "Invite code", kind: "overlay", note: "Athlete enters it in Settings", col: 5, row: -2 });
  coachNode("c.detail", { label: "Athlete · Overview", note: "What did they do", col: 5, row: 0 });
  coachNode("c.aprogress", { label: "Athlete · Progress", note: "Are they improving", col: 6, row: -1 });
  coachNode("c.aplans", { label: "Athlete · Plans", note: "What are they on", col: 6, row: 0 });
  coachNode("c.acoaching", { label: "Athlete · Coaching", note: "What have we said", col: 6, row: 1 });
  coachNode("c.customise", { label: "Customise plan", note: "Their copy only", col: 7, row: 0 });
  coachNode("c.export", { label: "Export report", kind: "overlay", col: 7, row: -1 });

  await flowArrow(page, "c.athletes", "c.invite", "Invite");
  await flowArrow(page, "c.athletes", "c.detail", "tap an athlete");
  await flowArrow(page, "c.detail", "c.aprogress");
  await flowArrow(page, "c.detail", "c.aplans");
  await flowArrow(page, "c.detail", "c.acoaching");
  await flowArrow(page, "c.aplans", "c.customise");
  await flowArrow(page, "c.aprogress", "c.export");

  coachNode("c.plans", { label: "Plans", note: "Templates + assigned", col: 4, row: 4 });
  coachNode("c.assign", { label: "Assign sheet", kind: "overlay", note: "Copies onto the athlete", col: 5, row: 3 });
  coachNode("c.planeditor", { label: "Coach plan editor", note: "Weeks · days · progression", col: 5, row: 4 });
  coachNode("c.exercises", { label: "Exercises", note: "Defaults for every plan", col: 4, row: 6 });
  coachNode("c.training", { label: "My training", note: "Today · My plans · Progress", col: 4, row: 8 });
  coachNode("c.trainingoff", { label: "My training · Off", note: "Athlete side not enabled", col: 5, row: 9 });
  coachNode("c.settings", { label: "Coach settings", col: 4, row: 11 });
  coachNode("c.toathlete", { label: "Athlete portal", kind: "exit", note: "Same account, other side", col: 5, row: 11 });

  var coachTabs = ["c.plans", "c.exercises", "c.training", "c.settings"];
  for (var ct = 0; ct < coachTabs.length; ct++) {
    await flowArrow(page, "c.athletes", coachTabs[ct], ct === 0 ? "tab bar" : null, { side: "down", dashed: true });
  }
  await flowArrow(page, "c.plans", "c.assign", "Assign");
  await flowArrow(page, "c.plans", "c.planeditor", "Edit");
  await flowArrow(page, "c.assign", "c.aplans", null, { dashed: true });
  await flowArrow(page, "c.training", "c.trainingoff", "not enabled");
  await flowArrow(page, "c.settings", "c.toathlete", "switch portal");
}

/* ================= prototype links ================= */

/**
 * Real prototype navigation between the generated screens, so the flow can
 * be clicked through in presentation mode rather than only read.
 */
var PROTOTYPE_LINKS = [
  ["Loading", "Auth · Sign in"],
  ["Auth · Sign in", "Auth · Create account"],
  ["Auth · Create account", "Verify email"],
  ["Verify email", "Home · Today"],
  ["Role gate", "Home · Today"],

  ["Home · Today", "Home · Start dialog"],
  ["Home · Start dialog", "Home · Countdown"],
  ["Home · Countdown", "Home · Workout live"],
  ["Home · Workout live", "Home · Today"],
  ["Home · Date search", "Home · Late log"],
  ["Home · Late log", "Home · Today"],
  ["Home · Another day", "Home · Countdown"],
  ["Home · Rest day", "Home · Another day"],
  ["Home · No plan", "Plans · Current"],

  ["Plans · Current", "Plan detail"],
  ["Plans · Activate", "Plans · Current"],
  ["Plans · History", "Plan detail"],
  ["Plan detail", "Plan editor"],
  ["Plan editor", "Paste import"],
  ["Paste import", "Plan editor"],

  ["Coach · Not linked", "Settings"],
  ["Coach · Activity", "Coach · Check-ins"],
  ["Coach · Check-ins", "Coach · Activity"],

  ["Progress · Overview", "Dimension detail"],
  ["Progress · Plans", "Progress · Overview"],
  ["Progress · Days", "Day detail"],
  ["Progress · Exercises", "Exercise detail"],
  ["Day detail", "Session detail"],
  ["Dimension detail", "Exercise detail"],
  ["Exercise detail", "Progress · Exercises"],
  ["Session detail", "Progress · Days"],

  ["Library · Yours", "Library · Database"],
  ["Library · Database", "Library · Setup sheet"],
  ["Library · Setup sheet", "Library · Yours"],

  ["Settings", "Settings · Colour"],
  ["Settings · Colour", "Settings"],
  ["Batch log", "Plans · Current"],
  ["Import training", "Settings"],
  ["Guide", "Settings"],

  /* coach */
  ["Auth · Coach portal", "Athletes · List"],
  ["Coach role gate", "Athletes · List"],
  ["Athletes · Empty", "Athletes · Invite"],
  ["Athletes · List", "Athlete · Overview"],
  ["Athletes · Invite", "Athletes · List"],
  ["Athlete · Overview", "Athlete · Progress"],
  ["Athlete · Progress", "Athlete · Plans"],
  ["Athlete · Plans", "Athlete · Customise plan"],
  ["Athlete · Coaching", "Athlete · Overview"],
  ["Athlete · Customise plan", "Athlete · Plans"],
  ["Athlete · Export", "Athlete · Overview"],
  ["Coach plans · Empty", "Coach plan editor"],
  ["Coach plans · List", "Coach plans · Assign"],
  ["Coach plans · Assign", "Coach plans · List"],
  ["Coach plan editor", "Coach plans · List"],
  ["Coach exercises", "Coach plans · List"],
  ["My training · Off", "Coach settings"],
  ["My training · Today", "My training · Plans"],
  ["My training · Plans", "My training · Progress"],
  ["My training · Progress", "My training · Today"],

  /* the two portals meet */
  ["Settings", "Auth · Coach portal"],
  ["Coach settings", "Home · Today"],
];

async function wirePrototypes() {
  var wired = 0;
  var missing = [];
  for (var i = 0; i < PROTOTYPE_LINKS.length; i++) {
    var from = SCREENS[PROTOTYPE_LINKS[i][0]];
    var to = SCREENS[PROTOTYPE_LINKS[i][1]];
    if (!from || !to) {
      missing.push(PROTOTYPE_LINKS[i].join(" → "));
      continue;
    }
    try {
      var existing = from.reactions ? from.reactions.slice() : [];
      existing.push({
        trigger: { type: "ON_CLICK" },
        actions: [{
          type: "NODE",
          destinationId: to.id,
          navigation: "NAVIGATE",
          transition: {
            type: "SMART_ANIMATE",
            easing: { type: "EASE_OUT" },
            duration: 0.3,
          },
          preserveScrollPosition: false,
        }],
      });
      await from.setReactionsAsync(existing);
      wired++;
    } catch (e) {
      missing.push(PROTOTYPE_LINKS[i].join(" → ") + " (" + e.message + ")");
    }
  }
  if (missing.length) console.warn("prototype links skipped:\n" + missing.join("\n"));
  return wired;
}

/* ==== 99-main.js ================================================== */
/* ------------------------------------------------------------------
 * Entry point: load fonts, prepare the pages, run the requested parts.
 *
 * Only pages whose names start with PAGE_PREFIX are touched, and they are
 * cleared before regenerating — so re-running refreshes the system without
 * stacking duplicates, and never disturbs anything else in the file.
 * ------------------------------------------------------------------ */

var PAGE_PREFIX = "AntRep · ";

var PAGES = {
  foundations: PAGE_PREFIX + "Foundations",
  components: PAGE_PREFIX + "Components",
  athlete: PAGE_PREFIX + "Athlete flow",
  coach: PAGE_PREFIX + "Coach flow",
  flowmap: PAGE_PREFIX + "Flow map",
};

/**
 * Resolve the type families, falling back so a file without the Google
 * fonts still generates rather than throwing on the first text node.
 */
async function loadFonts() {
  var sansCandidates = ["Nunito", "Inter"];
  var quoteCandidates = ["Libre Baskerville", "Playfair Display", "Georgia", "Inter"];
  var weights = ["Regular", "SemiBold", "Bold", "ExtraBold", "Black"];

  FONT.sans = null;
  for (var i = 0; i < sansCandidates.length && !FONT.sans; i++) {
    try {
      for (var w = 0; w < weights.length; w++) {
        await figma.loadFontAsync({ family: sansCandidates[i], style: weights[w] });
      }
      FONT.sans = sansCandidates[i];
    } catch (e) {
      /* try the next family */
    }
  }
  if (!FONT.sans) {
    // Inter always ships with Figma, but not every weight name does.
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    FONT.sans = "Inter";
    WEIGHT.semibold = "Regular";
    WEIGHT.extrabold = "Bold";
    WEIGHT.black = "Bold";
  }

  FONT.quote = null;
  for (var q = 0; q < quoteCandidates.length && !FONT.quote; q++) {
    try {
      await figma.loadFontAsync({ family: quoteCandidates[q], style: "Italic" });
      FONT.quote = quoteCandidates[q];
      FONT.quoteStyle = "Italic";
    } catch (e) {
      /* try the next family */
    }
  }
  if (!FONT.quote) {
    // No italic anywhere: fall back to the sans face in a weight we know is
    // loaded. Asking for "Italic" here would throw on the first quote line.
    FONT.quote = FONT.sans;
    FONT.quoteStyle = WEIGHT.regular;
  }
}

/** Find one of our pages by name, or create it. Existing content is cleared. */
async function preparePage(name) {
  var page = null;
  for (var i = 0; i < figma.root.children.length; i++) {
    if (figma.root.children[i].name === name) page = figma.root.children[i];
  }
  if (!page) {
    page = figma.createPage();
    page.name = name;
  } else {
    await page.loadAsync();
    var children = page.children.slice();
    for (var c = 0; c < children.length; c++) children[c].remove();
  }
  page.backgrounds = [{ type: "SOLID", color: hexRgb("#f6f6f6") }];
  return page;
}

function status(text) {
  figma.ui.postMessage({ type: "status", text: text });
}

async function run(msg) {
  var parts = msg.parts || {};
  ACTIVE_BG = msg.palette || ACTIVE_BG;
  RENDER_MODE = msg.mode || "Light";

  status("Loading fonts…");
  await loadFonts();

  status("Loading document…");
  await figma.loadAllPagesAsync();

  status("Writing variables…");
  await buildVariables();

  var made = [];

  if (parts.foundations) {
    status("Building foundations…");
    var foundations = await preparePage(PAGES.foundations);
    await buildFoundations(foundations);
    made.push("Foundations");
  }

  if (parts.components) {
    status("Publishing components…");
    var components = await preparePage(PAGES.components);
    await buildComponentLibrary(components);
    made.push("Components");
  }

  if (parts.athlete) {
    status("Drawing athlete screens…");
    var athlete = await preparePage(PAGES.athlete);
    await buildAthletePage(athlete);
    made.push("Athlete flow");
  }

  if (parts.coach) {
    status("Drawing coach screens…");
    var coach = await preparePage(PAGES.coach);
    await buildCoachPage(coach);
    made.push("Coach flow");
  }

  if (parts.flowmap) {
    status("Mapping the flows…");
    var map = await preparePage(PAGES.flowmap);
    await buildFlowMap(map);
    made.push("Flow map");
  }

  var wired = 0;
  if (parts.athlete && parts.coach) {
    status("Wiring prototype links…");
    wired = await wirePrototypes();
  }

  var screenCount = Object.keys(SCREENS).length;
  var summary = made.join(" · ") +
    (screenCount ? "  —  " + screenCount + " screens" : "") +
    (wired ? ", " + wired + " prototype links" : "");

  figma.ui.postMessage({ type: "done", text: "Done. " + summary });
  figma.notify("AntRep design system generated — " + summary);
}

figma.showUI(__html__, { width: 340, height: 520, themeColors: true });

figma.ui.onmessage = async function (msg) {
  if (!msg) return;

  if (msg.type === "ready") {
    var items = BACKGROUNDS.map(function (b) {
      return { key: b.key, label: b.label, family: b.family };
    });
    figma.ui.postMessage({ type: "palettes", items: items, active: ACTIVE_BG });
    return;
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
    return;
  }

  if (msg.type === "run") {
    try {
      await run(msg);
    } catch (e) {
      console.error(e);
      figma.ui.postMessage({ type: "error", text: (e && e.message) || String(e) });
    }
  }
};
