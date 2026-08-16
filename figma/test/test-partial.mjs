/**
 * Each part is independently selectable in the plugin UI, so generating one
 * on its own must not depend on another having run first.
 */

import { readFileSync } from "node:fs";
import { figma, UI_MESSAGES, ERR } from "./mock-figma.mjs";

const code = readFileSync(new URL("../code.js", import.meta.url), "utf8");
const exported = new Function(code + "\n;return { SCREENS };")();

const only = process.env.PART;
const parts = { foundations: false, components: false, athlete: false, coach: false, flowmap: false };
parts[only] = true;

await figma.ui.onmessage({ type: "run", palette: "denim", mode: "Light", parts });

const err = UI_MESSAGES.filter((m) => m.type === "error");
if (err.length) {
  console.log(`FAILED (${only}): ` + err.map((e) => e.text).join("; "));
  for (const e of ERR) console.log(e);
  process.exit(1);
}

// A screen that never got placed is a silent hole in the flow.
const page = figma.root.children.find((p) => p.name.indexOf("AntRep · ") === 0);
const placed = new Set();
const walk = (n) => { placed.add(n); n.children.forEach(walk); };
figma.root.children.forEach((p) => p.children.forEach(walk));

const orphans = Object.keys(exported.SCREENS).filter((id) => !placed.has(exported.SCREENS[id]));

console.log(`${only}: ${figma.root.children.length} page(s), ${Object.keys(exported.SCREENS).length} screens built`);
if (orphans.length) {
  console.log("FAILED — screens built but never placed on a page:");
  for (const o of orphans) console.log("  " + o);
  process.exit(1);
}
console.log(page ? `  page: ${page.name}` : "  (no page)");
