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
