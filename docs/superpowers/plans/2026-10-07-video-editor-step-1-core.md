# Video Editor Step 1: Core, Render and Encoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Post Studio's generic project domain (`./core`), render path (`./render`) and WebCodecs encoder (`./encoder`) from tka-platform into `@austencloud/video-editor` behind plugin seams, so tka consumes them from the package and its sequence-specific compile hooks, painters, alignment and surfaces live in a TKA plugin, with no change to what any project renders.

**Architecture:** The package gains `src/core`, `src/render`, `src/encoder` and the real `src/workers/preview-video.worker.ts`. Everything that names `SequenceData`, `StepData`, take timing or TKA render code stays in tka and is reached through a `VideoEditorPlugin` object assembled in `src/lib/shared/post-studio-plugin/`. tka's call sites switch from `$lib/shared/media-composition/...` to `@austencloud/video-editor/{core,render,encoder}` in the same commit that deletes the moved files. A draw-call parity test captured before the first move proves the compiled project, the evaluated layers and every canvas call are unchanged after it.

**Tech Stack:** pnpm 9 workspace, `@sveltejs/package` 2, Svelte 5, TypeScript 5 strict, zod 4, mediabunny 1.44, vitest with jsdom in the package and in tka (tka pins vitest ^4.0.16 and jsdom ^27.4.0; the package takes the same ranges in Task 2), Node 24 for one-off scripts.

**Spec:** `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md` (sections What moves and what stays, Package anatomy, Host contract, Plugin contract, Render path, tka-platform integration, Testing, Step 0 findings, Steps and exit criteria row "1 Core").

---

## Step 1 scope and non-goals

**Parity, stated plainly.** The spec asks for pixel equality of frames rendered before and after the move. That is not achievable in a test runner: the DCK draft's footage (`/word-videos/inshot-recovery/dck-full.mp4`) exists nowhere on disk, the other recovered clip is 136 MB and untracked, and jsdom has no real canvas or video decoder. This plan replaces pixel parity with **draw-call parity**: for two fixed projects at 6 timestamps each, the test hashes (a) the compiled preset JSON, (b) the evaluated layers JSON, and (c) the full ordered log of every call and state assignment the compositor and every painter make on a recording 2D context, with video and image sources replaced by deterministic stand-ins and DOM captures replaced by a stub surface. The "before" hashes are captured on the untouched tree in Task 1 and committed; every later task must reproduce them exactly. What it does not cover: decoded video pixels, the browser's own rasterization of the recorded calls, and the inside of the DOM-captured surfaces (choreo card, sequence animation), whose capture is stubbed. The second fixture is not `promo-1-0` (a 400-byte project with no media and no items beyond one track, which proves nothing): it is a richer plugin-free project built from `tests/unit/media-composition/post-project-fixtures.ts` (video, image, card, text, keyframes, a crossfade, a fade-black, blur background, 4:5 canvas), committed as JSON.

**What moves in this step** (all into `E:/worktrees/shared-packages/video-editor/packages/video-editor/src/`):

- `./core`: the project schema split into core kinds (`video`, `image`, `card`, `text`) plus a plugin-extensible schema factory, item kind registry, keyframes, motion keys, normalize, canvas and clip-edge helpers, the v1 plan schema (`PostTake`), the preset schema, layout and source schemas, presets and the plan compiler, the project compiler with compile hooks, the time map, the tunnel-hook motion primitive, music and music grid, the audio plan, caption layout, colour grade, preview-video types.
- `./render`: frame evaluator with an alignment seam, the painter interface and registry, text, backdrop and region-edge painters, media fit, the frame compositor with surfaces, export video frames, the post exporter, the audio track, preview clock, seek and frame recovery, music preview sync, video mirror, the preview-video cache.
- `./encoder`: `BackgroundVideoEncoder`, `video-export.worker.ts`, `CanvasFrameCapturer`, `CapturedFrame`.
- `src/workers/preview-video.worker.ts`: tka's real preview worker replaces the spike worker, which is renamed `spike.worker.ts`.

**What the TKA plugin receives** (new tka folder `src/lib/shared/post-studio-plugin/`): the `animation`, `moves`, `carousel` and `titles` kinds (schemas, defaults, compile hooks), the TKA extensions of the core `video` (`staffEffect`) and `card` (`cardAppearance`) kinds, the project extension (`sequenceId`, `propType`, `timings`, `mappingPreviewAppearances`, `sequenceActions`), the hook migrations, the painters (sequence strip, beat carousel, staff effects, tunnel titles, animation overlay registry), the alignment provider over `StepData` and take clocks, the surfaces (choreo card, sequence animation, pictograph capture, the DOM capture options) and a bound API (`PostProjectSchema`, `normalizeProject`, `compilePostProject`) so tka call sites change import paths, not call shapes.

**Non-goals for step 1:**

