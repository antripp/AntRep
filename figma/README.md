# AntRep design system — Figma plugin

Generates the whole design system and both end-to-end user flows into a Figma
file: real Variables, real component sets, 60 high-fidelity screens, a flow map
and clickable prototype links.

Everything is derived from the running app, so the file can be regenerated
after a UI change instead of drifting away from the code.

## Install it once

1. Open your AntRep file in the **Figma desktop app** (plugin development is
   desktop-only).
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Choose `figma/manifest.json` from this repo.

It now appears under Plugins → Development → **AntRep Design System**.

## Run it

Run the plugin, pick what to generate, and press Generate.

- **Palette** — which of the 33 background palettes the screens paint with.
  Denim is the app's shipped default.
- **Screens render in** — Light or Dark. Both modes exist as Figma variable
  modes either way; this only chooses what the screen frames are pinned to.

It writes five pages, all prefixed `AntRep · `:

| Page | What's on it |
| --- | --- |
| `AntRep · Foundations` | Semantic colour, accents, all 33 palettes, analytics colour, type ramp, radii, spacing, the 28-icon set |
| `AntRep · Components` | The kit from `src/ui/kit.tsx` as Figma components, with variant sets for Button, Pill, Segmented and Toggle |
| `AntRep · Athlete flow` | 7 labelled bands, ~39 screens, sign-in through batch logging |
| `AntRep · Coach flow` | 7 labelled bands, ~21 screens, roster through the coach's own training |
| `AntRep · Flow map` | Both journeys as a node graph with labelled arrows and a legend |

### Re-running is safe

Only pages named `AntRep · …` are touched, and they are cleared before being
rebuilt — so a second run refreshes the system in place rather than stacking
duplicates, and nothing else in the file is disturbed. Variables are matched by
name and updated, never re-created.

## Variables

| Collection | Modes | Contents |
| --- | --- | --- |
| `AntRep/Theme` | Light, Dark | The six surfaces, the accent trio, fixed brand colours, the 5-step chart ramp, and the metric/category analytics colours |
| `AntRep/Brand` | Light, Dark | The 5 accent presets and all 33 background palettes, grouped by family |
| `AntRep/Size` | Value | Radii, the 4px spacing scale, the type ramp |

Screen frames bind to `AntRep/Theme`, so switching a frame's mode to Dark
repaints it the way the app does rather than showing a light screen on a dark
background.

## Working on the plugin

Sources live in `figma/src/`. They are plain scripts — no imports — bundled in
filename order into `figma/code.js`, which is what `manifest.json` loads. Each
file may use anything a lower-numbered one declares.

```bash
npm run figma
```

builds the bundle and runs the checks. `npm run figma:build` builds only.

| File | Responsibility |
| --- | --- |
| `00-util.js` | Node helpers: auto-layout frames, text, icons, variable-bound paint |
| `10-tokens.js` | The token data, lifted from `src/index.css`, `src/lib/theme.tsx`, `src/ui/kit.tsx` |
| `20-variables.js` | Builds the three variable collections |
| `30-components.js` | The kit rebuilt as Figma nodes |
| `35-library.js` | The Foundations and Components pages |
| `40-blocks.js` | Composites above the kit: logging card, plan row, charts |
| `50-athlete.js` | The athlete screens and their page layout |
| `60-coach.js` | The coach screens and their page layout |
| `70-flow.js` | The flow map and the prototype links |
| `99-main.js` | Fonts, pages, and the UI message loop |

### Keeping it honest

`npm run figma:test` executes the bundle against a mock of the Figma plugin API
(`figma/test/mock-figma.mjs`) and checks that it:

- generates all five pages without throwing
- still works when only Inter is available, not Nunito
- produces identical output on a second run
- leaves pages it does not own untouched

The mock is not a layout engine — it will not catch a misaligned frame — but it
catches everything that would throw partway through a real run and leave you
with a half-built file.

### After changing the app's UI

Update `10-tokens.js` if colours, radii, type or icons changed; update
`30-components.js` if a kit component changed shape; update `50-athlete.js` /
`60-coach.js` if screens were added or restructured. Then re-run the plugin.
