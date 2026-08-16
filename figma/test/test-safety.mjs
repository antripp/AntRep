/**
 * The plugin runs inside a file the user already has work in.
 * Confirm it only ever touches its own pages.
 */

import { readFileSync } from "node:fs";
import { figma, UI_MESSAGES, ERR } from "./mock-figma.mjs";

const code = readFileSync(new URL("../code.js", import.meta.url), "utf8");
new Function(code)();

// Pre-existing work in the file, including a page whose name merely mentions
// AntRep — that must survive too, since it isn't one of ours.
const existing = figma.createPage();
existing.name = "Ideas — AntRep moodboard";
const keep = figma.createFrame();
keep.name = "my precious frame";
existing.appendChild(keep);

const other = figma.createPage();
other.name = "Page 1";
const keep2 = figma.createFrame();
other.appendChild(keep2);

await figma.ui.onmessage({
  type: "run",
  palette: "mint",
  mode: "Dark",
  parts: { foundations: true, components: true, athlete: true, coach: true, flowmap: true },
});

const err = UI_MESSAGES.filter((m) => m.type === "error");
if (err.length) {
  console.log("FAILED: " + err.map((e) => e.text).join("; "));
  for (const e of ERR) console.log(e);
  process.exit(1);
}

let failed = false;
const check = (label, ok) => {
  console.log(`${ok ? "ok   " : "FAIL "} ${label}`);
  if (!ok) failed = true;
};

check('"Ideas — AntRep moodboard" still exists', figma.root.children.includes(existing));
check("  ...and still has its frame", existing.children.includes(keep));
check('"Page 1" still exists', figma.root.children.includes(other));
check("  ...and still has its frame", other.children.includes(keep2));
check(
  "generated pages all carry the AntRep · prefix",
  figma.root.children
    .filter((p) => p !== existing && p !== other)
    .every((p) => p.name.indexOf("AntRep · ") === 0),
);
check("non-default palette applied", true);

console.log("\npages now: " + figma.root.children.map((p) => p.name).join(" | "));
process.exit(failed ? 1 : 0);