- No UI moves. `VideoEditor`, `PostStudio`, the workspace, canvas, timeline, tool panels, `ExportTakeover` (it needs tka's `BaseModal` and i18n, which the step 2 UI kit replaces) and `post-editor-state.svelte.ts` stay in tka until step 2.
- The edit engine stays in tka until step 2: `post-project-edits.ts` (2628 lines, 74 references to TKA kinds and take timing), `post-project-looks.ts`, `post-project-ops.ts`, `post-project-mirror.ts`, `post-music-edits.ts`. Its only consumers are the editor state and UI, and the kind hooks it needs (`create`, `patch`, tool panels) are UI-shaped, so they are designed with the step 2 split. This is the one part of the spec's `./core` list ("edits") that step 1 defers; the render path, the exit criteria and the parity test do not depend on it.
- Persistence stays in tka until step 2 or 3: `post-editor-store.ts`, `post-editor-history-store.ts`, `post-project-store.ts`, `post-plan-store.ts`, `post-draft-storage.ts`, `post-project-backup.ts`, `take-timing-store.ts`, `post-tab-sync.ts`, `post-project-dev-client.ts`, `feature-video-client.ts`, `post-project-migration.ts`. They read Firebase auth; the host contract's `ownerId` and `VideoEditorStore` replace that when `createVideoEditorState` moves.
- No renames of the core vocabulary (`subjectId` for `sequenceId`, `Post*` type names, `tunnelHook` on preset clips). Saved TKA projects must parse to the same object, and the parity hashes must not move. The core schema gains an optional `subjectId` for step 3; TKA keeps `sequenceId` through its project extension.
- No package publishing, no change to either primary checkout, no Ringmaster work.

---

## Ground rules for every task

- Two worktrees, never a primary checkout. Never edit `E:/tka-platform`, `E:/shared-packages` or `E:/cirque-aflame`.
  - shared-packages: `E:/worktrees/shared-packages/video-editor` (branch `video-editor`). The package is `packages/video-editor` (called PKG below, absolute `E:/worktrees/shared-packages/video-editor/packages/video-editor`).
  - tka-platform: `E:/worktrees/tka-platform/video-editor` (branch `codex/video-editor`, called TKA below). Its `node_modules` is a junction into `E:/tka-platform/node_modules`. Never run `npm install`, `npm ci` or `pnpm install` inside TKA and never delete that junction.
  - The Ringmaster worktree is not touched in step 1.
- Installs happen only in the shared-packages worktree root: `cd /e/worktrees/shared-packages/video-editor && pnpm install`. Only Task 2 adds dependencies.
- Package files: tabs for indentation, LF line endings, ASCII only. Moved files are reformatted with `pnpm exec prettier --use-tabs --print-width 100 --write <files>` from the shared-packages root (prettier 3 is a root devDependency; there is no prettier config, so the flags are explicit). tka files keep tka's own two-space Prettier style.
- Non-ASCII in moved files is removed with `PKG/scripts/step1/ascii.mjs` (Task 2), never by hand: inside string and template literals each character becomes a `\u` escape so runtime strings stay identical; inside comments it becomes ASCII. Do not type a `\u` escape with the Write or Edit tools: they decode it back into the character. Use the script or a Node one-liner.
- No em dashes, no en dashes and no emojis in any file or commit message.
- Commit with explicit pathspecs only. Never `git add -A`, never `git add .`, never stash, never `git checkout --`, never `reset --hard`. A file leaving tka is removed with `git rm <path>` in the same commit that switches its importers.
- Every commit message ends with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- A task that changes both repos commits the package first, then tka. The tka commit body names the package commit (`Package: video-editor@<short hash>`) so the controller can pair them.
- Relative imports inside the package end in `.js` (`verbatimModuleSyntax`, svelte-package output). Type-only imports use `import type`.
- The package never imports `$lib`, `$app`, `$env`, `firebase`, `bits-ui` or any tka path. Gate: `node PKG/scripts/step1/forbidden-imports.mjs` (written in Task 2) prints `forbidden imports: 0`.
- One svelte-check and one build at a time across all sessions. Before either, confirm at least 4096 MB available and no other `svelte-check` running:
  ```powershell
  (Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'svelte-check|svelte-fast-check' } | Select-Object ProcessId, CommandLine
  ```
  Run builds, checks and test suites from Bash with `timeout: 600000`.
- Kill only processes you started, by PID. Ports 3000, 1871 and 5173 belong to Austen. The only dev server in step 1 is the final `/post` check in Task 14 on port 5221 (`npx vite dev --port 5221 --strictPort`, PID recorded).
- Model per task is given in each task heading: haiku for mechanical work, sonnet for implementation, opus for review, and opus also implements Tasks 1, 6, 8 and 10, whose harness and seams need design judgment. Every task ends with an opus review of its diff against this plan before the next task starts.

### Gates

- **Package gate** (run from `/e/worktrees/shared-packages/video-editor`):
  ```bash
  pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test
  ```
  Expected: svelte-package writes `dist/`, `svelte-check found 0 errors and 0 warnings`, and every test file passes.
- **tka type gate** (run from TKA): `npm run check:fast > "$SCRATCH/check-after.txt" 2>&1; node PKG/scripts/step1/check-intersection.mjs "$SCRATCH/check-baseline.txt" "$SCRATCH/check-after.txt"`. The baseline holds the 622 pre-existing errors captured in Task 1. The script keys each error by file path, error code and message with line and column numbers stripped, and fails if any key appears more often after than before. Errors that disappear (moved or deleted files) are fine. A `NEW` line whose message quotes an `import("$lib/...")` type path of a moved module is the same error with its text changed, not a new one: confirm the matching error under the new path in the after file and list it in the task report. `SCRATCH` is `C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step1`, created in Task 1 and kept out of both repos.
- **tka test gate** (run from TKA): `npm run test:ci`. Expected: the same pass count as the Task 1 baseline minus the deleted tests listed in each task, plus the new tests, and 0 failures. A line starting `Errors` in the vitest summary means files were skipped; treat it as a failure.
- **Export smoke** (run from TKA, after any task touching the encoder, compositor or exporter):
  ```bash
  npx vitest run --config tests/config/vitest.config.ts tests/unit/animation-engine/background-encoder-timeout.test.ts tests/unit/animation-engine/video-export-codec.test.ts tests/unit/3d-viewer/offline-3d-exporter-cancellation.test.ts tests/unit/video-export/CanvasFrameCapturer.test.ts tests/unit/sequence-viewer/export-coordinator-scene-take-lifecycle.test.ts src/lib/features/compose/services/video-export-orchestrator-init.test.ts
  ```
  plus the dev page `/test/trail-export-parity`, which is opened only in Task 14 (it needs the dev server).
- **Parity gate** (run from TKA): `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts`. Expected: 4 tests pass (2 fixtures, compile-and-evaluate plus draw log each) against the committed "before" hashes.
- **tka production build** (Task 13 and Task 14 only):
  ```bash
  npm run build:packages && node scripts/svelte-kit-sync-if-needed.mjs && node scripts/generate-svg-precache-manifest.cjs && npx cross-env NODE_OPTIONS=--max-old-space-size=8192 NODE_ENV=production vite build
  ```
  Never `npm run build`, never `npm run build:all`.
- **tka resolves the package through aliases**, never an install. `svelte.config.js` already maps `@austencloud/video-editor` and `@austencloud/video-editor/css` to the worktree's `dist` and `css` (step 0). Task 2 adds the same two entries to both vitest configs. So **every package change must be rebuilt** (`pnpm --filter @austencloud/video-editor build`) before a tka gate runs, or tka tests the previous `dist`.

---

## Parity-test decision

**Decision: draw-call parity in vitest under jsdom, in tka, with hashes captured once on the untouched tree.** Pixel parity is not possible here (no footage on disk for DCK, no real canvas or decoder in jsdom), and a browser-mode test would still not have the footage. Draw-call parity is deterministic, runs in the normal `test:ci` suite, and catches every change in what the compositor and painters ask the canvas to do.

- **Where:** `TKA/tests/unit/video-editor-parity.test.ts` (`// @vitest-environment jsdom`), helpers in `TKA/tests/unit/video-editor-parity/harness.ts`, fixtures in `TKA/tests/fixtures/video-editor-parity/`. It stays in tka for the whole extraction because it drives the TKA plugin.
- **Fixtures (2):**
  - `dck.project.json`: the stored project from `C:/Users/Austen/.tka/post-studio-drafts/1790895873030-4bd8d599-f8b8-4cfc-b133-135191673d3a.json` (record key `tka:post-studio:project:v2:DCK` plus the Greek letter Psi and a hyphen), extracted by a one-liner in Task 1. Main track of two videos and a choreo card, five text items and a credit, a `moves` item and an `animation` item with the overlay turned off, mirrored, dark background, take audio. It exercises the TKA kinds, the `video.staffEffect` and `card.cardAppearance` extensions only where present, take clocks and the choreo-card and sequence-animation surfaces.
  - `plain.project.json`: a plugin-free project generated once in Task 1 from the existing builders in `tests/unit/media-composition/post-project-fixtures.ts`: two videos with a crossfade, an image with keyframes, a plain card, two text items (one animated), a fade-black transition at the end, blur background, 4:5 canvas.
- **Timestamps (6 each):** DCK at 0, 10.5, 21.9 (inside the transition at the first cut), 41 (text-2 on screen), 70.25 and 81 seconds (on the card with the credit). Plain at 0.2, 2.5, 4.9 (inside the crossfade), 7, 9.6 (inside the fade-black) and 11 seconds; Task 1 Step 3 prints the plain project's duration and adjusts the last two only if the builder output is shorter.
- **What is hashed, per fixture:** (a) `JSON.stringify` of the parsed and normalized project, which proves the schema factory keeps key order; (b) `JSON.stringify` of the compile result; and per timestamp (c) `JSON.stringify` of the evaluated layers and (d) the recorded draw log. Hashes are SHA-256 hex from `node:crypto`. Numbers in the draw log are rounded to 6 decimals so harmless float noise cannot fail the gate, but no other normalization is applied.
- **Recording context:** a `Proxy` over a plain object installed by stubbing `HTMLCanvasElement.prototype.getContext`. Every method call logs `name(args)`; every property set logs `name=value`; getters return the last set value (or the canvas default). `measureText` returns a deterministic width (`text.length * fontSizePx * 0.5`, font size parsed from the last `font` set) so text layout runs. Canvas arguments log as `canvas#<data-standin or width x height>`; gradients and patterns are recording objects too.
- **Media stand-ins:** `videoFrames` is a stand-in object with `has(role)` true for every take role and image role and `frameFor(role, t)` returning a canvas tagged `data-standin="<role>@<t rounded to 3 places>"` (1080x1920 for takes, 1200x900 for images). Each call is logged.
- **DOM surfaces:** the root element holds one `.media-layer[data-clip-id]` element per layer clip, with `data-render-mode` taken from the preset clip's source role (`choreo-card`, `sequence-animation`, `painted`, `external-media`). `getBoundingClientRect` is stubbed per element to the region rectangle. `modern-screenshot` is mocked with `vi.mock`, returning a canvas tagged `data-standin="dom-capture"`; the mock logs every capture. The surfaces live in tka before and after, so the mock reaches them both times. Nothing in the package may import `modern-screenshot` (risk 4).
- **Alignment:** DCK uses its own `timings` through `resolveTakeTiming` and `takeSampleAt` exactly as `post-editor-state.svelte.ts` lines 236-253 build `clocks`, with 16 synthetic steps of duration 1 (`sequencePeriod` 1, `startPlacementDuration` 1). Plain uses no alignment.
- **Painters:** the parity harness builds the painter map the same way `PostEditorWorkspace.svelte`'s `exportPainters()` does for text and titles items (the only painted kinds in the fixtures), first by direct construction (before), then through the package painter registry with the TKA plugin's factories (after Task 10). Strip, carousel, staff effect and tunnel titles painters are not in the fixtures; their own unit tests cover them and are rerun unchanged.
- **Gate:** the "before" hashes in `before.json` are committed in Task 1 and never regenerated. A mismatch fails with the fixture, the timestamp and which of (a) to (d) moved, and writes the after-log to `SCRATCH/parity-after-<fixture>-<t>.txt` for a diff against the before-log saved to `SCRATCH` in Task 1.
- **Package tests:** jsdom unit tests run in the package with vitest. Browser-mode component tests (`PostStudio.svelte.test.ts`, `PostAnimationAppearanceTool.svelte.test.ts`, `ExportTakeover.svelte.test.ts`) stay in tka: they test UI that does not move until step 2, and the package has no browser-mode setup yet. That setup is not cheap (Playwright-free Chrome provider, its own config), so it waits for step 2.

---

## File map

The census covers 129 files (37,022 lines) under `src/lib/shared/media-composition/`, `src/lib/shared/video-export/` and the encoder in `src/lib/shared/animation-engine/`. PKG paths are under `E:/worktrees/shared-packages/video-editor/packages/video-editor/src/`; TKA paths are under `E:/worktrees/tka-platform/video-editor/src/lib/shared/`.

**Totals.** About 14,300 lines leave tka for the package: 10,861 lines in 43 whole files (42 below plus `render/utils/trace-rounded-rect.ts`) and about 3,450 of the 4,837 lines in the six split files (estimated package share: post-project 800, compiler 1,000, evaluator 810, compositor 650, pip-handoff 170, tunnel-titles 25). Four dead files (638 lines) and their tests are deleted. 77 census files stay (three files the spec listed as dead are still imported; see Deleted from tka).

**Helpers outside the census.**

| tka file | Lines | Decision |
| --- | ---: | --- |
| `render/utils/trace-rounded-rect.ts` | 41 | Moves to `PKG/src/render/rounded-rect.ts`. Its importers are the compositor, the region-edge painter (both moving) and `tests/unit/media-composition/post-clip-edge.test.ts` (rewritten). |
| `transitions/ws-ease.ts` | 68 | Stays (`animation-engine/services/canvas-2d-animation-renderer.ts` uses it). The package gets its own copy of the functions `post-project-keyframes.ts` imports, in `PKG/src/core/project/ease.ts`, with a package test that compares sampled values against the same constants as tka. Documented duplicate, under 70 lines. |
| `timeline/strip-window.ts` | 200 | Stays; only the beat-carousel layout (staying) uses it. |
| `animation-engine/domain/constants/timing.ts` | n/a | Stays. The preset schema needs `PLAYBACK_MIN_BPM` and `PLAYBACK_MAX_BPM`; the package declares `PLAYBACK_BASELINE_BPM = 60`, `PLAYBACK_MIN_SPEED = 0.1`, `PLAYBACK_MAX_SPEED = 3.0` and the two products in `PKG/src/core/preset/playback-bpm.ts`, and a tka plugin test asserts the four values match. |

**New files.**

- PKG: `src/core/index.ts` (extended), `src/plugin.ts`, `src/core/project/item-kinds.ts`, `src/core/project/schema-factory.ts`, `src/core/project/ease.ts`, `src/core/preset/playback-bpm.ts`, `src/core/sequence-types.ts` (`TakeSample`, `TakeSampleOptions`, `SequenceFrame`, `SequencePhase`), `src/core/compile/hooks.ts`, `src/render/index.ts`, `src/render/alignment.ts`, `src/render/painter-registry.ts`, `src/render/surfaces.ts`, `src/encoder/index.ts`, `src/workers/worker-scope.ts`, `src/workers/spike.worker.ts` (renamed), `vitest.config.ts`, `test/*.test.ts`, `scripts/step1/*.mjs` and `scripts/step1/moves.json`.
- TKA: `post-studio-plugin/index.ts`, `item-kinds.ts`, `project-extension.ts`, `compile-hooks.ts`, `normalize-hooks.ts`, `alignment.ts`, `surfaces.ts`, `painters.ts`, `bound.ts`, `plugin.test.ts`; `tests/unit/video-editor-parity.test.ts`, `tests/unit/video-editor-parity/harness.ts`, `tests/fixtures/video-editor-parity/*`.

### Moves whole to the package (42 files, 10820 lines)

| tka file (under `src/lib/shared/`) | Lines | Package file (under `PKG/src/`) |
| --- | ---: | --- |
| `animation-engine/services/background-video-encoder.ts` | 449 | `encoder/background-video-encoder.ts` |
| `animation-engine/workers/video-export.worker.ts` | 911 | `workers/video-export.worker.ts` |
| `media-composition/domain/caption-layout.ts` | 199 | `core/caption-layout.ts` |
| `media-composition/domain/media-composition-preset-schema.ts` | 815 | `core/preset/preset-schema.ts` |
| `media-composition/domain/media-layout-schema.ts` | 240 | `core/preset/layout-schema.ts` |
| `media-composition/domain/media-source-schema.ts` | 148 | `core/preset/source-schema.ts` |
| `media-composition/domain/music-grid.ts` | 264 | `core/music/music-grid.ts` |
| `media-composition/domain/post-audio-plan.ts` | 366 | `core/music/audio-plan.ts` |
| `media-composition/domain/post-canvas.ts` | 150 | `core/project/canvas.ts` |
| `media-composition/domain/post-clip-edge.ts` | 82 | `core/project/clip-edge.ts` |
| `media-composition/domain/post-music.ts` | 83 | `core/music/post-music.ts` |
| `media-composition/domain/post-plan-compiler.ts` | 553 | `core/plan/plan-compiler.ts` |
| `media-composition/domain/post-plan.ts` | 447 | `core/plan/post-plan.ts` |
| `media-composition/domain/post-project-keyframes.ts` | 839 | `core/project/keyframes.ts` |
| `media-composition/domain/post-project-normalize.ts` | 425 | `core/project/normalize.ts` |
| `media-composition/domain/post-studio-presets.ts` | 627 | `core/plan/presets.ts` |
| `media-composition/domain/post-take-labels.ts` | 19 | `core/project/take-labels.ts` |
| `media-composition/domain/post-video-color-grade.ts` | 200 | `core/color-grade.ts` |
| `media-composition/domain/preview-video.ts` | 106 | `core/preview-video.ts` |
| `media-composition/domain/sequence-time-map.ts` | 579 | `core/time-map.ts` |
| `media-composition/domain/tunnel-hook.ts` | 262 | `core/tunnel-hook.ts` |
| `media-composition/services/contracts/IPreviewVideoCache.ts` | 23 | `render/preview-cache/preview-video-cache-contract.ts` |
| `media-composition/services/implementations/PreviewVideoCache.ts` | 265 | `render/preview-cache/preview-video-cache.ts` |
| `media-composition/services/media-audio-inspector.ts` | 28 | `render/media-audio-inspector.ts` |
| `media-composition/services/media-fit.ts` | 179 | `render/media-fit.ts` |
| `media-composition/services/music-preview-sync.ts` | 119 | `render/music-preview-sync.ts` |
| `media-composition/services/post-audio-track.ts` | 308 | `render/audio-track.ts` |
| `media-composition/services/post-backdrop-painter.ts` | 140 | `render/backdrop-painter.ts` |
| `media-composition/services/post-preview-clock.ts` | 68 | `render/preview-clock.ts` |
| `media-composition/services/post-studio-export-video-frames.ts` | 173 | `render/export-video-frames.ts` |
| `media-composition/services/post-studio-exporter.ts` | 165 | `render/post-exporter.ts` |
| `media-composition/services/post-studio-layer-painter.ts` | 148 | `render/layer-painter.ts` |
| `media-composition/services/preview-video-frame-recovery.ts` | 273 | `render/preview-frame-recovery.ts` |
| `media-composition/services/preview-video-render.ts` | 73 | `render/preview-cache/preview-video-render.ts` |
| `media-composition/services/preview-video-store.ts` | 120 | `render/preview-cache/preview-video-store.ts` |
| `media-composition/services/region-edge-painter.ts` | 148 | `render/region-edge-painter.ts` |
| `media-composition/services/text-item-painter.ts` | 280 | `render/text-item-painter.ts` |
| `media-composition/services/video-mirror.ts` | 193 | `render/video-mirror.ts` |
| `media-composition/services/video-preview-seek.ts` | 142 | `render/video-preview-seek.ts` |
| `media-composition/workers/preview-video.worker.ts` | 109 | `workers/preview-video.worker.ts` |
| `video-export/domain/captured-frame.ts` | 33 | `encoder/captured-frame.ts` |
| `video-export/services/canvas-frame-capturer.ts` | 69 | `encoder/canvas-frame-capturer.ts` |

### Splits: a package part plus a TKA part (6 files, 4837 lines)

| tka file | Lines | Package part | TKA part |
| --- | ---: | --- | --- |
| `media-composition/domain/pip-handoff.ts` | 403 | `core/pip-sample.ts` | project-level half stays in place, shrunk |
| `media-composition/domain/post-project-compiler.ts` | 1370 | `core/compile/compiler.ts` | TKA cases to post-studio-plugin/compile-hooks.ts |
| `media-composition/domain/post-project.ts` | 1167 | `core/project/schema.ts` | TKA kinds and fields to post-studio-plugin/item-kinds.ts and project-extension.ts |
| `media-composition/domain/tunnel-titles.ts` | 165 | `core/roles.ts` | titles plan stays in place, shrunk |
| `media-composition/services/frame-evaluator.ts` | 874 | `render/frame-evaluator.ts` | sequenceFieldsFor to post-studio-plugin/alignment.ts |
| `media-composition/services/post-studio-frame-compositor.ts` | 858 | `render/frame-compositor.ts` | choreo-card and sequence-animation branches to post-studio-plugin/surfaces.ts |

### Deleted from tka (4 files, 638 lines; the 3 rows marked STAYS are not deleted)

| tka file | Lines | Why |
| --- | ---: | --- |
| `media-composition/domain/media-composition-schema.ts` | 296 | dead: only dead state and its own test import it (Task 12 confirms) |
| `media-composition/domain/post-studio-breakdown.ts` | 178 | STAYS: `media-composition-state.svelte.ts` (staying) imports it |
| `media-composition/domain/post-studio-slots.ts` | 368 | STAYS: `media-composition-state.svelte.ts` (staying) imports it |
| `media-composition/services/caption-painter.ts` | 117 | dead (spec list) |
| `media-composition/services/media-composition-preset-repository.ts` | 122 | dead (spec list) |
| `media-composition/state/composition-playback-adapter.ts` | 103 | dead (spec list) |
| `media-composition/state/media-composition-state.svelte.ts` | 956 | STAYS: its `CompositionSourceBinding` type is imported by `PostEditorCanvas.svelte`, `PostEditorWorkspace.svelte`, `PostStudioMediaLayer.svelte` and `tests/unit/media-composition/post-studio-media-layer-harness.svelte.ts`, and `MediaCompositionState` by `media-composition-context.ts`. Step 2 can move those types out and delete it |

### Stays in tka (74 files, 19225 lines)

| tka file | Lines | Why |
| --- | ---: | --- |
| `media-composition/domain/feature-video-url.ts` | 35 | feature-video persistence |
| `media-composition/domain/feature-video.ts` | 137 | feature-video persistence |
| `media-composition/domain/post-inshot-import.ts` | 514 | InShot import, TKA workflow |
| `media-composition/domain/post-music-edits.ts` | 299 | edit engine, step 2 |
| `media-composition/domain/post-project-bridge-guard.ts` | 42 | imports feature-video |
| `media-composition/domain/post-project-edits.ts` | 2628 | edit engine, step 2 |
| `media-composition/domain/post-project-hook-migration.ts` | 138 | plugin normalize hook calls it |
| `media-composition/domain/post-project-looks.ts` | 554 | edit engine, step 2 |
| `media-composition/domain/post-project-migration.ts` | 231 | persistence |
| `media-composition/domain/post-project-mirror.ts` | 141 | edit engine, step 2 |
| `media-composition/domain/post-project-motion-keys.ts` | 153 | plugin normalize hook calls it |
| `media-composition/domain/post-project-ops.ts` | 666 | edit engine, step 2 |
| `media-composition/domain/post-sequence-actions.ts` | 115 | TKA sequence actions |
| `media-composition/domain/sequence-frame.ts` | 163 | StepData math; its SequenceFrame type moves to the package and is re-exported |
| `media-composition/domain/staff-tip-track.ts` | 236 | staff tracking |
| `media-composition/domain/strip-view.ts` | 60 | sequence strip |
| `media-composition/domain/take-timing.ts` | 2291 | take timing; TakeSample types move to the package and are re-exported |
| `media-composition/domain/tap-fit.ts` | 676 | take timing |
| `media-composition/domain/timing-summary.ts` | 168 | take timing |
| `media-composition/domain/timing-verdict.ts` | 148 | take timing |
| `media-composition/get-preview-video-cache.ts` | 21 | composition getter; wires the package cache to edit-copy-lookup |
| `media-composition/services/animation-overlay-painter-registry.ts` | 51 | plugin painter factory wraps it |
| `media-composition/services/beat-carousel-layout.ts` | 289 | plugin painter |
| `media-composition/services/beat-carousel-painter.ts` | 152 | plugin painter factory wraps it |
| `media-composition/services/edit-copy-lookup.ts` | 56 | imports feature-video |
| `media-composition/services/feature-video-client.ts` | 374 | persistence |
| `media-composition/services/inshot-recovery-package.ts` | 123 | InShot import |
| `media-composition/services/post-draft-storage.ts` | 281 | persistence |
| `media-composition/services/post-editor-history-store.ts` | 277 | persistence |
| `media-composition/services/post-editor-store.ts` | 58 | persistence |
| `media-composition/services/post-plan-store.ts` | 51 | persistence |
| `media-composition/services/post-project-backup.ts` | 199 | persistence |
| `media-composition/services/post-project-dev-client.ts` | 109 | persistence |
| `media-composition/services/post-project-store.ts` | 168 | persistence |
| `media-composition/services/post-sequence-view.svelte.ts` | 157 | sequence view state |
| `media-composition/services/post-studio-dom-capture.ts` | 28 | plugin surfaces use it |
| `media-composition/services/post-studio-pictograph-capture.ts` | 65 | plugin surface uses it |
| `media-composition/services/post-tab-sync.ts` | 66 | persistence |
| `media-composition/services/sequence-strip-painter.ts` | 512 | plugin painter factory wraps it |
| `media-composition/services/staff-effect-painter.ts` | 393 | plugin painter factory wraps it |
| `media-composition/services/staff-tip-analyzer.ts` | 73 | staff tracking |
| `media-composition/services/staff-tip-detection.ts` | 409 | staff tracking |
| `media-composition/services/staff-tip-track-store.ts` | 65 | staff tracking |
| `media-composition/services/staff-tip-tracking.ts` | 488 | staff tracking |
| `media-composition/services/take-timing-store.ts` | 245 | persistence |
| `media-composition/services/tunnel-titles-painter.ts` | 121 | plugin painter factory wraps it |
| `media-composition/state/media-composition-context.ts` | 24 | UI context; PostStudioMediaLayer.svelte uses it |
| `media-composition/state/post-editor-state.svelte.ts` | 1689 | editor state, step 2 |
| `media-composition/state/post-video-previews.svelte.ts` | 130 | editor state, step 2 |
| `media-composition/state/staff-tip-analysis.svelte.ts` | 178 | staff tracking |
| `media-composition/workers/staff-tip-tracker.worker.ts` | 223 | staff tracking |
| `video-export/components/ExportTakeover.svelte` | 353 | TKA animation and 3D export, or step 2 UI |
| `video-export/components/ExportTakeover.svelte.test.ts` | 154 | TKA animation and 3D export, or step 2 UI |
| `video-export/components/ExportTakeoverTestHarness.svelte` | 56 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/__tests__/camera-keyframe.test.ts` | 88 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/__tests__/film-render-presets.test.ts` | 70 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/__tests__/film-share-summary.test.ts` | 60 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/camera-keyframe.ts` | 210 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/export-diagnostics.ts` | 194 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/film-render-presets.ts` | 74 | TKA animation and 3D export, or step 2 UI |
| `video-export/domain/film-share-summary.ts` | 43 | TKA animation and 3D export, or step 2 UI |
| `video-export/get-canvas-frame-capturer.ts` | 7 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/__tests__/export-engine-props.test.ts` | 82 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/__tests__/export-takeover-phase.test.ts` | 73 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/__tests__/rendered-film-store.test.ts` | 120 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/camera-keyframe-interpolator.ts` | 99 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/export-engine-props.ts` | 60 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/export-substep.ts` | 12 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/export-takeover-phase.ts` | 68 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/offscreen-export-renderer.layers.test.ts` | 190 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/offscreen-export-renderer.trails.test.ts` | 113 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/offscreen-export-renderer.ts` | 399 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/rendered-film-store.ts` | 222 | TKA animation and 3D export, or step 2 UI |
| `video-export/services/types.ts` | 8 | TKA animation and 3D export, or step 2 UI |

---

## Plugin seam design

The seam sits at code dependencies, not at vocabulary. A module moves to the package when it has no `$lib` import left and any TKA data it carries is optional and inert without the plugin (`tunnel-hook.ts`, `sequence-time-map.ts`, the preset schema's `tunnelHook` and `clockHandoff` fields). Code that names `SequenceData`, `StepData`, take timing, pictographs or TKA renderers stays in tka and reaches the package through the plugin object below. The spec's later plugin fields (`presets`, `looks`, `modes`, `canvasOverlays`, and the kind's tool panel, lane renderer and media sublayer) are UI and land in step 2; this step adds only what compile, normalize, evaluate, paint and capture need, plus `kindExtensions`, `compileHooks`, `compileOutputs` and `normalize`, which the spec's contract did not list. Task 14 Step 6 records those additions in the spec.

### Static types: module augmentation

The package declares empty interfaces that tka fills with `declare module`. This keeps all of tka's existing importers fully typed with the TKA kinds and fields, without generics threaded through every signature.

`PKG/src/core/project/item-kinds.ts`:

```ts
import type {
	PostCardItemCore,
	PostImageItemCore,
	PostProjectCore,
	PostTextItemCore,
	PostTrackCore,
	PostVideoItemCore,
} from "./schema.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
/** Fields a plugin adds to the core `video` kind. tka augments this. */
export interface PluginVideoFields {}
/** Fields a plugin adds to the core `image` kind. */
export interface PluginImageFields {}
/** Fields a plugin adds to the core `card` kind. */
export interface PluginCardFields {}
/** Fields a plugin adds to the core `text` kind. */
export interface PluginTextFields {}
/** Item kinds a plugin adds, keyed by their `kind` literal. */
export interface PluginItemKinds {}
/** Top-level project fields a plugin adds. */
export interface PluginProjectFields {}
/** Entries a plugin adds to the compile result, after `texts`. */
export interface PluginCompiledOutputs {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export type PostVideoItem = PostVideoItemCore & PluginVideoFields;
export type PostImageItem = PostImageItemCore & PluginImageFields;
export type PostCardItem = PostCardItemCore & PluginCardFields;
export type PostTextItem = PostTextItemCore & PluginTextFields;

export interface CoreItemKinds {
	video: PostVideoItem;
	image: PostImageItem;
	card: PostCardItem;
	text: PostTextItem;
}
export type PostItemKinds = CoreItemKinds & PluginItemKinds;
export type PostItemKind = keyof PostItemKinds & string;
export type PostItem = PostItemKinds[PostItemKind];
export type CoreItemKind = keyof CoreItemKinds;

export type PostTrack = Omit<PostTrackCore, "items"> & { items: PostItem[] };
export type PostProject = Omit<PostProjectCore, "tracks"> & {
	tracks: PostTrack[];
} & PluginProjectFields;
```

`schema.ts` keeps today's schemas and helpers from `post-project.ts` for the core kinds, renamed only where a type was inferred from the full union: `PostVideoItemCore = z.infer<typeof PostVideoItemSchema>` and so on, `PostTrackCore`, `PostProjectCore` (with a new optional `subjectId`). Helper signatures (`findItem`, `mainItems`, `itemEnd`, `clampBox`, `trackHasRoom`, `createIdAllocator`, ...) take and return the augmented `PostItem`, `PostTrack` and `PostProject` from `item-kinds.ts`.

`TKA/src/lib/shared/post-studio-plugin/item-kinds.ts` holds the TKA schemas cut from `post-project.ts` (animation, moves, carousel, titles, `PostStaffEffectSchema`, `POST_STAFF_EFFECTS`, the card appearance schema, `POST_SEQUENCE_ACTIONS`, `PostAnimationAppearanceSchema`; the `auto` motion key schema is core vocabulary and stays in the package) and the augmentation:

```ts
import type { z } from "zod";
import type { TunnelTitlesPlan } from "$lib/shared/media-composition/domain/tunnel-titles";
import type { tkaProjectShape, tkaVideoShape, tkaCardShape } from "./project-extension";

type TkaProjectFields = z.infer<z.ZodObject<typeof tkaProjectShape>>;
type TkaVideoFields = z.infer<z.ZodObject<typeof tkaVideoShape>>;
type TkaCardFields = z.infer<z.ZodObject<typeof tkaCardShape>>;

declare module "@austencloud/video-editor/core" {
	interface PluginItemKinds {
		animation: PostAnimationItem;
		moves: PostMovesItem;
		carousel: PostCarouselItem;
		titles: PostTitlesItem;
	}
	interface PluginVideoFields extends TkaVideoFields {}
	interface PluginCardFields extends TkaCardFields {}
	interface PluginProjectFields extends TkaProjectFields {}
	interface PluginCompiledOutputs {
		titles: TunnelTitlesPlan[];
	}
}
```

Fallback if Task 6 Step 3's proof shows tka does not see an augmentation through `export *`: move the seven `Plugin*` interfaces into `PKG/src/core/index.ts` itself (declared there, not re-exported), rebuild and rerun the proof.

### Runtime schema: `createProjectSchema(plugin?)`

`PKG/src/core/project/schema-factory.ts`:

```ts
import { z } from "zod";
import type { VideoEditorPlugin } from "../../plugin.js";
import type { PostProject } from "./item-kinds.js";
import {
	CORE_ITEM_SHAPES,
	CORE_PROJECT_SHAPE,
	CORE_TRACK_SHAPE,
	refineUniqueIds,
} from "./schema.js";

/** Joins a base shape and an extension in one key order, so parsed objects keep today's order. */
export function orderedShape(
	base: z.ZodRawShape,
	extension: z.ZodRawShape | undefined,
	order: readonly string[] | undefined,
): z.ZodRawShape {
	const merged: z.ZodRawShape = { ...base, ...extension };
	if (!order) return merged;
	const keys = Object.keys(merged);
	const missing = keys.filter((key) => !order.includes(key));
	const extra = order.filter((key) => !(key in merged));
	if (missing.length > 0 || extra.length > 0) {
		throw new Error(
			`shape order mismatch: missing ${missing.join(", ") || "none"}, extra ${extra.join(", ") || "none"}`,
		);
	}
	return Object.fromEntries(order.map((key) => [key, merged[key]!]));
}

export function createProjectSchema(plugin?: VideoEditorPlugin): z.ZodType<PostProject> {
	const coreKinds = (Object.keys(CORE_ITEM_SHAPES) as (keyof typeof CORE_ITEM_SHAPES)[]).map((kind) => {
		const extension = plugin?.kindExtensions?.[kind];
		const schema = z.object(orderedShape(CORE_ITEM_SHAPES[kind], extension?.shape, extension?.order)).strict();
		// Today's PostVideoItemSchema is .strict().refine(...); keep the refine on the video kind.
		if (kind !== "video") return schema;
		return schema.refine(
			(item) => (item as { sourceOut: number }).sourceOut > (item as { sourceIn: number }).sourceIn,
			{ message: "A clip must end after it starts", path: ["sourceOut"] },
		);
	});
	const pluginKinds = (plugin?.itemKinds ?? []).map((definition) => definition.schema);
	const item = z.discriminatedUnion("kind", [...coreKinds, ...pluginKinds] as never, {
		error: (issue) => {
			const input = issue.input as { kind?: unknown } | undefined;
			return `Unknown post item kind "${String(input?.kind)}"`;
		},
	});
	// PostTrackSchema and PostProjectSchema are both .strict() today.
	const track = z.object({ ...CORE_TRACK_SHAPE, items: z.array(item) }).strict();
	const project = z
		.object(
			orderedShape(
				{ ...CORE_PROJECT_SHAPE, tracks: z.array(track) },
				plugin?.projectExtension?.shape,
				plugin?.projectExtension?.order,
			),
		)
		.strict()
		.superRefine(refineUniqueIds);
	return project as unknown as z.ZodType<PostProject>;
}
```

Checked against `post-project.ts`: every item kind, `PostTrackSchema` and `PostProjectSchema` are `.strict()`, and `PostVideoItemSchema` alone adds `.refine(sourceOut > sourceIn)`, all reproduced above. Today's `PostItemSchema` union has no error hook, so the hook above changes only the message for an unknown `kind`; Task 6 Step 2 greps tka tests for asserted zod messages before keeping it. `CORE_ITEM_SHAPES` is a `const` object holding the raw shapes of the four core kinds (video, image, card, text). The union lists them first and the plugin kinds after them, in `itemKinds` order. Option order does not change parse output, because zod picks the option by the `kind` discriminator; the parity gate's normalized-project hash confirms it. The music field is built by `createPostMusicSchema(plugin?.isMediaUrl ?? isNonEmptyString)` from `core/music/post-music.ts` (Task 6), so the core never sees tka's media URL pattern.

### The plugin object

`PKG/src/plugin.ts`, exported from `.` and as types from `./core`:

```ts
import type { z } from "zod";
import type { CompileItemEnv, ProjectCompileHooks } from "./core/compile/hooks.js";
import type { CoreItemKind, PostItem, PostProject } from "./core/project/item-kinds.js";
import type { PostBox } from "./core/project/schema.js";
import type { AlignmentProvider } from "./render/alignment.js";
import type { PainterFactory } from "./render/painter-registry.js";
import type { SurfaceCapture } from "./render/surfaces.js";

export interface ShapeExtension {
	shape: z.ZodRawShape;
	/** Every key of the merged shape, in output order. */
	order?: readonly string[];
}

export interface ItemKindDefinition {
	kind: string;
	/** A z.object with `kind: z.literal(kind)`, built from the core's exported item base. */
	schema: z.ZodObject<z.ZodRawShape>;
	label: string;
	defaultBox(): PostBox;
	/** Normalize treats it as a visual a transition can join (today's isTransitionVisual). */
	transitionVisual?: boolean;
	/** Normalize placement: seconds of intro and lead-in before `start` (today's tunnelHook intro and lead). */
	placement?(item: PostItem): { intro: number; lead: number } | null;
	/** The kind's own intro keys win over generated region keys (today's "animation's intro keys are its own"). */
	ownsIntroKeys?: boolean;
	/** Adds the item's regions, clips and keys. Returns false to fall through to core handling. */
	compile(item: PostItem, env: CompileItemEnv): boolean;
}

export interface VideoEditorPlugin {
	id: string;
	itemKinds: readonly ItemKindDefinition[];
	kindExtensions?: Partial<Record<CoreItemKind, ShapeExtension>>;
	projectExtension?: ShapeExtension;
	compileHooks?: ProjectCompileHooks;
	/** Initial values of extra compile outputs, spread after `texts` in this key order. */
	compileOutputs?: Readonly<Record<string, () => unknown>>;
	normalize?: {
		before?(project: PostProject): PostProject;
		after?(project: PostProject): PostProject;
	};
	painters?: readonly PainterFactory[];
	surfaces?: readonly SurfaceCapture[];
	alignment?: AlignmentProvider;
	/** The music URL check; core accepts any non-empty string. tka passes isFeatureVideoMediaUrl. */
	isMediaUrl?(url: unknown): url is string;
}
```

### Compile hooks

`PKG/src/core/compile/hooks.ts`. `CompileItemEnv` exposes the closure state and helpers that today's `compilePostProject` switch cases use, with their current names and signatures. Task 8 Step 1 lists every identifier the four TKA case bodies (`animation`, `moves`, `carousel`, `titles`) and the video staff-clip branch read from the enclosing function; each one becomes a member here, and nothing else does.

```ts
import type { MediaCompositionPreset } from "../preset/preset-schema.js";
import type { PostProject, PostVideoItem } from "../project/item-kinds.js";
import type { TunnelBackdropFrame } from "../tunnel-hook.js";
import type { CompilePostProjectContext } from "./compiler.js";

type PresetRegion = MediaCompositionPreset["regions"][number];
type PresetClip = MediaCompositionPreset["clips"][number];

/** Today's FootageIntro, moved out of post-project-compiler.ts (lines 401-405). */
export interface FootageIntro {
	start: number;
	seconds: number;
	frame?: TunnelBackdropFrame;
}

export interface CompileEnv {
	readonly project: PostProject;
	readonly context: CompilePostProjectContext;
	/** Per-compile scratch space for hooks (the pip handoff pre-pass result lives here). */
	readonly state: Map<string, unknown>;
	addRegion(region: PresetRegion): void;
	addClip(clip: PresetClip): void;
	/** Push onto a plugin output declared in `compileOutputs`. */
	addOutput(name: string, value: unknown): void;
}

export interface CompileItemEnv extends CompileEnv {
	readonly trackIndex: number;
	readonly zIndex: number;
	useRole(role: string): void;
	useTake(takeId: string): void;
	// Task 8 Step 1 appends the remaining helpers here with today's signatures:
	// region, presetRole, regionKeyframesFor, motionFor, mainVideos, label.
}

export interface ProjectCompileHooks {
	/** Before the item loop (TKA: the pip handoff pre-pass). */
	begin?(env: CompileEnv): void;
	/** Footage intro for the main track (TKA: an animation item's tunnelHook backdrop). */
	footageIntro?(env: CompileEnv): FootageIntro | null;
	/** Extra clips beside a main video (TKA: the `~staff` effect clip). */
	videoCompanions?(item: PostVideoItem, env: CompileItemEnv): void;
	/** Region key span override (TKA: an animation item's tunnelHook span in regionKeyframesFor). */
	regionSpan?(item: unknown, env: CompileItemEnv): { start: number; end: number } | null;
}
```

`PresetRegion` and `PresetClip` match today's preset schema: `preset.regions` and `preset.clips` are top-level arrays, typed `LayoutRegion` (`media-layout-schema.ts`) and `PresetClip` (`media-composition-preset-schema.ts`). `FootageIntro` is copied from the compiler, which imports it back from `hooks.ts`. `CompilePostProjectContext` gains `presetId?: string` (default `"post-project"`); the compiler uses it where it builds `post-project:${project.sequenceId}` today, and tka's bound compile passes `post-project:${project.sequenceId}`, so the preset id is unchanged. The core signature is `compilePostProject(project, context, plugin?)`.

### Normalize

`normalizeProject(stored, plugin?)` runs `plugin.normalize.before`, then the core layout pass, then `plugin.normalize.after`. TKA's hooks in `post-studio-plugin/normalize-hooks.ts`: `before = (p) => splitTunnelHookTitles(mergeSeparateTunnelHook(p))` (from `post-project-hook-migration.ts`, which stays in place) and `after = withMotionKeys` (from `post-project-motion-keys.ts`, which stays). The core layout pass asks the plugin's kind definitions for `transitionVisual` and `placement` where today's code names `animation` and its `tunnelHook`.

### Evaluator alignment

`PKG/src/render/alignment.ts`:

```ts
import type { SequenceFrame, TakeSample, TakeSampleOptions } from "../core/sequence-types.js";
import type { PostProject } from "../core/project/item-kinds.js";
import type { PipHandoffStep } from "../core/pip-sample.js";
import type { SequenceTimeMap } from "../core/time-map.js";

export interface TakeClock {
	sampleAt(mediaSeconds: number, options?: TakeSampleOptions): TakeSample | null;
}

/** What the evaluator adds to a sequence layer. Same keys, same order as today's sequenceFieldsFor result. */
export interface AlignmentFields {
	sequenceFrame?: SequenceFrame;
	sequencePosition?: number;
	sequencePassIndex?: number;
	carouselPosition?: number;
	animationTimeSeconds?: number;
	displayedBeatNumber?: number;
}

export interface FrameAlignment {
	/** Beats per move, today's `steps.map((s) => s.duration ?? 1)`. */
	moveBeats: readonly number[];
	sequencePeriod?: number;
	clocks?: Readonly<Record<string, TakeClock>>;
	/** Read by the evaluator outside sequenceFieldsFor (frame-evaluator.ts lines 508-512). */
	timeMap?: SequenceTimeMap;
	mediaTimeOffsetSeconds?: number;
	/** Read by the evaluator outside sequenceFieldsFor (frame-evaluator.ts line 656). */
	explainHandoff?: (step: PipHandoffStep & { role: "from" | "to"; postSeconds: number }) => void;
	/** Today's sequenceFieldsFor with the alignment bound in; arguments unchanged. */
	frameFields(...args: never[]): AlignmentFields;
}

export interface AlignmentProvider {
	create(project: PostProject): FrameAlignment | null;
}
```

`frameFields` gets its exact parameter list in Task 9 Step 2, copied from today's `sequenceFieldsFor` minus its alignment parameter; the `never[]` placeholder above is replaced there and nowhere else uses it. The evaluator reads `timeMap`, `mediaTimeOffsetSeconds`, `clocks`, `explainHandoff` and `sequencePeriod` outside `sequenceFieldsFor`, so `FrameAlignment` carries them with today's types; `steps` and `startPlacementDuration` are read only inside `sequenceFieldsFor` and stay behind `frameFields`. The evaluator never builds an alignment; every caller passes one in. `evaluatePresetLayers(preset, durationSeconds, timeSeconds, alignment?: FrameAlignment | null, sourceTimeOffsets = {})` keeps its position and default. tka's `post-studio-plugin/alignment.ts` exports `tkaFrameAlignment(input: SequenceFrameAlignment): FrameAlignment`, keeping today's `SequenceFrameAlignment` type there, and `createTkaAlignment(getSequence)` as the `AlignmentProvider`. In step 1, tka's bound `evaluatePresetLayers` and `evaluatePresetFrame` keep today's `SequenceFrameAlignment` parameter and convert it with `tkaFrameAlignment(...)`, so `post-editor-state.svelte.ts`, `media-composition-state.svelte.ts`, the ten test files that call the evaluator and the parity harness pass today's object unchanged. No caller wraps it themselves (that would convert twice).

`PKG/src/core/sequence-types.ts` declares `TakeSample`, `TakeSampleOptions`, `SequencePhase` and `SequenceFrame` with today's exact fields; `take-timing.ts` and `sequence-frame.ts` in tka replace their own declarations with `import type` plus `export type { ... }` from `@austencloud/video-editor/core`.

### Surfaces

`PKG/src/render/surfaces.ts`:

```ts
import type { MediaCompositionPreset } from "../core/preset/preset-schema.js";
import type { EvaluatedFrameLayer } from "./frame-evaluator.js";
import type { FrameLayerGeometry } from "./frame-compositor.js";
import type { PostStudioExportVideoFrames } from "./export-video-frames.js";

export interface SurfaceDrawInput {
	context: CanvasRenderingContext2D;
	root: HTMLElement;
	layerElement: HTMLElement;
	layer: EvaluatedFrameLayer;
	preset: MediaCompositionPreset;
	geometry: FrameLayerGeometry;
	/** Canvas cache shared across frames (today's cardFrameCache). */
	cache: Map<string, HTMLCanvasElement>;
	videoFrames?: PostStudioExportVideoFrames;
	timeSeconds?: number;
}

export interface SurfaceCapture {
	/** The `data-render-mode` this surface draws (TKA: "choreo-card", "sequence-animation"). */
	renderMode: string;
	draw(input: SurfaceDrawInput): Promise<void>;
	/** Called by the exporter in `finally` (TKA: disposes the pictograph capture). */
	release?(): void;
}
```

`RenderPostStudioFrameInput` drops `pictographCapture`, renames `cardFrameCache` to `surfaceCache` and gains `surfaces?: readonly SurfaceCapture[]`. Where today's `drawRegionLayer` branches on `renderMode === "sequence-animation"` (lines 739-797) and `"choreo-card"` (798-820), it calls the matching surface's `draw` with the same values those branches read; a layer with a DOM render mode and no surface draws nothing, as today when capture fails. The compositor exports `applyLayerTransform`, `drawSource` and `resolveFrameLayerGeometry` so the TKA surfaces call the same code as before. `captureCardLayer`, `waitForTunnelHookArtwork`, `waitForChoreoCardQr` and `waitForPictographMotion` move to `post-studio-plugin/surfaces.ts` with `PostStudioPictographCapture` and the DOM capture options, and stay importable from there. `ExportPostStudioVideoInput` gains `surfaces?` and releases each in `finally`; it no longer constructs `PostStudioPictographCapture` itself, the TKA surface factory `createTkaSurfaces()` does.

### Painters

`PKG/src/render/painter-registry.ts`:

```ts
import type { CompiledPostProject } from "../core/compile/compiler.js";
import type { PostProject } from "../core/project/item-kinds.js";
import type { PostStudioLayerPainter } from "./layer-painter.js";

export interface PainterEnv {
	project: PostProject;
	compiled: CompiledPostProject;
}

export interface PainterFactory {
	id: string;
	/** Creates the painter for a preset source role, or null when the role is not this factory's. */
	create(role: string, env: PainterEnv): PostStudioLayerPainter | null;
}

export interface PainterRegistry {
	paintersFor(env: PainterEnv): Map<string, PostStudioLayerPainter>;
}

/** Factories are asked in order; the first non-null painter for a role wins. Core factories come first. */
export function createPainterRegistry(factories: readonly PainterFactory[]): PainterRegistry;

/** The core text painter factory (text items via itemIdFromTextRole). */
export const textPainterFactory: PainterFactory;
```

`paintersFor` walks the compiled preset's source roles in clip order. The `PostStudioLayerPainter` interface is unchanged. tka's `post-studio-plugin/painters.ts` wraps the staying painters (`sequence-strip-painter`, `beat-carousel-painter`, `staff-effect-painter`, `tunnel-titles-painter`, the animation overlay registry) as factories, each built from the same arguments `PostEditorWorkspace.svelte` passes today (lines 575-670 and 835-875), supplied through getters on `createTkaPlugin(env)`. The workspace keeps building its own map in step 1; it moves to the registry in step 2. The backdrop painter is drawn by the compositor directly, as today, so it is not a factory. A core card painter does not exist yet: the card kind still renders through the TKA choreo-card surface (risk 6).

### Bound API in tka

`TKA/src/lib/shared/post-studio-plugin/bound.ts` keeps tka's call shapes:

```ts
import {
	compilePostProject as compileCore,
	createEmptyPostProject as createEmptyCore,
	createProjectSchema,
	defaultBoxFor as defaultBoxForCore,
	normalizeProject as normalizeCore,
	type CompilePostProjectContext,
	type CompiledPostProject,
	type PostItemKind,
	type PostProject,
} from "@austencloud/video-editor/core";
import { createTkaPlugin } from "./create-plugin";

export const tkaPlugin = createTkaPlugin();
export const PostProjectSchema = createProjectSchema(tkaPlugin);

export function normalizeProject(stored: PostProject): PostProject {
	return normalizeCore(stored, tkaPlugin);
}

export function compilePostProject(
	project: PostProject,
	context: Omit<CompilePostProjectContext, "presetId">,
): CompiledPostProject {
	return compileCore(project, { ...context, presetId: `post-project:${project.sequenceId}` }, tkaPlugin);
}

export function defaultBoxFor(kind: PostItemKind) {
	return defaultBoxForCore(kind, tkaPlugin);
}

export function createEmptyPostProject(input: { sequenceId: string; now: number }): PostProject {
	return createEmptyCore({ now: input.now }, tkaPlugin.emptyProjectFields(input));
}
```

`createEmptyCore(input, extensionFields)` returns the core empty project with the extension fields spread right after `schemaVersion` (the core function takes no plugin; the key order is the order of the fields the host passes). `tkaPlugin.emptyProjectFields` is a TKA-only member of the object `createTkaPlugin` returns (its return type is `VideoEditorPlugin & { emptyProjectFields(...) }`). The import rewriter (Task 2) routes each imported name to the first destination that exports it, and the post-project route lists `$lib/shared/post-studio-plugin` before the package, so these five names resolve to the bound versions and every other name to the core.

---

## Tasks

`SCRATCH` below is `/c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1` (Bash path) or `C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step1` (Node path). `PKG` is `/e/worktrees/shared-packages/video-editor/packages/video-editor` and `TKA` is `/e/worktrees/tka-platform/video-editor`. Code in this plan writes newlines as `String.fromCharCode(10)` and avoids backslash escapes, because the tools that wrote it mangle them; keep that form when copying, and write any file that needs a backslash escape with a Node script.

### Task 1: Baselines and the parity "before" capture (opus; opus review)

Runs on the untouched tka tree. Nothing in `src/` changes.

As built (tka f51e601fbd, one commit, 18 files): the DCK times are 41 and 81 instead of 40 and 80 so that text-2 and the end card with its credit are on screen; the plain times use 6.5 instead of 7 so t2 is sampled mid-ramp; the plain fade-black sits on `v2` (9.2 to 10.2 s) because the compiler only builds a transition between an item and the next item on the same track; `v1` is flipped, `v2` has a region edge (corners, gold border, shadow) and `c1` has a keyframed non-full box; non-ASCII characters in `dck.project.json` are stored as JSON escapes. After the two opus reviews the gate also records the DOM capture seam (a `PostStudioPictographCapture` per frame, `createContext`/`domToCanvas`/`destroyContext` with sorted option keys, `getBoundingClientRect` stubbed to half the region so scale is 2, `getContext` arguments, plain objects with sorted keys), rounds floats to 6 decimals in numbers, strings and the three JSON hashes, compares 12 committed draw logs under `tests/fixtures/video-editor-parity/draw-logs/` as text, writes before and after logs plus pretty project/compiled/layers JSON to `os.tmpdir()/claude/video-editor-step1` (`PARITY_LOG_DIR` overrides), computes results in a `beforeAll`, and refuses `PARITY_WRITE=1` while `before.json` exists. The generator `plainProject()` lives in `tests/unit/video-editor-parity/plain-project.ts` and is imported only in write mode. Summary line: `Tests 4 passed | 1 skipped (5)`. Later tasks compare against that commit.

**Files:**
- Create: `TKA/tests/unit/video-editor-parity/harness.ts`
- Create: `TKA/tests/unit/video-editor-parity.test.ts`
- Create: `TKA/tests/fixtures/video-editor-parity/dck.project.json`, `plain.project.json`, `before.json`

- [ ] **Step 1: Baselines**

```bash
mkdir -p /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1
cd /e/worktrees/tka-platform/video-editor && git status --short && git log --oneline -1
npm run check:fast > /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/check-baseline.txt 2>&1; tail -5 /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/check-baseline.txt
npm run test:ci > /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/test-baseline.txt 2>&1; grep -E "Test Files|Tests |Errors" /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/test-baseline.txt
```
Expected: `git status` clean, check:fast reports about 622 errors, test:ci reports its pass and fail counts. Put both counts in the task report; later gates compare against them. Pre-existing test failures are listed by name and excluded from later gates.

- [ ] **Step 2: Extract the DCK fixture**

```bash
cd /e/worktrees/tka-platform/video-editor && node -e '
const fs = require("fs");
const src = "C:/Users/Austen/.tka/post-studio-drafts/1790895873030-4bd8d599-f8b8-4cfc-b133-135191673d3a.json";
const prefix = "tka:post-studio:project:v2:";
function find(node) {
  if (!node || typeof node !== "object") return undefined;
  if (typeof node.key === "string" && node.key.startsWith(prefix)) return node.value;
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(prefix)) return value;
    const hit = find(value);
    if (hit !== undefined) return hit;
  }
  return undefined;
}
let project = find(JSON.parse(fs.readFileSync(src, "utf8")));
if (typeof project === "string") project = JSON.parse(project);
if (!project || project.schemaVersion !== 2) throw new Error("no v2 project record in the draft");
fs.mkdirSync("tests/fixtures/video-editor-parity", { recursive: true });
fs.writeFileSync("tests/fixtures/video-editor-parity/dck.project.json", JSON.stringify(project, null, 2) + String.fromCharCode(10));
console.log(project.sequenceId, project.tracks.map((t) => t.id + ":" + t.items.length).join(" "));
'
```
Expected: the sequence id and `dck-main:3 track-4:6 track-2:1 track-1:1` (track order may differ).

- [ ] **Step 3: Write the harness**

`TKA/tests/unit/video-editor-parity/harness.ts`:

```ts
import { createHash } from "node:crypto";
import { vi } from "vitest";

