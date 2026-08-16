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
