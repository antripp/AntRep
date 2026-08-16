#!/usr/bin/env node
/**
 * Bundles figma/src/*.js into the single figma/code.js that manifest.json
 * points at.
 *
 * Figma plugins load one script and Figma's own sandbox has no module loader,
 * so the sources are plain scripts concatenated in filename order (00-, 10-,
 * …). Every file may use anything a lower-numbered one declares. No bundler,
 * no dependencies — `node scripts/build-figma-plugin.mjs` is the whole build.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "figma", "src");
const out = join(root, "figma", "code.js");

const files = readdirSync(srcDir)
  .filter((f) => f.endsWith(".js"))
  .sort();

if (!files.length) {
  console.error("no sources in figma/src");
  process.exit(1);
}

const banner = `/**
 * AntRep Design System — generated bundle. Do not edit.
 *
 * Source of truth: figma/src/*.js
 * Rebuild:         node scripts/build-figma-plugin.mjs
 */
`;

const body = files
  .map((f) => {
    const code = readFileSync(join(srcDir, f), "utf8").trimEnd();
    return `/* ==== ${f} ${"=".repeat(Math.max(0, 60 - f.length))} */\n${code}\n`;
  })
  .join("\n");

writeFileSync(out, `${banner}\n${body}`);

const lines = body.split("\n").length;
console.log(`figma/code.js  ${files.length} files, ${lines} lines`);
for (const f of files) console.log(`  ${f}`);