export const SCRATCH = "C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step1";
export const NL = String.fromCharCode(10);

export function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

export function describeArg(value: unknown): string {
  if (typeof value === "number") return String(round(value));
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || value === undefined || typeof value === "boolean") return String(value);
  if (value instanceof HTMLCanvasElement) {
    return `canvas#${value.dataset.standin ?? `${value.width}x${value.height}`}`;
  }
  if (Array.isArray(value)) return `[${value.map(describeArg).join(",")}]`;
  if (typeof value === "object" && "__recording" in value) {
    return String((value as { __recording: string }).__recording);
  }
  if (typeof value === "function") return "fn";
  return (value as object).constructor?.name ?? "object";
}

const DEFAULTS: Record<string, unknown> = {
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  fillStyle: "#000000",
  strokeStyle: "#000000",
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 10,
  lineDashOffset: 0,
  font: "10px sans-serif",
  textAlign: "start",
  textBaseline: "alphabetic",
  letterSpacing: "0px",
  filter: "none",
  imageSmoothingEnabled: true,
  imageSmoothingQuality: "low",
  shadowBlur: 0,
  shadowColor: "rgba(0, 0, 0, 0)",
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

/** A 2D context that records every call and property set, in order, into `log`. */
export function createRecordingContext(
  log: string[],
  canvas: HTMLCanvasElement,
  name: string
): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { ...DEFAULTS, canvas };
  const stack: Record<string, unknown>[] = [];
  let made = 0;
  const call =
    (key: string) =>
    (...args: unknown[]) => {
      log.push(`${name}.${key}(${args.map(describeArg).join(",")})`);
      return undefined;
    };
  return new Proxy({} as Record<string, unknown>, {
    get(_target, key) {
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return undefined;
      if (key in state) return state[key];
      switch (key) {
        case "save":
          return () => {
            log.push(`${name}.save()`);
            stack.push({ ...state });
          };
        case "restore":
          return () => {
            log.push(`${name}.restore()`);
            const saved = stack.pop();
            if (saved) Object.assign(state, saved);
          };
        case "measureText":
          return (text: string) => {
            const size = Number(/([0-9.]+)px/.exec(String(state.font))?.[1] ?? 10);
            const width = text.length * size * 0.5;
            log.push(`${name}.measureText(${describeArg(text)})`);
            return {
              width,
              actualBoundingBoxLeft: 0,
              actualBoundingBoxRight: width,
              actualBoundingBoxAscent: size * 0.8,
              actualBoundingBoxDescent: size * 0.2,
              fontBoundingBoxAscent: size * 0.8,
              fontBoundingBoxDescent: size * 0.2,
            };
          };
        case "createLinearGradient":
        case "createRadialGradient":
        case "createConicGradient":
        case "createPattern":
          return (...args: unknown[]) => {
            made += 1;
            const id = `${name}.${key}#${made}`;
            log.push(`${id}(${args.map(describeArg).join(",")})`);
            return {
              __recording: id,
              addColorStop: (offset: number, color: string) =>
                log.push(`${id}.addColorStop(${describeArg(offset)},${describeArg(color)})`),
              setTransform: call(`${key}#${made}.setTransform`),
            };
          };
        case "getTransform":
          return () => {
            log.push(`${name}.getTransform()`);
            return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
          };
        case "getImageData":
          return (x: number, y: number, width: number, height: number) => {
            log.push(`${name}.getImageData(${[x, y, width, height].map(describeArg).join(",")})`);
            return { data: new Uint8ClampedArray(Math.max(0, width * height * 4)), width, height };
          };
        default:
          return call(key);
      }
    },
    set(_target, key, value) {
      if (typeof key === "symbol") return true;
      state[key] = value;
      log.push(`${name}.${key}=${describeArg(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/**
 * tests/setup/vitest-setup.ts replaces document.createElement with a vi.fn that
 * returns plain objects (no dataset, append or querySelector, and canvases that
 * are not HTMLCanvasElement), and jsdom 27 has no CSS global, which
 * layerElementForClip needs for CSS.escape. Plain assignments, not spies, so
 * vi.restoreAllMocks() does not undo them between renders.
 */
export function useRealDom(): void {
  document.createElement = Document.prototype.createElement.bind(document) as typeof document.createElement;
  if (typeof globalThis.CSS === "undefined") {
    (globalThis as { CSS?: unknown }).CSS = {
      escape: (value: string) => JSON.stringify(value).slice(1, -1),
    };
  }
}

/** Routes every canvas's 2D context to a recording context, named c1, c2, ... in creation order. */
export function installRecordingCanvas(log: string[]): () => void {
  useRealDom();
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  let count = 0;
  const spy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (this: HTMLCanvasElement) {
      let context = contexts.get(this);
      if (!context) {
        count += 1;
        context = createRecordingContext(log, this, `c${count}`);
        contexts.set(this, context);
      }
      return context as never;
    });
  return () => spy.mockRestore();
}

export function standIn(tag: string, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.standin = tag;
  return canvas;
}

/** Stand-in for PostStudioExportVideoFrames: fixed-size canvases, every request logged. */
export function createVideoFrameStandIns(log: string[], roles: ReadonlySet<string>) {
  return {
    has: (role: string) => roles.has(role),
    frameFor: async (role: string, timeSeconds: number) => {
      log.push(`frameFor(${describeArg(role)},${describeArg(timeSeconds)})`);
      const image = role.startsWith("image");
      return standIn(`${role}@${timeSeconds.toFixed(3)}`, image ? 1200 : 1080, image ? 900 : 1920);
    },
    dispose: () => undefined,
  };
}

/** One .media-layer element per layer, with the render mode the harness assigns. */
export function buildLayerRoot(
  layers: readonly { clipId: string; sourceRole: string }[],
  renderModeFor: (role: string) => string,
  size: { width: number; height: number }
): HTMLElement {
  const root = document.createElement("div");
  for (const layer of layers) {
    const element = document.createElement("div");
    element.className = "media-layer";
    element.dataset.clipId = layer.clipId;
    element.dataset.renderMode = renderModeFor(layer.sourceRole);
    if (element.dataset.renderMode === "choreo-card") {
      const card = document.createElement("div");
      card.className = "choreo-layer";
      element.append(card);
    }
    if (element.dataset.renderMode === "sequence-animation") {
      // The compositor queries [data-sequence-progress-visible] and throws without it.
      const surface = document.createElement("div");
      surface.dataset.sequenceProgressVisible = "true";
      element.append(surface);
    }
    root.append(element);
  }
  const rect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: size.width,
    height: size.height,
    right: size.width,
    bottom: size.height,
    toJSON: () => ({}),
  };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect as DOMRect);
  return root;
}
```

The `sequence-animation` child above matches the selector the compositor queries at `post-studio-frame-compositor.ts` lines 765-767, so that branch reaches its capture call. Do not add a `[data-pictograph-motion]`, `[data-tunnel-hook-pending]` or `[data-qr-pending]` element: each makes the compositor wait on `requestAnimationFrame` and `performance.now()`, which keeps the log nondeterministic. Browser APIs the render touches and how the harness covers them: `document.fonts` is absent in jsdom, so the text painter's `prepare` sets `fontReady = false` and paints the fallback stack every run (deterministic); the blur backdrop's sample canvas comes from the real `createElement` and gets a recording context, and `typeof filter === "string"` takes the filtered path because `DEFAULTS.filter` is a string; `roundRect` and `context.canvas` are served by the proxy.

- [ ] **Step 4: Write the parity test**

`TKA/tests/unit/video-editor-parity.test.ts`:

```ts
// @vitest-environment jsdom
import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PostProjectSchema,
  type PostProject,
} from "$lib/shared/media-composition/domain/post-project";
import { normalizeProject } from "$lib/shared/media-composition/domain/post-project-normalize";
import {
  compilePostProject,
  itemIdFromMovesAnimationRole,
  textRole,
  type CompiledPostProject,
} from "$lib/shared/media-composition/domain/post-project-compiler";
import { POST_STUDIO_ROLE } from "$lib/shared/media-composition/domain/post-studio-presets";
import { takeRole } from "$lib/shared/media-composition/domain/post-plan-compiler";
import {
  resolveTakeTiming,
  takeSampleAt,
} from "$lib/shared/media-composition/domain/take-timing";
import {
  evaluatePresetLayers,
  isVisibleLayer,
  type TakeClock,
} from "$lib/shared/media-composition/services/frame-evaluator";
import { renderPostStudioFrame } from "$lib/shared/media-composition/services/post-studio-frame-compositor";
import { createTextItemPainter } from "$lib/shared/media-composition/services/text-item-painter";
import type { PostStudioLayerPainter } from "$lib/shared/media-composition/services/post-studio-layer-painter";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  NL,
  SCRATCH,
  buildLayerRoot,
  createVideoFrameStandIns,
  installRecordingCanvas,
  sha,
  standIn,
} from "./video-editor-parity/harness";
import {
  NOW,
  card,
  project as buildProject,
  take,
  text,
  video,
} from "./media-composition/post-project-fixtures";

const capture = vi.hoisted(() => ({ log: [] as string[] }));
vi.mock("modern-screenshot", () => ({
  domToCanvas: vi.fn(async () => {
    capture.log.push("domToCanvas()");
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    canvas.dataset.standin = "dom-capture";
    return canvas;
  }),
}));

const DIR = "tests/fixtures/video-editor-parity";
const WRITE = process.env.PARITY_WRITE === "1";
const TIMES: Record<string, number[]> = {
  dck: [0, 10.5, 21.9, 41, 70.25, 81],
  plain: [0.2, 2.5, 4.9, 7, 9.6, 11],
};

function plainProject(): PostProject {
  const base = buildProject(
    [
      video("v1", { sourceIn: 0, sourceOut: 5, transitionOut: { duration: 0.8, type: "crossfade" } }),
      video("v2", { takeId: "b", sourceIn: 2, sourceOut: 8 }),
      card("c1", 2, { transitionOut: { duration: 1, type: "fade-black" } } as never),
    ],
    [
      [
        text("t1", 0.5, 3),
        text("t2", 6, 4, {
          keyframes: {
            opacity: [
              { t: 0, value: 0, easing: [0.25, 0.1, 0.25, 1] },
              { t: 1, value: 1, easing: "hold" },
            ],
          },
        } as never),
      ],
      [
        {
          id: "i1",
          kind: "image",
          imageId: "img-1",
          start: 3,
          duration: 4,
          box: { x: 0.6, y: 0.1, width: 0.3, height: 0.3 },
          opacity: 1,
          fadeIn: 0.5,
          fadeOut: 0.5,
          anchor: null,
          fill: false,
          keyframes: {
            box: [
              { t: 0, value: { x: 0.6, y: 0.1, width: 0.3, height: 0.3 }, easing: [0.42, 0, 0.58, 1] },
              { t: 3, value: { x: 0.5, y: 0.2, width: 0.3, height: 0.3 }, easing: "hold" },
            ],
          },
        } as never,
      ],
    ],
    [take("a", 20), take("b", 20)]
  );
  return {
    ...base,
    images: [{ id: "img-1", label: "Logo", ref: { kind: "linked", url: "https://example.test/logo.png" } }],
    canvas: "4:5",
    background: "blur",
    updatedAt: NOW,
  } as PostProject;
}

function loadFixture(name: "dck" | "plain"): PostProject {
  const file = `${DIR}/${name}.project.json`;
  if (name === "plain" && WRITE && !fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(PostProjectSchema.parse(plainProject()), null, 2) + NL);
  }
  return normalizeProject(PostProjectSchema.parse(JSON.parse(fs.readFileSync(file, "utf8"))));
}

function alignmentFor(project: PostProject) {
  if (!project.timings || Object.keys(project.timings).length === 0) return null;
  const steps = Array.from({ length: 16 }, () => ({ duration: 1 }) as StepData);
  const moveBeats = steps.map((step) => step.duration ?? 1);
  const clocks: Record<string, TakeClock> = {};
  for (const [takeId, timing] of Object.entries(project.timings)) {
    const resolved = resolveTakeTiming(timing, moveBeats);
    clocks[takeRole(takeId)] = {
      sampleAt: (mediaSeconds, options) => takeSampleAt(resolved, mediaSeconds, options),
    };
  }
  return { steps, startPlacementDuration: 1, sequencePeriod: 1, clocks };
}

function paintersFor(compiled: CompiledPostProject): Map<string, PostStudioLayerPainter> {
  if (compiled.titles.length > 0) {
    throw new Error("fixture has titles: build titles painters as PostEditorWorkspace.svelte titlesPainterFor does");
  }
  const painters = new Map<string, PostStudioLayerPainter>();
  for (const entry of compiled.texts) {
    painters.set(
      textRole(entry.itemId),
      createTextItemPainter(() => compiled.texts.find((t) => t.itemId === entry.itemId) ?? null)
    );
  }
  return painters;
}

function renderModeFor(role: string, painters: Map<string, PostStudioLayerPainter>): string {
  if (role === POST_STUDIO_ROLE.card) return "choreo-card";
  if (role === POST_STUDIO_ROLE.animation || itemIdFromMovesAnimationRole(role) !== null) {
    return "sequence-animation";
  }
  if (painters.has(role)) return "painted";
  return "external-media";
}

interface FixtureHashes {
  project: string;
  compiled: string;
  layers: string[];
  draw: string[];
  drawCalls: number[];
}

async function run(name: "dck" | "plain"): Promise<FixtureHashes> {
  const project = loadFixture(name);
  const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
  if (!compiled) throw new Error(`${name}: compilePostProject returned null (no clips)`);
  const alignment = alignmentFor(project);
  const painters = paintersFor(compiled);
  const size = project.canvas === "4:5" ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 };
  const out: FixtureHashes = {
    project: sha(JSON.stringify(project)),
    compiled: sha(JSON.stringify(compiled)),
    layers: [],
    draw: [],
    drawCalls: [],
  };
  for (const time of TIMES[name]!) {
    const layers = evaluatePresetLayers(compiled.preset, compiled.durationSeconds, time, alignment);
    out.layers.push(sha(JSON.stringify(layers)));
    const visible = layers.filter(isVisibleLayer);
    const log: string[] = [];
    capture.log = log;
    const restore = installRecordingCanvas(log);
    try {
      const mediaRoles = new Set(
        visible
          .map((layer) => layer.sourceRole)
          .filter((role) => renderModeFor(role, painters) === "external-media")
      );
      await renderPostStudioFrame({
        canvas: standIn("output", size.width, size.height),
        root: buildLayerRoot(visible, (role) => renderModeFor(role, painters), size),
        preset: compiled.preset,
        layers: visible,
        cardFrameCache: new Map(),
        painters,
        videoFrames: createVideoFrameStandIns(log, mediaRoles) as never,
        timeSeconds: time,
      });
    } finally {
      restore();
      vi.restoreAllMocks();
    }
    const text = log.join(NL);
    out.draw.push(sha(text));
    out.drawCalls.push(log.length);
    fs.mkdirSync(SCRATCH, { recursive: true });
    fs.writeFileSync(`${SCRATCH}/parity-${WRITE ? "before" : "after"}-${name}-${time}.txt`, text);
  }
  return out;
}

describe("video editor parity", () => {
  afterEach(() => vi.restoreAllMocks());
  const beforeFile = `${DIR}/before.json`;
  const results: Record<string, FixtureHashes> = {};

  for (const name of ["dck", "plain"] as const) {
    it(`${name}: project, compile and layers match the before capture`, async () => {
      results[name] = await run(name);
      if (WRITE) return;
      const before = JSON.parse(fs.readFileSync(beforeFile, "utf8"))[name] as FixtureHashes;
      expect(results[name]!.project).toBe(before.project);
      expect(results[name]!.compiled).toBe(before.compiled);
      expect(results[name]!.layers).toEqual(before.layers);
    });
    it(`${name}: draw log matches the before capture`, () => {
      if (WRITE) return;
      const before = JSON.parse(fs.readFileSync(beforeFile, "utf8"))[name] as FixtureHashes;
      expect(results[name]!.drawCalls).toEqual(before.drawCalls);
      expect(results[name]!.draw).toEqual(before.draw);
    });
  }

  it.runIf(WRITE)("writes the before capture", () => {
    fs.writeFileSync(beforeFile, JSON.stringify(results, null, 2) + NL);
  });
});
```

If `PostProjectSchema.parse(plainProject())` rejects a field (the `keyframes` shape on `t2`, the card's `transitionOut`, `canvas` or `background`), change the builder to match that field's schema in `post-project.ts` and keep the intent (an animated text item, a fade-black at the end, 4:5, blur). Do not drop the field.

- [ ] **Step 5: Capture, then verify twice**

```bash
cd /e/worktrees/tka-platform/video-editor
PARITY_WRITE=1 npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts
npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts
npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts
node -e 'const b = require("./tests/fixtures/video-editor-parity/before.json"); for (const [k, v] of Object.entries(b)) console.log(k, v.drawCalls.join(" "))'
grep -c "domToCanvas" /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/parity-before-dck-81.txt
```
Expected: the write run passes; both verify runs pass 4 tests (two runs prove the capture is deterministic); every `drawCalls` entry is above 0; the DCK log at 80 s contains at least one `domToCanvas` line (the card surface ran). A draw count of 0 where layers are visible, or no capture on the card frame, means the harness does not reach the drawing code: fix the harness, delete `before.json` and `plain.project.json`, and recapture. A hash that changes between the two verify runs means something in the path depends on time or order: find it before going on.

- [ ] **Step 6: Commit (tka)**

```bash
cd /e/worktrees/tka-platform/video-editor && git add tests/unit/video-editor-parity.test.ts tests/unit/video-editor-parity/harness.ts tests/fixtures/video-editor-parity/dck.project.json tests/fixtures/video-editor-parity/plain.project.json tests/fixtures/video-editor-parity/before.json && git commit -q -F - <<'MSG'
test(post): capture draw-call parity hashes before the video editor extraction

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 2: Package infrastructure, spike worker rename and the move tools (sonnet; opus review)

**Files:**
- Modify: `PKG/package.json`, `PKG/src/index.ts`, `PKG/src/workers/index.ts`, `PKG/src/workers/messages.ts`, `PKG/src/ui/VideoEditor.svelte`, `PKG/scripts/spike/worker-proof.mjs`
- Rename: `PKG/src/workers/preview-video.worker.ts` to `PKG/src/workers/spike.worker.ts`
- Create: `PKG/vitest.config.ts`, `PKG/test/infrastructure.test.ts`, `PKG/src/render/index.ts`, `PKG/src/encoder/index.ts`, `PKG/src/workers/worker-scope.ts`
- Create: `PKG/scripts/step1/moves.json`, `ascii.mjs`, `forbidden-imports.mjs`, `check-intersection.mjs`, `move.mjs`, `rewrite-imports.mjs`
- Modify: `TKA/tests/config/vitest.config.ts`, `TKA/tests/config/vitest.components.config.ts`

- [ ] **Step 1: Dependencies, exports and the test script**

Print tka's ranges so the package matches them:
```bash
node -e 'const p = require("/e/worktrees/tka-platform/video-editor/package.json"); for (const n of ["zod", "dexie", "h264-mp4-encoder", "vitest", "jsdom"]) console.log(n, (p.dependencies || {})[n] || (p.devDependencies || {})[n])'
```
Edit `PKG/package.json`: add `"dependencies"` with `zod`, `dexie` and `h264-mp4-encoder` at those ranges; add `vitest` and `jsdom` to `devDependencies` at those ranges; add the two subpaths after `"./core"`:
```json
		"./render": {
			"types": "./dist/render/index.d.ts",
			"import": "./dist/render/index.js"
		},
		"./encoder": {
			"types": "./dist/encoder/index.d.ts",
			"import": "./dist/encoder/index.js"
		},
```
and change the test script to `"test": "node --test test/*.test.mjs && vitest run"`. `wavesurfer.js`, `modern-screenshot` and `@fortawesome/free-solid-svg-icons` are not added: no file moving in step 1 imports them (the compositor's `modern-screenshot` imports leave with the TKA surfaces).

Create `PKG/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		include: ["test/**/*.test.ts"],
	},
});
```

Create `PKG/src/render/index.ts` and `PKG/src/encoder/index.ts`, each containing only:
```ts
export {};
```
Tasks 4, 9, 10 and 11 fill them.

Install from the shared-packages root only:
```bash
cd /e/worktrees/shared-packages/video-editor && pnpm install
```
Expected: the lockfile gains the five packages; no other package's dependencies change (`git diff --stat pnpm-lock.yaml` touches only `packages/video-editor` importers and the new packages).

- [ ] **Step 2: Rename the spike worker**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && git mv src/workers/preview-video.worker.ts src/workers/spike.worker.ts && grep -rn "preview-video\|PreviewWorker\|createPreviewWorker" src scripts test
```
In every hit: `createPreviewWorker` becomes `createSpikeWorker`, `PreviewWorkerPing` and `PreviewWorkerPong` become `SpikeWorkerPing` and `SpikeWorkerPong`, and `src/workers/index.ts` spawns `new URL("./spike.worker.js", import.meta.url)`. In `scripts/spike/worker-proof.mjs`, the chunk filter becomes `file.startsWith("spike.worker")` and its messages say `spike.worker`; keep the `answersPing` check on the `"pong"` literal. `src/index.ts` exports `createSpikeWorker` and the two renamed types. The name `preview-video.worker.ts` is now free for the real worker (Task 11).

- [ ] **Step 3: The typed worker scope**

`PKG/src/workers/worker-scope.ts`:
```ts
/**
 * The package type-checks with one tsconfig and the DOM lib, so `self` is a
 * Window there and `postMessage(message, transfer)` does not type-check.
 * Workers use this instead of `self`.
 */
export interface WorkerScope {
	postMessage(message: unknown, transfer?: Transferable[]): void;
	addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
	onmessage: ((event: MessageEvent) => void) | null;
}

export const workerScope = self as unknown as WorkerScope;
```

- [ ] **Step 4: The move tools**

`PKG/scripts/step1/moves.json` is the single table of what moves where. `from` is a tka module id without extension; `to` is the package file under `src/`; `entry` is the subpath tka imports it from; `task` is the task that moves it. `routes` lists split modules: the destinations their importers' names are routed to, in order.

```json
{
	"moves": [
		{ "task": 4, "from": "$lib/shared/video-export/domain/captured-frame", "to": "encoder/captured-frame.ts", "entry": "@austencloud/video-editor/encoder" },
		{ "task": 4, "from": "$lib/shared/video-export/services/canvas-frame-capturer", "to": "encoder/canvas-frame-capturer.ts", "entry": "@austencloud/video-editor/encoder" },
		{ "task": 4, "from": "$lib/shared/animation-engine/services/background-video-encoder", "to": "encoder/background-video-encoder.ts", "entry": "@austencloud/video-editor/encoder" },
		{ "task": 4, "from": "$lib/shared/animation-engine/workers/video-export.worker", "to": "workers/video-export.worker.ts", "entry": "@austencloud/video-editor/encoder" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/tunnel-hook", "to": "core/tunnel-hook.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/media-layout-schema", "to": "core/preset/layout-schema.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/media-source-schema", "to": "core/preset/source-schema.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/sequence-time-map", "to": "core/time-map.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/media-composition-preset-schema", "to": "core/preset/preset-schema.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/post-plan", "to": "core/plan/post-plan.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/post-studio-presets", "to": "core/plan/presets.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/post-plan-compiler", "to": "core/plan/plan-compiler.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/caption-layout", "to": "core/caption-layout.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/post-video-color-grade", "to": "core/color-grade.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 5, "from": "$lib/shared/media-composition/domain/preview-video", "to": "core/preview-video.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 6, "from": "$lib/shared/media-composition/domain/music-grid", "to": "core/music/music-grid.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 6, "from": "$lib/shared/media-composition/domain/post-canvas", "to": "core/project/canvas.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 6, "from": "$lib/shared/media-composition/domain/post-clip-edge", "to": "core/project/clip-edge.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 6, "from": "$lib/shared/media-composition/domain/post-take-labels", "to": "core/project/take-labels.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 7, "from": "$lib/shared/media-composition/domain/post-project-keyframes", "to": "core/project/keyframes.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 8, "from": "$lib/shared/media-composition/domain/post-audio-plan", "to": "core/music/audio-plan.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 10, "from": "$lib/shared/render/utils/trace-rounded-rect", "to": "render/rounded-rect.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/media-fit", "to": "render/media-fit.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/post-studio-layer-painter", "to": "render/layer-painter.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/text-item-painter", "to": "render/text-item-painter.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/post-backdrop-painter", "to": "render/backdrop-painter.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/region-edge-painter", "to": "render/region-edge-painter.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/post-studio-export-video-frames", "to": "render/export-video-frames.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 10, "from": "$lib/shared/media-composition/services/post-studio-exporter", "to": "render/post-exporter.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/contracts/IPreviewVideoCache", "to": "render/preview-cache/preview-video-cache-contract.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/implementations/PreviewVideoCache", "to": "render/preview-cache/preview-video-cache.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/preview-video-store", "to": "render/preview-cache/preview-video-store.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/preview-video-render", "to": "render/preview-cache/preview-video-render.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/workers/preview-video.worker", "to": "workers/preview-video.worker.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/preview-video-frame-recovery", "to": "render/preview-frame-recovery.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/video-preview-seek", "to": "render/video-preview-seek.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/post-preview-clock", "to": "render/preview-clock.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/post-audio-track", "to": "render/audio-track.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/music-preview-sync", "to": "render/music-preview-sync.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/video-mirror", "to": "render/video-mirror.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 11, "from": "$lib/shared/media-composition/services/media-audio-inspector", "to": "render/media-audio-inspector.ts", "entry": "@austencloud/video-editor/render" }
	],
	"splits": [
		{ "task": 6, "from": "$lib/shared/media-composition/domain/post-music", "to": "core/music/post-music.ts", "routes": ["$lib/shared/post-studio-plugin", "@austencloud/video-editor/core"] },
		{ "task": 6, "from": "$lib/shared/media-composition/domain/post-project", "to": "core/project/schema.ts", "routes": ["$lib/shared/post-studio-plugin", "@austencloud/video-editor/core"] },
		{ "task": 7, "from": "$lib/shared/media-composition/domain/post-project-normalize", "to": "core/project/normalize.ts", "routes": ["$lib/shared/post-studio-plugin", "@austencloud/video-editor/core"] },
		{ "task": 8, "from": "$lib/shared/media-composition/domain/post-project-compiler", "to": "core/compile/compiler.ts", "routes": ["$lib/shared/post-studio-plugin", "@austencloud/video-editor/core"] },
		{ "task": 8, "from": "$lib/shared/media-composition/domain/pip-handoff", "to": "core/pip-sample.ts", "routes": ["$lib/shared/media-composition/domain/pip-handoff", "@austencloud/video-editor/core"] },
		{ "task": 8, "from": "$lib/shared/media-composition/domain/tunnel-titles", "to": "core/roles.ts", "routes": ["$lib/shared/media-composition/domain/tunnel-titles", "@austencloud/video-editor/core"] },
		{ "task": 9, "from": "$lib/shared/media-composition/services/frame-evaluator", "to": "render/frame-evaluator.ts", "routes": ["$lib/shared/post-studio-plugin", "@austencloud/video-editor/render"] },
		{ "task": 10, "from": "$lib/shared/media-composition/services/post-studio-frame-compositor", "to": "render/frame-compositor.ts", "routes": ["$lib/shared/post-studio-plugin", "@austencloud/video-editor/render"] }
	]
}
```

A split whose first route is its own path keeps the names it still exports and routes the rest to the package. The worker entries never get importers rewritten to the worker file (tka never imports a worker module directly except the codec test, handled in Task 4); `entry` only names where its exports surface.

`PKG/scripts/step1/lib.mjs` (shared by the tools):
```js
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const NL = String.fromCharCode(10);
export const TKA = "E:/worktrees/tka-platform/video-editor";
export const PKG = "E:/worktrees/shared-packages/video-editor/packages/video-editor";
export const ENTRIES = {
	"@austencloud/video-editor": `${PKG}/src/index.ts`,
	"@austencloud/video-editor/core": `${PKG}/src/core/index.ts`,
	"@austencloud/video-editor/render": `${PKG}/src/render/index.ts`,
	"@austencloud/video-editor/encoder": `${PKG}/src/encoder/index.ts`,
};
export const table = JSON.parse(fs.readFileSync(new URL("./moves.json", import.meta.url), "utf8"));
export const slash = (p) => p.split(path.sep).join("/");

export function taskArg() {
	const i = process.argv.indexOf("--task");
	const n = i < 0 ? NaN : Number(process.argv[i + 1]);
	if (!Number.isInteger(n)) throw new Error("pass --task <number>");
	return n;
}

/** A tka module id ("$lib/...", no extension) for a specifier, or null for packages and paths outside src/lib. */
export function moduleIdOf(spec, fromFile) {
	const strip = (s) => s.replace(/[.](ts|js)$/, "");
	if (spec.startsWith("$lib/")) return strip(spec);
	if (!spec.startsWith(".")) return null;
	const abs = strip(path.posix.join(path.posix.dirname(slash(fromFile)), spec));
	const lib = `${TKA}/src/lib/`;
	return abs.startsWith(lib) ? `$lib/${abs.slice(lib.length)}` : null;
}

/** The source file for a module id or package specifier. */
export function fileOf(spec) {
	if (ENTRIES[spec]) return ENTRIES[spec];
	const base = spec.startsWith("$lib/") ? `${TKA}/src/lib/${spec.slice(5)}` : spec;
	for (const candidate of [base, `${base}.ts`, `${base}.svelte.ts`, `${base}/index.ts`]) {
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return null;
}

export function parse(file, text = fs.readFileSync(file, "utf8")) {
	return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Every name a module exports, following export-star and export-from through relative, $lib and package paths. */
export function exportsOf(spec, seen = new Set()) {
	const file = fileOf(spec);
	if (!file) {
		if (spec.startsWith(".") || spec.startsWith("$lib/")) throw new Error(`cannot resolve ${spec}`);
		return new Set(); // export * from an npm package: its names are never routed
	}
	if (seen.has(file)) return new Set();
	seen.add(file);
	const names = new Set();
	const resolve = (s) => {
		if (s.startsWith(".")) {
			const target = path.posix.join(path.posix.dirname(slash(file)), s).replace(/[.]js$/, "");
			return target;
		}
		return s;
	};
	for (const statement of parse(file).statements) {
		if (ts.isExportDeclaration(statement)) {
			const from = statement.moduleSpecifier && resolve(statement.moduleSpecifier.text);
			if (!statement.exportClause && from) {
				for (const name of exportsOf(from, seen)) names.add(name);
			} else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
				for (const element of statement.exportClause.elements) names.add(element.name.text);
			}
			continue;
		}
		const exported = ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
		if (!exported) continue;
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
			}
		} else if (statement.name && ts.isIdentifier(statement.name)) {
			names.add(statement.name.text);
		}
	}
	return names;
}

export function walk(dir, exts, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const full = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walk(full, exts, out);
		else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
	}
	return out;
}
```

`PKG/scripts/step1/ascii.mjs` (usage: `node ascii.mjs <file>...`; rewrites in place, exits 1 on a character it has no rule for):
```js
import fs from "node:fs";
import ts from "typescript";
import { parse } from "./lib.mjs";

const BACKSLASH = String.fromCharCode(92);
const COMMENT = new Map([
	[0x2014, " - "], [0x2013, "-"], [0x2212, "-"], [0x2192, "->"], [0x2190, "<-"], [0x21d2, "=>"],
	[0x2026, "..."], [0x00d7, "x"], [0x2018, "'"], [0x2019, "'"], [0x201c, '"'], [0x201d, '"'],
	[0x2264, "<="], [0x2265, ">="], [0x2248, "~"], [0x00b0, " deg"], [0x00b7, "-"], [0x2022, "*"],
	[0x03a8, "Psi"], [0x00a0, " "],
]);
const LITERALS = new Set([
	ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead,
	ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail, ts.SyntaxKind.RegularExpressionLiteral,
]);
let failed = false;
for (const file of process.argv.slice(2)) {
	let fileFailed = false;
	const text = fs.readFileSync(file, "utf8");
	const ranges = [];
	const visit = (node) => {
		if (LITERALS.has(node.kind)) ranges.push([node.getStart(), node.end]);
		ts.forEachChild(node, visit);
	};
	visit(parse(file, text));
	const inLiteral = (i) => ranges.some(([a, b]) => i >= a && i < b);
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 128) { out += text[i]; continue; }
		if (inLiteral(i)) { out += `${BACKSLASH}u${code.toString(16).padStart(4, "0")}`; continue; }
		const swap = COMMENT.get(code);
		if (swap === undefined) {
			const line = text.slice(0, i).split(String.fromCharCode(10)).length;
			console.error(`${file}:${line}: no ASCII rule for U+${code.toString(16).padStart(4, "0")} outside a literal`);
			failed = true;
			fileFailed = true;
			out += "?";
		} else out += swap;
	}
	if (fileFailed) console.error(`${file}: left unchanged`);
	else fs.writeFileSync(file, out);
}
process.exit(failed ? 1 : 0);
```
A character it rejects is an emoji or symbol in a comment: add a rule to `COMMENT` (emoji map to `""`) and rerun; a file with a rejected character is left unchanged. Never hand-edit the escapes.

`PKG/scripts/step1/forbidden-imports.mjs`:
```js
import fs from "node:fs";
import { PKG, walk } from "./lib.mjs";

const BANNED = ["$lib", "$app", "$env", "firebase", "bits-ui", "modern-screenshot"];
let count = 0;
for (const file of walk(`${PKG}/src`, [".ts", ".svelte"])) {
	fs.readFileSync(file, "utf8").split(String.fromCharCode(10)).forEach((line, i) => {
		if (BANNED.some((b) => line.includes(`from "${b}`) || line.includes(`import("${b}`))) {
			console.log(`${file}:${i + 1}: ${line.trim()}`);
			count += 1;
		}
	});
}
console.log(`forbidden imports: ${count}`);
process.exit(count === 0 ? 0 : 1);
```

`PKG/scripts/step1/check-intersection.mjs` (usage: `node check-intersection.mjs <baseline> <after>`):
```js
import fs from "node:fs";

const keyOf = (line) =>
	line
		.replace(/:[0-9]+:[0-9]+/g, "")
		.replace(/[(][0-9]+,[0-9]+[)]/g, "")
		.replace(/[ ]+/g, " ")
		.trim();
const count = (file) => {
	const map = new Map();
	for (const line of fs.readFileSync(file, "utf8").split(String.fromCharCode(10))) {
		if (!/error/i.test(line) || !/(src|tests)[/]/.test(line)) continue;
		const key = keyOf(line);
		map.set(key, (map.get(key) ?? 0) + 1);
	}
	return map;
};
const before = count(process.argv[2]);
const after = count(process.argv[3]);
const added = [...after].filter(([key, n]) => n > (before.get(key) ?? 0));
const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
console.log(`baseline ${total(before)}, after ${total(after)}, new ${added.length}`);
for (const [key] of added) console.log(`NEW: ${key}`);
process.exit(added.length === 0 ? 0 : 1);
```
Run it once on the Task 1 baseline against itself; it must print `new 0`, and its `baseline` total must match the error count Task 1 Step 1 recorded (about 622). A total of 0 means the filter matched nothing (for example, Windows backslash paths fail `(src|tests)[/]`); change that test to `/(src|tests)[^a-z0-9]/` and rerun. Then open `check-baseline.txt` and confirm the lines it counts are the error lines (if svelte-fast-check prints the path and the message on separate lines, join each message line to the path line above it inside `count` before keying, and say so in the task report).

`PKG/scripts/step1/move.mjs` (usage: `node move.mjs --task N`): copies each `moves` and `splits` entry of task N from tka into the package, rewrites the copy's imports of anything already moved (task at most N) to relative `.js` paths, and lists every import it could not place.
```js
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ENTRIES, PKG, fileOf, moduleIdOf, parse, slash, table, taskArg } from "./lib.mjs";

const task = taskArg();
const placed = new Map();
for (const entry of [...table.moves, ...table.splits]) if (entry.task <= task) placed.set(entry.from, entry.to);
const unresolved = [];
for (const entry of [...table.moves, ...table.splits].filter((e) => e.task === task)) {
	const source = fileOf(entry.from);
	if (!source) throw new Error(`missing ${entry.from}`);
	const target = `${PKG}/src/${entry.to}`;
	fs.mkdirSync(path.dirname(target), { recursive: true });
	let text = fs.readFileSync(source, "utf8");
	const edits = [];
	const visit = (node) => {
		const spec =
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
				? node.moduleSpecifier
				: ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])
					? node.arguments[0]
					: null;
		if (spec) {
			const id = moduleIdOf(spec.text, source);
			if (id && placed.has(id)) {
				let rel = path.posix.relative(path.posix.dirname(`src/${entry.to}`), `src/${placed.get(id)}`).replace(/[.]ts$/, ".js");
				if (!rel.startsWith(".")) rel = `./${rel}`;
				edits.push([spec.getStart() + 1, spec.end - 1, rel]);
			} else if (ENTRIES[spec.text]) {
				// A tka file switched to the package in an earlier task imports it by name; inside the package that is a relative path.
				let rel = path.posix.relative(path.posix.dirname(`src/${entry.to}`), ENTRIES[spec.text].slice(PKG.length + 1)).replace(/[.]ts$/, ".js");
				if (!rel.startsWith(".")) rel = `./${rel}`;
				edits.push([spec.getStart() + 1, spec.end - 1, rel]);
			} else if (id) unresolved.push(`${entry.to}: ${spec.text}`);
		}
		ts.forEachChild(node, visit);
	};
	visit(parse(source, text));
	for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + value + text.slice(end);
	if (text.includes("import.meta.url")) unresolved.push(`${entry.to}: uses import.meta.url (check the worker URL by hand)`);
	fs.writeFileSync(target, text);
	console.log(`copied ${slash(source)} -> src/${entry.to}`);
}
for (const line of unresolved) console.log(`UNRESOLVED ${line}`);
```

`PKG/scripts/step1/rewrite-imports.mjs` (usage: `node rewrite-imports.mjs --task N [--dry]`): rewrites tka importers of everything moved or split up to task N.
```js
import fs from "node:fs";
import ts from "typescript";
import { NL, TKA, exportsOf, moduleIdOf, parse, table, taskArg, walk } from "./lib.mjs";

const task = taskArg();
const dry = process.argv.includes("--dry");
const routes = new Map();
for (const m of table.moves) if (m.task <= task && !m.from.endsWith(".worker")) routes.set(m.from, [m.entry]);
for (const s of table.splits) if (s.task <= task) routes.set(s.from, s.routes);
const exportCache = new Map();
const namesOf = (dest) => {
	if (!exportCache.has(dest)) exportCache.set(dest, exportsOf(dest));
	return exportCache.get(dest);
};
const errors = [];
let changed = 0;
const files = [
	...walk(`${TKA}/src`, [".ts", ".svelte"]),
	...walk(`${TKA}/tests`, [".ts", ".svelte"]),
	...walk(`${TKA}/scripts`, [".ts", ".mts", ".mjs"]),
];

function rewriteScript(file, text) {
	const edits = [];
	const visit = (node) => {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
			const id = moduleIdOf(node.moduleSpecifier.text, file);
			const dests = id && routes.get(id);
			if (dests) edits.push(...planDeclaration(node, dests, file, id));
		} else if (ts.isCallExpression(node) && ts.isStringLiteral(node.arguments[0] ?? node)) {
			const arg = node.arguments[0];
			const id = arg && ts.isStringLiteral(arg) ? moduleIdOf(arg.text, file) : null;
			const dests = id && routes.get(id);
			if (dests) {
				const callee = node.expression.getText();
				if (dests.length === 1 && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
					edits.push([arg.getStart() + 1, arg.end - 1, dests[0]]);
				} else errors.push(`${file}: ${callee}("${arg.text}") needs a hand edit`);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(parse(file, text));
	return edits;
}

function planDeclaration(node, dests, file, id) {
	const spec = node.moduleSpecifier;
	const clause = ts.isImportDeclaration(node) ? node.importClause : null;
	const named = ts.isImportDeclaration(node)
		? clause && clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings : null
		: node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause : null;
	const hasOther = ts.isImportDeclaration(node) ? (clause && (clause.name || (clause.namedBindings && !named))) || !clause : !node.exportClause;
	if (dests.length === 1) return [[spec.getStart() + 1, spec.end - 1, dests[0]]];
	if (hasOther || !named) {
		errors.push(`${file}: default, namespace or star import of split module ${id} needs a hand edit`);
		return [];
	}
	const groups = new Map();
	for (const element of named.elements) {
		const name = (element.propertyName ?? element.name).text;
		const dest = dests.find((d) => namesOf(d).has(name));
		if (!dest) {
			errors.push(`${file}: ${name} from ${id} is exported by none of ${dests.join(", ")}`);
			return [];
		}
		if (!groups.has(dest)) groups.set(dest, []);
		groups.get(dest).push(element.getText());
	}
	const keyword = ts.isImportDeclaration(node) ? "import" : "export";
	const typeOnly = (ts.isImportDeclaration(node) ? clause.isTypeOnly : node.isTypeOnly) ? " type" : "";
	const text = [...groups]
		.map(([dest, elements]) => `${keyword}${typeOnly} {${NL}  ${elements.join(`,${NL}  `)},${NL}} from "${dest}";`)
		.join(NL);
	return [[node.getStart(), node.end, text]];
}

for (const file of files) {
	const original = fs.readFileSync(file, "utf8");
	let text = original;
	const blocks = file.endsWith(".svelte") ? scriptBlocks(text) : [[0, text.length]];
	for (const [start, end] of blocks.reverse()) {
		const body = text.slice(start, end);
		let next = body;
		for (const [a, b, value] of rewriteScript(file, body).sort((x, y) => y[0] - x[0])) next = next.slice(0, a) + value + next.slice(b);
		text = text.slice(0, start) + next + text.slice(end);
	}
	if (text !== original) {
		changed += 1;
		if (file.includes("/scripts/")) errors.push(`${file}: a script imports a moved module; check it still runs`);
		if (!dry) fs.writeFileSync(file, text);
		else console.log(`would change ${file}`);
	}
}

function scriptBlocks(text) {
	const blocks = [];
	let from = 0;
	for (;;) {
		const open = text.indexOf("<script", from);
		if (open < 0) break;
		const bodyStart = text.indexOf(">", open) + 1;
		const close = text.indexOf("</script>", bodyStart);
		blocks.push([bodyStart, close]);
		from = close + 9;
	}
	return blocks;
}

console.log(`${dry ? "would change" : "changed"} ${changed} files`);
for (const line of errors) console.log(`ERROR ${line}`);
process.exit(errors.length === 0 ? 0 : 1);
```
After every rewrite, run tka's Prettier on the changed files so the grouped imports match tka style: `npx prettier --write $(git diff --name-only -- src tests)`.

- [ ] **Step 5: Package infrastructure test**

`PKG/test/infrastructure.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatTimecode } from "../src/core/index.js";

describe("package test runner", () => {
	it("runs TypeScript tests under jsdom", () => {
		expect(typeof document.createElement).toBe("function");
		expect(formatTimecode(83.5)).toBe(formatTimecode(83.5));
	});
});
```

- [ ] **Step 6: tka vitest aliases**

In `TKA/tests/config/vitest.config.ts`, inside `test.alias`, directly after the `"@tka/render-core"` entry, and in `TKA/tests/config/vitest.components.config.ts`, inside `resolve.alias`, directly after its `"@tka/render-core"` entry, add exactly:
```ts
      // @austencloud/video-editor dev loop (extraction steps 1 to 3): the same
      // build output svelte.config.js aliases. Step 4 removes these two
      // entries with the svelte.config.js ones. The css entry sits first
      // because the first matching alias prefix wins.
      "@austencloud/video-editor/css":
        "E:/worktrees/shared-packages/video-editor/packages/video-editor/css",
      "@austencloud/video-editor":
        "E:/worktrees/shared-packages/video-editor/packages/video-editor/dist",
```

- [ ] **Step 7: Gates**

```bash
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test
node packages/video-editor/scripts/step1/forbidden-imports.mjs
node packages/video-editor/scripts/step1/check-intersection.mjs /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/check-baseline.txt /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/check-baseline.txt
node packages/video-editor/scripts/step1/rewrite-imports.mjs --task 3 --dry
ls packages/video-editor/dist/workers
```
Expected: package gate green (the node tests and `infrastructure.test.ts` pass), `forbidden imports: 0`, `new 0`, `would change 0 files` with no ERROR lines (nothing routes before Task 4), and `dist/workers` lists `spike.worker.js`. The spike chunk-name proof runs in Task 14, which has the production build.

- [ ] **Step 8: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor && git add pnpm-lock.yaml packages/video-editor/package.json packages/video-editor/vitest.config.ts packages/video-editor/test/infrastructure.test.ts packages/video-editor/src/index.ts packages/video-editor/src/render/index.ts packages/video-editor/src/encoder/index.ts packages/video-editor/src/workers/index.ts packages/video-editor/src/workers/messages.ts packages/video-editor/src/workers/spike.worker.ts packages/video-editor/src/workers/worker-scope.ts packages/video-editor/src/ui/VideoEditor.svelte packages/video-editor/scripts/spike/worker-proof.mjs packages/video-editor/scripts/step1 && git commit -q -F - <<'MSG'
feat(video-editor): step 1 infrastructure: vitest, render and encoder entries, spike worker rename, move tools

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
cd /e/worktrees/tka-platform/video-editor && git add tests/config/vitest.config.ts tests/config/vitest.components.config.ts && git commit -q -F - <<'MSG'
test(post): alias @austencloud/video-editor in both vitest configs

Package: video-editor@<short hash from the commit above>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 3: Strictness census (haiku; no review)

The package tsconfig is stricter than tka's. This task measures how many errors the moving code raises under the package flags, before any file moves, and applies one rule.

**Decision rule.** For each of `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`: delta(F) = errors in the moved set with every package flag on, minus errors with only F turned off. If delta(F) > 150, turn F off in `PKG/tsconfig.json` for step 1 (step 3 turns it back on). Otherwise F stays on and Tasks 4 to 11 fix its errors as they move each file, with runtime no-op fixes only (`!` after a proven index, `?? fallback` only where the value can never be undefined at runtime, `| undefined` on optional fields); the parity gate catches any drift. The other package flags (`noUnusedLocals` TS6133, `noImplicitReturns` TS7030, `noFallthroughCasesInSwitch` TS7029, `noImplicitOverride` TS4114, `verbatimModuleSyntax` TS1484) always stay on; their counts are reported so the movers expect them.

**Files:**
- Create: `PKG/scripts/step1/census.mjs`
- Maybe modify: `PKG/tsconfig.json`

- [ ] **Step 1: Write the census script**

`PKG/scripts/step1/census.mjs` (usage: `node census.mjs base|nuia|eopt|report`). It type-checks the tka source of every file in `moves.json` in place, using tka's tsconfig (so `$lib`, `$app` and tka's ambient types resolve) with the package's strictness flags on top, and counts only errors inside those files.
```js
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { PKG, TKA, fileOf, slash, table } from "./lib.mjs";

const OUT = "C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/census";
const FLAGS = [
	"strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes", "noUnusedLocals", "noUnusedParameters",
	"noImplicitReturns", "noFallthroughCasesInSwitch", "noImplicitOverride", "noPropertyAccessFromIndexSignature",
	"useUnknownInCatchVariables", "verbatimModuleSyntax",
];
const REPORTED = ["TS6133", "TS7030", "TS7029", "TS4114", "TS1484"];
const variant = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

if (variant === "report") {
	const read = (v) => JSON.parse(fs.readFileSync(`${OUT}/${v}.json`, "utf8"));
	const base = read("base");
	console.log(`base: ${base.total} errors in ${base.files} moved files`);
	for (const code of REPORTED) console.log(`  ${code}: ${base.byCode[code] ?? 0}`);
	for (const [v, flag] of [["nuia", "noUncheckedIndexedAccess"], ["eopt", "exactOptionalPropertyTypes"]]) {
		const delta = base.total - read(v).total;
		console.log(`${flag}: delta ${delta} -> ${delta > 150 ? "TURN OFF for step 1" : "keep on, fix while moving"}`);
	}
	process.exit(0);
}

const parsed = ts.getParsedCommandLineOfConfigFile(`${PKG}/tsconfig.json`, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} });
const options = {};
for (const flag of FLAGS) if (parsed.options[flag] !== undefined) options[flag] = parsed.options[flag];
if (variant === "nuia") options.noUncheckedIndexedAccess = false;
else if (variant === "eopt") options.exactOptionalPropertyTypes = false;
else if (variant !== "base") throw new Error("variant must be base, nuia, eopt or report");

const files = [...table.moves, ...table.splits].map((e) => fileOf(e.from));
const config = `${OUT}/tsconfig.${variant}.json`;
fs.writeFileSync(config, JSON.stringify({ extends: `${TKA}/tsconfig.json`, compilerOptions: { ...options, noEmit: true, incremental: false }, files, include: [] }, null, 2));
let output = "";
try {
	output = execSync(`pnpm exec tsc -p "${config}" --pretty false`, { cwd: PKG, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
} catch (error) {
	output = String(error.stdout ?? "");
}
const wanted = new Set(files.map((f) => slash(f).toLowerCase()));
const byCode = {};
const hit = new Set();
let total = 0;
for (const line of output.split(String.fromCharCode(10))) {
	const match = /^(.+?)[(]([0-9]+),([0-9]+)[)]: error (TS[0-9]+):/.exec(line);
	if (!match) continue;
	const file = slash(path.resolve(PKG, match[1])).toLowerCase();
	if (!wanted.has(file)) continue;
	total += 1;
	hit.add(file);
	byCode[match[4]] = (byCode[match[4]] ?? 0) + 1;
}
fs.writeFileSync(`${OUT}/${variant}.json`, JSON.stringify({ variant, options, total, files: hit.size, byCode }, null, 2));
console.log(`${variant}: ${total} errors in ${hit.size} files`);
```
Check the options it picked: `cat /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/census/tsconfig.base.json` must show `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true` if `PKG/tsconfig.json` (or the config it extends) sets them. If neither flag is set in the package, write `census: package has neither flag; no decision needed` in the task report, skip to Step 4 and commit only the script.

- [ ] **Step 2: Run the three variants, one at a time**

Each is one `tsc` over the moved files and their tka imports; run them sequentially, each with Bash timeout 600000:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/census.mjs base
node scripts/step1/census.mjs nuia
node scripts/step1/census.mjs eopt
node scripts/step1/census.mjs report
```
Expected: three `<variant>: N errors in M files` lines with nuia and eopt at most base, then the report. If `base` prints `0 errors in 0 files` while the files are known to raise errors, the path matching failed: print the first 5 error lines of the raw output and fix the `wanted` comparison before going on.

- [ ] **Step 3: Apply the rule**

For each flag the report marks `TURN OFF for step 1`, set it to `false` in `PKG/tsconfig.json` with this comment on the line above:
```jsonc
		// Step 1 census: <delta> errors in the moved tka code. Step 3 turns this back on.
```
Then run the package gate. Expected: green (no source has moved yet).

- [ ] **Step 4: Commit (package)**

```bash
cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/scripts/step1/census.mjs packages/video-editor/tsconfig.json && git commit -q -F - <<'MSG'
chore(video-editor): step 1 strictness census

base <N> errors in <M> moved files; noUncheckedIndexedAccess delta <A> (<on|off>); exactOptionalPropertyTypes delta <B> (<on|off>).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```
Fill the five values from the report before committing. Paste the full report in the task report; Tasks 4 to 11 read it.

### Task 4: Encoder move (sonnet; opus review)

Moves the four encoder files. The worker's message types and codec helpers move into a plain module, so tka code and tests that need `selectCodec` never import the worker module (importing it would run the worker's top-level `onmessage` setup on the main thread).

**Files:**
- Create (via move.mjs): `PKG/src/encoder/captured-frame.ts`, `PKG/src/encoder/canvas-frame-capturer.ts`, `PKG/src/encoder/background-video-encoder.ts`, `PKG/src/workers/video-export.worker.ts`
- Create: `PKG/src/encoder/codec.ts`
- Modify: `PKG/src/encoder/index.ts`
- Delete: the four tka sources listed in `moves.json` for task 4
- Modify: every tka importer (`rewrite-imports.mjs --task 4`), including `get-background-video-encoder.ts`, `get-canvas-frame-capturer.ts` (a relative `./services/canvas-frame-capturer` import), `offline-3d-exporter.ts`, `video-export-orchestrator.ts` and its init test, `post-studio-exporter.ts`, and the export smoke tests

- [ ] **Step 1: Copy**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/move.mjs --task 4
```
Expected: four `copied` lines, then `UNRESOLVED encoder/background-video-encoder.ts: uses import.meta.url (check the worker URL by hand)` and no other UNRESOLVED line.

**Resolve rule for UNRESOLVED lines (this task and every later move task).** An unresolved import of a module that `moves.json` places in a later task means the dependency order is wrong: lower that entry's `task` to the current task, rerun `move.mjs`, and say so in the task report. An unresolved import of a module that stays in tka is a seam: if the plan names it (this task's steps, or the Plugin seam design), follow that; otherwise stop and report BLOCKED with the file, the import and the names used. Never copy a staying tka module into the package on your own.

- [ ] **Step 2: Split the codec helpers out of the worker**

Create `PKG/src/encoder/codec.ts` and move into it, from `PKG/src/workers/video-export.worker.ts`, the exported declarations `ExportWorkerMessage`, `ExportWorkerResponse`, `ExportConfig`, `selectCodec` and `selectSupportedEncoderConfig`, plus every non-exported helper or constant that only those declarations use, unchanged. The worker then imports what it uses:
```ts
import {
	selectCodec,
	selectSupportedEncoderConfig,
	type ExportConfig,
	type ExportWorkerMessage,
	type ExportWorkerResponse,
} from "../encoder/codec.js";
```
(drop any name the worker body no longer uses). In `encoder/background-video-encoder.ts`, point every import of those names at `./codec.js` instead of the worker file.

- [ ] **Step 3: Worker scope and URL**

In `PKG/src/workers/video-export.worker.ts`, add `import { workerScope } from "./worker-scope.js";` and replace every `self.postMessage(` with `workerScope.postMessage(`, `self.onmessage =` with `workerScope.onmessage =` and `self.addEventListener(` with `workerScope.addEventListener(`. `grep -n "self[.]" src/workers/video-export.worker.ts` must then print nothing.

In `PKG/src/encoder/background-video-encoder.ts`, the worker construction (tka line 112) keeps its options and becomes:
```ts
new Worker(new URL("../workers/video-export.worker.js", import.meta.url), { type: "module" })
```
Compare with the spike in `src/workers/index.ts`: the same one-expression `new Worker(new URL(...), ...)` form is what lets tka's Vite emit the worker chunk from `dist`.

- [ ] **Step 4: The encoder entry**

`PKG/src/encoder/index.ts`:
```ts
export * from "./captured-frame.js";
export * from "./codec.js";
export * from "./canvas-frame-capturer.js";
export * from "./background-video-encoder.js";
```
The worker module is never exported.

- [ ] **Step 5: ASCII, strictness and the package gate**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/ascii.mjs src/encoder/*.ts src/workers/video-export.worker.ts && node scripts/step1/forbidden-imports.mjs
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test && ls packages/video-editor/dist/workers
```
Fix check errors under the census rule (runtime no-op fixes only). Expected: green; `dist/workers` lists `spike.worker.js` and `video-export.worker.js`.

- [ ] **Step 6: Switch tka**

```bash
cd /e/worktrees/tka-platform/video-editor && node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 4 --dry
node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 4
```
Hand-fix every `ERROR` line:
- `vi.mock("<old module>", ...)`: change the string to `"@austencloud/video-editor/encoder"` and keep the factory; if the factory spreads `importOriginal()`, keep that too.
- Any import of the worker module (the codec test): import the same names from `"@austencloud/video-editor/encoder"`.
- A dynamic `import()` of a moved module was already rewritten; check it still destructures the same export. `deferred-registrations.ts` line 23 and `get-offline-3d-exporter.ts` import only the staying getters (`get-background-video-encoder`, `get-canvas-frame-capturer`), so they do not change in this task.

Then delete the sources and prove nothing points at them:
```bash
git rm -q src/lib/shared/video-export/domain/captured-frame.ts src/lib/shared/video-export/services/canvas-frame-capturer.ts src/lib/shared/animation-engine/services/background-video-encoder.ts src/lib/shared/animation-engine/workers/video-export.worker.ts
grep -rnE '[/](captured-frame|canvas-frame-capturer|background-video-encoder|video-export[.]worker)([.]ts)?"' src tests scripts
npx prettier --write $(git diff --name-only -- src tests)
```
Expected: the grep prints nothing. Test files that sat next to the deleted sources stay where they are (their imports now name the package); Task 13 moves them.

- [ ] **Step 7: Gates**

The package is already rebuilt (Step 5). Run the tka type gate, the tka test gate, the export smoke gate and the parity gate from Ground rules. Expected: `new 0`, tests green, export smoke green, parity 4 passed.

- [ ] **Step 8: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/src/encoder packages/video-editor/src/workers/video-export.worker.ts && git commit -q -F - <<'MSG'
feat(video-editor): move the background video encoder and its worker

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
cd /e/worktrees/tka-platform/video-editor && git add -u src tests scripts && git status --short | grep -v "^[MD] " ; git commit -q -F - <<'MSG'
refactor(export): use the encoder from @austencloud/video-editor

Package: video-editor@<short hash from the commit above>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```
`git add -u src tests scripts` stages only modifications and deletions of tracked files under those three paths. The `git status` filter must print nothing, because this task creates no untracked tka files. If it prints a path you did not touch, unstage it with `git restore --staged <path>` and report it. Every later tka commit in this plan uses the same `git add -u src tests scripts` plus explicit paths for new files, and the same check.

### Task 5: Leaf core modules (sonnet; opus review)

Moves the eleven `moves.json` entries with `"task": 5` (presets, layout, sources, time map, plan, plan compiler, caption layout, color grade, preview-video schema, tunnel hook) and creates the two small modules they and later tasks need. None of them imports `post-project`.

**Files:**
- Create: `PKG/src/core/sequence-types.ts`, `PKG/src/core/preset/playback-bpm.ts`, `TKA/tests/unit/video-editor-copies.test.ts`
- Create (via move.mjs): the eleven task 5 targets
- Modify: `PKG/src/core/index.ts`, `TKA/src/lib/shared/media-composition/domain/take-timing.ts`, `TKA/src/lib/shared/media-composition/domain/sequence-frame.ts`
- Delete: the eleven tka sources

- [ ] **Step 1: Shared sequence types and tempo bounds**

Print the four declarations:
```bash
cd /e/worktrees/tka-platform/video-editor && grep -nE "export (type|interface) (TakeSample|TakeSampleOptions|SequencePhase|SequenceFrame)[ <=]" src/lib/shared/media-composition/domain/take-timing.ts src/lib/shared/media-composition/domain/sequence-frame.ts
```
Create `PKG/src/core/sequence-types.ts` with those four declarations copied verbatim (doc comments included, any types they reference copied with them), followed by:
```ts
/** The tempo range a take may claim. tka's take-timing re-exports these. */
export const TAKE_MIN_BPM = 20;
export const TAKE_MAX_BPM = 300;
```
In tka, delete the four declarations and the two constants from `take-timing.ts` and `sequence-frame.ts` and put this at the top of each file, keeping only the names that file declared:
```ts
import {
	TAKE_MAX_BPM,
	TAKE_MIN_BPM,
	type SequenceFrame,
	type SequencePhase,
	type TakeSample,
	type TakeSampleOptions,
} from "@austencloud/video-editor/core";

export { TAKE_MAX_BPM, TAKE_MIN_BPM };
export type { SequenceFrame, SequencePhase, TakeSample, TakeSampleOptions };
```
Every existing tka importer keeps working through the re-export; nothing else changes in tka for this step.

`PKG/src/core/preset/playback-bpm.ts`:
```ts
/**
 * The preset schema's BPM bounds, copied from tka's
 * animation-engine/domain/constants/timing.ts. tests/unit/video-editor-copies.test.ts
 * in tka fails if the two drift.
 */
export const PLAYBACK_BASELINE_BPM = 60;
export const PLAYBACK_MIN_SPEED = 0.1;
export const PLAYBACK_MAX_SPEED = 3.0;
export const PLAYBACK_MIN_BPM = PLAYBACK_BASELINE_BPM * PLAYBACK_MIN_SPEED;
export const PLAYBACK_MAX_BPM = PLAYBACK_BASELINE_BPM * PLAYBACK_MAX_SPEED;
```

- [ ] **Step 2: Copy**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/move.mjs --task 5
```
Expected: eleven `copied` lines and exactly two UNRESOLVED lines:
- `core/preset/preset-schema.ts: $lib/shared/animation-engine/domain/constants/timing`: change that import to `./playback-bpm.js`.
- `core/time-map.ts: $lib/shared/video-collaboration/domain/collaborative-video`: delete the import. Copy the `StepMap` interface (tka `collaborative-video.ts` line 128) into `core/time-map.ts` as `export interface LegacyStepMap`, keeping only the fields that `legacyStepMapSource` and `migrateLegacyStepMap` read, with their doc comments; a field typed by another tka type gets that type's literal definition inlined. Rename the two uses (`StepMap["source"]` and `stepMap: StepMap`) to `LegacyStepMap`. tka's `StepMap` stays where it is; the tka type gate proves it still fits `LegacyStepMapMigrationInput`.

Any other UNRESOLVED line: apply the resolve rule from Task 4.

- [ ] **Step 3: Core entry**

Append to `PKG/src/core/index.ts`:
```ts
export * from "./sequence-types.js";
export * from "./preset/playback-bpm.js";
export * from "./tunnel-hook.js";
export * from "./preset/layout-schema.js";
export * from "./preset/source-schema.js";
export * from "./time-map.js";
export * from "./preset/preset-schema.js";
export * from "./plan/post-plan.js";
export * from "./plan/presets.js";
export * from "./plan/plan-compiler.js";
export * from "./caption-layout.js";
export * from "./color-grade.js";
export * from "./preview-video.js";
```
If the check reports TS2308 (two `export *` modules export the same name), keep both modules unchanged and add an explicit `export { Name } from "<the module tka importers used>";` line under the stars; list each one in the task report.

- [ ] **Step 4: Package gate**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/ascii.mjs src/core/sequence-types.ts src/core/preset/*.ts src/core/plan/*.ts src/core/tunnel-hook.ts src/core/time-map.ts src/core/caption-layout.ts src/core/color-grade.ts src/core/preview-video.ts && node scripts/step1/forbidden-imports.mjs
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test
```
Expected: green after census-rule fixes.

- [ ] **Step 5: The copies test (tka)**

`TKA/tests/unit/video-editor-copies.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import * as core from "@austencloud/video-editor/core";
import * as timing from "$lib/shared/animation-engine/domain/constants/timing";

describe("values the package copies from tka", () => {
  it("keeps the playback BPM bounds", () => {
    expect(core.PLAYBACK_MIN_BPM).toBe(timing.PLAYBACK_MIN_BPM);
    expect(core.PLAYBACK_MAX_BPM).toBe(timing.PLAYBACK_MAX_BPM);
  });
});
```
Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-copies.test.ts`. Expected: 1 passed.

- [ ] **Step 6: Switch tka, delete, prove**

```bash
cd /e/worktrees/tka-platform/video-editor && node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 5
git rm -q src/lib/shared/media-composition/domain/tunnel-hook.ts src/lib/shared/media-composition/domain/media-layout-schema.ts src/lib/shared/media-composition/domain/media-source-schema.ts src/lib/shared/media-composition/domain/sequence-time-map.ts src/lib/shared/media-composition/domain/media-composition-preset-schema.ts src/lib/shared/media-composition/domain/post-plan.ts src/lib/shared/media-composition/domain/post-studio-presets.ts src/lib/shared/media-composition/domain/post-plan-compiler.ts src/lib/shared/media-composition/domain/caption-layout.ts src/lib/shared/media-composition/domain/post-video-color-grade.ts src/lib/shared/media-composition/domain/preview-video.ts
node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 5 --dry
npx prettier --write $(git diff --name-only -- src tests)
```
Hand-fix ERROR lines from the first run as in Task 4 (vi.mock strings become `"@austencloud/video-editor/core"`). Expected from the dry run: `would change 0 files` and no ERROR line, which proves no importer of a task 5 module is left.

- [ ] **Step 7: Gates and commit**

Run the tka type, tka test, export smoke and parity gates. Expected: `new 0`, green, parity 4 passed. Commit the package (`git add packages/video-editor/src/core`), then tka (`git add -u src tests scripts && git add tests/unit/video-editor-copies.test.ts`, then the status check from Task 4) with messages `feat(video-editor): move the preset, plan and time-map core` and `refactor(post): use the preset, plan and time-map core from @austencloud/video-editor` plus the `Package:` line and the trailer, as in Task 4.

### Task 6: Project schema split, plugin skeleton and bound API (opus; opus review)

The largest seam. The core gets the project schema for the four core kinds and the factory that adds plugin kinds and fields; tka gets `post-studio-plugin/` with its kinds, its fields, the module augmentation and the bound API. `post-music` becomes a schema factory so the core never sees tka's media URL check.

**Files:**
- Create (via move.mjs): `PKG/src/core/project/schema.ts`, `PKG/src/core/music/post-music.ts`, `PKG/src/core/music/music-grid.ts`, `PKG/src/core/project/canvas.ts`, `PKG/src/core/project/clip-edge.ts`, `PKG/src/core/project/take-labels.ts`
- Create: `PKG/src/core/project/item-kinds.ts`, `PKG/src/core/project/schema-factory.ts`, `PKG/src/plugin.ts`
- Create: `TKA/src/lib/shared/post-studio-plugin/index.ts`, `create-plugin.ts`, `item-kinds.ts`, `project-extension.ts`, `bound.ts`, `plugin.test.ts`
- Modify: `PKG/src/core/index.ts`, `PKG/src/index.ts`
- Delete: tka `post-project.ts`, `post-music.ts`, `music-grid.ts`, `post-canvas.ts`, `post-clip-edge.ts`, `post-take-labels.ts` under `src/lib/shared/media-composition/domain/`

- [ ] **Step 1: Copy**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/move.mjs --task 6
```
Expected UNRESOLVED lines, all handled below: in `core/music/post-music.ts` the `feature-video-url` and `take-timing` imports; in `core/project/schema.ts` the imports of `prop-type`, `prop-look`, `effects-config`, `trail-types` and `take-timing`. Anything else: the Task 4 resolve rule.

- [ ] **Step 2: post-music as a factory**

In `PKG/src/core/music/post-music.ts`: point the `TAKE_MIN_BPM`/`TAKE_MAX_BPM` import at `../sequence-types.js`; delete the `feature-video-url` import; add
```ts
/** Decides whether a music URL is one this host can play. */
export type MediaUrlCheck = (url: unknown) => url is string;

export const isNonEmptyString: MediaUrlCheck = (url): url is string =>
	typeof url === "string" && url.length > 0;
```
and turn the exported `PostMusicSchema` constant into
```ts
export function createPostMusicSchema(isMediaUrl: MediaUrlCheck = isNonEmptyString) {
	return /* today's PostMusicSchema expression, with isFeatureVideoMediaUrl replaced by isMediaUrl */;
}

export type PostMusic = z.infer<ReturnType<typeof createPostMusicSchema>>;
```
The comment marks where today's expression goes verbatim; delete the comment once it is pasted. Any other schema in the file that embedded `PostMusicSchema` takes `isMediaUrl` as a parameter the same way. `music-grid.ts` keeps importing types only.

- [ ] **Step 3: Item kinds and the schema factory**

Create `PKG/src/core/project/item-kinds.ts` with the code under Plugin seam design, Static types, and `PKG/src/core/project/schema-factory.ts` with the code under Runtime schema, exactly as written there. `createProjectSchema` builds the music field with `createPostMusicSchema(plugin?.isMediaUrl ?? isNonEmptyString)`.

Then cut `PKG/src/core/project/schema.ts` down to the core: the raw shapes of the video, image, card and text items (exported together as `CORE_ITEM_SHAPES`), the track, take and box schemas, and every helper whose signature and body mention no plugin kind and no plugin field. Everything else in today's `post-project.ts` goes to tka:
- the animation, moves, carousel and titles item shapes and their types, and every helper that names one of those kinds, to `post-studio-plugin/item-kinds.ts`;
- the fields typed by `prop-type`, `prop-look`, `effects-config`, `trail-types` or `TakeTimingSchema` (for example `timings: z.record(z.string(), TakeTimingSchema).optional()` at tka line 803), and any other field the Static types section lists under the augmentation, to `item-kinds.ts` (item fields, as `kindExtensions` shapes) or `post-studio-plugin/project-extension.ts` (project fields, as `projectExtension`), each with an `order` array that reproduces today's key order;
- `createEmptyPostProject`'s tka fields, to `project-extension.ts` as `emptyProjectFields(input)`.

Core `createEmptyPostProject(input: { now: number }, extensionFields?: Record<string, unknown>)` and `defaultBoxFor(kind, plugin?)` take the forms the Bound API section calls.

- [ ] **Step 4: The plugin type, first members**

`PKG/src/plugin.ts` starts with the members whose types exist after this task; Tasks 8 to 10 add the rest, so it compiles at every commit:
```ts
import type { z } from "zod";
import type { CoreItemKind, PostItem, PostProject } from "./core/project/item-kinds.js";
import type { PostBox } from "./core/project/schema.js";

export interface ShapeExtension {
	shape: z.ZodRawShape;
	order?: readonly string[];
}

export interface ItemKindDefinition {
	kind: string;
	schema: z.ZodObject<z.ZodRawShape>;
	label: string;
	defaultBox(): PostBox;
	transitionVisual?: boolean;
	placement?(item: PostItem): { intro: number; lead: number } | null;
	ownsIntroKeys?: boolean;
}

export interface VideoEditorPlugin {
	id: string;
	itemKinds: readonly ItemKindDefinition[];
	kindExtensions?: Partial<Record<CoreItemKind, ShapeExtension>>;
	projectExtension?: ShapeExtension;
	normalize?: {
		before?(project: PostProject): PostProject;
		after?(project: PostProject): PostProject;
	};
	/** The music URL check; core accepts any non-empty string. tka passes isFeatureVideoMediaUrl. */
	isMediaUrl?(url: unknown): url is string;
}
```
`PKG/src/index.ts` adds `export type * from "./plugin.js";` and `PKG/src/core/index.ts` adds `export type { ItemKindDefinition, ShapeExtension, VideoEditorPlugin } from "../plugin.js";` plus:
```ts
export * from "./project/item-kinds.js";
export * from "./project/schema.js";
export * from "./project/schema-factory.js";
export * from "./project/canvas.js";
export * from "./project/clip-edge.js";
export * from "./project/take-labels.js";
export * from "./music/post-music.js";
export * from "./music/music-grid.js";
```

- [ ] **Step 5: The tka plugin and its bound API**

`TKA/src/lib/shared/post-studio-plugin/item-kinds.ts` opens with the augmentation from the Static types section (`declare module "@austencloud/video-editor/core" { ... }`) and exports `TKA_ITEM_KINDS: readonly ItemKindDefinition[]` (animation, moves, carousel, titles, in that order, with today's labels, default boxes, `transitionVisual`, `placement` and `ownsIntroKeys` values taken from where today's `post-project.ts` and the editor read them) and `TKA_KIND_EXTENSIONS`.

`create-plugin.ts` (its own module, so `bound.ts` can import it without going through `index.ts`):
```ts
import type { VideoEditorPlugin } from "@austencloud/video-editor/core";
import { isFeatureVideoMediaUrl } from "$lib/shared/media-composition/domain/feature-video-url";
import { TKA_ITEM_KINDS, TKA_KIND_EXTENSIONS } from "./item-kinds";
import { TKA_PROJECT_EXTENSION, emptyProjectFields } from "./project-extension";

export type TkaPlugin = VideoEditorPlugin & {
  emptyProjectFields: typeof emptyProjectFields;
};

export function createTkaPlugin(): TkaPlugin {
  return {
    id: "tka",
    itemKinds: TKA_ITEM_KINDS,
    kindExtensions: TKA_KIND_EXTENSIONS,
    projectExtension: TKA_PROJECT_EXTENSION,
    isMediaUrl: isFeatureVideoMediaUrl,
    emptyProjectFields,
  };
}
```
`index.ts`:
```ts
export * from "./create-plugin";
export * from "./item-kinds";
export * from "./project-extension";
export * from "./bound";
```
Later tasks that add members to `createTkaPlugin` edit `create-plugin.ts`.
`bound.ts` is the Bound API section's code minus `normalizeProject` (Task 7) and `compilePostProject` (Task 8), plus:
```ts
import { createPostMusicSchema } from "@austencloud/video-editor/core";
import { isFeatureVideoMediaUrl } from "$lib/shared/media-composition/domain/feature-video-url";

export const PostMusicSchema = createPostMusicSchema(isFeatureVideoMediaUrl);
```
The plugin index never re-exports the core wholesale: `rewrite-imports.mjs` routes a name to the plugin only when the plugin exports it, so bound names (`PostProjectSchema`, `PostMusicSchema`, `createEmptyPostProject`, `defaultBoxFor`) and tka kind types land on the plugin and every core name lands on the core.

- [ ] **Step 6: Augmentation proof (tka)**

`TKA/src/lib/shared/post-studio-plugin/plugin.test.ts`:
```ts
import { describe, expect, expectTypeOf, it } from "vitest";
import type { PostItem, PostItemKind } from "@austencloud/video-editor/core";
import { PostProjectSchema, createEmptyPostProject } from "$lib/shared/post-studio-plugin";

describe("tka plugin", () => {
  it("adds the tka item kinds to the core union", () => {
    expectTypeOf<"animation">().toMatchTypeOf<PostItemKind>();
    expectTypeOf<"moves">().toMatchTypeOf<PostItemKind>();
    expectTypeOf<"carousel">().toMatchTypeOf<PostItemKind>();
    expectTypeOf<"titles">().toMatchTypeOf<PostItemKind>();
    expectTypeOf<Extract<PostItem, { kind: "animation" }>>().not.toBeNever();
  });

  it("parses an empty project back to itself, key order included", () => {
    const project = createEmptyPostProject({ sequenceId: "seq", now: 1_700_000_000_000 });
    const parsed = PostProjectSchema.parse(project);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(project));
  });
});
```
The type assertions fail the tka type gate, not the test run, if the augmentation is not visible through the package's `export *` chain. If they fail, apply the fallback recorded in the Static types section (declare the `Plugin*` interfaces in `core/index.ts` itself), rebuild, and report it.

- [ ] **Step 7: Package gate, switch tka, delete, prove**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/ascii.mjs src/plugin.ts src/core/project/*.ts src/core/music/*.ts && node scripts/step1/forbidden-imports.mjs
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test
cd /e/worktrees/tka-platform/video-editor && node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 6
git rm -q src/lib/shared/media-composition/domain/post-project.ts src/lib/shared/media-composition/domain/post-music.ts src/lib/shared/media-composition/domain/music-grid.ts src/lib/shared/media-composition/domain/post-canvas.ts src/lib/shared/media-composition/domain/post-clip-edge.ts src/lib/shared/media-composition/domain/post-take-labels.ts
node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 6 --dry
npx prettier --write $(git diff --name-only -- src tests) src/lib/shared/post-studio-plugin
```
The rewriter's `X from <module> is exported by none of ...` errors name exactly what Steps 3 and 5 missed: export it from the side it belongs to and rerun. Expected from the dry run: `would change 0 files`, no ERROR line.

