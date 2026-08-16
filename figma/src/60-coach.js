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
