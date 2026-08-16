/** Execute figma/code.js against the mock API and report what happened. */

import { readFileSync } from "node:fs";
import { figma, NOTIFY, UI_MESSAGES, WARN, ERR, collections, variables } from "./mock-figma.mjs";

const code = readFileSync(new URL("../code.js", import.meta.url), "utf8");

// The bundle is a plain script; run it in this realm so it sees globalThis.figma.
const run = new Function(code + "\n;return { SCREENS, FLOW_NODES, V, FONT, PAGES };");
const exported = run();

if (typeof figma.ui.onmessage !== "function") {
  console.log("FAIL: plugin never registered figma.ui.onmessage");
  process.exit(1);
}

await figma.ui.onmessage({ type: "ready" });

const t0 = Date.now();
await figma.ui.onmessage({
  type: "run",
  palette: "denim",
  mode: "Light",
  parts: { foundations: true, components: true, athlete: true, coach: true, flowmap: true },
});
const ms = Date.now() - t0;

const error = UI_MESSAGES.find((m) => m.type === "error");
if (error) {
  console.log("FAILED: " + error.text);
  for (const e of ERR) console.log("\n" + e);
  process.exit(1);
}

const done = UI_MESSAGES.find((m) => m.type === "done");
const screens = Object.keys(exported.SCREENS);
const nodes = Object.keys(exported.FLOW_NODES);

const countNodes = (n) => 1 + n.children.reduce((t, c) => t + countNodes(c), 0);

console.log("=== RESULT ===");
console.log(done ? done.text : "(no done message)");
console.log(`ran in ${ms}ms`);
console.log(`fonts:      sans=${exported.FONT.sans} quote=${exported.FONT.quote}`);
console.log(`variables:  ${variables.length} in ${collections.length} collections`);
for (const c of collections) {
  console.log(`   ${c.name}  modes: ${c.modes.map((m) => m.name).join(", ")}  vars: ${c.variableIds.length}`);
}
console.log(`tokens in V: ${Object.keys(exported.V).length}`);
console.log(`screens:    ${screens.length}`);
console.log(`flow nodes: ${nodes.length}`);

console.log("\n=== PAGES ===");
for (const p of figma.root.children) {
  console.log(`${p.name.padEnd(28)} ${p.children.length} top-level, ${countNodes(p)} nodes total`);
}

const reactionTotal = screens.reduce((t, s) => t + exported.SCREENS[s].reactions.length, 0);
console.log(`\nprototype reactions set: ${reactionTotal}`);

console.log("\n=== SCREENS ===");
for (const s of screens) console.log("  " + s);

if (WARN.length) {
  console.log("\n=== WARNINGS (" + WARN.length + ") ===");
  const seen = new Map();
  for (const w of WARN) seen.set(w, (seen.get(w) || 0) + 1);
  for (const [w, n] of seen) console.log(`  ${n}x  ${w}`);
}
if (ERR.length) {
  console.log("\n=== CONSOLE ERRORS ===");
  for (const e of ERR) console.log(e);
}