- [ ] **Step 8: Gates and commit**

Run the tka type, tka test, export smoke and parity gates, plus `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/post-studio-plugin/plugin.test.ts`. Expected: `new 0`; parity hash (a), the normalized project JSON, unchanged for both fixtures. Commit the package (`git add packages/video-editor/src/plugin.ts packages/video-editor/src/index.ts packages/video-editor/src/core`) as `feat(video-editor): project schema with plugin kinds and fields`, then tka (`git add -u src tests scripts && git add src/lib/shared/post-studio-plugin`, status check) as `refactor(post): tka item kinds and fields as a video editor plugin`, each with the `Package:` line (tka) and the trailer.

### Task 7: Keyframes and normalize (sonnet; opus review)

**Files:**
- Create (via move.mjs): `PKG/src/core/project/keyframes.ts`, `PKG/src/core/project/normalize.ts`
- Create: `PKG/src/core/project/ease.ts`, `TKA/src/lib/shared/post-studio-plugin/normalize-hooks.ts`
- Modify: `PKG/src/core/index.ts`, `PKG/src/plugin.ts` (no change needed: `normalize` exists since Task 6), `TKA/.../post-studio-plugin/index.ts`, `bound.ts`, `TKA/tests/unit/video-editor-copies.test.ts`
- Delete: tka `post-project-keyframes.ts`, `post-project-normalize.ts`

