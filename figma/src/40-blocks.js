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
