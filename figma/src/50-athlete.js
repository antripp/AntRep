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
