/** Re-run the plugin twice and confirm nothing duplicates. */

import { readFileSync } from "node:fs";
import { figma, UI_MESSAGES, WARN, ERR, collections, variables } from "./mock-figma.mjs";

const code = readFileSync(new URL("../code.js", import.meta.url), "utf8");
const exported = new Function(code + "\n;return { SCREENS, PAGES };")();

const msg = {
  type: "run",
  palette: "denim",
  mode: "Light",
  parts: { foundations: true, components: true, athlete: true, coach: true, flowmap: true },
};

const countNodes = (n) => 1 + n.children.reduce((t, c) => t + countNodes(c), 0);
const snapshot = () => ({
  pages: figma.root.children.length,
  pageNames: figma.root.children.map((p) => p.name).join(" | "),
  nodes: figma.root.children.reduce((t, p) => t + countNodes(p), 0),
  collections: collections.length,
  variables: variables.length,
});

await figma.ui.onmessage(msg);
const first = snapshot();

await figma.ui.onmessage(msg);
const second = snapshot();

const err = UI_MESSAGES.filter((m) => m.type === "error");
if (err.length) {
  console.log("FAILED: " + err.map((e) => e.text).join("; "));
  for (const e of ERR) console.log(e);
  process.exit(1);
}

console.log("               first    second");
for (const k of Object.keys(first)) {
  if (k === "pageNames") continue;
  const ok = first[k] === second[k] ? "ok" : "DRIFT";
  console.log(`${k.padEnd(14)} ${String(first[k]).padEnd(8)} ${String(second[k]).padEnd(8)} ${ok}`);
}
console.log("\npages: " + second.pageNames);

const drift = Object.keys(first).filter((k) => k !== "pageNames" && first[k] !== second[k]);
if (drift.length) {
  console.log("\nFAILED — a second run changed: " + drift.join(", "));
  process.exit(1);
}
console.log("\nIdempotent: a second run refreshes in place.");
if (WARN.length) console.log("warnings: " + [...new Set(WARN)].join("; "));
