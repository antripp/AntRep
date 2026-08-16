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