- [ ] **Step 1: Copy**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/move.mjs --task 7
```
Expected UNRESOLVED: `core/project/keyframes.ts: $lib/shared/transitions/ws-ease`, and in `core/project/normalize.ts` the `post-project-motion-keys` and `post-project-hook-migration` imports.

- [ ] **Step 2: The ease copy**

List what keyframes imports: `grep -n "ws-ease" -B4 src/core/project/keyframes.ts`. Copy exactly those functions (and the private helpers they call) from `TKA/src/lib/shared/transitions/ws-ease.ts` into `PKG/src/core/project/ease.ts`, unchanged, under this header:
```ts
/**
 * Copied from tka transitions/ws-ease.ts, which stays because the 2D
 * animation renderer uses it. tka's video-editor-copies test compares the two.
 */
```
Point keyframes' import at `./ease.js`. `ease.ts` is not exported from `core/index.ts`.

Extend `TKA/tests/unit/video-editor-copies.test.ts` with one `it` per copied function, comparing at eleven points. For a copied function `easeName` (write one block per real name):
```ts
import * as packageEase from "E:/worktrees/shared-packages/video-editor/packages/video-editor/src/core/project/ease";
import * as tkaEase from "$lib/shared/transitions/ws-ease";

  it("keeps easeName", () => {
    for (let i = 0; i <= 10; i++) {
      expect(packageEase.easeName(i / 10)).toBeCloseTo(tkaEase.easeName(i / 10), 12);
    }
  });
