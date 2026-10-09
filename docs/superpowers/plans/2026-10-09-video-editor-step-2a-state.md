# Video Editor Step 2A (State, Edit Engine, Persistence) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: complete

**Goal:** Move the editor's state, edit engine and device persistence from tka-platform into `@austencloud/video-editor` behind the host contract, while tka's post-studio UI stays where it is and keeps working on top of the package state.

**Architecture:** The edit engine lands in `./core` with TKA-specific branches behind new `editHooks` on `VideoEditorPlugin` and new `ItemKindDefinition` members, in the style of step 1's `compileHooks` and `normalize` hooks. The generic editor state becomes `createVideoEditorState(host, plugin?)` in the package root entry, with persistence through a `VideoEditorStore` port whose device implementation takes `ownerId` from the host. tka keeps a thin `post-editor-state.svelte.ts` wrapper that composes the package state with a tka-side timing state, so every UI import keeps its current surface until step 2B.

**Tech Stack:** TypeScript (strict, exactOptionalPropertyTypes, verbatimModuleSyntax), Svelte 5 runes in `.svelte.ts`, zod, dexie (unchanged), vitest (jsdom), svelte-package, pnpm (shared-packages) and npm (tka-platform).

---

## Step 2A scope and non-goals

The spec's step 2 row ("2 UI") is split in two. Step 2A, this plan, moves the editor's state, edit engine and device persistence into `@austencloud/video-editor` behind the host contract. tka's post-studio UI does not move and does not change, apart from import paths and the few call-site edits each task lists. Step 2B (a later plan) moves the UI, the UI kit, the English strings and icons, and switches PostModule to `<VideoEditor host plugin>`.

Names used below:

- `PKG` is `E:/worktrees/shared-packages/video-editor/packages/video-editor` (branch `video-editor`, HEAD 6c78f58 when this plan was written).
- `TKA` is `E:/worktrees/tka-platform/video-editor` (branch `codex/video-editor`, HEAD 10ca855e29, which merges tka main 533b9d1355).
- `MC` is `TKA/src/lib/shared/media-composition`.
- `PS` is `TKA/src/lib/shared/share/components/post-studio` (the UI; step 2B).
- `PLUGIN` is `TKA/src/lib/shared/post-studio-plugin`.
- `SCRATCH` is `C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a`, created in Task 1 and kept out of both repos.

### In scope

1. **Edit engine to `./core`.** The generic part of `post-project-edits.ts` moves to `PKG/src/core/edit/project-edits.ts`, with every TKA branch behind new plugin members (`ItemKindDefinition.create`, `VideoEditorPlugin.editHooks`) and the plugin carried in `EditContext`. `post-music-edits.ts` and `post-project-mirror.ts` move whole. The TKA-only edits (titles, tunnel hook family, animation replacement) stay in tka's `post-project-edits.ts`, which keeps its path so its 33 importers keep theirs.
2. **Editor state to the root entry `.`.** `post-editor-state.svelte.ts` splits: the generic editor (project, history, gestures, sessions, media, selection, playback, import, adopt, save) becomes `createVideoEditorState(host, plugin?, options)` in `PKG/src/state/video-editor-state.svelte.ts`. Take timing, the timing mode, tunnel selection, the Tutorial looks and the manifest bridge stay in tka in a new `MC/state/post-timing-state.svelte.ts`, and `MC/state/post-editor-state.svelte.ts` survives as a thin wrapper that composes the two and returns the exact surface the UI reads today (`createPostEditorState(deps)`, `PostEditorState`). `post-video-previews.svelte.ts` and `post-tab-sync.ts` move with the state.
3. **Persistence to the package.** The store port becomes `VideoEditorStore` (project open, save, backup, history load and save, each with a `StoreScope { ownerId, subjectId }`). The device implementation `createDeviceStore(options)` takes its storage keys from the host, so tka's keys do not change and saved posts still open. Firebase reads leave the moved code: tka computes the owner id from auth in tka. Timing load, save and open leave the port and stay in tka.
4. **Dead code out.** `media-composition-state.svelte.ts` (956 lines, dead at run time) and the modules only it uses (`post-studio-slots.ts`, `post-studio-breakdown.ts`) are deleted after `CompositionSourceBinding` moves to the package (open-items, Standing, "Delete media-composition-state").
5. **Package test setup.** Vitest `projects` (a jsdom unit project with a setup file and the svelte plugin), `tsconfig.test.json` wired into `check`, the five NEEDS_TKA_SETUP tests moved in, and the moved tka tests that become portable.
6. **Open items from step 1** that touch state, stores, tests, workers or the exporter (each task cites the item it closes): the bound-only guard for `PostCardItemSchema` and `PostVideoItemSchema`; the type-gate tooling fix; the move list made selectable; `normalizeProject` callers passing the plugin; one host-supplied `IPreviewVideoCache`; `EditCopyManifestSchema` split out so zod leaves the preview worker; the worker's uncaught rejection; the exporter's `finally` order and setup before `try`; the painted mode with no painter; the null-factory and first-wins registry cases; package compositor and exporter tests with no plugin; test housekeeping; the tka test nits; the `alignment` plugin member (dropped, option b).

### Stays in tka (with the reason in the file map)

`take-timing.ts`, `tap-fit.ts`, `timing-summary.ts`, `timing-verdict.ts`, the builder and the timing mode; `staff-tip-*` (tracking, detection, analyzer, track store, worker, analysis state); `feature-video*.ts` and `feature-video-client.ts` (the second store implementation; it keeps working through an adapter); InShot recovery (`post-inshot-import.ts`, `inshot-recovery-package.ts`); `post-draft-storage.ts` (account sync); `post-sequence-actions.ts`, `sequence-frame.ts`, `strip-view.ts`, `tunnel-titles.ts`, `pip-handoff.ts`; the migrations (`post-project-migration.ts`, `post-project-hook-migration.ts`, `post-project-motion-keys.ts`, `post-plan-store.ts`); the painters and captures already behind the plugin; `post-sequence-view.svelte.ts`; everything under `src/lib/features/post/`; all of `PS`.

Three files the brief listed as moving stay in tka, because each one is TKA language rather than editor engine (Risks R1 has the detail): `post-project-ops.ts` (the CLI and dev-bridge op language: hooks, titles, animations, feature-video URLs), `post-project-looks.ts` (the Tutorial preset and the looks that place sequence items, which the spec keeps in tka), and `post-project-bridge-guard.ts` (names `timings`, `mappingPreviewAppearances` and feature-video URLs). `post-project-backup.ts` stays for the same reason: its draft format is timing-centric. They import the moved edits from the package.

### Non-goals (step 2B or later finds them here)

- No UI moves, no PostModule change, no icons, no bits-ui work, no Ringmaster work, no publishing, no change to either primary checkout. The spike stays until step 4.
- Strings: only the keys the moved state needs go into `PKG/src/strings/en.ts`. The rest of the 338 editor keys are 2B's.
- Deferred to 2B, from the open-items file "Step 2" section, because their consumers are UI components:
  - "`surfaces` factory": `VideoEditorPlugin.surfaces` stays a static array in 2A. 2B turns it into `createSurfaces()` when the canvas moves.
  - "Memoized text painter (font flash)": the memoizing `createTextPainterFactory()` and the `plugin.test.ts` positive-path painter cases wait for the workspace to move onto the registry in 2B. This plan only pins the registry's null-factory and first-wins behaviour (Task 14).
  - "Keep the per-update `muted` assignment", "Export the frame recovery types", "Frame recovery stale request": render-side items the UI move touches.
  - "Weight of the render entry in `PostShareSheet`".
  - "Keep one module instance of the package": tka catches `AudioDownloadStalledError` with `instanceof`, so one copy of the package in tka's module graph must hold when the media layer moves in 2B. 2A adds no second copy: the alias loop resolves every import to one `dist`, and `forbidden-imports.mjs` keeps deep imports out.
  - The vitest browser project and component tests: Task 3 builds the `projects` layout so 2B adds a `browser` project without restructuring, and adds no browser project now (no component moves in 2A, and `@vitest/browser` would be an unused dependency).
- The bound evaluate wrappers in `PLUGIN/bound.ts` (`evaluatePresetFrame`, `evaluatePresetLayers`) stay until the UI callers build a `FrameAlignment` themselves (2B).
- The spec's async `MediaLibrary` (`listTakes`, `resolveTake`, `requestFor`) is for the 2B take picker. The 2A state needs a synchronous lookup when it opens a project, so it takes `options.libraryTake(id)` (seam design, below).

---

## Ground rules for every task

Copied from the step 1 plan (lines 38 to 85) and adjusted for 2A. The open-items file's "Standing" section still applies in full; where it and this section differ, the open-items file wins.

- Two worktrees, never a primary checkout. Never edit `E:/tka-platform`, `E:/shared-packages` or `E:/cirque-aflame`.
  - shared-packages: `E:/worktrees/shared-packages/video-editor` (branch `video-editor`), package at `PKG`.
  - tka-platform: `TKA` (branch `codex/video-editor`). Its `node_modules` is a junction into `E:/tka-platform/node_modules`. Never run `npm install`, `npm ci` or `pnpm install` inside TKA and never delete that junction.
  - The Ringmaster worktree is not touched in step 2A.
