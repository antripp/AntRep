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