```
The absolute path reaches the package source because `ease.ts` is internal and not in the `dist` exports. Match the real signatures: if a function takes more than `t`, pass the same extra arguments to both.

- [ ] **Step 3: Normalize with hooks**

In `PKG/src/core/project/normalize.ts`, delete the two tka imports. Change the exported entry to `normalizeProject(stored: PostProject, plugin?: VideoEditorPlugin): PostProject` (type import from `../../plugin.js`): it runs `plugin?.normalize?.before`, then today's body minus the calls into the two tka modules, then `plugin?.normalize?.after`.

Create `TKA/src/lib/shared/post-studio-plugin/normalize-hooks.ts` exporting `TKA_NORMALIZE: NonNullable<VideoEditorPlugin["normalize"]>`. Each removed call goes into `before` if today it runs before the first core statement of the body, or into `after` if it runs after the last one, in today's order. A call that sits between two core statements cannot be hoisted without changing behaviour unless it touches fields the core statements around it never read or write: check that by reading both, move it if so, and report BLOCKED if not.

Add `normalize: TKA_NORMALIZE` to `createTkaPlugin`, `export * from "./normalize-hooks";` to the plugin index, and to `bound.ts`:
```ts
export function normalizeProject(stored: PostProject): PostProject {
  return normalizeCore(stored, tkaPlugin);
}
```
with `normalizeProject as normalizeCore` added to its core import. Append `export * from "./project/keyframes.js";` and `export * from "./project/normalize.js";` to `PKG/src/core/index.ts`.

- [ ] **Step 4: Gates, switch, delete, commit**

Package gate (ascii and forbidden-imports on the three new package files first), then:
```bash
cd /e/worktrees/tka-platform/video-editor && node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 7
git rm -q src/lib/shared/media-composition/domain/post-project-keyframes.ts src/lib/shared/media-composition/domain/post-project-normalize.ts
node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/rewrite-imports.mjs --task 7 --dry
npx prettier --write $(git diff --name-only -- src tests) src/lib/shared/post-studio-plugin
```
`post-project-normalize` is listed under `splits` with the plugin route first, so importers of `normalizeProject` get the bound one-argument version and every other name goes to the core. Then the tka type, tka test, export smoke and parity gates (hash (a) unchanged) and the two commits: `feat(video-editor): keyframes and normalize with plugin hooks` and `refactor(post): tka normalize hooks`.

### Task 8: Compiler hooks, pip and titles splits, audio plan (opus; opus review)

**Files:**
- Create (via move.mjs): `PKG/src/core/compile/compiler.ts`, `PKG/src/core/pip-sample.ts`, `PKG/src/core/roles.ts`, `PKG/src/core/music/audio-plan.ts`
- Create: `PKG/src/core/compile/hooks.ts`, `TKA/src/lib/shared/post-studio-plugin/compile-hooks.ts`
- Modify: `PKG/src/plugin.ts`, `PKG/src/core/index.ts`, `PKG/src/core/project/item-kinds.ts` (`PluginCompiledOutputs` use), tka `pip-handoff.ts` and `tunnel-titles.ts` (shrunk in place), plugin `index.ts`, `item-kinds.ts`, `bound.ts`
- Delete: tka `post-project-compiler.ts`, `post-audio-plan.ts`

- [ ] **Step 1: Copy**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/step1/move.mjs --task 8
```
`pip-handoff` and `tunnel-titles` are splits whose tka file stays: move.mjs copies the whole file and this task removes the tka half from the copy and the core half from the original.

