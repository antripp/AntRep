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
