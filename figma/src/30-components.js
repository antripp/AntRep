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