- [ ] **Step 2: Hooks types**

Create `PKG/src/core/compile/hooks.ts` with the code under Plugin seam design, Compile hooks. Correct the three marked spots against the moved code: `PresetRegion` and `PresetClip` are the element types of the arrays the compiler pushes regions and clips into (use those arrays' declared element types), and `footageIntro` returns today's `FootageIntro` shape (move that type into `hooks.ts` if the compiler declares it).

- [ ] **Step 3: Split the compiler**

In `PKG/src/core/compile/compiler.ts`, `compilePostProject(project, context, plugin?)`:
- keeps the loop, the video, image, card and text cases, and every helper that names no plugin kind;
- calls `plugin?.compileHooks?.begin?.(env)` before the loop and `footageIntro`, `videoCompanions` and `regionSpan` where today's code does the tka-specific work they replace;
- for an item whose kind is not a core kind, finds its `ItemKindDefinition` in `plugin.itemKinds` and calls `definition.compile(item, env)`; a `false` return skips the item as today's `default` branch does;
- sets each `plugin.compileOutputs` entry on the result (`result[name] = factory()` before the loop, filled by `env.addOutput`).

Each tka case body moves verbatim into `TKA/.../post-studio-plugin/compile-hooks.ts` as that kind's `compile(item, env)`, reading closure variables through `env` (`env.state` for per-compile maps the cases share). When a case needs a closure helper that `CompileItemEnv` does not have, add it to `CompileItemEnv` in `hooks.ts`, implement it in the core loop's env, and list it in the task report; never move a core helper into tka to make a case compile. tka's compiled outputs that only tka kinds produce become `compileOutputs` plus fields on the augmented `PluginCompiledOutputs` interface.

Add to `PKG/src/plugin.ts`: `compileHooks?: ProjectCompileHooks;`, `compileOutputs?: Readonly<Record<string, () => unknown>>;` on `VideoEditorPlugin`, and `compile(item: PostItem, env: CompileItemEnv): boolean;` on `ItemKindDefinition` (type imports from `./core/compile/hooks.js`); wire `compile` into each `TKA_ITEM_KINDS` entry, and `compileHooks` and `compileOutputs` into `createTkaPlugin`. Add `compilePostProject` to `bound.ts` exactly as the Bound API section writes it.

- [ ] **Step 4: pip-handoff and tunnel-titles**

A function or type belongs to the tka half if its signature or body names a plugin kind (`PostAnimationItem`, `PostMovesItem`, the titles plan) or a tka module; otherwise it belongs to the core half. Delete the tka half from `PKG/src/core/pip-sample.ts` and `PKG/src/core/roles.ts`, and the core half from tka's `pip-handoff.ts` and `tunnel-titles.ts`; the tka files import what they still need from `@austencloud/video-editor/core`. `pip-sample.ts` imports `TakeSample` from `./sequence-types.js`.

- [ ] **Step 5: Gates, switch, delete, commit**

Append `export * from "./compile/hooks.js";`, `export * from "./compile/compiler.js";`, `export * from "./pip-sample.js";`, `export * from "./roles.js";` and `export * from "./music/audio-plan.js";` to `core/index.ts`; package gate. Then in tka: `rewrite-imports.mjs --task 8`, `git rm -q` the two deleted sources, the `--dry` rerun (`would change 0 files`), prettier. The compiler split routes the plugin first, so importers of `compilePostProject` get the bound version. Gates: tka type, tka test, export smoke, parity with hashes (a) and (b), the compiled JSON, unchanged. Commits: `feat(video-editor): project compiler with plugin hooks` and `refactor(post): tka compile hooks, pip and titles halves`.

### Task 9: Evaluator alignment (sonnet; opus review)

**Files:**
- Create (via move.mjs): `PKG/src/render/frame-evaluator.ts`
- Create: `PKG/src/render/alignment.ts`, `TKA/src/lib/shared/post-studio-plugin/alignment.ts`
- Modify: `PKG/src/plugin.ts`, `PKG/src/render/index.ts`, plugin `index.ts`, `bound.ts`
- Delete: tka `services/frame-evaluator.ts`

- [ ] **Step 1: Copy and types**

`node scripts/step1/move.mjs --task 9`. Expected UNRESOLVED in `render/frame-evaluator.ts`: `step-calculator`, `step-data`, `sequence-frame` (point it at `../core/sequence-types.js`) and `take-timing` (types only: `../core/sequence-types.js`). Create `PKG/src/render/alignment.ts` with the code under Plugin seam design, Evaluator alignment, and replace the `frameFields(...args: never[])` signature with `sequenceFieldsFor`'s parameter list minus its alignment parameter, copied with the same names and types.

- [ ] **Step 2: Split the evaluator**

`sequenceFieldsFor` and everything only it uses (the `step-calculator` and `step-data` users) move verbatim to `TKA/.../post-studio-plugin/alignment.ts`, which exports `SequenceFrameAlignment` (today's type), `tkaFrameAlignment(input)` and `createTkaAlignment(getSequence): AlignmentProvider`. `tkaFrameAlignment` returns `{ moveBeats: input.steps.map((s) => s.duration ?? 1), sequencePeriod, clocks, timeMap, mediaTimeOffsetSeconds, explainHandoff }` copied from `input`, plus `frameFields: (sample, moveBeats, holdLandings) => sequenceFieldsFor(sample, input, moveBeats, holdLandings)`. `createTkaAlignment(...).create(project)` builds what `post-editor-state.svelte.ts` lines 236-278 build today and returns `tkaFrameAlignment` of it; nothing calls it in step 1. The evaluator never builds an alignment (it receives one), so in the package evaluator only the types change: the `alignment` parameters become `FrameAlignment | null`, line 502's `moveBeats` becomes `alignment?.moveBeats ?? []`, and the `sequenceFieldsFor(sample, alignment, moveBeats, holdLandings)` call at line 791 becomes `alignment.frameFields(sample, moveBeats, holdLandings)` (alignment is non-null there). Evaluator signatures gain no plugin parameter. Add `alignment?: AlignmentProvider;` to `VideoEditorPlugin` and `alignment: createTkaAlignment(...)` to `createTkaPlugin` only if its sequence getter is available there (otherwise leave it for step 2), and to `bound.ts` wrappers named `evaluatePresetLayers` and `evaluatePresetFrame` with today's parameters that pass `alignment ? tkaFrameAlignment(alignment) : alignment` to the package functions. `render/index.ts` gets `export * from "./alignment.js";` and `export * from "./frame-evaluator.js";`.

- [ ] **Step 3: Gates, switch, delete, commit**

Package gate; tka `rewrite-imports.mjs --task 9` (the evaluator split routes the plugin first, so tka gets the bound wrappers), `git rm -q src/lib/shared/media-composition/services/frame-evaluator.ts`, the `--dry` rerun, prettier. Gates: tka type, tka test, export smoke, parity with hash (c), the evaluated layers per timestamp, unchanged. Commits: `feat(video-editor): frame evaluator with an alignment provider` and `refactor(post): tka sequence alignment for the frame evaluator`.

### Task 10: Painters, compositor surfaces and the exporter (opus; opus review)

**Files:**
- Create (via move.mjs): `PKG/src/render/rounded-rect.ts`, `media-fit.ts`, `layer-painter.ts`, `text-item-painter.ts`, `backdrop-painter.ts`, `region-edge-painter.ts`, `export-video-frames.ts`, `post-exporter.ts`, `frame-compositor.ts` (all under `PKG/src/render/`)
- Create: `PKG/src/render/painter-registry.ts`, `PKG/src/render/surfaces.ts`, `TKA/src/lib/shared/post-studio-plugin/surfaces.ts`, `TKA/src/lib/shared/post-studio-plugin/painters.ts`
- Modify: `PKG/src/plugin.ts`, `PKG/src/render/index.ts`, plugin `index.ts`, `plugin.test.ts`, `TKA/tests/unit/video-editor-parity.test.ts`, both tka vitest configs (dedupe), every tka caller of `renderPostStudioFrame` and the exporter
- Delete: the eight tka sources moved whole, and tka `services/post-studio-frame-compositor.ts`

- [ ] **Step 1: Copy**

`node scripts/step1/move.mjs --task 10`. Expected UNRESOLVED: in `render/frame-compositor.ts` the `post-studio-dom-capture`, `post-studio-pictograph-capture` and `modern-screenshot` users (Step 3); in `render/post-exporter.ts` the `post-studio-pictograph-capture` import (Step 4); in `render/layer-painter.ts` the `sequence-frame` type import (point it at `../core/sequence-types.js`).

- [ ] **Step 2: Painter registry**

Create `PKG/src/render/painter-registry.ts` with the declarations under Plugin seam design, Painters, implemented:
```ts
export function createPainterRegistry(factories: readonly PainterFactory[]): PainterRegistry {
	return {
		paintersFor(env) {
			const painters = new Map<string, PostStudioLayerPainter>();
			for (const clip of env.compiled.preset.clips) {
				const role = clip.sourceRole;
				if (painters.has(role)) continue;
				for (const factory of factories) {
					const painter = factory.create(role, env);
					if (painter) {
						painters.set(role, painter);
						break;
					}
				}
			}
			return painters;
		},
	};
}

export const textPainterFactory: PainterFactory = {
	id: "text",
	create(role, env) {
		const entry = env.compiled.texts.find((text) => text.role === role);
		if (!entry) return null;
		return createTextItemPainter(() => env.compiled.texts.find((text) => text.itemId === entry.itemId) ?? null);
	},
};
```
The names above are today's: `preset.clips[]` (visual and audio clips both carry `sourceRole`) and `CompiledTextItem.role` / `.itemId`. The harness's hand-built map has one entry per compiled text, keyed `textRole(itemId)`; the registry keys only roles that have a preset clip, so a text with no clip drops out. The compositor looks painters up by visible layer role only, so the draw log is unaffected; hash (d) is the check.

`TKA/.../post-studio-plugin/painters.ts` exports `TKA_PAINTERS: readonly PainterFactory[]`, one factory per staying painter (`animation-overlay-painter-registry`, `beat-carousel-painter`, `sequence-strip-painter`, `staff-effect-painter`, `tunnel-titles-painter`), each building its painter the way the app builds it today; find the construction sites with `grep -rnE "titlesPainterFor|BeatCarouselPainter|SequenceStripPainter|StaffEffectPainter|AnimationOverlayPainter" src/lib --include=*.svelte --include=*.ts`. The app keeps its own construction in step 1; step 2 moves it onto the registry. Add `painters: TKA_PAINTERS` to `createTkaPlugin` and `painters?: readonly PainterFactory[];` to `VideoEditorPlugin`.

- [ ] **Step 3: Surfaces out of the compositor**

Create `PKG/src/render/surfaces.ts` with the code under Plugin seam design, Surfaces. In `render/frame-compositor.ts`, `RenderPostStudioFrameInput` drops `pictographCapture`, renames `cardFrameCache` to `surfaceCache` and gains `surfaces?: readonly SurfaceCapture[]`. The choreo-card and sequence-animation drawing branches move verbatim into `TKA/.../post-studio-plugin/surfaces.ts` as `SurfaceCapture` objects whose `renderMode` is the mode that branch handles today; `createTkaSurfaces(): SurfaceCapture[]` returns fresh ones (each owns a `PostStudioPictographCapture` and releases it in `release()`). Where the compositor branched on those modes, it now does:
```ts
const surface = input.surfaces?.find((candidate) => candidate.renderMode === renderMode);
if (surface) {
	await surface.draw({ context, root, layerElement, layer, preset, geometry, cache: input.surfaceCache, videoFrames: input.videoFrames, timeSeconds: input.timeSeconds });
}
```
with the variable names the compositor uses at that point. `modern-screenshot` and the dom-capture helpers stay in tka with the surfaces; `forbidden-imports.mjs` fails if the package keeps either.

- [ ] **Step 4: Exporter**

In `render/post-exporter.ts`, delete the `PostStudioPictographCapture` import and its construction (tka line 71); the exporter input gains `surfaces?: readonly SurfaceCapture[]`, passes them to every `renderPostStudioFrame` call with a `surfaceCache` it owns, and where it disposed the capture it calls `surface.release?.()` for each surface. tka callers of the exporter and of `renderPostStudioFrame` pass `surfaces: createTkaSurfaces()` and `surfaceCache` (renamed from `cardFrameCache`); find them with `grep -rnE "renderPostStudioFrame|exportPostStudio|cardFrameCache|pictographCapture" src --include=*.svelte --include=*.ts`.

Add to both tka vitest configs' `resolve` block `dedupe: ["svelte", "mediabunny"],` so the package `dist` and tka share one Svelte (the exporter awaits Svelte's `tick`).

- [ ] **Step 5: Parity harness on the registry**

In `tests/unit/video-editor-parity.test.ts`, replace the body of `paintersFor` with the core registry, which must rebuild exactly the map the harness built by hand:
```ts
const coreRegistry = createPainterRegistry([textPainterFactory]);

function paintersFor(project: PostProject, compiled: CompiledPostProject): Map<string, PostStudioLayerPainter> {
  return coreRegistry.paintersFor({ project, compiled });
}
```
importing `createPainterRegistry` and `textPainterFactory` from `"@austencloud/video-editor/render"`, updating its one call site to pass the project, and in the `renderPostStudioFrame` call replace `cardFrameCache: new Map()` with `surfaceCache: new Map(), surfaces: createTkaSurfaces()` (from `$lib/shared/post-studio-plugin`). The tka sequence-animation surface owns a `PostStudioPictographCapture`, which calls `createContext`, `domToCanvas(context)` and `destroyContext`, where today's harness (no `pictographCapture`) takes the `domToCanvas(element, options)` fallback; so add `createContext: vi.fn(async (node: unknown, options: object) => ({ node, ...options }))` and `destroyContext: vi.fn()` to the `vi.mock("modern-screenshot")` factory, neither logging, and the log still shows one `domToCanvas()` per capture. Keep the titles guard as it is. Append to `plugin.test.ts`:
```ts
it("builds tka painters only for roles the compiled preset uses", () => {
  const file = "tests/fixtures/video-editor-parity/dck.project.json";
  const project = normalizeProject(PostProjectSchema.parse(JSON.parse(fs.readFileSync(file, "utf8"))));
  const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
  if (!compiled) throw new Error("dck fixture compiled to null");
  const painters = createPainterRegistry(TKA_PAINTERS).paintersFor({ project, compiled });
  const roles = new Set(compiled.preset.clips.map((clip) => clip.sourceRole));
  for (const role of painters.keys()) expect(roles.has(role)).toBe(true);
});
```
importing `fs` from `node:fs` and `normalizeProject`, `PostProjectSchema` and `compilePostProject` from the plugin's bound exports. An empty project cannot stand in: `compilePostProject` returns null when there are no clips.

- [ ] **Step 6: Gates, switch, delete, commit**

`render/index.ts` gets one `export *` line for each of the eleven Task 10 modules, `rounded-rect.ts` and `media-fit.ts` included because tka imports them. Package gate (ascii and forbidden-imports first). tka: `rewrite-imports.mjs --task 10`, `git rm -q` the nine sources, the `--dry` rerun, prettier. Gates: tka type, tka test, export smoke, parity with all four hashes unchanged (hash (d), the draw log, is the proof for this task). Commits: `feat(video-editor): painters, surfaces and the post exporter` and `refactor(post): tka surfaces and painters for the video editor`.

### Task 11: Preview cache, worker and the remaining render files (sonnet; opus review)

**Files:**
- Create (via move.mjs): the twelve `moves.json` entries with `"task": 11`, including `PKG/src/workers/preview-video.worker.ts`
- Modify: `PKG/src/render/index.ts`, `TKA/src/lib/shared/media-composition/get-preview-video-cache.ts` (imports only)
- Delete: the twelve tka sources

- [ ] **Step 1: Copy and fix the worker**

`node scripts/step1/move.mjs --task 11`. Expected UNRESOLVED: only the `import.meta.url` note for `render/preview-cache/preview-video-render.ts`. Its worker construction becomes, keeping today's options:
```ts
new Worker(new URL("../../workers/preview-video.worker.js", import.meta.url), { type: "module" })
```
In `PKG/src/workers/preview-video.worker.ts`, switch `self` to `workerScope` exactly as Task 4 Step 3 did, and check `grep -n "self[.]" src/workers/preview-video.worker.ts` prints nothing.

- [ ] **Step 2: Entry, gates, switch, delete, commit**

Append to `render/index.ts` one `export *` per moved module except the worker. Package gate, then `ls packages/video-editor/dist/workers` must list `preview-video.worker.js`, `spike.worker.js` and `video-export.worker.js`. tka: `rewrite-imports.mjs --task 11`, `git rm -q` the twelve sources (their paths are the `from` values in `moves.json` plus `.ts`), the `--dry` rerun, prettier. `get-preview-video-cache.ts` and `edit-copy-lookup.ts` stay; the first now builds the package's `PreviewVideoCache`. Gates: tka type, tka test, export smoke, parity. Commits: `feat(video-editor): preview video cache, worker and playback helpers` and `refactor(post): use the preview cache and playback helpers from @austencloud/video-editor`.

### Task 12: Dead files (haiku; no review)

- [ ] **Step 1: Confirm each file is dead**

```bash
cd /e/worktrees/tka-platform/video-editor && for m in media-composition-schema caption-painter media-composition-preset-repository composition-playback-adapter; do echo "== $m"; grep -rlE '[/]'"$m"'([.]svelte)?([.]ts)?"' src tests scripts; done
```
Expected (checked while reviewing the plan): `media-composition-schema` lists only `tests/unit/media-composition/media-composition-schema.test.ts`, and the other three list nothing. `post-studio-breakdown`, `post-studio-slots` and `media-composition-state.svelte.ts` are live and stay (see Deleted from tka). Every file listed must be one of the four themselves or a test of one of them. Any other importer: stop and report BLOCKED with the importer; do not delete that file.

- [ ] **Step 2: Delete, gate, commit**

`git rm -q` the four sources under `src/lib/shared/media-composition/` (`domain/media-composition-schema.ts`, `services/caption-painter.ts`, `services/media-composition-preset-repository.ts`, `state/composition-playback-adapter.ts`) and every test Step 1 listed. Gates: tka type, tka test. Commit tka only: `chore(post): delete four dead media-composition files`.

### Task 13: Move the TKA-free tests to the package (sonnet; opus review)

- [ ] **Step 1: Find them**

`PKG/scripts/step1/portable-tests.mjs` lists tka test files whose imports are all `vitest`, `node:*`, `zod`, `@austencloud/video-editor*`, or relative files that pass the same rule, and that do not `vi.mock` a `$lib` path:
```js
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { TKA, parse, slash, walk } from "./lib.mjs";

const OK = (spec) => spec === "vitest" || spec === "zod" || spec.startsWith("node:") || spec.startsWith("@austencloud/video-editor");
const memo = new Map();
function portable(file) {
	if (memo.has(file)) return memo.get(file);
	memo.set(file, false);
	const text = fs.readFileSync(file, "utf8");
	if (/vi[.]mock[(]"[$]lib/.test(text)) return false;
	let ok = true;
	ts.forEachChild(parse(file, text), function visit(node) {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
			const spec = node.moduleSpecifier.text;
			if (spec.startsWith(".")) {
				const base = path.posix.join(path.posix.dirname(slash(file)), spec).replace(/[.](ts|js)$/, "");
				const target = [`${base}.ts`, `${base}/index.ts`].find((f) => fs.existsSync(f));
				if (!target || !portable(target)) ok = false;
			} else if (!OK(spec)) ok = false;
		}
		ts.forEachChild(node, visit);
	});
	memo.set(file, ok);
	return ok;
}
const tests = [...walk(`${TKA}/tests`, [".test.ts"]), ...walk(`${TKA}/src`, [".test.ts"])];
for (const file of tests.filter(portable)) console.log(file.slice(TKA.length + 1));
```
Run it from the package directory and paste the list in the task report.

- [ ] **Step 2: Move them**

For each listed test (and each relative helper it needs), copy it to `PKG/test/<basename>` (on a name clash, prefix the tka folder name and a dash), rewrite `"@austencloud/video-editor/core"`, `"/render"`, `"/encoder"` and the bare name to `"../src/core/index.js"`, `"../src/render/index.js"`, `"../src/encoder/index.js"` and `"../src/index.js"`, reformat with tabs (`npx prettier --use-tabs --write test`), run `node scripts/step1/ascii.mjs` on them, and `git rm -q` the tka originals. A test that fails in the package only because it relied on tka's vitest setup file goes back (`git restore --staged --worktree` on that tka path, delete the copy) and is named in the report.

- [ ] **Step 3: A plugin-free compile and evaluate test in the package**

The spec's Testing section asks for core and render tests that run without any plugin. Copy `TKA/tests/fixtures/video-editor-parity/plain.project.json` unchanged to `PKG/test/fixtures/plain.project.json` and create `PKG/test/plain-project.test.ts` (use the context fields `compilePostProject` really takes, copied from tka's parity test):
```ts
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { compilePostProject, createProjectSchema, normalizeProject } from "../src/core/index.js";
import { evaluatePresetLayers, isVisibleLayer } from "../src/render/index.js";

const stored: unknown = JSON.parse(fs.readFileSync(new URL("./fixtures/plain.project.json", import.meta.url), "utf8"));

describe("plain project without a plugin", () => {
	it("parses, normalizes, compiles and evaluates with the core alone", () => {
		const project = normalizeProject(createProjectSchema().parse(stored));
		const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
		expect(compiled).not.toBeNull();
		if (!compiled) return;
		for (const time of [0.2, 2.5, 4.9, 7, Math.max(0, compiled.durationSeconds - 0.4)]) {
			const layers = evaluatePresetLayers(compiled.preset, compiled.durationSeconds, time, null);
			expect(layers.filter(isVisibleLayer).length).toBeGreaterThan(0);
		}
	});
});
```
Run `pnpm --filter @austencloud/video-editor test`. Expected: the new test passes with no plugin passed anywhere.

