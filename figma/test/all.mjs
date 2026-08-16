#!/usr/bin/env node
/**
 * Runs every check against the built bundle.
 *
 * Each check gets a fresh process because the mock keeps module-level
 * document state, and a test that starts from a dirty file proves nothing.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const checks = [
  ["generate everything", "run-plugin.mjs", {}],
  ["fall back to Inter", "run-plugin.mjs", { INTER_ONLY: "1" }],
  ["re-run without duplicating", "test-rerun.mjs", {}],
  ["leave other pages alone", "test-safety.mjs", {}],
  ["generate the athlete flow alone", "test-partial.mjs", { PART: "athlete" }],
  ["generate the coach flow alone", "test-partial.mjs", { PART: "coach" }],
  ["generate foundations alone", "test-partial.mjs", { PART: "foundations" }],
  ["generate components alone", "test-partial.mjs", { PART: "components" }],
  ["generate the flow map alone", "test-partial.mjs", { PART: "flowmap" }],
];

let failed = 0;
for (const [label, file, env] of checks) {
  const r = spawnSync(process.execPath, [join(here, file)], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log((r.stdout || "") + (r.stderr || ""));
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