- Installs happen only in the shared-packages worktree root: `cd /e/worktrees/shared-packages/video-editor && pnpm install`. Only Task 3 adds a dependency (`@sveltejs/vite-plugin-svelte` ^5.1.1: the major the monorepo's three 3D packages already use, present in the pnpm store, fitting vite 6.4.2 and svelte 5.49.1, so the lockfile keeps one major; tka compiles the built `dist` with its own 6.2.4, and runes compile through svelte itself). zod stays one instance at 4.3.6; use no zod API newer than 4.3.6.
- Package files: tabs, LF, ASCII only. Moved files are reformatted with `pnpm exec prettier --use-tabs --print-width 100 --write <files>` from the shared-packages root. Follow the open-items "Prettier" rule: `--check` first, `--write` only files that were clean before plus new files, and name the rest in the report. tka files keep tka's two-space Prettier style. In tka, greps for moved paths exclude `scripts/ceremony-manifest.json`.
- Non-ASCII in moved files is removed with `PKG/scripts/step1/ascii.mjs`, never by hand. Never type a backslash-u escape with the Write or Edit tools (they decode it), and write any file that holds a regex with backslashes through the Write tool, not a Bash heredoc (the Bash tool halves backslashes). The code in this plan uses character classes such as `[.]` and `[/]` so it has no backslashes to lose.
- No em dashes, no en dashes and no emojis in any file or commit message.
- Commit with explicit pathspecs only. Never `git add -A`, never `git add .`, never stash, never `git checkout --`, never `reset --hard`. A file leaving tka is removed with `git rm <path>` in the same commit that switches its importers.
- Every commit message ends with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (open-items, Standing, "Commit trailer"), even when a harness reminder names another model.
- A task that changes both repos commits the package first, then tka. The tka commit body names the package commit (`Package: video-editor@<short hash>`).
- Relative imports inside the package end in `.js`; type-only imports use `import type`. Package files import each other by relative path, never through an entry barrel (`node PKG/scripts/step1/move.mjs --check` exits 0).
- Seam rules (open-items, Standing): core never names a tka kind or field; nothing in `src/core` imports `src/state` or `src/store`; `src/plugin.ts` is imported with `import type` only, so no plugin-index cycle appears; a schema field change changes the matching `order` array in the same commit.
- The package never imports `$lib`, `$app`, `$env`, `firebase`, `bits-ui` or any tka path. Gate: `node PKG/scripts/step1/forbidden-imports.mjs` prints `forbidden imports: 0`. `import.meta.env.DEV` in moved code becomes `host.dev`; `t()` in moved code becomes `host.translate` over `PKG/src/strings/en.ts`.
- One svelte-check and one build at a time across all sessions. Before either, confirm at least 4096 MB free and no other `svelte-check` running (PowerShell):
  ```powershell
  [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'svelte-check|svelte-fast-check' } | Select-Object ProcessId, CommandLine
  ```
  Run builds, checks and test suites from Bash with `timeout: 600000`.
- Kill only processes you started, by PID. Ports 3000, 1871 and 5173 belong to Austen; 9222 and 9333 are his browsers. The only dev server in 2A is the final browser proof in Task 15 on port 5221 (launch.json entry `tka-video-editor-worktree`), run by the controller.
- The parity test is frozen: never set `PARITY_WRITE`, never edit `tests/unit/video-editor-parity.test.ts`, its harness or its fixtures. A parity failure stops the task.
- Model per task is in each task heading: haiku for mechanical work, sonnet for implementation, opus for review, and opus also implements Tasks 6, 9, 10 and 11, whose seams need design judgment. Every task ends with an opus review of its diff against this plan before the next task starts.

### Gates

Every task ends with the gates its heading names.

- **Package gate** (run from `/e/worktrees/shared-packages/video-editor`):
  ```bash
  pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test
  ```
  Expected: svelte-package writes `dist/`; `svelte-check found 0 errors and 0 warnings` for `tsconfig.json` and, from Task 3 on, for `tsconfig.test.json`; every node test and vitest file passes. Before Task 3 the suite is 23 vitest files, 176 tests and 34 node tests; each task's report gives the new counts.
- **Rebuild before tka.** tka reads the package's `dist/` through aliases, so every package change is rebuilt (the package gate does it) before a tka gate runs.
- **tka type gate** (run from TKA):
  ```bash
  npm run check:fast > "$SCRATCH/check-after.txt" 2>&1; node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/check-intersection.mjs "$SCRATCH/check-baseline.txt" "$SCRATCH/check-after.txt"
  ```
  Expected: `new 0`. The baseline is the one Task 1 captures on the merged branch (625 errors). Errors that disappear are fine. A `NEW` line whose message quotes the old path of a moved module is the same error with its text changed: confirm the matching error under the new path in the after file and list it in the report.
- **Parity gate** (run from TKA): `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts`. Expected: `Tests 4 passed | 1 skipped (5)`.
- **tka test gate** (run from TKA): `npm run test:ci > "$SCRATCH/test-after.txt" 2>&1; grep -E "Test Files|Tests |Errors|FAIL" "$SCRATCH/test-after.txt"`. Expected: the only failures allowed are `relaxed-contact-grip` "baseline loop" (a flaky 30 s timeout) and `scene-effects-batching-contract`. A line starting `Errors` means files were skipped; treat it as a failure. A task may run only the subset its steps name; the controller runs the full suite at Tasks 6, 11, 13 and 15.
- **Export smoke** (run from TKA, after a task touching the encoder, compositor, exporter or worker). Until Task 3 it is five files: `tests/unit/animation-engine/background-encoder-timeout.test.ts`, `tests/unit/3d-viewer/offline-3d-exporter-cancellation.test.ts`, `tests/unit/video-export/CanvasFrameCapturer.test.ts`, `tests/unit/sequence-viewer/export-coordinator-scene-take-lifecycle.test.ts`, `src/lib/features/compose/services/video-export-orchestrator-init.test.ts`. From Task 3 on, the first and third live in the package, so it is:
  ```bash
  npx vitest run --config tests/config/vitest.config.ts tests/unit/3d-viewer/offline-3d-exporter-cancellation.test.ts tests/unit/sequence-viewer/export-coordinator-scene-take-lifecycle.test.ts src/lib/features/compose/services/video-export-orchestrator-init.test.ts
  ```
- **Trace-script gate** (run from TKA, after any task touching the store or state): `npx tsx --tsconfig scripts/tsconfig.json scripts/post-handoff-trace.ts`. Expected output: `No saved post for .`
- **tka production build** (Tasks 11 and 15 only):
  ```bash
  npm run build:packages && node scripts/svelte-kit-sync-if-needed.mjs && node scripts/generate-svg-precache-manifest.cjs && npx cross-env NODE_OPTIONS=--max-old-space-size=8192 NODE_ENV=production vite build
  ```
  Never `npm run build`, never `npm run build:all`.
- **Step tooling.** From Task 1 on, the move tools read the list named by `STEP_MOVES` (default `./moves.json`, the step 1 list), resolved against `scripts/step1/`. Every 2A run sets it, from PKG: `STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task N`.

---

## File map

Line counts are the controller's census (`step2-census.md`, 2026-10-09). Paths under `MC` are relative to `TKA/src/lib/shared/media-composition/`; package targets are relative to `PKG/src/`. "Split" rows give the part that moves and the part that stays; the split line counts are estimates that the moving task reports exactly.

**Totals.** About 4,300 lines move (690 in five whole files, about 3,600 out of four splits), 1,524 lines are deleted (four dead files), and about 12,700 lines stay under `MC` plus all 1,511 under `features/post`. tka gains two small files (the timing state and the edit context helper) and keeps thin adapters where a split leaves one.

### Moves whole (5 files, 690 lines)

| tka file | Lines | Package file | Task | Reason |
| --- | --- | --- | --- | --- |
| `MC/domain/post-music-edits.ts` | 297 | `core/edit/music-edits.ts` | 7 | Generic music edits; imports only core, `finish`/`EditContext` and the BPM limits already in `core/sequence-types.ts` |
| `MC/domain/post-project-mirror.ts` | 141 | `core/edit/mirror.ts` | 7 | Generic mirror of a project; no TKA kind or field |
| `MC/services/edit-copy-lookup.ts` | 56 | `render/edit-copy-lookup.ts` | 5 | Generic edit-copy lookup; `isFeatureVideoMediaUrl` becomes an option `skip?(url)` that tka supplies |
| `MC/services/post-tab-sync.ts` | 66 | `state/tab-sync.ts` | 12 | Generic BroadcastChannel sync; takes the full channel name instead of building `tka:post-studio:tabs:` |
| `MC/state/post-video-previews.svelte.ts` | 130 | `state/video-previews.svelte.ts` | 12 | Generic; the cache becomes a required parameter, supplied from `host.previewCache` (open-items "One app-wide `IPreviewVideoCache`") |

### Splits (4 files)

| tka file | Lines | Moves to | Stays in tka | Task |
| --- | --- | --- | --- | --- |
| `MC/domain/post-project-edits.ts` | 2696 | About 2,195 lines (everything except lines 471 to 971) to `core/edit/project-edits.ts`, with the TKA branches behind hooks (seam design D) | About 501 lines: `addTitlesItem`, `findTunnelHook`, `withKeysShifted`, `addTunnelHook`, `TunnelHookClock`, `lineUpTunnelHook`, `withoutTunnelBackdrop`, `removeTunnelHook`, `setTunnelHookSpeed`, `setTunnelHookBackdropFrame`, `setTunnelAppearance`, `canReplaceOverlayVideoWithAnimation`, `replaceOverlayVideoWithAnimation`; same path, so its 33 importers keep their import path for these names | 6 |
| `MC/services/post-editor-history-store.ts` | 277 | About 237 lines to `store/history-storage.ts` (envelope, depth and budget trimming, parse, `createHistoryStorage`) | About 40 lines: `PostTimingEffect`, `parseTimingEffect`, and `savePostEditorHistory`, `loadPostEditorHistory`, `createPostEditorHistoryStorage(prefix)` as wrappers with tka's prefix and plugin | 9 |
| `MC/services/post-project-store.ts` | 166 | About 96 lines to `store/device-store.ts` (load and parse, verified save, spare copies, before-import backup) | About 70 lines: the key mapping `TKA_DEVICE_KEYS`, `postOwnerId()` (the only auth reads), `legacyPostOwner`, `claimLegacyPosts`, `accountPostProjectKeys`, and `loadPostProject`, `savePostProject`, `openPostProject`, `backupPostProjectBeforeImport` as wrappers | 9 |
| `MC/state/post-editor-state.svelte.ts` | 1699 | About 1,100 lines to `state/video-editor-state.svelte.ts` (seam design C) | The wrapper (`createPostEditorState`, `PostEditorState`, about 300 lines) plus a new `MC/state/post-timing-state.svelte.ts` (about 450 lines: timings, timing undo, the timing mode, `clocks`, alignment) | 10, 11 |

New package files besides the targets above: `src/host.ts` (Task 8), `src/strings/en.ts` and `src/strings/translate.ts` (Task 8), `src/store/types.ts` (Task 8), `src/state/source-binding.ts` (Task 4), `src/core/edit/context.ts` and `src/core/project/subject.ts` (Task 6), `src/core/edit-copy-manifest.ts` (Task 5), `src/core/deep-equal.ts` (Task 9), `src/core/take-keys.ts` (Task 10), `test/setup/blob.ts`, `test/setup/canvas.ts` and `tsconfig.test.json` (Task 3), `scripts/step2/moves.json` (Task 1). New tka files: `MC/state/editor-strings.ts` (Task 8), `MC/state/post-timing-state.svelte.ts` (Task 11), `PLUGIN/edit-hooks.ts` (Task 6).

### Deleted (4 files, 1,524 lines; Task 4)

| tka file | Lines | Reason |
| --- | --- | --- |
| `MC/state/media-composition-state.svelte.ts` | 956 | Dead at run time. The three UI importers take only the `CompositionSourceBinding` type (`PostEditorCanvas.svelte` line 13, `PostEditorWorkspace.svelte` line 76) or a context that is never set (`PostStudioMediaLayer.svelte` lines 11, 121, about 499 and 751, all null-guarded). The type (lines 58 to 75, with `CompositionSourceStatus` at line 47) moves to `state/source-binding.ts` |
| `MC/state/media-composition-context.ts` | 24 | Its only setter is the dead state; `tryGetMediaCompositionContext()` always returns null |
| `MC/domain/post-studio-slots.ts` | 366 | Only importer in `src` is the dead state (Risks R2) |
| `MC/domain/post-studio-breakdown.ts` | 178 | Only importer in `src` is the dead state (Risks R2) |

Their tests go with them: `tests/unit/media-composition/media-composition-state.test.ts`, `tests/unit/post-studio-slots.test.ts`, `tests/unit/media-composition/post-studio-breakdown.test.ts`, and `post-studio-media-layer-harness.svelte.ts` only if `post-studio-media-layer-lifecycle.test.ts` no longer needs it (Task 4 Step 1 checks).

### Stays in tka: domain (20 files)

| tka file | Lines | Reason |
| --- | --- | --- |
| `MC/domain/feature-video-export.ts` | 74 | Feature-video render jobs (tka main) |
| `MC/domain/feature-video-url.ts` | 35 | Feature-video media URLs |
| `MC/domain/feature-video.ts` | 134 | Feature videos are a tka workflow |
| `MC/domain/pip-handoff.ts` | 70 | Sequence picture-in-picture handoff |
| `MC/domain/post-inshot-import.ts` | 514 | InShot recovery is a tka workflow; parses with tka's bound `PostProjectSchema` |
| `MC/domain/post-project-bridge-guard.ts` | 71 | Names `timings`, `mappingPreviewAppearances` and feature-video URLs (Risks R1) |
| `MC/domain/post-project-hook-migration.ts` | 141 | Migration of TKA tunnel hooks |
| `MC/domain/post-project-looks.ts` | 554 | Tutorial preset and sequence looks; the spec keeps them in tka (Risks R1) |
| `MC/domain/post-project-migration.ts` | 237 | v1 plan migration, used by tka's `openFallback` |
| `MC/domain/post-project-motion-keys.ts` | 151 | TKA motion keys |
| `MC/domain/post-project-ops.ts` | 762 | The CLI and dev-bridge op language, TKA ops throughout; imported only by `src/lib/server/feature-video-store.ts` and the dev bridge (Risks R1) |
| `MC/domain/post-sequence-actions.ts` | 115 | Notation actions |
| `MC/domain/sequence-frame.ts` | 120 | Sequence frame math |
| `MC/domain/staff-tip-track.ts` | 236 | Staff tracking |
| `MC/domain/strip-view.ts` | 60 | Sequence strip |
| `MC/domain/take-timing.ts` | 2327 | Take timing (spec) |
| `MC/domain/tap-fit.ts` | 676 | Take timing (spec) |
| `MC/domain/timing-summary.ts` | 168 | Timing mode, 14 `t()` keys |
| `MC/domain/timing-verdict.ts` | 148 | Timing mode |
| `MC/domain/tunnel-titles.ts` | 133 | TKA titles |

### Stays in tka: services, state, workers, root (25 files)

| tka file | Lines | Reason |
| --- | --- | --- |
| `MC/get-preview-video-cache.ts` | 23 | tka's app-wide cache singleton; passes `skip: isFeatureVideoMediaUrl` to the moved lookup and is what tka's host supplies as `previewCache` |
| `MC/services/animation-overlay-painter-registry.ts` | 51 | Painter behind the plugin |
| `MC/services/beat-carousel-layout.ts` | 289 | Painter behind the plugin |
| `MC/services/beat-carousel-painter.ts` | 152 | Painter behind the plugin |
| `MC/services/feature-video-client.ts` | 424 | Feature videos; its `PostEditorStore` keeps working through `editorStoreOf` |
| `MC/services/inshot-recovery-package.ts` | 126 | InShot recovery |
| `MC/services/post-draft-storage.ts` | 281 | Account sync, Firebase |
| `MC/services/post-editor-store.ts` | 58 | Rewritten as the adapter: keeps `PostEditorStore` (timing methods included) and `devicePostEditorStore`, adds `editorStoreOf(store)` (Task 9) |
| `MC/services/post-plan-store.ts` | 51 | v1 plans, read by tka's `openFallback` |
| `MC/services/post-project-backup.ts` | 196 | Timing-centric draft format |
| `MC/services/post-project-dev-client.ts` | 190 | Dev bridge client |
| `MC/services/post-sequence-view.svelte.ts` | 157 | Sequence view (spec) |
| `MC/services/post-studio-dom-capture.ts` | 28 | Capture behind the plugin |
| `MC/services/post-studio-pictograph-capture.ts` | 65 | Capture behind the plugin |
| `MC/services/sequence-strip-painter.ts` | 512 | Painter behind the plugin |
| `MC/services/staff-effect-painter.ts` | 393 | Painter behind the plugin |
| `MC/services/staff-tip-analyzer.ts` | 73 | Staff tracking |
| `MC/services/staff-tip-detection.ts` | 409 | Staff tracking |
| `MC/services/staff-tip-track-store.ts` | 65 | Staff tracking, dexie |
| `MC/services/staff-tip-tracking.ts` | 488 | Staff tracking |
| `MC/services/take-timing-store.ts` | 245 | Timing persistence; keeps its own auth reads (lines 50, 57) |
| `MC/services/tunnel-titles-painter.ts` | 123 | Painter behind the plugin |
| `MC/state/staff-tip-analysis.svelte.ts` | 178 | Staff tracking |
| `MC/workers/staff-tip-tracker.worker.ts` | 223 | Staff tracking |

### Stays in tka: features/post (6 files, 1,511 lines)

| tka file | Lines | Reason |
| --- | --- | --- |
| `features/post/PostModule.svelte` | 523 | The module; 2B switches it to `<VideoEditor host plugin>` |
| `features/post/context/post-module-context.ts` | 15 | Module context |
| `features/post/services/get-post-workspace-navigator.ts` | 15 | Module navigation |
| `features/post/services/post-account-projects.ts` | 336 | Account projects; keeps importing tka's `post-project-store` wrappers |
| `features/post/services/post-workspace-projects.ts` | 352 | Workspace projects; imports `legacyPostOwner` |
| `features/post/state/post-module-state.svelte.ts` | 270 | Module state |

### Tests

- tka's nine state tests (`tests/unit/media-composition/post-editor-{add,history,import,persistence,reload,reload-history,store,tabs,tools}.test.ts`) stay in tka unchanged. They now test the wrapper over the package state, which is the behavioural proof of the split. Only their import paths change where a split moved a name.
- New plugin-free package tests prove the package state, store and edits on their own (Tasks 6, 9, 10).
- Tests that become portable after the moves (expected: `post-music-edits.test.ts`, `post-timeline-music-lane.test.ts`, `edit-copy-lookup.test.ts`; near-miss `post-project-mirror.test.ts`, which imports the plugin) move in Task 13 by rerunning `portable-tests.mjs` with the step 2 list. The five NEEDS_TKA_SETUP tests move in Task 3.

---

## Seam design

Six parts: (A) the host contract, (B) the store port and the device store, (C) the package state, (D) the timing seam, (E) the kind edit hooks, (F) tka's wrapper. Everything here is exact; tasks refer back to it by letter. Where a type below differs from a current tka signature in anything but a name, the tka signature wins and the task report says so.

### A. Host contract (`PKG/src/host.ts`, Task 8)

The spec's host contract, narrowed for 2A: `notify` and `shortcuts` arrive in 2B with the UI that calls them (spec types: `notify?: (toast: { kind: "info" | "error"; text: string }) => void`, `shortcuts?: ShortcutRegistrar`), and `previewCache` is added (open-items "One app-wide `IPreviewVideoCache`").

```ts
import type { IPreviewVideoCache } from "./render/preview-cache/preview-video-cache-contract.js";
import type { StringKey } from "./strings/en.js";
import type { VideoEditorStore } from "./store/types.js";

/** What an app gives the editor. Everything but ownerId has a default. */
export interface VideoEditorHost<E = unknown> {
	/**
	 * Whose projects these are. Read at every store call, so a getter may follow sign-in.
	 * Scopes the device store's keys (it replaces the auth.currentUser reads).
	 */
	readonly ownerId: string;
	/** Where projects and history live. Default: createDeviceStore() with no plugin. */
	store?: VideoEditorStore<E>;
	/** The take library a picker lists (2B reads it; the 2A state uses options.libraryTake). */
	mediaLibrary?: MediaLibrary;
	/** Replaces t(). Default: the English table in strings/en.ts. */
	translate?: (key: StringKey, params?: Record<string, string | number>) => string;
	/** Default: Date.now. */
	now?: () => number;
	/** Development-only behaviour; replaces import.meta.env.DEV in moved code. */
	dev?: boolean;
	/** The app-wide preview video cache the previews read. Required by createVideoPreviews callers. */
	previewCache?: IPreviewVideoCache;
}

export interface LibraryTake {
	id: string;
	label: string;
	url: string;
	durationSeconds: number;
}

export interface MediaLibrary {
	listTakes(): Promise<LibraryTake[]>;
	resolveTake(id: string): Promise<LibraryTake | null>;
	/** Rewrites or re-requests a media URL so fetch and decode succeed (proxy, cache: "no-store"). */
	requestFor(url: string): Request;
}
```

Strings (`PKG/src/strings/en.ts` and `PKG/src/strings/translate.ts`, Task 8):

```ts
// en.ts: only the keys 2A's moved code needs; 2B grows the table.
export const EN = {
	editor_default_take: "Take",
	editor_save_failed: "The project could not be saved: {error}",
	editor_import_busy: "Finish the current edit before importing a project.",
	editor_missing_media: "Missing media: {name}",
	editor_missing_video: "Missing video: {name}",
	editor_missing_image: "Missing image: {name}",
} as const;

export type StringKey = keyof typeof EN;
```

```ts
// translate.ts
import { EN, type StringKey } from "./en.js";

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/** Fills {name} placeholders from params; a missing param leaves the placeholder. */
export function formatString(text: string, params: Record<string, string | number> = {}): string {
	return text.replace(/[{]([a-z_]+)[}]/g, (whole, name: string) =>
		name in params ? String(params[name]) : whole,
	);
}

export function englishString(key: StringKey, params?: Record<string, string | number>): string {
	return formatString(EN[key], params);
}

export function translatorFor(host: { translate?: Translate }): Translate {
	return (key, params) => host.translate?.(key, params) ?? englishString(key, params);
}
```

Task 8 Step 1 greps the exact texts the state throws or sets today (`grep -n "Missing \|could not save\|Finish the current edit\|t(\"" MC/state/post-editor-state.svelte.ts`) and adjusts the placeholders so tka's translate (section F) reproduces every current string byte for byte. tka tests assert some of these strings; they must pass unchanged.

### B. Store port and device store (`PKG/src/store/`, Task 9)

`store/types.ts`:

```ts
import type { PostProject } from "../core/project/schema.js";

/** Who and what a store call is about. */
export interface StoreScope {
	/** host.ownerId when the call is made. */
	ownerId: string;
	/** The project's subject: the value of plugin.subjectKey (tka: sequenceId). */
	subjectId: string;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** One undo step. effect is what a plugin changed beside the project (tka: a take timing). */
export interface HistoryEntry<E = unknown> {
	project: PostProject;
	effect?: E;
}

export interface EditorHistory<E = unknown> {
	/** The saved project the history leads up to. */
	head: PostProject;
	headEffect?: E;
	past: readonly HistoryEntry<E>[];
	future: readonly HistoryEntry<E>[];
}

export interface RestoredEditorHistory<E = unknown> {
	headEffect?: E;
	past: HistoryEntry<E>[];
	future: HistoryEntry<E>[];
}

/** The PostEditorStore port with the owner passed in and timing left out. */
export interface VideoEditorStore<E = unknown> {
	/** The saved project for the scope, or a new empty one. */
	openProject(scope: StoreScope, now: number): PostProject;
	saveProject(scope: StoreScope, project: PostProject): SaveResult;
	/** Keeps the current project before an import replaces it. */
	backupBeforeImport(scope: StoreScope, project: PostProject): void;
	loadHistory(scope: StoreScope, head: PostProject): RestoredEditorHistory<E> | null;
	saveHistory(scope: StoreScope, history: EditorHistory<E>): void;
}
```

`store/device-store.ts` (the generic part of `post-project-store.ts`; uses `store/history-storage.ts`):

```ts
import type { VideoEditorPlugin } from "../plugin.js";
import type { PostProject } from "../core/project/schema.js";
import type { SaveResult, StoreScope, VideoEditorStore } from "./types.js";

export interface DeviceStoreKeys {
	project(scope: StoreScope): string;
	/** The spare copy of the save before the current one. */
	previous(scope: StoreScope): string;
	beforeImport(scope: StoreScope): string;
	/** sessionStorage key of the undo history. */
	history(scope: StoreScope): string;
	/** Spare copies, which give way when storage is full. */
	isSpareCopy(key: string): boolean;
}

export interface DeviceStoreOptions<E = unknown> {
	plugin?: VideoEditorPlugin;
	/** Default: deviceStoreKeys("video-editor:"). */
	keys?: DeviceStoreKeys;
	/** When nothing is saved: a host migration (tka: a v1 plan). null falls through to an empty project. */
	openFallback?: (scope: StoreScope, now: number) => PostProject | null;
	/** Validates a stored history effect. Default: effects are dropped. */
	parseEffect?: (value: unknown) => E | undefined;
	/** Project fields the history ignores when it compares a saved head (tka: ["timings"]). */
	volatileFields?: readonly string[];
	/** Test seams. Default: guarded localStorage and sessionStorage. */
	local?: () => Storage | null;
	session?: () => Storage | null;
}

export interface DeviceStore<E = unknown> extends VideoEditorStore<E> {
	/** The saved project, parsed, subject-checked and normalized, or null. */
	loadProject(scope: StoreScope): PostProject | null;
}

/** Plain keys for a host with no legacy format: <prefix>project:<owner>:<subject> and so on. */
export function deviceStoreKeys(prefix: string): DeviceStoreKeys {
	const project = (scope: StoreScope) => `${prefix}project:${scope.ownerId}:${scope.subjectId}`;
	return {
		project,
		previous: (scope) => `${project(scope)}:previous`,
		beforeImport: (scope) => `${project(scope)}:before-import`,
		history: (scope) => `${prefix}history:${scope.ownerId}:${scope.subjectId}`,
		isSpareCopy: (key) => key.startsWith(prefix) && key.endsWith(":previous"),
	};
}

export function createDeviceStore<E = unknown>(options: DeviceStoreOptions<E> = {}): DeviceStore<E>;
```

Its body is today's `post-project-store.ts` logic with every key from `keys` and every auth read gone: `loadProject` parses with `createProjectSchema(plugin)`, rejects a project whose subject (`subjectOf(project, plugin)`, section E) differs from `scope.subjectId`, and returns `normalizeProject(parsed, plugin)`; `saveProject` is today's verified save with the spare copy at `keys.previous(scope)` and `dropSpareCopies` filtering by `keys.isSpareCopy`; `backupBeforeImport` writes `keys.beforeImport(scope)` and throws "Device storage is unavailable. The current post was kept." when storage is missing (text unchanged); `openProject` is `loadProject(scope) ?? openFallback?.(scope, now) ?? createEmptyPostProject({ now }, { [subjectKeyOf(plugin)]: scope.subjectId })` (the built-in default carries only the subject key, so a host whose `projectExtension` has other required fields passes `openFallback`, as tka does with its bound `createEmptyPostProject` and `emptyProjectFields`; step 3's Ringmaster store does the same); `loadHistory` and `saveHistory` go through `createHistoryStorage({ plugin, key: (subjectId) => keys.history({ ownerId: scope.ownerId, subjectId }), parseEffect, volatileFields, storage: session })`.

`store/history-storage.ts` is today's `post-editor-history-store.ts` with: the prefix replaced by `key(subjectId)`; the envelope's `sequenceId` field written under `subjectKeyOf(plugin)` in the same position (so tka's envelope is byte for byte `{ version, sequenceId, headUpdatedAt, head, headEffect, past, future }` and no session history is lost across the deploy); the subject check through `subjectOf`; `normalizeProject(entry, plugin)`; `headContent` dropping `volatileFields` instead of `timings`; `write`'s full-storage eviction filtering other keys by `startsWith(key(""))`, which is today's prefix for both tka families; effects through `parseEffect` (absent: dropped; a stored effect it rejects voids the whole history, as today); `deepEqual` from `PKG/src/core/deep-equal.ts` (a copy of tka's `deepEqual` from `$lib/shared/sequence-viewer/services/viewer-url-state-codec.ts`, added in Task 9 because `grep -rn "export function deepEqual" PKG/src` finds none).

```ts
export interface HistoryStorageOptions<E = unknown> {
	plugin?: VideoEditorPlugin;
	/** Ends with the subject id; key("") is the family prefix whose other histories give way when storage is full. */
	key: (subjectId: string) => string;
	parseEffect?: (value: unknown) => E | undefined;
	volatileFields?: readonly string[];
	storage?: () => Storage | null;
}

export function createHistoryStorage<E = unknown>(
	options: HistoryStorageOptions<E>,
): {
	load(head: PostProject): RestoredEditorHistory<E> | null;
	save(history: EditorHistory<E>): void;
};
```

**tka's keys today and after.** tka's owner id is computed in tka (`MC/services/post-project-store.ts`, the only auth reads left in the store):

```ts
/** account:<uid> when signed in with an account, guest when device posts were claimed, else device. */
export function postOwnerId(): string {
  const user = auth.currentUser;
  if (user && !user.isAnonymous) return `account:${user.uid}`;
  return legacyPostOwner() ? "guest" : "device";
}

const PREFIX = "tka:post-studio:project:v2:";

export const TKA_DEVICE_KEYS: DeviceStoreKeys = {
  project: ({ ownerId, subjectId }) =>
    ownerId === "device" ? `${PREFIX}${subjectId}` : `${PREFIX}${ownerId}:${subjectId}`,
  previous: (scope) =>
    scope.ownerId === "device"
      ? `${PREFIX}previous:${scope.subjectId}`
      : `${TKA_DEVICE_KEYS.project(scope)}:previous`,
  beforeImport: (scope) =>
    scope.ownerId.startsWith("account:")
      ? `${TKA_DEVICE_KEYS.project(scope)}:before-import`
      : `${PREFIX}before-import:${scope.subjectId}`,
  history: ({ subjectId }) => `tka:post-studio:history:v1:${subjectId}`,
  isSpareCopy: (key) =>
    key.startsWith(PREFIX) && (key.endsWith(":previous") || key.startsWith(`${PREFIX}previous:`)),
};
```

| Key | Who | Today | After |
| --- | --- | --- | --- |
| project | signed in | `tka:post-studio:project:v2:account:<uid>:<seq>` | same (owner `account:<uid>`) |
| project | signed out, device posts claimed | `tka:post-studio:project:v2:guest:<seq>` | same (owner `guest`) |
| project | signed out, unclaimed | `tka:post-studio:project:v2:<seq>` | same (owner `device`) |
| spare copy | signed in or guest | `<project key>:previous` | same |
| spare copy | device | `tka:post-studio:project:v2:previous:<seq>` | same |
| before import | signed in | `<project key>:before-import` | same |
| before import | guest or device | `tka:post-studio:project:v2:before-import:<seq>` | same |
| history (sessionStorage) | anyone | `tka:post-studio:history:v1:<seq>` | same |
| feature-video history | anyone | `<BUFFER_PREFIX><slug>:history:<seq>` | same (`createPostEditorHistoryStorage(prefix)` wraps `createHistoryStorage`) |

Task 9's first test pins every row of this table against `TKA_DEVICE_KEYS` before any code moves.

### C. Package state (`PKG/src/state/video-editor-state.svelte.ts`, Task 10)

```ts
import type { VideoEditorHost } from "../host.js";
import type { VideoEditorPlugin } from "../plugin.js";

/** A library take's media, as the host's catalog answers synchronously. */
export interface LibraryTakeSource {
	videoId: string;
	label: string;
	url: string;
	durationSeconds: number;
}

export interface VideoEditorStateOptions<E = unknown> {
	/** What the project is about (tka: the sequence id; Ringmaster: the gig id). */
	subjectId: string;
	/** Opens this project instead of the store's (a feature video, a test). */
	initialProject?: PostProject;
	/** A library take's media when a project opens, undoes or adopts. null: not available yet. */
	libraryTake?: (videoId: string) => LibraryTakeSource | null;
	/** Plugin state that rides along with the editor (tka: take timing). Built once, after the state object exists and before saved media loads. */
	extension?: (state: VideoEditorState<E>) => StateExtension<E>;
}

export function createVideoEditorState<E = unknown>(
	host: VideoEditorHost<E>,
	plugin: VideoEditorPlugin | undefined,
	options: VideoEditorStateOptions<E>,
): VideoEditorState<E>;
```

Every store call passes `{ ownerId: host.ownerId, subjectId: options.subjectId }`. The store defaults to `createDeviceStore<E>({ plugin })`. `now()` is `host.now ?? Date.now`. The constants (`HISTORY_DEPTH` 100, `SETTING_JOIN_MS` 800, `HISTORY_KEEP_DELAY_MS` 400) move unchanged; `TIMING_UNDO_DEPTH` stays in tka. Derived values: `compiled = compilePostProject(project, { now: project.updatedAt, ...presetIdFor(project), ...extension?.compileContext?.() }, plugin)` where `presetIdFor` gives `{ presetId: "post-project:" + subject }` when `subjectOf(project, plugin)` is defined (what tka's bound `compilePostProject` does today) and `{}` otherwise; `presentLayers = evaluatePresetLayers(compiled.preset, compiled.durationSeconds, previewSeconds, extension?.alignment?.() ?? null)`.

The returned object, member by member (M = moved from `post-editor-state.svelte.ts` with the same behaviour, N = new, R = moved and renamed):

```ts
export interface VideoEditorState<E = unknown> {
	// Project and saving
	readonly subjectId: string; // N
	readonly project: PostProject; // M
	readonly snapshot: PostProject; // M (a getter today, read as a property by PostEditorWorkspace lines 428, 431, 492; snapshotFor: extension.embed, then updatedAt kept at or after the last save)
	readonly saveError: string | null; // M
	readonly saveRevision: number; // M
	saveNow(): void; // M
	/** Saves the current project; extraError reports a plugin-side save failure (tka: a timing). */
	persist(extraError?: string | null): void; // N (was the internal persistProject)
	// Takes, images and media
	readonly takes: readonly PostTake[]; // M
	takeDisplayLabel(takeId: string): string; // M
	readonly images: NonNullable<PostProject["images"]>; // M
	imageUrl(imageId: string): string | null; // M
	mediaUrl(takeId: string): string | null; // M
	readonly takesInUse: readonly PostTake[]; // M
	// Compile and frame
	readonly compiled: CompiledPostProject | null; // M
	readonly durationSeconds: number; // M
	readonly frameLayers: EvaluatedFrameLayer[]; // M
	readonly presentLayers: EvaluatedFrameLayer[]; // M
	readonly regionRects: Map<string, RegionRect>; // M
	// Playback
	readonly previewSeconds: number; // M
	readonly isPlaying: boolean; // M
	seek(seconds: number): void; // M
	advance(deltaSeconds: number): void; // M
	togglePlayback(): void; // M
	pause(): void; // M
	// Selection
	selectedItemId: string | null; // M (setter validates; calls extension.selected on every set, as today's setter clears the tunnel part on every set)
	readonly selectedItem: PostItem | null; // M
	readonly splitTarget: ReturnType<typeof splitTargetAt>; // M
	readonly selectionEditable: boolean; // M
	isLocked(itemId: string): boolean; // M
	// History
	readonly canUndo: boolean; // M
	readonly canRedo: boolean; // M
	readonly inGesture: boolean; // M
	readonly inSession: boolean; // M
	/** One undo step to next, carrying effect; false when nothing changed. */
	commit(next: PostProject, effect?: E): boolean; // N (was internal)
	/** The project changes without an undo step, then saves (tka: a timing preview look). */
	amend(next: PostProject): void; // N
	/** The context every edit gets: { now: now(), plugin }. */
	editContext(): EditContext; // N
	edit(change: PostEdit): boolean; // M
	editSetting(key: string, change: PostEdit): boolean; // M
	beginGesture(): void; // M
	gestureStep(change: PostEdit): void; // M
	endGesture(): void; // M
	cancelGesture(): void; // M
	beginSession(): boolean; // M (false when one is already open)
	endSession(keep: boolean): void; // M
	undo(): void; // M (reloads saved media, then calls extension.replayEffect, then persists, as today's lines 514-516)
	redo(): void; // M
	// Edits
	trimLive(itemId: string, edge: "start" | "end", seconds: number): void; // M
	splitAtPlayhead(): boolean; // M
	deleteSelected(): boolean; // M (no tunnel branch; the wrapper adds it)
	duplicateSelected(): boolean; // M
	addOverlay(spec: NewOverlaySpec): string | null; // M
	addCard(): string | null; // M
	setAudio(audio: PostProject["audio"]): void; // M
	seedAudio(audio: PostProject["audio"]): void; // M
	// Media
	addLocalVideo(file: File, durationSeconds: number): string | null; // M
	addLibraryVideo(video: LibraryTakeSource): string | null; // R (addCatalogVideo)
	appendTakeClip(takeId: string): string | null; // M
	relinkLocalTake(takeId: string, file: File): boolean; // M
	relinkProjectFiles(files: ReadonlyMap<string, File>): number; // M
	attachLibraryTakes(): void; // R (attachCatalogTakes)
	renameTake(takeId: string, label: string): void; // M
	removeTake(takeId: string): void; // M (calls extension.takeRemoved)
	// Import and other tabs
	importProject(next: PostProject, files?: ReadonlyMap<string, File>): void; // M (extension.prepareImport and importing; today's parameter type at line 765)
	adoptSaved(next: PostProject, options?: { evenIfOlder?: boolean }): boolean; // M (extension.adopting)
	/** Attaches saved media for a project before it is committed (tka: the dev manifest bridge, today's line 964). */
	loadSavedMedia(source: PostProject): void; // N (was internal)
	dispose(): void; // M (then extension.dispose)
}

export type PostEdit = (project: PostProject, context: EditContext) => PostProject; // M
```

The exact parameter and return types of `importProject`, `adoptSaved`, `splitAtPlayhead`, `deleteSelected`, `duplicateSelected`, `advance` and `seek` are copied from today's functions (lines 765, 858 and the bodies named in the file map); the names and the M, N, R marks above are binding. Strings come from `translatorFor(host)`: `editor_default_take` for the new take label, `editor_save_failed` for a failed save, and the import messages.

### D. Timing seam (`StateExtension`, Task 10; tka side, Task 11)

The package state knows nothing about take timing. Plugin state that rides along with the editor is an extension built per state instance by `options.extension(state)`, never a plugin singleton member, because a module-level plugin cannot hold one editor's state (the step 1 carry-over finding about `surfaces` and `AlignmentProvider.create`). It is the data half of the spec's `modes` member; 2B adds the UI half when the timing mode moves.

```ts
export interface StateExtension<E = unknown> {
	/** The project as saved, with plugin state embedded (tka: each valid take timing). */
	embed?(project: PostProject): PostProject;
	/** True when a saved take needs nothing more on open or undo (tka: its timing for this take key is loaded). */
	takeReady?(take: PostTake, source: PostProject): boolean;
	/** Media was attached to a take (open, undo, add, relink, adopt). tka: open the take's timing. */
	takeAttached?(take: PostTake, source: PostProject): void;
	/** A saved take whose media is not here: a local file, or a library take the library lacks. */
	takeWithoutMedia?(take: PostTake, source: PostProject): void;
	takeRemoved?(takeId: string): void;
	/** Rewrites an incoming project before it is parsed (tka: timings and sequenceId moved to this sequence, the draft transfer). */
	prepareImport?(incoming: unknown, current: PostProject): unknown;
	/** The parsed import is about to replace the project (tka: keep retained timings). */
	importing?(next: PostProject): void;
	/** A newer save is about to be adopted (tka: merge its timings). */
	adopting?(next: PostProject): void;
	/** Undo or redo crossed an entry that carries an effect. */
	replayEffect?(effect: E, direction: "undo" | "redo"): void;
	/** The alignment the frame evaluator reads; called inside a $derived. */
	alignment?(): FrameAlignment | null;
	/** Extra compile context (tka: animationOverlay); called inside a $derived. */
	compileContext?(): Partial<Omit<CompilePostProjectContext, "now">>;
	/** The selected item changed (tka: clear the tunnel part). */
	selected?(itemId: string | null): void;
	dispose?(): void;
}
```

Order inside `createVideoEditorState`: declare state and functions, build the returned object, call `options.extension?.(state)`, then run `loadSavedMedia()`, then return. `loadSavedMedia(source)` becomes: skip a take when `extension?.takeReady?.(take, source)`; a library take attaches when `options.libraryTake(videoId)` answers, else `takeWithoutMedia`; a linked take attaches; a local take goes to `takeWithoutMedia`; linked images attach as today. `attach` sets the media and then calls `takeAttached`.

tka's side, `MC/state/post-timing-state.svelte.ts` (Task 11), owns: `timings`, `timingUndo`, `timingRedo` (depth 50), `lastMappingSetting`, `timingTakeId`, `resolved`, `clocks`, the alignment built in a `$derived` from `tkaFrameAlignment({ steps, startPlacementDuration: 1, sequencePeriod: sequence.period ?? sequence.orientationCycleCount ?? 1, clocks })` (open-items "`alignment` provider design": built in a `$derived`), `openTiming`, `statusOf`, `replayTiming`, `editTiming`, `writeMappingAppearance` (through `state.amend`), `editMappingPreviewAppearance`, `currentTakeHistoryEntry`, `applyTakeHistoryEntry`, `undoTiming`, `redoTiming`, `confirmTiming`, `splitTakeTimingAt`, and the timing store calls (`take-timing-store.ts`, unchanged). It exports:

```ts
export function createPostTimingState(deps: {
  getSequence: () => SequenceData;
  getCatalogVideo?: (videoId: string) => CatalogTakeSource | null;
  hasAnimationOverlay?: () => boolean;
  store: PostEditorStore;
  now: () => number;
}): {
  extension: (state: VideoEditorState<PostTimingEffect>) => StateExtension<PostTimingEffect>;
  readonly sequence: SequenceData;
  readonly moveBeats: number[];
  selectedTakeId: string | null;
  timing(takeId: string): TakeTiming | null;
  resolvedTiming(takeId: string): ResolvedTakeTiming | null;
  timingStatus(takeId: string): TakeTimingStatus;
  canUndoTiming(takeId: string): boolean;
  canRedoTiming(takeId: string): boolean;
  editTiming: /* today's editTiming signature */;
  editMappingPreviewAppearance: /* today's signature */;
  undoTiming(takeId: string): void;
  redoTiming(takeId: string): void;
  confirmTiming: /* today's signature */;
  splitTakeTimingAt: /* today's signature */;
  rememberLegacy(video: CatalogTakeSource): void;
  readonly clocks: Record<string, TakeClock>;
};
```

The four `/* today's signature */` members keep exactly the parameter lists they have in `post-editor-state.svelte.ts` today (`moveBeats` is today's `$derived` `number[]` at line 158, which `PostTimingSession`'s `TimingHost` reads as `readonly number[]`); Task 11 copies them. `rememberLegacy` records a catalog video's `legacyStepMap` before the wrapper calls `addLibraryVideo`, so `takeAttached` can seed the timing the way `attach(take, url, false, video.legacyStepMap)` does today.

The spec says `VideoEditorStore` keeps "timing load and save"; this plan takes them out of the port (the brief's decision; Risks R4). Ringmaster never sees a timing type.

### E. Kind edit hooks (`PKG/src/plugin.ts`, `PKG/src/core/edit/context.ts`, Task 6)

Every TKA branch in `post-project-edits.ts` and the hook it becomes:

| Lines today | Branch | Becomes |
| --- | --- | --- |
| 222-250 | `replaceTakeMedia` shifts `project.timings[takeId]` with `shiftTakeTiming` | `editHooks.takeMediaChanged(project, { kind: "replace", ... }, ctx)` |
| 295-320 | `relinkTake` re-records `project.timings[takeId]` with `rerecordedTakeTiming` | `editHooks.takeMediaChanged(project, { kind: "relink", ... }, ctx)` |
| 372-402 | `NewOverlayKind` names animation, moves, carousel, titles; `NewOverlaySpec` has `mode`, `spoken`, `overlay`, `animationAppearance`, `cardAppearance` | `NewOverlayKind = Exclude<PostItem["kind"], "image">`; the TKA fields move to the augmentable `PluginOverlaySpec` |
| 418 | `defaultBoxFor(spec.kind)` | `defaultBoxFor(spec.kind, ctx.plugin)` |
| 471-971 | titles, tunnel hook family, animation replacement (972-981 is the "Split, delete, duplicate" header and `splitItemAt`'s doc comment, which move) | stay in tka's `post-project-edits.ts` |
| 1371-1379 | `isCrossfadeVisual` names animation, moves, carousel | `isCrossfadeVisual(item, plugin)`: video, image, card, or a plugin kind with `transitionVisual: true` |
| 1525 | `moveSelectedItems` calls `normalizeProject(next)` | `normalizeProject(next, ctx.plugin)` |
| 1815-1856 (fields scattered through the interface) | `PostItemPatch` has `overlay`, `mode`, `spoken`, `staffEffect`, `animationAppearance`, `cardAppearance`, `qrUrl` | those fields move to the augmentable `PluginItemPatch` |
| 1980-1983 | video `staffEffect` patch, inside the `if (item.kind === "video")` block opened at line 1941 | `editHooks.patchItem`, guarded by `item.kind === "video"` |
| 2006-2030 | animation `overlay`, animation and moves `animationAppearance`, card `cardAppearance`, card `qrUrl` (`isPostCardQrUrl`), moves `mode`, titles `spoken` (`POST_MAX_SPOKEN_LENGTH`) | `editHooks.patchItem` |
| 2337, 2342 | `finish` calls `normalizeProject` | `normalizeProject(next, ctx.plugin)` |
| 2447-2472 | `withKind` builds animation, moves, carousel, titles | `ItemKindDefinition.create` (carousel uses the default) |

`PKG/src/core/edit/context.ts`:

```ts
import type { VideoEditorPlugin } from "../../plugin.js";

export interface EditContext {
	now: number;
	/** The plugin whose kinds and fields the project carries. Required when the project has any. */
	plugin?: VideoEditorPlugin;
}
```

`finish` starts with `assertPluginFor(next, ctx.plugin)`, which throws an `Error` reading "The project carries plugin data (field X or kind Y) but the edit context has no plugin." when `ctx.plugin` is absent and the project has an item kind outside video, image, card and text or a top-level key outside the core project shape. Without it, a plugin-free normalize would strip `sequenceId` and `timings` without a sound (open-items "Every moved caller of `normalizeProject` must take and pass `plugin`").

Additions to `PKG/src/plugin.ts`:

```ts
export interface ItemKindDefinition {
	// ...step 1 members unchanged...
	/**
	 * Builds a new item of this kind for addOverlayItem from the shared base and the Add spec.
	 * Absent: { ...base, kind }.
	 */
	create?: (base: NewItemBase, spec: NewOverlaySpec) => PostItem;
}

export interface VideoEditorPlugin {
	// ...step 1 members unchanged, except alignment, which is removed (open-items option b)...
	/** The project field naming what a project is about. Default "subjectId"; tka "sequenceId". */
	subjectKey?: string;
	/** Plugin behaviour inside the edit engine. */
	editHooks?: EditHooks;
}

export interface EditHooks {
	/** A take points at other media; return the project with plugin data that follows the take. Runs before finish. */
	takeMediaChanged?: (project: PostProject, change: TakeMediaChange, ctx: EditContext) => PostProject;
	/** Applies the plugin's patch fields to next, a copy of item, after the core fields. next is updateItem's `{ ...item } as Record<string, unknown>`. */
	patchItem?: (item: PostItem, next: Record<string, unknown>, patch: PostItemPatch) => void;
}

export type TakeMediaChange =
	| { kind: "replace"; takeId: string; offsetSeconds: number; takeKey: string; durationSeconds: number }
	| { kind: "relink"; takeId: string; ref: PostTake["ref"]; takeKey: string; durationSeconds: number };
```

In `PKG/src/core/project/item-kinds.ts`, beside the step 1 empty interfaces, and re-exported by the core barrel:

```ts
/** Fields a plugin adds to the Add spec (augment it). */
export interface PluginOverlaySpec {}
/** Fields a plugin adds to an item patch (augment it). */
export interface PluginItemPatch {}
```

`PKG/src/core/project/subject.ts`:

```ts
import type { VideoEditorPlugin } from "../../plugin.js";
import type { PostProject } from "./schema.js";

export function subjectKeyOf(plugin?: VideoEditorPlugin): string {
	return plugin?.subjectKey ?? "subjectId";
}

export function subjectOf(project: PostProject, plugin?: VideoEditorPlugin): string | undefined {
	const value = (project as Record<string, unknown>)[subjectKeyOf(plugin)];
	return typeof value === "string" ? value : undefined;
}
```

tka's side (`PLUGIN/edit-hooks.ts`, Task 6): `TKA_EDIT_HOOKS` with `takeMediaChanged` (the two timing branches, moved verbatim from lines 222-250 and 295-320) and `patchItem` (lines 1980-1983 under an `item.kind === "video"` guard, and 2006-2030, moved verbatim); `create` members on the animation (`{ ...base, kind: "animation", overlay: spec.overlay ?? true }`), moves (`{ ...base, kind: "moves", mode: spec.mode ?? "arrows" }`) and titles (spoken sliced to `POST_MAX_SPOKEN_LENGTH`) definitions in `PLUGIN/item-kinds.ts`; `subjectKey: "sequenceId"` and `editHooks: TKA_EDIT_HOOKS` in `create-plugin.ts`; the `declare module "@austencloud/video-editor/core"` block at `PLUGIN/item-kinds.ts` line 38 gains `PluginOverlaySpec` and `PluginItemPatch`; `bound.ts` gains `editContext(now)`:

```ts
/** The edit context tka passes to every edit: the clock and the TKA plugin. */
export function editContext(now: number): EditContext {
  return { now, plugin: tkaPlugin };
}
```

### F. tka's wrapper (`MC/state/post-editor-state.svelte.ts`, Task 11)

`createPostEditorState(deps: PostEditorDeps)` and `PostEditorState = ReturnType<typeof createPostEditorState>` keep their names, their deps (`getSequence`, `initialProject?`, `getCatalogVideo?`, `hasAnimationOverlay?`, `store?`, `now?`) and every member the UI reads. The file keeps exporting `PostEditorMode`, `CatalogTakeSource` (today's line 101; imported by `PostAddPanel`, `PostEditorWorkspace` and `PostMediaPanel`) and `PostEdit` (a type re-export from the package; imported by `PostEditorWorkspace`, `PostItemTool` and `PostKeyframeControls`). It builds:

```ts
const store = deps.store ?? devicePostEditorStore;
const now = deps.now ?? Date.now;
const timing = createPostTimingState({ ...deps, store, now });
const core = createVideoEditorState<PostTimingEffect>(
  {
    get ownerId() {
      return postOwnerId();
    },
    store: editorStoreOf(store),
    translate: tkaEditorTranslate,
    now,
    dev: import.meta.env.DEV,
    previewCache: getPreviewVideoCache(),
  },
  tkaPlugin,
  {
    subjectId: deps.getSequence().id,
    ...(deps.initialProject ? { initialProject: deps.initialProject } : {}),
    libraryTake: (videoId) => deps.getCatalogVideo?.(videoId) ?? null,
    extension: timing.extension,
  },
);
```

`tkaEditorTranslate` maps `editor_default_take` to `t("post_editor_default_take")` and every other key to the exact text tka shows today (for example `editor_save_failed` to `Post Studio could not save this post: {error}`), falling back to `englishString`.

Owned by the wrapper or the timing state (tka code): `sequence`, `moveBeats`, `mode` (get and set; entering `"timing"` calls `core.pause()`), `selectedPart`, `selectTunnel`, `tunnelHook`, `selectedTakeId`, `timing`, `resolvedTiming`, `timingStatus`, `canUndoTiming`, `canRedoTiming`, `editTiming`, `editMappingPreviewAppearance`, `undoTiming`, `redoTiming`, `confirmTiming`, `exitTiming`, `replaceManifestFromDev` (bridge guard, then `core.loadSavedMedia(incoming)` and `core.commit(incoming)`), `addTitles`, `addTunnelHook`, `removeTunnelHook`, `applyTutorial` (split timing, `core.commit(next, effect)`), `applyTemplate`, and these, which wrap a core member: `deleteSelected` (tunnel part selected: remove the tunnel hook; else forward), `removeTake` (forward, then reset `selectedTakeId` as today), `importProject` (forward, then set `selectedTakeId` as today), `addCatalogVideo` (`timing.rememberLegacy(video)`, then `core.addLibraryVideo(video)`), `attachCatalogTakes` (forwards to `core.attachLibraryTakes`), `dispose` (`core.dispose()`, which ends with the extension's `dispose`).

Forwarded unchanged (a getter or a bound function per member): `project`, `snapshot`, `saveError`, `saveRevision`, `saveNow`, `takes`, `takeDisplayLabel`, `images`, `imageUrl`, `compiled`, `durationSeconds`, `frameLayers`, `presentLayers`, `regionRects`, `previewSeconds`, `isPlaying`, `selectedItemId` (get and set; the tunnel part clears through the extension's `selected` hook), `selectedItem`, `canUndo`, `canRedo`, `inGesture`, `inSession`, `splitTarget`, `selectionEditable`, `isLocked`, `takesInUse`, `mediaUrl`, `edit`, `editSetting`, `beginGesture`, `gestureStep`, `endGesture`, `cancelGesture`, `beginSession`, `endSession`, `undo`, `redo`, `trimLive`, `splitAtPlayhead`, `duplicateSelected`, `addOverlay`, `addCard`, `setAudio`, `seedAudio`, `addLocalVideo`, `appendTakeClip`, `relinkLocalTake`, `relinkProjectFiles`, `renameTake`, `adoptSaved`, `seek`, `advance`, `togglePlayback`, `pause`.

A type test in Task 11 pins the surface: `tests/unit/media-composition/post-editor-surface.test.ts` lists every member name above and compares `Object.keys` of a live state with that list at run time (plus `expectTypeOf<keyof PostEditorState>()` against the literal union; tka's type gate does not cover tests, Risks R13), so a member dropped by the split fails the test.

---

## Tasks

### Task 1: Sync, baselines and step tooling (sonnet; opus review)

Closes open-items Standing "Sync main first" (records the procedure) and "Type-gate tooling" (junction prefix and union order), and makes the move list selectable.

**Files:**
- Modify: `PKG/scripts/step1/lib.mjs:16`
- Modify: `PKG/scripts/step1/check-intersection.mjs:19-24`
- Modify: `PKG/test/step1-tools.test.mjs` (two tests appended)
- Create: `PKG/scripts/step2/moves.json`

- [ ] **Step 1: Sync tka main into the branch (the standing first step; redo it the same way at the start of every later step)**

```bash
cd /e/worktrees/tka-platform/video-editor
git status --short                      # must print nothing; stop and report otherwise
git rev-parse --short main HEAD
git merge-base --is-ancestor main HEAD && echo "main already merged"
```

If it prints `main already merged`, go to Step 2. Otherwise merge, never rebase:

```bash
git merge --no-ff main -m "Merge main into codex/video-editor (step 2A sync)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

A conflict in a file the extension moved is resolved by applying main's change to the file's new home (the package file for a moved module, `PLUGIN/` for plugin code), then `git add <path>` per file and `git commit --no-edit`. After a merge, run the package gate, the parity gate and `npm run test:ci`; all must hold as before the merge. The ASCII copies of moved files that main changed are listed in the report.

- [ ] **Step 2: Capture the 2A baselines**

```bash
mkdir -p /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a
cd /e/worktrees/tka-platform/video-editor
npm run check:fast > /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/check-baseline.txt 2>&1; tail -3 /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/check-baseline.txt
npm run test:ci > /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/test-baseline.txt 2>&1; grep -E "Test Files|Tests |Errors" /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/test-baseline.txt
```

Expected: `Found 625 error(s) and 60 warning(s)` (the branch count in step 1's `fix1-check-after.txt`; or the count after a Step 1 merge; record it), and test:ci passing except the two allowed failures. Record both counts in the report. Baseline from TKA at the synced tip: both runs share its junction and generated types (the open-items file asks for a clean main worktree; the synced tip is the same single environment, and `check:fast` already runs svelte-kit sync).

- [ ] **Step 3: Write the failing tool tests**

Append to `PKG/test/step1-tools.test.mjs` (add `import os from "node:os";`, `import { execFileSync } from "node:child_process";` and `import { pathToFileURL } from "node:url";` to its imports if they are missing):

```js
// The type gate: a worktree prints node_modules files through the junction as
// ../../../tka-platform/node_modules/..., and TypeScript may print a union in either order.
test("check-intersection ignores the junction prefix and union order", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intersection-"));
	const baseline = path.join(dir, "baseline.txt");
	const after = path.join(dir, "after.txt");
	fs.writeFileSync(
		baseline,
		[
			"node_modules/@types/three/index.d.ts:10:2",
			`Error: Type '"b" | "a" | Foo<"x" | "y">' is not assignable to type 'C'. (ts2322)`,
			"src/lib/a.ts:1:1",
			`Error: Argument of type '() => void | number' is not assignable. (ts2345)`,
			"Found 2 errors",
		].join(NL),
	);
	fs.writeFileSync(
		after,
		[
			"../../../tka-platform/node_modules/@types/three/index.d.ts:12:4",
			`Error: Type 'Foo<"x" | "y"> | "a" | "b"' is not assignable to type 'C'. (ts2322)`,
			"src/lib/a.ts:3:1",
			`Error: Argument of type '() => void | number' is not assignable. (ts2345)`,
			"Found 2 errors",
		].join(NL),
	);
	const out = execFileSync(process.execPath, [path.join(PKG, "scripts/step1/check-intersection.mjs"), baseline, after], {
		encoding: "utf8",
	});
	assert.match(out, /baseline 2, after 2, new 0/);
});

test("STEP_MOVES selects the move list", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moves-"));
	const list = path.join(dir, "moves.json");
	fs.writeFileSync(list, JSON.stringify({ moves: [{ task: 1, from: "$lib/x", to: "core/x.ts", entry: "@austencloud/video-editor/core" }], splits: [] }));
	const lib = pathToFileURL(path.join(PKG, "scripts/step1/lib.mjs")).href;
	const out = execFileSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(lib)}); console.log(m.table.moves.length, m.MOVES === process.env.STEP_MOVES);`], {
		encoding: "utf8",
		env: { ...process.env, STEP_MOVES: list },
	});
	assert.equal(out.trim(), "1 true");
});
```

`PKG` and `NL` are the constants the test file already uses (if it names them differently, use its names; if it has no `PKG`, add `const PKG = "E:/worktrees/shared-packages/video-editor/packages/video-editor";`).

- [ ] **Step 4: Run them and watch them fail**

Run from PKG: `node --test test/step1-tools.test.mjs`
Expected: the two new tests fail (`new 1` and `undefined true` or a parse error); the existing tests pass.

- [ ] **Step 5: Make the move list selectable**

In `PKG/scripts/step1/lib.mjs`, replace line 16:

```js
export const table = JSON.parse(fs.readFileSync(new URL("./moves.json", import.meta.url), "utf8"));
```

with:

```js
// STEP_MOVES picks the move list: a path relative to this folder (./moves.json is step 1,
// ../step2/moves.json is step 2A) or an absolute path (the node tests use one).
export const MOVES = process.env.STEP_MOVES ?? "./moves.json";
export const table = JSON.parse(
	fs.readFileSync(path.isAbsolute(MOVES) ? MOVES : new URL(MOVES, import.meta.url), "utf8"),
);
```

`ENTRIES` already maps the root entry `@austencloud/video-editor` to `src/index.ts`, so it needs no new entry.

- [ ] **Step 6: Normalize the junction prefix and union order**

In `PKG/scripts/step1/check-intersection.mjs`, replace the `keyOf` definition (lines 19 to 24) with:

```js
// Everything up to the last node_modules/ goes, so a worktree's junction path
// (../../../tka-platform/node_modules/...) and the primary's (node_modules/...) key alike.
const LAST_NODE_MODULES = /^.*node_modules[/]/;

/** A union's members sorted, splitting only at the top level of <>, (), [] and {}. */
function sortUnion(type) {
	const parts = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < type.length; i++) {
		const c = type[i];
		if ("<([{".includes(c)) depth++;
		else if (")]}".includes(c) || (c === ">" && type[i - 1] !== "=")) depth--;
		else if (depth === 0 && type.startsWith(" | ", i)) {
			parts.push(type.slice(start, i));
			start = i + 3;
			i += 2;
		}
	}
	parts.push(type.slice(start));
	return parts.sort().join(" | ");
}

const keyOf = (location, message) =>
	`${location
		.split(BACKSLASH)
		.join("/")
		.replace(PNPM_STORE, "$1@$2")
		.replace(LAST_NODE_MODULES, "node_modules/")} ${message.replace(/'([^']*)'/g, (_, type) => `'${sortUnion(type)}'`)}`
		.replace(/:[0-9]+:[0-9]+/g, "")
		.replace(/[(][0-9]+,[0-9]+[)]/g, "")
		.replace(/[ ]+/g, " ")
		.trim();
```

Write this file with the Write tool or this Edit, never a Bash heredoc. Also extend the header comment: "Paths are cut to their last node_modules/ and the members of every quoted union are sorted, so a junction path or a reordered union is not a new error."

- [ ] **Step 7: Run the tool tests and the real logs**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
node --test test/step1-tools.test.mjs
node scripts/step1/check-intersection.mjs /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/check-baseline.txt /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/check-baseline.txt
node scripts/step1/check-intersection.mjs /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/check-baseline.txt /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a/check-baseline.txt
```

Expected: every node test passes; the step 1 baseline against the 2A baseline prints `new 0` (it printed `new 9` before this task: 8 junction paths and the `Viewer3DScene.svelte:961` union); the 2A baseline against itself prints `baseline 625, after 625, new 0`. If the first still prints a `NEW` line, paste it in the report and fix the normalization, not the baseline.

- [ ] **Step 8: Add the step 2A move list**

Create `PKG/scripts/step2/moves.json` with every entry this plan moves (later tasks only run `move.mjs --task N`):

```json
{
	"moves": [
		{ "task": 5, "from": "$lib/shared/media-composition/services/edit-copy-lookup", "to": "render/edit-copy-lookup.ts", "entry": "@austencloud/video-editor/render" },
		{ "task": 7, "from": "$lib/shared/media-composition/domain/post-music-edits", "to": "core/edit/music-edits.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 7, "from": "$lib/shared/media-composition/domain/post-project-mirror", "to": "core/edit/mirror.ts", "entry": "@austencloud/video-editor/core" },
		{ "task": 12, "from": "$lib/shared/media-composition/state/post-video-previews.svelte", "to": "state/video-previews.svelte.ts", "entry": "@austencloud/video-editor" },
		{ "task": 12, "from": "$lib/shared/media-composition/services/post-tab-sync", "to": "state/tab-sync.ts", "entry": "@austencloud/video-editor" }
	],
	"splits": [
		{ "task": 6, "from": "$lib/shared/media-composition/domain/post-project-edits", "to": "core/edit/project-edits.ts", "routes": ["$lib/shared/media-composition/domain/post-project-edits", "@austencloud/video-editor/core"] },
		{ "task": 9, "from": "$lib/shared/media-composition/services/post-editor-history-store", "to": "store/history-storage.ts", "routes": ["$lib/shared/media-composition/services/post-editor-history-store", "@austencloud/video-editor"] },
		{ "task": 9, "from": "$lib/shared/media-composition/services/post-project-store", "to": "store/device-store.ts", "routes": ["$lib/shared/media-composition/services/post-project-store", "@austencloud/video-editor"] },
		{ "task": 10, "from": "$lib/shared/media-composition/state/post-editor-state.svelte", "to": "state/video-editor-state.svelte.ts", "routes": ["$lib/shared/media-composition/state/post-editor-state.svelte", "@austencloud/video-editor"] }
	]
}
```

Check it parses and every `from` resolves: `STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 5 --dry` from PKG. Expected: one planned copy, no `UNRESOLVED`, nothing written.

- [ ] **Step 9: Gates**

Package gate. No tka file changed (unless Step 1 merged), so the tka gates are the Step 7 runs; after a Step 1 merge, also the parity gate and the test gate.

- [ ] **Step 10: Commit (package)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/scripts/step1/lib.mjs packages/video-editor/scripts/step1/check-intersection.mjs packages/video-editor/test/step1-tools.test.mjs packages/video-editor/scripts/step2/moves.json
git commit -m "chore(video-editor): step 2A move list and a type gate that ignores junction paths and union order" -m "STEP_MOVES selects the move list; check-intersection keys paths from their last node_modules/ and sorts quoted unions." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: Guard the strict core per-kind schemas in tka (haiku; opus review)

Closes open-items Standing "Guard the core per-kind schemas in tka". The core's `PostCardItemSchema` and `PostVideoItemSchema` have no TKA fields; a tka import of either would drop `qrUrl`, `cardAppearance` and `staffEffect` at run time while type-checking cleanly. No tka file imports them today (`grep -rn "PostCardItemSchema\|PostVideoItemSchema" TKA/src TKA/tests TKA/scripts` finds none).

**Files:**
- Modify: `TKA/tests/unit/video-editor-bound-only.test.ts:24-33` and its header comment (lines 1 to 20)

- [ ] **Step 1: Add the names and a detection case**

Replace the `BOUND_ONLY` table (lines 24 to 33) with:

```ts
const BOUND_ONLY: Record<string, string[]> = {
  [CORE_ENTRY]: [
    "createProjectSchema",
    "createEmptyPostProject",
    "defaultBoxFor",
    "normalizeProject",
    "compilePostProject",
    // Strict core schemas without tka's fields. If tka needs a per-kind
    // schema, bound.ts exports one taken from the bound union.
    "PostCardItemSchema",
    "PostVideoItemSchema",
  ],
  [RENDER_ENTRY]: ["evaluatePresetLayers", "evaluatePresetFrame"],
};
```

In the header comment, add one sentence after the list of bound names: "The strict per-kind schemas `PostCardItemSchema` and `PostVideoItemSchema` are bound-only too: they parse without tka's card and video fields."

Add this case inside the existing `describe`, after the case at line 122:

```ts
  it("finds the strict per-kind schemas", () => {
    expect(
      boundNamesIn(
        'import { PostCardItemSchema, PostVideoItemSchema as Video } from "@austencloud/video-editor/core";',
        CORE_ENTRY
      )
    ).toEqual(["PostCardItemSchema", "PostVideoItemSchema"]);
  });
```

If the helper at line 69 is named differently from `boundNamesIn`, use its name (the case at line 122 calls it).

- [ ] **Step 2: Run it**

Run from TKA: `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-bound-only.test.ts`
Expected: `Tests 6 passed (6)` (5 before, plus the new case). The repository scan case still passes, since no file imports either name.

- [ ] **Step 3: Gates**

tka type gate (`new 0`) and parity gate. No package change.

- [ ] **Step 4: Commit (tka)**

```bash
cd /e/worktrees/tka-platform/video-editor
git add tests/unit/video-editor-bound-only.test.ts
git commit -m "test(video-editor): keep the strict core card and video schemas out of tka" -m "A tka import of PostCardItemSchema or PostVideoItemSchema would drop qrUrl, cardAppearance and staffEffect at run time." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: Package test setup, test type-check and the five NEEDS_TKA_SETUP tests (sonnet; opus review)

Closes open-items Step 2 "Vitest `projects`", "Type-check `test/`", "Move the five NEEDS_TKA_SETUP tests in" and "Test housekeeping".

**Decision: vitest `projects`, three of them, all jsdom.** `unit` runs every test as today plus a Blob polyfill; `canvas` runs the two tests written against tka's canvas stand-in, so the stand-in (which replaces `document.createElement`) never touches the 23 existing files; `state` adds the svelte plugin and the `browser` condition for rune modules and runs `*.svelte.test.ts`. A single setup file was rejected because tka's canvas stand-in returns plain objects for every `createElement("canvas")`, which the existing painter and compositor tests do not expect. `render-entry-node.test.ts` keeps its node docblock inside `unit` (vitest honors per-file environment docblocks in projects). 2B adds a fourth project, `browser`, for component tests; nothing here needs restructuring for it. tka's state tests compile `.svelte.ts` through `sveltekit()` in `tests/config/vitest.config.ts` with `resolve.conditions: ["browser"]` (line 120); the `state` project does the same with `@sveltejs/vite-plugin-svelte` ^5.1.1 (plan review, 2026-10-09: the monorepo's major, already in the pnpm store; tka compiles the built `dist` with its own 6.2.4, and runes compile through svelte itself).

**Files:**
- Modify: `PKG/package.json` (devDependency, `check` script)
- Modify: `PKG/vitest.config.ts` (whole file)
- Create: `PKG/tsconfig.test.json`, `PKG/test/setup/blob.ts`, `PKG/test/setup/canvas.ts`, `PKG/test/runes.svelte.test.ts`
- Move from tka: `tests/unit/video-export/CanvasFrameCapturer.test.ts`, `tests/unit/animation-engine/background-encoder-timeout.test.ts`, `tests/unit/media-composition/post-audio-plan.test.ts`, `tests/unit/media-composition/post-audio-track.test.ts`, `tests/unit/media-composition/preview-video-frame-recovery.test.ts` to `PKG/test/` with the same basenames
- Modify: `PKG/scripts/step1/portable-tests.mjs:29-39`
- Modify: the eight lines named in Step 5, `PKG/test/post-studio-export-video-frames.test.ts` and `PKG/test/video-export-codec.test.ts` (docblocks)

- [ ] **Step 1: Add the svelte plugin**

```bash
cd /e/worktrees/shared-packages/video-editor
pnpm --filter @austencloud/video-editor add -D @sveltejs/vite-plugin-svelte@^5.1.1
pnpm ls -r zod --depth 0
pnpm ls -r @sveltejs/vite-plugin-svelte --depth 0
```

Expected: one install, `pnpm ls` shows zod 4.3.6 only (open-items Standing: one zod instance), and every package that lists `@sveltejs/vite-plugin-svelte` shows the same 5.1.x version (one major in the lockfile).

- [ ] **Step 2: The setup files**

`PKG/test/setup/blob.ts`: tka's `tests/setup/vitest-setup.ts` lines 87 to 105 verbatim (the `Blob.prototype.arrayBuffer` polyfill and its comment), with the comment's em dash replaced by a colon.

`PKG/test/setup/canvas.ts`: `import { vi } from "vitest";` followed by tka's `tests/setup/vitest-setup.ts` lines 107 to 190 verbatim (the `ImageData` shim and the `document.createElement` canvas stand-in). Run `node scripts/step1/ascii.mjs test/setup/blob.ts test/setup/canvas.ts` from PKG afterwards.

- [ ] **Step 3: The projects config**

Replace `PKG/vitest.config.ts`:

```ts
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { configDefaults, defineConfig } from "vitest/config";

// The tests written against tka's canvas stand-in (document.createElement("canvas")
// returns a mock with a 2d context). Only they get it.
const CANVAS = ["test/CanvasFrameCapturer.test.ts", "test/preview-video-frame-recovery.test.ts"];
// Rune tests: a test whose name has .svelte. may use runes, and it may import .svelte.ts modules.
const STATE = "test/**/*.svelte.test.ts";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "jsdom",
					include: ["test/**/*.test.ts"],
					exclude: [...configDefaults.exclude, ...CANVAS, STATE],
					setupFiles: ["./test/setup/blob.ts"],
				},
			},
			{
				test: {
					name: "canvas",
					environment: "jsdom",
					include: CANVAS,
					setupFiles: ["./test/setup/blob.ts", "./test/setup/canvas.ts"],
				},
			},
			{
				plugins: [svelte()],
				resolve: { conditions: ["browser"] },
				test: {
					name: "state",
					environment: "jsdom",
					include: [STATE],
					setupFiles: ["./test/setup/blob.ts"],
				},
			},
		],
	},
});
```

`globals: true` is gone (open-items "Test housekeeping": no test relies on it). If a test fails with `describe is not defined`, add the vitest import to that test instead of restoring globals.

- [ ] **Step 4: The rune smoke test (fails until Step 3 is in)**

`PKG/test/runes.svelte.test.ts`:

```ts
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

describe("rune modules in package tests", () => {
	it("tracks $state through $derived", () => {
		let count = $state(1);
		const double = $derived(count * 2);
		expect(double).toBe(2);
		count = 3;
		flushSync();
		expect(double).toBe(6);
	});
});
```

Run from PKG: `npx vitest run --project state`
Expected: `Test Files 1 passed (1)`, `Tests 1 passed (1)`. Run it once with the `plugins` line commented out and confirm it fails with `$state is not defined`, then restore it.

- [ ] **Step 5: Type-check `test/`**

`PKG/tsconfig.test.json`:

```json
{
	"extends": "./tsconfig.json",
	"compilerOptions": {
		"noEmit": true,
		"rootDir": ".",
		"lib": ["ES2023", "DOM", "DOM.Iterable"]
	},
	"include": ["src", "test"]
}
```

In `PKG/package.json`, set `"check": "svelte-check --tsconfig ./tsconfig.json && svelte-check --tsconfig ./tsconfig.test.json"`.

Run from PKG: `npx svelte-check --tsconfig ./tsconfig.test.json`
Expected before fixes: the 8 known errors (open-items "Type-check `test/`": `post-backdrop-painter.test.ts` 47, `post-studio-export-video-frames.test.ts` 34 (`findLastIndex`, fixed by the ES2023 lib), `post-video-color-grade.test.ts` 39, 50, 69 and 80, `text-item-painter.test.ts` 348) plus any in the new setup files and moved tests. Fix each in the test with the narrowest change: a typed local, a non-null assertion right after an `expect(...).toBeDefined()` or `not.toBeNull()` of the same value, or `as unknown as T` only for a test double. List each fix in the report. Expected after: `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 6: Move the five tests**

```bash
cd /e/worktrees/tka-platform/video-editor
for f in tests/unit/video-export/CanvasFrameCapturer.test.ts tests/unit/animation-engine/background-encoder-timeout.test.ts tests/unit/media-composition/post-audio-plan.test.ts tests/unit/media-composition/post-audio-track.test.ts tests/unit/media-composition/preview-video-frame-recovery.test.ts; do cp "$f" /e/worktrees/shared-packages/video-editor/packages/video-editor/test/; done
```

In each copy, rewrite every `@austencloud/video-editor/<entry>` import (and `vi.mock` path) to the relative file that defines each name: find it with `grep -rn "export .*\bNAME\b" src` from PKG and import `../src/<path>.js`. A relative tka helper a test imports is copied into `PKG/test/` beside it and listed in the report. Then `node scripts/step1/ascii.mjs <the five files>` and prettier (new files: `--write`).

In `PKG/scripts/step1/portable-tests.mjs`, empty the table and update its comment (lines 29 to 39):

```js
// Tests that are portable by imports but need tka's setup file. The package has its own setup
// since step 2A (test/setup/), so none are kept back; an entry here names a new one.
const NEEDS_TKA_SETUP = {};
```

- [ ] **Step 7: Housekeeping**

Drop the `@vitest-environment jsdom` docblocks from `PKG/test/post-studio-export-video-frames.test.ts` and `PKG/test/video-export-codec.test.ts` (jsdom is the project default). Format `test/core.test.mjs`, `test/schema-factory.test.ts` and the plain fixture under `test/fixtures/` with the package prettier flags (they are package-owned and hash-free; open-items "Test housekeeping").

- [ ] **Step 8: Run the package suite, then remove the five from tka**

Package gate. Expected: every project passes; vitest files 23 + 5 + 1 = 29; the report gives the test count.

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
node scripts/step1/portable-tests.mjs | grep -E "movers|setup"
cd /e/worktrees/tka-platform/video-editor
git rm tests/unit/video-export/CanvasFrameCapturer.test.ts tests/unit/animation-engine/background-encoder-timeout.test.ts tests/unit/media-composition/post-audio-plan.test.ts tests/unit/media-composition/post-audio-track.test.ts tests/unit/media-composition/preview-video-frame-recovery.test.ts
grep -rn "CanvasFrameCapturer.test\|background-encoder-timeout.test\|post-audio-plan.test\|post-audio-track.test\|preview-video-frame-recovery.test" --include=*.json --include=*.ts --include=*.mjs --include=*.md . | grep -v node_modules | grep -v ceremony-manifest
```

Expected: `portable-tests` lists no setup stays; the grep finds no remaining reference in tka (a hit in a test list or doc is updated in this commit).

- [ ] **Step 9: Gates**

Package gate; tka type gate; parity gate; export smoke (the three-file form); tka test gate subset: `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition tests/unit/video-export tests/unit/animation-engine`.

- [ ] **Step 10: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add pnpm-lock.yaml packages/video-editor/package.json packages/video-editor/vitest.config.ts packages/video-editor/tsconfig.test.json packages/video-editor/test/setup/blob.ts packages/video-editor/test/setup/canvas.ts packages/video-editor/test/runes.svelte.test.ts packages/video-editor/test/CanvasFrameCapturer.test.ts packages/video-editor/test/background-encoder-timeout.test.ts packages/video-editor/test/post-audio-plan.test.ts packages/video-editor/test/post-audio-track.test.ts packages/video-editor/test/preview-video-frame-recovery.test.ts packages/video-editor/scripts/step1/portable-tests.mjs packages/video-editor/test/post-studio-export-video-frames.test.ts packages/video-editor/test/video-export-codec.test.ts packages/video-editor/test/core.test.mjs packages/video-editor/test/schema-factory.test.ts packages/video-editor/test/fixtures
git add <each test file Step 5 fixed, by path>
git commit -m "test(video-editor): vitest projects, a test type-check and the five tests that needed tka's setup" -m "unit, canvas and state projects; tsconfig.test.json in check; CanvasFrameCapturer, background-encoder-timeout, post-audio-plan, post-audio-track and preview-video-frame-recovery move in." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git commit -m "test: five export and audio tests move to @austencloud/video-editor" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(The `git rm` in Step 8 staged the tka removals; add any reference fixed in Step 8 by path before this commit.)

### Task 4: Delete the dead composition state (haiku; opus review)

Closes open-items Step 2 "Delete `media-composition-state.svelte.ts`" (step 1 re-review). The three UI importers use only the `CompositionSourceBinding` type or a context nobody sets.

**Files:**
- Create: `PKG/src/state/source-binding.ts`
- Modify: `PKG/src/index.ts` (one export line)
- Modify: `PS/editor/PostEditorCanvas.svelte:13`, `PS/editor/PostEditorWorkspace.svelte:76`, `PS/PostStudioMediaLayer.svelte` (lines 2, 11, 121, the `setSourceDuration` call near 499, the `bpm` prop near 751)
- Modify: `TKA/tests/unit/media-composition/post-studio-media-layer-harness.svelte.ts:3`, `TKA/tests/unit/media-composition/post-studio-media-layer-lifecycle.test.ts` (the `vi.mock` of the context near line 10)
- Delete: `MC/state/media-composition-state.svelte.ts`, `MC/state/media-composition-context.ts`, `MC/domain/post-studio-slots.ts`, `MC/domain/post-studio-breakdown.ts`, `TKA/tests/unit/media-composition/media-composition-state.test.ts`, `TKA/tests/unit/post-studio-slots.test.ts`, `TKA/tests/unit/media-composition/post-studio-breakdown.test.ts`

- [ ] **Step 1: Confirm the importers**

```bash
cd /e/worktrees/tka-platform/video-editor
grep -rln "media-composition-state\|media-composition-context\|post-studio-slots\|post-studio-breakdown" src scripts tests | grep -v ceremony-manifest
```

Expected: exactly the files in this task's list (the four deleted modules, the three deleted tests, the three UI files, the harness and the lifecycle test). Any other file stops the task: report it; the module it imports stays.

- [ ] **Step 2: The type in the package**

`PKG/src/state/source-binding.ts`:

```ts
import type { MediaSourceKind, PostStudioRenderMode } from "../core/index.js";
import type { PostStudioLayerPainter } from "../render/index.js";

export type CompositionSourceStatus = "ready" | "preparing" | "missing";

/** One media layer's source as the editor canvas binds it. */
export interface CompositionSourceBinding {
	roleKey: string;
	kind: MediaSourceKind;
	label: string;
	previewUrl: string | null;
	previewType?: "video" | "image";
	renderMode?: PostStudioRenderMode;
	/** Draws a `painted` source; preview and export call the same one. */
	painter?: PostStudioLayerPainter;
	durationSeconds?: number;
	/** Original dimensions remain authoritative when a smaller playback copy is used. */
	sourceWidth?: number;
	sourceHeight?: number;
	onPreviewError?: () => void;
	hasAudio?: boolean;
	status: CompositionSourceStatus;
	missingMessage?: string;
}
```

This is today's type, lines 58 to 75 of the dead state, with `CompositionSourceStatus` from its line 47; `PostEditorWorkspace.svelte` builds bindings with `status`, `missingMessage` and `onPreviewError`, and `PostStudioMediaLayer.svelte` calls `binding.onPreviewError`, so no field may be dropped. Compare with the file before deleting it; today's text wins.

Replace the two barrel imports with the defining files before committing (`grep -rn "export type MediaSourceKind\|PostStudioRenderMode =\|interface PostStudioLayerPainter" src` from PKG; the package forbids barrel imports between its own files, and `node scripts/step1/move.mjs --check` enforces it). Add to `PKG/src/index.ts`: `export type { CompositionSourceBinding, CompositionSourceStatus } from "./state/source-binding.js";`

- [ ] **Step 3: Point tka at it and cut the dead context**

- `PostEditorCanvas.svelte:13`, `PostEditorWorkspace.svelte:76`, `PostStudioMediaLayer.svelte:2` and the harness line 3: `import type { CompositionSourceBinding } from "@austencloud/video-editor";`
- `PostStudioMediaLayer.svelte`: delete the line 11 import of `tryGetMediaCompositionContext`, delete `const composition = tryGetMediaCompositionContext();` (line 121), delete the `composition?.setSourceDuration(...)` statement (near line 499; it always ran on null), and change `bpm={composition?.tempoBpm ?? 60}` (near line 751) to `bpm={60}`. Behaviour is unchanged: the context was never set, so every one of these read null.
- `post-studio-media-layer-lifecycle.test.ts`: delete the `vi.mock("$lib/shared/media-composition/state/media-composition-context", ...)` block. If a case asserts `setSourceDuration`, delete that case and name it in the report.

- [ ] **Step 4: Delete**

```bash
cd /e/worktrees/tka-platform/video-editor
git rm src/lib/shared/media-composition/state/media-composition-state.svelte.ts src/lib/shared/media-composition/state/media-composition-context.ts src/lib/shared/media-composition/domain/post-studio-slots.ts src/lib/shared/media-composition/domain/post-studio-breakdown.ts tests/unit/media-composition/media-composition-state.test.ts tests/unit/post-studio-slots.test.ts tests/unit/media-composition/post-studio-breakdown.test.ts
grep -rn "media-composition-state\|media-composition-context\|post-studio-slots\|post-studio-breakdown" src scripts tests | grep -v ceremony-manifest
```

Expected: the grep prints nothing.

- [ ] **Step 5: Gates**

Package gate; tka type gate (errors that lived in the deleted files disappear; nothing new); parity gate; test subset: `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition tests/unit/post-studio`.

- [ ] **Step 6: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/state/source-binding.ts packages/video-editor/src/index.ts
git commit -m "feat(video-editor): CompositionSourceBinding in the root entry" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/share/components/post-studio/editor/PostEditorCanvas.svelte src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte src/lib/shared/share/components/post-studio/PostStudioMediaLayer.svelte tests/unit/media-composition/post-studio-media-layer-harness.svelte.ts tests/unit/media-composition/post-studio-media-layer-lifecycle.test.ts
git commit -m "refactor(post): delete the dead composition state, its context, slots and breakdown" -m "Only the CompositionSourceBinding type was live; it now comes from @austencloud/video-editor. 1,524 lines go." -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: zod out of the preview worker, the edit-copy lookup, and the worker's stray rejection (sonnet; opus review)

Closes open-items Step 2 "Split zod out of the preview worker" and "The worker's uncaught rejection on a failed source", and moves `edit-copy-lookup.ts` (file map).

**Files:**
- Create: `PKG/src/core/edit-copy-manifest.ts`, `PKG/test/worker-closure.test.mjs`
- Modify: `PKG/src/core/preview-video.ts:1,68-82`, `PKG/src/core/index.ts`, `PKG/src/render/index.ts`, `PKG/src/workers/preview-video.worker.ts` (Step 6 only)
- Move: `MC/services/edit-copy-lookup.ts` to `PKG/src/render/edit-copy-lookup.ts`; its tka test to `PKG/test/edit-copy-lookup.test.ts`
- Modify: `MC/get-preview-video-cache.ts`

- [ ] **Step 1: The failing closure test**

`PKG/test/worker-closure.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const IMPORT = /(?:import|export)([^"']*)from[ ]*"([^"]+)"/g;
const RUNTIME_ZOD = /import[ ]+(?!type[ ])[^"']*from[ ]*"zod"/;

/** Every package file a module loads at run time, following relative imports. */
function closure(entry) {
	const seen = new Set();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (seen.has(file)) continue;
		seen.add(file);
		for (const [, clause, spec] of fs.readFileSync(file, "utf8").matchAll(IMPORT)) {
			if (!spec.startsWith(".") || clause.trimStart().startsWith("type ")) continue;
			queue.push(path.resolve(path.dirname(file), spec.replace(/[.]js$/, ".ts")));
		}
	}
	return [...seen];
}

test("the preview worker loads no zod", () => {
	const files = closure(path.join(SRC, "workers", "preview-video.worker.ts"));
	const withZod = files.filter((file) => RUNTIME_ZOD.test(fs.readFileSync(file, "utf8")));
	assert.deepEqual(
		withZod.map((file) => path.relative(SRC, file).split(path.sep).join("/")),
		[],
	);
});
```

Run from PKG: `node --test test/worker-closure.test.mjs`
Expected: FAIL, listing `core/preview-video.ts`.

- [ ] **Step 2: Split the manifest schema**

Move lines 68 to 82 of `PKG/src/core/preview-video.ts` (`EditCopyManifestSchema` and `EditCopyManifest`) with their doc comment into `PKG/src/core/edit-copy-manifest.ts`, which starts with `import { z } from "zod";`. Remove `import { z } from "zod";` from `preview-video.ts` when nothing else in it uses `z`. Add `export * from "./edit-copy-manifest.js";` to `PKG/src/core/index.ts` next to the `preview-video.js` line. Point every package importer of the two names at the new file (`grep -rn "EditCopyManifest" src test`).

Run: `node --test test/worker-closure.test.mjs`. Expected: PASS.

- [ ] **Step 3: Move the lookup**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 5
```

Then by hand in `src/render/edit-copy-lookup.ts`: delete the `isFeatureVideoMediaUrl` import, the two-line comment and the `if (isFeatureVideoMediaUrl(sourceUrl)) return null;` line; import `EditCopyManifestSchema` from `../core/edit-copy-manifest.js` and `editCopyPaths` and `PreparedPreviewVideo` from their defining files (relative, `import type` for the type). Add `export * from "./edit-copy-lookup.js";` to `src/render/index.ts`. Run `ascii.mjs` and prettier on the file, and `node scripts/step1/move.mjs --check` (exit 0).

- [ ] **Step 4: The feature-video skip stays in tka**

`MC/get-preview-video-cache.ts` becomes:

```ts
import {
  PreviewVideoCache,
  PreviewVideoLocalStore,
  findEditCopy,
  renderPreviewVideo,
  type IPreviewVideoCache,
  type PreparedPreviewVideo,
} from "@austencloud/video-editor/render";
import { isFeatureVideoMediaUrl } from "./domain/feature-video";

let instance: IPreviewVideoCache | null = null;

/**
 * The editing copy beside a take's video, if one was prepared. A feature
 * video's media folder holds no editing copies, so its takes skip the two
 * requests.
 */
export function findPreparedPreview(
  sourceUrl: string,
  signal: AbortSignal
): Promise<PreparedPreviewVideo | null> {
  return isFeatureVideoMediaUrl(sourceUrl)
    ? Promise.resolve(null)
    : findEditCopy(sourceUrl, signal);
}

export function getPreviewVideoCache(): IPreviewVideoCache {
  instance ??= new PreviewVideoCache({
    store: new PreviewVideoLocalStore(),
    render: renderPreviewVideo,
    supported: () =>
      typeof Worker !== "undefined" && typeof VideoEncoder !== "undefined",
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
    findPrepared: findPreparedPreview,
  });
  return instance;
}
```

If `PreparedPreviewVideo` is exported from `./core` rather than `./render`, import it from there. Keep the file's existing doc comments.

- [ ] **Step 5: Move the test and switch importers**

```bash
cd /e/worktrees/tka-platform/video-editor
grep -rln "edit-copy-lookup" src scripts tests | grep -v ceremony-manifest
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/rewrite-imports.mjs --task 5
```

Copy the tka test of the lookup to `PKG/test/edit-copy-lookup.test.ts` with its imports pointed at `../src/render/edit-copy-lookup.js`. A case that asserts the feature-video skip moves instead to a new tka test, `tests/unit/media-composition/preview-video-prepared.test.ts`, calling `findPreparedPreview(<the same feature URL>, new AbortController().signal)` and asserting `null` with no fetch (the same `vi.fn` request spy the old case used, passed through `vi.stubGlobal("fetch", spy)`). Then `git rm` the tka module and its old test.

- [ ] **Step 6: The worker's stray rejection**

Reproduce with the step 1 worker proof (open-items "The worker's uncaught rejection on a failed source"; the proof page lives under `PKG/scripts/spike/`, driven by `scripts/spike/cdp.mjs`) using a source URL that 404s. Temporarily add, at the top of `src/workers/preview-video.worker.ts`:

```ts
self.addEventListener("unhandledrejection", (event) => console.error("worker unhandled", event.reason));
```

and read the stack the proof prints. Then fix by where the rejection starts:

- In package code (a promise created in the worker and not awaited): await it inside the existing `try`, or end it with `.catch(() => undefined)` where the error reply has already been posted.
- Inside mediabunny after the error reply (the `UrlSource` prefetch, or a read that `input.dispose()` in the `finally` at line 104 cancels): keep the listener, narrowed to that case: track the source URLs whose failure reply was posted in a `Set`, and in the listener call `event.preventDefault()` only when `String(event.reason)` contains `Error fetching` and that set is not empty; delete the URL from the set when its next request starts.

Rerun the proof. Expected: the error reply arrives once and the console shows no `Uncaught (in promise)`. Put both console captures in the report. Remove the temporary logging.

- [ ] **Step 7: Gates**

Package gate; tka type gate; parity gate; export smoke; test subset `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition`.

- [ ] **Step 8: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/core/edit-copy-manifest.ts packages/video-editor/src/core/preview-video.ts packages/video-editor/src/core/index.ts packages/video-editor/src/render/edit-copy-lookup.ts packages/video-editor/src/render/index.ts packages/video-editor/src/workers/preview-video.worker.ts packages/video-editor/test/worker-closure.test.mjs packages/video-editor/test/edit-copy-lookup.test.ts
git commit -m "feat(video-editor): edit-copy lookup in render; zod leaves the preview worker" -m "EditCopyManifestSchema moves to core/edit-copy-manifest.ts; the worker no longer reports a failed source twice." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/get-preview-video-cache.ts tests/unit/media-composition/preview-video-prepared.test.ts <each importer rewrite-imports changed, by path>
git commit -m "refactor(post): edit-copy lookup comes from @austencloud/video-editor/render" -m "The feature-video skip stays in tka as findPreparedPreview." -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: The edit engine moves to core behind edit hooks (opus implements; opus review)

Implements seam design E. Closes open-items Step 2 "Every moved caller of `normalizeProject` must take and pass `plugin`" for the edit engine (the package test it asks for is Step 1 case 1).

**Files:**
- Create: `PKG/src/core/edit/context.ts`, `PKG/src/core/edit/project-edits.ts` (split), `PKG/src/core/project/subject.ts`, `PKG/test/project-edits.test.ts`, `PLUGIN/edit-hooks.ts`
- Modify: `PKG/src/plugin.ts`, `PKG/src/core/project/item-kinds.ts`, `PKG/src/core/index.ts`
- Modify: `MC/domain/post-project-edits.ts` (keeps lines 471 to 971 only), `PLUGIN/item-kinds.ts` (three `create` members, the augmentation block at line 38), `PLUGIN/create-plugin.ts`, `PLUGIN/bound.ts`, `PLUGIN/index.ts` (export `editContext`)
- Modify: every tka file that builds an edit context (Step 8 finds them) and every importer `rewrite-imports.mjs` changes

- [ ] **Step 1: The failing package tests**

`PKG/test/project-edits.test.ts` (copy the `plugin` helper from `test/schema-factory.test.ts` lines 94 to 105 into it):

```ts
import { describe, expect, it, vi } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import {
	finish,
	isCrossfadeVisual,
	newItemOfKind,
	relinkTake,
	updateItem,
} from "../src/core/edit/project-edits.js";
import type { ItemKindDefinition } from "../src/plugin.js";
import plain from "./fixtures/plain.project.json";

const project = () => normalizeProject(createProjectSchema().parse(plain));
const textId = () => project().tracks.flatMap((track) => track.items).find((item) => item.kind === "text")!.id;

describe("edit engine without a plugin", () => {
	it("refuses to finish a project with plugin data when the context has no plugin", () => {
		const withPluginField = { ...project(), sequenceId: "x" } as ReturnType<typeof project>;
		expect(() => finish(withPluginField, { now: 1 })).toThrow(/edit context has no plugin/);
	});

	it("edits a plain project with the core alone", () => {
		const next = updateItem(project(), textId(), { text: "Hello" }, { now: 2 });
		const item = next.tracks.flatMap((track) => track.items).find((entry) => entry.id === textId());
		expect(item).toMatchObject({ kind: "text", text: "Hello" });
	});
});

describe("edit hooks", () => {
	it("hands the plugin's patch fields to patchItem after the core fields", () => {
		const patchItem = vi.fn();
		const editHooks = { patchItem };
		updateItem(project(), textId(), { text: "Hi" }, { now: 2, plugin: plugin({ editHooks }) });
		expect(patchItem).toHaveBeenCalledOnce();
		const [item, next, patch] = patchItem.mock.calls[0]!;
		expect(item).toMatchObject({ id: textId() });
		expect(next).toMatchObject({ text: "Hi" });
		expect(patch).toEqual({ text: "Hi" });
	});

	it("tells takeMediaChanged about a relinked take", () => {
		const base = project();
		const take = base.takes[0]!;
		const takeMediaChanged = vi.fn((p) => p);
		relinkTake(base, take.id, { ref: take.ref, takeKey: "relinked", durationSeconds: take.durationSeconds }, { now: 3, plugin: plugin({ editHooks: { takeMediaChanged } }) });
		expect(takeMediaChanged).toHaveBeenCalledWith(expect.anything(), { kind: "relink", takeId: take.id, ref: take.ref, takeKey: "relinked", durationSeconds: take.durationSeconds }, expect.objectContaining({ now: 3 }));
	});

	it("builds a plugin kind through its create member", () => {
		const sticker = { kind: "sticker", create: (base: object) => ({ ...base, kind: "sticker", shiny: true }) } as unknown as ItemKindDefinition;
		const item = newItemOfKind({ kind: "sticker", at: 0 } as never, { id: "s1" } as never, plugin({ itemKinds: [sticker] }));
		expect(item).toMatchObject({ id: "s1", kind: "sticker", shiny: true });
	});

	it("crossfades a plugin kind only when it says transitionVisual", () => {
		const still = { kind: "still", transitionVisual: true } as unknown as ItemKindDefinition;
		const label = { kind: "label" } as unknown as ItemKindDefinition;
		const p = plugin({ itemKinds: [still, label] });
		expect(isCrossfadeVisual({ kind: "still" } as never, p)).toBe(true);
		expect(isCrossfadeVisual({ kind: "label" } as never, p)).toBe(false);
		expect(isCrossfadeVisual({ kind: "card" } as never, undefined)).toBe(true);
	});
});
```

Run from PKG: `npx vitest run --project unit test/project-edits.test.ts`
Expected: FAIL, `Failed to resolve import "../src/core/edit/project-edits.js"`.

- [ ] **Step 2: Context, subject and plugin members**

Create `PKG/src/core/edit/context.ts` and `PKG/src/core/project/subject.ts` exactly as in seam design E. Add `PluginOverlaySpec` and `PluginItemPatch` to `PKG/src/core/project/item-kinds.ts` beside the step 1 interfaces. In `PKG/src/plugin.ts` add `create` to `ItemKindDefinition`, `subjectKey` and `editHooks` to `VideoEditorPlugin`, and the `EditHooks` and `TakeMediaChange` types, exactly as in seam design E (the `alignment` member stays until Task 11). `plugin.ts` imports `EditContext`, `NewItemBase`, `NewOverlaySpec` and `PostItemPatch` with `import type` from `./core/edit/project-edits.js` and `./core/edit/context.js`.

- [ ] **Step 3: Copy the engine and cut out the TKA range**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 6
```

In `src/core/edit/project-edits.ts`, delete today's lines 471 to 971 (`addTitlesItem`'s doc comment through the end of `replaceOverlayVideoWithAnimation`; lines 972 to 981, the "Split, delete, duplicate" header and `splitItemAt`'s doc comment, stay). A helper in that range that a remaining function calls stays in the package (check with the package `check`). Every non-exported helper the tka range calls (for example `anchorAt`, `appendToMain`, `withNewTrackOnTop`, `placeOnOrAbove`, `newVideoFields`) is exported; list them in the report (step 3 curates the core surface). Replace the tka imports: `EditContext` from `./context.js`; `defaultBoxFor` and `normalizeProject` from their defining core files; drop the plugin, take-timing and tunnel-titles imports.

- [ ] **Step 4: Apply the hook table**

Work through the table in seam design E row by row:

- `replaceTakeMedia` and `relinkTake`: drop the `timing` lines and the `...(timing ? { timings } : {})` spreads; build the project as before, then `const moved = ctx.plugin?.editHooks?.takeMediaChanged?.(next, change, ctx) ?? next;` and `return finish(moved, ctx);` with `change` `{ kind: "replace", takeId, offsetSeconds: offset, takeKey: replacement.takeKey, durationSeconds }` or `{ kind: "relink", takeId, ref: relink.ref, takeKey: relink.takeKey, durationSeconds }`.
- `NewOverlayKind` and `NewOverlaySpec`: `export type NewOverlayKind = Exclude<PostItem["kind"], "image">;` and `export interface NewOverlaySpec extends PluginOverlaySpec { kind; at; duration?; box?; text?; size?; takeId?; sourceIn?; sourceOut?; fill?; label? }` with today's comments and types for the kept fields.
- `addOverlayItem`: `defaultBoxFor(spec.kind, ctx.plugin)`; `withKind(spec.kind, spec, base)` becomes `newItemOfKind(spec, base, ctx.plugin)`:

```ts
export type NewItemBase = Omit<PostCardItem, "kind">;

/** A new item of the spec's kind: the core's own kinds here, a plugin kind through its create member. */
export function newItemOfKind(
	spec: NewOverlaySpec,
	base: NewItemBase,
	plugin: VideoEditorPlugin | undefined,
): PostItem {
	if (spec.kind === "card") return { ...base, kind: "card" };
	if (spec.kind === "text") {
		return { ...base, kind: "text", text: (spec.text ?? "").slice(0, POST_MAX_TEXT_LENGTH), size: spec.size ?? "m" };
	}
	const definition = plugin?.itemKinds.find((entry) => entry.kind === spec.kind);
	if (!definition) throw new Error(`No item kind "${spec.kind}" in the plugin.`);
	return definition.create ? definition.create(base, spec) : ({ ...base, kind: spec.kind } as PostItem);
}
```

- `isCrossfadeVisual(item, plugin)`: exported; `video`, `image` and `card` are true; otherwise `plugin?.itemKinds.find((entry) => entry.kind === item.kind)?.transitionVisual === true`. Its callers pass `ctx.plugin`.
- `PostItemPatch`: today's interface minus `overlay`, `mode`, `spoken`, `staffEffect`, `animationAppearance`, `cardAppearance` and `qrUrl`, and `extends PluginItemPatch`. In `updateItem`, delete the branches at today's lines 1980-1983 and 2006-2030 and call `ctx.plugin?.editHooks?.patchItem?.(item, next, patch);` right after the last core field is applied (after the `text` block).
- `moveSelectedItems` (line 1525) and `finish` (lines 2337, 2342): `normalizeProject(..., ctx.plugin)`.
- `finish` starts with `assertPluginFor(next, ctx.plugin);`:

```ts
const CORE_KINDS: ReadonlySet<string> = new Set(["video", "image", "card", "text"]);

/** A plugin-free normalize would mangle plugin data, so an edit without the plugin stops here. */
function assertPluginFor(project: PostProject, plugin: VideoEditorPlugin | undefined): void {
	if (plugin) return;
	const field = Object.keys(project).find((key) => !(key in CORE_PROJECT_SHAPE));
	const kind = project.tracks.flatMap((track) => track.items).find((item) => !CORE_KINDS.has(item.kind))?.kind;
	const what = field ? `field ${field}` : kind ? `kind ${kind}` : null;
	if (what) throw new Error(`The project carries plugin data (${what}) but the edit context has no plugin.`);
}
```

(`CORE_PROJECT_SHAPE` is the core project shape step 1 exports from `core/project/`; import it from its defining file.)

Add `export * from "./edit/context.js";`, `export * from "./edit/project-edits.js";` and `export * from "./project/subject.js";` to `src/core/index.ts`. Run `ascii.mjs`, prettier and `node scripts/step1/move.mjs --check`.

Run: `npx vitest run --project unit test/project-edits.test.ts`
Expected: PASS (6 tests). Then the package gate.

- [ ] **Step 5: tka's hooks and kinds**

`PLUGIN/edit-hooks.ts`:

```ts
import type {
  EditHooks,
  PostItem,
  PostItemPatch,
} from "@austencloud/video-editor/core";
import {
  rerecordedTakeTiming,
  shiftTakeTiming,
} from "$lib/shared/media-composition/domain/take-timing";
import { isPostCardQrUrl } from "./card-qr";
import { POST_MAX_SPOKEN_LENGTH } from "./item-kinds";

/** tka's edits inside the engine: a take's timing follows its media, and tka's item fields patch. */
export const TKA_EDIT_HOOKS: EditHooks = {
  takeMediaChanged(project, change, ctx) {
    const timing = project.timings?.[change.takeId];
    if (!timing) return project;
    const next =
      change.kind === "replace"
        ? shiftTakeTiming(
            timing,
            change.offsetSeconds,
            { takeKey: change.takeKey, durationSeconds: change.durationSeconds },
            ctx.now
          )
        : rerecordedTakeTiming(
            timing,
            { ref: change.ref, takeKey: change.takeKey, durationSeconds: change.durationSeconds },
            ctx.now
          );
    return { ...project, timings: { ...project.timings, [change.takeId]: next } };
  },
  patchItem(item: PostItem, next: Record<string, unknown>, patch: PostItemPatch) {
    // Today's lines 1980-1983 (video staffEffect) and 2006-2030 of
    // post-project-edits.ts, moved verbatim with `item` and `next` as named here.
  },
};
```

Fill `patchItem`'s body by moving those two blocks verbatim (the comment above marks where; delete it once they are in). The staffEffect block sits inside today's `if (item.kind === "video")` block (opened at line 1941), so it moves wrapped in `if (item.kind === "video") { ... }`. Import each name from where tka exports it today (`isPostCardQrUrl` from the plugin's `card-qr.ts`; check with grep).

In `PLUGIN/item-kinds.ts`: add `create` to the animation (`(base, spec) => ({ ...base, kind: "animation", overlay: spec.overlay ?? true })`), moves (`(base, spec) => ({ ...base, kind: "moves", mode: spec.mode ?? "arrows" })`) and titles definitions (today's `withKind` titles branch: spoken sliced to `POST_MAX_SPOKEN_LENGTH`, kept only when it has non-space text); carousel keeps the default. In its `declare module "@austencloud/video-editor/core"` block (line 38), add:

```ts
  interface PluginOverlaySpec {
    mode?: PostMovesMode;
    /** A titles clip's "how to say it" line. */
    spoken?: string;
    overlay?: boolean;
    animationAppearance?: PostAnimationItem["animationAppearance"] | null;
    cardAppearance?: PostCardItem["cardAppearance"] | null;
  }
  interface PluginItemPatch {
    overlay?: boolean;
    mode?: PostMovesMode;
    /** A titles clip's "how to say it" line; blank removes it. */
    spoken?: string;
    /** A clip's effect on its staff ends; null removes it. */
    staffEffect?: PostStaffEffectId | null;
    animationAppearance?: PostAnimationItem["animationAppearance"] | null;
    cardAppearance?: PostCardItem["cardAppearance"] | null;
    /** A card's scan link; null removes it. A link that breaks the rule is passed over. */
    qrUrl?: string | null;
  }
```

In `PLUGIN/create-plugin.ts` add `subjectKey: "sequenceId"` and `editHooks: TKA_EDIT_HOOKS`. In `PLUGIN/bound.ts` add `editContext(now)` as in seam design E, and export it from `PLUGIN/index.ts`.

- [ ] **Step 6: Cut tka's file down and route the importers**

`MC/domain/post-project-edits.ts` keeps today's lines 471 to 971 and the imports they need; everything they used from the deleted part comes from `@austencloud/video-editor/core`. Then:

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/rewrite-imports.mjs --task 6
```

Expected: the 33 importers now take generic names from `@austencloud/video-editor/core` and the TKA names from the tka file; no `UNRESOLVED`.

- [ ] **Step 7: Every tka edit context carries the plugin**

```bash
cd /e/worktrees/tka-platform/video-editor
grep -rn "{ now: \|{ now }\|ctx: EditContext = \|: EditContext = {" src scripts tests --include=*.ts --include=*.svelte | grep -v ceremony-manifest
```

Each hit that is passed to an edit (directly, or as the context the state's `edit` hands to a change) becomes `editContext(<the same now>)` imported from `$lib/shared/post-studio-plugin`. In `MC/state/post-editor-state.svelte.ts` that is the context `edit`, `editSetting`, `gestureStep` and the other edit paths build. Hits that are not edit contexts stay; list both groups in the report.

- [ ] **Step 8: Find the contexts the grep missed**

Run from TKA: `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition tests/unit/post-studio tests/unit/video-editor-parity.test.ts`
Expected: no `edit context has no plugin` error. Each one names a missed context: fix it as in Step 7 and rerun until none remain.

- [ ] **Step 9: Gates**

Package gate; tka type gate; parity gate; the full tka test gate (the controller runs it); trace-script gate.

- [ ] **Step 10: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/plugin.ts packages/video-editor/src/core/edit/context.ts packages/video-editor/src/core/edit/project-edits.ts packages/video-editor/src/core/project/subject.ts packages/video-editor/src/core/project/item-kinds.ts packages/video-editor/src/core/index.ts packages/video-editor/test/project-edits.test.ts
git commit -m "feat(video-editor): the edit engine in core, with edit hooks for plugin kinds and fields" -m "ItemKindDefinition.create, VideoEditorPlugin.editHooks and subjectKey; the edit context carries the plugin, and finish refuses plugin data without it." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/domain/post-project-edits.ts src/lib/shared/post-studio-plugin/edit-hooks.ts src/lib/shared/post-studio-plugin/item-kinds.ts src/lib/shared/post-studio-plugin/create-plugin.ts src/lib/shared/post-studio-plugin/bound.ts src/lib/shared/post-studio-plugin/index.ts <each file Steps 6 to 8 changed, by path>
git commit -m "refactor(post): generic edits come from @austencloud/video-editor/core" -m "tka keeps the titles, tunnel and animation-replacement edits; timing and tka item fields ride on the plugin's edit hooks; every edit context carries the TKA plugin." -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: Music edits and the mirror move whole (haiku implements; sonnet review)

**Files:**
- Move: `MC/domain/post-music-edits.ts` to `PKG/src/core/edit/music-edits.ts`; `MC/domain/post-project-mirror.ts` to `PKG/src/core/edit/mirror.ts`
- Modify: `PKG/src/core/index.ts`
- Modify (by `rewrite-imports.mjs`): `MC/domain/post-project-ops.ts`, `PS/editor/PostEditorWorkspace.svelte`, `PS/editor/PostMusicTool.svelte`, `PS/editor/timeline/PostTimelineMusicLane.svelte`, `tests/unit/media-composition/music-tool-harness.svelte.ts`, `tests/unit/media-composition/post-music-edits.test.ts`, `tests/unit/media-composition/post-project-mirror.test.ts`, `tests/unit/media-composition/post-timeline-music-lane.test.ts`

No new test: the three tka tests above cover both modules, run in this task's test gate, and move in Task 13 when they become portable.

- [ ] **Step 1: Move**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 7
```

Expected: two files written under `src/core/edit/`, two tka files deleted.

- [ ] **Step 2: Package imports**

In both copies, the tka imports become relative core imports with no barrel:

```ts
// music-edits.ts
import { finish } from "./project-edits.js";
import type { EditContext } from "./context.js";
import { TAKE_MAX_BPM, TAKE_MIN_BPM } from "../sequence-types.js";
// mirror.ts
import { finish } from "./project-edits.js";
import type { EditContext } from "./context.js";
```

The `@austencloud/video-editor/core` imports become imports from each name's defining file under `src/core/` (find each with `grep -rn "export .*\bNAME\b" src/core`). Then add `export * from "./edit/music-edits.js";` and `export * from "./edit/mirror.js";` to `src/core/index.ts`, and run `ascii.mjs`, prettier and `node scripts/step1/move.mjs --check`.

- [ ] **Step 3: Route the importers**

```bash
STEP_MOVES=../step2/moves.json node scripts/step1/rewrite-imports.mjs --task 7
```

Expected: the eight files above rewritten, no `UNRESOLVED`. The contexts they pass were converted to `editContext(...)` in Task 6 Step 7; confirm with the Task 6 Step 7 grep limited to these eight files (no new edit-context hit).

- [ ] **Step 4: Gates**

Package gate; tka type gate; parity gate; test gate on `tests/unit/media-composition tests/unit/post-studio`; trace-script gate.

- [ ] **Step 5: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/core/edit/music-edits.ts packages/video-editor/src/core/edit/mirror.ts packages/video-editor/src/core/index.ts
git commit -m "feat(video-editor): music edits and the project mirror in core" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/domain/post-music-edits.ts src/lib/shared/media-composition/domain/post-project-mirror.ts src/lib/shared/media-composition/domain/post-project-ops.ts src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte src/lib/shared/share/components/post-studio/editor/PostMusicTool.svelte src/lib/shared/share/components/post-studio/editor/timeline/PostTimelineMusicLane.svelte tests/unit/media-composition/music-tool-harness.svelte.ts tests/unit/media-composition/post-music-edits.test.ts tests/unit/media-composition/post-project-mirror.test.ts tests/unit/media-composition/post-timeline-music-lane.test.ts
git commit -m "refactor(post): music edits and the mirror come from @austencloud/video-editor/core" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: The host contract and the strings table (sonnet implements; opus review)

Implements seam design A and the type half of B, so Task 9 and Task 10 have their types to build on.

**Files:**
- Create: `PKG/src/host.ts` (seam design A, exactly), `PKG/src/store/types.ts` (seam design B's `store/types.ts` block, exactly; Task 9 adds the implementations), `PKG/src/strings/en.ts`, `PKG/src/strings/translate.ts`, `PKG/test/strings.test.ts`
- Modify: `PKG/src/index.ts`
- Create: `MC/state/editor-strings.ts`, `tests/unit/media-composition/editor-strings.test.ts`

The six strings and where today's text lives in `MC/state/post-editor-state.svelte.ts`: save failed (line 368), import busy (770), missing media (796), missing video (823), missing image (837), default take label (1025 and 1043, `t("post_editor_default_take")`). Line 370 (the timing save) and line 919 (the manifest bridge) stay in tka code and keep their literals.

- [ ] **Step 1: The failing package test**

`PKG/test/strings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { englishString, formatString, translatorFor } from "../src/strings/translate.js";

describe("strings", () => {
	it("fills named placeholders and leaves unknown ones", () => {
		expect(formatString("Missing video: {name}", { name: "a.mp4" })).toBe("Missing video: a.mp4");
		expect(formatString("{a} and {b}", { a: 1 })).toBe("1 and {b}");
	});

	it("does not rescan an inserted value", () => {
		expect(formatString("Missing video: {name}", { name: "{error}.mp4" })).toBe("Missing video: {error}.mp4");
	});

	it("falls back to English when the host has no translate", () => {
		expect(translatorFor({})("editor_save_failed", { error: "full" })).toBe("The project could not be saved: full");
		expect(englishString("editor_default_take")).toBe("Take");
	});

	it("uses the host's translate when it has one", () => {
		const translate = translatorFor({ translate: (key) => `<${key}>` });
		expect(translate("editor_missing_image", { name: "x" })).toBe("<editor_missing_image>");
	});
});
```

Run from PKG: `npx vitest run --project unit test/strings.test.ts`
Expected: FAIL, `Failed to resolve import "../src/strings/translate.js"`.

- [ ] **Step 2: The strings, the host and the store types**

`PKG/src/strings/en.ts` (this replaces the seam design's draft: one name per message, as tka throws today):

```ts
/** The editor's English text. Only the keys 2A's moved code needs; 2B grows the table. */
export const EN = {
	editor_default_take: "Take",
	editor_save_failed: "The project could not be saved: {error}",
	editor_import_busy: "Finish the current edit before importing a project.",
	editor_missing_media: "Missing media: {name}",
	editor_missing_video: "Missing video: {name}",
	editor_missing_image: "Missing image: {name}",
} as const;

export type StringKey = keyof typeof EN;
```

`PKG/src/strings/translate.ts`:

```ts
import { EN, type StringKey } from "./en.js";

export type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/** Fills {name} placeholders from params; a missing param leaves the placeholder. */
export function formatString(text: string, params: Record<string, string | number> = {}): string {
	return text.replace(/[{]([a-z_]+)[}]/g, (whole, name: string) =>
		name in params ? String(params[name]) : whole,
	);
}

export function englishString(key: StringKey, params?: Record<string, string | number>): string {
	return formatString(EN[key], params);
}

/** The host's translate, or English. */
export function translatorFor(host: { translate?: Translate }): Translate {
	return (key, params) => host.translate?.(key, params) ?? englishString(key, params);
}
```

`PKG/src/host.ts` is seam design A's block, with `translate?: Translate` imported from `./strings/translate.js` in place of the inline function type. `PKG/src/store/types.ts` is seam design B's block. Append to `PKG/src/index.ts`:

```ts
export type { LibraryTake, MediaLibrary, VideoEditorHost } from "./host.js";
export type {
	EditorHistory,
	HistoryEntry,
	RestoredEditorHistory,
	SaveResult,
	StoreScope,
	VideoEditorStore,
} from "./store/types.js";
export { EN, type StringKey } from "./strings/en.js";
export { englishString, formatString, translatorFor, type Translate } from "./strings/translate.js";
```

Run: `npx vitest run --project unit test/strings.test.ts`
Expected: PASS (4 tests). Then `ascii.mjs`, prettier, `move.mjs --check` and the package gate.

- [ ] **Step 3: tka's text, byte for byte**

`tests/unit/media-composition/editor-strings.test.ts` (write it first; it fails on the missing module):

```ts
import { describe, expect, it } from "vitest";
import { t } from "$lib/shared/i18n/i18n.svelte.js";
import { tkaEditorTranslate } from "$lib/shared/media-composition/state/editor-strings";

describe("tka editor strings", () => {
  it("keeps today's save error", () => {
    expect(tkaEditorTranslate("editor_save_failed", { error: "quota" })).toBe(
      "Post Studio could not save this post: quota"
    );
  });

  it("keeps today's import messages", () => {
    expect(tkaEditorTranslate("editor_import_busy")).toBe(
      "Finish the current edit before importing a post."
    );
    expect(tkaEditorTranslate("editor_missing_media", { name: "a.wav" })).toBe("Missing media: a.wav");
    expect(tkaEditorTranslate("editor_missing_video", { name: "b.mp4" })).toBe("Missing video: b.mp4");
    expect(tkaEditorTranslate("editor_missing_image", { name: "c.png" })).toBe("Missing image: c.png");
  });

  it("names a new take with tka's translation", () => {
    expect(tkaEditorTranslate("editor_default_take")).toBe(t("post_editor_default_take"));
  });
});
```

`MC/state/editor-strings.ts`:

```ts
import {
  englishString,
  formatString,
  type StringKey,
} from "@austencloud/video-editor";
import { t } from "$lib/shared/i18n/i18n.svelte.js";

/** The editor's messages as tka shows them today. */
const TKA_TEXT: Partial<Record<StringKey, string>> = {
  editor_save_failed: "Post Studio could not save this post: {error}",
  editor_import_busy: "Finish the current edit before importing a post.",
  editor_missing_media: "Missing media: {name}",
  editor_missing_video: "Missing video: {name}",
  editor_missing_image: "Missing image: {name}",
};

/** The host translate tka hands the editor (seam design F). */
export function tkaEditorTranslate(
  key: StringKey,
  params?: Record<string, string | number>
): string {
  if (key === "editor_default_take") return t("post_editor_default_take");
  const text = TKA_TEXT[key];
  return text === undefined ? englishString(key, params) : formatString(text, params);
}
```

Rebuild the package (`pnpm --filter @austencloud/video-editor build`), then run from TKA: `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition/editor-strings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Gates**

Package gate; tka type gate; parity gate. Nothing in tka calls the new module until Task 11.

- [ ] **Step 5: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/host.ts packages/video-editor/src/store/types.ts packages/video-editor/src/strings/en.ts packages/video-editor/src/strings/translate.ts packages/video-editor/src/index.ts packages/video-editor/test/strings.test.ts
git commit -m "feat(video-editor): host contract, store port types and the English strings" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/state/editor-strings.ts tests/unit/media-composition/editor-strings.test.ts
git commit -m "feat(post): tka's editor strings for the package host" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 9: The store port and the device store (opus implements; opus review)

Implements seam design B. The owner becomes a parameter (`StoreScope.ownerId`), so the package store has no auth reads; tka computes the owner in `postOwnerId()`.

**Files:**
- Create: `PKG/src/store/device-store.ts` and `PKG/src/store/history-storage.ts` (splits, by `move.mjs --task 9`), `PKG/src/core/deep-equal.ts`, `PKG/test/device-store.test.ts`, `tests/unit/media-composition/post-device-keys.test.ts`
- Modify: `PKG/src/index.ts`
- Modify: `MC/services/post-project-store.ts`, `MC/services/post-editor-history-store.ts`, `MC/services/post-editor-store.ts`

Every name these three tka files export today keeps its name and signature: `loadPostProject`, `savePostProject`, `openPostProject`, `backupPostProjectBeforeImport`, `legacyPostOwner`, `claimLegacyPosts`, `accountPostProjectKeys`, `SaveResult`; `PostTimingEffect`, `PostHistoryEntry`, `PostEditorHistory`, `RestoredPostEditorHistory`, `savePostEditorHistory`, `loadPostEditorHistory`, `createPostEditorHistoryStorage`; `PostEditorStore`, `devicePostEditorStore`. Their 19 importers (`grep -rln "post-project-store\|post-editor-history-store\|post-editor-store" src tests scripts`) do not change. `feature-video-client.ts` keeps `createPostEditorHistoryStorage(prefix)`.

- [ ] **Step 1: Pin tka's keys before anything moves**

`tests/unit/media-composition/post-device-keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TKA_DEVICE_KEYS } from "$lib/shared/media-composition/services/post-project-store";

const P = "tka:post-studio:project:v2:";
const account = { ownerId: "account:u1", subjectId: "seq" };
const guest = { ownerId: "guest", subjectId: "seq" };
const device = { ownerId: "device", subjectId: "seq" };

describe("tka device keys (seam design B table)", () => {
  it("keeps the project keys", () => {
    expect(TKA_DEVICE_KEYS.project(account)).toBe(`${P}account:u1:seq`);
    expect(TKA_DEVICE_KEYS.project(guest)).toBe(`${P}guest:seq`);
    expect(TKA_DEVICE_KEYS.project(device)).toBe(`${P}seq`);
  });

  it("keeps the spare copy keys", () => {
    expect(TKA_DEVICE_KEYS.previous(account)).toBe(`${P}account:u1:seq:previous`);
    expect(TKA_DEVICE_KEYS.previous(guest)).toBe(`${P}guest:seq:previous`);
    expect(TKA_DEVICE_KEYS.previous(device)).toBe(`${P}previous:seq`);
  });

  it("keeps the before-import keys", () => {
    expect(TKA_DEVICE_KEYS.beforeImport(account)).toBe(`${P}account:u1:seq:before-import`);
    expect(TKA_DEVICE_KEYS.beforeImport(guest)).toBe(`${P}before-import:seq`);
    expect(TKA_DEVICE_KEYS.beforeImport(device)).toBe(`${P}before-import:seq`);
  });

  it("keeps the history key", () => {
    expect(TKA_DEVICE_KEYS.history(account)).toBe("tka:post-studio:history:v1:seq");
    expect(TKA_DEVICE_KEYS.history(device)).toBe("tka:post-studio:history:v1:seq");
  });

  it("knows the spare copies", () => {
    expect(TKA_DEVICE_KEYS.isSpareCopy(`${P}account:u1:seq:previous`)).toBe(true);
    expect(TKA_DEVICE_KEYS.isSpareCopy(`${P}previous:seq`)).toBe(true);
    expect(TKA_DEVICE_KEYS.isSpareCopy(`${P}seq`)).toBe(false);
    expect(TKA_DEVICE_KEYS.isSpareCopy("other:previous")).toBe(false);
  });
});
```

Each expected string is what today's code writes: `projectKey` (`post-project-store.ts` line 42), the spare key in `savePostProject` (lines 116 to 119), the key in `backupPostProjectBeforeImport` (lines 27 to 29), `isSpareCopy` (line 92) and `storageKey` (`post-editor-history-store.ts` line 68). Reread those lines before running; if one differs from the test, the test follows today's code and the report says so.

Run from TKA: `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition/post-device-keys.test.ts`
Expected: FAIL, `TKA_DEVICE_KEYS` is not exported.

- [ ] **Step 2: The failing package tests**

`PKG/test/device-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import { createDeviceStore } from "../src/store/device-store.js";
import { createHistoryStorage } from "../src/store/history-storage.js";
import plain from "./fixtures/plain.project.json";

class MemoryStorage implements Storage {
	#items = new Map<string, string>();
	get length(): number {
		return this.#items.size;
	}
	clear(): void {
		this.#items.clear();
	}
	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.#items.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.#items.delete(key);
	}
	setItem(key: string, value: string): void {
		this.#items.set(key, String(value));
	}
}

const scope = { ownerId: "owner-1", subjectId: "seq" };
const project = () => normalizeProject(createProjectSchema().parse(plain));
const device = () => {
	const local = new MemoryStorage();
	const session = new MemoryStorage();
	return { local, session, store: createDeviceStore({ local: () => local, session: () => session }) };
};

describe("device store with no plugin", () => {
	it("opens an empty project for the subject when nothing is saved", () => {
		const { store } = device();
		expect(store.openProject(scope, 5)).toMatchObject({ subjectId: "seq", updatedAt: 5, takes: [] });
	});

	it("saves under the owner and subject, and opens the save again", () => {
		const { local, store } = device();
		expect(store.saveProject(scope, project())).toEqual({ ok: true });
		expect(local.getItem("video-editor:project:owner-1:seq")).toBe(JSON.stringify(project()));
		expect(store.openProject(scope, 9)).toEqual(project());
		expect(store.loadProject({ ownerId: "owner-2", subjectId: "seq" })).toBeNull();
	});

	it("keeps the save before as the spare copy", () => {
		const { local, store } = device();
		const first = project();
		store.saveProject(scope, first);
		store.saveProject(scope, { ...first, updatedAt: first.updatedAt + 1 });
		expect(local.getItem("video-editor:project:owner-1:seq:previous")).toBe(JSON.stringify(first));
	});

	it("refuses a save that belongs to another subject", () => {
		const { local, store } = device();
		local.setItem("video-editor:project:owner-1:seq", JSON.stringify({ ...project(), subjectId: "other" }));
		expect(store.loadProject(scope)).toBeNull();
	});

	it("asks the host's fallback before making an empty project", () => {
		const fallback = { ...project(), updatedAt: 42 };
		const local = new MemoryStorage();
		const store = createDeviceStore({ local: () => local, session: () => null, openFallback: () => fallback });
		expect(store.openProject(scope, 1)).toBe(fallback);
	});

	it("keeps the current project before an import, and says so when storage is missing", () => {
		const { local, store } = device();
		store.backupBeforeImport(scope, project());
		expect(local.getItem("video-editor:project:owner-1:seq:before-import")).toBe(JSON.stringify(project()));
		const none = createDeviceStore({ local: () => null, session: () => null });
		expect(() => none.backupBeforeImport(scope, project())).toThrow(
			"Device storage is unavailable. The current post was kept.",
		);
		expect(none.saveProject(scope, project())).toEqual({ ok: false, error: "Device storage is unavailable." });
	});

	it("keeps undo history in the session store for the same save only", () => {
		const { session, store } = device();
		const head = project();
		const before = { ...head, updatedAt: head.updatedAt - 1 };
		store.saveHistory(scope, { head, past: [{ project: before }], future: [] });
		expect(session.getItem("video-editor:history:owner-1:seq")).not.toBeNull();
		expect(store.loadHistory(scope, head)).toEqual({ past: [{ project: before }], future: [] });
		expect(store.loadHistory(scope, { ...head, updatedAt: head.updatedAt + 1 })).toBeNull();
	});
});

describe("history storage", () => {
	it("names the subject field after the plugin's subject key, in today's position", () => {
		const session = new MemoryStorage();
		const history = createHistoryStorage<{ n: number }>({
			key: (subjectId) => `h:${subjectId}`,
			parseEffect: (value) =>
				value && typeof value === "object" && "n" in value ? (value as { n: number }) : undefined,
			storage: () => session,
		});
		const head = project();
		history.save({ head, past: [{ project: head, effect: { n: 1 } }], future: [] });
		expect(Object.keys(JSON.parse(session.getItem("h:seq")!))).toEqual([
			"version",
			"subjectId",
			"headUpdatedAt",
			"head",
			"headEffect",
			"past",
			"future",
		]);
		expect(history.load(head)?.past).toEqual([{ project: head, effect: { n: 1 } }]);
	});
});
```

Run from PKG: `npx vitest run --project unit test/device-store.test.ts`
Expected: FAIL, `Failed to resolve import "../src/store/device-store.js"`.

- [ ] **Step 3: Copy the two stores into the package**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 9
```

Expected: `src/store/history-storage.ts` and `src/store/device-store.ts` written as copies; the tka files stay (splits).

Create `src/core/deep-equal.ts` with tka's `deepEqual` copied verbatim from `TKA/src/lib/shared/sequence-viewer/services/viewer-url-state-codec.ts` (tabs, strict types; no barrel export).

- [ ] **Step 4: Make the copies generic**

`src/store/history-storage.ts`, against seam design B:
- `PREFIX` and `storageKey` go; the key is `options.key(subjectOf(history.head, options.plugin) ?? "")` on save and `options.key(subjectOf(head, options.plugin) ?? "")` on load. A head with no subject is not kept (return early on save, `null` on load).
- The envelope writes `[subjectKeyOf(options.plugin)]: subject` where it writes `sequenceId` today, in the same position; the parse reads the same field.
- `headContent` drops every field in `options.volatileFields ?? []` instead of `timings`.
- `parseEffect` (today's, line 162) goes; effects go through `options.parseEffect`. When it is absent, stored effects are dropped. When it is present and returns `undefined` for a stored non-null effect (the head's or an entry's), the whole history is void, as today's `parseEntry` (line 185) and `parseHistory` (line 211) return null ("One unreadable step would make Undo skip a state, so it voids the lot").
- `write(store, prefix, key, text)`: the eviction prefix is `options.key("")`, so a full tab still clears only other histories of the same family (today's `tka:post-studio:history:v1:` histories, or one feature video's), never another family's.
- `normalizeProject(entry, options.plugin)` and `createProjectSchema(options.plugin)` replace the bound imports.
- `storage()` becomes `options.storage ?? guardedSessionStorage`, with today's guarded read as the default.
- `FORMAT_VERSION`, `PERSISTED_DEPTH`, `CHARACTER_BUDGET` and the eviction order stay as they are.
- The types become the generic ones from `./types.js`; the tka names go.

`src/store/device-store.ts`, against seam design B:
- Every key comes from `options.keys ?? deviceStoreKeys("video-editor:")`; every `auth` read and `legacyPostOwner` goes (tka keeps them).
- `loadProject(scope)`: today's `loadPostProject` with `createProjectSchema(plugin).safeParse`, the subject check `subjectOf(parsed.data, plugin) !== scope.subjectId`, and `normalizeProject(parsed.data, plugin)`.
- `saveProject(scope, project)`: today's `savePostProject` body with `key = keys.project(scope)`, `spareKey = keys.previous(scope)`, `dropSpareCopies` filtering by `keys.isSpareCopy`. The three error texts stay word for word (2B moves them into the strings table).
- `backupBeforeImport(scope, project)`: writes `keys.beforeImport(scope)`; the missing-storage text stays word for word.
- `openProject(scope, now)`: `loadProject(scope) ?? options.openFallback?.(scope, now) ?? createEmptyPostProject({ now }, { [subjectKeyOf(plugin)]: scope.subjectId })`. The built-in default carries only the subject key; a host whose `projectExtension` has other required fields passes `openFallback` (tka's always returns a project, so the default never runs there; step 3's Ringmaster store passes one too). Say so in the `DeviceStoreOptions.openFallback` doc comment.
- `loadHistory` and `saveHistory`: one `createHistoryStorage({ plugin, key: (subjectId) => keys.history({ ownerId: scope.ownerId, subjectId }), storage: session, ...(parseEffect ? { parseEffect } : {}), ...(volatileFields ? { volatileFields } : {}) })` per call.
- The migration imports (`migratePostPlan`, `loadPostPlan`) go; tka passes them as `openFallback`.

Append to `src/index.ts`:

```ts
export {
	createDeviceStore,
	deviceStoreKeys,
	type DeviceStore,
	type DeviceStoreKeys,
	type DeviceStoreOptions,
} from "./store/device-store.js";
export { createHistoryStorage, type HistoryStorageOptions } from "./store/history-storage.js";
```

Run: `npx vitest run --project unit test/device-store.test.ts`
Expected: PASS (8 tests). Then `ascii.mjs`, prettier, `move.mjs --check`, `forbidden-imports.mjs` (`forbidden imports: 0`) and the package gate.

- [ ] **Step 5: tka's stores become adapters**

`MC/services/post-project-store.ts` keeps `PREFIX`, `CLAIM_KEY`, `legacyPostOwner`, `claimLegacyPosts` and `accountPostProjectKeys` as they are, and adds `postOwnerId` and `TKA_DEVICE_KEYS` exactly as in seam design B. The rest becomes:

```ts
import {
  createDeviceStore,
  type DeviceStoreKeys,
  type SaveResult,
  type StoreScope,
} from "@austencloud/video-editor";
import type { PostProject } from "@austencloud/video-editor/core";
import { createEmptyPostProject, tkaPlugin } from "$lib/shared/post-studio-plugin";
import { migratePostPlan } from "$lib/shared/media-composition/domain/post-project-migration";
import { loadPostPlan } from "$lib/shared/media-composition/services/post-plan-store";
import {
  parsePostTimingEffect,
  type PostTimingEffect,
} from "$lib/shared/media-composition/services/post-editor-history-store";
import { auth } from "$lib/shared/auth/firebase";

export type { SaveResult };

const device = createDeviceStore<PostTimingEffect>({
  plugin: tkaPlugin,
  keys: TKA_DEVICE_KEYS,
  // Today's openPostProject after its loadPostProject call: a v1 plan migrated, else an empty post.
  openFallback: ({ subjectId }, now) => {
    const plan = loadPostPlan(subjectId);
    return plan ? migratePostPlan(plan, { now }) : createEmptyPostProject({ sequenceId: subjectId, now });
  },
  parseEffect: parsePostTimingEffect,
  volatileFields: ["timings"],
});

const scopeFor = (sequenceId: string): StoreScope => ({ ownerId: postOwnerId(), subjectId: sequenceId });

/** Keep the previous edit recoverable across reloads when importing a draft. */
export function backupPostProjectBeforeImport(project: PostProject): void {
  device.backupBeforeImport(scopeFor(project.sequenceId), project);
}

export function loadPostProject(sequenceId: string): PostProject | null {
  return device.loadProject(scopeFor(sequenceId));
}

export function savePostProject(project: PostProject): SaveResult {
  return device.saveProject(scopeFor(project.sequenceId), project);
}

/** The saved v2 project, else a v1 plan migrated, else an empty project. */
export function openPostProject(sequenceId: string, now: number): PostProject {
  return device.openProject(scopeFor(sequenceId), now);
}
```

`tkaPlugin` is the plugin instance `PLUGIN/bound.ts` binds (seam design E's `editContext` uses it); export it from `PLUGIN/index.ts` if it is not already. `DeviceStoreKeys` types `TKA_DEVICE_KEYS`.

`MC/services/post-editor-history-store.ts` keeps its doc comment, `PREFIX`, the `PostTimingEffect` interface and today's `parseEffect` body (renamed `parsePostTimingEffect`, exported, returning `PostTimingEffect | undefined`). The rest becomes:

```ts
export type PostHistoryEntry = HistoryEntry<PostTimingEffect>;
export type PostEditorHistory = EditorHistory<PostTimingEffect>;
export type RestoredPostEditorHistory = RestoredEditorHistory<PostTimingEffect>;

/** The same history kept under another key prefix (a feature video on disk never shares the post's). */
export function createPostEditorHistoryStorage(prefix: string): {
  save(history: PostEditorHistory): void;
  load(head: PostProject): RestoredPostEditorHistory | null;
} {
  return createHistoryStorage<PostTimingEffect>({
    plugin: tkaPlugin,
    key: (sequenceId) => `${prefix}${sequenceId}`,
    parseEffect: parsePostTimingEffect,
    volatileFields: ["timings"],
  });
}

const ordinary = createPostEditorHistoryStorage(PREFIX);

export function savePostEditorHistory(history: PostEditorHistory): void {
  ordinary.save(history);
}

/** The history kept for this post, when it leads up to exactly this save. */
export function loadPostEditorHistory(head: PostProject): RestoredPostEditorHistory | null {
  return ordinary.load(head);
}
```

`MC/services/post-editor-store.ts` keeps `PostEditorStore` and `devicePostEditorStore` as they are and adds the adapter the wrapper hands the package (Task 11):

```ts
/** The package store port over a tka store, which finds its own owner. */
export function editorStoreOf(store: PostEditorStore): VideoEditorStore<PostTimingEffect> {
  return {
    openProject: ({ subjectId }, now) => store.openProject(subjectId, now),
    saveProject: (_scope, project) => store.saveProject(project),
    backupBeforeImport: (_scope, project) => store.backupBeforeImport(project),
    loadHistory: (_scope, head) => store.loadHistory(head),
    saveHistory: (_scope, history) => store.saveHistory(history),
  };
}
```

A test's fake `PostEditorStore` (the nine post-editor tests pass `deps.store`) therefore keeps working unchanged.

- [ ] **Step 6: The tka tests**

Rebuild the package, then run from TKA:

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition/post-device-keys.test.ts tests/unit/media-composition/post-project-store.test.ts tests/unit/media-composition/post-editor-store.test.ts tests/unit/media-composition/post-editor-persistence.test.ts tests/unit/media-composition/post-editor-reload.test.ts tests/unit/media-composition/post-editor-tabs.test.ts tests/unit/media-composition/post-account-local.test.ts tests/unit/media-composition/post-account-cloud.test.ts tests/unit/media-composition/feature-video-bridge.test.ts tests/unit/media-composition/post-project-dev-bridge.test.ts tests/unit/media-composition/post-take-labels.test.ts
```

Expected: all pass, with the counts they had at the 2A baseline (`$SCRATCH/test-baseline.txt`). A failure in a session-history test means the envelope changed: compare the raw `sessionStorage` value against today's field order before touching the test.

- [ ] **Step 7: Gates**

Package gate; tka type gate; parity gate; the full tka test gate (the controller runs it); trace-script gate (`No saved post for .`).

- [ ] **Step 8: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/store/device-store.ts packages/video-editor/src/store/history-storage.ts packages/video-editor/src/core/deep-equal.ts packages/video-editor/src/index.ts packages/video-editor/test/device-store.test.ts
git commit -m "feat(video-editor): device store and session history behind the store port" -m "The owner is a store-call parameter; keys, the open fallback, effects and volatile fields come from the host." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/services/post-project-store.ts src/lib/shared/media-composition/services/post-editor-history-store.ts src/lib/shared/media-composition/services/post-editor-store.ts src/lib/shared/post-studio-plugin/index.ts tests/unit/media-composition/post-device-keys.test.ts
git commit -m "refactor(post): device storage runs on the package store with tka's keys" -m "postOwnerId and TKA_DEVICE_KEYS keep every saved post and session history where it is." -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 10: `createVideoEditorState` in the package (opus implements; opus review)

Implements seam designs C and D on the package side. tka does not change in this task: its state keeps running on its own copy until Task 11 switches it, so every tka gate is the Task 9 result. This task's test is the Ringmaster readiness proof: a host with no plugin creates the state, opens, edits, undoes, saves and reopens a plugin-free project on the device store.

**Files:**
- Create: `PKG/src/state/video-editor-state.svelte.ts` (split, by `move.mjs --task 10`), `PKG/src/core/take-keys.ts`, `PKG/test/video-editor-state.svelte.test.ts`
- Modify: `PKG/src/index.ts`, `PKG/src/core/index.ts`

- [ ] **Step 1: The failing state test (state project, Task 3)**

`PKG/test/video-editor-state.svelte.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createProjectSchema, normalizeProject, updateItem } from "../src/core/index.js";
import type { VideoEditorHost } from "../src/host.js";
import { createVideoEditorState, type StateExtension } from "../src/state/video-editor-state.svelte.js";
import { createDeviceStore } from "../src/store/device-store.js";
import type { PostProject } from "../src/core/project/schema.js";
import plain from "./fixtures/plain.project.json";

class MemoryStorage implements Storage {
	#items = new Map<string, string>();
	get length(): number {
		return this.#items.size;
	}
	clear(): void {
		this.#items.clear();
	}
	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.#items.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.#items.delete(key);
	}
	setItem(key: string, value: string): void {
		this.#items.set(key, String(value));
	}
}

const KEY = "video-editor:project:owner-1:seq";
const saved = () => normalizeProject(createProjectSchema().parse(plain));
const textOf = (project: PostProject) =>
	project.tracks.flatMap((track) => track.items).find((item) => item.kind === "text");

let clock = 10_000;
function hostWith<E = unknown>(local: MemoryStorage, extra: Partial<VideoEditorHost<E>> = {}): VideoEditorHost<E> {
	return {
		ownerId: "owner-1",
		store: createDeviceStore<E>({ local: () => local, session: () => new MemoryStorage() }),
		now: () => ++clock,
		...extra,
	};
}
function seeded(): MemoryStorage {
	const local = new MemoryStorage();
	local.setItem(KEY, JSON.stringify(saved()));
	return local;
}

describe("video editor state with no plugin", () => {
	it("starts an empty project for the subject when nothing is saved", () => {
		const state = createVideoEditorState(hostWith(new MemoryStorage()), undefined, { subjectId: "seq" });
		expect(state.subjectId).toBe("seq");
		expect(state.project).toMatchObject({ subjectId: "seq", takes: [] });
		state.dispose();
	});

	it("opens, edits, undoes, redoes, saves and reopens", () => {
		const local = seeded();
		const state = createVideoEditorState(hostWith(local), undefined, { subjectId: "seq" });
		expect(state.project).toEqual(saved());
		const id = textOf(state.project)!.id;

		expect(state.edit((project, ctx) => updateItem(project, id, { text: "Hi" }, ctx))).toBe(true);
		expect(textOf(state.project)).toMatchObject({ text: "Hi" });
		expect(state.saveError).toBeNull();
		expect(textOf(JSON.parse(local.getItem(KEY)!))).toMatchObject({ text: "Hi" });

		state.undo();
		expect(textOf(state.project)).toEqual(textOf(saved()));
		state.redo();
		expect(textOf(state.project)).toMatchObject({ text: "Hi" });
		state.dispose();

		const reopened = createVideoEditorState(hostWith(local), undefined, { subjectId: "seq" });
		expect(textOf(reopened.project)).toMatchObject({ text: "Hi" });
		reopened.dispose();
	});

	it("gives every edit the context with no plugin", () => {
		const state = createVideoEditorState(hostWith(seeded()), undefined, { subjectId: "seq" });
		expect(state.editContext()).toEqual({ now: expect.any(Number) });
		state.dispose();
	});

	it("reports a failed save in the host's words", () => {
		const local = seeded();
		const base = createDeviceStore({ local: () => local, session: () => new MemoryStorage() });
		const state = createVideoEditorState(
			hostWith(local, {
				store: { ...base, saveProject: () => ({ ok: false, error: "full" }) },
				translate: (key, params) => `${key}:${String(params?.error)}`,
			}),
			undefined,
			{ subjectId: "seq" },
		);
		const id = textOf(state.project)!.id;
		state.edit((project, ctx) => updateItem(project, id, { text: "Hi" }, ctx));
		expect(state.saveError).toBe("editor_save_failed:full");
		state.dispose();
	});
});

describe("state extension", () => {
	it("is built once with the state and hears selection, effects, attached media and dispose", () => {
		const hooks = {
			embed: vi.fn((project: PostProject) => project),
			takeAttached: vi.fn(),
			takeWithoutMedia: vi.fn(),
			selected: vi.fn(),
			replayEffect: vi.fn(),
			dispose: vi.fn(),
		} satisfies StateExtension<{ n: number }>;
		const extension = vi.fn(() => hooks);
		const state = createVideoEditorState<{ n: number }>(hostWith(seeded()), undefined, {
			subjectId: "seq",
			extension,
		});
		expect(extension).toHaveBeenCalledOnce();
		expect(extension).toHaveBeenCalledWith(state);
		expect(hooks.takeAttached.mock.calls.length + hooks.takeWithoutMedia.mock.calls.length).toBe(
			saved().takes.length,
		);

		const id = textOf(state.project)!.id;
		state.selectedItemId = id;
		expect(hooks.selected).toHaveBeenLastCalledWith(id);

		const next = updateItem(state.project, id, { text: "Effect" }, state.editContext());
		expect(state.commit(next, { n: 1 })).toBe(true);
		state.undo();
		expect(hooks.replayEffect).toHaveBeenCalledWith({ n: 1 }, "undo");

		state.dispose();
		expect(hooks.dispose).toHaveBeenCalledOnce();
	});
});
```

Run from PKG: `npx vitest run --project state test/video-editor-state.svelte.test.ts`
Expected: FAIL, `Failed to resolve import "../src/state/video-editor-state.svelte.js"`.

- [ ] **Step 2: Copy the state and the take keys**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 10
```

Expected: `src/state/video-editor-state.svelte.ts` written as a copy; tka's file stays.

`src/core/take-keys.ts` (today's `localTakeKey` and `catalogTakeKey` from `MC/services/take-timing-store.ts` lines 26 to 39; the saved `catalog:` prefix stays because saved takes carry it):

```ts
/** What identifies a local file across reloads. */
export interface LocalTakeIdentity {
	name: string;
	size: number;
	lastModified: number;
}

export function localTakeKey(file: LocalTakeIdentity): string {
	return `local:${file.name}:${file.size}:${file.lastModified}`;
}

/** A library take's key. "catalog:" is the saved format. */
export function libraryTakeKey(videoId: string): string {
	return `catalog:${videoId}`;
}
```

Compare both bodies with today's lines before saving; today's text wins. Add `export * from "./take-keys.js";` to `src/core/index.ts`. tka switches to these in Task 11.

- [ ] **Step 3: Cut the copy down to the generic editor**

Remove from the copy, by name (they move to tka's timing state or wrapper in Task 11): `TIMING_UNDO_DEPTH`; `timings`, `timingUndo`, `timingRedo`, `lastMappingSetting`, `timingTakeId`, `resolved`, `clocks`; `openTiming`, `statusOf`, `replayTiming`, `editTiming`, `writeMappingAppearance`, `editMappingPreviewAppearance`, `currentTakeHistoryEntry`, `applyTakeHistoryEntry`, `undoTiming`, `redoTiming`, `confirmTiming`, `splitTakeTimingAt`; `sequence`, `moveBeats`, `mode`; `selectedPart`, `selectTunnel`, `tunnelHook`, `selectedTakeId`; `addTitles`, `addTunnelHook`, `removeTunnelHook`; `applyTutorial`, `applyTemplate`; `replaceManifestFromDev` (line 914) and its bridge guard; the tunnel branch of `deleteSelected`.

Replace, through the whole copy:

| Today | Package |
| --- | --- |
| `deps: PostEditorDeps` | `host: VideoEditorHost<E>`, `plugin: VideoEditorPlugin \| undefined`, `options: VideoEditorStateOptions<E>` (seam design C) |
| `deps.getSequence().id` | `options.subjectId` |
| `deps.store ?? devicePostEditorStore` and each store call | `const store = host.store ?? createDeviceStore<E>({ plugin })`; every call passes `scope()`, where `const scope = (): StoreScope => ({ ownerId: host.ownerId, subjectId: options.subjectId })` |
| `deps.now ?? Date.now` | `host.now ?? Date.now` |
| `deps.getCatalogVideo(videoId)` (lines 730 and 973) | `options.libraryTake?.(videoId) ?? null` |
| `addCatalogVideo(video: CatalogTakeSource)`, `attachCatalogTakes()` | `addLibraryVideo(video: LibraryTakeSource)`, `attachLibraryTakes()`; `catalogTakeKey` becomes `libraryTakeKey` |
| `t("post_editor_default_take")` (1025, 1043) | `translate("editor_default_take")`, with `const translate = translatorFor(host)` |
| the save failure text (368) | `translate("editor_save_failed", { error: result.error })` |
| the import busy text (770) and the three missing-media texts (796, 823, 837) | `translate("editor_import_busy")`; `translate("editor_missing_media", { name: asset.ref.name })` and the same for video and image |
| `import.meta.env.DEV` | `host.dev === true` |
| bound `compilePostProject`, `normalizeProject`, `PostProjectSchema`, `createEmptyPostProject` from `$lib/shared/post-studio-plugin` | the core functions with `plugin` passed (`createProjectSchema(plugin)` built once) |
| every `{ now: now() }` edit context | `editContext()`, which returns `plugin ? { now: now(), plugin } : { now: now() }` |
| `persistProject(timingError?)` (line 360) | `persist(extraError?: string \| null)`: saves `snapshotFor(project)` (the `snapshot` getter), then `saveError` is the translated failure, else `extraError ?? null` |
| `project.sequenceId` reads | `subjectOf(project, plugin)` |
| `$lib/...` imports of moved modules | relative package imports with no barrel (`move.mjs --check`) |

Add the new members exactly as seam design C marks them N: `subjectId` (getter for `options.subjectId`), `persist`, `commit(next, effect?)` (today's internal commit, now returned; it records `effect` on the undo entry and calls `persist()`), `amend(next)` (sets the project without an undo step, then `persist()`), `editContext()`, `loadSavedMedia(source)` (today's internal function, now returned for the dev manifest bridge).

Wire the extension exactly where seam design D puts each hook:
- `let extension = $state.raw<StateExtension<E> | undefined>(undefined);` declared before the deriveds, so `compiled` and `presentLayers` re-run once it is set.
- `snapshotFor(current)` (line 342): starts from `extension?.embed?.(current) ?? current`.
- `loadSavedMedia(source)`: skips a take when `extension?.takeReady?.(take, source)`; a library take attaches when `options.libraryTake?.(videoId)` answers, else `extension?.takeWithoutMedia?.(take, source)`; a linked take attaches; a local take calls `takeWithoutMedia`.
- `attach(...)` (line 688): sets the media, then `extension?.takeAttached?.(take, source)`; the `legacyStepMap` parameter goes (tka's `rememberLegacy` covers it).
- `removeTake`: `extension?.takeRemoved?.(takeId)` after the take is gone.
- `importProject` (line 765): `const incoming = extension?.prepareImport?.(next, project) ?? next;` before parsing; `extension?.importing?.(parsed)` before the project is replaced.
- `adoptSaved` (line 858): `extension?.adopting?.(next)` before the project is replaced, then today's loop over added takes (lines 888 to 896): a linked take attaches (so `takeAttached` follows); any other added take attaches no media and calls `extension?.takeWithoutMedia?.(take, incoming)`, which is where tka opens its timing today. A library take is not attached here even when `options.libraryTake` answers, as today.
- `undo` and `redo`: in today's order (lines 513-516 and 538-541), `keepSelectionValid`, then `loadSavedMedia()`, then the effect replay, then `persist()`. Undo replays the effect recorded on the project being left (`undone`) with `"undo"`; redo replays the effect recorded on the project being entered (`next`) with `"redo"`: `extension?.replayEffect?.(effect, direction)` when that project has one.
- `compiled`: `compilePostProject(project, { now: project.updatedAt, ...presetIdFor(project), ...extension?.compileContext?.() }, plugin)`, where `presetIdFor` returns `{ presetId: "post-project:" + subject }` when `subjectOf(project, plugin)` is defined, else `{}`.
- `presentLayers`: `evaluatePresetLayers(compiled.preset, compiled.durationSeconds, previewSeconds, extension?.alignment?.() ?? null)`.
- The `selectedItemId` setter: after it validates, `extension?.selected?.(id)` on every set (today's setter at line 1578 clears the tunnel part on every set, even when the id is unchanged). Internal selection changes (`keepSelectionValid`) do not call it, as today.
- `dispose`: today's body, then `extension?.dispose?.()`.
- Construction order: declare the state and the functions, build the returned object, `extension = options.extension?.(state);`, run `loadSavedMedia(project)`, return the object.

Export the interfaces `VideoEditorState`, `VideoEditorStateOptions`, `StateExtension`, `LibraryTakeSource` and the type `PostEdit` from this file exactly as seam designs C and D give them. Append to `src/index.ts`:

```ts
export {
	createVideoEditorState,
	type LibraryTakeSource,
	type PostEdit,
	type StateExtension,
	type VideoEditorState,
	type VideoEditorStateOptions,
} from "./state/video-editor-state.svelte.js";
```

- [ ] **Step 4: Run and gate**

Run: `npx vitest run --project state test/video-editor-state.svelte.test.ts`
Expected: PASS (5 tests). Then `ascii.mjs`, prettier, `move.mjs --check`, `forbidden-imports.mjs` (`forbidden imports: 0`; a `$lib`, `$app` or `import.meta.env` left in the copy fails here) and the package gate.

Check the build output for the runes module: `ls dist/state/video-editor-state.svelte.js` (it must exist, and `grep -c "\$state" dist/state/video-editor-state.svelte.js` must be above 0, because tka's svelte plugin compiles the runes, Risks R6).

- [ ] **Step 5: Commit (package only)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/state/video-editor-state.svelte.ts packages/video-editor/src/core/take-keys.ts packages/video-editor/src/core/index.ts packages/video-editor/src/index.ts packages/video-editor/test/video-editor-state.svelte.test.ts
git commit -m "feat(video-editor): createVideoEditorState, the editor state behind the host contract" -m "Project, history, gestures, sessions, media, selection, playback, import, adopt and save, with plugin state as a per-instance extension. Proven with no plugin on the device store." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 11: tka runs on the package state (opus implements; opus review)

Implements seam design D's tka side and seam design F, and closes open-items "`alignment` provider design" with option (b): the plugin member is dropped and tka builds the alignment in a `$derived` inside its timing state.

**Files:**
- Create: `MC/state/post-timing-state.svelte.ts`, `tests/unit/media-composition/post-editor-surface.test.ts`
- Modify: `MC/state/post-editor-state.svelte.ts` (becomes the wrapper), `MC/services/take-timing-store.ts` (take keys from core)
- Modify: `PKG/src/plugin.ts` (drop `alignment`; `AlignmentProvider` stays in `PKG/src/render/alignment.ts` because tka's `PLUGIN/alignment.ts` returns it)

- [ ] **Step 1: Pin today's surface (passes before the split, must pass after)**

`tests/unit/media-composition/post-editor-surface.test.ts`. Copy the `sequence` fixture, the clock and the `editor()` helper from `tests/unit/media-composition/post-editor-history.test.ts` lines 1 to 30, then:

```ts
const SURFACE = [
  // owned by the wrapper or the timing state
  "sequence", "moveBeats", "mode", "selectedPart", "selectTunnel", "tunnelHook", "selectedTakeId",
  "timing", "resolvedTiming", "timingStatus", "canUndoTiming", "canRedoTiming", "editTiming",
  "editMappingPreviewAppearance", "undoTiming", "redoTiming", "confirmTiming", "exitTiming",
  "replaceManifestFromDev", "addTitles", "addTunnelHook", "removeTunnelHook", "applyTutorial",
  "applyTemplate", "selectedItemId", "deleteSelected", "removeTake", "importProject",
  "addCatalogVideo", "attachCatalogTakes", "dispose",
  // forwarded from the package state
  "project", "snapshot", "saveError", "saveRevision", "saveNow", "takes", "takeDisplayLabel",
  "images", "imageUrl", "compiled", "durationSeconds", "frameLayers", "presentLayers",
  "regionRects", "previewSeconds", "isPlaying", "selectedItem", "canUndo", "canRedo",
  "inGesture", "inSession", "splitTarget", "selectionEditable", "isLocked", "takesInUse",
  "mediaUrl", "edit", "editSetting", "beginGesture", "gestureStep", "endGesture",
  "cancelGesture", "beginSession", "endSession", "undo", "redo", "trimLive", "splitAtPlayhead",
  "duplicateSelected", "addOverlay", "addCard", "setAudio", "seedAudio", "addLocalVideo",
  "appendTakeClip", "relinkLocalTake", "relinkProjectFiles", "renameTake", "adoptSaved", "seek",
  "advance", "togglePlayback", "pause",
] as const;

describe("post editor surface", () => {
  beforeEach(() => localStorage.clear());

  it("keeps every member the UI reads, and no other", () => {
    const state = editor();
    expect(Object.keys(state).sort()).toEqual([...SURFACE].sort());
    expectTypeOf<keyof PostEditorState>().toEqualTypeOf<(typeof SURFACE)[number]>();
    state.dispose();
  });
});
```

(Import `PostEditorState` as a type beside `createPostEditorState`, and `beforeEach`, `describe`, `expect`, `expectTypeOf`, `it` from vitest.)

Run from TKA: `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition/post-editor-surface.test.ts`
Expected: PASS against today's state. If it fails, today's return object (line 1512) is the truth: fix `SURFACE` to match it and list the difference in the report; seam design F's lists change the same way.

- [ ] **Step 2: Drop the `alignment` plugin member**

In `PKG/src/plugin.ts` delete the `alignment?: AlignmentProvider;` member and its comment (lines 71 to 76) and the `AlignmentProvider` import (line 5). Keep the `AlignmentProvider` type in `render/alignment.ts` (line 74): tka's `PLUGIN/alignment.ts` imports it (line 2) as the return type of `createTkaAlignment` (line 125), and `PLUGIN/alignment.ts`'s test `PLUGIN/alignment.test.ts` calls `createTkaAlignment(...).create(project)` in three cases. `FrameAlignment` stays. tka's `create-plugin.ts` never set the member (`grep -n "alignment" PLUGIN/create-plugin.ts` prints nothing), so tka needs no change for this. Package gate.

- [ ] **Step 3: Take keys from core**

In `MC/services/take-timing-store.ts`, replace the local `LocalTakeIdentity`, `localTakeKey` and `catalogTakeKey` definitions with:

```ts
export {
  libraryTakeKey as catalogTakeKey,
  localTakeKey,
  type LocalTakeIdentity,
} from "@austencloud/video-editor/core";
```

and import the same names for the file's own uses. Rebuild the package first.

- [ ] **Step 4: The timing state**

Create `MC/state/post-timing-state.svelte.ts` exporting `createPostTimingState(deps)` with exactly the signature in seam design D, plus `selectedPart`, `selectTunnel` and `tunnelHook` (the tunnel selection lives here so the `selected` hook can clear it). Move into it, verbatim from today's `post-editor-state.svelte.ts`, every timing member seam design D lists, `TIMING_UNDO_DEPTH`, and their imports. Each extension hook is today's code from the place named:

| Hook | Today's code |
| --- | --- |
| `embed` | the timing part of `snapshotFor` (line 342) |
| `takeReady` | the skip in `loadSavedMedia` when the take's timing for its key is already loaded |
| `takeAttached` | the timing open in `attach` (line 688), seeded from the `legacyStepMap` that `rememberLegacy` recorded for that video |
| `takeWithoutMedia` | the timing open for a saved local take, or a catalog take the catalog lacks (lines 730 and 973) |
| `takeRemoved` | the timing cleanup in `removeTake` |
| `prepareImport` | the timings and `sequenceId` rewrite at the top of `importProject` (line 765) |
| `importing` | the retained-timing step in `importProject` |
| `adopting` | the timing merge in `adoptSaved` (line 858) |
| `replayEffect` | `replayTiming(effect, direction)` |
| `alignment` | `$derived(tkaFrameAlignment({ steps, startPlacementDuration: 1, sequencePeriod: sequence.period ?? sequence.orientationCycleCount ?? 1, clocks }))` with today's `steps` and `clocks` |
| `compileContext` | `{ animationOverlay: <today's value in the compiled derived> }` |
| `selected` | clears `selectedPart`, as today's `selectedItemId` setter does |
| `dispose` | nothing: today's `dispose` (line 1500) has no timing teardown, so leave the hook out |

`writeMappingAppearance` goes through `state.amend(next)`; timing saves report through `state.persist(timingError)` with today's text at line 370 (`Post Studio could not save this take's separate timing: ${error}`). Every edit the timing state makes passes `editContext(now())` from `$lib/shared/post-studio-plugin`.

- [ ] **Step 5: The wrapper**

Rewrite `MC/state/post-editor-state.svelte.ts` as seam design F: same `PostEditorDeps`, same `createPostEditorState(deps)` and `PostEditorState`, the construction code from F (`postOwnerId` from `post-project-store`, `editorStoreOf` from `post-editor-store`, `tkaEditorTranslate` from `./editor-strings`, `getPreviewVideoCache` from its current module, `tkaPlugin` from the plugin), and a returned object whose members are F's two lists:
- Forwarded members are a getter (`get project() { return core.project; }`) or a bound function (`edit: core.edit`), one line each.
- `mode` set: entering `"timing"` calls `core.pause()`, then today's body.
- `deleteSelected`: tunnel part selected removes the tunnel hook (today's branch), else `core.deleteSelected()`.
- `removeTake`, `importProject`: forward, then today's `selectedTakeId` handling.
- `addCatalogVideo(video)`: `timing.rememberLegacy(video); return core.addLibraryVideo(video);`. `attachCatalogTakes`: `core.attachLibraryTakes()`.
- `addTitles`, `addTunnelHook`, `removeTunnelHook`, `applyTemplate`: today's bodies, committing through `core.commit(next)` with `editContext(now())`.
- `applyTutorial`: today's body; the timing split through `timing.splitTakeTimingAt`, then `core.commit(next, effect)`.
- `replaceManifestFromDev`: today's bridge guard (line 919 text unchanged, `core.inGesture || core.inSession` for `gestureBase || session`, `core.snapshot` for `snapshotFor(project)`), then `core.loadSavedMedia(incoming)` and `core.commit(incoming)` in that order, as today's lines 964-965.
- `dispose`: `timing.extension` teardown runs from the core's `dispose`, so this is `core.dispose()`.

Nothing else in tka changes: no component, route or test edits in this step.

- [ ] **Step 6: The tka tests, unchanged**

Rebuild the package, then run from TKA:

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition/post-editor-surface.test.ts tests/unit/media-composition/post-editor-add.test.ts tests/unit/media-composition/post-editor-history.test.ts tests/unit/media-composition/post-editor-import.test.ts tests/unit/media-composition/post-editor-persistence.test.ts tests/unit/media-composition/post-editor-reload.test.ts tests/unit/media-composition/post-editor-reload-history.test.ts tests/unit/media-composition/post-editor-store.test.ts tests/unit/media-composition/post-editor-tabs.test.ts tests/unit/media-composition/post-editor-tools.test.ts tests/unit/media-composition/editor-strings.test.ts tests/unit/media-composition/post-device-keys.test.ts tests/unit/video-editor-parity.test.ts
```

Expected: every file passes with its baseline count; parity `Tests 4 passed | 1 skipped (5)`. A failing state test is a behaviour change in the split: fix the split, never the test. If one is truly about an internal name that moved (an import of a removed helper), the report quotes the line and the reviewer approves the one-line import change.

- [ ] **Step 7: Gates**

Package gate; tka type gate; parity gate; the full tka test gate (the controller runs it); the production build (the controller runs it; it is the check that tka's svelte plugin compiles the package's `dist/state/video-editor-state.svelte.js` runes, Risks R6); trace-script gate (`No saved post for .`). Report the line counts: package state, tka timing state, tka wrapper.

- [ ] **Step 8: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/plugin.ts
git commit -m "refactor(video-editor): drop the alignment plugin member" -m "Hosts build the alignment per editor and pass it through the state extension (open item, option b)." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/state/post-editor-state.svelte.ts src/lib/shared/media-composition/state/post-timing-state.svelte.ts src/lib/shared/media-composition/services/take-timing-store.ts tests/unit/media-composition/post-editor-surface.test.ts
git commit -m "refactor(post): the post editor runs on createVideoEditorState" -m "Take timing, the tunnel selection, the Tutorial looks and the manifest bridge stay in tka in post-timing-state; createPostEditorState keeps its surface as a wrapper." -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 12: Video previews and tab sync move (sonnet implements; sonnet review)

Closes open-items "One app-wide `IPreviewVideoCache`" for the previews: the cache becomes a required parameter, so the package never reaches tka's singleton.

**Files:**
- Move: `MC/state/post-video-previews.svelte.ts` to `PKG/src/state/video-previews.svelte.ts`; `MC/services/post-tab-sync.ts` to `PKG/src/state/tab-sync.ts`
- Modify: `PKG/src/index.ts`, `PS/editor/PostEditorWorkspace.svelte` (lines 123, 170, 348, 403), `tests/unit/media-composition/post-video-previews-harness.svelte.ts` (lines 2, 19)

- [ ] **Step 1: Move**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/move.mjs --task 12
```

- [ ] **Step 2: Make both generic**

`src/state/video-previews.svelte.ts`: rename `createPostVideoPreviews` to `createVideoPreviews`; the third parameter becomes required and the `getPreviewVideoCache` import goes:

```ts
export function createVideoPreviews(
	getSources: () => readonly PreviewSource[],
	getPlaying: () => boolean,
	/** The app-wide cache (host.previewCache): one encode queue and one byte budget per app. */
	cache: IPreviewVideoCache,
) {
```

The `IPreviewVideoCache` and `PreviewVideoState` imports become relative (`../render/preview-cache/preview-video-cache-contract.js` and the defining core file).

`src/state/tab-sync.ts`: rename `PostTabSync` to `TabSync` and `createPostTabSync` to `createTabSync`; the first parameter becomes the full channel name:

```ts
export function createTabSync(
	channelName: string,
	adopt: (project: PostProject) => void,
	readSaved: () => PostProject | null,
): TabSync {
```

and the channel is `new BroadcastChannel(channelName)`. Everything else in both files is unchanged. Append to `src/index.ts`:

```ts
export { createVideoPreviews } from "./state/video-previews.svelte.js";
export { createTabSync, type TabSync } from "./state/tab-sync.js";
```

Run `ascii.mjs`, prettier, `move.mjs --check`, `forbidden-imports.mjs` and the package gate.

- [ ] **Step 3: The two callers**

`rewrite-imports.mjs` changes paths, not names, so edit by hand. In `PS/editor/PostEditorWorkspace.svelte`:

```svelte
  import { createTabSync, createVideoPreviews } from "@austencloud/video-editor";
  import { getPreviewVideoCache } from "$lib/shared/media-composition/get-preview-video-cache";
```

replacing the imports at lines 123 and 170 (keep the file's import grouping); at line 348 `createPostVideoPreviews(` becomes `createVideoPreviews(` and gains `getPreviewVideoCache()` as its third argument after the playing getter; at line 403 `createPostTabSync(sequence.id,` becomes:

```svelte
    : createTabSync(
        `tka:post-studio:tabs:${sequence.id}`,
        (project) => editor.adoptSaved(project),
        () => loadPostProject(sequence.id)
      );
```

In `tests/unit/media-composition/post-video-previews-harness.svelte.ts` the import becomes `import { createVideoPreviews } from "@austencloud/video-editor";` and the call `createVideoPreviews(` (it already passes `cache`).

- [ ] **Step 4: Gates**

Rebuild the package. tka type gate; parity gate; test gate on `tests/unit/media-composition/post-video-previews.test.ts tests/unit/media-composition/post-editor-tabs.test.ts` and then `tests/unit/media-composition tests/unit/post-studio`.

- [ ] **Step 5: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/state/video-previews.svelte.ts packages/video-editor/src/state/tab-sync.ts packages/video-editor/src/index.ts
git commit -m "feat(video-editor): video previews and tab sync in the state entry" -m "The preview cache is a required parameter (one app-wide cache per host); the tab channel name comes from the host." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add src/lib/shared/media-composition/state/post-video-previews.svelte.ts src/lib/shared/media-composition/services/post-tab-sync.ts src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte tests/unit/media-composition/post-video-previews-harness.svelte.ts
git commit -m "refactor(post): previews and tab sync come from @austencloud/video-editor" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 13: Portable tests move, and the tka test nits (haiku implements; sonnet review)

Closes open-items "tka-side test nits for the next touch" and the Task 5 review tidy-ups for the copies test and `LegacyStepMap`.

**Files:**
- Move (by `portable-tests.mjs`): the tka tests it reports as portable after Tasks 5 to 12 (expected: `tests/unit/media-composition/post-music-edits.test.ts`, `tests/unit/media-composition/post-timeline-music-lane.test.ts`)
- Modify: the compositor test holding the case "names the layer when a mounted sequence animation has no surface" (`grep -rln "names the layer when a mounted sequence animation" tests`), `tests/unit/video-editor-value-closure.test.ts` (lines 1-11 and the describe title), `tests/unit/video-editor-copies.test.ts`, `PKG/src/core/time-map.ts` (the `LegacyStepMap` comment)

- [ ] **Step 1: Find the portable tests**

```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor
STEP_MOVES=../step2/moves.json node scripts/step1/portable-tests.mjs
```

Expected: the two files above listed as portable; `post-project-mirror.test.ts` listed as a near miss (it imports the plugin) and staying in tka. Any other file it lists is reported, not moved, unless it imports only moved modules and vitest.

- [ ] **Step 2: Move them**

Move each portable test to `PKG/test/` with the same basename (`git mv` is across repositories, so copy into the package and `git rm` in tka), rewrite its imports to relative `../src/...` paths of the defining files, tabs via prettier, then run it in the package: `npx vitest run --project unit test/<name>` (`--project state` for a `.svelte.test.ts`). Expected: the same test count it had in tka at the 2A baseline.

- [ ] **Step 3: The nits**

- The compositor case: replace its loose text match with the label the compositor builds, `compiled.preset.regions.find((r) => r.id === "motion")!.label`, in the `toThrow` matcher.
- `tests/unit/video-editor-value-closure.test.ts`: the header (lines 1-11) and the describe title name both roots, `bound.ts` and `surfaces.ts`.
- `tests/unit/video-editor-copies.test.ts`: beside the `PLAYBACK_MIN_BPM` and `PLAYBACK_MAX_BPM` comparisons, compare `PLAYBACK_BASELINE_BPM`, `PLAYBACK_MIN_SPEED` and `PLAYBACK_MAX_SPEED` the same way.
- `PKG/src/core/time-map.ts`: the `LegacyStepMap` comment says it is a migration input only and points at tka's `getStepIndexFromVideo`.
- In tka's `collaborative-video.ts` (`grep -rln "interface StepMap\|type StepMap" src`), after the `StepMap` declaration:

```ts
// StepMap must stay readable by the package's legacy migration.
type _StepMapIsLegacy = StepMap extends LegacyStepMap ? true : never;
const _stepMapIsLegacy: _StepMapIsLegacy = true;
void _stepMapIsLegacy;
```

with `import type { LegacyStepMap } from "@austencloud/video-editor/core";`. Skip this bullet if the file's lint rules reject the unused-type pattern, and say so.

- [ ] **Step 4: Gates**

Package gate (the moved tests run in it); tka type gate; parity gate; the full tka test gate (the controller runs it). The tka file count drops by the moved tests and the package count rises by the same.

- [ ] **Step 5: Commit (package, then tka)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/test packages/video-editor/src/core/time-map.ts
git commit -m "test(video-editor): music edit and music lane tests run in the package" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
cd /e/worktrees/tka-platform/video-editor
git add tests/unit/media-composition/post-music-edits.test.ts tests/unit/media-composition/post-timeline-music-lane.test.ts tests/unit/video-editor-value-closure.test.ts tests/unit/video-editor-copies.test.ts <the compositor test path> <collaborative-video.ts path>
git commit -m "test(post): portable tests move to the package; step 1 test nits" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(`git add packages/video-editor/test` stages only that folder; list the moved basenames in the report.)

### Task 14: Compositor and exporter fixes, with plugin-free tests (sonnet implements; opus review)

Closes open-items "A painted mode with no painter vanishes silently", "Exporter `finally` order", "Exporter setup runs before `try`", the painter registry null-factory and first-wins cases, and "package compositor and exporter tests with no plugin".

**Files:**
- Modify: `PKG/src/render/frame-compositor.ts` (`drawRegionLayer`, about lines 480-590), `PKG/src/render/post-exporter.ts` (lines 60-160)
- Create or extend: `PKG/test/frame-compositor.test.ts`, `PKG/test/post-exporter.test.ts` (canvas project, Task 3), `PKG/test/painter-registry.test.ts`

- [ ] **Step 1: The failing tests**

Compositor (canvas project), with a plain compiled project (`compilePostProject(normalizeProject(createProjectSchema().parse(plain)), { now: 1, animationOverlay: false })` as `plain-project.test.ts` does) and `renderPostStudioFrame`:
- a frame with the fixture's media and text draws both (the canvas stand-in records a `drawImage` for the media and a `fillText` for the text);
- a layer whose element has `data-render-mode="sequence-animation"` and no surface throws an error naming the layer's region label;
- a layer whose render mode is `"painted"` with no painter for its role throws `No painter for the <label> layer (painted mode).`;
- a surface whose `draw` throws leaves the context balanced: the stand-in's `save` and `restore` counts are equal after the rejection.

Exporter (canvas project), with `exportPostStudioVideo` and a fake surface (`{ renderMode: "x", draw: vi.fn(), release: vi.fn() }`):
- `release` runs once on success, once when a frame throws, and once when the signal aborts;
- a `release` that throws does not stop `videoFrames.dispose()` (spy on `PostStudioExportVideoFrames.prototype.dispose`), and the error the caller sees is the frame's error, not the release's;
- `durationSeconds: 0` rejects with `RangeError("Post duration must be positive")` and still releases the surfaces.

Painter registry (unit project):
- a role no factory answers returns `null`, and a repeated lookup asks the factories again (pin today's behaviour, `painter-registry.ts` line 33);
- two factories answering the same role: the first wins.

Run them. Expected: the registry cases pass (they pin today); the painted, restore and exporter cases fail.

- [ ] **Step 2: Compositor fixes**

In `drawRegionLayer`, after the painter lookup and before `layerElementForClip`, a layer whose render mode is `"painted"` (the preset clip's mode, the `"painted"` member of the union at `core/plan/presets.ts` line 56) with no painter throws:

```ts
throw new Error(`No painter for the ${staticRegion.label ?? layer.sourceRole} layer (painted mode).`);
```

The surface branch (`context.save()` before `surface.draw`) becomes `try { await surface.draw(...) } finally { context.restore(); }`, so a throwing surface leaves the context balanced.

- [ ] **Step 3: Exporter fixes**

In `exportPostStudioVideo`, move the RangeError guard (lines 61-63) and the setup (lines 65-77: canvas, encoder, capturer, `surfaceCache`, `videoFrames`) inside the `try`, declaring `let videoFrames: PostStudioExportVideoFrames | undefined;` before it. The `finally` disposes first and releases each surface on its own:

```ts
} finally {
	videoFrames?.dispose();
	for (const surface of input.surfaces ?? []) {
		try {
			surface.release?.();
		} catch {
			// A failed release must not mask the export's own error.
		}
	}
}
```

- [ ] **Step 4: Run and gate**

Run the three test files. Expected: all pass. Package gate; then in tka the parity gate (the draw logs must not change: these fixes touch error paths only) and the export smoke (`offline-3d-exporter-cancellation`, `export-coordinator-scene-take-lifecycle`, `video-export-orchestrator-init`).

- [ ] **Step 5: Commit (package)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add packages/video-editor/src/render/frame-compositor.ts packages/video-editor/src/render/post-exporter.ts packages/video-editor/test/frame-compositor.test.ts packages/video-editor/test/post-exporter.test.ts packages/video-editor/test/painter-registry.test.ts
git commit -m "fix(video-editor): a painted layer with no painter throws; exporter cleanup always runs" -m "Surface draws restore the context in a finally; the exporter sets up inside try, disposes frames first and isolates each release. Plugin-free compositor, exporter and registry tests." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 15: Final gates, browser proof and the step record (sonnet; the controller runs the browser proof)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md` ("Steps and exit criteria": the 2A record), `docs/superpowers/specs/2026-10-09-video-editor-open-items-after-step-1.md` (closed items marked with the task that closed them)

- [ ] **Step 1: Sync and the full gates**

Sync tka main into the branch (Task 1 Step 1 procedure). Then every gate: package gate; tka type gate (`new 0`); parity (`Tests 4 passed | 1 skipped (5)`); the full `test:ci` (failures only `relaxed-contact-grip` "baseline loop" and `scene-effects-batching-contract`); export smoke; trace script (`No saved post for .`); `forbidden-imports.mjs` (`forbidden imports: 0`); the production build:

```bash
cd /e/worktrees/tka-platform/video-editor
npm run build:packages && node scripts/svelte-kit-sync-if-needed.mjs && node scripts/generate-svg-precache-manifest.cjs && npx cross-env NODE_OPTIONS=--max-old-space-size=8192 NODE_ENV=production vite build
```

Expected: the build finishes with no error. Never `npm run build`.

- [ ] **Step 2: Browser proof on port 5221 (controller)**

Check the port first (`netstat -ano | grep 5221`), then start the `tka-video-editor-worktree` launch.json entry. In the browser:

1. `http://localhost:5221/post?feature=generate-vertical`: the editor opens the feature video; add a text overlay and type into it; Undo removes the typing; Redo puts it back; reload; the text is there and Undo still steps back (session history survived the reload).
2. `http://localhost:5221/post` with a real sequence (pick one from the sequence picker; signed in through the phone over adb or `scripts/spike/cdp.mjs` when the page needs an account): open the post, move a clip, Undo, Redo, wait for the save, reload, the post reopens with the move; open the post list and reopen the same saved post from it.
3. Console: no new errors against the same steps on the 2A baseline commit (record both).

Record each step with a screenshot and the console summary in the report.

- [ ] **Step 3: The step record**

In the design spec, under "Steps and exit criteria", add the 2A record:
- The host contract shipped narrowed: `ownerId`, `store`, `mediaLibrary`, `translate`, `now`, `dev`, `previewCache`; `notify` and `shortcuts` come with 2B's UI.
- Timing load and save are out of `VideoEditorStore`; plugin state rides on `StateExtension` per editor instance.
- `VideoEditorPlugin` gained `subjectKey` and `editHooks`, `ItemKindDefinition` gained `create`, and `alignment` was dropped (option b).
- The step's package and tka commit ranges, the gate outputs and the browser proof.

In the open-items file, mark each item this plan closed with "closed in 2A Task N".

- [ ] **Step 4: Commit (package docs)**

```bash
cd /e/worktrees/shared-packages/video-editor
git add docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md docs/superpowers/specs/2026-10-09-video-editor-open-items-after-step-1.md
git commit -m "docs(video-editor): step 2A record" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Stop the preview server only when the controller says the proof is accepted.

---

## Exit criteria

Step 2A is done when every line below holds on the final commits, each with its output in the Task 15 report:

| Criterion | Check | Expected |
| --- | --- | --- |
| Parity green at every task | `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts` (TKA) | `Tests 4 passed \| 1 skipped (5)` at each task's gate; PARITY_WRITE never set |
| tka's UI unchanged, on the package state and store | `git diff --stat <2A base>..HEAD -- src/lib/shared/share/components/post-studio` (TKA) | only `PostEditorWorkspace.svelte`, `PostEditorCanvas.svelte` and `PostStudioMediaLayer.svelte` (import and call-site edits from Tasks 4 and 12); `grep -n "createVideoEditorState" src/lib/shared/media-composition/state/post-editor-state.svelte.ts` finds the wrapper's call |
| Browser proof | Task 15 Step 2 on port 5221 | open, edit, undo, save, reload and reopen work on `/post?feature=generate-vertical` and on `/post` with a real sequence; no new console errors |
| Moved tests pass in the package | `pnpm --filter @austencloud/video-editor test` | every project passes; the moved and new files are listed in the report |
| tka type gate empty | `node .../check-intersection.mjs "$SCRATCH/check-baseline.txt" "$SCRATCH/check-after.txt"` | `new 0` |
| `test:ci` | the full suite (controller) | failures only `relaxed-contact-grip` "baseline loop" and `scene-effects-batching-contract` |
| Production build | Task 15 Step 1 command | finishes with no error |
| Ringmaster readiness | `npx vitest run --project state test/video-editor-state.svelte.test.ts` and `npx vitest run --project unit test/device-store.test.ts` (PKG) | pass: a host with no plugin creates the state, opens, edits, undoes, saves and reopens a plugin-free project on the device store |
| Trace gate | `npx tsx --tsconfig scripts/tsconfig.json scripts/post-handoff-trace.ts` (TKA) | `No saved post for .` |
| Package hygiene | `node scripts/step1/forbidden-imports.mjs`, `node scripts/step1/move.mjs --check`, `ascii.mjs` (PKG) | `forbidden imports: 0`, no barrel imports, ASCII clean |
| Saved posts and history still open | `tests/unit/media-composition/post-device-keys.test.ts` and the nine post-editor tests (TKA) | pass unchanged |

---

## Risks found while planning

- **R1. ops, looks, the bridge guard and the backup stay in tka.** The brief lists them among the moving modules. `post-project-ops.ts` is the CLI and dev-bridge op language (hooks, titles, animations, feature-video URLs), `post-project-looks.ts` holds the Tutorial preset, `post-project-bridge-guard.ts` names `timings` and feature-video URLs, and `post-project-backup.ts` writes a timing-centric draft format. Moving them now would need more plugin hooks than 2A can prove. They stay in tka (seam design F lists where each lives) and the step record says so; 2B revisits ops with the UI that calls it.
- **R2. Slots and breakdown are deleted, not moved.** `post-studio-slots.ts` and `post-studio-breakdown.ts` are reachable only from the dead `media-composition-state.svelte.ts` (Task 4 Step 1 confirms with a census before any delete). If the census finds a live importer, Task 4 stops and moves that module instead.
- **R3. Commit trailer conflict.** The open-items Standing section says every step commit uses `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; a later system reminder in the planning session named Opus 5.5. The plan follows the Standing section. Decided by the controller at the plan review (2026-10-09): Fable 5.1 on every commit, whatever a harness reminder names.
- **R4. Timing is out of the store port.** The spec's `VideoEditorStore` keeps "timing load and save". This plan moves timing to tka's `StateExtension` so Ringmaster never sees a timing type. The step record (Task 15) records the change; the spec's store section is updated with it.
- **R5. The host contract is narrowed.** `notify` and `shortcuts` arrive in 2B. `mediaLibrary` is declared async, but the 2A state uses the synchronous `options.libraryTake`, because today's catalog lookup is synchronous and the open path cannot await without changing behaviour. 2B decides whether the picker drives the async library.
- **R6. tka must compile the package's runes.** `dist/state/video-editor-state.svelte.js` and `dist/state/video-previews.svelte.js` contain `$state` and `$derived`. tka's svelte plugin must compile them from the linked package in dev and in the production build. Task 10 Step 4 checks the dist file exists with runes; Task 11's production build and Task 15's browser proof are the checks. If vite pre-bundles the package and skips the svelte transform, add `@austencloud/video-editor` to `optimizeDeps.exclude` in tka's vite config (one line, reported).
- **R7. Edit contexts that miss the plugin.** Every tka edit now needs `editContext(now)`. A context built as `{ now }` would let `finish` normalize without the plugin and strip TKA fields. `assertPluginFor` turns that into a thrown error, and Task 6 Steps 7 and 8 hunt the call sites; a miss in code no test reaches would throw at run time, which the Task 15 browser proof exercises on the two main routes.
- **R8. Patch key order.** Moving the TKA patch branches into `editHooks.patchItem` after the core fields can change the key order of a patched item. `finish` normalizes through the plugin's ordered shapes, and the parity gate hashes compiled output, so an order change that matters fails parity at Task 6.
- **R9. The canvas stand-in is isolated.** The moved canvas tests rely on tka's canvas stand-in, which Task 3 copies into its own vitest project so it cannot leak into the unit or state projects.
- **R10. The worker rejection fix depends on the stack.** Task 5 adds temporary logging to find which promise rejects; the fix rule covers the expected `Error fetching` source and the report quotes the stack. If the stack points elsewhere, the fix follows the stack and the reviewer checks it.
- **R11. Surfaces and the memoized text painter wait for 2B.** Their consumers are UI components, so the open items stay open; the step record lists them.
- **R12. Store and message text stays byte for byte.** Saved posts must open after the deploy: `TKA_DEVICE_KEYS` reproduces every key (Task 9 Step 1 pins them before code moves), the history envelope keeps `sequenceId` in its position, and `tkaEditorTranslate` reproduces every message tka tests assert. The device store's three error texts still say "post"; 2B moves them into the strings table.
- **R13. The tka type gate does not cover tests.** tka's tsconfig includes `src/**` only. The surface test in Task 11 therefore checks at run time (`Object.keys`) as well as with `expectTypeOf`, and no task claims the type gate proves something about a test file. The surface test pins member names, not signatures: a signature change in a member a component uses shows up in the type gate through its `src` callers, and a member no `src` file uses has no type check at all. The step record (Task 15) lists this.