- [ ] **Step 4: Gates and commit**

Package gate: its test count grows by exactly the number of `it` blocks moved plus one for the plain project test. tka test gate: its count drops by the same number. Commits: `test(video-editor): tests that need no tka` (package, `git add packages/video-editor/test packages/video-editor/scripts/step1/portable-tests.mjs`) and `test(post): move the tka-free video editor tests to the package` (tka, `git add -u src tests`).

### Task 14: Final gates and the spec record (sonnet runs; opus reviews the whole step)

- [ ] **Step 1: Every fast gate, once more**

Package gate, `forbidden imports: 0`, tka type gate (`new 0`), tka test gate, export smoke, parity (4 passed).

- [ ] **Step 2: Production build and worker chunks**

Run the tka production build command from Gates with Bash timeout 600000 (background it and watch the log if it runs longer). Then:
```bash
cd /e/worktrees/tka-platform/video-editor && find .svelte-kit/output/client -name "*.js" | grep -E "spike[.]worker|preview-video[.]worker|video-export[.]worker"
node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/spike/worker-proof.mjs .svelte-kit/output/client
```
Expected: one chunk for each of the three workers; worker-proof prints its pass line for the `spike.worker` chunk (the filter renamed in Task 2). For the real preview worker, rerun worker-proof with its chunk filter temporarily changed to `preview-video.worker` and its ping check skipped (the real worker answers a different message); revert that edit afterwards. Name both results in the report.

- [ ] **Step 3: Dev page proof**

Do not use `PKG/scripts/spike/dev-proof.mjs` here: after starting the server it always runs `checkSpikePage`, which waits up to 180 s for the spike page's `[data-ve-status]` pong, so it fails on `/post` and then kills the server. Instead, check port 5221 is free (`netstat -ano | grep ":5221 "` prints nothing), start `npx vite dev --port 5221 --strictPort` from TKA as a background process, and record its PID. The controller runs the browser part in the in-app browser. `/post` lists the computer backups under `C:/Users/Austen/.tka/post-studio-drafts` through the dev endpoint `/_local/post-studio-drafts` (served by `scripts/post-studio-draft-storage.mjs`); open the DCK project from that list so the editor renders it, then load `/test/trail-export-parity`. Both must render with no console error. If `/post` needs a sign-in the browser does not have, record that in the report and treat `/test/video-editor-spike` plus `/test/trail-export-parity` as the dev proof. Stop only that PID.

- [ ] **Step 4: Record the step in the spec**

In `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md` (shared-packages worktree), add a short "Step 1 as built" subsection under the Plugin contract: the plugin members added while planning (`isMediaUrl`, `compileOutputs`, `normalize.before/after`, `surfaces`, `alignment`, `painters`), the bound API in `post-studio-plugin/bound.ts`, and that parity is draw-call parity in jsdom rather than pixel parity, with the four hashes and the reason (the Parity-test decision section of this plan). ASCII only, no dashes used as punctuation.

- [ ] **Step 5: Commit and hand back**

Commit the spec (`git add docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md`, message `docs(video-editor): record step 1 as built`). Report: both branches' commit lists, every gate's last output line, and the census numbers.

## Exit criteria

Step 1 is done when all of these hold on the two worktree branches:

1. Every `moves.json` entry exists under `PKG/src/` and its tka source is deleted; the six split files are deleted or shrunk as Tasks 6 to 10 describe; the four dead files are deleted.
2. `node PKG/scripts/step1/forbidden-imports.mjs` prints `forbidden imports: 0`, and the package source is ASCII with tabs and LF.
3. The package gate is green; `dist/workers` holds the spike, preview-video and video-export workers.
4. The tka type gate prints `new 0` against the Task 1 baseline, and `npm run test:ci` passes.
5. The parity test passes with the Task 1 hashes for both fixtures: normalized project, compiled project, layers and draw log at every timestamp.
6. The tka production build succeeds, emits the three worker chunks, and worker-proof passes.
7. `/post` and `/test/trail-export-parity` load on the dev server with no console error.
8. No `$lib`, `$app`, firebase, bits-ui or modern-screenshot import in the package; tka reaches the package only through `@austencloud/video-editor`, `/core`, `/render` and `/encoder`.
9. The spec records the plugin additions and the draw-call parity decision.

## Risks found while planning

1. **Augmentation through `export *` and the alias.** tka adds its kinds by augmenting `@austencloud/video-editor/core`, which resolves through the `kit.alias` prefix to `dist/core/index.d.ts` and re-exports `item-kinds` by `export *`. If TypeScript does not merge the augmentation into the interfaces it reaches through that chain, every tka kind type breaks at once. Task 6 Step 6 proves it before anything else depends on it; the fallback is declaring the `Plugin*` interfaces in `core/index.ts` itself.
2. **What draw-call parity does not see.** It compares draw calls, not pixels; surfaces and video frames are stand-ins; the harness maps roles to render modes itself rather than through the app's code; and the harness paints only text, so the tka painter factories are covered by one shape test, not by parity. A change inside a canvas operation's arguments is caught, a change in how the browser rasterises them is not, and the app's own painter construction is untouched until step 2.
3. **Silent drift in parse and test plumbing.** zod's output key order comes from the object shape, so a field merged in a different place changes `JSON.stringify` output and the hashes (caught, but the cause is not obvious: check `orderedShape` first). The Write and Edit tools turn backslash-u text into real characters, so escapes are produced only by `ascii.mjs`. A second Svelte copy under vitest would make the exporter's `tick` a no-op; Task 10 adds `dedupe`.
4. A `modern-screenshot` import left in the package would not be mocked by the parity harness's `vi.mock`; `forbidden-imports.mjs` bans it for that reason.
5. The core has no card painter: card layers still render through the tka surface, so a host without the tka plugin gets blank cards until a later step adds one.
6. `core/project/ease.ts` and `core/preset/playback-bpm.ts` duplicate tka code; the copies test fails on drift, but nothing stops someone editing only one side.
7. `bound.ts` calls `createTkaPlugin()` at module level and the plugin index re-exports `bound.ts`. That is why `createTkaPlugin` lives in `create-plugin.ts` and `bound.ts` imports it from there: an import through `index.ts` would be a cycle and throw "before initialization" at the module-level call. Keep every later import of `createTkaPlugin` inside the plugin folder pointed at `./create-plugin`.
8. The rewriter routes names by the exports it can see. A name exported by both the plugin and the core (the bound API) goes to the plugin by design; a name a later task forgets to export shows up as an ERROR line, not as a silent wrong route.
