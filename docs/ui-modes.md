# AntRep UI modes: architecture and safety notes

## Application map

The current product is a React/Vite single-page app with two role portals:

- `/` renders the athlete portal.
- `/coach` renders the coach portal.
- `/classic` and `/classic/coach` retain the previous UI implementation when a real backend is in use.

`src/app/Portal.tsx` owns the auth/profile gate and hands an approved profile to the relevant portal shell. The active athlete and coach shells live under `src/app`; the older implementation under `src/features` is not the data or design foundation for this UI-mode work.

Navigation in the active app is tab state held by `usePersisted`. Athlete tabs are Home, Plans, Coach, Progress, Library and Settings. Coach tabs are Athletes, Plans, Exercises, My training and Settings. The coach's own training mounts the same athlete workspace and screens used by an athlete.

## Data and state flow

The important runtime path is:

```text
Supabase or demo local store
        ↓
src/data/api.ts contract
        ↓
src/data/supabaseApi.ts or src/data/demoApi.ts
        ↓
WorkspaceProvider / screen-specific loading state
        ↓
pure functions in src/domain
        ↓
shared UI primitives and src/app screens
        ↓
workspace/API mutations
        ↓
Supabase or demo local store
```

The `Api` interface is the only backend contract used by active screens. Production maps its entities to Postgres/Supabase; demo mode implements the same contract in a versioned browser store. Training entities and their relationships remain unchanged:

- `PlanBundle` contains a plan, days, optional day segments and exercises.
- `PlanAssignment` links a plan to an athlete and can override dates or exercise workload without modifying the shared template.
- `Session` links an athlete/date to optional plan, day and segment IDs. It carries timer windows, completion names, extra exercises and sharing/late-log metadata.
- `SetLog` links to a session and optional plan exercise. Weight, reps, RPE, distance, duration, pace, incline, notes and generic custom-field values remain stored on the same record.
- Profiles own XP, level, streak and goals. XP events are written through the existing API.

`WorkspaceProvider` is the shared mutation boundary for active athlete training. It resolves effective plans, creates plan/free-work sessions, saves and clears exercise sets, imports reviewed sessions, marks completion, awards XP and manages timer segments. Screens remain consumers of the same context regardless of UI mode.

Plan scheduling, local-date semantics, adherence, analytics, session tables, progression, RPE, gamification, import/export and timeline-safety rules remain pure functions in `src/domain`. No UI mode is passed to these functions.

## Existing Classic design system

Classic remains the default and continues to use the current AntRep system:

- rounded Nunito/system typography with strong `font-black` hierarchy;
- AntRep green (`#58cc02`) as the default accent, with sky, grape, punch and sunset presets;
- tinted page palettes, optional paired gradients/duotones and a dotted background texture;
- white or deep-blue soft surfaces, inset fills and low-contrast borders;
- 16px card radii, capsule controls, emoji/icon tiles, progress rings and bars;
- bottom mobile navigation, compact uppercase labels and playful XP/streak treatments;
- light/dark/auto color mode with account-backed palette settings.

Classic receives semantic class names on shared primitives but no mode-specific CSS overrides, so its rendered values remain the baseline.

## Presentation architecture

The theme provider now owns two independent concerns:

- color appearance: light/dark/auto, accent, background and background pairing;
- interface presentation: `classic`, `minimal` or `compact`.

The active mode is applied once as `data-ui` on the document root. Shared primitives in `src/ui/kit.tsx` expose stable semantic hooks (`ui-card`, `ui-button`, `ui-tabbar`, `ui-sheet`, and similar). `src/index.css` then reinterprets those primitives for each mode.

Minimal and Modern Compact are currently development-only experiments. Vite production builds always resolve the effective UI mode to `classic` and omit the interface selector from Settings. A saved experimental preference is retained for future development sessions but cannot alter production rendering.

This avoids feature-level conditionals and duplicated components. All three modes mount the same screens, handlers, hooks, charts, forms and dialogs. Theme-specific presentation components can still be introduced later when a genuinely different information layout needs one, but the current modes do not fork any product logic.

### Classic

Uses the existing styles without overrides: patterned canvas, playful rounded cards, capsule actions and bottom navigation.

### Minimal

Uses a fixed paper-neutral light/dark surface palette, neutral system typeface, quieter weights, borderless document blocks, thin row separators, monochrome exercise icons, flat filled fields and restrained pills. Circular gamification becomes compact percentage metadata with a linear progress rule. Desktop navigation becomes a persistent low-noise sidebar with a simple selection rail; mobile retains the existing safe-area bottom navigation.

### Modern Compact

Uses a separate high-contrast training-console palette, wider desktop canvas, persistent narrow sidebar, layered panel surfaces, inset fields and segmented controls, concise labels, compact conic status gauges, stronger metric density and restrained panel depth. Workout blocks and set rows use a nested panel hierarchy rather than Classic's playful cards. Small screens keep at least 44px shared form/action targets even though desktop controls are denser.

Both reinterpret the existing AntRep accent and chosen color palette rather than introducing a second brand.

## Persistence and backwards compatibility

The preference is stored as optional `settings.ui_mode` inside the profile's existing JSON settings object. It is also included in the existing `antrep-theme` local appearance cache for instant startup.

Compatibility properties:

- There is no database migration and no new database or training-data copy.
- Existing profile settings are merged, not replaced.
- Missing or unknown values resolve to `classic`.
- Existing appearance caches without `uiMode` remain valid.
- Dual-role profiles receive the same complete appearance payload, matching the existing cross-portal color behavior.
- No persisted workout key, entity ID, schema, relationship, date field or calculation changed.
- The selector's accessible radio state is presentation-only and has no feature side effects.

## Verification checklist

- TypeScript and Vite production build.
- Classic default/fallback and unchanged shared feature markup.
- Minimal mobile bottom navigation and desktop sidebar layouts.
- Compact mobile and desktop layouts, including small-screen shared touch targets.
- Interface selection, debounced account save and full-reload restoration in demo mode.
- Athlete Home, Settings and populated workout content under both new modes.
- Repository search confirming `uiMode` is referenced only by theme/settings presentation code.
- No UI-mode branches in `src/data`, `src/domain` or `WorkspaceProvider` mutations.

The main remaining architectural debt is unrelated to UI modes: the production bundle is large enough for Vite to recommend route/feature code splitting. That can be addressed independently because it does not affect persistence or theme behavior.
