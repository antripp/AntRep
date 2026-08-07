/**
 * Capture the screenshots used by the guide (in-app and PDF).
 *
 * Drives the real app in demo mode with Playwright, using the Chrome already
 * installed on the machine — no browser download. Re-run it whenever the UI
 * moves and both the in-app guide and the PDF pick up the new shots.
 *
 *   npm run dev            # in another terminal
 *   npm run guide:shots    # optionally BASE=http://localhost:5173
 *
 * Writes public/guide/*.png. Demo data is seeded and fake, so nothing real
 * ever ends up in a screenshot.
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "guide");
const BASE = process.env.BASE ?? "http://localhost:5173";

/**
 * Phone-shaped and retina — the app is mobile-first and the guide shows it
 * that way. The analytics screens get a wider frame because their tables set
 * a min-width well past a phone and would otherwise be sliced down the middle.
 */
const NARROW = 390;
// Past Tailwind's `md`, where Screen widens to max-w-3xl and the log tables
// finally get their full width instead of losing the last column.
const WIDE = 820;
const HEIGHT = 844;
const SCALE = 2;

const shots = [];

async function shoot(page, name, { width = NARROW, scrollTo = null } = {}) {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.waitForTimeout(350);

  if (scrollTo) await page.locator(scrollTo).first().scrollIntoViewIfNeeded();
  // Otherwise start at the top: several screens auto-scroll (the log grid jumps
  // to the newest session) and a shot mid-content loses its own heading.
  else await page.evaluate(() => window.scrollTo(0, 0));

  await page.waitForTimeout(400); // let transitions and charts settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  shots.push(name);
  process.stdout.write(`  ${name} (${width}px)\n`);
}

/** Click the first button whose text contains `text`. */
async function tap(page, text, { last = false, timeout = 8000 } = {}) {
  const all = page.locator("button", { hasText: text });
  const target = last ? all.last() : all.first();
  await target.waitFor({ state: "visible", timeout });
  await target.click();
  await page.waitForTimeout(280);
}

/** Bottom tab bar entries repeat words used elsewhere, so always take the last. */
const tab = (page, name) => tap(page, name, { last: true });

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const newSession = () =>
    browser.newContext({
      viewport: { width: NARROW, height: HEIGHT },
      deviceScaleFactor: SCALE,
      colorScheme: "dark",
    });

  let context = await newSession();
  let page = await context.newPage();

  // ---- Sign in ------------------------------------------------------
  // No ?demo=1 here, so the shot shows the sign-in screen as it really looks.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shoot(page, "auth-signin");

  // ---- Athlete ------------------------------------------------------
  await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
  await tap(page, "Alex Reps");
  await page.waitForTimeout(700);
  await shoot(page, "athlete-home");

  await page.locator('button[aria-label="Search by date"]').first().click();
  await page.waitForTimeout(350);
  await shoot(page, "athlete-date-search");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await tab(page, "Plans");
  await shoot(page, "athlete-plans");

  await tab(page, "Coach");
  await shoot(page, "athlete-coach");

  await tab(page, "Progress");
  await shoot(page, "athlete-progress-overview", { width: WIDE });

  await tap(page, "Plans", { last: false });
  await page.waitForTimeout(350);
  await shoot(page, "athlete-progress-plans", { width: WIDE });

  await tap(page, "Hypertrophy block A");
  await shoot(page, "athlete-progress-sessions", { width: WIDE });

  await tap(page, "Push day");
  await page.waitForTimeout(400);
  await tap(page, "Expand all");
  await shoot(page, "athlete-session-detail", { width: WIDE });

  await page.locator('button[aria-label="Back to sessions"]').click();
  await page.waitForTimeout(300);
  await tap(page, "Exercises");
  await page.waitForTimeout(350);
  await shoot(page, "athlete-progress-exercises", { width: WIDE });

  await tap(page, "Single-arm dumbbell row");
  await shoot(page, "athlete-exercise-detail", { width: WIDE });

  await tab(page, "Library");
  await shoot(page, "athlete-library");

  await tab(page, "Settings");
  await shoot(page, "athlete-settings");

  // ---- Logging ------------------------------------------------------
  // Last, and in its own session: starting a workout awards XP and adds a
  // session, which would otherwise leave every later shot showing different
  // streak and volume numbers than the ones above.
  await context.close();
  context = await newSession();
  page = await context.newPage();

  await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
  await tap(page, "Alex Reps");
  await page.waitForTimeout(700);

  await tap(page, "Start now");
  await shoot(page, "athlete-start-dialog");
  await tap(page, "Just log without a timer");
  await page.waitForTimeout(500);

  await tap(page, "Barbell or goblet squat");
  await tap(page, "Add set");
  await shoot(page, "athlete-logging", { scrollTo: 'input[inputmode="decimal"]' });

  // ---- Coach --------------------------------------------------------
  // A fresh context, or the coach portal inherits the athlete's demo session
  // and offers to add a coach profile to that account instead.
  await context.close();
  context = await newSession();
  page = await context.newPage();

  await page.goto(`${BASE}/coach?demo=1`, { waitUntil: "networkidle" });
  await tap(page, "Coach Sam");
  await page.waitForTimeout(800);
  await shoot(page, "coach-athletes");

  await tap(page, "Alex Reps");
  await page.waitForTimeout(600);
  await shoot(page, "coach-athlete-overview", { width: WIDE });

  await tap(page, "Progress");
  await page.waitForTimeout(500);
  await shoot(page, "coach-athlete-progress", { width: WIDE });

  await tap(page, "Assign");
  await page.waitForTimeout(400);
  await shoot(page, "coach-assign", { width: WIDE });

  await page.locator('button[aria-label="Export report"]').click();
  await page.waitForTimeout(400);
  await shoot(page, "coach-export");
  await page.keyboard.press("Escape");

  await tab(page, "Plans");
  await page.waitForTimeout(400);
  await shoot(page, "coach-plans");

  await browser.close();

  const written = (await readdir(OUT)).filter((f) => f.endsWith(".png"));
  console.log(`\n${written.length} screenshots in public/guide`);
}

main().catch(async (error) => {
  console.error(`\nFailed after ${shots.length} shots (${shots.at(-1) ?? "none"}):`);
  console.error(error.message);
  process.exit(1);
});
