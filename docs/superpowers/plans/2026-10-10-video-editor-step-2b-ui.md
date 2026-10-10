# Video Editor Step 2B (UI, UI Kit, Strings, Icons, PostModule Switch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: complete

**Goal:** Move the post-studio editor UI, the UI kit it leans on, its English strings and its icons from tka-platform into `@austencloud/video-editor`, put every TKA-specific panel, lane, mode, overlay and surface behind the plugin, and switch tka's `PostModule.svelte` to `<VideoEditor host plugin>` from the package.

**Architecture:** Each monolith is split along the plugin seam while it still lives in tka (tka's tests prove nothing moved), then the generic remainder moves into `PKG/src/ui/` with the step 1 move tools and a 2B moves list. The plugin gains an optional `ui` object of Svelte 5 component values and plain functions (`toolPanel`, `parts`, `tools`, `toolRow`, `addItems`, `mediaSublayer`, `modes`, `canvasOverlays`, `panels`) and a `createSurfaces` factory; the host gains `notify`, `shortcuts` and `haptics`; strings come from one package table through `host.translate`; icons are inline SVG through one `Icon.svelte`. PostModule switches last, in one commit.

**Tech Stack:** Svelte 5 (runes, snippets, component values), TypeScript (strict, exactOptionalPropertyTypes, verbatimModuleSyntax), `@fortawesome/free-solid-svg-icons` (icon data only), vitest 4 (jsdom, canvas, state and a new browser project through `@vitest/browser-playwright`), svelte-package, pnpm (shared-packages) and npm (tka-platform).

---

## Step 2B scope and non-goals

The spec's step 2 row ("2 UI") was split in two. Step 2A (done, recorded in the spec under "Step 2A as built") moved the editor state, the edit engine and device persistence into the package and left tka's UI running on the package state through the wrapper `createPostEditorState`. Step 2B, this plan, moves the UI: the generic editor UI, the UI kit it leans on, the English strings and the icons go into the package; every TKA-specific panel, mode, overlay and surface goes behind the plugin; tka's `PostModule.svelte` renders `<VideoEditor host plugin>` from the package. After 2B, step 3 mounts the same component in Ringmaster with no plugin.

Names used below:

- `PKG` is `E:/worktrees/shared-packages/video-editor/packages/video-editor` (branch `video-editor`, HEAD `ba3b555` when this plan was written). `PKGROOT` is the worktree root `E:/worktrees/shared-packages/video-editor`.
- `TKA` is `E:/worktrees/tka-platform/video-editor` (branch `codex/video-editor`, HEAD `32f1ee5675`, which merges tka main `6de9ce8fc6`).
- `PS` is `TKA/src/lib/shared/share/components/post-studio` (the UI that moves or splits).
- `MC` is `TKA/src/lib/shared/media-composition`.
- `PLUGIN` is `TKA/src/lib/shared/post-studio-plugin` (the data plugin from steps 1 and 2A; no Svelte component may enter its value closure, because `bound.ts`, tsx CLI scripts and the server load it).
- `PUI` is `PLUGIN/ui` (new in 2B: the plugin's Svelte UI, imported only by browser code; seam design B).
- `UI` is `PKG/src/ui` (new in 2B: the package's editor UI). `KIT` is `UI/kit`.
- `SCRATCH` is `C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step2b`, created in Task 1, outside both repos.
- `PROOF2A` is `C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step2a` (the 2A gate folder: `task15-proof-feature.mjs` and the `task15-proof-branch/` screenshots).

### In scope

1. **The editor UI into `UI`.** The generic part of `PS` (root, `editor/`, `editor/timeline/`) moves into `UI/` with the step 1 move tools, extended in Task 2 to place `.svelte` files and to rewrite tka's default imports of a moved component. File names stay as they are (`UI/editor/PostItemTool.svelte`), so every move is a reviewable rename; step 3 renames. `builder/` stays in tka (the timing mode). The file map gives every file's fate.
2. **The UI kit.** The helpers the moved UI imports (the spec's names that exist, their own helpers, and `FilterChipBase`, `ChipPopoverOption`, `reparent-to-inspector` and `ExportTakeover`, which the census did not name) are copied into `KIT`. tka keeps its own copies for its many other callers; nothing outside the moved files is rewired. `video-file-metadata` is the `getVideoFileMetadata` function inside tka's `create-video-from-upload.ts`; `trace-rounded-rect` does not exist under `TKA/src` (the package's `render/rounded-rect.ts` already covers it); `deep-equal` is already `PKG/src/core/deep-equal.ts`.
3. **Strings.** `PKG/src/strings/en.ts` becomes the source of every key the package UI uses, under tka's key names, with English text copied from `TKA/messages/en.json`. Components read `t` from a package context; tka passes its `t` through `host.translate`. A new `./strings` subpath lets tka's `editor-strings.ts` stop importing the root entry (`HANDOFF_2B` item 4). The device store's three "post" texts join the table (item 1, 2A risk R12).
4. **Icons.** Every `fa-*` class in the moved UI becomes inline SVG through `KIT/Icon.svelte` fed by `@fortawesome/free-solid-svg-icons`; seam design E has the class-to-icon table. A new `./icons` subpath re-exports the definitions tka's plugin UI hands to package-rendered rows, because tka has no `@fortawesome/*` npm package (it self-hosts the Font Awesome 7.0.1 CSS).
5. **No bits-ui.** Of the two `Popover` uses, `editor/PostAnimationAppearanceTool.svelte` becomes a `PUI` file and keeps bits-ui in tka; `editor/timeline/PostTimelineZoomControls.svelte` moves and gets `KIT/Popover.svelte` (seam design F). `ConfirmDialog`'s bits-ui `Dialog` (imported as `DialogPrimitive`) is replaced in its package copy the same way.
6. **Plugin UI members** on `ItemKindDefinition` (`ui.toolPanel`, `ui.parts`, `ui.icon`) and on `VideoEditorPlugin` (`ui.toolPanel`, `ui.tools`, `ui.toolRow`, `ui.addItems`, `ui.mediaSublayer`, `ui.modes`, `ui.canvasOverlays`, `ui.panels`, `createSurfaces`), all Svelte component values or plain functions, never string names. A missing member renders nothing and logs nothing. The spec's `laneRenderer` is replaced by `ui.parts` (seam design B says why).
7. **Host additions** (2A risk R5, `HANDOFF_2B` item 2): `notify` and `shortcuts`, with the spec's defaults. The `mediaLibrary` decision is in seam design C.
8. **The monolith splits.** `PostEditorWorkspace.svelte` (3,932), `PostEditorCanvas.svelte` (3,302), `PostItemTool.svelte` (1,764), `editor/timeline/PostTimeline.svelte` (2,066) and `PostStudioMediaLayer.svelte` (873) are split along the plugin seam in tka first (tka's tests prove nothing moved), then their generic remainders move.
9. **The PostModule switch**, last and in one task: `PostModule.svelte` and the other three importers of `PostStudio.svelte` render `<VideoEditor>` inside tka's `PUI/TkaEditorScope.svelte`; `PostStudio.svelte` is deleted in the same commit.
10. **Tests.** A `browser` vitest project in the package (vitest browser mode with playwright chromium, shaped like tka's `tests/config/vitest.components.config.ts`). The first component test mounts `<VideoEditor host>` plugin-free (the Ringmaster readiness check for 2B). Plain `.test.ts` files that import only moved `.ts` modules move into the `unit` project through `portable-tests.mjs` and the 2B moves list. The three music harnesses move with the components they drive.
11. **Obligations carried in.** Each task names the `HANDOFF_2B` item (the 2A whole-step review's list, items 1 to 21) or open-items bullet it closes. Items 18 (copy that reads as tka) and 20 (tka issues outside 2B) are recorded in the open-items file by Task 23, not changed in code. Item 21 (the real-sequence browser proof) is part of Task 23. Item 22 (CI runs only `pnpm check`, `.github/workflows/ci.yml:32`; the package's tests and `forbidden-imports.mjs` never run there) is deferred to step 4 and recorded by Task 23: after Task 5 the package `test` script needs a chromium download in CI (`pnpm --filter @austencloud/video-editor exec playwright install chromium`), which belongs with the release workflow change.

### Stays in tka

`PS/builder/*` (the timing mode, rendered through the plugin's `ui.modes` from `PUI`), `MC/state/post-timing-state.svelte.ts`, `take-timing.ts`, `tap-fit.ts`, staff-tip tracking, `PostShareSheet`, `InstagramPostReview`, `meta-publish`, `r2-video-uploader`, everything under `src/lib/features/post/` (PostModule changes only in Task 22), the feature-video backend and CLI, `post-project-ops.ts`, `post-project-bridge-guard.ts`, `post-project-backup.ts`, `post-project-looks.ts`, `post-draft-storage.ts`, `PLUGIN/*`, and the TKA-specific files of `PS`, which become `PUI` files (the sequence, ChoreoCard, tunnel and mandala layers, the animation, card and staff-effect tools, the sequence actions tool, the scoped effects panel, the art context). tka's wrapper `MC/state/post-editor-state.svelte.ts` survives: it is the editor state tka hands `<VideoEditor editor>` (seam design A), it keeps the timing, tunnel and Tutorial members the plugin UI calls, and Task 4 makes it type-check as a `VideoEditorState<PostTimingEffect>`.

**Looks and presets decision.** `post-project-looks.ts` stays in tka and no `looks` or `presets` member joins the plugin contract. The only UI caller is `PostItemTool.svelte`'s "layout" tool for a video (`applyLook` and `lookOf` at lines 69-70, 441, 1237: the Dual, Breakdown and Full looks), and that branch becomes part of the plugin's `ui.toolPanel` in Task 13, which imports `post-project-looks.ts` from `PUI` directly. `applyTutorial` and `applyTemplate` have no caller under `PS` (grep while planning: zero hits); their callers are tka's ops, the dev bridge and the wrapper. A package member with no package consumer would be an untested contract. Task 23 records the decision in the spec.

### Non-goals (step 3 or later finds them here)

- No Ringmaster work, no publishing, no change to either primary checkout, no new features. The spike stays until step 4: its component is renamed `VideoEditorSpike` (Task 3) because `VideoEditor` becomes the real editor, and tka's spike page changes its import in the same task. The Ringmaster worktree's spike page (`E:/worktrees/cirque-aflame/video-editor/ringmaster/src/routes/showcase/video-editor-spike/+page.svelte`, which imports `VideoEditor` from the package root) is not touched; Task 23 adds its one-word import rename to the open-items step 3 list. Until then that page fails to type-check against a fresh package build, which nothing in 2B runs.
- No restyle. The moved UI is tka's UI: same controls, same layout, same behaviour. Where it breaks one of Austen's Ringmaster rules (pills and segmented controls, no `<select>`, no checkboxes, whole-box clicks, `--theme-*` tokens), the file map's notes say so and step 3 changes it.
- Step 3 decides the core card (spec, "The card as built"), moves `DOM_SURFACE_MODES` out of the compositor's vocabulary (2B only rewords its doc comment, Task 6; the set itself and `presetRenderMode`'s read of `POST_STUDIO_SOURCES` wait for step 3, `HANDOFF_2B` item 7), and sweeps the tka wording (`HANDOFF_2B` item 18, recorded by Task 23).
- `post-project-ops.ts`, `post-project-bridge-guard.ts` and `post-project-backup.ts` stay in tka (`HANDOFF_2B` item 16, 2A risk R1 revisited with the UI in hand: no moved file imports the ops or the bridge guard; the workspace's backup download and InShot recovery import are tka actions that move to `PUI` through `ui.panels`, seam design H).
- tka issues outside the editor (`hero-act.test.ts:64` under load, five tka worker chunks with raw `$state(` calls; item 20) are recorded, not fixed.

---

## Ground rules for every task

Copied from the step 2A plan (its lines 59 to 117) and adjusted for 2B. The open-items file's "Standing" section still applies in full; where it and this section differ, the open-items file wins.

- Two worktrees, never a primary checkout. Never edit `E:/tka-platform`, `E:/shared-packages` or `E:/cirque-aflame`.
  - shared-packages: `PKGROOT` (branch `video-editor`), package at `PKG`.
  - tka-platform: `TKA` (branch `codex/video-editor`). Its `node_modules` is a junction into `E:/tka-platform/node_modules`. Never run `npm install`, `npm ci` or `pnpm install` inside TKA and never delete that junction.
  - The Ringmaster worktree (`E:/worktrees/cirque-aflame/video-editor`) is not touched in 2B.
- Installs happen only in `PKGROOT`, and only the controller runs them: `cd /e/worktrees/shared-packages/video-editor && pnpm install`. 2B adds dependencies in two tasks. Task 5 adds devDependencies `@vitest/browser-playwright`, `@vitest/browser` and `vitest-browser-svelte` (4.1.11, 4.1.11, 2.1.1; the package's vitest is ^4.0.16 and already resolves 4.1.11, so the browser packages match the runner without moving it; tka's 4.0.18 set is Task 5's fallback) and `playwright` 1.61.1 (tka's; its chromium is already downloaded for that version on this machine). Task 8 adds dependency `@fortawesome/free-solid-svg-icons` ^7.0.1 (the same Font Awesome major tka self-hosts). Task 10 adds dependencies `wavesurfer.js` 7.12.1 and `realtime-bpm-analyzer` 5.0.0 (tka's versions; the kit's BPM analyzer and, from Task 19, the music lane use them). None of these is in the shared-packages pnpm store today, so each install fetches. The implementer edits `package.json`, stops, and reports; the controller runs the install and the implementer continues.
- Package files: tabs, LF, ASCII only. Moved files are reformatted with `pnpm exec prettier --use-tabs --print-width 100 --write <files>` from `PKGROOT` (prettier formats `.svelte` through `prettier-plugin-svelte`, already a root devDependency; if `--check` reports "No parser could be inferred" for `.svelte`, leave those files in tka's two-space style and name them in the report). Follow the open-items "Prettier" rule: `--check` first, `--write` only files that were clean before plus new files. tka files keep tka's two-space Prettier style. In tka, greps for moved paths exclude `scripts/ceremony-manifest.json`.
- Non-ASCII. `PKG/scripts/step1/ascii.mjs` parses TypeScript, so it handles moved `.ts` files and nothing else; it rewrites in place, so it only ever runs on files already placed in the package, never on tka files. For `.svelte` files, Task 2 extends it to the `<script>` blocks; the markup and `<style>` blocks are fixed by hand following this table, which is the whole census of non-ASCII in `PS` outside `builder/` (about 25 lines; the heaviest are `PostAnimationAppearanceTool` 10, which goes to `PUI` and keeps its characters, `PostItemTool` 3, `PostDraftStatus` 3 and `PostStudioTunnelLayer` 3, which also goes to `PUI`):

  | Where | Character | Replacement |
  | --- | --- | --- |
  | markup text | multiplication sign, middle dot, fractions, arrows, degree sign, single right angle quote, ellipsis, minus sign | the named HTML entity: `&times;` `&middot;` `&frac34;` `&frac12;` `&larr;` `&rarr;` `&deg;` `&rsaquo;` `&hellip;` `&minus;` |
  | markup text | en dash or em dash | `&ndash;` or `&mdash;` only where tka shows it today (the UI keeps its look); comments use a plain hyphen or a comma |
  | script string | any of the above | `String.fromCharCode(<code>)` held in a named const (for example `const TIMES = String.fromCharCode(215);`) |
  | CSS `content:` | any | a CSS escape such as `"[backslash]00d7"`, written with the Write tool, never Edit, never a heredoc |
  | comment | any | ASCII words |

  Never type a backslash-u escape with the Write or Edit tools (they decode it). A file that holds a backslash (regex, CSS escape) is written whole with the Write tool, never through a Bash heredoc (the Bash tool halves backslashes). The code in this plan uses character classes such as `[.]` and `[/]` where it can; the regexes in Tasks 1 and 2 that need a whitespace class, and the escaped pipes in markdown tables, are the exceptions, and the files holding such regexes are written with the Write tool.
- No em dashes, no en dashes and no emojis in any file this plan creates, in any comment or in any commit message. The single exception is the markup entity row above, which keeps what tka shows on screen.
- Commit with explicit pathspecs only. Never `git add -A`, never `git add .`, never stash, never `git checkout --`, never `reset --hard`. A file leaving tka is removed with `git rm <path>` in the same commit that switches its importers. A file moving inside tka (into `PUI`) uses `git mv`.
- Every commit message ends with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (open-items, Standing, "Commit trailer"), even when a harness reminder names another model.
- A task that changes both repos commits the package first, then tka. The tka commit body names the package commit (`Package: video-editor@<short hash>`).
- Relative imports inside the package end in `.js` for TypeScript modules and keep `.svelte` for components; type-only imports use `import type`. Package files import each other by relative path, never through an entry barrel (`node PKG/scripts/step1/move.mjs --check` exits 0).
- Seam rules (open-items, Standing): core never names a tka kind or field; nothing in `src/core` imports `src/state`, `src/store` or `src/ui`; `src/ui` may import `src/core`, `src/render`, `src/state`, `src/store` and `src/strings`; `src/plugin.ts` is imported with `import type` only; a schema field change changes the matching `order` array in the same commit.
- The package never imports `$lib`, `$app`, `$env`, `firebase`, `bits-ui`, `modern-screenshot`, `@fortawesome/fontawesome-free` or any tka path, and no package `src` file holds an `fa-` class string. Gate: `node PKG/scripts/step1/forbidden-imports.mjs` prints `forbidden imports: 0` and, from Task 1 on, `fa- classes: 0` (Task 1 adds the second count; it reads 0 at every task, because Task 17 converts the icons while the files are still in tka). In moved code, `import.meta.env.DEV` becomes `host.dev`; `t()` becomes the strings context (seam design D); `fa-*` becomes `<Icon>` (seam design E); a toast becomes `host.notify`; a keyboard registration becomes `host.shortcuts`.
- Plugin UI rule: nothing under `PLUGIN` outside `PUI` imports a `.svelte` file or a `.svelte.ts` module, and nothing under `PUI` is imported from `PLUGIN/index.ts`, `bound.ts` or `create-plugin.ts`. Gate (run from TKA): `grep -rlE "from [^ ]*[.]svelte" src/lib/shared/post-studio-plugin --include=*.ts | grep -v "/ui/"` prints nothing. tka's `tests/unit/video-editor-bound-only.test.ts` keeps passing (it guards the server closure).
- One svelte-check and one build at a time across all sessions. Before either, confirm at least 4096 MB free and no other `svelte-check` running (PowerShell):
  ```powershell
  [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'svelte-check|svelte-fast-check' } | Select-Object ProcessId, CommandLine
  ```
  Run builds, checks and test suites from Bash with `timeout: 600000`.
- Kill only processes you started, by PID. Ports 3000, 1871 and 5173 belong to Austen; 9222 and 9333 are his browsers. The browser test project launches its own headless chromium through playwright and never attaches to 9222 or 9333. The dev servers of 2B are Task 1's accessibility baseline (Step 2a) and Task 23's browser proof, both on port 5221 (launch.json entry `tka-video-editor-worktree`), started and stopped by the controller.
- The parity test is frozen: never set `PARITY_WRITE`, never edit `tests/unit/video-editor-parity.test.ts`, its harness or its fixtures. A parity failure stops the task. **What parity proves and what it does not:** it hashes load, normalize, compile and render of fixed projects, so it proves the data path the UI sits on did not change. It runs no edits and renders no UI, so it says nothing about whether a panel opens, a button still edits, a lane draws or the editor looks the same. Those are proved by the component tests (browser project), tka's own component and unit tests, and the browser proof in Task 23 with screenshots compared to `PROOF2A/task15-proof-branch/`.
- "Behaves and looks the same" is the rule for every UI move. A moved component keeps its markup, its classes and its `<style>` block byte for byte except for the substitutions this plan names (imports, `t`, icons, non-ASCII and `--ve-*` tokens, all made in tka by Tasks 16 and 17 before a file moves, so the move itself is a rename plus import paths). A reviewer diffs each moved `.svelte` file against its tka original with `git diff --no-index --word-diff <tka file at the task's base> <package file>` and every hunk must be one of those substitutions.
- Model per task is in each task heading: sonnet for implementation and mechanical work, opus for review, and opus also implements Tasks 12, 13, 14, 15a, 15b, 20 and 22, whose seams need design judgment. Every task ends with an opus review of its diff against this plan before the next task starts.

### Gates

Every task ends with the gates its heading names. `$SCRATCH` is `/c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2b`.

- **Package gate** (run from `PKGROOT`):
  ```bash
  pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test
  ```
  Expected: svelte-package writes `dist/`; `svelte-check found 0 errors and 0 warnings` for `tsconfig.json` and `tsconfig.test.json`; every node test and every vitest project passes (from Task 5 on the `test` script also runs the `browser` project). Task 1 records the starting counts (the census before 2B: 37 vitest files with 268 tests and 38 node tests); each task's report gives the new counts.
- **Rebuild before tka.** tka reads the package's `dist/` through aliases, so every package change is rebuilt (the package gate does it) before a tka gate runs.
- **tka type gate** (run from TKA):
  ```bash
  npm run check:fast > "$SCRATCH/check-after.txt" 2>&1; node /e/worktrees/shared-packages/video-editor/packages/video-editor/scripts/step1/check-intersection.mjs "$SCRATCH/check-baseline.txt" "$SCRATCH/check-after.txt"
  ```
  Expected: `new 0`. The baseline is the one Task 1 captures (625 errors at the end of 2A; Task 1 records the 2B number). Errors that disappear are fine. A `NEW` line whose message quotes the old path of a moved module is the same error with its text changed: confirm the matching error under the new path and list it in the report.
- **Parity gate** (run from TKA): `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts`. Expected: `Tests 4 passed | 1 skipped (5)`.
- **tka subset** (run from TKA): `npx vitest run --config tests/config/vitest.config.ts tests/unit/media-composition tests/unit/post-studio-media-csp.test.ts`. Expected: every file passes; the count only falls by the files a task moves to the package, and the report names them.
- **tka component gate** (run from TKA, after a task that changes a `.svelte` file under `PS`, `PUI` or `src/lib/features/post`): `npx vitest run --config tests/config/vitest.components.config.ts src/lib/shared/share/components/post-studio src/lib/shared/post-studio-plugin`. Expected: every file passes. (Task 11 moves `PostAnimationAppearanceTool.svelte.test.ts` to `PUI`; Task 22 moves `PostStudio.svelte.test.ts` there as `TkaEditorScope.svelte.test.ts`; the two paths cover both throughout.)
- **tka test gate** (run from TKA, where a task says so): `npm run test:ci > "$SCRATCH/test-after.txt" 2>&1; grep -E "Test Files|Tests |Errors|FAIL" "$SCRATCH/test-after.txt"`. Expected: green. The one tolerated failure is a load flake rerun once and recorded by name; `hero-act.test.ts` is the known one. A line starting `Errors` means files were skipped; treat it as a failure. The controller runs the full suite at Tasks 1, 15b, 17, 20 and 22.
- **Trace-script gate** (run from TKA, after any task touching the store, the state or the plugin's data modules): `npx tsx --tsconfig scripts/tsconfig.json scripts/post-handoff-trace.ts`. Expected output: `No saved post for .`
- **Plugin closure gate** (run from TKA, after any task touching `PLUGIN`): the grep in the "Plugin UI rule" above prints nothing, and `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-bound-only.test.ts` passes.
- **tka production build** (Tasks 20 and 22 only):
  ```bash
  npm run build:packages && node scripts/svelte-kit-sync-if-needed.mjs && node scripts/generate-svg-precache-manifest.cjs && npx cross-env NODE_OPTIONS=--max-old-space-size=8192 NODE_ENV=production vite build > "$SCRATCH/build-after.txt" 2>&1; grep -iE "error|warn.*(rune|state_|video-editor)|built in" "$SCRATCH/build-after.txt"
  ```
  Expected: `built in` lines and no error, no rune warning and no warning that names `video-editor`. Never `npm run build`, never `npm run build:all`.
- **Step tooling.** The move tools read the list named by `STEP_MOVES`, resolved against `scripts/step1/`. Every 2B run sets it, from PKG: `STEP_MOVES=../step2b/moves.json node scripts/step1/move.mjs --task N`.

---

## File map

Line counts are the controller census on the merged tree (`step2-census.md`, 2026-10-10). Fates: **move** (into the package by a moves.json entry, tka's copy deleted with `git rm`), **split** (TKA parts leave for `PUI` in a tka task, then the generic remainder moves), **PUI** (`git mv` inside tka to `PUI`, stays in tka), **copy** (into `KIT`, tka keeps its own), **delete**, **stay**. "Prep" names the in-place tka task that makes the file ready to move (seam design D, E and G); "Move" names the moves.json task.

### Totals

| Fate | Files | Lines | Where it ends |
| --- | ---: | ---: | --- |
| move | 41 | 10,410 | `UI/` (root files), `UI/editor/`, `UI/editor/timeline/` |
| split | 10 | 12,830 | generic remainder to `UI/`, TKA parts to `PUI/` (Tasks 12 to 15b decide the line split; the census of what moves is in each task's report) |
| PUI | 21 | 3,571 | `PUI/` (tka) |
| delete | 1 | 222 | `PostStudio.svelte`, Task 22 |
| stay (`builder/`) | 12 | 2,899 | `PS/builder/` (tka), rendered through `ui.modes` |
| **post-studio total** | **85** | **29,932** | |
| copy into `KIT` | 35 | about 10,950 | `KIT/` (tka keeps its originals) |
| new in the package | 8 | about 900 | `UI/VideoEditor.svelte`, `UI/editor-context.ts`, `UI/types.ts`, `KIT/Icon.svelte`, `KIT/icons.ts`, `KIT/Popover.svelte`, `src/strings/context.ts`, `src/host-defaults.ts` |

So at most 23,240 lines leave tka for the package (10,410 moved plus the generic part of the 12,830 split; 23,240 counts all of the split lines, so the real figure is lower by the TKA part of each split), about 10,950 are copied, 6,470 stay in tka as they are (`PUI` 3,571 plus `builder/` 2,899) plus the TKA part of each split, and 222 are deleted.

### `PS` root (18 files)

| File | Lines | Fate | Target | Prep | Move | Reason and notes |
| --- | ---: | --- | --- | --- | --- | --- |
| `PostStudio.svelte` | 222 | delete | logic into `PUI/TkaEditorScope.svelte` | - | 22 | tka host shell (effects and visibility contexts, `ps-slice` URL session, prop type, audio seed). Its importers (PostModule, `sequence-viewer/components/PostStudioPane.svelte`, `routes/test/post-share-sheet`, `routes/test/post-studio`) switch in Task 22. |
| `PostStudio.svelte.test.ts` | 183 | PUI | `PUI/TkaEditorScope.svelte.test.ts` | - | 22 | tka component test; rewritten in Task 22 to mount the scope and `VideoEditor`. |
| `PostStudioTestHarness.svelte` | 37 | PUI | `PUI/TkaEditorTestHarness.svelte` | - | 22 | needs `SequenceData` and the viewer surfaces; renamed in Task 22 when it mounts the scope. |
| `PostStudioMediaLayer.svelte` | 873 | split | `UI/PostStudioMediaLayer.svelte` | 14, 16, 17 | 20 | the four sequence branches (lines 710-758) and `VisualSequenceSaveContextMenuHost` (832) go to `PUI/TkaMediaSublayer.svelte` (`ui.mediaSublayer`); the video and image branch, pan, seek and the per-update `muted` assignment (open-items) stay. |
| `PostStudioSequenceAnimationLayer.svelte` | 716 | PUI | `PUI/` | - | 11 | sequence animation engine. |
| `PostStudioChoreoLayer.svelte` | 116 | PUI | `PUI/` | - | 11 | ChoreoCard. |
| `PostStudioTunnelLayer.svelte` | 55 | PUI | `PUI/` | - | 11 | tunnel art. Keeps its non-ASCII (tka file). |
| `PostStudioMandalaLayer.svelte` | 45 | PUI | `PUI/` | - | 11 | mandala pane. |
| `PostStudioBreakdownMandala.svelte` | 122 | PUI | `PUI/` | - | 11 | mandala paths. |
| `PostStudioBackdrop.svelte` | 88 | move | `UI/` | 16, 17 | 19 | generic backdrop. |
| `PostStudioPaintedLayer.svelte` | 97 | move | `UI/` | 16, 17 | 19 | draws a painter's frame. |
| `post-animation-effects.svelte.ts` | 35 | PUI | `PUI/` | - | 11 | trail effects config. |
| `post-card-highlight.ts` | 13 | PUI | `PUI/` | - | 11 | only `PostStudioChoreoLayer` imports it. |
| `post-item-render-options.ts` | 87 | PUI | `PUI/` | - | 11 | animation render options (`SequenceExportOptions`). |
| `post-qr-image-appearance.ts` | 120 | PUI | `PUI/` | - | 11 | TKA QR detector. |
| `post-studio-art-context.svelte.ts` | 75 | PUI | `PUI/` | - | 11 | mandala and tunnel controllers. |
| `post-studio-prop-render-options.ts` | 24 | PUI | `PUI/` | - | 11 | prop type options. |
| `post-studio-share-export.ts` | 5 | move | `UI/share-export.ts` | - | 18 | the `registerExport` contract (`render`, `cancel`); exported from `./ui` as `ShareExport`. tka's `PostStudioPane.svelte` and `SequenceViewerShell.svelte` import it from `@austencloud/video-editor/ui` after the move. |

### `PS/editor` (46 files)

| File | Lines | Fate | Target | Prep | Move | Reason and notes |
| --- | ---: | --- | --- | --- | --- | --- |
| `PostEditorWorkspace.svelte` | 3,932 | split | `UI/editor/PostEditorWorkspace.svelte` | 15, 16, 17 | 20 | seam design G1. Its one `<select>` (2923, the take picker) is in the timing toolbar, which moves to `PUI/TkaTimingToolbar.svelte` and stays in tka, so the package editor has no `<select>`. |
| `PostEditorCanvas.svelte` | 3,302 | split | `UI/editor/` | 14, 16, 17 | 20 | seam design G2. |
| `PostItemTool.svelte` | 1,764 | split | `UI/editor/` | 13, 16, 17 | 20 | seam design G3. Uses `FilterChipBase` and `ChipPopoverOption` (copied into `KIT`). |
| `PostAddPanel.svelte` | 223 | split | `UI/editor/` | 12, 16, 17 | 19 | generic adds stay; animation, moves, mandala, carousel, titles and tunnel hook become `ui.addItems` entries in `PUI/tka-add-items.ts`. |
| `post-editor-tools.ts` | 234 | split | `UI/editor/` | 12 | 18 | `toolRow` keeps the core rows; TKA tools (`look`, `effects` staff part, `beats`, `appearance`, `sequence`, `labels`, `shows`, `titles`) come from `ui.tools` and `ui.toolRow` (seam design B). |
| `post-editor-labels.ts` | 231 | split | `UI/editor/` | 12, 16, 17 | 18 | core kind labels and icons stay; the four TKA kinds' labels and icons move to `PUI/tka-kind-ui.ts` (`ui.icon`, kind `label`). |
| `post-editor-add.ts` | 42 | move | `UI/editor/` | 12 | 18 | `overlayAt` names `animation`, `moves`, `carousel`; Task 12 replaces that with a `fillOverMain` argument the add entry carries. |
| `post-crop-steps.ts` | 80 | split | `UI/editor/` | 12 | 18 | `ClipStep` and `adjacentStepSeconds` move; `clipSteps` (reads `take-timing`) becomes `PUI/tka-crop-steps.ts` behind `ui.cropSteps`. |
| `post-editor-files.ts` | 30 | move | `UI/editor/` | 16 | 18 | takes `t` as a parameter; `getVideoFileMetadata` comes from `KIT/video-file-metadata.ts`. |
| `post-editor-header.svelte.ts` | 23 | move | `UI/editor/` | - | 18 | the header context; PostModule imports it from `./ui` after the move. |
| `post-box-drag.ts` | 488 | move | `UI/editor/` | - | 18 | geometry. |
| `post-crop-geometry.ts` | 792 | move | `UI/editor/` | - | 18 | geometry. |
| `post-crop-glide.ts` | 209 | move | `UI/editor/` | - | 18 | geometry. |
| `post-crop-session.svelte.ts` | 845 | move | `UI/editor/` | 16 | 18 | imports the wrapper's `PostEditorState` type; Task 16 switches it to the package `VideoEditorState`. |
| `post-curve-plot.ts` | 61 | move | `UI/editor/` | - | 18 | geometry. |
| `post-item-rect.ts` | 63 | move | `UI/editor/` | 16 | 18 | as `post-crop-session`. |
| `post-picture-pan-drag.ts` | 209 | move | `UI/editor/` | - | 18 | geometry. |
| `post-source-crop.ts` | 234 | move | `UI/editor/` | - | 18 | geometry. |
| `post-source-geometry.ts` | 82 | move | `UI/editor/` | - | 18 | geometry. |
| `post-appearance-fit.ts` | 30 | PUI | `PUI/` | - | 11 | only `PostAppearanceChooser` imports it. |
| `PostAnimationAppearanceTool.svelte` | 896 | PUI | `PUI/` | - | 11 | animation appearance; keeps bits-ui `Popover` and its 10 non-ASCII lines (tka file). |
| `PostAnimationAppearanceTool.svelte.test.ts` | 273 | PUI | `PUI/` | - | 11 | its component test. |
| `PostAppearanceChooser.svelte` | 147 | PUI | `PUI/` | - | 11 | tka `Drawer`, portal, `SettingsDrillRow`. |
| `PostCardAppearanceTool.svelte` | 156 | PUI | `PUI/` | - | 11 | `ExportImagePanel`. |
| `PostScopedEffectsPanel.svelte` | 121 | PUI | `PUI/` | - | 11 | tka effects panel. |
| `PostSequenceActionsTool.svelte` | 79 | PUI | `PUI/` | - | 11 | sequence transforms. |
| `PostStaffEffectsTool.svelte` | 241 | PUI | `PUI/` | - | 11 | staff tips. |
| `PostCropTimeline.svelte` | 994 | move | `UI/editor/` | 16, 17 | 19 | takes `steps` (generic `ClipStep[]`). |
| `PostCurveEditor.svelte` | 423 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostDraftStatus.svelte` | 132 | move | `UI/editor/` | 16, 17 | 19 | 3 non-ASCII lines. |
| `PostEditorActions.svelte` | 144 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostEditorTopBar.svelte` | 144 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostEditorTransport.svelte` | 146 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostExportPanel.svelte` | 293 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostKeyframeControls.svelte` | 440 | move | `UI/editor/` | 16, 17 | 19 | two dynamic `t()` keys (seam design D). |
| `PostMediaPanel.svelte` | 331 | move | `UI/editor/` | 16, 17 | 19 | the library list reads `MediaLibrary` takes (seam design C). |
| `PostMusicPreview.svelte` | 194 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostMusicTool.svelte` | 497 | move | `UI/editor/` | 16, 17 | 19 | `KIT/bpm-analyzer.ts`. |
| `PostNativeTextTool.svelte` | 199 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostRatioPicker.svelte` | 102 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostSaveButton.svelte` | 97 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostSourceGeometryTool.svelte` | 141 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostToolPanel.svelte` | 160 | move | `UI/editor/` | 16, 17 | 19 | `titles` here is a CSS class, not the kind. |
| `PostToolRow.svelte` | 173 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostTransitionTool.svelte` | 135 | move | `UI/editor/` | 16, 17 | 19 | |
| `PostVideoColorTool.svelte` | 102 | move | `UI/editor/` | 16, 17 | 19 | |

### `PS/editor/timeline` (9 files)

| File | Lines | Fate | Target | Prep | Move | Reason and notes |
| --- | ---: | --- | --- | --- | --- | --- |
| `PostTimeline.svelte` | 2,066 | split | `UI/editor/timeline/` | 14, 16, 17 | 20 | the tunnel block becomes a kind part (`ui.parts`); `crossfadeKinds` (417-424) reads `transitionVisual` from the kind definitions; `selectedPart` and `onSelectTunnel` become `selectedPart` and `onSelectPart`. |
| `post-timeline-selection.ts` | 125 | split | `UI/editor/timeline/` | 12 | 18 | `timelineHandoffPair` (reads tka's `pipHandoffOf`) becomes `PUI/tka-timeline-join.ts` behind `ui.timelineJoin`. |
| `post-timeline-geometry.ts` | 356 | move | `UI/editor/timeline/` | 16 | 18 | imports `TimeRuler` from `KIT`. |
| `PostTimelineItem.svelte` | 357 | move | `UI/editor/timeline/` | 14, 16, 17 | 19 | `tunnel` prop becomes `part: { id, label, icon } | null`. |
| `PostTimelineKeyLane.svelte` | 422 | move | `UI/editor/timeline/` | 16, 17 | 19 | |
| `PostTimelineKeyLaneHeader.svelte` | 204 | move | `UI/editor/timeline/` | 16, 17 | 19 | one dynamic `t()` key. |
| `PostTimelineMusicLane.svelte` | 639 | move | `UI/editor/timeline/` | 16, 17 | 19 | `wavesurfer.js`. |
| `PostTimelineTrackHeader.svelte` | 151 | move | `UI/editor/timeline/` | 16, 17 | 19 | two dynamic `t()` keys. |
| `PostTimelineZoomControls.svelte` | 166 | move | `UI/editor/timeline/` | 16, 17 | 19 | bits-ui `Popover` replaced by `KIT/Popover.svelte` in Task 17 (seam design F). |

### `PS/builder` (12 files, 2,899 lines): stay

`post-builder-format.ts` (40), `post-timing-animation.ts` (145), `post-timing-session.svelte.ts` (901), `PostTimingAnimationPreview.svelte` (52), `PostTimingAnimationSettings.svelte` (83), `PostTimingDisclosure.svelte` (91), `PostTimingPanel.svelte` (492), `PostTimingStage.svelte` (179), `PostTimingTap.svelte` (81), `PostTimingTimeline.svelte` (299), `TakeTimingLane.svelte` (460), `timing-lane-landings.ts` (76). The timing mode; `PUI/TkaTiming*.svelte` (Task 15b) render them through `ui.modes`. Thirteen moving files import from here today: twelve take functions from `post-builder-format.ts` (`formatPostClock`: `PostAddPanel`, `PostExportPanel`, `PostKeyframeControls`, `PostMediaPanel`, `timeline/PostTimelineItem`, `timeline/PostTimelineKeyLane`, `timeline/PostTimelineMusicLane` (the last through the `$lib` alias, not a relative path); `formatTakeClock`: `PostCropTimeline`, `PostEditorTransport`, `PostEditorWorkspace`, `PostItemTool`, `PostMusicTool`; `parseClock`: `PostCropTimeline`, `PostEditorTransport`, `PostItemTool`, `PostMusicTool`; `formatPostSpeed`: `PostItemTool`, `timeline/PostTimelineItem`) and `post-crop-steps.ts` takes `shownLandings` from `timing-lane-landings.ts`. Task 12 copies all four format functions into `PS/editor/post-format.ts` (generic clock and speed formatting; Task 18 moves it to `UI/editor/post-format.ts`; `builder/post-builder-format.ts` keeps its copy for the builder) and `shownLandings` goes with `clipSteps` to `PUI`.

### The UI kit (copy into `KIT`, Task 10)

| tka file | Lines | Package file | tka imports replaced |
| --- | ---: | --- | --- |
| `src/lib/shared/components/panel/PanelButton.svelte` | 190 | `KIT/PanelButton.svelte` | none |
| `src/lib/shared/ui/components/SegmentedControl.svelte` | 579 | `KIT/SegmentedControl.svelte` | `transitions/motion` to `./motion.js` |
| `src/lib/shared/ui/components/TypeableValue.svelte` | 285 | `KIT/TypeableValue.svelte` | `t` to `useStrings()`; `../typed-number` to `./typed-number.js` |
| `src/lib/shared/ui/components/ValueSlider.svelte` | 416 | `KIT/ValueSlider.svelte` | relative only |
| `src/lib/shared/ui/typed-number.ts` | 38 | `KIT/typed-number.ts` | none |
| `src/lib/shared/ui/components/ScrubbableNumber.svelte` | 256 | `KIT/ScrubbableNumber.svelte` | none |
| `src/lib/shared/ui/components/OverflowMenu.svelte` | 327 | `KIT/OverflowMenu.svelte` | 2 `fa-` classes to `Icon` |
| `src/lib/shared/components/Crossfade.svelte` | 492 | `KIT/Crossfade.svelte` | `focus-restore`, `transitions`, `motion` to `./` copies |
| `src/lib/shared/foundation/ui/modal/helpers/focus-restore.ts` | 108 | `KIT/focus-restore.ts` | none |
| `src/lib/shared/foundation/ui/Drawer.svelte` | 828 | `KIT/Drawer.svelte` | `responsiveLayoutManager` to a `matchMedia` read of the same breakpoint; `holdBackgroundFor` dropped (risk R7); escape registration to `host.shortcuts.escapeLayer`; its side-effect import `./drawer/Drawer.css` (775 lines) is copied to `KIT/drawer/Drawer.css` and kept as an import; `shouldDeferEscapeShortcut` (from `$lib/shared/keyboard/domain/escape-shortcut-target`, used at 611 and 632) becomes a local copy of that function and its `LOCAL_ESCAPE_OWNER_SELECTOR` constant (it needs nothing else from the file) |
| `src/lib/shared/foundation/ui/drawer/*.ts` (5 files) | 1,578 | `KIT/drawer/*.ts` | `debug-logger` dropped; `Z` from `$lib/shared/ui/z-index` (15 lines, used for `BASE_Z_INDEX = Z.DRAWER` in `drawer-stack.ts:23`) becomes a local constant with tka's value; `drawer-stack.ts` calls `getEscapeLayerManager().register({...})` (62) and `.unregister(...)` with the `drawer:<id>` key (83) on tka's singleton, not on a parameter, so its register function gains an `escapeLayer: EditorShortcuts["escapeLayer"]` argument that `Drawer.svelte` passes from `useEditorUi().services.shortcuts`, and the returned unregister replaces the `unregister` call |
| `src/lib/shared/foundation/ui/DrawerHeader.svelte` | 255 | `KIT/DrawerHeader.svelte` | `t` to `useStrings()`; haptics to `host.haptics`; 2 `fa-` to `Icon` |
| `src/lib/shared/foundation/ui/ConfirmDialog.svelte` | 507 | `KIT/ConfirmDialog.svelte` | bits-ui `Dialog` (as `DialogPrimitive`, lines 140-212) to a plain fixed overlay with `role="dialog"` and `aria-modal="true"` (what bits-ui renders today), focus trap from `KIT/drawer/focus-trap.ts`; `t` and haptics as above; 5 `fa-` to `Icon` |
| `src/lib/shared/panels/ResizeHandle.svelte` | 208 | `KIT/ResizeHandle.svelte` | none |
| `src/lib/shared/timeline/TimeRuler.svelte` | 171 | `KIT/TimeRuler.svelte` | the `timeline-types` import becomes a local type |
| `src/lib/shared/transitions/motion.ts` | 334 | `KIT/motion.ts` | relative only |
| `src/lib/shared/transitions/transitions.ts` | 36 | `KIT/transitions.ts` | none |
| `src/lib/shared/transitions/ws-ease.ts` | 68 | `KIT/ws-ease.ts` | none |
| `src/lib/shared/transitions/layout-flip.ts` | 334 | `KIT/layout-flip.ts` | relative only |
| `src/lib/shared/foundation/services/file-downloader.ts` | 304 | `KIT/file-downloader.ts` | `platform-detector` to an inline user-agent test equal to what the function calls |
| `src/lib/shared/foundation/services/types.ts` | 75 | `KIT/file-downloader-types.ts` | none (only the types the downloader uses) |
| `src/lib/shared/audio/bpm-analyzer.ts` | 261 | `KIT/bpm-analyzer.ts` | `realtime-bpm-analyzer` becomes a package dependency |
| `src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte` | 576 | `KIT/FilterChip.svelte` | none (not in the spec's list; `PostItemTool` and `PostKeyframeControls` use it) |
| `src/lib/shared/browse/components/filter-chips/ChipPopoverOption.svelte` | 154 | `KIT/ChipPopoverOption.svelte` | none (same) |
| `src/lib/shared/sequence-viewer/components/reparent-to-inspector.ts` | 229 | `KIT/reparent.ts` | motion imports to `./` copies (generic DOM reparent action the workspace uses for `previewTarget`) |
| `src/lib/shared/video-collaboration/helpers/create-video-from-upload.ts:191-214` | 24 | `KIT/video-file-metadata.ts` | none (only `getVideoFileMetadata`) |
| `src/lib/shared/video-export/components/ExportTakeover.svelte` | 352 | `KIT/ExportTakeover.svelte` | `t` to `useStrings()`; the `video-export-types` import becomes a local type; 1 `fa-` to `Icon` (the workspace's export progress overlay, line 3287) |
| `src/lib/shared/foundation/ui/modal/BaseModal.svelte` | 611 | `KIT/BaseModal.svelte` | `motion` to `./motion.js`; `../drawer/focus-trap` to `./drawer/focus-trap.js`; `./helpers/focus-restore` to `./focus-restore.js`; `./modal-stack` (132 lines; imports `Z` and `getEscapeLayerManager` like `drawer-stack.ts`) copied to `KIT/modal-stack.ts` with the same two replacements; `./modal-tokens.css` (446 lines) copied to `KIT/modal-tokens.css` (only `ExportTakeover` needs it) |

Kit total: 28 rows, 35 files (the drawer row is 5 files, and the Drawer and BaseModal rows also copy `drawer/Drawer.css`, `modal-stack.ts` and `modal-tokens.css`), about 10,950 lines. Kit line counts are plain `wc -l` on tka at `32f1ee5675`; the `PS` tables above use the census convention, `wc -l` plus one. Not copied: `trace-rounded-rect` (not under `TKA/src`; the package's `render/rounded-rect.ts` already covers it), `video-file-metadata` as a separate tka file (it is the function above), `src/lib/shared/3d/camera/transitions.ts` and `src/lib/shared/utils/transitions.ts` (basename matches in the census, unrelated). Step 3 note: `FilterChip`, `ChipPopoverOption` and `OverflowMenu` are popover menus, which Ringmaster's no-dropdown rule may reject.

### Plugin folder `PLUGIN` (14 files today)

| File | Fate | Change |
| --- | --- | --- |
| `index.ts`, `bound.ts`, `alignment.ts`, `card-qr.ts`, `compile-hooks.ts`, `edit-hooks.ts`, `normalize-hooks.ts`, `painters.ts`, `project-extension.ts`, `item-kinds.ts` | stay | data plugin; no Svelte enters. `bound.ts:67` keeps `evaluatePresetFrame` and `evaluatePresetLayers`: no `src` caller is left, but the frozen parity test and 12 other tka tests import them (Task 20 Step 7, `HANDOFF_2B` item 15, risk R17). |
| `create-plugin.ts` | stay | no change; `createSurfaces` is wired in `PUI/tka-editor-plugin.ts` (Task 12). |
| `surfaces.ts` | stay | `createTkaSurfaces()` becomes the UI plugin's `createSurfaces` member (Task 7 tests it, Task 12 wires it); the per-instance caches live inside the factory. |
| `alignment.test.ts`, `plugin.test.ts` | stay | Task 7 adds the positive-path cases (`HANDOFF_2B` item 3). |
| `ui/` (new, `PUI`) | new | the 19 PUI files above (Task 11) and the two test files Task 22 renames, plus new: `SingleSvelteProbe.svelte`, `SingleSvelteReader.svelte`, `single-svelte.svelte.test.ts` (Task 3); `tka-host.ts`, `tka-media-library.svelte.ts` (Task 4); `tka-editor-context.ts`, `tka-row.ts`, `tka-row.test.ts`, `tka-tools.ts`, `tka-kind-ui.ts`, `tka-add-items.ts`, `tka-crop-steps.ts`, `tka-timeline-join.ts`, `tka-plugin-ui.ts`, `tka-editor-plugin.ts` (Task 12); `TkaKindTools.svelte`, `TkaItemTools.svelte` (Task 13); `TkaMediaSublayer.svelte`, `tka-canvas-layer.ts`, `TkaStripGuide.svelte`, `tka-parts.ts` (Task 14); `TkaEditorScope.svelte`, `TkaViewerBridge.svelte`, `tka-painters.svelte.ts` (Task 15a); `tka-timing-mode.ts`, `TkaTimingToolbar.svelte`, `TkaTimingDock.svelte`, `TkaTimingPanel.svelte`, `TkaTimingStage.svelte`, `TkaTimingTimeline.svelte`, `TkaLookPanel.svelte`, `TkaBackupPanel.svelte` (Task 15b). |

### tka files outside `PS` that 2B touches

| File | Lines | Change |
| --- | ---: | --- |
| `src/lib/features/post/PostModule.svelte` | 523 | Task 22: renders `<TkaEditorScope>` around `<VideoEditor>`; its four `fa-` classes stay (tka file). |
| `src/lib/shared/sequence-viewer/components/PostStudioPane.svelte` | - | Task 22: same switch. `ShareExport` type from `./ui` in Task 18. |
| `src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte` | - | Task 18: `ShareExport` type import. |
| `src/routes/test/post-share-sheet/+page.svelte`, `src/routes/test/post-studio/+page.svelte` | - | Task 22: mount the scope. |
| `src/routes/test/video-editor-spike/+page.svelte` | - | Task 3: imports `VideoEditorSpike`. |
| `MC/state/post-editor-state.svelte.ts` | 439 | Task 1 wraps line 434 (item 10); Task 4 adds the conformance check (item 13) and the `services` dependency; Task 12 makes `addLibraryVideo` seed the legacy map; Task 15a adds `selectedPart` forwarding and moves `mode` out (seam design A). |
| `MC/state/editor-strings.ts` | - | Task 3: imports from `@austencloud/video-editor/strings`. |
| `docs/development/post-studio-manifest-bridge.md` | - | Task 1 (item 11). |
| `svelte.config.js`, `vite.config.ts`, `tests/config/vitest.config.ts`, `tests/config/vitest.components.config.ts` | - | no change. The `@austencloud/video-editor` alias is a prefix that maps `@austencloud/video-editor/<sub>` to `dist/<sub>`, which resolves `dist/<sub>/index.js` exactly as `./core` does today. The alias bypasses the `exports` map, so every new subpath must be a folder with an `index.ts`: `src/ui/index.ts`, `src/strings/index.ts`, `src/icons/index.ts`. Task 3 confirms the first two resolve from a tka test, Task 8 the third. |
| tka tests importing `PS` (31 files under `tests/unit/media-composition/` at `32f1ee5675` by `grep -rlE "from ['\"][^'\"]*share/components/post-studio" tests --include=*.ts`) | - | each follows its module: portable `.ts` tests move with Task 18, harness tests with Task 19, the rest change import paths in the task that moves their module (the list is in `step2-importers.md`). |
| tka source-reading contract tests on `PS` paths (not imports): `tests/unit/media-composition/post-music-preview-contract.test.ts:31-34` (canvas, workspace, timeline), `tests/unit/post-save-target-contract.test.ts:30` (workspace), `tests/unit/prop-color-picker-contract.test.ts:63` (workspace) | - | they `readFileSync` the file by its tka path, so a split can move the asserted text and the Task 20 move removes the path. The task that splits or moves the file they read (14, 15a, 15b, 20) reruns them and repoints each assertion at the file that now holds the text (a `PUI` file, or the placed package file); it never deletes an assertion. |

---

## Seam design

### A. The `VideoEditor` component

`UI/VideoEditor.svelte` is the package's one public editor component (exported from the root entry and from `./ui`). It replaces the spike's name (the spike becomes `VideoEditorSpike`, Task 3). It is a thin root: it resolves the services, provides the contexts, and renders `UI/editor/PostEditorWorkspace.svelte`, which keeps today's layout. Its props, in `UI/types.ts`:

```ts
import type { VideoEditorHost } from "../host.js";
import type { VideoEditorPlugin } from "../plugin.js";
import type { PostProject } from "../core/project/item-kinds.js";
import type { VideoEditorState, VideoEditorStateOptions } from "../state/video-editor-state.svelte.js";
import type { ShareExport } from "./share-export.js";

export interface VideoEditorProps<E = unknown> {
	host: VideoEditorHost<E>;
	/** Absent for a plugin-free host (Ringmaster): every generic panel renders, no plugin member is asked. */
	plugin?: VideoEditorPlugin;
	/**
	 * A state the host built (tka passes its wrapper, which forwards the package state and adds the
	 * timing and tunnel members its plugin UI reads). Without it the component builds one with
	 * createVideoEditorState(host, plugin, stateOptions) and disposes it on destroy; a passed state is
	 * the host's to dispose.
	 */
	editor?: VideoEditorState<E>;
	/** Options for the state the component builds; default `{ subjectId: "default" }` (2A's `options` is required). */
	stateOptions?: VideoEditorStateOptions<E>;
	/** False while mounted but hidden: playback pauses and shortcuts stop. Default true. */
	active?: boolean;
	/** While set, the preview stage is reparented into this element (tka's sequence viewer). */
	previewTarget?: HTMLElement | null;
	/** While set, the inspector panel is reparented into this element. */
	inspectorTarget?: HTMLElement | null;
	/** True while the host's share sheet owns the screen. */
	sharing?: boolean;
	onSaveDraft?: (project: PostProject) => Promise<PostProject | null | void>;
	draftLoadError?: string | null;
	onExported?: (blob: Blob) => void;
	onSharePost?: () => void;
	/** The editor hands the host its export controls; the return value unregisters them. */
	registerExport?: (controls: ShareExport) => () => void;
	/** The project's opening audio choice when it has none yet. */
	audioSeed?: "takes" | "silent" | null;
	onAudioChange?: (audio: "takes" | "silent", chosen: boolean) => void;
}
```

Every generic prop keeps the exact type `PostEditorWorkspace.svelte` gives it today (its `Props` interface, lines 208-239, destructured at 241-264). The workspace has no `inspectorTarget` prop today (it reads the external inspector from `getViewerStudioSurfaces()` at 266-268); Task 15a adds it. `initialProject` is a workspace prop today that design A leaves to the state: tka passes it to `createPostEditorState` in `TkaEditorScope`, a plugin-free host through `stateOptions`. The workspace's TKA props (`sequence`, `feature`, `cardPreviewUrl`, `animationPreviewUrl`, `animationPreviewType`, `cardRenderOptions`, `isPreparingCard`, `isPreparingAnimation`, `selectedPropType`, `onPropChange`, `onProjectPropChange`) leave the props in Task 15b and reach the plugin UI through tka's context (design H).

The contexts `VideoEditor` provides, in `UI/editor-context.ts` (one module, one symbol per context):

```ts
import { getContext, setContext } from "svelte";
import type { VideoEditorHost } from "../host.js";
import type { VideoEditorPlugin } from "../plugin.js";
import type { VideoEditorState } from "../state/video-editor-state.svelte.js";
import type { EditorServices } from "../host-defaults.js";

export interface EditorUi<E = unknown> {
	readonly editor: VideoEditorState<E>;
	readonly host: VideoEditorHost<E>;
	readonly plugin: VideoEditorPlugin | null;
	readonly services: EditorServices;
}

const EDITOR_UI = Symbol("video-editor-ui");

export function provideEditorUi<E>(ui: EditorUi<E>): EditorUi<E> {
	setContext(EDITOR_UI, ui);
	return ui;
}

export function useEditorUi<E = unknown>(): EditorUi<E> {
	const ui = getContext<EditorUi<E> | undefined>(EDITOR_UI);
	if (!ui) throw new Error("useEditorUi() runs inside <VideoEditor>.");
	return ui;
}
```

plus `provideStrings` (design D). Moved components keep their props as they are today (`{editor}` and the rest are still passed down explicitly); the context is for plugin components and for the few places that today read a tka singleton (toast, shortcut manager, preview cache).

**Why `editor` is optional and tka passes one.** tka's wrapper (`MC/state/post-editor-state.svelte.ts`) composes the package state with the take-timing state and tka's tunnel and Tutorial members, and tka code outside the editor (PostModule's header, the dev bridge, the timing mode) holds it. Building it inside the package would need every timing member as a plugin state hook, which is step 3 territory at best. Task 4 makes the wrapper's return type assignable to `VideoEditorState<PostTimingEffect>` and pins that with a type check in `src` (closes R13, `HANDOFF_2B` item 13). A plugin-free host passes nothing and gets the package state.

**Two package state additions** (Task 9), both generic: `mode: string` (default `"edit"`; a plugin mode sets its own id; the wrapper's `mode` becomes a forward of it) and `selectedPart: string | null` with `selectPart(itemId: string, part: string): void` (selecting any item clears the part; the wrapper's `selectTunnel(id)` becomes `selectPart(id, "tunnel")` and its `selectedPart` a forward). The timeline and canvas need both to stay generic.

### B. Plugin UI members

The data plugin (`create-plugin.ts`) must stay free of Svelte (the server and tsx scripts load it), so UI members live under one optional `ui` object, on the plugin and on each kind, and tka builds its UI plugin in `PUI/tka-editor-plugin.ts` by spreading the data plugin:

```ts
// PUI/tka-editor-plugin.ts (tka, browser only)
import type { VideoEditorPlugin } from "@austencloud/video-editor";
import { createTkaPlugin } from "../create-plugin";
import { TKA_KIND_UI } from "./tka-kind-ui";
import { createTkaPluginUi } from "./tka-plugin-ui";

export function createTkaEditorPlugin(): VideoEditorPlugin {
  const data = createTkaPlugin();
  return {
    ...data,
    itemKinds: data.itemKinds.map((definition) => ({
      ...definition,
      ui: TKA_KIND_UI[definition.kind],
    })),
    ui: createTkaPluginUi(),
  };
}
```

The types, added to `PKG/src/plugin.ts` in Task 9 (component types from `svelte`, imported with `import type`, so `plugin.ts` stays type-only):

```ts
// plugin.ts already imports PostItem and PostProject from "./core/project/item-kinds.js" (line 6), and ClipStep
// and TimelineJoin are declared further down plugin.ts (Task 9), so neither needs a new import.
import type { Component, Snippet } from "svelte";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import type { CompositionSourceBinding } from "./state/source-binding.js";
import type { EvaluatedFrameLayer } from "./render/frame-evaluator.js";
import type { MediaCompositionPreset } from "./core/preset/preset-schema.js";
import type { PostStudioLayerPainter } from "./render/layer-painter.js";
import type { VideoEditorState } from "./state/video-editor-state.svelte.js";
import type { Translate } from "./strings/translate.js";

/** What every plugin tool panel receives. `editor` is the generic state; a plugin that needs its own members reads them from its own context. */
export interface ToolPanelProps {
	editor: VideoEditorState;
	/** The selected item, or null when the tool belongs to no item (the empty selection row). */
	item: PostItem | null;
	/** The active tool id. */
	tool: string;
	locked: boolean;
}

/** A part of an item that the timeline draws as its own block and the canvas selects on its own (tka: an animation's opening tunnel). */
export interface ItemPart {
	id: string;
	/** Seconds in post time, or null when the item has no such part now. */
	span(item: PostItem): { start: number; end: number } | null;
	label(t: (key: string) => string): string;
	icon: IconDefinition;
}

export interface ItemKindUi {
	/** Icon on timeline blocks, the add panel and the tool row; `iconFor` lets a mode pick its own (tka: a mandala). */
	icon: IconDefinition;
	iconFor?(item: PostItem): IconDefinition;
	/** The translated kind name; without it the editor shows the definition's `label`. */
	label?(t: (key: string) => string, item: PostItem | null): string;
	/** The kind's own tool panels; renders nothing for a tool it does not own. */
	toolPanel?: Component<ToolPanelProps>;
	parts?: readonly ItemPart[];
}

/** A tool a plugin adds to the tool row. A panel tool opens its panel; an action tool runs. */
export type PluginTool =
	| { id: string; type: "panel"; label(t: (key: string) => string): string; icon: IconDefinition }
	| {
			id: string;
			type: "action";
			label(t: (key: string) => string): string;
			icon: IconDefinition;
			run(editor: VideoEditorState): void;
	  };

/** An entry the plugin adds to the add panel. */
export interface PluginAddItem {
	id: string;
	label(t: (key: string) => string): string;
	icon: IconDefinition;
	/** False hides the entry (tka: the tunnel hook when the post already has one). */
	available(editor: VideoEditorState): boolean;
	/** Runs after the panel pauses playback. Returns the kind it added (the panel then opens that kind's tools, as for a core add), or null. */
	add(editor: VideoEditorState): string | null;
}

export interface MediaSublayerProps {
	editor: VideoEditorState;
	binding: CompositionSourceBinding;
	layer: EvaluatedFrameLayer;
	role: string;
	regionId: string;
	preset: MediaCompositionPreset | null;
	/** The item the layer draws, and the item under it when the layer is an overlay of a main item. */
	sourceItem: PostItem | null;
	underlyingItem: PostItem | null;
	playing: boolean;
	exporting: boolean;
}

export interface CanvasOverlayProps {
	editor: VideoEditorState;
	/** True while the crop screen owns the canvas; an overlay hides itself. */
	cropping: boolean;
}

/** A screen state the plugin owns (tka: the timing mode). Each slot replaces the edit mode's slot while the mode is active. */
export interface EditorMode {
	id: string;
	dock?: Component<{ editor: VideoEditorState }>;
	panel?: Component<{ editor: VideoEditorState }>;
	stage?: Component<{ editor: VideoEditorState }>;
	timeline?: Component<{ editor: VideoEditorState }>;
	/** The bar above the stage while the mode is active (tka: Back, the take picker, the save status). It replaces the top bar slot and owns the mode's own undo keys; `draftStatus` is the workspace's save-status snippet. */
	toolbar?: Component<{ editor: VideoEditorState; draftStatus: Snippet }>;
	/** Keys while the mode is active; return true when handled. */
	keydown?(event: KeyboardEvent, editor: VideoEditorState): boolean;
}

/** Source bindings and painters for the plugin's roles, made once per editor. */
export interface PluginBindings {
	bindingFor(role: string): CompositionSourceBinding | null;
	exportPainters(): ReadonlyMap<string, PostStudioLayerPainter>;
	dispose(): void;
}

export interface PluginUi {
	/** Panels for plugin tools on core kinds, and additions after a core tool's own panel. */
	toolPanel?: Component<ToolPanelProps>;
	tools?: readonly PluginTool[];
	/** The tool row for a selection, given the core row; return the row in display order. The editor answers what the row depends on (tka: the selected part, a QR image, a backdrop). */
	toolRow?(selection: PostItem | null, coreRow: readonly string[], editor: VideoEditorState): readonly string[];
	addItems?(coreItems: readonly string[]): readonly (string | PluginAddItem)[];
	mediaSublayer?: { renderModes: readonly string[]; component: Component<MediaSublayerProps> };
	/** Called on a right click on any media layer; the editor prevents the default when present. */
	layerContextMenu?(event: MouseEvent): void;
	canvasOverlays?: readonly Component<CanvasOverlayProps>[];
	modes?: readonly EditorMode[];
	/** Whole panels keyed by a plugin tool id (tka: the "look" animation panel, backup and recovery). */
	panels?: Readonly<Record<string, Component<{ editor: VideoEditorState }>>>;
	/**
	 * Made once per editor during the workspace's initialisation, so it may call getContext. `previewUrl` is the
	 * workspace's preview resolver: the URL a take plays from (its preview copy when ready, else `url`).
	 */
	createBindings?(env: {
		editor: VideoEditorState;
		t: Translate;
		previewUrl(takeId: string, url: string | null): string | null;
	}): PluginBindings;
	/** Crop screen landing marks for a video item (tka: the tapped placements). */
	cropSteps?(editor: VideoEditorState, itemId: string): readonly ClipStep[];
	/** Two items the timeline draws joined (tka: the animation handing over to the moves square). */
	timelineJoin?(project: PostProject): TimelineJoin | null;
}
```

`ItemKindDefinition` gains `ui?: ItemKindUi`; `VideoEditorPlugin` gains `ui?: PluginUi` and `createSurfaces?(): readonly SurfaceCapture[]` (design B2). `ClipStep` (`seconds`, `position`, `stepIndex`, `label`, `passStart`) and `TimelineJoin` (`fromId`, `toId`, `fromTrackIndex`, `toTrackIndex`, `start`, `end`) are declared in `plugin.ts` (Task 9); the UI modules import them from there. The `label(t)` functions take a plain `(key: string) => string` so a plugin passes keys from its own table (tka: its `t`); the package calls them with its translate widened to `string`.

**Rules the package follows for every member.** A missing `ui`, member or entry renders nothing and logs nothing. Core panels render first; a plugin panel for the same tool renders after them (that keeps tka's order: both tka additions to core tools, the "Replace with live sequence animation" button in trim and the staff effects in video effects, sit at the end of their branch today, `PostItemTool.svelte` 946-958 and 1419-1429). Arrange hooks (`toolRow`, `addItems`) receive the core list and return the final list; tka returns today's exact rows (Task 12 pins every row in a test).

**Components, not snippets.** Members are Svelte component values (`Component<Props>`). A snippet can only be created inside a component's markup, so a plugin object built in a `.ts` module could not hold one, and tka's members are whole files (the timing mode is five `builder/` components). A component value is also typed by its props, which the package can check.

**`laneRenderer` is replaced by `parts` and `icon`.** The edit timeline has no TKA lane: every item, TKA kinds included, draws as a generic block (`PostTimelineItem.svelte`), and the only TKA-specific drawing is the animation's tunnel as a separate joined block (`PostTimeline.svelte` 263-324, 1586-1610) plus the kind icon. The only TKA lane (take timing, `builder/TakeTimingLane.svelte`) belongs to the timing mode and arrives through `modes[].timeline`. A `laneRenderer` member would have no caller; Task 23 records the replacement in the spec.

**B2. Surfaces as a factory (R11, `HANDOFF_2B` item 3).** `createSurfaces?(): readonly SurfaceCapture[]` replaces the static `surfaces` array: the exporter calls it once per export and releases each surface when the export ends, so per-export caches (tka's ChoreoCard capture cache) live inside one call. tka's `surfaces.ts` already exports `createTkaSurfaces()`; Task 7 adds the member to the contract and tests `createTkaSurfaces` as a factory; Task 12 wires `createSurfaces: createTkaSurfaces` into `PUI/tka-editor-plugin.ts`, never into `create-plugin.ts`, whose server closure must not pull the DOM capture modules `surfaces.ts` imports. The compositor's `DOM_SURFACE_MODES` stays as it is in 2B: deriving it from the supplied surfaces would make the missing-surface throw vacuous, so step 3 moves it with item 7.

**B3. The memoizing text painter (R11).** `PKG/src/render/painter-registry.ts` gains `createTextPainters(getCompiled)`, one painter per text item reused across compiles, replacing the workspace's local map and its function (`PostEditorWorkspace.svelte` 592-603). Task 7 adds it and the positive-path cases to tka's `PLUGIN/plugin.test.ts` and the package's `test/painter-registry.test.ts` (item 8).

### C. Host additions (R5, `HANDOFF_2B` item 2)

`PKG/src/host.ts` gains three optional members; `PKG/src/host-defaults.ts` resolves them:

```ts
export interface EditorNotify {
	success(message: string): void;
	error(message: string): void;
	info(message: string): void;
}

export interface EditorShortcuts {
	/**
	 * Undo and redo keys while focus is in the editor. `scope` is an element the editor renders inside its section
	 * (`EditHistoryKeys.svelte`); a host may mount its own key targets there (tka: the undo bridge).
	 * Returns the unregister.
	 */
	editHistory(
		handlers: {
			undo(): void;
			redo(): void;
			canUndo(): boolean;
			canRedo(): boolean;
		},
		scope: HTMLElement,
	): () => void;
	/** Escape closes the topmost layer first (drawers, dialogs, the crop screen). Returns the unregister. */
	escapeLayer(id: string, close: () => void): () => void;
	/** While test(event) is true the key is not a shortcut (a drag owns Escape). Returns the unregister. */
	suppress(test: (event: KeyboardEvent) => boolean): () => void;
}

export type EditorHaptic = (kind: "selection" | "success" | "warning") => void;

// VideoEditorHost<E> gains:
//   notify?: EditorNotify;
//   shortcuts?: EditorShortcuts;
//   haptics?: EditorHaptic;
// and its existing members change: LibraryTake gains detail?: string; MediaLibrary gains
// onChange?(listener: () => void): () => void; previewCache's doc comment says that without it the
// editor plays original files (the default is createUnsupportedPreviewCache()).

// host-defaults.ts (Task 4) resolves them into:
export interface EditorServices {
	notify: EditorNotify;
	shortcuts: EditorShortcuts;
	haptics: EditorHaptic;
	previewCache: IPreviewVideoCache;
	mediaLibrary: MediaLibrary | null;
}
```

Defaults (`host-defaults.ts`, `resolveServices(host)` returning `EditorServices`): `notify` is a no-op that writes to `console.info` or `console.error` only when `host.dev` is true; `shortcuts` is one `keydown` listener on `window`, there while anything is registered, that ignores keys typed into an input, a textarea, a select or a contenteditable element, checks the suppressors first, then pops the topmost escape layer on Escape, then maps Ctrl or Cmd+Z to undo and Ctrl or Cmd+Shift+Z and Ctrl+Y to redo for the newest history whose editor holds focus: focus inside the nearest `[data-edit-history-shortcut-scope]` around its `scope` (the editor section; the scope itself when there is none), or no focus at all (`document.activeElement` is `document.body` or null); `haptics` is a no-op; `previewCache` is `host.previewCache ?? createUnsupportedPreviewCache()`, a full `IPreviewVideoCache` whose handles report `{ status: "fallback", sourceUrl, url: sourceUrl, progress: 0, reason: "No preview cache" }`, so every take plays its original file; `mediaLibrary` is `host.mediaLibrary ?? null`. tka passes its own in `PUI/tka-host.ts` (Task 4): `notify` from `toast-state.svelte` (the functions `PostEditorWorkspace.svelte` imports at line 147), `shortcuts` from `getKeyboardShortcutManager()` and `getEscapeLayerManager()`, with `editHistory` mounting tka's own `EditHistoryShortcutBridge.svelte` into `scope` (tka's keyboard manager presses the bridge's hidden buttons, and `resolveShortcutTarget`, `keyboard/domain/shortcut-target-resolution.ts:200-242`, keeps only targets inside the focused `[data-edit-history-shortcut-scope]`, which the editor section carries, so a bridge mounted in `document.body` would never be pressed while focus is in the editor); `haptics` from `getHapticFeedback()`; and `mediaLibrary` over the per-sequence store (`PUI/tka-media-library.svelte.ts`). tka's `previewCache` stays where it is, `getPreviewVideoCache()` in the wrapper's host literal. `haptics` is not in the spec's host contract; it is added because the copied `ConfirmDialog` and `DrawerHeader` vibrate on tka's phone app today, and dropping that would change behaviour. Task 23 records it in the spec.

**The `mediaLibrary` decision.** The picker drives the async `host.mediaLibrary`; `options.libraryTake` stays. The library list in `PostMediaPanel.svelte` and the saved videos in `PostAddPanel.svelte` (fed today by tka's per-sequence store through the workspace's `catalog`, lines 270-292) come from `mediaLibrary.listTakes()`, which the workspace calls when it opens and again whenever `mediaLibrary.onChange` fires (Task 15a), so a video uploaded elsewhere still appears without reopening (tka's comment at 270 promises that). `MediaLibrary` gains `onChange?(listener: () => void): () => void` for that, and `LibraryTake` gains `detail?: string`, the note the list shows after the duration (tka: "timing saved" on a video with an older map). The panels take `catalog: readonly LibraryTake[]`, and the media panel also `catalogLoading` and `catalogError` (Task 12). Adding a take calls `editor.addLibraryVideo({ videoId: take.id, label: take.label, url: take.url, durationSeconds: take.durationSeconds })`. `options.libraryTake` is a different job: the state resolves saved library takes synchronously while loading and relinking (`video-editor-state.svelte.ts` 679 and 791), and making that async would change load order, which parity guards. tka's wrapper keeps answering it from the same store; its `addLibraryVideo` forward looks the video up again with `deps.getCatalogVideo(video.videoId)` so tka's `legacyStepMap` still reaches `rememberLegacy` (Task 12). A host with no `mediaLibrary` gets no library section.

### D. Strings

- The package table `PKG/src/strings/en.ts` grows to every key the moved UI and the copied kit use, under tka's key names, with tka's English text. Keys are added per task: the task that prepares a file (Task 16 for all moved files, Task 10 for the kit) runs this read-only census on exactly the files it touches and adds the printed keys to `EN` in alphabetical order:
  ```bash
  cd /e/worktrees/tka-platform/video-editor && node -e "const fs=require('fs');const en=JSON.parse(fs.readFileSync('messages/en.json','utf8'));const keys=new Set();for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/[\x22\x27]([a-z0-9]+(_[a-z0-9]+)+)[\x22\x27]/g)){if(Object.hasOwn(en,m[1]))keys.add(m[1]);}}for(const k of [...keys].sort())console.log(k+'\t'+JSON.stringify(en[k]));" <files...>
  ```
  It prints `key<TAB>"English"` for every quoted string in those files that is a key of `messages/en.json`, which catches both arms of the seven ternary keys (`post-crop-session.svelte.ts`, `PostKeyframeControls.svelte` twice, `PostTimeline.svelte`, `PostTimelineKeyLaneHeader.svelte`, `PostTimelineTrackHeader.svelte` twice). Expected on the whole moving set: 280 keys (the 324 distinct keys under `PS` minus the 44 only `builder/` uses), plus the kit's. Run it with the Write tool's file if the shell mangles `\x22`: the implementer saves the script to `$SCRATCH/keys.cjs` with the Write tool and runs `node "$SCRATCH/keys.cjs" <files>`.
- Placeholders: tka's texts use lowercase names only (`{x} {y} {time} {count} {name} {start} {end} {range} {take} {percent} {number} {speed} {label} {channel} {curve}`), which `formatString`'s `[a-z_]+` fills. The table's doc comment already forbids other shapes; Task 16's test asserts every `EN` value's placeholders match `[{][a-z_]+[}]`.
- Components read `t` from context. `PKG/src/strings/context.ts`:
  ```ts
  import { getContext, setContext } from "svelte";
  import { englishString, type Translate } from "./translate.js";

  const STRINGS = Symbol("video-editor-strings");

  export function provideStrings(translate: Translate): Translate {
  	setContext(STRINGS, translate);
  	return translate;
  }

  /** The translate the nearest <VideoEditor> (or a test) provided, else English. Call during component init. */
  export function useStrings(): Translate {
  	return getContext<Translate | undefined>(STRINGS) ?? englishString;
  }
  ```
  A moved component replaces `import { t } from "$lib/shared/i18n/i18n.svelte.js";` with `import { useStrings } from "<relative>/strings/context.js";` and `const t = useStrings();` as the first line of its script, so every `t("key")` call stays as it is. A `.ts` module that calls `t` (`post-editor-files.ts`, `post-crop-session.svelte.ts`) takes `t: Translate` as a parameter from its component caller.
- tka keeps working through `host.translate`. `VideoEditor` calls `provideStrings(translatorFor(host))`. tka's host translate is `tkaEditorTranslate` (`MC/state/editor-strings.ts`), widened in Task 3 to pass any package key straight to tka's `t(key, params)` (tka's keys are the package keys), keeping its five overrides. While the files are still in tka (Tasks 16 and 17 until Task 22), `PostStudio.svelte` calls `provideStrings(tkaEditorTranslate)` so the converted files read tka's `t` through the package context; tka's locale switching keeps working because `t` reads tka's current locale on every call.
- `./strings` subpath (`src/strings/index.ts`, Task 3) exports `EN`, `StringKey`, `Translate`, `englishString`, `formatString`, `translatorFor`, `provideStrings`, `useStrings`. tka's `editor-strings.ts` imports from it (`HANDOFF_2B` item 4). The root entry keeps re-exporting the same names.
- R12 (`HANDOFF_2B` item 1): `store_verify_failed` ("The post could not be verified in device storage."), `store_save_failed` ("The post could not be saved on this device.") and `store_unavailable` ("Device storage is unavailable. The current post was kept.") join `EN` with today's text unchanged, so tka's tests still match; `DeviceStoreOptions` gains `translate?: Translate` and the store says them through `translatorFor({ translate: options.translate })`.

### E. Icons

`PKG/src/ui/kit/Icon.svelte`:

```svelte
<script lang="ts">
	import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

	interface Props {
		icon: IconDefinition;
		/** Turns once every two seconds, as Font Awesome's spin did. */
		spin?: boolean;
		/** Set for an icon that is the only content of a control; otherwise the icon is hidden from assistive tech. */
		label?: string;
		class?: string;
	}

	let { icon, spin = false, label, class: extra = "" }: Props = $props();
	const width = $derived(icon.icon[0]);
	const height = $derived(icon.icon[1]);
	const paths = $derived(Array.isArray(icon.icon[4]) ? icon.icon[4] : [icon.icon[4]]);
</script>

<svg
	class="ve-icon {extra}"
	class:spin
	viewBox="0 0 {width} {height}"
	role={label ? "img" : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : "true"}
	focusable="false"
>
	{#each paths as d (d)}
		<path fill="currentColor" {d} />
	{/each}
</svg>

<style>
	.ve-icon {
		display: inline-block;
		width: 1.25em;
		height: 1em;
		overflow: visible;
		vertical-align: -0.125em;
		flex-shrink: 0;
	}
	.spin {
		animation: ve-icon-spin 2s linear infinite;
	}
	@keyframes ve-icon-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
```

The size rules match Font Awesome 7's defaults for an `<i class="fa-solid">` glyph (fixed width 1.25em is the v7 default, 1em tall, baseline offset -0.125em), so a converted icon takes the same box. A parent style rule that targets the old icon (`i`, `.fa-solid` or a `.fa-*` class) becomes `:global(.ve-icon)` under the same parent selector, because the svg is inside a child component and scoped styles do not reach it.

`PKG/src/ui/kit/icons.ts` is the single import point for icon data: one line `export { faArrowLeft, faArrowRightFromBracket, ... } from "@fortawesome/free-solid-svg-icons";` with every name in the table below. Components import from `./icons.js` (or `../kit/icons.js`), never from Font Awesome directly. `src/icons/index.ts` (the `./icons` subpath) re-exports `KIT/icons.ts` and `type IconDefinition`, for tka's plugin UI to hand icons to package rows.

The rule: `fa-a-b-c` becomes `faABC` (each hyphen-separated word capitalised, prefixed `fa`). All 84 icon classes in the moving files (recounted while planning: every `PS` file outside `builder/` and the 21 `PUI` files, modifiers left out) are solid; none is regular or brands. `fa-solid` disappears; `fa-spin` becomes `spin`; `fa-fw` becomes nothing (v7 icons are fixed width already). The full table, which the Task 8 test imports name by name:

| Class | Export | Class | Export |
| --- | --- | --- | --- |
| `fa-arrow-left` | `faArrowLeft` | `fa-hand-pointer` | `faHandPointer` |
| `fa-arrow-right-from-bracket` | `faArrowRightFromBracket` | `fa-hashtag` | `faHashtag` |
| `fa-arrow-right-to-bracket` | `faArrowRightToBracket` | `fa-heading` | `faHeading` |
| `fa-arrows-left-right` | `faArrowsLeftRight` | `fa-id-card` | `faIdCard` |
| `fa-arrows-left-right-to-line` | `faArrowsLeftRightToLine` | `fa-image` | `faImage` |
| `fa-arrows-rotate` | `faArrowsRotate` | `fa-images` | `faImages` |
| `fa-arrows-up-down-left-right` | `faArrowsUpDownLeftRight` | `fa-left-right` | `faLeftRight` |
| `fa-backward-fast` | `faBackwardFast` | `fa-link` | `faLink` |
| `fa-backward-step` | `faBackwardStep` | `fa-location-crosshairs` | `faLocationCrosshairs` |
| `fa-border-top-left` | `faBorderTopLeft` | `fa-lock` | `faLock` |
| `fa-check` | `faCheck` | `fa-lock-open` | `faLockOpen` |
| `fa-chevron-down` | `faChevronDown` | `fa-magnifying-glass` | `faMagnifyingGlass` |
| `fa-chevron-left` | `faChevronLeft` | `fa-magnifying-glass-minus` | `faMagnifyingGlassMinus` |
| `fa-chevron-right` | `faChevronRight` | `fa-magnifying-glass-plus` | `faMagnifyingGlassPlus` |
| `fa-circle-check` | `faCircleCheck` | `fa-minus` | `faMinus` |
| `fa-circle-exclamation` | `faCircleExclamation` | `fa-music` | `faMusic` |
| `fa-circle-half-stroke` | `faCircleHalfStroke` | `fa-palette` | `faPalette` |
| `fa-circle-nodes` | `faCircleNodes` | `fa-pause` | `faPause` |
| `fa-clock` | `faClock` | `fa-pen` | `faPen` |
| `fa-clone` | `faClone` | `fa-person-running` | `faPersonRunning` |
| `fa-cloud` | `faCloud` | `fa-photo-film` | `faPhotoFilm` |
| `fa-crop-simple` | `faCropSimple` | `fa-play` | `faPlay` |
| `fa-diamond` | `faDiamond` | `fa-plus` | `faPlus` |
| `fa-download` | `faDownload` | `fa-right-left` | `faRightLeft` |
| `fa-drum` | `faDrum` | `fa-rotate` | `faRotate` |
| `fa-expand` | `faExpand` | `fa-rotate-left` | `faRotateLeft` |
| `fa-eye` | `faEye` | `fa-rotate-right` | `faRotateRight` |
| `fa-eye-slash` | `faEyeSlash` | `fa-ruler-combined` | `faRulerCombined` |
| `fa-fan` | `faFan` | `fa-scissors` | `faScissors` |
| `fa-file-export` | `faFileExport` | `fa-shapes` | `faShapes` |
| `fa-file-import` | `faFileImport` | `fa-share` | `faShare` |
| `fa-film` | `faFilm` | `fa-shuffle` | `faShuffle` |
| `fa-floppy-disk` | `faFloppyDisk` | `fa-sliders` | `faSliders` |
| `fa-font` | `faFont` | `fa-spinner` | `faSpinner` |
| `fa-forward-fast` | `faForwardFast` | `fa-sun` | `faSun` |
| `fa-forward-step` | `faForwardStep` | `fa-table-cells` | `faTableCells` |
| `fa-gauge-high` | `faGaugeHigh` | `fa-table-cells-large` | `faTableCellsLarge` |
| `fa-trash-can` | `faTrashCan` | `fa-triangle-exclamation` | `faTriangleExclamation` |
| `fa-up-down-left-right` | `faUpDownLeftRight` | `fa-upload` | `faUpload` |
| `fa-volume-high` | `faVolumeHigh` | `fa-volume-xmark` | `faVolumeXmark` |
| `fa-wand-magic-sparkles` | `faWandMagicSparkles` | `fa-wand-sparkles` | `faWandSparkles` |
| `fa-wave-square` | `faWaveSquare` | `fa-xmark` | `faXmark` |

The census's 89 distinct `fa-` strings across `PS` include the modifiers `fa-solid` and `fa-spin`; 3 more icons live only in `builder/` and `PUI` files, which stay in tka and keep their `<i>` tags. The kit copies' 10 classes (OverflowMenu 2, DrawerHeader 2, ConfirmDialog 5, ExportTakeover 1) are collected by Task 10 with the same rule and added to `icons.ts`; Task 10's report lists them. Class strings held in data (the `KIND_ICON` map in `post-editor-labels.ts`, the `icon:` fields of `readout` snippet calls in `PostItemTool.svelte`, tool icons in `post-editor-tools.ts`) become `IconDefinition` values of the same name; `PostTimelineItem.svelte:129`'s `class={tunnel ? "fa-solid fa-fan" : KIND_ICON[item.kind]}` becomes `<Icon icon={part?.icon ?? kindIcon(item.kind)} />`.

### F. Popover and dialog without bits-ui

`KIT/Popover.svelte` replaces bits-ui `Popover` in `PostTimelineZoomControls.svelte` (and serves `ConfirmDialog`'s copy with `modal`). Contract: props `open` (bindable), `anchor: HTMLElement | null`, `placement: "top" | "bottom"` (default `"top"`, what the zoom control uses today), `onclose`, `children` snippet; renders a `position: fixed` panel placed from `anchor.getBoundingClientRect()` on open and on window resize and scroll, closes on an outside pointerdown and on Escape through `services.shortcuts.escapeLayer`, returns focus to the anchor on close, and carries `role="dialog"`. The zoom control's three `--bits-popover-*` CSS variables become the panel's own styles with the same values. `ConfirmDialog`'s copy replaces bits-ui `AlertDialog` with a fixed overlay plus panel (`role="alertdialog"`, `aria-modal="true"`, focus trapped with `KIT/drawer/focus-trap.ts`, Escape through `escapeLayer`). Component tests in Task 10: Popover opens beside its anchor and closes on outside click and Escape; ConfirmDialog confirms, cancels, traps Tab and closes on Escape.

### G. The monolith splits

Each split runs in tka first (Tasks 12 to 15b). The TKA parts leave for `PUI`; the generic remainder calls the plugin members above; tka passes `createTkaEditorPlugin()` through a temporary prop or context from `PostStudio.svelte`, so tka keeps rendering the same screen through its own copies until Task 20 moves them. tka's tests and the component gate prove each split changed nothing; screenshots in Task 23 prove the look.

**G1. `PostEditorWorkspace.svelte` (3,932; Tasks 15a and 15b), by section of its script (line ranges at `32f1ee5675`):**

| Lines | Section | After the split |
| --- | --- | --- |
| 1-264 | imports, props (`Props` 208-239, destructure 241-264) | TKA props leave (design A); `sequence` reads go through the TKA context in `PUI` only |
| 266-268, 2113-2143 | viewer surfaces (`getViewerStudioSurfaces`, external inspector, `setInspectorContent`, `setControls`, playing sync) | `PUI/TkaViewerBridge.svelte`, rendered by `TkaEditorScope`; it computes `inspectorTarget` and passes it to `VideoEditor` |
| 270-292 | per-sequence catalog | a generic load of `services.mediaLibrary` (design C, Task 15a); tka's library is `createTkaMediaLibrary` over the per-sequence store (`PUI/tka-media-library.svelte.ts`, Task 4); `TkaEditorScope` keeps the store's own list for `getCatalogVideo` and the hand labeling |
| 298-345 | editor creation, prop type | `TkaEditorScope` creates the wrapper and owns the prop type; the workspace receives `editor` (Task 15a) |
| 347 | video previews | stays, reading `services.previewCache` (the host's cache, else Task 4's unsupported cache) in place of `getPreviewVideoCache()` (Task 15a) |
| 358 | timing session | created by `TkaEditorScope` (Task 15a), its preview resolver filled from `createBindings`'s `previewUrl`; rendered by the `timing` mode in `PUI/tka-timing-mode.ts` (Task 15b) |
| 370-447 | autosave, tab sync, feature-video connect | autosave and tab sync stay; the feature connect moves to `TkaEditorScope` |
| 449 | header context | stays |
| 540-562 | labeled card, hand labeling | `PUI/tka-painters.svelte.ts` |
| 564-856 | painters and `bindingFor` | core roles (image, take video, text with `createTextPainters`) stay; staff, titles, moves, strip, carousel, overlay, choreo-card and sequence roles go to `ui.createBindings` in `PUI/tka-painters.svelte.ts`; `exportPainters()` merges core and plugin maps; the `hasAnimationOverlay` dependency of the wrapper reads a holder `TkaEditorScope` shares with the bindings |
| 624-654 | staff tip analysis and staff painters | `PUI`, inside the bindings and the plugin tool panel |
| 858-1069 | screen state | stays; `showTimingStage` becomes `activeMode !== null` where `activeMode = plugin?.ui?.modes?.find((m) => m.id === editor.mode) ?? null` |
| 1070-1408 | tools | stays, through `ui.tools`, `ui.toolRow` and `ui.panels` |
| 1409-1730 | actions | stays except `openBeats` and `openTakeBeats` (1412-1431; each sets `editor.mode = "timing"`, at 1415 and 1430), which become the `beats` action tool in `ui.tools` setting `editor.mode = "timing"` |
| 1731-1859 | keyframe rows | stays |
| 1860-2112 | keys | stays; timing keys (1923, 1945) move to the mode's `keydown`; the keyboard manager's set-up (`getKeyboardShortcutManager().initialize()` and `registerEditHistoryShortcuts`, onMount 362-368) moves to `TkaEditorScope` (Task 15a); the editor's `EditHistoryShortcutBridge` becomes `EditHistoryKeys.svelte` over `services.shortcuts.editHistory(handlers, scope)` (Task 15b) |
| 2144-2330 | focus, playback loop | stays; the playback surface name reads the active mode id |
| 2331-2537 | render and export | stays; `createTkaSurfaces()` (2428) becomes `plugin?.createSurfaces?.()`; the InShot recovery package and backup download (`inshot-recovery-package`, `post-project-backup`, 160 and 175) go to `PUI/TkaBackupPanel.svelte` through `ui.panels` |

Template: the timing branches (2645-2654, 2846-2864 the `timingPanel` snippet, 2888-2902 the session's `EditHistoryShortcutBridge`, 2913-2935 the timing toolbar, 2943-2955, 3003, 3034-3041, 3212, 3299-3325 the settings `Drawer`) render the active mode's `toolbar`, `dock`, `panel`, `stage` and `timeline` slots; `tool === "look"` (2716) renders `ui.panels.look` (`PUI/TkaLookPanel.svelte` wrapping `AnimationPanel`); `ExportTakeover` comes from `KIT`. The timing toolbar (2913-2935: the Back button, the take `<select>` at 2923 and `{@render draftStatus()}`) and the session undo bridge (2888-2894, and again inside the drawer at 3315-3320) go to `EditorMode.toolbar` (`TkaTimingToolbar`, Task 15b Step 5), which renders tka's own bridge for the session. The `<select>` therefore leaves with the timing mode and stays in tka; it is not a step 3 item for the package.

**G2. `PostEditorCanvas.svelte` (3,302; Task 14):** props `sequence`, `cardRenderOptions`, `qrSequence` and `showStripGuide` leave. `pressFrame` (798-815) asks the hit item's kind `ui.parts` for a part whose span holds `editor.previewSeconds` and calls `editor.selectPart`. `hookChromeOpacity` (303), `paintedLabelRegions` (491), `stripGuideVisible` (503), `OPENING_POSITION` (516), `cardOptionsForItem`, `posterQrAppearance`, `animationAppearanceForItem` and every TKA prop of the media layer call (the `<PostStudioMediaLayer` call spans 2398-2470) move to `PUI/tka-canvas-layer.ts` and `PUI/TkaMediaSublayer.svelte`. The strip guide (2484-2493) becomes `PUI/TkaStripGuide.svelte` in `ui.canvasOverlays`. `class:crop-bare` (2388) reads a new optional `CompositionSourceBinding.bareWhileCropping` that tka's bindings set on staff roles. `getKeyboardShortcutManager().addInputSuppressor` (1389) becomes `services.shortcuts.suppress`.

**G3. `PostItemTool.svelte` (1,764; Task 13):** the core branches stay (trim, timing, position, source crop for video and image, speed and volume for video, border, fade, video effects (color grade and the InShot note), text, rename). These leave: to the animation kind's `ui.toolPanel` (`PUI/TkaKindTools.svelte`, one component switching on `item.kind`): crop of an animation backdrop (1107-1150), tunnel speed (1151-1178), tunnel appearance (1430-1440), animation and moves appearance (1441-1448), labels (1507-1525), shows (1526-1533); to the titles kind's: titles (1179-1192); to `ui.toolPanel` (`PUI/TkaItemTools.svelte`): replace video with the live animation (946-958, after trim), looks (1225-1242, tool `layout`), staff effects (1419-1429, after effects), card appearance (1449-1485), QR image appearance (1486-1504), sequence actions (1505-1506). Script functions used only by those branches move with them (`replaceWithLiveAnimation`, `setLook`, the tunnel appearance and hook functions, 341-441). Snippets those branches render (`readout`) become components in `UI/editor/item-tool/` exported from `./ui`. Style rules those branches use (`.actions`, `.hint`, and any other class the moved markup carries) are copied into the receiving `PUI` component, so the panels look the same. Props `staffTips`, `tunnel` and `featureMode` leave (the TKA components read them from the TKA context).

**G4. `PostTimeline.svelte` (2,066; Task 14):** `tunnelEndOf` and the tunnel block (263-324) become a generic part split driven by the kind's `ui.parts`; `crossfadeKinds` (417-424) becomes the core visual kinds plus every plugin kind whose definition has `transitionVisual`; `selectedPart`, `onSelectTunnel` (81-87, 162, 166, 803-816, 1586-1610) become `selectedPart: string | null` and `onSelectPart(itemId, part)`; `PostTimelineItem.svelte`'s `tunnel` prop becomes `part`. The handoff pair (`post-timeline-selection.ts`) comes from `ui.timelineJoin`.

**G5. `PostStudioMediaLayer.svelte` (873; Task 14):** the four branches for `sequence-animation`, `choreo-card`, `tunnel` and `mandala` (710-758) render `ui.mediaSublayer.component` when `binding.renderMode` is in its `renderModes`; props `sequence`, `qrSequence`, `qrUrl`, `cardRenderOptions`, `qrAppearance`, `animationAppearance`, `tunnelHook`, `chromeOpacity`, `mandalaIn`, `lookBlend`, `effectsIn`, `sequencePosition`, `sequencePassIndex`, `sequenceProgress`, `animationTimeSeconds`, `breakdownMotion`, `breakdownMode`, `labelsPainted` and `displayedBeatNumber` leave (the sublayer derives them from `layer`, `sourceItem` and the TKA context). `VisualSequenceSaveContextMenuHost` (832) is mounted once in `TkaEditorScope`; `handleContextMenu` (509-513) calls `plugin.ui.layerContextMenu`. The video branch keeps the per-update `muted` assignment (open-items).

### H. Where `PostStudio.svelte`'s TKA props go

`PUI/tka-editor-context.ts` defines `TkaEditorContext` (`sequence`, `displaySequence`, `qrSequence`, `cardRenderOptions`, `cardPreviewUrl`, `animationPreviewUrl`, `animationPreviewType`, `isPreparingCard`, `isPreparingAnimation`, `onRequestAnimation`, `feature`, `selectedPropType`, `onPropChange`, `onProjectPropChange`, `staffTips`, `editor` as the full wrapper `PostEditorState`, `openSaveMenu(event)`), with `provideTkaEditor` and `useTkaEditor`. Task 15a adds the members the scope now owns for the workspace and the bindings: `timing` (the session), `catalogVideos` (the store's list, for the hand labeling), `previews` (the holder the bindings fill with `createBindings`'s `previewUrl`), `overlay` (the animation overlay holder `hasAnimationOverlay` reads) and `inspectorTarget` (the viewer bridge's inspector element). `PUI/TkaEditorScope.svelte` takes `PostStudio.svelte`'s props unchanged, does what it does today (effects and visibility contexts, `ps-slice` URL session, prop type, audio seed), creates the wrapper, provides the context, and renders its `children` snippet, inside which PostModule (Task 22) puts `<VideoEditor host plugin editor ...>`. `sharing` and `previewTarget` stay `VideoEditor` props (generic); `onRequestAnimation` and the preview URLs are read only by `PUI` components.

### I. Styling tokens

The moved UI reads tka's theme variables (`--theme-text` 130 uses, `--theme-accent` 101, `--theme-stroke` 48, `--theme-card` 31, `--theme-panel` 22, `--theme-primary` 14, `--theme-bg` 11, plus `--min-touch` 27, `--font-size-*` 20, `--transition-fast` 16, `--duration-fast` 7, `--semantic-*` 20). Task 17 renames each family in the moving files and the kit to `--ve-<same name>` (`var(--theme-text, #fff)` becomes `var(--ve-theme-text, #fff)`, keeping the fallback) and adds one line per name to `PKG/css/video-editor-tokens.css`: `--ve-theme-text: var(--theme-text, <today's fallback>);`. Component-local variables (`--post-*`, `--music-tint`, `--kind-tint`, `--take-ratio`, `--panel-alpha`, `--mapping-*`) are not renamed. The token rules apply to `.ve-root, .ve-portal` instead of `:root`, so they resolve where the editor sits and inherit any `--theme-*` override tka sets on an ancestor (a `:root` mapping would read only the document root's values). `VideoEditor`'s root element and every kit component that portals to `document.body` (Drawer, Popover, ConfirmDialog, ExportTakeover, BaseModal) carry the class. tka imports the token file once in `TkaEditorScope.svelte` (Task 17 in `PostStudio.svelte`, moved with it in Task 22). The 2A spike tokens (`--ve-bg`, `--ve-text` and the rest) stay as they are.

### J. One module instance

tka resolves the package `dist` through an alias outside `node_modules`, so Vite would give the package its own copies of shared libraries. 2A dedupes `svelte`, `mediabunny`, `zod` and `dexie` (`vite.config.ts`, the vitest configs). With the UI moving, `svelte` duplication would break contexts and runes across the boundary (getContext from tka components inside package components). Task 3 adds a component test in tka (`PUI/single-svelte.svelte.test.ts` with the probe `PUI/SingleSvelteProbe.svelte`; the components config only picks up `src/**/*.svelte.test.ts`) in which a tka component calls the package's `provideStrings` during its init and a tka child reads it back through the package's `useStrings`; with two Svelte copies the package's `setContext` runs outside any component of its own runtime and throws. `@fortawesome/free-solid-svg-icons` is not in tka's `node_modules`; `wavesurfer.js` and `realtime-bpm-analyzer` are (tka's own `builder/` and `bpm-analyzer.ts` keep using them). All three resolve from `PKG/node_modules` through the dist file's location and are not singletons, so they need no dedupe for correctness; the two tka also has may ship twice in tka's build, a size cost only (Task 22's report says whether `grep -l "WaveSurfer" .svelte-kit/output/client/_app/immutable/chunks/*.js | wc -l` prints more than 1; adding them to `resolve.dedupe` is a later decision). Task 22 checks `AudioDownloadStalledError` `instanceof` still holds (open-items) by the existing tka test that asserts it.

---

## Tasks

Order: tidy and tools (1, 2), package seams (3 to 10), tka moves inside tka (11), the splits in tka (12 to 15b), substitutions in tka (16, 17), moves into the package (18 to 20), the plugin-free editor test (21), the switch (22), the proof and the records (23). Until Task 22, tka renders its own copies and `/post` keeps working after every task.

### Task 1: Sync, baselines and the carried tidy (sonnet; review opus)

Closes `HANDOFF_2B` items 9, 10, 11, 12 and 17 and the open-items "Carried out of step 2A" bullets for the Task 13 nits and `music-edits`.

**Files:**
- Modify: `PKG/scripts/step1/forbidden-imports.mjs`
- Modify: `PKG/scripts/step1/check-intersection.mjs:20,63`
- Modify: `PKG/src/core/plan/presets.ts:227-231` (comment only)
- Create: `PKG/test/music-edits.test.ts`
- Modify: `TKA/src/lib/shared/media-composition/state/post-editor-state.svelte.ts:434`
- Modify: `TKA/docs/development/post-studio-manifest-bridge.md:26`

- [ ] **Step 1: Sync both branches.** From TKA: `git status --short` prints nothing; `git merge-base --is-ancestor main HEAD && echo synced`. If it does not print `synced`, run `git merge --no-ff main -m "Merge main into codex/video-editor (step 2B sync)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"` (never rebase). From PKGROOT, the same against shared-packages `main` with the message `Merge main into video-editor (step 2B sync)`; expected there: `git log HEAD..main --oneline` prints nothing and the ancestor check prints `synced`, so no merge runs and HEAD does not change (a non-empty log means `main` moved since planning: merge as above and report the new HEAD). Report both HEADs.
- [ ] **Step 2: Make `SCRATCH` and record the baselines.**
  ```bash
  mkdir -p /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2b
  cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test 2>&1 | tail -15
  cd /e/worktrees/tka-platform/video-editor && npm run check:fast > /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2b/check-baseline.txt 2>&1; tail -3 /c/Users/Austen/AppData/Local/Temp/claude/video-editor-step2b/check-baseline.txt
  ```
  Expected: the package passes with 37 vitest files, 268 tests and 38 node tests; tka's summary shows about 625 errors. Record both in the report. The controller then runs the tka test gate once to record the `test:ci` baseline.
- [ ] **Step 2a: Accessibility baseline (controller).** The controller writes `$SCRATCH/ax-capture.mjs` below, checks the port (`netstat -ano | findstr :5221` in PowerShell; empty), starts the `.claude/launch.json` entry `tka-video-editor-worktree` (port 5221, run from TKA, which still renders today's workspace) with the preview tool and records its PID. It runs `node "$SCRATCH/ax-capture.mjs" http://localhost:5221 "$SCRATCH" ax-baseline`, then the same with the prefix `ax-check`; `cmp "$SCRATCH/ax-baseline-$m.json" "$SCRATCH/ax-check-$m.json"` for each `m` in `edit crop timing` prints nothing (the capture is stable; a name that changes between runs, such as a clock readout, is masked in `clean` for every run and the mask is recorded). Then it stops the server by that PID. Task 23 Step 1a captures the same three files after the move and diffs them.
  ```js
  // $SCRATCH/ax-capture.mjs. Usage: node ax-capture.mjs <origin> <outDir> <prefix>
  // Writes <outDir>/<prefix>-<mode>.json: every focusable or labelled element in document order.
  import { writeFileSync } from "node:fs";
  import { withHeadlessPage } from "file:///E:/worktrees/shared-packages/video-editor/packages/video-editor/scripts/spike/cdp.mjs";

  const [base, out, prefix] = process.argv.slice(2);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Runs in the page through `(${walk})()`. Icon nodes are dropped and no id is recorded, so generated ids never differ.
  function walk() {
    const SELECTOR = "button, a[href], input, select, textarea, summary, [tabindex], [contenteditable='true'], [role], [aria-label]";
    const ICON = "svg, i, .ve-icon";
    const IMPLICIT = { BUTTON: "button", A: "link", SELECT: "combobox", TEXTAREA: "textbox", SUMMARY: "button" };
    const clean = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const text = (el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll(ICON).forEach((node) => node.remove());
      return copy.textContent;
    };
    const shown = (el) => !el.closest("[hidden], [inert], [aria-hidden='true']") && el.getClientRects().length > 0;
    const nameOf = (el) =>
      clean(
        el.getAttribute("aria-label") ||
          (el.getAttribute("aria-labelledby") ?? "")
            .split(" ")
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map(text)
            .join(" ") ||
          [...(el.labels ?? [])].map(text).join(" ") ||
          el.getAttribute("title") ||
          el.getAttribute("placeholder") ||
          text(el),
      );
    const roleOf = (el) =>
      el.getAttribute("role") ||
      (el.tagName === "INPUT" ? "input:" + (el.getAttribute("type") ?? "text") : IMPLICIT[el.tagName] ?? el.tagName.toLowerCase());
    return [...document.body.querySelectorAll(SELECTOR)]
      .filter((el) => !el.closest("svg") && !el.matches(ICON) && shown(el))
      .map((el) => ({
        role: roleOf(el),
        name: nameOf(el),
        pressed: el.getAttribute("aria-pressed"),
        selected: el.getAttribute("aria-selected"),
        disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
      }));
  }

  // The clicks that reach each mode; edit is the editor as it opens.
  const MODES = {
    edit: [],
    crop: [".post-timeline-item.kind-video", '[data-tool="crop"]'],
    timing: [".post-timeline-item.kind-video", '[data-tool="beats"]'],
  };

  for (const [mode, clicks] of Object.entries(MODES)) {
    const entries = await withHeadlessPage(
      `${base}/post?feature=generate-vertical`,
      async (page) => {
        await page.waitFor(`!!document.querySelector(".post-editor") || null`, 90_000);
        await sleep(2000);
        for (const selector of clicks) {
          const clicked = await page.evaluate(
            `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
          );
          if (!clicked) throw new Error(`${mode}: ${selector} is missing`);
          await sleep(700);
        }
        if (mode !== "edit") await page.waitFor(`!!document.querySelector('.post-editor[data-mode="${mode}"]') || null`, 15_000);
        await sleep(1000);
        return page.evaluate(`(${walk})()`);
      },
      { timeoutMs: 120_000 },
    );
    writeFileSync(`${out}/${prefix}-${mode}.json`, JSON.stringify(entries, null, 2) + "\n");
    console.log(mode, entries.length, "entries");
  }
  ```
  Each entry is `{ role, name, pressed, selected, disabled }`: `role` is the explicit `role`, else `input:<type>` for an input, else the implicit role of the tag, else the tag name; `name` is `aria-label`, else the `aria-labelledby` texts, else the label texts, else `title`, else `placeholder`, else the element's own text without its icons, whitespace collapsed; `pressed` and `selected` are the `aria-pressed` and `aria-selected` attributes or null.
- [ ] **Step 3: Extend the forbidden-imports gate.** In `forbidden-imports.mjs` the banned list gains Font Awesome's CSS package, and a class count follows the first loop:
  ```js
  const BANNED = [
  	"$lib",
  	"$app",
  	"$env",
  	"firebase",
  	"bits-ui",
  	"modern-screenshot",
  	"@fortawesome/fontawesome-free",
  ];
  ```
  ```js
  // Check 1b: no Font Awesome class string anywhere in the package source; icons are <Icon> data.
  const FA_CLASS = /(^|[\s"'`{])fa-[a-z][a-z0-9-]*/g;
  let faClasses = 0;
  for (const dir of srcDirs) {
  	for (const file of walk(dir, [".ts", ".svelte"])) {
  		const lines = fs.readFileSync(file, "utf8").split("\n");
  		lines.forEach((line, index) => {
  			const hits = line.match(FA_CLASS);
  			if (!hits) return;
  			console.log(`${file}:${index + 1}: ${hits.join(" ").trim()}`);
  			faClasses += hits.length;
  		});
  	}
  }
  console.log(`fa- classes: ${faClasses}`);
  ```
  The exit becomes `process.exit(forbidden === 0 && faClasses === 0 && unexported === 0 ? 0 : 1);`. Add one header comment line for check 1b.
- [ ] **Step 4: Run it.** From PKG: `node scripts/step1/forbidden-imports.mjs`. Expected: `forbidden imports: 0`, `fa- classes: 0`, `unexported package subpaths: 0`.
- [ ] **Step 5: Drop the dead `PNPM_STORE` replace (item 12).** Delete the `const PNPM_STORE = ...` line (20) and the `.replace(PNPM_STORE, "$1@$2")` line (63) of `check-intersection.mjs`. `grep -c PNPM_STORE scripts/step1/check-intersection.mjs` prints `0`; `node scripts/step1/check-intersection.mjs "$SCRATCH/check-baseline.txt" "$SCRATCH/check-baseline.txt"` prints `new 0`.
- [ ] **Step 6: Fix the stale comment (item 17).** The doc comment above `POST_STUDIO_SOURCES` in `presets.ts` becomes:
  ```ts
  /**
   * Every media type a slot can hold. This is the list the empty-slot chooser
   * renders and the only place a new source type has to be declared; the editor
   * reads roles, fit and clip shape from here rather than carrying its own switch.
   */
  ```
- [ ] **Step 7: Write the plugin-free music test (item 9).** `PKG/test/music-edits.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { createProjectSchema, normalizeProject } from "../src/core/index.js";
  import { removeMusic, setMusic } from "../src/core/edit/music-edits.js";
  import plain from "./fixtures/plain.project.json";

  const project = () => normalizeProject(createProjectSchema().parse(plain));
  const ctx = { now: 1 };
  const song = { url: "https://example.test/song.mp3", durationSeconds: 30, label: "Song" };

  describe("music edits without a plugin", () => {
  	it("adds a song from its first second", () => {
  		const next = setMusic(project(), song, ctx);
  		expect(next.music?.url).toBe(song.url);
  		expect(next.music?.label).toBe("Song");
  		expect(next.music?.sourceInSeconds).toBe(0);
  	});

  	it("removes the song and leaves a project without one as it is", () => {
  		const none = removeMusic(setMusic(project(), song, ctx), ctx);
  		expect(none.music).toBeUndefined();
  		expect(removeMusic(none, ctx)).toBe(none);
  	});
  });
  ```
  Run `pnpm --filter @austencloud/video-editor exec vitest run test/music-edits.test.ts`. Expected: 2 passed. It passes at once: the module exists, and the test pins behaviour that had no package coverage.
- [ ] **Step 8: tka nits (items 10, 11).** Line 434 of the wrapper becomes:
  ```ts
    /**
     * Releases the media. Forwards to the package state's dispose, which calls
     * the extension's dispose hook when it has one; the timing extension has none.
     */
  ```
  In the bridge doc line 26, after "`core/edit/project-edits.ts` of `@austencloud/video-editor`" insert " (the music ops in `core/edit/music-edits.ts`)", and change "for the titles, tunnel and recovered-PIP edits only tka has" to "for the titles and tunnel edits only tka has". First confirm with `grep -niE "pip" src/lib/shared/media-composition/services/post-project-ops.ts` that ops names no PIP edit; if it does, keep the PIP words and say so in the report.
- [ ] **Step 9: Gates.** Package gate (expected: 38 vitest files, 270 tests, 38 node tests), `node scripts/step1/forbidden-imports.mjs`, tka type gate (`new 0`), parity gate.
- [ ] **Step 10: Commit.**
  ```bash
  cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/scripts/step1/forbidden-imports.mjs packages/video-editor/scripts/step1/check-intersection.mjs packages/video-editor/src/core/plan/presets.ts packages/video-editor/test/music-edits.test.ts && git commit -m "chore(video-editor): step 2B tidy: icon-class gate, music edits test, stale comments" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  cd /e/worktrees/tka-platform/video-editor && git add src/lib/shared/media-composition/state/post-editor-state.svelte.ts docs/development/post-studio-manifest-bridge.md && git commit -m "chore(post): wrap the dispose comment and name the music edits module in the bridge doc" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  `<short hash>` is the package commit just made (`git -C /e/worktrees/shared-packages/video-editor rev-parse --short HEAD`); every later tka commit fills it the same way.

### Task 2: Move tools for components (sonnet; review opus)

**Files:**
- Create: `PKG/scripts/step2b/moves.json`
- Modify: `PKG/scripts/step1/lib.mjs` (`ENTRIES`, `placeText`)
- Modify: `PKG/scripts/step1/rewrite-imports.mjs` (default imports of a moved component)
- Modify: `PKG/scripts/step1/ascii.mjs` (script blocks of `.svelte` files)
- Modify: `PKG/test/step1-tools.test.mjs`

- [ ] **Step 1: The empty list.** `PKG/scripts/step2b/moves.json`:
  ```json
  {
  	"moves": [],
  	"splits": []
  }
  ```
  Later tasks append entries of the form `{ "task": 18, "from": "$lib/shared/share/components/post-studio/editor/post-box-drag", "to": "ui/editor/post-box-drag.ts", "entry": "@austencloud/video-editor/ui" }`. For a component the `from` keeps `.svelte` and the `to` ends in `.svelte`.
- [ ] **Step 2: Write the failing tool tests** in `test/step1-tools.test.mjs` (node test runner, as the file's existing cases):
  ```js
  test("placeText rewrites only the script blocks of a component and keeps .svelte", () => {
  	const text = [
  		'<script lang="ts">',
  		'  import Child from "$lib/shared/share/components/post-studio/editor/PostToolRow.svelte";',
  		'  import { clamp } from "$lib/shared/share/components/post-studio/editor/post-box-drag";',
  		"</script>",
  		'<p class="a">import x from "$lib/not/a/script";</p>',
  	].join("\n");
  	const placed = new Map([
  		["$lib/shared/share/components/post-studio/editor/PostToolRow.svelte", "ui/editor/PostToolRow.svelte"],
  		["$lib/shared/share/components/post-studio/editor/post-box-drag", "ui/editor/post-box-drag.ts"],
  	]);
  	const result = placeText({ text, source: "X.svelte", to: "ui/editor/X.svelte", placed });
  	assert.match(result.text, /from "[.][/]PostToolRow[.]svelte"/);
  	assert.match(result.text, /from "[.][/]post-box-drag[.]js"/);
  	assert.match(result.text, /<p class="a">import x from "[$]lib[/]not[/]a[/]script";<[/]p>/);
  });

  test("ENTRIES names the ui, strings and icons subpaths", () => {
  	for (const sub of ["ui", "strings", "icons"]) {
  		assert.ok(ENTRIES[`@austencloud/video-editor/${sub}`].endsWith(`/src/${sub}/index.ts`));
  	}
  });

  test("rewriteDefaultComponentImport turns a default import of a moved component into a named one", () => {
  	const line = 'import PostToolRow from "$lib/shared/share/components/post-studio/editor/PostToolRow.svelte";';
  	assert.equal(
  		rewriteDefaultComponentImport(line, "$lib/shared/share/components/post-studio/editor/PostToolRow.svelte", "@austencloud/video-editor/ui"),
  		'import { PostToolRow } from "@austencloud/video-editor/ui";',
  	);
  	const renamed = 'import Row from "$lib/x/PostToolRow.svelte";';
  	assert.equal(
  		rewriteDefaultComponentImport(renamed, "$lib/x/PostToolRow.svelte", "@austencloud/video-editor/ui"),
  		'import { PostToolRow as Row } from "@austencloud/video-editor/ui";',
  	);
  });
  ```
  Run `node --test test/step1-tools.test.mjs`. Expected: the three new tests fail (`ENTRIES[...]` undefined, `rewriteDefaultComponentImport` not exported, the component text parsed as TypeScript).
- [ ] **Step 3: `ENTRIES`.** Add three lines to `ENTRIES` in `lib.mjs`:
  ```js
  	"@austencloud/video-editor/ui": `${PKG}/src/ui/index.ts`,
  	"@austencloud/video-editor/strings": `${PKG}/src/strings/index.ts`,
  	"@austencloud/video-editor/icons": `${PKG}/src/icons/index.ts`,
  ```
  `definersIn` walks only `.ts`, so a component is found through its `index.ts` export line; every component a later task moves gets a line `export { default as PostToolRow } from "./editor/PostToolRow.svelte";` in `src/ui/index.ts` in the same task.
- [ ] **Step 4: `placeText` for components.** Rename the existing function to `placeScript` (unchanged body; its `relTo` already keeps `.svelte` and maps `.ts` to `.js`) and add:
  ```js
  /** A component is placed one script block at a time; its markup and styles are copied as they are. */
  export function placeText(args) {
  	if (!args.source.endsWith(".svelte")) return placeScript(args);
  	let text = args.text;
  	const rewrites = [];
  	const unresolved = [];
  	for (const [start, end] of [...scriptBlocks(text)].reverse()) {
  		const result = placeScript({ ...args, text: text.slice(start, end) });
  		text = text.slice(0, start) + result.text + text.slice(end);
  		rewrites.push(...result.rewrites);
  		unresolved.push(...result.unresolved);
  	}
  	return { text, rewrites, unresolved };
  }
  ```
  If `placeScript` returns more fields than these three, spread the last block's result first and say so in the report.
- [ ] **Step 5: Default imports in tka.** In `rewrite-imports.mjs` export:
  ```js
  /** `import X from "<moved>.svelte"` names the component through the entry instead. */
  export function rewriteDefaultComponentImport(line, from, entry) {
  	const match = line.match(/^(\s*)import\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\s+["']([^"']+)["'];?\s*$/);
  	if (!match || match[3] !== from || !from.endsWith(".svelte")) return line;
  	const exported = from.slice(from.lastIndexOf("/") + 1, -".svelte".length);
  	const local = match[2];
  	const name = local === exported ? exported : `${exported} as ${local}`;
  	return `${match[1]}import { ${name} } from "${entry}";`;
  }
  ```
  and call it, line by line inside each script block, for every move entry whose `from` ends in `.svelte`, before the existing specifier rewrite runs. Then run `node --test test/step1-tools.test.mjs`. Expected: all pass.
- [ ] **Step 6: `ascii.mjs` on components.** It parses TypeScript, so for a `.svelte` path it runs its rewrite on each `scriptBlocks` range and splices the result back, as in Step 4; markup and `<style>` stay for the hand table in the ground rules. Add a test case: a `.svelte` text with a script string holding a non-ASCII character and the same character in the markup; after the rewrite the script string is ASCII and the markup is unchanged.
- [ ] **Step 7: Gates.** Package gate; `STEP_MOVES=../step2b/moves.json node scripts/step1/move.mjs --task 0 --dry` prints no copy line and exits 0.
- [ ] **Step 8: Commit.**
  ```bash
  git add packages/video-editor/scripts/step2b/moves.json packages/video-editor/scripts/step1/lib.mjs packages/video-editor/scripts/step1/rewrite-imports.mjs packages/video-editor/scripts/step1/ascii.mjs packages/video-editor/test/step1-tools.test.mjs && git commit -m "chore(video-editor): move tools place components and name the ui, strings and icons entries" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 3: Strings subpath and context, the spike rename, one Svelte (sonnet; review opus)

Closes `HANDOFF_2B` items 1 (R12) and 4, and the design J probe.

**Files:**
- Create: `PKG/src/strings/context.ts`, `PKG/src/strings/index.ts`, `PKG/src/ui/index.ts`
- Rename: `PKG/src/ui/VideoEditor.svelte` to `PKG/src/ui/VideoEditorSpike.svelte` (`git mv`)
- Modify: `PKG/src/index.ts`, `PKG/package.json` (`exports`), `PKG/src/strings/en.ts`, `PKG/src/store/device-store.ts:28-40,150,163,171`, `PKG/src/state/video-editor-state.svelte.ts:222`
- Modify: `PKG/test/device-store.test.ts`, `PKG/test/strings.test.ts`
- Modify: `TKA/src/lib/shared/media-composition/state/editor-strings.ts`, `TKA/src/routes/test/video-editor-spike/+page.svelte`
- Create: `TKA/src/lib/shared/post-studio-plugin/ui/SingleSvelteProbe.svelte`, `.../ui/SingleSvelteReader.svelte`, `.../ui/single-svelte.svelte.test.ts`

- [ ] **Step 1: Failing package tests.** In `test/device-store.test.ts`, find the case that makes verification fail (`grep -n "could not be verified" test/device-store.test.ts`) and add a copy of it whose store is built with `translate: (key) => "x:" + key` added to its options; it expects `error` to be `"x:store_verify_failed"`. Add a second case: a store whose storage reader returns null, `backupBeforeImport` throws `"x:store_unavailable"`. The existing English assertions stay unchanged. In `test/strings.test.ts` add:
  ```ts
  it("holds the device store texts word for word", () => {
  	expect(EN.store_verify_failed).toBe("The post could not be verified in device storage.");
  	expect(EN.store_save_failed).toBe("The post could not be saved on this device.");
  	expect(EN.store_unavailable).toBe("Device storage is unavailable. The current post was kept.");
  });
  ```
  Run `pnpm --filter @austencloud/video-editor exec vitest run test/device-store.test.ts test/strings.test.ts`. Expected: the new cases fail.
- [ ] **Step 2: The store texts (item 1).** Add the three keys to `EN` with the texts above, copied from `device-store.ts` 150, 163 and 171 (they read "post" because tka's tests assert them; item 18's step 3 sweep may reword them later). In `device-store.ts`, `DeviceStoreOptions<E>` gains:
  ```ts
  	/** Says the store's own errors; English when absent. */
  	translate?: Translate;
  ```
  `createDeviceStore` starts with `const say = translatorFor(options.translate ? { translate: options.translate } : {});` and the three literals become `say("store_verify_failed")`, the `: say("store_save_failed")` fallback, and `throw new Error(say("store_unavailable"))`. In `video-editor-state.svelte.ts:222` the default store passes the host's translate:
  ```ts
  	const store =
  		host.store ??
  		createDeviceStore<E>({
  			...(plugin ? { plugin } : {}),
  			...(host.translate ? { translate: host.translate } : {}),
  		});
  ```
  Rerun the two test files. Expected: pass.
- [ ] **Step 3: The strings context.** Create `PKG/src/strings/context.ts` with the code in seam design D, and `PKG/src/strings/index.ts`:
  ```ts
  export { EN, type StringKey } from "./en.js";
  export { englishString, formatString, translatorFor, type Translate } from "./translate.js";
  export { provideStrings, useStrings } from "./context.js";
  ```
- [ ] **Step 4: Rename the spike.** `git mv packages/video-editor/src/ui/VideoEditor.svelte packages/video-editor/src/ui/VideoEditorSpike.svelte`. Its header comment's last sentence becomes "The real editor is `VideoEditor.svelte`; this spike stays until step 4." Create `PKG/src/ui/index.ts`:
  ```ts
  export { default as VideoEditorSpike } from "./VideoEditorSpike.svelte";
  ```
  In `src/index.ts`, the first line becomes `export { default as VideoEditorSpike } from "./ui/VideoEditorSpike.svelte";` and the strings line gains the context: `export { englishString, formatString, translatorFor, type Translate } from "./strings/translate.js";` stays and `export { provideStrings, useStrings } from "./strings/context.js";` is added under it.
- [ ] **Step 5: Exports map.** In `package.json` `exports`, after `"./encoder"`:
  ```json
  "./ui": {
  	"types": "./dist/ui/index.d.ts",
  	"svelte": "./dist/ui/index.js",
  	"import": "./dist/ui/index.js"
  },
  "./strings": {
  	"types": "./dist/strings/index.d.ts",
  	"import": "./dist/strings/index.js"
  },
  ```
- [ ] **Step 6: Package gate.** Expected: green; the counts grow by the three new cases. Then the runes proof on the build: from PKG, `grep -c "[$]state(" dist/state/video-editor-state.svelte.js` prints a number above 0 (5 at `HEAD` before 2B). Zero means svelte-package compiled the runes away or skipped the file, which tka's alias would then load without reactivity; it stops the task.
- [ ] **Step 7: tka imports (item 4).** `editor-strings.ts` imports from `@austencloud/video-editor/strings`, and keys other than the package's own `editor_` and `store_` keys go to tka's `t`, so tka's translations reach the moved UI from Task 16 on:
  ```ts
  /** The host translate tka hands the editor (seam design D). */
  export function tkaEditorTranslate(
    key: StringKey,
    params?: Record<string, string | number>
  ): string {
    if (key === "editor_default_take") return t("post_editor_default_take");
    const text = TKA_TEXT[key];
    if (text !== undefined) return formatString(text, params);
    if (key.startsWith("editor_") || key.startsWith("store_")) return englishString(key, params);
    return t(key, params);
  }
  ```
  If tka's `t` types its key as a narrower union, cast at the call (`t(key as Parameters<typeof t>[0], params)`) and say so. The spike page imports `VideoEditorSpike` and renders `<VideoEditorSpike />` where it rendered `<VideoEditor />`.
- [ ] **Step 8: The one-Svelte probe (design J).** `PUI/SingleSvelteProbe.svelte`:
  ```svelte
  <script lang="ts">
    import { provideStrings } from "@austencloud/video-editor/strings";
    import SingleSvelteReader from "./SingleSvelteReader.svelte";

    provideStrings((key) => `tka:${key}`);
  </script>

  <SingleSvelteReader />
  ```
  `PUI/SingleSvelteReader.svelte`:
  ```svelte
  <script lang="ts">
    import { useStrings } from "@austencloud/video-editor/strings";

    const t = useStrings();
  </script>

  <p data-testid="probe">{t("editor_default_take")}</p>
  ```
  `PUI/single-svelte.svelte.test.ts`:
  ```ts
  import { render } from "vitest-browser-svelte";
  import { describe, expect, it } from "vitest";
  import SingleSvelteProbe from "./SingleSvelteProbe.svelte";

  describe("one Svelte runtime across tka and the package", () => {
    it("reads, in a tka component, the strings a tka parent set through the package", async () => {
      const screen = render(SingleSvelteProbe);
      await expect.element(screen.getByTestId("probe")).toHaveTextContent("tka:editor_default_take");
    });
  });
  ```
  With two Svelte copies the package's `setContext` throws outside a component, or the reader falls back to English; either fails the test.
- [ ] **Step 9: tka gates.** Type gate (`new 0`); `npx vitest run --config tests/config/vitest.components.config.ts src/lib/shared/post-studio-plugin/ui/single-svelte.svelte.test.ts` passes; tka subset (the device-store and editor-strings assertions unchanged and green); parity; trace script; plugin closure gate (the probe imports a `.svelte` file from `ui/`, which the grep excludes); `node PKG/scripts/step1/forbidden-imports.mjs` (the `./strings` subpath is now in the exports map).
- [ ] **Step 10: Commit.**
  ```bash
  cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/src/strings/context.ts packages/video-editor/src/strings/index.ts packages/video-editor/src/strings/en.ts packages/video-editor/src/ui/index.ts packages/video-editor/src/ui/VideoEditorSpike.svelte packages/video-editor/src/ui/VideoEditor.svelte packages/video-editor/src/index.ts packages/video-editor/package.json packages/video-editor/src/store/device-store.ts packages/video-editor/src/state/video-editor-state.svelte.ts packages/video-editor/test/device-store.test.ts packages/video-editor/test/strings.test.ts && git commit -m "feat(video-editor): strings subpath and context, device store texts in the table, spike renamed" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  cd /e/worktrees/tka-platform/video-editor && git add src/lib/shared/media-composition/state/editor-strings.ts src/routes/test/video-editor-spike/+page.svelte src/lib/shared/post-studio-plugin/ui/SingleSvelteProbe.svelte src/lib/shared/post-studio-plugin/ui/SingleSvelteReader.svelte src/lib/shared/post-studio-plugin/ui/single-svelte.svelte.test.ts && git commit -m "refactor(post): editor strings from the package strings entry; one-Svelte probe" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 4: Host services and the wrapper's conformance (sonnet; review opus)

Closes `HANDOFF_2B` item 2 (R5, with the `mediaLibrary` decision of seam design C) and item 13 (R13).

**Files:**
- Modify: `PKG/src/host.ts`, `PKG/src/index.ts`
- Create: `PKG/src/host-defaults.ts`, `PKG/test/host-defaults.test.ts`
- Create: `TKA/src/lib/shared/post-studio-plugin/ui/tka-host.ts`, `TKA/src/lib/shared/post-studio-plugin/ui/tka-media-library.svelte.ts`
- Modify: `TKA/src/lib/shared/media-composition/state/post-editor-state.svelte.ts` (host literal at 84-93, the returned object, the end of the file)
- Modify: `TKA/src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte` (the `createPostEditorState` call at 298)

- [ ] **Step 1: Failing tests.** `PKG/test/host-defaults.test.ts` (unit project, jsdom):
  ```ts
  import { afterEach, describe, expect, it, vi } from "vitest";
  import { createWindowShortcuts, resolveServices } from "../src/host-defaults.js";

  const press = (init: KeyboardEventInit, target: EventTarget = window) =>
  	target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

  describe("default editor services", () => {
  	it("says nothing outside dev and logs in dev", () => {
  		const info = vi.spyOn(console, "info").mockImplementation(() => {});
  		resolveServices({ ownerId: "o" }).notify.success("saved");
  		expect(info).not.toHaveBeenCalled();
  		resolveServices({ ownerId: "o", dev: true }).notify.success("saved");
  		expect(info).toHaveBeenCalledWith("saved");
  		info.mockRestore();
  	});

  	it("keeps the services the host passes", () => {
  		const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  		expect(resolveServices({ ownerId: "o", notify }).notify).toBe(notify);
  	});

  	it("plays original files and lists no library when the host passes neither", async () => {
  		const services = resolveServices({ ownerId: "o" });
  		const url = "https://example.test/take.mp4";
  		const handle = services.previewCache.acquire(url);
  		const state = { status: "fallback", sourceUrl: url, url, progress: 0, reason: "No preview cache" };
  		expect(handle.getState()).toEqual(state);
  		await expect(handle.ready).resolves.toEqual(state);
  		const listener = vi.fn();
  		handle.subscribe(listener)();
  		handle.reportPlaybackError("decode");
  		handle.release();
  		expect(listener).not.toHaveBeenCalled();
  		expect(services.mediaLibrary).toBeNull();
  	});

  	it("keeps the host's preview cache and media library", () => {
  		const previewCache = { acquire: vi.fn() };
  		const mediaLibrary = { listTakes: vi.fn(), resolveTake: vi.fn(), requestFor: vi.fn() };
  		const services = resolveServices({ ownerId: "o", previewCache, mediaLibrary });
  		expect(services.previewCache).toBe(previewCache);
  		expect(services.mediaLibrary).toBe(mediaLibrary);
  	});
  });

  describe("window shortcuts", () => {
  	const shortcuts = createWindowShortcuts();
  	let stops: (() => void)[] = [];
  	afterEach(() => {
  		for (const stop of stops) stop();
  		stops = [];
  		document.body.replaceChildren();
  	});

  	it("undoes on Ctrl+Z and redoes on Ctrl+Shift+Z and Ctrl+Y", () => {
  		const undo = vi.fn();
  		const redo = vi.fn();
  		stops.push(shortcuts.editHistory({ undo, redo, canUndo: () => true, canRedo: () => true }, document.createElement("div")));
  		press({ key: "z", ctrlKey: true });
  		press({ key: "Z", ctrlKey: true, shiftKey: true });
  		press({ key: "y", ctrlKey: true });
  		expect(undo).toHaveBeenCalledTimes(1);
  		expect(redo).toHaveBeenCalledTimes(2);
  	});

  	it("does nothing when there is nothing to undo", () => {
  		const undo = vi.fn();
  		stops.push(shortcuts.editHistory({ undo, redo: vi.fn(), canUndo: () => false, canRedo: () => false }, document.createElement("div")));
  		press({ key: "z", ctrlKey: true });
  		expect(undo).not.toHaveBeenCalled();
  	});

  	it("leaves keys typed into a field alone", () => {
  		const undo = vi.fn();
  		stops.push(shortcuts.editHistory({ undo, redo: vi.fn(), canUndo: () => true, canRedo: () => true }, document.createElement("div")));
  		const input = document.createElement("input");
  		document.body.append(input);
  		press({ key: "z", ctrlKey: true }, input);
  		expect(undo).not.toHaveBeenCalled();
  	});

  	it("acts only while focus is in its editor or nowhere", () => {
  		const undo = vi.fn();
  		const section = document.createElement("section");
  		section.setAttribute("data-edit-history-shortcut-scope", "");
  		const anchor = document.createElement("span");
  		const inside = document.createElement("button");
  		const outside = document.createElement("button");
  		section.append(anchor, inside);
  		document.body.append(section, outside);
  		stops.push(shortcuts.editHistory({ undo, redo: vi.fn(), canUndo: () => true, canRedo: () => true }, anchor));
  		outside.focus();
  		press({ key: "z", ctrlKey: true }, outside);
  		expect(undo).not.toHaveBeenCalled();
  		inside.focus();
  		press({ key: "z", ctrlKey: true }, inside);
  		expect(undo).toHaveBeenCalledTimes(1);
  	});

  	it("closes the topmost escape layer first", () => {
  		const lower = vi.fn();
  		const upper = vi.fn();
  		stops.push(shortcuts.escapeLayer("lower", lower));
  		const closeUpper = shortcuts.escapeLayer("upper", upper);
  		press({ key: "Escape" });
  		closeUpper();
  		press({ key: "Escape" });
  		expect(upper).toHaveBeenCalledTimes(1);
  		expect(lower).toHaveBeenCalledTimes(1);
  	});

  	it("skips a key a suppressor claims", () => {
  		const close = vi.fn();
  		stops.push(shortcuts.escapeLayer("layer", close));
  		stops.push(shortcuts.suppress((event) => event.key === "Escape"));
  		press({ key: "Escape" });
  		expect(close).not.toHaveBeenCalled();
  	});

  	it("stops listening when the last registration goes", () => {
  		const remove = vi.spyOn(window, "removeEventListener");
  		const off = shortcuts.escapeLayer("only", vi.fn());
  		off();
  		expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  		remove.mockRestore();
  	});
  });
  ```
  Run `pnpm --filter @austencloud/video-editor exec vitest run test/host-defaults.test.ts`. Expected: fails, module not found.
- [ ] **Step 2: The host types.** Add the `EditorNotify`, `EditorShortcuts` and `EditorHaptic` declarations of seam design C to `host.ts`, and to `VideoEditorHost<E>`:
  ```ts
  	/** Toasts. Default: silent, or the console when `dev` is true. */
  	notify?: EditorNotify;
  	/** Undo and redo keys, Escape layers and key suppression. Default: one window keydown listener. */
  	shortcuts?: EditorShortcuts;
  	/** Vibration on a phone. Default: none. */
  	haptics?: EditorHaptic;
  ```
  and to `MediaLibrary`:
  ```ts
  	/** Calls the listener whenever the list may have changed; returns the unsubscribe. */
  	onChange?(listener: () => void): () => void;
  ```
  and to `LibraryTake`:
  ```ts
  	/** A short note the library list shows after the duration (tka: "timing saved"). */
  	detail?: string;
  ```
  `previewCache`'s doc comment becomes `/** The app-wide preview video cache the previews read. Default: an unsupported cache, so takes play their original files. */`.
- [ ] **Step 3: The defaults.** `PKG/src/host-defaults.ts`:
  ```ts
  import type { PreviewVideoState } from "./core/preview-video.js";
  import type { EditorHaptic, EditorNotify, EditorShortcuts, MediaLibrary, VideoEditorHost } from "./host.js";
  import type { IPreviewVideoCache } from "./render/preview-cache/preview-video-cache-contract.js";

  export interface EditorServices {
  	notify: EditorNotify;
  	shortcuts: EditorShortcuts;
  	haptics: EditorHaptic;
  	previewCache: IPreviewVideoCache;
  	/** Null when the host has none: the editor shows no library section. */
  	mediaLibrary: MediaLibrary | null;
  }

  /** The host's services, with the package defaults for any it leaves out. */
  export function resolveServices<E>(host: VideoEditorHost<E>): EditorServices {
  	return {
  		notify: host.notify ?? consoleNotify(host.dev === true),
  		shortcuts: host.shortcuts ?? createWindowShortcuts(),
  		haptics: host.haptics ?? (() => {}),
  		previewCache: host.previewCache ?? createUnsupportedPreviewCache(),
  		mediaLibrary: host.mediaLibrary ?? null,
  	};
  }

  /**
   * The preview cache for a host without one: it never makes a preview copy, so every handle is
   * already settled on the original file, the state the real cache falls back to.
   */
  export function createUnsupportedPreviewCache(): IPreviewVideoCache {
  	return {
  		acquire(sourceUrl) {
  			const state: PreviewVideoState = {
  				status: "fallback",
  				sourceUrl,
  				url: sourceUrl,
  				progress: 0,
  				reason: "No preview cache",
  			};
  			return {
  				getState: () => state,
  				ready: Promise.resolve(state),
  				subscribe: () => () => {},
  				reportPlaybackError: () => {},
  				release: () => {},
  			};
  		},
  	};
  }

  function consoleNotify(dev: boolean): EditorNotify {
  	return {
  		success: (message) => {
  			if (dev) console.info(message);
  		},
  		info: (message) => {
  			if (dev) console.info(message);
  		},
  		error: (message) => {
  			if (dev) console.error(message);
  		},
  	};
  }

  /** Keys typed into a field are text, not shortcuts. */
  function typing(target: EventTarget | null): boolean {
  	if (!(target instanceof HTMLElement)) return false;
  	return (
  		target.isContentEditable ||
  		target instanceof HTMLInputElement ||
  		target instanceof HTMLTextAreaElement ||
  		target instanceof HTMLSelectElement
  	);
  }

  interface HistoryHandlers {
  	undo(): void;
  	redo(): void;
  	canUndo(): boolean;
  	canRedo(): boolean;
  }

  interface History {
  	handlers: HistoryHandlers;
  	/** The element the editor registered from; its nearest edit-history scope is the editor. */
  	scope: HTMLElement;
  }

  /** Focus is inside the history's editor, or on nothing at all. */
  function owns(history: History): boolean {
  	const focus = document.activeElement;
  	if (focus === null || focus === document.body) return true;
  	const region = history.scope.closest("[data-edit-history-shortcut-scope]") ?? history.scope;
  	return region.contains(focus);
  }

  /**
   * One keydown listener on the window, there only while something is registered. Suppressors
   * run first; Escape closes the topmost layer; Ctrl or Cmd with Z undoes, with Shift+Z or Ctrl+Y
   * redoes, in the newest editor that holds focus, unless the key is typed into a field.
   */
  export function createWindowShortcuts(): EditorShortcuts {
  	const histories: History[] = [];
  	const layers: { id: string; close: () => void }[] = [];
  	const suppressors: ((event: KeyboardEvent) => boolean)[] = [];
  	let listening = false;

  	function onKeydown(event: KeyboardEvent): void {
  		if (suppressors.some((test) => test(event))) return;
  		if (event.key === "Escape") {
  			const top = layers.at(-1);
  			if (!top) return;
  			event.preventDefault();
  			top.close();
  			return;
  		}
  		const history = [...histories].reverse().find(owns)?.handlers;
  		if (!history || typing(event.target) || !(event.ctrlKey || event.metaKey)) return;
  		const key = event.key.toLowerCase();
  		const redo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey && !event.metaKey);
  		const undo = key === "z" && !event.shiftKey;
  		if (redo && history.canRedo()) {
  			event.preventDefault();
  			history.redo();
  		} else if (undo && history.canUndo()) {
  			event.preventDefault();
  			history.undo();
  		}
  	}

  	function sync(): void {
  		const wanted = histories.length + layers.length > 0;
  		if (wanted && !listening) window.addEventListener("keydown", onKeydown);
  		if (!wanted && listening) window.removeEventListener("keydown", onKeydown);
  		listening = wanted;
  	}

  	function add<T>(list: T[], entry: T): () => void {
  		list.push(entry);
  		sync();
  		return () => {
  			const index = list.indexOf(entry);
  			if (index >= 0) list.splice(index, 1);
  			sync();
  		};
  	}

  	return {
  		editHistory: (handlers, scope) => add(histories, { handlers, scope }),
  		escapeLayer: (id, close) => add(layers, { id, close }),
  		suppress: (test) => add(suppressors, test),
  	};
  }
  ```
  This is the default seam design C describes. In `src/index.ts`, the host type export becomes `export type { EditorHaptic, EditorNotify, EditorShortcuts, LibraryTake, MediaLibrary, VideoEditorHost } from "./host.js";` and `export { createUnsupportedPreviewCache, createWindowShortcuts, resolveServices, type EditorServices } from "./host-defaults.js";` is added. Rerun the test file. Expected: 11 passed.
- [ ] **Step 4: Package gate.**
- [ ] **Step 5: tka's services.** `PUI/tka-host.ts`:
  ```ts
  import { mount, unmount } from "svelte";
  import type { EditorShortcuts, VideoEditorHost } from "@austencloud/video-editor";
  import EditHistoryShortcutBridge from "$lib/shared/keyboard/components/EditHistoryShortcutBridge.svelte";
  import { getEscapeLayerManager } from "$lib/shared/keyboard/get-escape-layer-manager";
  import { getKeyboardShortcutManager } from "$lib/shared/keyboard/get-keyboard-shortcut-manager";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { SequenceVideosStore } from "$lib/shared/video-collaboration/state/sequence-videos-store.svelte";
  import { createTkaMediaLibrary } from "./tka-media-library.svelte";

  /**
   * tka's undo keys press hidden buttons the keyboard manager finds in the page, so the edit
   * history registration mounts the same bridge tka's screens render. It goes inside `scope`
   * (the editor's section): the manager keeps only targets inside the focused
   * `[data-edit-history-shortcut-scope]` (`shortcut-target-resolution.ts:200-242`).
   */
  const shortcuts: EditorShortcuts = {
    editHistory(handlers, scope) {
      const bridge = mount(EditHistoryShortcutBridge, {
        target: scope,
        props: {
          onUndo: handlers.undo,
          onRedo: handlers.redo,
          get canUndo() {
            return handlers.canUndo();
          },
          get canRedo() {
            return handlers.canRedo();
          },
        },
      });
      return () => void unmount(bridge);
    },
    escapeLayer: (id, close) =>
      getEscapeLayerManager().register({ id, dismiss: close, canDismiss: () => true }),
    suppress: (test) => getKeyboardShortcutManager().addInputSuppressor(test),
  };

  /**
   * The services tka hands the editor: its toasts, its shortcut managers, its haptics and, when
   * the post has a sequence, that sequence's saved videos as the media library.
   */
  export function tkaEditorServices(
    library: SequenceVideosStore | null,
  ): Pick<VideoEditorHost, "notify" | "shortcuts" | "haptics" | "mediaLibrary"> {
    return {
      notify: {
        success: (message) => void showToast({ message, type: "success" }),
        error: (message) => void showToast({ message, type: "error" }),
        info: (message) => void showToast({ message, type: "info" }),
      },
      shortcuts,
      haptics: (kind) => getHapticFeedback().trigger(kind),
      ...(library ? { mediaLibrary: createTkaMediaLibrary(library) } : {}),
    };
  }
  ```
  If `ToastType` or the haptic `trigger` parameter uses other names, map to the closest one and list the mapping in the report. The preview cache is not here: the wrapper's host already passes `previewCache: getPreviewVideoCache()` (Step 6).

  `PUI/tka-media-library.svelte.ts` (runes, so `.svelte.ts`) adapts the per-sequence store (`src/lib/shared/video-collaboration/state/sequence-videos-store.svelte.ts`, `getSequenceVideosStore(sequenceId)`, a rune store with `videos`, `loading`, `error` and `load()` but no subscribe) to `MediaLibrary`, with the workspace's filter and labels of lines 281-291:
  ```ts
  import { untrack } from "svelte";
  import type { LibraryTake, MediaLibrary } from "@austencloud/video-editor";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { SequenceVideosStore } from "$lib/shared/video-collaboration/state/sequence-videos-store.svelte";

  /** A saved video the editor can place: it has a file and a length. */
  function takeOf(video: CollaborativeVideo): LibraryTake | null {
    if (!video.videoUrl || !(video.duration > 0)) return null;
    return {
      id: video.id,
      label: video.description?.trim() || t("share_studio_saved_video"),
      url: video.videoUrl,
      durationSeconds: video.duration,
      ...(video.beatMap ? { detail: t("share_studio_timing_saved") } : {}),
    };
  }

  /**
   * One sequence's saved videos as the editor's library. The store has no subscribe, so onChange
   * watches it from an effect root; the store rewrites its array on every write (its header), so
   * reading `videos` and `error` sees each change. The first run only subscribes.
   */
  export function createTkaMediaLibrary(store: SequenceVideosStore): MediaLibrary {
    const takes = () =>
      store.videos.map(takeOf).filter((take): take is LibraryTake => take !== null);
    return {
      async listTakes() {
        await store.load();
        if (store.error) throw new Error(store.error);
        return takes();
      },
      async resolveTake(id) {
        await store.load();
        return takes().find((take) => take.id === id) ?? null;
      },
      requestFor: (url) => new Request(url),
      onChange(listener) {
        let first = true;
        return $effect.root(() => {
          $effect(() => {
            void store.videos;
            void store.error;
            if (first) {
              first = false;
              return;
            }
            untrack(listener);
          });
        });
      },
    };
  }
  ```
- [ ] **Step 6: The wrapper.** `PostEditorDeps` gains `services?: Pick<VideoEditorHost<PostTimingEffect>, "notify" | "shortcuts" | "haptics" | "mediaLibrary">;` (the wrapper itself never imports `PUI`, so its unit tests stay in jsdom without Svelte components). The host literal at 84-93 moves into a const passed to `createVideoEditorState`:
  ```ts
    const host: VideoEditorHost<PostTimingEffect> = {
      get ownerId() {
        return postOwnerId();
      },
      store: editorStoreOf(store),
      translate: tkaEditorTranslate,
      now,
      dev: import.meta.env.DEV,
      previewCache: getPreviewVideoCache(),
      ...deps.services,
    };
  ```
  The returned object gains `host,` (one line, before `mode`). At the end of the file:
  ```ts
  /**
   * Fails the type gate when the wrapper stops being a package state, member by member and
   * signature by signature (plan 2A risk R13).
   */
  type Conforms<T extends VideoEditorState<PostTimingEffect>> = T;
  export type PostEditorStateConforms = Conforms<PostEditorState>;
  ```
  Run `npm run check:fast` through the type gate. If it reports `PostEditorState` not assignable, add the missing forwards (a getter for a value, the package function for a method) and list each in the report; do not change a package signature to make it pass.
- [ ] **Step 7: The workspace passes the services.** At line 298 the `createPostEditorState({ ... })` call gains `services: tkaEditorServices(videoLibrary),` (import from `$lib/shared/post-studio-plugin/ui/tka-host`; `videoLibrary` is the store the workspace makes at 273-275). Nothing reads them until Task 9, and nothing reads `mediaLibrary` until Task 15a.
- [ ] **Step 8: tka gates.** Type gate (`new 0`; the conformance type adds none); tka subset; parity; trace script; component gate; plugin closure gate.
- [ ] **Step 9: Commit.**
  ```bash
  cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/src/host.ts packages/video-editor/src/host-defaults.ts packages/video-editor/src/index.ts packages/video-editor/test/host-defaults.test.ts && git commit -m "feat(video-editor): host notify, shortcuts and haptics with defaults; an unsupported preview cache; library change events" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  cd /e/worktrees/tka-platform/video-editor && git add src/lib/shared/post-studio-plugin/ui/tka-host.ts src/lib/shared/post-studio-plugin/ui/tka-media-library.svelte.ts src/lib/shared/media-composition/state/post-editor-state.svelte.ts src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte && git commit -m "feat(post): tka editor services and a type check that the wrapper is a package state" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 5: The browser test project (sonnet; review opus)

Closes `HANDOFF_2B` item 14 (the project; component tests arrive with their components) and the open-items "Vitest `projects`" remainder.

**Files:**
- Modify: `PKG/package.json` (devDependencies), `PKG/vitest.config.ts`
- Create: `PKG/test/browser/strings-context.svelte.test.ts`, `PKG/test/browser/fixtures/StringsProbe.svelte`, `PKG/test/browser/fixtures/StringsReader.svelte`, `PKG/test/README.md` is NOT created; the conventions line goes in `vitest.config.ts` as a comment.

- [ ] **Step 1: Dependencies (controller installs).** In `devDependencies`: `"@vitest/browser": "4.1.11"`, `"@vitest/browser-playwright": "4.1.11"`, `"vitest-browser-svelte": "2.1.1"` and `"playwright": "1.61.1"`; `vitest` stays `^4.0.16`, which the lockfile already resolves to 4.1.11, so the lock gains packages without moving vitest. `@vitest/browser-playwright` pins `vitest` exactly to its own version (tka's 4.0.18 copy declares `"vitest": "4.0.18"`), which is why the browser packages must equal the resolved vitest; `vitest-browser-svelte` 2.1.1 accepts `vitest ^4.0.0` and `svelte ^5`; playwright 1.61.1 wants chromium build 1228, already installed. Stop and report; the controller runs `cd /e/worktrees/shared-packages/video-editor && pnpm install` and confirms `pnpm --filter @austencloud/video-editor exec vitest --version` prints `vitest/4.1.11`. Fallback, only if the 4.1.11 browser packages fail to install or run: all three at `4.0.18` (tka's set, `"vitest": "4.0.18"`), after confirming the existing 270 tests keep their result under 4.0.18; the controller records which set was used.
- [ ] **Step 2: The project.** In `vitest.config.ts` add `import { playwright } from "@vitest/browser-playwright";`, a constant and a fourth project, and keep the browser tests out of `state`:
  ```ts
  // Component tests run in headless chromium: test/browser/<component or module>.svelte.test.ts,
  // with their probe components in test/browser/fixtures/. A real browser has canvas and
  // Blob.arrayBuffer, so this project needs no setup file. Nothing else runs here (the node
  // docblock test in render-entry-node.test.ts must never run in a browser).
  const BROWSER = "test/browser/**/*.svelte.test.ts";
  ```
  The `state` project's `include: [STATE]` gains `exclude: [...configDefaults.exclude, BROWSER]`, and the `unit` project's `exclude` gains `BROWSER` too. The new project:
  ```ts
  			{
  				plugins: [svelte()],
  				resolve: { conditions: ["browser"] },
  				test: {
  					name: "browser",
  					include: [BROWSER],
  					browser: {
  						enabled: true,
  						provider: playwright(),
  						headless: true,
  						instances: [{ browser: "chromium" }],
  					},
  				},
  			},
  ```
- [ ] **Step 3: The first component test.** `test/browser/fixtures/StringsProbe.svelte`:
  ```svelte
  <script lang="ts">
  	import { provideStrings } from "../../../src/strings/context.js";
  	import type { Translate } from "../../../src/strings/translate.js";
  	import StringsReader from "./StringsReader.svelte";

  	let { translate }: { translate?: Translate } = $props();
  	if (translate) provideStrings(translate);
  </script>

  <StringsReader />
  ```
  `test/browser/fixtures/StringsReader.svelte`:
  ```svelte
  <script lang="ts">
  	import { useStrings } from "../../../src/strings/context.js";

  	const t = useStrings();
  </script>

  <p data-testid="text">{t("editor_missing_video", { name: "a.mp4" })}</p>
  ```
  `test/browser/strings-context.svelte.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { render } from "vitest-browser-svelte";
  import StringsProbe from "./fixtures/StringsProbe.svelte";

  describe("strings context", () => {
  	it("reads the translate a parent provided", async () => {
  		const screen = render(StringsProbe, { translate: (key) => "host:" + key });
  		await expect.element(screen.getByTestId("text")).toHaveTextContent("host:editor_missing_video");
  	});

  	it("falls back to English with no provider", async () => {
  		const screen = render(StringsProbe, {});
  		await expect.element(screen.getByTestId("text")).toHaveTextContent("Missing video: a.mp4");
  	});
  });
  ```
  The props shape `render(Component, props)` is what tka's tests use (`PostStudio.svelte.test.ts`). Run `pnpm --filter @austencloud/video-editor exec vitest run --project browser`. Expected: 2 passed, in chromium. A failure that names a missing browser executable means the playwright version does not match the downloaded chromium; stop and report (risk R6).
- [ ] **Step 4: Package gate.** `test` now runs four projects; `check` covers the probe components through `tsconfig.test.json` (if that config's `include` does not reach `test/browser/**/*.svelte`, add `"test/**/*.svelte"` to it).
- [ ] **Step 5: Commit.**
  ```bash
  git add packages/video-editor/package.json pnpm-lock.yaml packages/video-editor/vitest.config.ts packages/video-editor/tsconfig.test.json packages/video-editor/test/browser/strings-context.svelte.test.ts packages/video-editor/test/browser/fixtures/StringsProbe.svelte packages/video-editor/test/browser/fixtures/StringsReader.svelte && git commit -m "test(video-editor): browser project in headless chromium; strings context component test" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  (`pnpm-lock.yaml` is at PKGROOT; leave `tsconfig.test.json` out of the pathspec if Step 4 did not change it.)

### Task 6: Render-side tidy before the media layer moves (sonnet; review opus)

Closes `HANDOFF_2B` items 5 and 6, the open-items "Export the frame recovery types" and "Frame recovery stale request", and the item 3 render bullets except `muted` (Task 14) and one instance (Tasks 3 and 22). Item 7 (`presetRenderMode` reads the core `POST_STUDIO_SOURCES`) stays as it is and Task 23 files it with `DOM_SURFACE_MODES` in the step 3 list: both are the compositor's tka vocabulary, and step 3 decides the card.

**Files:**
- Modify: `PKG/src/render/frame-compositor.ts:336-357,462-470,476-485,546-551`
- Modify: `PKG/src/render/preview-frame-recovery.ts:1-14,104-117`, `PKG/src/render/video-preview-seek.ts:1`
- Modify: `PKG/test/frame-compositor.test.ts`, `PKG/test/preview-video-frame-recovery.test.ts`

- [ ] **Step 1: Failing tests.** In `test/preview-video-frame-recovery.test.ts`, the harness `mount()` returns `replaceElement` (sets `current = false`); add beside it `restoreElement: () => { current = true; },` and the case:
  ```ts
  	it("watches playback again after a frame arrived while the preview was not current", () => {
  		const h = mount();
  		h.state.playing = true;
  		h.recovery.update();
  		expect(h.video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  		h.replaceElement();
  		h.present();
  		h.restoreElement();
  		h.recovery.update();
  		expect(h.video.requestVideoFrameCallback).toHaveBeenCalledTimes(2);
  	});
  ```
  Before the fix the frame that fired while not current left its request id set, so the second `update()` never asked again. In `test/frame-compositor.test.ts`, next to the existing painted-layer case (`grep -n "painters" test/frame-compositor.test.ts`), add a case whose painter's `paint` throws; spy `save` and `restore` on the context the case renders into; expect the render to reject with the painter's error and `restore` to have been called as often as `save`. Run both files (`--project canvas` for the first, `--project unit` for the second). Expected: both new cases fail.
- [ ] **Step 2: The stale request.** In `requestFrame` the request id is cleared before the current check, so only a cancelled generation leaves it alone:
  ```ts
  		if (typeof video.requestVideoFrameCallback === "function") {
  			this.frameRequest = video.requestVideoFrameCallback(() => {
  				if (generation !== this.generation) return;
  				this.frameRequest = null;
  				if (!this.current()) return;
  				callback();
  			});
  		} else {
  			this.fallbackRequest = requestAnimationFrame(() => {
  				if (generation !== this.generation) return;
  				this.fallbackRequest = null;
  				if (!this.current()) return;
  				if (video.readyState >= 2 && !video.seeking) callback();
  				else this.requestFrame(callback);
  			});
  		}
  ```
  (`cancel()` bumps the generation and clears both ids itself, so a cancelled callback has nothing to clear.)
- [ ] **Step 3: Export the types.** `interface PreviewFrameState`, `interface PreviewFrameRecoveryOptions` (`preview-frame-recovery.ts` 1 and 7) and `interface PreviewSeekState` (`video-preview-seek.ts` 1) become `export interface`. `render/index.ts` already re-exports both modules with `export *`.
- [ ] **Step 4: Restore in `finally` (item 6).** In `drawPaintedLayer` (336-357):
  ```ts
  	context.save();
  	try {
  		turnAboutCentre(context, pixels, region.turn ?? 0);
  		traceRoundedRect(
  			context,
  			{
  				x: pixels.x - surface.rect.x,
  				y: pixels.y - surface.rect.y,
  				width: pixels.width + surface.width - width,
  				height: pixels.height + surface.height - height,
  			},
  			cornerRadius,
  		);
  		context.clip();
  		context.globalAlpha = layer.opacity;
  		if (!painter.ownsTransform) applyLayerTransform(context, geometry);
  		painter.paint(context, geometry.drawRect, toPaintFrame(layer, timeSeconds));
  	} finally {
  		context.restore();
  	}
  ```
  and the `sourceGeometry` branch (546-551):
  ```ts
  		context.save();
  		try {
  			context.globalAlpha = layer.opacity;
  			applyLayerTransform(context, geometry);
  			context.filter = videoColorFilter(colorGrade?.kind === "visual" ? colorGrade.colorGrade : null);
  			drawSource(context, media, geometry);
  		} finally {
  			context.restore();
  		}
  		return;
  ```
- [ ] **Step 5: The comment (item 5).** The doc comment above `DOM_SURFACE_MODES` becomes:
  ```ts
  /**
   * Render modes the preview mounts as live DOM: the compositor cannot draw
   * them from media or a painter, so the host passes a surface for each. A
   * layer in one of these modes with no surface throws, as does a painted layer
   * with no painter; every other mode falls through to the media branch. The
   * names are tka's (sequence animation, choreo card); step 3 moves them out of
   * the compositor together with the role table presetRenderMode reads.
   */
  ```
- [ ] **Step 6: Gates.** Package gate (both new cases pass); then from TKA: parity (expected unchanged: the restore order and the recovery fix change no hash), tka subset.
- [ ] **Step 7: Commit.**
  ```bash
  git add packages/video-editor/src/render/frame-compositor.ts packages/video-editor/src/render/preview-frame-recovery.ts packages/video-editor/src/render/video-preview-seek.ts packages/video-editor/test/frame-compositor.test.ts packages/video-editor/test/preview-video-frame-recovery.test.ts && git commit -m "fix(video-editor): restore the canvas in finally, clear a stale frame request, export the recovery types" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 7: Surfaces as a factory and the memoizing text painter (sonnet; review opus)

Closes `HANDOFF_2B` item 3's plugin half (R11) and item 8.

**Files:**
- Modify: `PKG/src/plugin.ts:83-88`, `PKG/src/render/painter-registry.ts`
- Modify: `PKG/test/painter-registry.test.ts`
- Modify: `TKA/src/lib/shared/post-studio-plugin/plugin.test.ts`

`create-plugin.ts` is not changed: `surfaces.ts` imports tka's DOM capture modules, which the data plugin's server and tsx closure must not load, so `createSurfaces` is wired on the UI plugin in `PUI/tka-editor-plugin.ts` (Task 12).

- [ ] **Step 1: Failing package tests.** In `test/painter-registry.test.ts`, import `createTextPainters` and `textPainterFactory` beside `createPainterRegistry`, replace the case "asks again on every paintersFor call and builds a fresh painter each time" (item 8: it asserted on the fake factory) with:
  ```ts
  	it("asks again on every paintersFor call and returns what the factory returned that time", () => {
  		const create = vi.fn(() => painter());
  		const registry = createPainterRegistry([{ id: "only", create }]);

  		const one = registry.paintersFor(env);
  		const two = registry.paintersFor(env);

  		const distinct = new Set(roles).size;
  		expect(create).toHaveBeenCalledTimes(distinct * 2);
  		// `role` is the first clip's role, so it is the first one asked on each call.
  		const results = create.mock.results.map((result) => result.value);
  		expect(one.get(role)).toBe(results[0]);
  		expect(two.get(role)).toBe(results[distinct]);
  	});
  ```
  and add a block:
  ```ts
  describe("createTextPainters", () => {
  	const textRole = compiled.texts[0]?.role;

  	it("keeps one painter per text item across compiles", () => {
  		if (textRole === undefined) throw new Error("the plain fixture must have a text item");
  		const factory = createTextPainters(() => compiled);
  		const first = factory.create(textRole, env);
  		const second = factory.create(textRole, { project, compiled: { ...compiled } });
  		expect(first).not.toBeNull();
  		expect(second).toBe(first);
  	});

  	it("answers null for a role no text item draws", () => {
  		const factory = createTextPainters(() => compiled);
  		expect(factory.create("no-such-role", env)).toBeNull();
  	});

  	it("builds a new painter per call in the plain factory, which the memo replaces", () => {
  		if (textRole === undefined) throw new Error("the plain fixture must have a text item");
  		expect(textPainterFactory.create(textRole, env)).not.toBe(textPainterFactory.create(textRole, env));
  	});
  });
  ```
  Run `pnpm --filter @austencloud/video-editor exec vitest run test/painter-registry.test.ts`. Expected: `createTextPainters` not exported.
- [ ] **Step 2: The memo.** Append to `painter-registry.ts`:
  ```ts
  /**
   * The text painter factory an editor keeps for its lifetime: one painter per text item, reused
   * across compiles, reading the item's words from the latest compile. A fresh painter starts
   * with its font not ready, so building one per compile would flash the fallback font.
   */
  export function createTextPainters(getCompiled: () => CompiledPostProject | null): PainterFactory {
  	const painters = new Map<string, PostStudioLayerPainter>();
  	return {
  		id: "text",
  		create(role, env) {
  			const entry = env.compiled.texts.find((text) => text.role === role);
  			if (!entry) return null;
  			const { itemId } = entry;
  			let painter = painters.get(itemId);
  			if (!painter) {
  				painter = createTextItemPainter(
  					() => getCompiled()?.texts.find((text) => text.itemId === itemId) ?? null,
  				);
  				painters.set(itemId, painter);
  			}
  			return painter;
  		},
  	};
  }
  ```
  Rerun. Expected: pass.
- [ ] **Step 3: The factory member.** In `plugin.ts` replace the `surfaces?` member and its comment with:
  ```ts
  	/**
  	 * DOM surfaces for the render modes the compositor cannot draw from media or a painter.
  	 * Called once per render (an export or a still); the exporter releases each surface when that
  	 * render ends, so per-render caches live inside one call and never cross renders.
  	 */
  	createSurfaces?(): readonly SurfaceCapture[];
  ```
  Nothing in the package read `surfaces` (grep `[.]surfaces` under `src` before and after: only `post-exporter.ts` and `frame-compositor.ts` read their own `input.surfaces`).
- [ ] **Step 4: Package gate.**
- [ ] **Step 5: tka positive paths.** In `PLUGIN/plugin.test.ts` add:
  ```ts
  describe("tka surfaces", () => {
    it("gives every render its own surfaces for the sequence animation and the choreo card", () => {
      const one = createTkaSurfaces();
      const two = createTkaSurfaces();
      expect(one.map((surface) => surface.renderMode).sort()).toEqual(["choreo-card", "sequence-animation"]);
      for (const surface of one) expect(two).not.toContain(surface);
    });
  });
  ```
  and, for each factory in `createTkaPlugin().painters`, a case that builds the project the file already builds for that kind (the existing null-path cases show how; `grep -n "painters" src/lib/shared/post-studio-plugin/plugin.test.ts`) and expects `factory.create(role, env)` to return an object with `prepare` and `paint` functions for the kind's role. Import `createTkaSurfaces` from `./surfaces`; if that import makes the jsdom test fail (DOM capture modules), move the surfaces case to `PUI/surfaces.svelte.test.ts` under the components config instead and say so.
- [ ] **Step 6: tka gates.** Type gate; tka subset; `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/post-studio-plugin`; plugin closure gate; trace script; parity.
- [ ] **Step 7: Commit.**
  ```bash
  cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/src/plugin.ts packages/video-editor/src/render/painter-registry.ts packages/video-editor/test/painter-registry.test.ts && git commit -m "feat(video-editor): createSurfaces factory member and a memoizing text painter factory" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  cd /e/worktrees/tka-platform/video-editor && git add src/lib/shared/post-studio-plugin/plugin.test.ts && git commit -m "test(post): positive paths for tka surfaces and painters" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 8: Icons (sonnet; review opus)

**Files:**
- Modify: `PKG/package.json` (`dependencies`, `exports`)
- Create: `PKG/src/ui/kit/Icon.svelte`, `PKG/src/ui/kit/icons.ts`, `PKG/src/icons/index.ts`
- Create: `PKG/test/icons.test.ts`, `PKG/test/browser/icon.svelte.test.ts`

- [ ] **Step 1: Dependency (controller installs).** `dependencies` gains `"@fortawesome/free-solid-svg-icons": "^7.0.1"`. Stop and report; the controller runs `pnpm install` from PKGROOT.
- [ ] **Step 2: Failing tests.** `PKG/test/icons.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import * as icons from "../src/ui/kit/icons.js";

  describe("icon table", () => {
  	const entries = Object.entries(icons);

  	it("holds the 84 icons the editor UI uses", () => {
  		expect(entries).toHaveLength(84);
  	});

  	it("holds only solid icon definitions", () => {
  		for (const [name, definition] of entries) {
  			expect(name).toMatch(/^fa[A-Z]/);
  			expect(definition.prefix).toBe("fas");
  			expect(definition.icon).toHaveLength(5);
  		}
  	});
  });
  ```
  `PKG/test/browser/icon.svelte.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { render } from "vitest-browser-svelte";
  import Icon from "../../src/ui/kit/Icon.svelte";
  import { faCheck } from "../../src/ui/kit/icons.js";

  describe("Icon", () => {
  	it("draws the definition's path in the current colour, hidden from assistive tech", async () => {
  		const screen = render(Icon, { icon: faCheck });
  		const svg = screen.container.querySelector("svg");
  		expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${faCheck.icon[0]} ${faCheck.icon[1]}`);
  		expect(svg?.getAttribute("aria-hidden")).toBe("true");
  		expect(svg?.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
  	});

  	it("takes Font Awesome's box: 1.25em wide, 1em tall", async () => {
  		const screen = render(Icon, { icon: faCheck });
  		const svg = screen.container.querySelector("svg") as SVGElement;
  		const fontSize = parseFloat(getComputedStyle(svg).fontSize);
  		expect(svg.getBoundingClientRect().width).toBeCloseTo(fontSize * 1.25, 0);
  		expect(svg.getBoundingClientRect().height).toBeCloseTo(fontSize, 0);
  	});

  	it("names itself when it is a control's only content", async () => {
  		const screen = render(Icon, { icon: faCheck, label: "Done" });
  		await expect.element(screen.getByRole("img", { name: "Done" })).toBeVisible();
  	});
  });
  ```
  Run both. Expected: fail, modules missing.
- [ ] **Step 3: The files.** `Icon.svelte` is the code in seam design E. `icons.ts`:
  ```ts
  // The only import point for icon data in the package. Font Awesome 7 solid, the set tka
  // self-hosts; seam design E of the step 2B plan maps each old class to its export.
  export {
  	faArrowLeft,
  	faArrowRightFromBracket,
  	faArrowRightToBracket,
  	faArrowsLeftRight,
  	faArrowsLeftRightToLine,
  	faArrowsRotate,
  	faArrowsUpDownLeftRight,
  	faBackwardFast,
  	faBackwardStep,
  	faBorderTopLeft,
  	faCheck,
  	faChevronDown,
  	faChevronLeft,
  	faChevronRight,
  	faCircleCheck,
  	faCircleExclamation,
  	faCircleHalfStroke,
  	faCircleNodes,
  	faClock,
  	faClone,
  	faCloud,
  	faCropSimple,
  	faDiamond,
  	faDownload,
  	faDrum,
  	faExpand,
  	faEye,
  	faEyeSlash,
  	faFan,
  	faFileExport,
  	faFileImport,
  	faFilm,
  	faFloppyDisk,
  	faFont,
  	faForwardFast,
  	faForwardStep,
  	faGaugeHigh,
  	faHandPointer,
  	faHashtag,
  	faHeading,
  	faIdCard,
  	faImage,
  	faImages,
  	faLeftRight,
  	faLink,
  	faLocationCrosshairs,
  	faLock,
  	faLockOpen,
  	faMagnifyingGlass,
  	faMagnifyingGlassMinus,
  	faMagnifyingGlassPlus,
  	faMinus,
  	faMusic,
  	faPalette,
  	faPause,
  	faPen,
  	faPersonRunning,
  	faPhotoFilm,
  	faPlay,
  	faPlus,
  	faRightLeft,
  	faRotate,
  	faRotateLeft,
  	faRotateRight,
  	faRulerCombined,
  	faScissors,
  	faShapes,
  	faShare,
  	faShuffle,
  	faSliders,
  	faSpinner,
  	faSun,
  	faTableCells,
  	faTableCellsLarge,
  	faTrashCan,
  	faTriangleExclamation,
  	faUpDownLeftRight,
  	faUpload,
  	faVolumeHigh,
  	faVolumeXmark,
  	faWandMagicSparkles,
  	faWandSparkles,
  	faWaveSquare,
  	faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  ```
  A name that does not exist in v7 fails `check`; take the v7 name Font Awesome's own alias list gives for the class and record it. `PKG/src/icons/index.ts`:
  ```ts
  export * from "../ui/kit/icons.js";
  export { default as Icon } from "../ui/kit/Icon.svelte";
  export type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
  ```
  `exports` in `package.json` gains `"./icons": { "types": "./dist/icons/index.d.ts", "svelte": "./dist/icons/index.js", "import": "./dist/icons/index.js" }`. Task 10 adds the kit's extra icons and moves the expected count in `icons.test.ts` to match.
- [ ] **Step 4: Gates.** Package gate (the four projects; the 84-icon test and the three Icon cases pass); `node scripts/step1/forbidden-imports.mjs` (0, 0, 0). From TKA, a one-line resolution check that the alias reaches the new folder: `node -e "require('fs').accessSync('/e/worktrees/shared-packages/video-editor/packages/video-editor/dist/icons/index.js')"` exits 0.
- [ ] **Step 5: Commit.**
  ```bash
  git add packages/video-editor/package.json pnpm-lock.yaml packages/video-editor/src/ui/kit/Icon.svelte packages/video-editor/src/ui/kit/icons.ts packages/video-editor/src/icons/index.ts packages/video-editor/test/icons.test.ts packages/video-editor/test/browser/icon.svelte.test.ts && git commit -m "feat(video-editor): inline SVG icons from Font Awesome solid data; icons subpath" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 9: Plugin UI members, editor mode and parts, the editor context (sonnet; review opus)

**Files:**
- Modify: `PKG/src/plugin.ts`, `PKG/src/state/video-editor-state.svelte.ts` (interface at 144-150, state near 299, the returned object near 1133)
- Create: `PKG/src/ui/editor-context.ts`; Modify: `PKG/src/ui/index.ts`, `PKG/src/index.ts`
- Create: `PKG/test/plugin-ui.test.ts`; Modify: `PKG/test/video-editor-state.svelte.test.ts`
- Modify: `TKA/src/lib/shared/media-composition/state/post-editor-state.svelte.ts` (one forward)

- [ ] **Step 1: Failing state tests.** In `test/video-editor-state.svelte.test.ts`, with the file's own state factory (the helper its first case calls; `grep -n "createVideoEditorState(" test/video-editor-state.svelte.test.ts`), add:
  ```ts
  	it("starts in the edit mode and keeps a plugin mode's id", () => {
  		const editor = makeEditor();
  		expect(editor.mode).toBe("edit");
  		editor.mode = "timing";
  		expect(editor.mode).toBe("timing");
  	});

  	it("selects a part of an item and drops the part when any item is selected", () => {
  		const editor = makeEditor();
  		const [first, second] = editor.project.tracks.flatMap((track) => track.items);
  		if (!first || !second) throw new Error("the plain fixture has two items");
  		editor.selectPart(first.id, "opening");
  		expect(editor.selectedItemId).toBe(first.id);
  		expect(editor.selectedPart).toBe("opening");
  		editor.selectedItemId = second.id;
  		expect(editor.selectedPart).toBeNull();
  	});
  ```
  (`makeEditor` stands for that helper's real name.) Run `--project state`. Expected: fail.
- [ ] **Step 2: State.** In the `VideoEditorState<E>` interface, after the selection members:
  ```ts
  	// Modes and parts
  	/** "edit", or the id of a plugin mode (`PluginUi.modes`) that owns the screen. */
  	mode: string;
  	/** The selected part of the selected item (an `ItemPart` id), or null for the whole item. */
  	readonly selectedPart: string | null;
  	/** Selects the item and one of its parts. */
  	selectPart(itemId: string, part: string): void;
  ```
  In the factory, `let mode = $state("edit");` and `let selectedPart = $state<string | null>(null);` beside `selectedItemId`; the `selectedItemId` setter sets `selectedPart = null` before it does what it does today; the returned object gains:
  ```ts
  		get mode() {
  			return mode;
  		},
  		set mode(next: string) {
  			mode = next;
  		},
  		get selectedPart() {
  			return selectedPart;
  		},
  		selectPart(itemId: string, part: string) {
  			this.selectedItemId = itemId;
  			if (selectedItemId === itemId) selectedPart = part;
  		},
  ```
  If the returned object is not a plain object literal where `this` is the state, call the setter's body function directly instead of `this.selectedItemId`. Rerun. Expected: pass.
- [ ] **Step 3: Plugin types.** Add to `plugin.ts` the imports and every declaration of seam design B (`ToolPanelProps`, `ItemPart`, `ItemKindUi`, `PluginTool`, `PluginAddItem`, `MediaSublayerProps`, `CanvasOverlayProps`, `EditorMode`, `PluginBindings`, `PluginUi`), plus the two data shapes the timeline and crop screen share with a plugin, declared here (the files that use them move in Task 18 and import them from here with `import type`):
  ```ts
  /** A landing mark on the crop screen's clip timeline. */
  export interface ClipStep {
  	/** Post seconds. */
  	seconds: number;
  	/** Arrival position: 0 is the opening, p the landing of step p. */
  	position: number;
  	/** The plugin's own index for the step; null for the opening. */
  	stepIndex: number | null;
  	/** The label the crop timeline shows. */
  	label: string;
  	/** The first step of a pass. */
  	passStart: boolean;
  }

  /** Two items the timeline draws as one block on the first item's row, joined from start to end. */
  export interface TimelineJoin {
  	fromId: string;
  	toId: string;
  	fromTrackIndex: number;
  	toTrackIndex: number;
  	/** Post seconds where the first becomes the second. */
  	start: number;
  	end: number;
  }
  ```
  `ItemKindDefinition` gains `/** The kind's editor UI; absent for a kind the core UI draws on its own. */ ui?: ItemKindUi;` and `VideoEditorPlugin` gains `/** The plugin's editor UI. A missing member renders nothing. */ ui?: PluginUi;`. `PostItem`, `PostProject` and `SurfaceCapture` are already imported in `plugin.ts` or come from `./core/project/item-kinds.js` and `./render/surfaces.js` with `import type`.
- [ ] **Step 4: Type test.** `PKG/test/plugin-ui.test.ts` (the `check` script type-checks it; the run proves the shapes are plain data):
  ```ts
  import type { Component } from "svelte";
  import { describe, expect, it } from "vitest";
  import { faFan } from "../src/ui/kit/icons.js";
  import type { ItemKindUi, PluginUi, ToolPanelProps, VideoEditorPlugin } from "../src/plugin.js";

  const Panel = (() => {}) as unknown as Component<ToolPanelProps>;

  describe("plugin UI members", () => {
  	it("are component values and plain functions on the plugin and its kinds", () => {
  		const kindUi: ItemKindUi = {
  			icon: faFan,
  			toolPanel: Panel,
  			parts: [{ id: "opening", span: () => ({ start: 0, end: 1 }), label: (t) => t("x"), icon: faFan }],
  		};
  		const ui: PluginUi = {
  			toolPanel: Panel,
  			tools: [{ id: "look", type: "panel", label: (t) => t("look"), icon: faFan }],
  			toolRow: (_selection, core) => [...core, "look"],
  			modes: [{ id: "timing" }],
  		};
  		const plugin: VideoEditorPlugin = { id: "probe", itemKinds: [], ui };
  		expect(plugin.ui?.toolRow?.(null, ["trim"], {} as never)).toEqual(["trim", "look"]);
  		expect(kindUi.parts?.[0]?.span({} as never)).toEqual({ start: 0, end: 1 });
  	});
  });
  ```
- [ ] **Step 5: The editor context.** `PKG/src/ui/editor-context.ts` is the code in seam design A, with `EditorServices` imported from `../host-defaults.js`. `src/ui/index.ts` gains `export { provideEditorUi, useEditorUi, type EditorUi } from "./editor-context.js";`; the root `src/index.ts` gains the same line with the path `./ui/editor-context.js`.
- [ ] **Step 6: Package gate.**
- [ ] **Step 7: tka keeps conforming.** The wrapper has `mode` and `selectedPart` already; it gains, until Task 15a moves the part into the package state:
  ```ts
      /** Package parts; tka's only part is the opening tunnel, still held by the timing state. */
      selectPart(itemId: string, part: string) {
        if (part === "tunnel") timing.selectTunnel(itemId);
        else core.selectPart(itemId, part);
      },
  ```
  Type gate (`new 0`: the conformance type from Task 4 now also proves `selectPart`), tka subset, parity, trace script.
- [ ] **Step 8: Commit.**
  ```bash
  cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/src/plugin.ts packages/video-editor/src/state/video-editor-state.svelte.ts packages/video-editor/src/ui/editor-context.ts packages/video-editor/src/ui/index.ts packages/video-editor/src/index.ts packages/video-editor/test/plugin-ui.test.ts packages/video-editor/test/video-editor-state.svelte.test.ts && git commit -m "feat(video-editor): plugin UI members, editor mode and item parts, editor UI context" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  cd /e/worktrees/tka-platform/video-editor && git add src/lib/shared/media-composition/state/post-editor-state.svelte.ts && git commit -m "refactor(post): the wrapper answers selectPart" -m "Package: video-editor@<short hash>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 10: The UI kit copies, Popover and the dialog (sonnet; review opus)

**Files:**
- Modify: `PKG/package.json` (`dependencies`), `PKG/scripts/step2b/moves.json`, `PKG/scripts/step1/lib.mjs` and `move.mjs` (a `copies` list)
- Create: the 35 `KIT` files of the kit table (28 rows; the drawer row is 5 files, plus `drawer/Drawer.css`, `modal-stack.ts` and `modal-tokens.css`), `PKG/src/ui/kit/Popover.svelte`
- Modify: `PKG/src/ui/editor-context.ts`, `PKG/src/ui/kit/icons.ts`, `PKG/src/strings/en.ts`, `PKG/test/icons.test.ts`
- Create: `PKG/test/browser/popover.svelte.test.ts`, `PKG/test/browser/confirm-dialog.svelte.test.ts`, `PKG/test/browser/fixtures/PopoverHarness.svelte`, `PKG/test/browser/fixtures/ConfirmHarness.svelte`

- [ ] **Step 1: Dependencies (controller installs).** `dependencies` gains `"wavesurfer.js": "7.12.1"` and `"realtime-bpm-analyzer": "5.0.0"`. Stop and report; the controller runs `pnpm install` from PKGROOT.
- [ ] **Step 2: A `copies` list.** In `lib.mjs`, where `table` is read, default `table.copies` to `[]`. In `move.mjs`, `const entries = [...table.moves, ...table.splits, ...table.copies];` so a copy is placed and resolvable like a move. `rewrite-imports.mjs` must keep reading only `table.moves` and `table.splits` (confirm with `grep -n "table[.]" scripts/step1/rewrite-imports.mjs`): tka keeps its originals and its importers. Add a `step1-tools.test.mjs` case: an entry in `copies` is in the `placed` map `move.mjs` builds and is not in the list `rewrite-imports.mjs` rewrites.
- [ ] **Step 3: The entries.** Append to `scripts/step2b/moves.json` a `"copies"` array with one entry per kit file, task 10, entry `@austencloud/video-editor/ui`, `from` the tka specifier (components keep `.svelte`, modules drop `.ts`) and `to` the kit table's package file under `ui/kit/`. Example lines:
  ```json
  { "task": 10, "from": "$lib/shared/components/panel/PanelButton.svelte", "to": "ui/kit/PanelButton.svelte", "entry": "@austencloud/video-editor/ui" },
  { "task": 10, "from": "$lib/shared/ui/typed-number", "to": "ui/kit/typed-number.ts", "entry": "@austencloud/video-editor/ui" },
  { "task": 10, "from": "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte", "to": "ui/kit/FilterChip.svelte", "entry": "@austencloud/video-editor/ui" },
  ```
  The drawer row is one entry per file `ls src/lib/shared/foundation/ui/drawer/*.ts` lists (tests excluded). `video-file-metadata` is not an entry: Step 6 writes it by hand.
- [ ] **Step 4: Copy.** From PKG: `STEP_MOVES=../step2b/moves.json node scripts/step1/move.mjs --task 10 --dry`, read every `UNRESOLVED` line (each must be one of the replacements in the kit table), then run without `--dry`. Run `node scripts/step1/ascii.mjs` on the placed `.ts` files and the script blocks of the placed `.svelte` files, then fix markup and style characters by the ground rules table. Format: `pnpm exec prettier --use-tabs --print-width 100 --write packages/video-editor/src/ui/kit` from PKGROOT (all new files).
- [ ] **Step 5: The replacements, file by file** (the kit table's last column):
  - `t` in `TypeableValue`, `DrawerHeader`, `ConfirmDialog`, `ExportTakeover`: `import { useStrings } from "../../strings/context.js";` and `const t = useStrings();` as the first script line.
  - `Drawer.svelte`: `responsiveLayoutManager` becomes `const narrow = typeof window !== "undefined" && window.matchMedia(NARROW).matches` read in the same place, with `NARROW` the media query string the manager's breakpoint uses (copy its pixel value into the const and say which); `holdBackgroundFor` and its call are deleted (risk R7); the escape registration becomes `services.shortcuts.escapeLayer(id, close)` with `const services = useEditorServices();`.
  - `drawer/*.ts`: the `debug-logger` import and calls are deleted; a function that took the escape layer manager takes `escapeLayer: EditorShortcuts["escapeLayer"]` instead and its caller passes `services.shortcuts.escapeLayer`.
  - haptics in `DrawerHeader` and `ConfirmDialog`: `hapticService?.trigger(kind)` becomes `services.haptics(kind)`.
  - `fa-` classes in `OverflowMenu`, `DrawerHeader`, `ConfirmDialog`, `ExportTakeover`: `<i class="fa-solid fa-x"></i>` becomes `<Icon icon={faX} />` (seam design E rule; `import Icon from "./Icon.svelte";` and the names from `./icons.js`). Add any name not yet in `icons.ts` to its export list in alphabetical order and raise the count in `test/icons.test.ts` to match; list the added names in the report.
  - `TimeRuler` and `ExportTakeover`: the imported tka types become local `interface` declarations with the same members.
  - `file-downloader.ts`: the `platform-detector` call becomes an inline user-agent test with the same regular expression the detector uses (copy it; say which).
  - `bpm-analyzer.ts`: `realtime-bpm-analyzer` resolves from the package's own dependency; no edit.
  - CSS: every `--theme-*` and the other tka token families rename by seam design I in these files too (Task 17 adds the token lines for the whole set at once; until then `var(--ve-theme-text, <fallback>)` shows the fallback, and nothing renders the kit yet).
- [ ] **Step 6: `video-file-metadata`.** `PKG/src/ui/kit/video-file-metadata.ts` holds `getVideoFileMetadata` copied from `TKA/src/lib/shared/video-collaboration/helpers/create-video-from-upload.ts:191-214` with its return type, exported, and nothing else.
- [ ] **Step 7: Services outside an editor.** `editor-context.ts` gains (import `resolveServices` from `../host-defaults.js`):
  ```ts
  /** The editor's services, or the package defaults outside an editor (a kit component in a test). */
  export function useEditorServices(): EditorServices {
  	return getContext<EditorUi | undefined>(EDITOR_UI)?.services ?? resolveServices({ ownerId: "" });
  }
  ```
- [ ] **Step 8: Popover.** `PKG/src/ui/kit/Popover.svelte`:
  ```svelte
  <script lang="ts">
  	import { tick, type Snippet } from "svelte";
  	import { useEditorServices } from "../editor-context.js";

  	interface Props {
  		open: boolean;
  		anchor: HTMLElement | null;
  		/** Accessible name of the panel. */
  		label: string;
  		placement?: "top" | "bottom";
  		/** Gap to the anchor, in pixels. */
  		offset?: number;
  		onclose?: () => void;
  		children: Snippet;
  	}

  	let {
  		open = $bindable(),
  		anchor,
  		label,
  		placement = "top",
  		offset = 8,
  		onclose,
  		children,
  	}: Props = $props();

  	const services = useEditorServices();
  	const id = `ve-popover-${Math.random().toString(36).slice(2)}`;
  	let panel = $state<HTMLDivElement | null>(null);
  	let left = $state(0);
  	let top = $state(0);

  	/** The panel lives on the body, as bits-ui's did, so no transformed ancestor offsets it. */
  	function portal(node: HTMLElement) {
  		document.body.append(node);
  		return { destroy: () => node.remove() };
  	}

  	function place(): void {
  		if (!anchor || !panel) return;
  		const a = anchor.getBoundingClientRect();
  		const p = panel.getBoundingClientRect();
  		const centred = a.left + a.width / 2 - p.width / 2;
  		left = Math.min(Math.max(8, centred), window.innerWidth - p.width - 8);
  		top = placement === "top" ? a.top - p.height - offset : a.bottom + offset;
  	}

  	function close(): void {
  		open = false;
  		onclose?.();
  		anchor?.focus();
  	}

  	$effect(() => {
  		if (!open) return;
  		void tick().then(place);
  		const outside = (event: PointerEvent) => {
  			const target = event.target as Node | null;
  			if (target && (panel?.contains(target) || anchor?.contains(target))) return;
  			close();
  		};
  		window.addEventListener("resize", place);
  		window.addEventListener("scroll", place, true);
  		document.addEventListener("pointerdown", outside, true);
  		const offEscape = services.shortcuts.escapeLayer(id, close);
  		return () => {
  			window.removeEventListener("resize", place);
  			window.removeEventListener("scroll", place, true);
  			document.removeEventListener("pointerdown", outside, true);
  			offEscape();
  		};
  	});
  </script>

  {#if open}
  	<div
  		use:portal
  		bind:this={panel}
  		class="ve-popover ve-portal"
  		role="dialog"
  		aria-label={label}
  		style:left="{left}px"
  		style:top="{top}px"
  	>
  		{@render children()}
  	</div>
  {/if}

  <style>
  	.ve-popover {
  		position: fixed;
  		z-index: 1000;
  	}
  </style>
  ```
- [ ] **Step 9: The dialog without bits-ui.** In `KIT/ConfirmDialog.svelte` replace the bits-ui parts one for one, keeping every class, prop, text and handler. The source uses bits-ui `Dialog` imported as `DialogPrimitive` (not `AlertDialog`; its buttons are already plain `<button>`s): `<DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>` becomes `{#if isOpen}`; `DialogPrimitive.Portal` plus `<DialogPrimitive.Overlay class="dialog-backdrop" />` become `<div use:portal class="ve-portal dialog-backdrop" onclick={handleCancel}></div>` (the `portal` function as in Popover; bits-ui closes on an outside click through `handleOpenChange(false)`, which calls `handleCancel`); `<DialogPrimitive.Content class="dialog-container {variant}">` becomes `<div use:portal role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} class="ve-portal dialog-container {variant}">` with the focus trap from `./drawer/focus-trap.js` applied the way the copied `Drawer.svelte` applies it; `DialogPrimitive.Title class="dialog-title"` becomes `<h2 id={titleId} class="dialog-title">` and `DialogPrimitive.Description class="dialog-message"` becomes `<p id={descriptionId} class="dialog-message">`. `handleOpenChange` leaves. While open, an `$effect` registers `services.shortcuts.escapeLayer(titleId, handleCancel)` and returns its unregister. The "don't ask again" toggle stays the `<button>` it is today. `titleId` and `descriptionId` are `ve-confirm-<random>` strings made once.
- [ ] **Step 10: Kit strings.** Run the key census of seam design D on the copied kit files (`node "$SCRATCH/keys.cjs" packages/video-editor/src/ui/kit/*.svelte packages/video-editor/src/ui/kit/*.ts packages/video-editor/src/ui/kit/drawer/*.ts`) and add each printed key with its English text to `EN` in alphabetical order. A key whose English text has a placeholder outside `[a-z_]` stops the task (report it).
- [ ] **Step 11: Component tests.** `fixtures/PopoverHarness.svelte`:
  ```svelte
  <script lang="ts">
  	import Popover from "../../../src/ui/kit/Popover.svelte";

  	let open = $state(false);
  	let anchor = $state<HTMLButtonElement | null>(null);
  </script>

  <div style="padding-top: 200px">
  	<button bind:this={anchor} onclick={() => (open = !open)}>Zoom</button>
  	<button>Outside</button>
  </div>
  <Popover bind:open {anchor} label="Zoom options"><p>Inside</p></Popover>
  ```
  `popover.svelte.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { page, userEvent } from "vitest/browser";
  import { render } from "vitest-browser-svelte";
  import PopoverHarness from "./fixtures/PopoverHarness.svelte";

  describe("Popover", () => {
  	it("opens above its anchor and closes on an outside press", async () => {
  		render(PopoverHarness);
  		await page.getByRole("button", { name: "Zoom" }).click();
  		const panel = page.getByRole("dialog", { name: "Zoom options" });
  		await expect.element(panel).toBeVisible();
  		const anchorTop = page.getByRole("button", { name: "Zoom" }).element().getBoundingClientRect().top;
  		expect(panel.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(anchorTop);
  		await page.getByRole("button", { name: "Outside" }).click();
  		await expect.element(panel).not.toBeInTheDocument();
  	});

  	it("closes on Escape and gives focus back to its anchor", async () => {
  		render(PopoverHarness);
  		await page.getByRole("button", { name: "Zoom" }).click();
  		await userEvent.keyboard("{Escape}");
  		await expect.element(page.getByRole("dialog", { name: "Zoom options" })).not.toBeInTheDocument();
  		await expect.element(page.getByRole("button", { name: "Zoom" })).toHaveFocus();
  	});
  });
  ```
  (If the installed vitest exposes `page` and `userEvent` from `@vitest/browser/context` instead, import from there; tka's component tests show which.) `fixtures/ConfirmHarness.svelte` renders the copied `ConfirmDialog` open, with the props its script declares, a title "Delete clip?", and `oncancel`/`onconfirm` (whatever the copied props are named) that write "cancelled" or "confirmed" into a `<p data-testid="result">`. `confirm-dialog.svelte.test.ts` has three cases: the `dialog` named "Delete clip?" is visible and pressing its confirm button shows "confirmed"; Escape shows "cancelled"; pressing Tab as many times as the dialog has buttons plus one keeps `document.activeElement` inside the dialog.
- [ ] **Step 12: Gates.** Package gate (forbidden imports 0: no bits-ui, no `$lib`, `fa- classes: 0`); `node scripts/step1/move.mjs --check` exits 0.
- [ ] **Step 13: Commit.**
  ```bash
  git add packages/video-editor/package.json pnpm-lock.yaml packages/video-editor/scripts/step2b/moves.json packages/video-editor/scripts/step1/lib.mjs packages/video-editor/scripts/step1/move.mjs packages/video-editor/test/step1-tools.test.mjs packages/video-editor/src/ui/kit packages/video-editor/src/ui/editor-context.ts packages/video-editor/src/strings/en.ts packages/video-editor/test/icons.test.ts packages/video-editor/test/browser/popover.svelte.test.ts packages/video-editor/test/browser/confirm-dialog.svelte.test.ts packages/video-editor/test/browser/fixtures/PopoverHarness.svelte packages/video-editor/test/browser/fixtures/ConfirmHarness.svelte && git commit -m "feat(video-editor): copy the UI kit; Popover and the confirm dialog without bits-ui" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  (`src/ui/kit` is a directory pathspec of new files only; `git status --short packages/video-editor/src/ui/kit` before the add lists only `??` lines and `icons.ts`.)

### Task 11: The TKA files into `PUI` (sonnet; review opus)

Gates: tka type gate, parity, tka subset, tka component gate, plugin closure gate. tka only; no package change.

**Files:**
- `git mv` (19 files) from `PS` into `PUI`, keeping each basename:
  - root: `PostStudioSequenceAnimationLayer.svelte`, `PostStudioChoreoLayer.svelte`, `PostStudioTunnelLayer.svelte`, `PostStudioMandalaLayer.svelte`, `PostStudioBreakdownMandala.svelte`, `post-animation-effects.svelte.ts`, `post-card-highlight.ts`, `post-item-render-options.ts`, `post-qr-image-appearance.ts`, `post-studio-art-context.svelte.ts`, `post-studio-prop-render-options.ts`
  - `editor/`: `post-appearance-fit.ts`, `PostAnimationAppearanceTool.svelte`, `PostAnimationAppearanceTool.svelte.test.ts`, `PostAppearanceChooser.svelte`, `PostCardAppearanceTool.svelte`, `PostScopedEffectsPanel.svelte`, `PostSequenceActionsTool.svelte`, `PostStaffEffectsTool.svelte`
- Modify (importers, found while planning with the grep in Step 1): `PS/PostStudio.svelte`, `PS/PostStudioMediaLayer.svelte`, `PS/builder/PostTimingAnimationPreview.svelte`, `PS/builder/PostTimingAnimationSettings.svelte`, `PS/editor/PostEditorCanvas.svelte`, `PS/editor/PostEditorWorkspace.svelte`, `PS/editor/PostItemTool.svelte`, `src/routes/test/display-tiles/+page.svelte`, `src/routes/test/post-hook-speeds/+page.svelte`, and the eight tests `tests/unit/media-composition/post-animation-effects.test.ts`, `post-appearance-fit.test.ts`, `post-item-appearance.test.ts`, `post-qr-image-appearance.test.ts`, `post-static-card-highlight.test.ts`, `post-studio-media-layer-lifecycle.test.ts`, `post-studio-prop-render-options.test.ts`, `post-tunnel-appearance.test.ts`; the moved files' own relative imports.
- Not moved here: `PostStudio.svelte.test.ts` and `PostStudioTestHarness.svelte` (Task 22 rewrites them around the scope). `src/lib/features/compose/services/post-animation-overlay-painter.ts` names `PostStudioSequenceAnimationLayer` only in a comment at line 19; leave it.

- [ ] **Step 1: Confirm the importer list.** From TKA:
  ```bash
  grep -rlE "(PostStudioSequenceAnimationLayer|PostStudioChoreoLayer|PostStudioTunnelLayer|PostStudioMandalaLayer|PostStudioBreakdownMandala|post-animation-effects[.]svelte|post-card-highlight|post-item-render-options|post-qr-image-appearance|post-studio-art-context|post-studio-prop-render-options|post-appearance-fit|PostAnimationAppearanceTool|PostAppearanceChooser|PostCardAppearanceTool|PostScopedEffectsPanel|PostSequenceActionsTool|PostStaffEffectsTool)" src tests --include=*.ts --include=*.svelte | sort
  ```
  Expected: the 27 paths listed while reviewing: the 9 movers that name another mover, the 9 importers in Files, the 8 tests, and `src/lib/features/compose/services/post-animation-overlay-painter.ts` (comment only, left as it is). A path not on that list is added to this task's commit and named in the report.
- [ ] **Step 2: Move.** From TKA, `mkdir -p src/lib/shared/post-studio-plugin/ui`, then one `git mv` per file, for example:
  ```bash
  git mv src/lib/shared/share/components/post-studio/PostStudioChoreoLayer.svelte src/lib/shared/post-studio-plugin/ui/PostStudioChoreoLayer.svelte
  git mv src/lib/shared/share/components/post-studio/editor/PostStaffEffectsTool.svelte src/lib/shared/post-studio-plugin/ui/PostStaffEffectsTool.svelte
  ```
- [ ] **Step 3: Rewrite the imports.** Every importer outside `PUI` uses the alias form `$lib/shared/post-studio-plugin/ui/<basename>` (with `.svelte` kept and `.ts` dropped, as tka writes them). Every relative import inside a moved file that pointed at a `PS` neighbour that did not move becomes the `$lib/shared/share/components/post-studio/...` alias; one that pointed at another mover becomes `./<basename>`. Then from TKA:
  ```bash
  grep -rnE "post-studio/(editor/)?(PostStudioSequenceAnimationLayer|PostStudioChoreoLayer|PostStudioTunnelLayer|PostStudioMandalaLayer|PostStudioBreakdownMandala|post-animation-effects|post-card-highlight|post-item-render-options|post-qr-image-appearance|post-studio-art-context|post-studio-prop-render-options|post-appearance-fit|PostAnimationAppearanceTool|PostAppearanceChooser|PostCardAppearanceTool|PostScopedEffectsPanel|PostSequenceActionsTool|PostStaffEffectsTool)" src tests --include=*.ts --include=*.svelte | grep -v "ceremony-manifest"
  grep -rnE "from .[.][.]?/" src/lib/shared/post-studio-plugin/ui
  ```
  Expected: the first prints nothing. The second prints only imports of other `PUI` files (`./`) or, for none of the movers, `../` imports of `PLUGIN` data modules.
- [ ] **Step 4: Format and gates.** `npx prettier --check` on the changed tka files (they keep tka's style; `--write` only the ones that were clean before). Run the tka type gate, parity, tka subset, the tka component gate (its two paths now cover `PUI`'s `PostAnimationAppearanceTool.svelte.test.ts`) and the plugin closure gate. The closure grep must still print nothing: the movers are under `ui/`, and no `PLUGIN` data module imports them (confirm with `grep -rn "/ui/" src/lib/shared/post-studio-plugin --include=*.ts | grep -v "^src/lib/shared/post-studio-plugin/ui/"`, expected empty).
- [ ] **Step 5: Commit** (tka). Pathspecs are the 19 old and 19 new paths plus every modified importer, for example:
  ```bash
  git add src/lib/shared/share/components/post-studio src/lib/shared/post-studio-plugin/ui src/routes/test/display-tiles/+page.svelte src/routes/test/post-hook-speeds/+page.svelte tests/unit/media-composition/post-animation-effects.test.ts tests/unit/media-composition/post-appearance-fit.test.ts tests/unit/media-composition/post-item-appearance.test.ts tests/unit/media-composition/post-qr-image-appearance.test.ts tests/unit/media-composition/post-static-card-highlight.test.ts tests/unit/media-composition/post-studio-media-layer-lifecycle.test.ts tests/unit/media-composition/post-studio-prop-render-options.test.ts tests/unit/media-composition/post-tunnel-appearance.test.ts && git commit -m "refactor(post): the TKA layers and tools move under the plugin's ui folder" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  Before the add, `git status --short src/lib/shared/share/components/post-studio src/lib/shared/post-studio-plugin/ui` lists only this task's renames and importer edits (the directory pathspecs would otherwise sweep in another session's work; there is none in this worktree, but check).

### Task 12: The small splits and the UI plugin object (opus; review opus)

Splits `post-editor-tools.ts`, `post-editor-labels.ts` (labels only; icons wait for Task 17), `PostAddPanel.svelte`, `post-editor-add.ts`, `post-crop-steps.ts` and `post-timeline-selection.ts` in tka, copies the clock and speed formatting out of `builder/`, and creates the UI plugin object the later splits fill in. Gates: tka type gate, parity, tka subset, tka component gate, plugin closure gate. tka only.

**Files (all tka):**
- Create: `PS/editor/post-format.ts`, `PUI/tka-editor-context.ts`, `PUI/tka-row.ts`, `PUI/tka-tools.ts`, `PUI/tka-kind-ui.ts`, `PUI/tka-add-items.ts`, `PUI/tka-crop-steps.ts`, `PUI/tka-timeline-join.ts`, `PUI/tka-plugin-ui.ts`, `PUI/tka-editor-plugin.ts`, `PUI/tka-row.test.ts`
- Modify: `PS/editor/post-editor-tools.ts`, `PS/editor/post-editor-labels.ts`, `PS/editor/PostAddPanel.svelte`, `PS/editor/post-editor-add.ts`, `PS/editor/post-crop-steps.ts`, `PS/editor/timeline/post-timeline-selection.ts`, `PS/editor/timeline/PostTimeline.svelte` (line 227), `PS/editor/PostEditorWorkspace.svelte` (props, editor creation, `selection` at 1142-1165, `cropSteps` at 1552-1560, the panels' catalog at 2676-2686), `PS/editor/PostMediaPanel.svelte` (library props, Step 6a), `MC/state/post-editor-state.svelte.ts` (`addLibraryVideo`, Step 6a), `tests/unit/media-composition/post-editor-legacy-map.test.ts` (one case, Step 6a), `PS/PostStudio.svelte` (passes `plugin`), and the twelve importers of `builder/post-builder-format` (file map, `PS/builder` section): `PostAddPanel.svelte`, `PostCropTimeline.svelte`, `PostEditorTransport.svelte`, `PostEditorWorkspace.svelte`, `PostExportPanel.svelte`, `PostItemTool.svelte`, `PostKeyframeControls.svelte`, `PostMediaPanel.svelte`, `PostMusicTool.svelte`, `timeline/PostTimelineItem.svelte`, `timeline/PostTimelineKeyLane.svelte`, `timeline/PostTimelineMusicLane.svelte`
- Test: the existing tka tests for these modules (`grep -rlE "post-editor-tools|post-editor-labels|post-editor-add|post-crop-steps|post-timeline-selection" tests src --include=*.ts`), each updated only where a signature changes.

- [ ] **Step 1: Pin today's rows (failing first).** `PUI/tka-row.test.ts` pins every row `toolRow` returns today, as literals, against the split functions this task writes:
  ```ts
  import { describe, expect, it } from "vitest";
  import type { PostItem, PostItemKind } from "@austencloud/video-editor/core";
  import { coreToolRow } from "$lib/shared/share/components/post-studio/editor/post-editor-tools";
  import { NO_FACTS, tkaRow, type TkaRowFacts } from "./tka-row";
  import { tkaAddOrder } from "./tka-add-items";

  const TAIL = ["position", "fade", "rename", "duplicate", "delete"];
  const item = (kind: string) => ({ kind }) as unknown as PostItem;
  const row = (kind: string | null, facts: Partial<TkaRowFacts> = {}, music = false) =>
  	tkaRow(kind === null ? null : item(kind), coreToolRow({ kind: kind as PostItemKind | null, music }), { ...NO_FACTS, ...facts });

  describe("tka tool rows are today's rows", () => {
  	it("nothing selected, and music", () => {
  		expect(row(null)).toEqual(["videos", "add", "canvas", "split", "look"]);
  		expect(row(null, {}, true)).toEqual(["back", "music", "delete"]);
  	});
  	it("video, with and without a layout", () => {
  		const tail = ["position", "border", "fade", "effects", "beats", "rename", "duplicate", "delete"];
  		expect(row("video")).toEqual(["back", "split", "trim", "crop", "speed", "volume", ...tail]);
  		expect(row("video", { hasLayout: true })).toEqual(["back", "split", "trim", "crop", "speed", "volume", "layout", ...tail]);
  	});
  	it("animation: plain, hook, hook over footage, tunnel", () => {
  		expect(row("animation")).toEqual(["back", "split", "appearance", "sequence", "timing", ...TAIL]);
  		expect(row("animation", { isTunnelHook: true, hasBackdrop: true })).toEqual(["back", "split", "appearance", "sequence", "speed", "crop", "timing", ...TAIL]);
  		expect(row("animation", { isTunnel: true })).toEqual(["back", "appearance", "speed", "delete"]);
  		expect(row("animation", { isTunnel: true, hasBackdrop: true })).toEqual(["back", "appearance", "speed", "crop", "delete"]);
  	});
  	it("moves, text, titles, carousel, image, QR image, card", () => {
  		expect(row("moves")).toEqual(["back", "split", "appearance", "shows", "sequence", "timing", ...TAIL]);
  		expect(row("text")).toEqual(["back", "split", "text", "timing", ...TAIL]);
  		expect(row("titles")).toEqual(["back", "titles", "timing", ...TAIL]);
  		expect(row("carousel")).toEqual(["back", "split", "timing", ...TAIL]);
  		expect(row("image")).toEqual(["back", "split", "timing", ...TAIL]);
  		expect(row("image", { isQrImage: true })).toEqual(["back", "split", "appearance", "timing", ...TAIL]);
  		expect(row("card")).toEqual(["back", "split", "appearance", "sequence", "timing", ...TAIL]);
  	});
  	it("the add panel keeps today's order", () => {
  		expect(tkaAddOrder(["text", "card"])).toEqual(["animation", "moves", "mandala", "carousel", "text", "titles", "card", "tunnel-hook"]);
  	});
  });
  ```
  Run `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/post-studio-plugin/ui/tka-row.test.ts`; expected FAIL (the modules do not exist). If the unit config does not collect `src/**/*.test.ts`, put the file at `tests/unit/media-composition/tka-row.test.ts` with `$lib` imports instead, and say so in the report.
- [ ] **Step 2: The core row.** In `post-editor-tools.ts`: the TKA ids leave the id unions, which become `CorePanelToolId` (`videos add canvas export trim timing crop speed volume position border fade transition effects text rename music`) and `CoreActionToolId` (`back split duplicate delete`); `export type PostToolId = string;` (a core or plugin id). `PostToolSelection` keeps only `kind: PostItemKind | null` and `music?: boolean`. `ACTION_TOOLS` becomes the four core actions and
  ```ts
  export function isPanelTool(id: string, tools: readonly PluginTool[] = []): boolean {
    if (ACTION_TOOLS.has(id)) return false;
    return tools.find((tool) => tool.id === id)?.type !== "action";
  }

  /** The core row for a selection; a plugin arranges it through `ui.toolRow`. */
  export function coreToolRow(selection: PostToolSelection): string[] {
    if (selection.music) return ["back", "music", "delete"];
    switch (selection.kind) {
      case null:
        return ["videos", "add", "canvas", "split"];
      case "video":
        return ["back", "split", "trim", "crop", "speed", "volume", "position", "border", "fade", "effects", "rename", "duplicate", "delete"];
      case "text":
        return ["back", "split", "text", "timing", ...ITEM_TAIL];
      default:
        return ["back", "split", "timing", ...ITEM_TAIL];
    }
  }

  export function toolRow(
    selection: PostToolSelection,
    item: PostItem | null,
    plugin: VideoEditorPlugin | null,
    editor: VideoEditorState
  ): string[] {
    const core = coreToolRow(selection);
    return [...(plugin?.ui?.toolRow?.(item, core, editor) ?? core)];
  }
  ```
  `availablePanels`, `defaultPanel`, `shownPanel`, `panelChannel` and `keyframeChannelFor` keep their bodies with `PostPanelToolId` widened to `string`. Types come from `@austencloud/video-editor` (`PluginTool`, `VideoEditorPlugin`, `VideoEditorState`) and `@austencloud/video-editor/core` (`PostItem`, `PostItemKind`).
- [ ] **Step 3: The TKA row.** `PUI/tka-row.ts`:
  ```ts
  import { findItem, type PostItem } from "@austencloud/video-editor/core";
  import type { VideoEditorState } from "@austencloud/video-editor";
  import { tkaEditorOf } from "./tka-editor-context";

  /** What tka's rows depend on, worked out by the workspace before 2B (PostEditorWorkspace.svelte 1142-1164). */
  export interface TkaRowFacts {
    isQrImage: boolean;
    isTunnel: boolean;
    isTunnelHook: boolean;
    hasBackdrop: boolean;
    hasLayout: boolean;
  }

  export const NO_FACTS: TkaRowFacts = { isQrImage: false, isTunnel: false, isTunnelHook: false, hasBackdrop: false, hasLayout: false };

  export function tkaRowFacts(item: PostItem, editor: VideoEditorState): TkaRowFacts {
    const tka = tkaEditorOf(editor);
    // A tunnel folded into its animation has its own block, which carries its speed and
    // framing; only a hook saved as a whole item keeps them here.
    const tunnel = editor.selectedPart === "tunnel";
    const wholeHook = item.kind === "animation" && item.tunnelHook?.seconds === undefined;
    return {
      isQrImage: item.kind === "image" && (tka?.isQrImage(item.imageId) ?? false),
      isTunnel: tunnel,
      isTunnelHook: item.kind === "animation" && !!item.tunnelHook && (tunnel || wholeHook),
      hasBackdrop: item.kind === "animation" && !!item.tunnelHook?.backdrop && (tunnel || wholeHook),
      hasLayout: item.kind === "video" && findItem(editor.project, item.id)?.trackIndex === 0,
    };
  }

  const TAIL = ["position", "fade", "rename", "duplicate", "delete"];

  function insertAfter(row: readonly string[], anchor: string, ids: readonly string[]): string[] {
    const at = row.indexOf(anchor) + 1;
    return [...row.slice(0, at), ...ids, ...row.slice(at)];
  }

  /** tka's rows, built from the core row so the core keeps its own order. */
  export function tkaRow(item: PostItem | null, core: readonly string[], facts: TkaRowFacts): readonly string[] {
    if (item === null) return core[0] === "videos" ? [...core, "look"] : core;
    switch (item.kind) {
      case "video":
        return insertAfter(insertAfter(core, "volume", facts.hasLayout ? ["layout"] : []), "effects", ["beats"]);
      case "image":
        return facts.isQrImage ? insertAfter(core, "split", ["appearance"]) : core;
      case "card":
        return insertAfter(core, "split", ["appearance", "sequence"]);
      case "animation":
        if (facts.isTunnel) return ["back", "appearance", "speed", ...(facts.hasBackdrop ? ["crop"] : []), "delete"];
        return ["back", "split", "appearance", "sequence", ...(facts.isTunnelHook ? ["speed"] : []), ...(facts.hasBackdrop ? ["crop"] : []), "timing", ...TAIL];
      case "moves":
        return ["back", "split", "appearance", "shows", "sequence", "timing", ...TAIL];
      case "titles":
        return ["back", "titles", "timing", ...TAIL];
      default:
        return core;
    }
  }
  ```
  (The `item.tunnelHook` and `item.imageId` reads narrow by `kind` exactly as the workspace's did. `findItem` is the core function the workspace calls today.)
- [ ] **Step 4: The TKA context and registry.** `PUI/tka-editor-context.ts` (design H; the members are filled as later tasks need them, this task adds the registry and the two the rows read):
  ```ts
  import { getContext, setContext } from "svelte";
  import type { VideoEditorState } from "@austencloud/video-editor";
  import type { PostEditorState } from "$lib/shared/media-composition/state/post-editor-state.svelte";

  /** What tka's plugin functions need beyond the generic state. */
  export interface TkaEditorFacts {
    /** tka's wrapper, the same object the editor UI holds as `editor`. */
    wrapper: PostEditorState;
    isQrImage(imageId: string): boolean;
    /** Opens the timing mode on the selected clip; set by the scope from Task 15b on. */
    openBeats?(): void;
  }

  const FACTS = new WeakMap<object, TkaEditorFacts>();

  /** Called once where the wrapper is created (the workspace until Task 15a, then TkaEditorScope). */
  export function registerTkaEditor(editor: PostEditorState, facts: TkaEditorFacts): void {
    FACTS.set(editor, facts);
  }

  /** The facts for an editor tka created, or undefined for any other editor. */
  export function tkaEditorOf(editor: VideoEditorState): TkaEditorFacts | undefined {
    return FACTS.get(editor);
  }

  /** Design H's context; Tasks 13 to 15b add its members. */
  export interface TkaEditorContext {
    editor: PostEditorState;
  }

  const TKA_EDITOR = Symbol("tka-editor");

  export function provideTkaEditor(ctx: TkaEditorContext): TkaEditorContext {
    setContext(TKA_EDITOR, ctx);
    return ctx;
  }

  export function useTkaEditor(): TkaEditorContext {
    const ctx = getContext<TkaEditorContext | undefined>(TKA_EDITOR);
    if (!ctx) throw new Error("useTkaEditor() runs inside TkaEditorScope or the workspace.");
    return ctx;
  }
  ```
- [ ] **Step 5: Tools, kinds and adds.** `PUI/tka-tools.ts` exports `TKA_TOOLS: readonly PluginTool[]`, one entry per TKA tool id in the order `look layout titles labels appearance shows sequence beats`, each `{ id, type: "panel", label: (t) => t(<the key toolLabel uses today>), icon: <the icon TOOL_ICON uses today, as the faX definition from "@austencloud/video-editor/icons"> }`, except `beats`, which is `{ id: "beats", type: "action", ..., run: (editor) => tkaEditorOf(editor)?.openBeats?.() }` (Task 15b sets `openBeats` on the facts; until then the workspace keeps handling the `beats` id itself and `run` is not called, because the workspace checks its own action ids first). The label keys and icon classes are read from `post-editor-labels.ts` (`toolLabel`, `TOOL_ICON`); the class-to-definition names are seam design E's table. `PUI/tka-kind-ui.ts` exports `TKA_KIND_UI: Record<"animation" | "moves" | "carousel" | "titles", ItemKindUi>` with `icon` from `ITEM_KIND_ICON` (moves gets `iconFor: (item) => item.kind === "moves" && item.mode === "mandala" ? faSun : faShapes`) and `label` moved from the four TKA cases of `itemKindLabel` (lines 40-51, moves keeping its mode branch through `item`). `PUI/tka-add-items.ts`:
  ```ts
  import type { PluginAddItem, VideoEditorState } from "@austencloud/video-editor";
  import { faCircleNodes, faHeading, faPersonRunning, faShapes, faSun, faTableCells, faXmark } from "@austencloud/video-editor/icons";
  import { newItemStart, overlayAt } from "$lib/shared/share/components/post-studio/editor/post-editor-add";
  import { tkaEditorOf } from "./tka-editor-context";
  import { TKA_KIND_UI } from "./tka-kind-ui";

  function overlay(editor: VideoEditorState, spec: Parameters<typeof overlayAt>[1]): string | null {
    const at = newItemStart(editor.durationSeconds, editor.previewSeconds);
    return editor.addOverlay(overlayAt(editor.project, spec, at, true)) ? spec.kind : null;
  }

  const always = () => true;

  export const TKA_ADD_ITEMS: Readonly<Record<string, PluginAddItem>> = {
    animation: { id: "animation", icon: faPersonRunning, label: (t) => TKA_KIND_UI.animation.label!(t, null), available: always, add: (e) => overlay(e, { kind: "animation", overlay: true }) },
    moves: { id: "moves", icon: faShapes, label: (t) => t("post_editor_kind_moves"), available: always, add: (e) => overlay(e, { kind: "moves", mode: "arrows" }) },
    mandala: { id: "mandala", icon: faSun, label: (t) => t("post_editor_kind_mandala"), available: always, add: (e) => overlay(e, { kind: "moves", mode: "mandala" }) },
    carousel: { id: "carousel", icon: faTableCells, label: (t) => TKA_KIND_UI.carousel.label!(t, null), available: always, add: (e) => overlay(e, { kind: "carousel" }) },
    titles: {
      id: "titles", icon: faHeading, label: (t) => TKA_KIND_UI.titles.label!(t, null), available: always,
      add: (e) => (tkaEditorOf(e)?.wrapper.addTitles(newItemStart(e.durationSeconds, e.previewSeconds)) ? "titles" : null),
    },
    hookAdd: {
      id: "tunnel-hook", icon: faCircleNodes, label: (t) => t("post_editor_add_tunnel_hook"),
      available: (e) => !tkaEditorOf(e)?.wrapper.tunnelHook,
      add: (e) => (tkaEditorOf(e)?.wrapper.addTunnelHook() ? "animation" : null),
    },
    hookRemove: {
      id: "tunnel-hook", icon: faXmark, label: (t) => t("post_editor_remove_tunnel_hook"),
      available: (e) => !!tkaEditorOf(e)?.wrapper.tunnelHook,
      add: (e) => { tkaEditorOf(e)?.wrapper.removeTunnelHook(); return null; },
    },
  };

  /** Today's order around the core entries (`text`, `card`). */
  export function tkaAddItems(core: readonly string[]): readonly (string | PluginAddItem)[] {
    const has = (id: string) => (core.includes(id) ? [id] : []);
    const a = TKA_ADD_ITEMS;
    return [a.animation!, a.moves!, a.mandala!, a.carousel!, ...has("text"), a.titles!, ...has("card"), a.hookAdd!, a.hookRemove!];
  }

  /** The ids in order, for the pinning test (both hook entries share one id and one slot). */
  export function tkaAddOrder(core: readonly string[]): string[] {
    return [...new Set(tkaAddItems(core).map((entry) => (typeof entry === "string" ? entry : entry.id)))];
  }
  ```
  The `mandala` and `moves` keys are the ones `itemKindLabel("moves", mode)` returns today (read lines 42-45 for the mandala key and use it). The literal `!` assertions are on a const record the file defines.
- [ ] **Step 6: The generic add panel and `overlayAt`.** `overlayAt(project, spec, at, fillOverMain = false)` returns `{ ...spec, at, fill: fillOverMain && mainItemAt(project, at) !== null }` (the kind test leaves). `PostAddPanel.svelte` gains a `plugin: VideoEditorPlugin | null` prop; its `ITEMS` becomes
  ```ts
  const CORE_ITEMS = ["text", "card"];
  const coreItem = (id: string) =>
    id === "text"
      ? { id, icon: ITEM_KIND_ICON.text, svg: null, label: itemKindLabel("text"), run: () => addOverlay({ kind: "text", text: t("post_editor_text_placeholder"), size: TEXT_SIZE }) }
      : { id, icon: ITEM_KIND_ICON.card, svg: null, label: t("post_editor_add_card_end"), run: addCard };
  const ITEMS = $derived(
    (plugin?.ui?.addItems?.(CORE_ITEMS) ?? CORE_ITEMS).flatMap((entry) =>
      typeof entry === "string"
        ? [coreItem(entry)]
        : entry.available(editor)
          ? [{ id: entry.id, icon: "", svg: entry.icon, label: entry.label(t), run: () => { editor.pause(); const kind = entry.add(editor); if (kind) onAdded(kind); } }]
          : []
    )
  );
  ```
  and the row's icon markup renders `{#if item.svg}<Icon icon={item.svg} />{:else}<i class="fa-solid {item.icon}" aria-hidden="true"></i>{/if}` (`Icon` from `@austencloud/video-editor/icons`; Task 17 makes every row an `Icon` and drops `svg`). `addTitles`, `addTunnelHook`, `removeTunnelHook` and the TKA entries leave the panel.
- [ ] **Step 6a: The library panels take library takes (seam design C).** `PostAddPanel.svelte` and `PostMediaPanel.svelte` drop `CatalogTakeSource` from their wrapper import (keeping `PostEditorState`) and gain `import type { LibraryTake } from "@austencloud/video-editor";`. Their props become:
  ```ts
  // PostAddPanel.svelte (plugin from Step 6). It shows no loading or error state today, so it takes neither.
  interface Props {
    editor: PostEditorState;
    plugin: VideoEditorPlugin | null;
    catalog: readonly LibraryTake[];
    /** A picked file is being read. */
    busy?: boolean;
    onAddDeviceVideo: () => void;
    /** Runs once the new item is in and selected. */
    onAdded: (kind: PostItemKind) => void;
  }

  // PostMediaPanel.svelte
  interface Props {
    editor: PostEditorState;
    catalog: readonly LibraryTake[];
    catalogLoading?: boolean;
    catalogError?: string | null;
    busy?: boolean;
    onAddDeviceVideo: () => void;
    onTapBeats: (takeId: string) => void;
  }
  ```
  with `catalogError = null` as the media panel's default. In both, the unused filter compares `take.ref.videoId === video.id`, the `{#each}` keys on `video.id`, and adding calls `editor.addLibraryVideo({ videoId: video.id, label: video.label, url: video.url, durationSeconds: video.durationSeconds })` where it called `editor.addCatalogVideo(video)` (`addSavedVideo` in the add panel keeps its `if (...) onAdded("video")`). In the media panel the duration note at 195-197 tests `video.detail` and shows `video.detail` where it showed `t("share_studio_timing_saved")`, keeping its separator.

  The wrapper gains, next to `addCatalogVideo` (182-186), and lists in its returned object (replacing the plain forward if Task 4's conformance step added one):
  ```ts
  /** A library take added by id; the catalog's own record still seeds an older timing map. */
  function addLibraryVideo(video: LibraryTakeSource): string | null {
    const known = deps.getCatalogVideo?.(video.videoId) ?? null;
    if (known) timing.rememberLegacy(known);
    return core.addLibraryVideo(video);
  }
  ```
  (`LibraryTakeSource` added to its imports from `@austencloud/video-editor`). `tests/unit/media-composition/post-editor-legacy-map.test.ts` gains, after its first case ("seeds a catalog video's timing from the map it was added with"):
  ```ts
  it("seeds a library video's timing from the catalog's map", () => {
    const state = editor(() => video(MAP));
    state.addLibraryVideo(video());
    const takeId = state.takes[0]!.id;
    expect(state.timing(takeId)?.sections[0]?.taps).toEqual(SEEDED_TAPS);
    state.dispose();
  });
  ```
  Until Task 15a the workspace keeps its `catalog` (270-292) and maps it for the panels, so tka renders the same list:
  ```ts
  // Today's list as library takes, until Task 15a loads services.mediaLibrary.
  const libraryCatalog = $derived<LibraryTake[]>(
    catalog.map((video) => ({
      id: video.videoId,
      label: video.label,
      url: video.url,
      durationSeconds: video.durationSeconds,
      ...(video.legacyStepMap ? { detail: t("share_studio_timing_saved") } : {}),
    }))
  );
  ```
  and passes `catalog={libraryCatalog}` to both panels and `catalogError={videoLibrary?.error || null}` to the media panel (2676-2686).
- [ ] **Step 7: Kind labels.** In `post-editor-labels.ts`, `itemKindLabel(kind, mode?)` keeps its core cases and gains `plugin: VideoEditorPlugin | null = null` and `item: PostItem | null = null` parameters; its default case is `plugin?.itemKinds.find((d) => d.kind === kind)?.ui?.label?.(t, item) ?? plugin?.itemKinds.find((d) => d.kind === kind)?.label ?? kind`. Every caller that labels a TKA kind passes the plugin (find them with `grep -rn "itemKindLabel(" src/lib/shared/share/components/post-studio`; the workspace has the plugin from Step 10; children receive it as a prop the same way `PostAddPanel` does). `toolLabel(id)` gains the same fallback through `plugin?.ui?.tools?.find((tool) => tool.id === id)?.label(t)`. `ITEM_KIND_ICON`, `MANDALA_ICON`, `itemIcon` and `TOOL_ICON` keep their TKA entries until Task 17.
- [ ] **Step 8: Crop steps, timeline join, formats.** `post-crop-steps.ts` keeps `ClipStep` (now `import type { ClipStep } from "@austencloud/video-editor"`, re-exported as `export type { ClipStep }` so its importers do not change) and `adjacentStepSeconds`; `clipSteps` and the `shownLandings` import move to `PUI/tka-crop-steps.ts`, which adds
  ```ts
  export function tkaCropSteps(editor: VideoEditorState, itemId: string): readonly ClipStep[] {
    const wrapper = tkaEditorOf(editor)?.wrapper;
    const clip = wrapper ? findItem(wrapper.project, itemId)?.item : undefined;
    if (!wrapper || clip?.kind !== "video") return [];
    return clipSteps(clip, wrapper.timing(clip.takeId), wrapper.resolvedTiming(clip.takeId));
  }
  ```
  and the workspace's `cropSteps` (1552-1560) becomes `cropMode && crop.item ? [...(plugin?.ui?.cropSteps?.(editor, crop.item.id) ?? [])] : []`. `post-timeline-selection.ts` loses `TimelineHandoffPair`, `timelineHandoffPair` and the `pipHandoffOf` import; `PUI/tka-timeline-join.ts` holds them and exports `tkaTimelineJoin(project): TimelineJoin | null` mapping `animationId, movesId, animationTrackIndex, movesTrackIndex, start, end` to `fromId, toId, fromTrackIndex, toTrackIndex, start, end`. `PostTimeline.svelte:227` becomes `const handoffPair = $derived(plugin?.ui?.timelineJoin?.(project) ?? null);` with a `plugin` prop, and its reads of the pair's fields use the new names. `PS/editor/post-format.ts` holds copies of all four exports, `formatPostClock`, `formatTakeClock`, `formatPostSpeed` and `parseClock` (with their private helpers), from `builder/post-builder-format.ts`; the twelve importers listed in Files switch to it (relative `./post-format` or `../post-format`; `PostTimelineMusicLane` drops its `$lib` alias); `builder/` keeps its file for `PostTimingPanel`, `PostTimingTimeline` and `TakeTimingLane`.
- [ ] **Step 9: The UI plugin object.** `PUI/tka-plugin-ui.ts`:
  ```ts
  import type { PluginUi } from "@austencloud/video-editor";
  import { tkaAddItems } from "./tka-add-items";
  import { tkaCropSteps } from "./tka-crop-steps";
  import { NO_FACTS, tkaRow, tkaRowFacts } from "./tka-row";
  import { tkaTimelineJoin } from "./tka-timeline-join";
  import { TKA_TOOLS } from "./tka-tools";

  /** Tasks 13 to 15b add toolPanel, mediaSublayer, canvasOverlays, modes, panels, createBindings and layerContextMenu. */
  export function createTkaPluginUi(): PluginUi {
    return {
      tools: TKA_TOOLS,
      toolRow: (item, core, editor) => tkaRow(item, core, item ? tkaRowFacts(item, editor) : NO_FACTS),
      addItems: tkaAddItems,
      cropSteps: tkaCropSteps,
      timelineJoin: tkaTimelineJoin,
    };
  }
  ```
  `PUI/tka-editor-plugin.ts` is design B's code plus `createSurfaces: createTkaSurfaces` (import from `../surfaces`), with `TKA_KIND_UI[definition.kind as keyof typeof TKA_KIND_UI]` so a core kind gets `undefined`.
- [ ] **Step 10: Wire it.** `PostStudio.svelte` creates `const plugin = createTkaEditorPlugin();` once and passes `{plugin}` to the workspace. The workspace gains `plugin: VideoEditorPlugin | null` in `Props`; right after the editor is created (line 298) it calls `registerTkaEditor(editor, { wrapper: editor, isQrImage: (id) => qrImageIds[id] === true })` (move the `qrImageIds` declaration above that line) and `provideEditorUi({ editor, host: editor.host, plugin, services })` with `const services = resolveServices(editor.host);` declared just before it (Task 15a's library load reads it), where `editor.host` is the `host` object the wrapper returns since Task 4 (`resolveServices` from `@austencloud/video-editor`). `selection` becomes `{ kind: item?.kind ?? null, music: musicSelected }` and `tools` becomes `toolRow(selection, editor.selectedItem ?? null, plugin, editor)`. `isPanelTool(id)` calls pass `plugin?.ui?.tools ?? []`. The workspace passes `plugin` down to `PostAddPanel` and `PostTimeline`.
- [ ] **Step 11: Run the pinning test and the gates.** `tka-row.test.ts` passes; then the tka type gate, parity, tka subset, tka component gate and the plugin closure gate. The closure grep stays empty because only `PUI` files import `.svelte` modules; `PLUGIN/index.ts`, `bound.ts` and `create-plugin.ts` do not import `PUI`.
- [ ] **Step 12: Commit** (tka):
  ```bash
  git add src/lib/shared/post-studio-plugin/ui src/lib/shared/share/components/post-studio/PostStudio.svelte src/lib/shared/share/components/post-studio/editor/post-format.ts src/lib/shared/share/components/post-studio/editor/post-editor-tools.ts src/lib/shared/share/components/post-studio/editor/post-editor-labels.ts src/lib/shared/share/components/post-studio/editor/PostAddPanel.svelte src/lib/shared/share/components/post-studio/editor/post-editor-add.ts src/lib/shared/share/components/post-studio/editor/post-crop-steps.ts src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte src/lib/shared/share/components/post-studio/editor/PostCropTimeline.svelte src/lib/shared/share/components/post-studio/editor/PostEditorTransport.svelte src/lib/shared/share/components/post-studio/editor/PostExportPanel.svelte src/lib/shared/share/components/post-studio/editor/PostItemTool.svelte src/lib/shared/share/components/post-studio/editor/PostKeyframeControls.svelte src/lib/shared/share/components/post-studio/editor/PostMediaPanel.svelte src/lib/shared/share/components/post-studio/editor/PostMusicTool.svelte src/lib/shared/share/components/post-studio/editor/timeline src/lib/shared/media-composition/state/post-editor-state.svelte.ts tests/unit/media-composition/post-editor-legacy-map.test.ts <the updated test files> && git commit -m "refactor(post): tool rows, adds, labels, crop steps and the timeline join come from the plugin; the panels list library takes" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  (`<the updated test files>` is the list Step 1's grep printed, minus those this task did not change; name them in the report.)

### Task 13: `PostItemTool.svelte` split (opus; review opus)

Seam design G3. Gates: tka type gate, parity, tka subset, tka component gate, plugin closure gate; the verbatim check in Step 6. tka only, except Step 2's possible package commit.

**Files:**
- Create (tka): `PS/editor/item-tool/ToolReadout.svelte`, `PS/editor/item-tool/ToolStatus.svelte` (generic; they move to `UI/editor/item-tool/` in Task 19), `PUI/TkaKindTools.svelte`, `PUI/TkaItemTools.svelte`
- Modify (tka): `PS/editor/PostItemTool.svelte`, `PUI/tka-editor-context.ts`, `PUI/tka-kind-ui.ts`, `PUI/tka-plugin-ui.ts`, `PS/editor/PostEditorWorkspace.svelte` (the `PostItemTool` call and a temporary `provideTkaEditor`)
- Modify (package, only if Step 2 finds a generic prop): `PKG/src/plugin.ts` (`ToolPanelProps`)

- [ ] **Step 1: The snippets become components.** `ToolStatus.svelte` takes `{ text: string; icon: string; action: string; run: () => void }` and renders the `status` snippet's markup (852-860) with its `.status` rules from `PostItemTool`'s `<style>`. `ToolReadout.svelte` takes `{ name: string; value: string; typed: (seconds: number) => void; set: { icon: string; run: () => void } | null; locked: boolean; playheadInside: boolean }` and renders the `readout` snippet (874 to its `{/snippet}`) with the `.readout*` rules; `parseClock` comes from `../post-format`, `TypeableValue` and `PanelButton` from the same tka paths `PostItemTool` uses. `PostItemTool` renders `<ToolStatus .../>` and `<ToolReadout ... {locked} {playheadInside} />` where it rendered the snippets, and its now-unused rules leave its `<style>` (a rule the remaining markup still uses stays in both).
- [ ] **Step 2: List what each leaving branch reads.** For each range in design G3 (946-958, 1107-1150, 1151-1178, 1179-1192, 1225-1242, 1419-1429, 1430-1440, 1441-1448, 1449-1485, 1486-1504, 1505-1506, 1507-1525, 1526-1533) and the script functions only they use (341-441: `replaceWithLiveAnimation`, `setLook`, the tunnel appearance and hook functions), list every prop, local and import they read. A read of `editor`, `item`, `tool` or `locked` is a `ToolPanelProps` member. A read of `staffTips`, `cardRenderOptions`, `tunnel`, `featureMode`, `stepCount` or `sequenceBusy` becomes a `TkaEditorContext` member (Step 3). Any other generic prop of `PostItemTool` (for example `appearanceFill`) joins `ToolPanelProps` as an optional member with the same type: edit `PKG/src/plugin.ts`, run the package gate, commit the package first (`git add packages/video-editor/src/plugin.ts && git commit -m "feat(video-editor): tool panels receive <name>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`), and name it in the report. A shared local (`playheadInside`, `formatSpeed`) is recomputed in the receiving component from the same expression.
- [ ] **Step 3: The TKA context members.** `TkaEditorContext` gains read-only `staffTips: StaffTipAnalysis | null`, `cardRenderOptions: Partial<SequenceExportOptions> | null`, `featureMode: boolean`, `stepCount: number`, `sequenceBusy: boolean` (the types `PostItemTool`'s `Props` gives them). Until Task 15a the workspace provides the context during its init, after the editor is created, as an object of getters over its own state:
  ```ts
  provideTkaEditor({
    editor,
    get staffTips() { return staffTips; },
    get cardRenderOptions() { return cardRenderOptions ?? null; },
    get featureMode() { return feature !== null; },
    get stepCount() { return <the expression passed as stepCount today>; },
    get sequenceBusy() { return <the expression passed as sequenceBusy today>; },
  });
  ```
  (Read the two expressions from the workspace's `<PostItemTool` call.) `tunnel` is not a member: the TKA components read `editor.selectedPart === "tunnel"`.
- [ ] **Step 4: The two TKA components.** `PUI/TkaKindTools.svelte` takes `ToolPanelProps`, reads `const tka = useTkaEditor();`, and renders, inside one `{#if item?.kind === "animation"} ... {:else if item?.kind === "moves"} ... {:else if item?.kind === "titles"} ... {/if}`, the kind branches of G3 (animation: backdrop crop, tunnel speed, tunnel appearance, appearance, labels, shows when the item is an animation; moves: appearance, shows, labels; titles: titles), each keeping its `{#if tool === "<id>"}` test from `PostItemTool`. `PUI/TkaItemTools.svelte` takes `ToolPanelProps` and renders the plugin branches for core kinds: `trim` on a video (the replace button, 946-958), `layout` (1225-1242), `effects` on a video (1419-1429), `appearance` on a card (1449-1485) and on a QR image (1486-1504), `sequence` (1505-1506). Each component carries the script functions its branches use and copies every `<style>` rule its markup's classes need from `PostItemTool` (G3; risk R11). `tka-kind-ui.ts` sets `toolPanel: TkaKindTools` on `animation`, `moves` and `titles`; `tka-plugin-ui.ts` adds `toolPanel: TkaItemTools`.
- [ ] **Step 5: The generic tool renders the plugin panels.** `PostItemTool.svelte` loses the branches and functions above and the props `staffTips`, `cardRenderOptions`, `tunnel`, `featureMode`, `stepCount`, `sequenceBusy`; it gains `plugin: VideoEditorPlugin | null`. After its last core branch it renders, in this order:
  ```svelte
  {@const KindPanel = plugin?.itemKinds.find((d) => d.kind === item.kind)?.ui?.toolPanel}
  {#if KindPanel}<KindPanel {editor} {item} {tool} {locked} />{/if}
  {#if plugin?.ui?.toolPanel}
    {@const ItemPanel = plugin.ui.toolPanel}
    <ItemPanel {editor} {item} {tool} {locked} />
  {/if}
  ```
  (place the `{@const}` tags inside the block that wraps the branches, where Svelte allows them). The order matches today's: the two additions to core tools (trim's replace button, video effects' staff panel) were the last children of their branches. The workspace passes `{plugin}` instead of the removed props.
- [ ] **Step 6: Verbatim check.** Every line that left `PostItemTool.svelte` must be in a receiving file. From TKA:
  ```bash
  git diff -U0 HEAD -- src/lib/shared/share/components/post-studio/editor/PostItemTool.svelte | grep "^-" | grep -v "^---" | sed 's/^-//; s/^ *//' | sort -u > "$SCRATCH/t13-removed.txt"
  cat src/lib/shared/post-studio-plugin/ui/TkaKindTools.svelte src/lib/shared/post-studio-plugin/ui/TkaItemTools.svelte src/lib/shared/share/components/post-studio/editor/item-tool/*.svelte src/lib/shared/share/components/post-studio/editor/PostItemTool.svelte | sed 's/^ *//' | sort -u > "$SCRATCH/t13-kept.txt"
  comm -23 "$SCRATCH/t13-removed.txt" "$SCRATCH/t13-kept.txt"
  ```
  Expected: only prop declarations, imports and the snippet headers this task replaced. The report lists every printed line with its reason.
- [ ] **Step 7: Gates, then commit** (tka):
  ```bash
  git add src/lib/shared/share/components/post-studio/editor/item-tool src/lib/shared/share/components/post-studio/editor/PostItemTool.svelte src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte src/lib/shared/post-studio-plugin/ui/TkaKindTools.svelte src/lib/shared/post-studio-plugin/ui/TkaItemTools.svelte src/lib/shared/post-studio-plugin/ui/tka-editor-context.ts src/lib/shared/post-studio-plugin/ui/tka-kind-ui.ts src/lib/shared/post-studio-plugin/ui/tka-plugin-ui.ts && git commit -m "refactor(post): the item tool's TKA panels render from the plugin" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  (Add `-m "Package: video-editor@<short hash>"` when Step 2 made a package commit.)

### Task 14: Canvas, timeline and media layer splits (opus; review opus)

Seam designs G2, G4 and G5, one commit each, in the order media layer, timeline, canvas (the canvas renders the media layer). Gates after each part: tka type gate, parity, tka subset, tka component gate, plugin closure gate, and the verbatim check of Task 13 Step 6 run on the part's monolith against its receiving files. Trace-script gate after Part A (it touches a binding type the state reads).

**Files:**
- Create (tka): `PUI/TkaMediaSublayer.svelte`, `PUI/tka-canvas-layer.ts`, `PUI/TkaStripGuide.svelte`, `PUI/tka-parts.ts`
- Modify (tka): `PS/PostStudioMediaLayer.svelte`, `PS/editor/PostEditorCanvas.svelte`, `PS/editor/timeline/PostTimeline.svelte`, `PS/editor/timeline/PostTimelineItem.svelte`, `PS/editor/PostEditorWorkspace.svelte` (props it passes), `PUI/tka-editor-context.ts`, `PUI/tka-kind-ui.ts`, `PUI/tka-plugin-ui.ts`, the binding factory in the workspace that builds staff roles (sets `bareWhileCropping`)
- Modify (package, first): `PKG/src/state/source-binding.ts` (`bareWhileCropping?: boolean`)

**Part A: the media layer (G5).**
- [ ] **Step A1: Package field.** `CompositionSourceBinding` gains
  ```ts
  	/** The canvas draws this source without its crop chrome while the crop screen is open (tka: staff roles). */
  	readonly bareWhileCropping?: boolean;
  ```
  Package gate; commit `feat(video-editor): a binding can ask to stay bare while cropping` with the trailer.
- [ ] **Step A2: The sublayer.** `PUI/TkaMediaSublayer.svelte` takes `MediaSublayerProps` and renders the four branches of `PostStudioMediaLayer.svelte` 710-758 verbatim (their `{#if binding.renderMode === ...}` tests included), with the 19 TKA props of G5 computed inside from `layer`, `sourceItem`, `underlyingItem`, `playing`, `exporting` and `useTkaEditor()`. Each prop's expression is the one `PostEditorCanvas.svelte` passes today (2398-2460): move those expressions into `PUI/tka-canvas-layer.ts` as functions of `(editor, layer, sourceItem, underlyingItem, tka)` (`hookChromeOpacity` 303, `paintedLabelRegions` 491, `OPENING_POSITION` 516, `cardOptionsForItem`, `posterQrAppearance`, `animationAppearanceForItem`), so the canvas and the sublayer share one definition. The context gains what those functions read that is not on the wrapper (`sequence`, `qrSequence`, `cardRenderOptions`, `effectsIn`, `lookBlend` and the rest: list them in the report), provided by the workspace's getters object until Task 15a.
- [ ] **Step A3: The generic layer.** `PostStudioMediaLayer.svelte` loses the 19 props and the four branches and gains `plugin: VideoEditorPlugin | null`, `editor`, `sourceItem`, `underlyingItem`, `playing`, `exporting` (whichever it does not already take); where the branches were:
  ```svelte
  {:else if plugin?.ui?.mediaSublayer?.renderModes.includes(binding.renderMode)}
    {@const Sublayer = plugin.ui.mediaSublayer.component}
    <Sublayer {editor} {binding} {layer} {role} {regionId} {preset} {sourceItem} {underlyingItem} {playing} {exporting} />
  ```
  `handleContextMenu` (509-513) becomes `if (plugin?.ui?.layerContextMenu) { event.preventDefault(); plugin.ui.layerContextMenu(event); }`. `VisualSequenceSaveContextMenuHost` (832) leaves the layer; the workspace mounts it once (Task 15a moves it to the scope) and `tka-plugin-ui.ts` sets `layerContextMenu: (event) => <the open call that handleContextMenu makes today>` through the context's `openSaveMenu`. The video branch keeps the per-update `muted` assignment byte for byte. `tka-plugin-ui.ts` sets `mediaSublayer: { renderModes: ["sequence-animation", "choreo-card", "tunnel", "mandala"], component: TkaMediaSublayer }`.
- [ ] **Step A4: Gates and commit** (tka; body names the package commit): `refactor(post): the media layer's TKA branches render through the plugin sublayer`.

**Part B: the timeline (G4).**
- [ ] **Step B1: The tunnel as a part.** `PUI/tka-parts.ts` exports `TUNNEL_PART: ItemPart` with `id: "tunnel"`, `span(item)` returning `{ start: item.start, end: tunnelEndOf(item) }` for an animation whose tunnel is folded in and `null` otherwise (the body of `tunnelEndOf` and the condition the block uses, `PostTimeline.svelte` 263-324, move here), `label: (t) => t(<the key the tunnel block shows>)`, `icon: faCircleNodes`. `tka-kind-ui.ts` sets `parts: [TUNNEL_PART]` on `animation`.
- [ ] **Step B2: The generic timeline.** `PostTimeline.svelte`: the tunnel block becomes a loop over `kindUi(item)?.parts ?? []` that draws each part with a non-null span using the same markup and classes as the tunnel block; `selectedPart` stays (now `string | null`), `onSelectTunnel(id)` becomes `onSelectPart(id, part)`; `crossfadeKinds` (417-424) becomes `new Set(["video", "image", ...(plugin?.itemKinds.filter((d) => d.transitionVisual).map((d) => d.kind) ?? [])])` (check the current set's core members and keep exactly those). `PostTimelineItem.svelte`'s `tunnel` prop becomes `part: { id: string; label: string; icon: IconDefinition } | null`, rendering the icon through `Icon` (the one place a part icon draws before Task 17). The workspace passes `onSelectPart={(id, part) => editor.selectPart(id, part)}`.
- [ ] **Step B3: Gates and commit** (tka): `refactor(post): the timeline draws plugin parts instead of the tunnel block`.

**Part C: the canvas (G2).**
- [ ] **Step C1:** Props `sequence`, `cardRenderOptions`, `qrSequence`, `showStripGuide` leave `PostEditorCanvas.svelte`; the functions Step A2 moved are imported from nowhere (the canvas no longer passes TKA props to the media layer; it passes `plugin`, `sourceItem`, `underlyingItem`, `playing`, `exporting`). `pressFrame` (798-815) becomes: find the hit item's kind parts, take the first whose `span(item)` holds `editor.previewSeconds`, and call `editor.selectPart(item.id, part.id)` when found, else `editor.selectItem(item.id)` as today. `class:crop-bare` (2388) reads `binding?.bareWhileCropping === true`; the workspace's staff role bindings set `bareWhileCropping: true` (the roles the class tested by name today). `getKeyboardShortcutManager().addInputSuppressor` (1389) becomes `useEditorUi().services.shortcuts.suppress(<the same predicate>)` with its unregister returned from the same effect.
- [ ] **Step C2: Overlays.** The strip guide markup (2484-2493) moves to `PUI/TkaStripGuide.svelte` (`CanvasOverlayProps`; hidden while `cropping`; `stripGuideVisible` 503 moves with it and reads `useTkaEditor()`); the canvas renders `{#each plugin?.ui?.canvasOverlays ?? [] as Overlay}<Overlay {editor} cropping={cropMode} />{/each}` where the guide was. `tka-plugin-ui.ts` sets `canvasOverlays: [TkaStripGuide]`.
- [ ] **Step C3: Gates and commit** (tka): `refactor(post): the canvas reaches TKA layers and overlays through the plugin`.

### Task 15a: The TKA scope, the viewer bridge and the bindings (opus; review opus)

Seam design G1 and H, first half: the scope takes over the workspace's TKA set-up (the wrapper, the per-sequence store, the timing session, the facts, the keyboard manager, the QR detection, the feature connect), the viewer bridge and the non-core bindings leave, and the library list and the previews become generic. **15a leaves tka rendering identically:** the timing branches, the editor's undo bridge and the TKA props stay in the workspace until 15b, so every screen, control and label is the one tka shows today. Gates: tka type gate, parity, tka subset, tka component gate, plugin closure gate, trace-script gate, and the verbatim check (Task 13 Step 6) on the workspace.

**Files:**
- Create (tka): `PUI/TkaEditorScope.svelte`, `PUI/TkaViewerBridge.svelte`, `PUI/tka-painters.svelte.ts`
- Modify (tka): `PS/editor/PostEditorWorkspace.svelte`, `PS/PostStudio.svelte`, `PUI/tka-editor-context.ts`, `PUI/tka-plugin-ui.ts`, `MC/state/post-editor-state.svelte.ts`
- Package: no change (`createBindings`'s `previewUrl` is part of seam design B's types, which Task 9 adds)

- [ ] **Step 1: Mode forwarding in the wrapper.** `mode` and `selectedPart` become forwards of the package state (seam design A): the wrapper's own `mode` field (111, 327-332) and `selectedPart` (341) are replaced by getters and setters over `core.mode` and `core.selectedPart`; the timing state's tunnel selection calls `core.selectPart(id, "tunnel")`, and the Task 9 shim `selectPart` becomes `selectPart: (itemId, part) => core.selectPart(itemId, part)`. `selectTunnel(id)` stays as `core.selectPart(id, "tunnel")` for the timing code that calls it. Run the tka subset and the trace-script gate before going on.
- [ ] **Step 2: The scope.** `PUI/TkaEditorScope.svelte` takes the props the workspace takes today for TKA data (design A's list: `sequence`, `feature`, `cardPreviewUrl`, `animationPreviewUrl`, `animationPreviewType`, `cardRenderOptions`, `isPreparingCard`, `isPreparingAnimation`, `selectedPropType`, `onPropChange`, `onProjectPropChange`), plus `initialProject` (workspace prop 211, passed to `createPostEditorState` at 299 today), plus `children: Snippet<[TkaScopeChildren]>` with `TkaScopeChildren = { editor: PostEditorState; plugin: VideoEditorPlugin; readonly inspectorTarget: HTMLElement | null }`. During init it does, in this order, what the workspace does today at 270-345 and 358:
  - keeps the per-sequence store and today's list for tka's own reads (the wrapper's `getCatalogVideo` and the hand labeling at 540-547): `videoLibrary` (273-275), `catalogVideos` (280) and `catalog: CatalogTakeSource[]` (281-291), unchanged; today's `$effect` calling `videoLibrary?.load()` (276-278) leaves, because the workspace's library load (Step 4a) calls `listTakes()`, which loads the store;
  - creates the two holders the bindings fill: the overlay holder of Step 4, and `const previews: { resolve: ((takeId: string, url: string | null) => string | null) | null } = { resolve: null };`;
  - creates the wrapper with today's deps, named:
    ```ts
    const editor = createPostEditorState({
      initialProject,
      getSequence: () => sequence,
      getCatalogVideo: (videoId) =>
        catalog.find((video) => video.videoId === videoId) ?? null,
      hasAnimationOverlay: () => overlay.painter !== null,
      store: featureVideo?.store,
      services: tkaEditorServices(videoLibrary),
    });
    ```
    (`featureVideo` is `const featureVideo = feature;`, read once as at 296-297);
  - creates the plugin, `const plugin = createTkaEditorPlugin();` (moved from `PostStudio.svelte`, Task 12 Step 10);
  - creates the timing session as at 358-361, with `(takeId, url) => previews.resolve?.(takeId, url) ?? url` in place of `videoPreviews.resolve(takeId, url).url` (the previews stay in the workspace; the bindings fill `previews.resolve` from `createBindings`'s `previewUrl`, Step 4, before any take plays);
  - registers the facts, `registerTkaEditor(editor, { wrapper: editor, isQrImage: (id) => qrImageIds[id] === true })` (moved from the workspace, Task 12 Step 10; `openBeats` joins in Task 15b Step 6);
  - provides `TkaEditorContext`: the members from Tasks 13 and 14 plus `displaySequence`, `qrSequence`, `onRequestAnimation`, `openSaveMenu`, `timing`, `catalogVideos`, `previews`, `overlay` and `inspectorTarget` (Step 3);
  - initialises the keyboard manager as today's onMount at 362-368 does (`getKeyboardShortcutManager().initialize()` and `registerEditHistoryShortcuts(manager, keyboardShortcutState.isMac)`); that onMount and its three imports (lines 4-6) leave the workspace;
  - runs the QR image detection that fills `qrImageIds` (1072-1090), connects the feature video (370-447's feature part), mounts `VisualSequenceSaveContextMenuHost` once, renders `<TkaViewerBridge />`, and renders `{@render children({ editor, plugin, get inspectorTarget() { return context.inspectorTarget; } })}`, where `context` is the `TkaEditorContext` object it provides.

  It disposes the wrapper on destroy, as the workspace does today. The workspace gains `editor: PostEditorState` in `Props` and loses `initialProject`, the catalog (270-292), the wrapper creation (298-307) and the session (358-361); until 15b its timing branches read the session as `const session = useTkaEditor().timing;`, and its TKA props stay. `PostStudio.svelte` drops its own `createTkaEditorPlugin()` and renders, inside the same `{#key sequence.id}`, the scope with the TKA props and the workspace with every prop it has today (until Task 15b Step 8 removes the TKA ones):
  ```svelte
  <TkaEditorScope
    {sequence}
    {initialProject}
    {feature}
    {cardPreviewUrl}
    {animationPreviewUrl}
    {animationPreviewType}
    cardRenderOptions={synchronizedCardRenderOptions}
    {isPreparingCard}
    {isPreparingAnimation}
    {selectedPropType}
    onPropChange={(propType) => {
      urlPropType = undefined;
      projectPropType = propType;
    }}
    onProjectPropChange={(propType) => (projectPropType = propType)}
  >
    {#snippet children(scope)}
      <PostEditorWorkspace
        editor={scope.editor}
        plugin={scope.plugin}
        inspectorTarget={scope.inspectorTarget}
        {active}
        {sequence}
        {feature}
        {onSaveDraft}
        {draftLoadError}
        {cardPreviewUrl}
        {animationPreviewUrl}
        {animationPreviewType}
        cardRenderOptions={synchronizedCardRenderOptions}
        {isPreparingCard}
        {isPreparingAnimation}
        {onExported}
        {onSharePost}
        {previewTarget}
        {sharing}
        {selectedPropType}
        onPropChange={(propType) => {
          urlPropType = undefined;
          projectPropType = propType;
        }}
        onProjectPropChange={(propType) => (projectPropType = propType)}
        {audioSeed}
        onAudioChange={setAudio}
        {registerExport}
      />
    {/snippet}
  </TkaEditorScope>
  ```
- [ ] **Step 3: The viewer bridge.** `PUI/TkaViewerBridge.svelte` holds 266-268 and 2113-2143 (`getViewerStudioSurfaces`, the external inspector, `setInspectorContent`, `setControls`, the playing sync), reading the editor from `useTkaEditor()`. It exposes the computed inspector element through the context (`inspectorTarget`). The workspace has no such prop today (it computes the element itself from the viewer surfaces at 266-268), so this task adds `inspectorTarget?: HTMLElement | null` to its `Props`, uses it where the workspace used the computed element (`externalInspector`, read at 1107, 1113 and 2999), and `PostStudio` passes it from the scope's snippet (`scope.inspectorTarget`, Step 2; design A).
- [ ] **Step 4: Bindings.** `PUI/tka-painters.svelte.ts` exports `createTkaBindings({ editor, t, previewUrl }): PluginBindings`, holding the labeled card and hand labeling (540-562), the staff tip analysis (624-654), and every non-core role of the painter section (564-856): staff, titles, moves, strip, carousel, overlay, choreo-card and sequence. Its `bindingFor(role)` returns the binding for those roles and `null` otherwise; `exportPainters()` returns their painters; `dispose()` releases what the section disposes today. The `hasAnimationOverlay` dependency the wrapper reads becomes a holder object the scope creates and passes both to `createPostEditorState` deps and, through the context, to the bindings. `tka-plugin-ui.ts` sets `createBindings: createTkaBindings`. The workspace keeps the core roles (image, take video, text through `createTextPainters(() => editor.compiled)` from Task 7, replacing the local map and function at 592-603) and asks the plugin second:
  ```ts
  // Declared after videoPreviews (347), whose resolver the scope's timing session reads through the bindings.
  const pluginBindings =
    plugin?.ui?.createBindings?.({
      editor,
      t,
      previewUrl: (takeId, url) => videoPreviews.resolve(takeId, url).url,
    }) ?? null;
  onDestroy(() => pluginBindings?.dispose());
  function bindingFor(role: string): CompositionSourceBinding | null {
    return coreBindingFor(role) ?? pluginBindings?.bindingFor(role) ?? null;
  }
  function exportPainters(): Map<string, PostStudioLayerPainter> {
    return new Map([...corePainters(), ...(pluginBindings?.exportPainters() ?? [])]);
  }
  ```
  (`coreBindingFor` and `corePainters` are the remaining core parts of today's functions, renamed.) `createTkaBindings` reads the context during the workspace's init and sets `useTkaEditor().previews.resolve = previewUrl`, which the scope's timing session calls (Step 2); the hand labeling reads `catalogVideos` from the context.
- [ ] **Step 4a: The library list and the previews, generic (seam design C).** Task 12's `libraryCatalog` mapping gives way to a load of `services.mediaLibrary` (`services` is the `resolveServices(editor.host)` const of Task 12 Step 10):
  ```ts
  let catalog = $state.raw<readonly LibraryTake[]>([]);
  let catalogLoading = $state(false);
  let catalogError = $state<string | null>(null);
  $effect(() => {
    const library = services.mediaLibrary;
    if (!library) return;
    let stale = false;
    async function load(): Promise<void> {
      catalogLoading = true;
      try {
        const takes = await library.listTakes();
        if (stale) return;
        catalog = takes;
        catalogError = null;
        editor.attachLibraryTakes();
      } catch (cause) {
        if (stale) return;
        catalog = [];
        catalogError = cause instanceof Error ? cause.message : String(cause);
      } finally {
        if (!stale) catalogLoading = false;
      }
    }
    void load();
    const off = library.onChange?.(() => void load());
    return () => {
      stale = true;
      off?.();
    };
  });
  ```
  It replaces the attach effect at 523-526 (`attachCatalogTakes` once the list arrives). With no `mediaLibrary` nothing loads, `catalog` stays empty and neither panel shows a library section (Task 21 asserts it). The panels get `{catalog}`, `{catalogLoading}` and `{catalogError}` (2676-2686). `createVideoPreviews` (347-357) takes `services.previewCache` in place of `getPreviewVideoCache()`. The imports of `CatalogTakeSource`, `getSequenceVideosStore` and `getPreviewVideoCache` leave the workspace. Report this behaviour note: `catalogLoading` now covers the editor's own load, not every load of the shared store, so a reload another surface starts no longer shows the loading line here; the list still updates when it lands, through `onChange`.
- [ ] **Step 4b: Checks.** The verbatim check on the workspace against `TkaEditorScope.svelte`, `TkaViewerBridge.svelte` and `tka-painters.svelte.ts`. Then `grep -nE "getSequenceVideosStore|getPreviewVideoCache|CatalogTakeSource|getViewerStudioSurfaces|getKeyboardShortcutManager|registerEditHistoryShortcuts|createPostEditorState|createTkaEditorPlugin|registerTkaEditor" src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte` prints nothing. tka renders as before: the timing branches, both `EditHistoryShortcutBridge`s and the TKA props are still the workspace's.
- [ ] **Step 4c: Gates, then commit** (tka): the gates in this task's heading, then
  ```bash
  git add src/lib/shared/post-studio-plugin/ui src/lib/shared/share/components/post-studio/PostStudio.svelte src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte src/lib/shared/media-composition/state/post-editor-state.svelte.ts && git commit -m "refactor(post): the TKA scope creates the editor; the viewer bridge, the bindings and the library load leave the workspace" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 15b: The timing mode, the look and backup panels, the undo keys and the props (opus; review opus)

Seam design G1 and H, second half. After this task the workspace imports nothing TKA-specific except what Tasks 16 and 17 substitute (`t`, `fa-`, tka kit paths). Its steps keep the numbers they had in the single Task 15 (5 to 10). Gates: tka type gate, parity, tka subset, tka component gate, plugin closure gate, trace-script gate, the verbatim check (Task 13 Step 6) on the workspace, and the full tka test gate (controller).

**Files:**
- Create (tka): `PUI/tka-timing-mode.ts`, `PUI/TkaTimingToolbar.svelte`, `PUI/TkaTimingDock.svelte`, `PUI/TkaTimingPanel.svelte`, `PUI/TkaTimingStage.svelte`, `PUI/TkaTimingTimeline.svelte`, `PUI/TkaLookPanel.svelte`, `PUI/TkaBackupPanel.svelte`, `PS/editor/EditHistoryKeys.svelte`
- Modify (tka): `PS/editor/PostEditorWorkspace.svelte`, `PS/PostStudio.svelte`, `PUI/TkaEditorScope.svelte`, `PUI/tka-editor-context.ts`, `PUI/tka-plugin-ui.ts`, `PUI/tka-tools.ts`
- Modify (package, first): `PKG/src/plugin.ts` only if a timing slot needs a prop `EditorMode` lacks (same rule as Task 13 Step 2)

- [ ] **Step 5: The timing mode.** `PUI/tka-timing-mode.ts` exports `TKA_TIMING_MODE: EditorMode` with `id: "timing"`, `toolbar: TkaTimingToolbar`, `dock: TkaTimingDock`, `panel: TkaTimingPanel`, `stage: TkaTimingStage`, `timeline: TkaTimingTimeline` and `keydown` holding the timing keys (1923, 1945; return true when handled). Each `TkaTiming*.svelte` takes `{ editor }` (the toolbar also `draftStatus`), reads the timing session from `useTkaEditor().timing`, and renders the markup of the workspace's timing branches for its slot (toolbar 2913-2935 plus the session's `EditHistoryShortcutBridge` at 2888-2894, rendered first inside it with tka's own bridge component; dock 2645-2654 and the settings `Drawer` 3299-3325; panel the `timingPanel` snippet 2846-2864; stage 2943-2955 and 3003; timeline 3034-3041 and 3212), with the `builder/` components they render today and the style rules their classes need (risk R11). `tka-plugin-ui.ts` sets `modes: [TKA_TIMING_MODE]`. In the workspace, `showTimingStage` becomes `activeMode !== null` with `const activeMode = $derived(plugin?.ui?.modes?.find((m) => m.id === editor.mode) ?? null);`, and each branch renders its slot:
  ```svelte
  {#if activeMode?.stage}
    {@const Stage = activeMode.stage}
    <Stage {editor} />
  {:else}
    <!-- the edit mode's stage, as today -->
  {/if}
  ```
  The toolbar renders where the timing toolbar is today: `{#if activeMode?.toolbar}{@const Toolbar = activeMode.toolbar}<Toolbar {editor} {draftStatus} />{/if}`. The key handler calls `if (activeMode?.keydown?.(event, editor)) return;` first. The playback surface name and the section's `data-mode` (`showTimingStage ? "timing" : ...` today) read `activeMode?.id ?? (cropMode ? "crop" : "edit")`.
- [ ] **Step 6: Beats, look, backup.** `openBeats` and `openTakeBeats` (1412-1430) move into the scope as the facts' `openBeats()` (`editor.pause(); timing.openAt(clip.takeId, clip.sourceIn); editor.mode = "timing"` for the selected clip, as today); the `beats` entry in `TKA_TOOLS` already calls it, and the workspace's own `beats` case leaves (its action handler now runs a plugin action tool through `tool.run(editor)`). `tool === "look"` (2716) renders `ui.panels.look`: `PUI/TkaLookPanel.svelte` wraps `AnimationPanel` with the props the workspace passes today, read from the context. The InShot recovery package and backup download (imports at 160 and 175 and their handlers) move to `PUI/TkaBackupPanel.svelte` (`ui.panels.backup`) with the button markup that triggers them; the workspace renders `{#each Object.entries(plugin?.ui?.panels ?? {}) as [id, Panel]}{#if tool === id}<Panel {editor} />{/if}{/each}` where the look branch was, and the backup trigger shows where it shows today through the same loop with tool id `backup`.
- [ ] **Step 7: Keys and export.** `PS/editor/EditHistoryKeys.svelte` (generic; moves in Task 19) renders an anchor inside the section and registers the editor's history against it (seam design C):
  ```svelte
  <script lang="ts">
    import type { VideoEditorState } from "@austencloud/video-editor";
    import { useEditorUi } from "@austencloud/video-editor/ui";

    let { editor, active }: { editor: VideoEditorState; active: boolean } = $props();
    const { services } = useEditorUi();
    let anchor = $state<HTMLSpanElement | null>(null);

    $effect(() => {
      if (!active || !anchor) return;
      return services.shortcuts.editHistory(
        {
          undo: () => editor.undo(),
          redo: () => editor.redo(),
          canUndo: () => editor.canUndo,
          canRedo: () => editor.canRedo,
        },
        anchor,
      );
    });
  </script>

  <!-- The host may mount key targets here (tka: its undo bridge), so the anchor is never hidden:
       no hidden, aria-hidden or display: none, which tka's resolver skips (shortcut-target-resolution.ts:17-31). -->
  <span class="history-keys" bind:this={anchor}></span>
  ```
  It replaces the bridge pair at 2888-2902 (the session's half went to the toolbar in Step 5, the editor's half is this): the workspace renders `<EditHistoryKeys {editor} active={activeMode === null} />` always, as the first child of the section (the element with `data-edit-history-shortcut-scope`, 2875), so a mode's toolbar owns undo while the mode is open, as the session bridge does today. tka's `editHistory` (Task 4) mounts its bridge into the anchor, so the hidden undo and redo buttons stay inside the focused scope where tka's keyboard manager looks for them; the package default listens on the window and acts while focus is in that section. The workspace's `EditHistoryShortcutBridge` import (line 3) leaves. The export at 2428 calls `plugin?.createSurfaces?.() ?? []` instead of `createTkaSurfaces()`.
- [ ] **Step 8: Props leave.** The workspace's TKA props (design A's list) leave its `Props`; every read of them is now in a `PUI` file. `PostStudio.svelte` stops passing them to the workspace (the scope has had them since Task 15a Step 2), so the workspace in its snippet keeps `editor`, `plugin`, `inspectorTarget` and the ten generic props.
- [ ] **Step 9: Checks.** The verbatim check on the workspace against every `PUI` file this task created. Then: `grep -nE "post-studio-plugin|take-timing|builder/|getViewerStudioSurfaces|createTkaSurfaces|pipHandoff|getKeyboardShortcutManager|EditHistoryShortcutBridge" src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte` prints nothing except type-only imports of `PostEditorState` (the wrapper type, still used until Task 16 switches it).
- [ ] **Step 10: Gates, then commit** (tka):
  ```bash
  git add src/lib/shared/post-studio-plugin/ui src/lib/shared/share/components/post-studio/PostStudio.svelte src/lib/shared/share/components/post-studio/editor/PostEditorWorkspace.svelte src/lib/shared/share/components/post-studio/editor/EditHistoryKeys.svelte && git commit -m "refactor(post): the timing mode, the look and backup panels and the undo keys leave the workspace" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  The controller then runs the full tka test gate.

### Task 16: Strings in the moving files (sonnet; review opus)

Seam design D, in tka, on every file whose fate is move or split (the generic remainders) plus `PS/editor/item-tool/*.svelte` and `PS/editor/EditHistoryKeys.svelte`. Gates: package gate, tka type gate, parity, tka subset, tka component gate.

**Files:**
- Modify (package): `PKG/src/strings/en.ts`, `PKG/test/strings.test.ts` (or the existing strings test file; `ls PKG/test | grep -i string`)
- Modify (tka): the moving files that import `t`, `PS/PostStudio.svelte`, `PS/editor/post-crop-session.svelte.ts`, `PS/editor/post-item-rect.ts`, `PS/editor/post-editor-files.ts` and their callers

- [ ] **Step 1: The moving set.** From TKA, list it once into `$SCRATCH/moving.txt` (the same set Tasks 17 to 20 use):
  ```bash
  cd /e/worktrees/tka-platform/video-editor/src/lib/shared/share/components/post-studio && ls PostStudioBackdrop.svelte PostStudioPaintedLayer.svelte PostStudioMediaLayer.svelte post-studio-share-export.ts editor/*.ts editor/*.svelte editor/item-tool/*.svelte editor/timeline/*.ts editor/timeline/*.svelte | grep -v "[.]test[.]ts$" > "$SCRATCH/moving.txt"; wc -l < "$SCRATCH/moving.txt"
  ```
  Expected: the file map's move and split files that are still under `PS` (the PUI files left in Task 11) plus the four new generic files of Tasks 12, 13 and 15b (`editor/post-format.ts`, two `item-tool` files, `EditHistoryKeys.svelte`). The report gives the count.
- [ ] **Step 2: Keys (failing test first).** Save the census script of seam design D as `$SCRATCH/keys.cjs` with the Write tool and run it on the moving set: `node "$SCRATCH/keys.cjs" $(sed 's|^|src/lib/shared/share/components/post-studio/|' "$SCRATCH/moving.txt") > "$SCRATCH/keys.txt"` from TKA. Expected about 280 lines. Add to the package strings test:
  ```ts
  import { EN } from "../src/strings/en.js";

  it("every English text uses only lowercase placeholders", () => {
  	for (const [key, text] of Object.entries(EN)) {
  		const holes = text.match(/[{][^}]*[}]/g) ?? [];
  		for (const hole of holes) expect(hole, key).toMatch(/^[{][a-z_]+[}]$/);
  	}
  });

  it("holds the post editor's keys", () => {
  	expect(EN.post_editor_set_to_playhead).toBeTypeOf("string");
  	expect(EN.post_editor_text_placeholder).toBeTypeOf("string");
  });
  ```
  Run the package unit tests: the second case fails (keys missing).
- [ ] **Step 3: The table.** Add every line of `$SCRATCH/keys.txt` to `EN` as `key: "English",` in alphabetical order among the existing keys (skip a key `EN` already has; if its English differs, keep tka's text and name it in the report). Package gate; the two cases pass. Commit the package: `feat(video-editor): the editor UI's English strings` with the trailer.
- [ ] **Step 4: The provider.** `PostStudio.svelte` calls `provideStrings(tkaEditorTranslate)` (from `@austencloud/video-editor/strings` and `$lib/shared/media-composition/state/editor-strings`) during its init, before it renders the scope.
- [ ] **Step 5: Components.** In every `.svelte` file of the moving set that imports `t` from `$lib/shared/i18n/i18n.svelte` (any spelling of that path), the import becomes `import { useStrings } from "@austencloud/video-editor/strings";` and `const t = useStrings();` is the first statement of the instance script. Calls stay as they are. `grep -lE "i18n[.]svelte" $(sed 's|^|src/lib/shared/share/components/post-studio/|' "$SCRATCH/moving.txt")` prints nothing afterwards.
- [ ] **Step 6: Modules.** `post-editor-files.ts`, `post-crop-session.svelte.ts`, `post-editor-labels.ts` and any other `.ts` file of the moving set that calls `t` take `t: Translate` as a parameter of the function that calls it (for a class or factory, a constructor or factory argument), and each caller passes its own `t`. `post-crop-session.svelte.ts` and `post-item-rect.ts` switch their `PostEditorState` type import to `VideoEditorState` from `@austencloud/video-editor` (they read only package members; a member the type lacks is a finding for the report, not a cast).
- [ ] **Step 7: The wrapper type in the moving set.** Every other moving file that imports the type `PostEditorState` switches to `VideoEditorState<PostTimingEffect>`, or to `VideoEditorState` where it reads no effect member. A file that reads a wrapper-only member (timing, tunnel, Tutorial) after Tasks 12 to 15b is a missed split: stop and report it. The `PostEdit` type, which the wrapper only re-exports from the package (line 77), comes from `@austencloud/video-editor` in the three files that import it from the wrapper: `PostEditorWorkspace.svelte` (82), `PostItemTool.svelte` (74) and `PostKeyframeControls.svelte` (35).
- [ ] **Step 8: Gates, then commit** (tka): `refactor(post): the editor UI reads its strings through the package context` with `Package: video-editor@<short hash>` and the trailer; pathspecs are the files Steps 4 to 7 changed, listed by `git status --short`.

### Task 17: Icons, tokens, the zoom popover and non-ASCII in the moving files (sonnet; review opus)

Seam designs E, F and I, in tka, on `$SCRATCH/moving.txt`. After this task a moving file differs from its package future only by import paths. Gates: package gate, tka type gate, parity, tka subset, tka component gate, full tka test gate (controller).

**Files:**
- Modify (package): `PKG/css/video-editor-tokens.css`, `PKG/src/ui/kit/icons.ts` and `PKG/test/icons.test.ts` (only for a class the table missed)
- Modify (tka): the moving files; `PUI/tka-kind-ui.ts`, `PUI/tka-tools.ts` (unchanged unless a name changes); `PS/PostStudio.svelte` (token import)

- [ ] **Step 1: Icons.** In each moving file, every `<i class="fa-solid fa-x" ...></i>` becomes `<Icon icon={faX} />` (an `aria-hidden` on the `<i>` is dropped because `Icon` sets it; a `title` or `aria-label` on the `<i>` moves to the nearest control, as design E says), with `import { Icon, faX } from "@austencloud/video-editor/icons";`. A dynamic class (`fa-solid {icon}`) becomes `<Icon icon={...} />` with the data it reads changed from class strings to definitions: `ITEM_KIND_ICON`, `MANDALA_ICON`, `itemIcon`, `TOOL_ICON` and `channelIcon` in `post-editor-labels.ts` become `Record<..., IconDefinition>` and functions returning `IconDefinition`, keeping only core kinds and core tools; their TKA entries are read through the plugin (`kindUi.iconFor?.(item) ?? kindUi.icon`, `plugin.ui.tools.find(...).icon`), so callers that look up an icon pass the plugin as Task 12 Step 7 does for labels. `PostAddPanel`'s `svg` field from Task 12 is dropped (every row now holds a definition). A CSS rule that selected the `<i>` (`i`, `.fa-solid`, `.fa-x`) becomes `:global(.ve-icon)` under the same parent selector, and a `font-size` set on it still sizes the icon because `Icon` is `1em` tall (risk R4). Then:
  ```bash
  grep -nE "(^|[^a-z-])fa-[a-z]" $(sed 's|^|src/lib/shared/share/components/post-studio/|' "$SCRATCH/moving.txt")
  ```
  Expected: nothing. A class not in design E's table is added to `icons.ts` (alphabetical) with the count in `test/icons.test.ts` raised; package gate and package commit first.
- [ ] **Step 2: Tokens.** For each family in design I (`--theme-*`, `--min-touch`, `--font-size-*`, `--transition-fast`, `--duration-fast`, `--semantic-*`) every `var(--<name>` in the moving files becomes `var(--ve-<name>` with its fallback kept. Collect the names: `grep -ohE "var[(]--(theme|semantic|font-size)-[a-z0-9-]+|var[(]--(min-touch|transition-fast|duration-fast)" <moving files> | sort -u`. Append to `PKG/css/video-editor-tokens.css`, inside one rule `.ve-root, .ve-portal { ... }`, one line per name: `--ve-<name>: var(--<name>, <the fallback the moving files use for it; when they use several, the most common>);`. Do the same rename in the `KIT` copies (Task 10 renamed them; confirm `grep -c "var(--theme" packages/video-editor/src/ui/kit -r` is 0). `PostStudio.svelte` imports `@austencloud/video-editor/css/video-editor-tokens.css` once and its root element (the one that wraps the scope) gets `class="ve-root"` added to its classes. Package gate and package commit first (`feat(video-editor): editor tokens scoped to the editor root and its portals`).
- [ ] **Step 3: The zoom popover.** `editor/timeline/PostTimelineZoomControls.svelte` replaces bits-ui `Popover.Root`, `Popover.Trigger` and `Popover.Content` with its trigger button (`bind:this={anchor}`, `onclick={() => (open = !open)}`, `aria-expanded={open}`) and `<Popover bind:open {anchor} label={t(<the key of its trigger's aria-label>)} placement="top" offset={<the sideOffset the Content had>}>` holding the same content, `Popover` from `@austencloud/video-editor/ui`. The three `--bits-popover-*` variables in its style become plain values on its content's class (same numbers). `grep -rn "bits-ui" $(sed 's|^|src/lib/shared/share/components/post-studio/|' "$SCRATCH/moving.txt")` prints nothing.
- [ ] **Step 4: Non-ASCII.** Apply the ground rules table to the moving files: `node -e "const fs=require('fs');const NL=String.fromCharCode(10);for(const f of fs.readFileSync(process.argv[1],'utf8').split(NL).map(s=>s.trim()).filter(Boolean)){const p='src/lib/shared/share/components/post-studio/'+f;fs.readFileSync(p,'utf8').split(NL).forEach((l,i)=>{if([...l].some(c=>c.charCodeAt(0)>127))console.log(p+':'+(i+1)+': '+l.trim())})}" "$SCRATCH/moving.txt"` lists them (save it as `$SCRATCH/nonascii.cjs` with the Write tool if the shell mangles it); each is replaced per its row, the markup entities keeping what tka shows. Afterwards the command prints nothing.
- [ ] **Step 5: Gates, then commit** (tka): `refactor(post): the editor UI draws package icons, reads ve tokens and uses the package popover` with `Package: video-editor@<short hash>` and the trailer; pathspecs from `git status --short`. The controller runs the full tka test gate.

### Task 18: Move the TypeScript modules (sonnet; review opus)

The 19 `.ts` files of the moving set (file map "Move 18", plus `editor/post-format.ts` from Task 12). Gates: package gate, tka type gate, parity, tka subset (count falls by the tests that move), tka component gate, plugin closure gate, `move.mjs --check`.

**Files:**
- Modify (package): `PKG/scripts/step2b/moves.json`, `PKG/src/ui/index.ts`; Create: the 19 placed files under `UI/` and the portable tests under `PKG/test/`
- Modify (tka): every importer `rewrite-imports.mjs` rewrites; `src/lib/shared/sequence-viewer/components/PostStudioPane.svelte` and `SequenceViewerShell.svelte` (the `ShareExport` type); `git rm` the 19 originals and the moved tests

- [ ] **Step 1: Entries.** Append to `moves` in `scripts/step2b/moves.json`, task 18, entry `@austencloud/video-editor/ui`, one line per file, `from` without `.ts` and `to` under `ui/`:
  ```json
  { "task": 18, "from": "$lib/shared/share/components/post-studio/post-studio-share-export", "to": "ui/share-export.ts", "entry": "@austencloud/video-editor/ui" },
  { "task": 18, "from": "$lib/shared/share/components/post-studio/editor/post-editor-header.svelte", "to": "ui/editor/post-editor-header.svelte.ts", "entry": "@austencloud/video-editor/ui" },
  { "task": 18, "from": "$lib/shared/share/components/post-studio/editor/timeline/post-timeline-geometry", "to": "ui/editor/timeline/post-timeline-geometry.ts", "entry": "@austencloud/video-editor/ui" },
  ```
  and the same shape for `post-editor-tools`, `post-editor-labels`, `post-editor-add`, `post-crop-steps`, `post-editor-files`, `post-box-drag`, `post-crop-geometry`, `post-crop-glide`, `post-crop-session.svelte`, `post-curve-plot`, `post-item-rect`, `post-picture-pan-drag`, `post-source-crop`, `post-source-geometry`, `post-format` (under `ui/editor/`) and `post-timeline-selection` (under `ui/editor/timeline/`).
- [ ] **Step 2: Dry run.** From PKG: `STEP_MOVES=../step2b/moves.json node scripts/step1/move.mjs --task 18 --dry` and `STEP_MOVES=../step2b/moves.json node scripts/step1/rewrite-imports.mjs --task 18 --dry`. Every `UNRESOLVED` line must be a kit file (resolved by Task 10's `copies`) or a fix to make first; every `ERROR` line from the rewrite is a hand edit listed in the report.
- [ ] **Step 3: Place and route.** Run both without `--dry`. Run `node scripts/step1/ascii.mjs` on the placed files (expected: no change, Task 17 cleaned them). For each name a remaining tka importer now takes from `@austencloud/video-editor/ui` (the rewrite prints them), add it to `src/ui/index.ts` as `export { name, type TypeName } from "./editor/<file>.js";`, grouped by file. `ShareExport`: `export type { ShareExport } from "./share-export.js";` (the placed file's exported type keeps its name; if tka's name differs, export it under both names and list it). Format the placed files (prettier `--write`, new files).
- [ ] **Step 4: Portable tests.** From PKG: `node scripts/step1/portable-tests.mjs`. Each listed mover whose module moved in this task is copied to `PKG/test/<basename>`, its `@austencloud/video-editor*` imports pointed at the declaring `../src/...` files (relative, `.js`), and run in the `unit` project; then `git rm` in tka. Name every moved test in the report; the tka subset count falls by exactly those.
- [ ] **Step 5: tka leftovers.** `git rm` the 19 originals. `PostStudioPane.svelte` and `SequenceViewerShell.svelte` import `type ShareExport` from `@austencloud/video-editor/ui`. Then from TKA: `grep -rnE "post-studio/(post-studio-share-export|editor/(post-editor-tools|post-editor-labels|post-editor-add|post-crop-steps|post-editor-files|post-editor-header|post-box-drag|post-crop-geometry|post-crop-glide|post-crop-session|post-curve-plot|post-item-rect|post-picture-pan-drag|post-source-crop|post-source-geometry|post-format|timeline/post-timeline-selection|timeline/post-timeline-geometry))" src tests --include=*.ts --include=*.svelte` prints nothing.
- [ ] **Step 6: Gates, then commits.** Package first:
  ```bash
  git add packages/video-editor/scripts/step2b/moves.json packages/video-editor/src/ui packages/video-editor/test && git commit -m "feat(video-editor): the editor's geometry, tool, label and crop modules move in" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```
  (before it, `git status --short packages/video-editor/src/ui packages/video-editor/test` lists only this task's files). Then tka: `git add` the importers and `git rm`'d paths from `git status --short`, message `refactor(post): the editor's modules come from the package`, with `Package: video-editor@<short hash>` and the trailer.

### Task 19: Move the leaf components (sonnet; review opus)

Every `.svelte` file of the moving set with "Move 19" in the file map, plus `editor/item-tool/ToolReadout.svelte`, `editor/item-tool/ToolStatus.svelte` and `editor/EditHistoryKeys.svelte` (Task 15b). The three music harness tests move with their components. Gates: as Task 18, plus the package `browser` project.

**Files:**
- Modify (package): `PKG/scripts/step2b/moves.json`, `PKG/scripts/step1/lib.mjs` (component re-exports, Step 1), `PKG/test/step1-tools.test.mjs`, `PKG/src/ui/index.ts`; Create: the placed components under `UI/`, the moved harnesses and their tests under `PKG/test/browser/`
- Modify (tka): every importer the rewrite changes (the PUI files, the workspace, the canvas, the item tool, the timeline, the media layer); `git rm` the originals and the moved harness tests

- [ ] **Step 1: Named imports of a component re-export.** A tka file converted in Tasks 16 and 17 imports `{ Icon, faX }` from `@austencloud/video-editor/icons` and `{ Popover }` from `@austencloud/video-editor/ui`; once placed in the package, `placeText` would point `Icon` and `Popover` at the barrel that re-exports them, which `--check` rejects. Failing test first, in `test/step1-tools.test.mjs`:
  ```js
  test("a named import of a component re-export becomes a default import of the component", () => {
  	const out = placeText({
  		text: lines('<script lang="ts">', '  import { Icon, faXmark } from "@austencloud/video-editor/icons";', "</script>"),
  		source: "E:/tka/src/lib/shared/share/components/post-studio/editor/PostToolRow.svelte",
  		to: "ui/editor/PostToolRow.svelte",
  	}).text;
  	assert.match(out, /import Icon from "[.][.][/]kit[/]Icon[.]svelte";/);
  	assert.match(out, /import [{] faXmark [}] from "[.][.][/]kit[/]icons[.]js";/);
  });
  ```
  (`placeText({ text, source, to, root = PKG, placed, entries, skip })` returns `{ text, rewrites, unresolved }`, the signature Task 2 tests; a `.svelte` source is rewritten one script block at a time, so the import sits inside `<script>`. `lines` and `NL` are the helpers defined at the top of `test/step1-tools.test.mjs`; `root` defaults to the real package, which has `UI/kit/Icon.svelte` and `UI/kit/icons.ts` from Task 8.) In `lib.mjs`, before the named-import split, read each entry's index once for lines matching `/^export [{] default as ([A-Za-z0-9_]+) [}] from "([^"]+[.]svelte)";/`, and for each such name in a named import of that entry emit `import <Name> from "<relative path from the placed file to the .svelte file>";`, removing the name from the named list (drop the declaration when the list empties). Run `node --test test/step1-tools.test.mjs` from PKG; it passes.
- [ ] **Step 2: Entries.** One `moves` line per component, task 19, `from` with `.svelte`, `to` under `ui/` (root files) or `ui/editor/`, `ui/editor/item-tool/`, `ui/editor/timeline/`; the three harnesses: `from` their tka path, `to` `../test/browser/fixtures/<basename>` if `move.mjs` accepts a target outside `src` (it resolves `to` against `src/`; if it rejects `..`, copy them by hand in Step 4).
- [ ] **Step 3: Dry run, place, route.** As Task 18 Steps 2 and 3, with `--task 19`. `src/ui/index.ts` gains `export { default as <Name> } from "./editor/<Name>.svelte";` for every component a tka file still imports (`rewriteDefaultComponentImport` from Task 2 turns tka's default imports into named imports of `./ui`). `node scripts/step1/move.mjs --check` exits 0, and `grep -rn "@austencloud/video-editor" packages/video-editor/src/ui` from PKGROOT prints nothing.
- [ ] **Step 4: The harnesses.** The three music harness tests (`grep -rlE "PostTimelineMusicLane|PostMusicPreview|PostMusicTool" tests src --include=*.test.ts` from TKA) and the harness components they mount move to `PKG/test/browser/` (tests) and `PKG/test/browser/fixtures/` (harnesses), with imports pointed at the placed components and `render` from `vitest-browser-svelte` replacing tka's mount helper if they used one (keep every assertion). They run in the package `browser` project; `git rm` them in tka.
- [ ] **Step 5: Diff review.** For each placed component: `git diff --no-index --word-diff <tka original at the task base> <placed file>`; every hunk is an import path (ground rules, "Behaves and looks the same").
- [ ] **Step 6: Gates, then commits** (package, then tka), messages `feat(video-editor): the editor's panels, tools and timeline lanes move in` and `refactor(post): the editor's panels come from the package`, pathspecs from `git status --short`, `Package:` line and trailer as before.

### Task 20: Move the five remainders and add `VideoEditor` (opus; review opus)

`PostEditorWorkspace.svelte`, `PostEditorCanvas.svelte`, `PostItemTool.svelte`, `timeline/PostTimeline.svelte` and `PostStudioMediaLayer.svelte` move; `UI/VideoEditor.svelte` and `UI/types.ts` are new. tka still renders the workspace through `PostStudio.svelte` (now importing it from `@austencloud/video-editor/ui`) until Task 22. Gates: package gate, tka type gate, parity, tka subset, tka component gate, plugin closure gate, trace-script gate, full tka test gate and tka production build (controller).

**Files:**
- Modify (package): `PKG/scripts/step2b/moves.json`, `PKG/src/ui/index.ts`, `PKG/src/index.ts`; Create: the five placed files, `PKG/src/ui/VideoEditor.svelte`, `PKG/src/ui/types.ts`
- Modify (tka): `PS/PostStudio.svelte`, the `PUI` files that import the five; `git rm` the five originals

- [ ] **Step 1: Last look for TKA reads.** In tka, before the move, for each of the five: `grep -nE "[$]lib/(shared/(post-studio-plugin|media-composition/(state/post-(editor|timing)|domain/(take-timing|pip-handoff|tap-fit)))|features)|PostEditorState|SequenceData" <file>`. Expected: nothing. A hit is a seam the splits missed; fix it in tka under this task (same rules as Tasks 13 to 15b) and commit it separately before the move.
- [ ] **Step 2: Entries and move.** Five `moves` lines, task 20 (`to`: `ui/editor/PostEditorWorkspace.svelte`, `ui/editor/PostEditorCanvas.svelte`, `ui/editor/PostItemTool.svelte`, `ui/editor/timeline/PostTimeline.svelte`, `ui/PostStudioMediaLayer.svelte`), then Task 18 Steps 2 and 3 with `--task 20`, `move.mjs --check` exiting 0, and `grep -rn "@austencloud/video-editor" packages/video-editor/src/ui` empty.
- [ ] **Step 3: `UI/types.ts`.** Design A's `VideoEditorProps`, plus a re-export of `ShareExport`. Every generic prop's type is the type the moved workspace's `Props` gives it (copy, do not retype).
- [ ] **Step 4: `UI/VideoEditor.svelte`.**
  ```svelte
  <script lang="ts" generics="E">
  	import { onDestroy } from "svelte";
  	import { resolveServices } from "../host-defaults.js";
  	import { createVideoEditorState } from "../state/video-editor-state.svelte.js";
  	import { provideStrings } from "../strings/context.js";
  	import { translatorFor } from "../strings/translate.js";
  	import { provideEditorUi } from "./editor-context.js";
  	import PostEditorWorkspace from "./editor/PostEditorWorkspace.svelte";
  	import type { VideoEditorProps } from "./types.js";

  	let { host, plugin, editor: given, stateOptions, ...rest }: VideoEditorProps<E> = $props();

  	// Host, plugin and state are fixed for the component's life, as the workspace's editor is today.
  	// `options` is required by the 2A signature and its `subjectId` scopes the saved project;
  	// a host that passes neither a state nor options edits one project per owner.
  	const editor = given ?? createVideoEditorState(host, plugin, stateOptions ?? { subjectId: "default" });
  	provideStrings(translatorFor(host));
  	provideEditorUi({ editor, host, plugin: plugin ?? null, services: resolveServices(host) });
  	onDestroy(() => {
  		if (!given) editor.dispose();
  	});
  </script>

  <div class="ve-root">
  	<PostEditorWorkspace {editor} plugin={plugin ?? null} {...rest} />
  </div>

  <style>
  	.ve-root {
  		display: contents;
  	}
  </style>
  ```
  `createVideoEditorState(host, plugin, options)` is the 2A signature (`src/state/video-editor-state.svelte.ts:216`): its second parameter is `plugin: VideoEditorPlugin | undefined`, required, so `plugin` is passed even when the host gives none; its third is `options: VideoEditorStateOptions<E>`, required, whose only required member is `subjectId` (`initialProject`, `libraryTake` and `extension` are optional), hence `stateOptions ?? { subjectId: "default" }`. If `display: contents` changes the layout, give `.ve-root` the box rules of the element that wraps the workspace in `PostStudio.svelte` today. The moved workspace stops providing the editor context when an ancestor already did, so tka's `PostStudio` path keeps working until Task 22: `editor-context.ts` gains `export function hasEditorUi(): boolean { return getContext<EditorUi | undefined>(EDITOR_UI) !== undefined; }`, and the workspace's Task 12 call becomes `if (!hasEditorUi()) provideEditorUi({ editor, host: editor.host, plugin, services: resolveServices(editor.host) });`.
- [ ] **Step 5: Exports.** `src/ui/index.ts` gains `export { default as VideoEditor } from "./VideoEditor.svelte";` and `export type { VideoEditorProps } from "./types.js";`; the root `src/index.ts` gains the same two lines with `./ui/` paths. Package gate.
- [ ] **Step 6: tka.** `PostStudio.svelte` imports `PostEditorWorkspace` from `@austencloud/video-editor/ui` (the rewrite does it). `git rm` the five originals. The tka grep of Task 18 Step 5, extended with the five basenames, prints nothing.
- [ ] **Step 7: Item 15 decision.** No `src` file calls the bound `evaluatePresetFrame` or `evaluatePresetLayers` (grep while planning: the callers are 13 tka tests, among them the frozen parity test, `tests/unit/video-editor-parity.test.ts:11`). The wrappers stay as tka's test API, because removing them would edit the frozen parity test. Confirm with `grep -rnE "evaluatePreset(Frame|Layers)" src --include=*.ts --include=*.svelte | grep -v "post-studio-plugin/bound.ts"` (expected empty); Task 23 records item 15 as decided.
- [ ] **Step 8: Gates, then commits** (package, then tka): `feat(video-editor): the workspace, canvas, item tool, timeline and media layer move in; VideoEditor` and `refactor(post): Post Studio renders the package workspace`. The controller runs the full tka test gate and the production build. Before the commits, the runes proof of Task 3 Step 6 on the new build: from PKG, `grep -c "[$]state(" dist/state/video-editor-state.svelte.js` prints a number above 0.

### Task 21: The plugin-free editor test (sonnet; review opus)

The Ringmaster readiness check for 2B: the package editor mounts with no plugin and no tka import, edits, undoes, saves and reopens. Gate: package gate.

**Files:**
- Create: `PKG/test/browser/video-editor.svelte.test.ts`, `PKG/test/browser/fixtures/VideoEditorHarness.svelte`

- [ ] **Step 1: The harness.** The host has only an owner; its store defaults to `createDeviceStore()` (localStorage, keys scoped by owner), so a second mount with the same owner reopens what the first saved.
  ```svelte
  <script lang="ts">
  	import VideoEditor from "../../../src/ui/VideoEditor.svelte";
  	import type { VideoEditorHost } from "../../../src/host.js";

  	let { ownerId }: { ownerId: string } = $props();
  	const host: VideoEditorHost = { ownerId };
  </script>

  <div style="width: 1200px; height: 800px">
  	<VideoEditor {host} />
  </div>
  ```
- [ ] **Step 2: The test.**
  ```ts
  import { describe, expect, it } from "vitest";
  import { page } from "vitest/browser";
  import { render } from "vitest-browser-svelte";
  import { EN } from "../../src/strings/en.js";
  import VideoEditorHarness from "./fixtures/VideoEditorHarness.svelte";

  describe("VideoEditor with no plugin", () => {
  	it("adds text, edits it, undoes, saves and reopens", async () => {
  		const ownerId = `owner-${Date.now()}`;
  		const first = render(VideoEditorHarness, { ownerId });
  		await page.getByRole("button", { name: EN.post_editor_tool_add }).click();
  		await page.getByRole("button", { name: EN.post_editor_kind_text }).click();
  		await page.getByRole("button", { name: EN.post_editor_tool_text }).click();
  		await page.getByRole("textbox").first().fill("Hello");
  		await expect.element(page.getByText("Hello").first()).toBeVisible();
  		await page.getByRole("button", { name: EN.post_editor_undo }).click();
  		await expect.element(page.getByText("Hello")).not.toBeInTheDocument();
  		await page.getByRole("button", { name: EN.post_editor_redo }).click();
  		await expect.element(page.getByText("Hello").first()).toBeVisible();
  		await page.getByRole("button", { name: EN.post_editor_save }).click();
  		first.unmount();
  		render(VideoEditorHarness, { ownerId });
  		await expect.element(page.getByText("Hello").first()).toBeVisible();
  	});

  	it("shows no plugin entry in the add panel", async () => {
  		render(VideoEditorHarness, { ownerId: `owner-${Date.now()}-b` });
  		await page.getByRole("button", { name: EN.post_editor_tool_add }).click();
  		await expect.element(page.getByRole("button", { name: EN.post_editor_kind_text })).toBeVisible();
  		await expect.element(page.getByRole("button", { name: EN.post_editor_kind_animation })).not.toBeInTheDocument();
  	});

  	it("mounts with no preview cache and shows no library section", async () => {
  		render(VideoEditorHarness, { ownerId: `owner-${Date.now()}-c` });
  		await page.getByRole("button", { name: EN.post_editor_videos }).click();
  		await expect.element(page.getByText(EN.share_studio_choose_device_video)).toBeVisible();
  		await expect.element(page.getByText(EN.share_studio_finding_saved_videos)).not.toBeInTheDocument();
  		await expect.element(page.getByText(EN.share_studio_saved_videos)).not.toBeInTheDocument();
  	});
  });
  ```
  The third case is the plugin-free host's services: the harness host is `{ ownerId }`, with no `previewCache` and no `mediaLibrary`, so the editor runs on Task 4's unsupported cache and the media panel shows its device button but no library section. The `EN` keys are the ones the moved components use for those controls; where a name differs (for example the undo button's key), use the key the component reads, so the test never hard-codes English. `post_editor_kind_animation` stays in `EN` after Task 16 only if a moved file still names it; if it does not, assert on the text `Animation` instead. If the editor opens on an empty state that needs a first video before Add shows, each case first presses the empty state's add-text control (read the workspace's empty branch); never add a fake video.
- [ ] **Step 3: No tka in the closure.** `grep -nE "[$]lib|tka|post-studio-plugin" packages/video-editor/test/browser/video-editor.svelte.test.ts packages/video-editor/test/browser/fixtures/VideoEditorHarness.svelte` from PKGROOT prints nothing; the package gate passes with the new file in the `browser` project.
- [ ] **Step 4: Commit:** `test(video-editor): the editor mounts, edits, undoes, saves and reopens with no plugin or preview cache` with the trailer.

### Task 22: The PostModule switch (opus; review opus)

One tka commit. `PostModule.svelte`, `PostStudioPane.svelte` and the two test routes render `<TkaEditorScope>` around `<VideoEditor>`; `PostStudio.svelte` is deleted. Gates: tka type gate, parity, tka subset, tka component gate, plugin closure gate, trace-script gate, full tka test gate and production build (controller), and Step 6's checks on the build output.

**Files (all tka):**
- Modify: `src/lib/features/post/PostModule.svelte`, `src/lib/shared/sequence-viewer/components/PostStudioPane.svelte`, `src/routes/test/post-share-sheet/+page.svelte`, `src/routes/test/post-studio/+page.svelte`, `PUI/TkaEditorScope.svelte`
- `git mv`: `PS/PostStudio.svelte.test.ts` to `PUI/TkaEditorScope.svelte.test.ts`, `PS/PostStudioTestHarness.svelte` to `PUI/TkaEditorTestHarness.svelte`
- `git rm`: `PS/PostStudio.svelte`

- [ ] **Step 1: The scope takes over `PostStudio`.** Everything `PostStudio.svelte` still does moves into `TkaEditorScope.svelte` in the same order: the effects and visibility contexts, the `ps-slice` URL session, the prop type state, the audio seed, `provideStrings(tkaEditorTranslate)`, the token stylesheet import and the `ve-root` element (now `VideoEditor`'s; the scope's wrapper keeps only the classes `PostStudio`'s root had besides `ve-root`). The scope's props become the union of its own and `PostStudio`'s (`PostStudio`'s prop type is the reference; keep every name).
- [ ] **Step 2: The callers.** Each of the four importers replaces `<PostStudio {...props} />` with
  ```svelte
  <TkaEditorScope {...tkaProps}>
    {#snippet children(scope)}
      <VideoEditor host={scope.editor.host} plugin={scope.plugin} editor={scope.editor} inspectorTarget={scope.inspectorTarget} {...editorProps} />
    {/snippet}
  </TkaEditorScope>
  ```
  where `tkaProps` are the TKA props of design H and `editorProps` the other generic props of design A (`active`, `previewTarget`, `sharing`, `onSaveDraft`, `draftLoadError`, `onExported`, `onSharePost`, `registerExport`, `audioSeed`, `onAudioChange`; `inspectorTarget` comes from the scope's snippet, as in Task 15a Step 2, because the scope's viewer bridge computes it), written out by name (no spread objects in the final code; the snippet above names them only for brevity). `VideoEditor` comes from `@austencloud/video-editor/ui`, `TkaEditorScope` from `$lib/shared/post-studio-plugin/ui/TkaEditorScope.svelte`. `PostModule`'s header context import (`post-editor-header`) already reads `./ui` since Task 18.
- [ ] **Step 3: The test and harness.** `git mv` both; the harness mounts the scope and `VideoEditor` as in Step 2; the test's imports and its `render(PostStudioTestHarness, ...)` calls change to the new names; every assertion stays. Run the tka component gate.
- [ ] **Step 4: Delete.** `git rm src/lib/shared/share/components/post-studio/PostStudio.svelte`. `grep -rnE "PostStudio[.]svelte|PostStudioTestHarness" src tests --include=*.ts --include=*.svelte | grep -v ceremony-manifest` prints nothing. `ls src/lib/shared/share/components/post-studio` lists only `builder/` (and `editor/` only if `builder/` imports remain there; the file map leaves nothing else).
- [ ] **Step 5: Gates.** All listed above; the controller runs the full tka test gate and the production build.
- [ ] **Step 6: Three checks on the build output.** Runes in the package build tka bundled: from PKG, `grep -c "[$]state(" dist/state/video-editor-state.svelte.js` prints a number above 0 (Task 3 Step 6). One package instance: `grep -l "video-editor-ui" .svelte-kit/output/client/_app/immutable/chunks/*.js | wc -l` prints `1` (the editor context's symbol description lives in one chunk; two would mean two copies of `editor-context.ts`). The render-entry weight (`HANDOFF_2B` item 3): client chunk files are named by hash, so find the `PostShareSheet` component chunk by content: pick a string literal only `PostShareSheet.svelte`'s own script holds (a `t(...)` key or a class name; confirm with `grep -rl` over `src` that no other file has it), then `grep -l "<that string>" .svelte-kit/output/client/_app/immutable/chunks/*.js | xargs ls -l`; record that file's bytes next to the step 1 baseline of 83,527 bytes (step 1 Task 14's production build, the same `PostShareSheet` component chunk, open-items file "Production-build baselines") in the report (growth is expected only if the share sheet now pulls editor UI it did not before; more than 10 percent growth is a finding). Duplicate copies (design J): `grep -l "WaveSurfer" .svelte-kit/output/client/_app/immutable/chunks/*.js | wc -l`, reported, not gated. `AudioDownloadStalledError`: the tka test that asserts its `instanceof` (`grep -rln "AudioDownloadStalledError" tests src --include=*.test.ts`) passes in the full run.
- [ ] **Step 7: Commit** (tka):
  ```bash
  git add src/lib/features/post/PostModule.svelte src/lib/shared/sequence-viewer/components/PostStudioPane.svelte src/routes/test/post-share-sheet/+page.svelte src/routes/test/post-studio/+page.svelte src/lib/shared/post-studio-plugin/ui src/lib/shared/share/components/post-studio && git commit -m "feat(post): Post renders the package VideoEditor inside the TKA scope" -m "Package: video-editor@<short hash of the package HEAD>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

### Task 23: Browser proof and the records (controller)

The controller runs this task; it starts 2B's second dev server (Task 1 Step 2a ran the first) and needs Austen for the second half. Gates: none beyond the proof itself.

- [ ] **Step 1: Dev server.** Check the port first (`netstat -ano | findstr :5221` in PowerShell; empty). Start the `.claude/launch.json` entry `tka-video-editor-worktree` (port 5221, run from TKA) with the preview tool, so the controller owns the process; record its PID.
- [ ] **Step 1a: Accessibility snapshot.** Before the proof edits anything (its edits change the saved undo history, which the undo and redo buttons' `disabled` state shows), run `node "$SCRATCH/ax-capture.mjs" http://localhost:5221 "$SCRATCH" ax-after` (Task 1 Step 2a's script, unchanged, with any mask it recorded), then `diff "$SCRATCH/ax-baseline-$m.json" "$SCRATCH/ax-after-$m.json"` for each `m` in `edit crop timing`. Expected: no output: every focusable and labelled control of the edit, crop and timing screens has the role, name, pressed, selected and disabled state it had before 2B, in the same order. Each difference is listed in the report with its mode, the entry before and after, and why it changed; a difference with no reason is a regression, fixed before step 2B closes.
- [ ] **Step 2: The feature route.** Copy `PROOF2A/task15-proof-feature.mjs` to `$SCRATCH/task23-proof-feature.mjs` (the 2A copy stays as it is) and add seven checks after its eleven, each saving a screenshot under `$SCRATCH/task23-proof-branch/`: a tool panel opens (select the feature video's first clip, press the `trim` tool, the trim readouts are visible); the timeline lane renders (the edit timeline shows one block per item and the music lane when music is set); a keyframe is added (open `position`, add a keyframe at the playhead, the key lane shows one more diamond; undo it at the end, as the script undoes its own edits); the music tool opens (select the music lane, the music panel's range readouts are visible); the export sheet opens (press `export`, the export panel is visible; close it without exporting); a clip drags (add a text item as the 2A part does, read the `left` of its block `button.post-timeline-item.kind-text[data-item-id]`, then send `Input.dispatchMouseEvent` `mousePressed` at the block's centre with `button: "left"` and `clickCount: 1`, six `mouseMoved` events 20px apart to the right with `button: "left"` and `buttons: 1`, and `mouseReleased` at the last point: the block's `left` grew by more than 60px and, once saved, the item's `start` on disk grew); Ctrl+Z from the keyboard undoes it (call `focus()` on the first `[data-tool]` button inside the section and check that `document.activeElement.closest("[data-edit-history-shortcut-scope]")` is the section, then send `Input.dispatchKeyEvent` `rawKeyDown` and `keyUp` with `modifiers: 2`, `key: "z"`, `code: "KeyZ"` and `windowsVirtualKeyCode: 90`: the block's `left` is back to its value before the drag and the saved `start` follows; a second Ctrl+Z removes the text item and the disk returns to the starting ids, as the 2A cleanup waits for). Those two checks need CDP's `send`, which `withHeadlessPage` does not pass: copy `PKG/scripts/spike/cdp.mjs` to `$SCRATCH/cdp.mjs`, add `send` to the object it passes its callback (line 120), and import that copy in the proof (the package file stays unchanged); send `Emulation.setFocusEmulationEnabled` with `{ enabled: true }` before the focus check, because a headless page has no window focus. `disk()` also returns `starts`, each item's `start` by id. Run `node "$SCRATCH/task23-proof-feature.mjs" http://localhost:5221 "$SCRATCH/task23-proof-branch" branch` against `/post?feature=generate-vertical`. Expected: all eighteen checks pass and each 2A screenshot matches its 2B counterpart by eye (same controls, same layout; icon glyphs may differ by antialiasing only). Differences are listed with both screenshot paths.
- [ ] **Step 3: The real-sequence route (`HANDOFF_2B` item 21).** Ask Austen to sign in to the worktree dev server's `/post` in the in-app browser (the smallest action: open the URL and sign in). Then: open a saved post, move a clip on the timeline, undo, open the timing mode from the `beats` tool, select an animation item and open its `appearance` panel (a sequence kind's panel). Screenshot each into `$SCRATCH/task23-proof-real/`. If Austen is not available, this half stays open and the report says so; step 2B is not complete without it.
- [ ] **Step 4: Stop the server** (the PID from Step 1 only).
- [ ] **Step 5: Records.** In the open-items file (`docs/superpowers/specs/2026-10-09-video-editor-open-items-after-step-1.md` in PKGROOT), mark closed the `HANDOFF_2B` items this plan closed (each task names them) and add:
  - Item 7: `presetRenderMode` still reads `POST_STUDIO_SOURCES` and `DOM_SURFACE_MODES` still lists tka's modes; step 3 moves both out of the compositor.
  - Item 15: decided; no UI caller uses the bound wrappers, which stay as tka's test API because the frozen parity test imports them.
  - Item 18: the tka-sounding copy list, unchanged in code.
  - Item 19: the two optional tests (history envelope order, feature-video history key), deferred to step 3.
  - Item 20: `hero-act.test.ts:64` and the five tka worker chunks with raw `$state(`, recorded only.
  - Item 22: CI still runs only `pnpm check` (`.github/workflows/ci.yml:32`); step 4 adds `pnpm --filter @austencloud/video-editor test` (with a chromium install for the `browser` project) and `node packages/video-editor/scripts/step1/forbidden-imports.mjs`.
  - Step 3 list: the Ringmaster spike page's import becomes `VideoEditorSpike`; the popover menus (`FilterChip`, `ChipPopoverOption`, `OverflowMenu`) against the no-dropdown rule; `DOM_SURFACE_MODES`; the tka wording sweep.
  
  In the spec (`docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md`), under a new "Step 2B as built" heading: `laneRenderer` replaced by `ui.parts` and `ui.icon`; the looks and presets decision (scope section); `haptics` added to the host; `createSurfaces` replacing `surfaces`; the `./ui`, `./strings` and `./icons` subpaths; the `mediaLibrary` decision. Commit both files in PKGROOT: `docs(video-editor): step 2B as built and the open items it leaves` with the trailer.

---

## Exit criteria

Step 2B is done when every line below holds on the final commits of both worktrees. Commands run from the directory named; `$SCRATCH` as in the gates.

| # | Criterion | Command | Expected |
| --- | --- | --- | --- |
| 1 | Parity green at every task | TKA: `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts` | `Tests 4 passed \| 1 skipped (5)` in every task report, and now |
| 2 | Package builds, checks and tests | PKGROOT: `pnpm --filter @austencloud/video-editor build && pnpm --filter @austencloud/video-editor check && pnpm --filter @austencloud/video-editor test` | `svelte-check found 0 errors and 0 warnings` twice; all node tests and the `unit`, `canvas`, `state` and `browser` projects pass |
| 3 | Plugin-free editor | PKG: `npx vitest run --project browser test/browser/video-editor.svelte.test.ts` | 3 passed (Task 21) |
| 4 | No tka in the package | PKG: `node scripts/step1/forbidden-imports.mjs` and `grep -rnE "[$]lib\|post-studio-plugin" src` | `forbidden imports: 0` and `fa- classes: 0`; the grep prints nothing |
| 5 | Package files import by relative path | PKG: `node scripts/step1/move.mjs --check` | exit 0 |
| 6 | Moved tests pass in the package | PKG: `npx vitest run --project unit` and `npx vitest run --project browser` | every file passes; the task reports' moved-test lists all appear |
| 7 | tka types | TKA: the tka type gate | `new 0` against the Task 1 baseline |
| 8 | tka tests | TKA: `npm run test:ci > "$SCRATCH/test-final.txt" 2>&1; grep -E "Test Files\|Tests \|Errors\|FAIL" "$SCRATCH/test-final.txt"` | green; at most one rerun-once load flake, named (`hero-act.test.ts` is the known one); no `Errors` line |
| 9 | tka production build | TKA: the production build gate | `built in` lines; no error, no rune warning, no warning naming `video-editor` |
| 10 | One package instance | TKA, after 9: `grep -l "video-editor-ui" .svelte-kit/output/client/_app/immutable/chunks/*.js \| wc -l`, and the components run of `PUI/single-svelte.svelte.test.ts` | `1`; the single-Svelte test passes |
| 11 | Plugin closure clean | TKA: `grep -rlE "from [^ ]*[.]svelte" src/lib/shared/post-studio-plugin --include=*.ts \| grep -v "/ui/"` and `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-bound-only.test.ts` | the grep prints nothing; the test passes |
| 12 | Trace script | TKA: `npx tsx --tsconfig scripts/tsconfig.json scripts/post-handoff-trace.ts` | `No saved post for .` |
| 13 | 2A Ringmaster readiness | PKG: `npx vitest run --project state test/video-editor-state.svelte.test.ts` | passes |
| 14 | `PostStudio.svelte` gone, PostModule switched | TKA: `test ! -e src/lib/shared/share/components/post-studio/PostStudio.svelte && grep -c "VideoEditor" src/lib/features/post/PostModule.svelte` | prints a count of at least 1 |
| 15 | Browser proof, feature route | Task 23 Step 2 | eighteen checks pass, the clip drag and the keyboard undo among them; screenshots match `PROOF2A/task15-proof-branch/` |
| 16 | Browser proof, real sequence (item 21) | Task 23 Step 3, with Austen signed in | open, move, undo, timing mode and a sequence panel each screenshotted |
| 17 | ASCII in the package | PKG: `node -e "const fs=require('fs'),p=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);for(const f of walk('src'))fs.readFileSync(f,'utf8').split(String.fromCharCode(10)).forEach((l,i)=>{if([...l].some(c=>c.charCodeAt(0)>127))console.log(f+':'+(i+1))})"` | prints nothing |
| 18 | Records | PKGROOT: `git log -1 --format=%s -- docs/superpowers/specs` | the Task 23 docs commit |
| 19 | Accessibility unchanged | Task 23 Step 1a: `diff "$SCRATCH/ax-baseline-$m.json" "$SCRATCH/ax-after-$m.json"` for `m` in `edit crop timing` | no output, or each difference explained in the report |
| 20 | Runes in the package build | PKG: `grep -c "[$]state(" dist/state/video-editor-state.svelte.js` | a number above 0 (Tasks 3, 20 and 22) |

---

## Risks found while planning

Each risk names where the plan answers it. The top three for the controller are R3, R5 and R6.

| # | Risk | Answer in the plan |
| --- | --- | --- |
| R1 | **tka context read in generic files.** The workspace, canvas, item tool, timeline and media layer read `sequence`, the timing session, the wrapper's tunnel members and tka singletons (toast, keyboard manager, escape layers, viewer surfaces) in hundreds of places; one missed read moves tka into the package and fails `forbidden-imports` late. | The splits run in tka first (Tasks 12 to 15b), each with a verbatim check and a grep for TKA paths; Task 20 Step 1 greps the five remainders once more before they move; `forbidden-imports` runs at every package gate. |
| R2 | **TKA-only `PostStudio` and workspace props.** Eleven workspace props and `PostStudio`'s prop type are TKA data. Left on `VideoEditorProps` they would make the package's public props tka's. | Design A lists them; design H puts them on `TkaEditorScope` and `TkaEditorContext`; Task 15b Step 8 removes them from the workspace; Task 22 passes them only to the scope. |
| R3 | **CSS that depends on tka globals.** The moved UI reads `--theme-*` and other tka tokens (about 450 uses), Font Awesome's CSS for `<i>` sizing, and tka's global button and focus styles. Kit components portal to `document.body`, outside any editor root, so tokens scoped to the root would not reach them. | Task 17 renames the families to `--ve-*` with fallbacks and maps them on `.ve-root, .ve-portal` (design I), so they inherit tka's values where the editor sits and portals carry `.ve-portal`; icon rules become `:global(.ve-icon)` (R4); Task 23 compares screenshots with 2A. Global element styles tka sets on `button` and `:focus-visible` still apply in tka; Ringmaster will see the fallbacks, which step 3 reviews. |
| R4 | **Icon sizing.** Font Awesome 7's CSS gives `<i>` a fixed 1.25em width; a rule that selected `i` or `.fa-solid` stops matching the SVG. | `Icon.svelte` reproduces the box (design E: 1.25em by 1em, `vertical-align: -0.125em`); Task 17 Step 1 rewrites selectors to `:global(.ve-icon)`; Task 8's browser test pins the box. |
| R5 | **Duplicate Svelte or a second package copy.** tka reads `dist` through an alias outside `node_modules`; a second `svelte` breaks contexts across the boundary, and a second copy of `editor-context.ts` (one through `./ui`, one through the root) splits the context symbol. | 2A's `resolve.dedupe` and `optimizeDeps.exclude` stay; Task 3's single-Svelte component test; every subpath re-exports from the same files (no copy of a module per entry); exit criterion 10 counts the context symbol's chunks in the build. |
| R6 | **The browser test provider in a fresh workspace.** shared-packages has no `@vitest/browser`, playwright or chromium in its store, and vitest 4.1 with the 4.0 browser packages mismatch. | Task 5 sets `@vitest/browser` and `@vitest/browser-playwright` to 4.1.11, the vitest the lockfile already resolves, with `vitest-browser-svelte` 2.1.1 and `playwright` 1.61.1 (chromium build 1228, already on this machine); the fallback is all three vitest packages at 4.0.18 (tka's set); the controller runs every install. The browser project never attaches to Austen's browsers. |
| R7 | **Kit behaviour dropped.** The Drawer copy loses `holdBackgroundFor` and tka's layout manager; dialogs lose bits-ui's focus handling. | `matchMedia` on the same breakpoint; focus trap from the copied `drawer/focus-trap.ts`; Task 10's Popover and ConfirmDialog tests; `holdBackgroundFor` only dims tka's background shell, which the editor does not own (recorded for step 3). |
| R8 | **Escape handled twice.** tka's escape layer manager and the package's default `shortcuts` listener could both close a layer. | tka passes its own `shortcuts` (Task 4), so the default listener is never added in tka; the default is used only by plugin-free hosts and the browser tests. |
| R9 | **The Ringmaster spike page breaks on the rename.** It imports `VideoEditor` from the package root, which becomes the real editor. | Not touched in 2B (non-goal); Task 23 records the one-word rename for step 3; nothing in 2B type-checks that page. |
| R10 | **New dependencies resolved through the alias.** `@fortawesome/free-solid-svg-icons` is not in tka's `node_modules`; `wavesurfer.js` and `realtime-bpm-analyzer` are, but the package's imports of all three resolve from `PKG/node_modules`. | They resolve from the `dist` file's location (design J); Task 8's `dist` check and the tka tests that import `./icons` from Task 12 on confirm they resolve; if Vite's `server.fs.allow` blocks the store path in dev, Task 23 adds the PKG `node_modules` path to it in tka's `vite.config.ts` under its own commit and records it. |
| R11 | **Scoped CSS lost in a split.** Svelte scopes styles per component; markup moved to a `PUI` component loses the rules its classes had. | Tasks 13 to 15b copy every rule the moved markup needs; the verbatim check (Task 13 Step 6) and Task 23's screenshots catch a missed rule. |
| R12 | **`laneRenderer` dropped from the contract.** The spec names it. | Design B explains the replacement by `parts` and `icon`; Task 23 records it in the spec. |
| R13 | **The live take catalog.** The library list must update when a video is uploaded elsewhere; an async `listTakes()` alone would not. | `MediaLibrary.onChange` (design C, Task 4); tka's adapter (`PUI/tka-media-library.svelte.ts`, Task 4) fires it from the per-sequence store through an effect root, and the workspace reloads on it (Task 15a Step 4a). |
| R14 | **Parity does not cover the UI.** It hashes the data path only. | Component tests (Tasks 3, 5, 8, 10, 19, 21), tka's component gate, the verbatim checks, Task 23's two-route browser proof, and the accessibility snapshots of edit, crop and timing taken before (Task 1 Step 2a) and after (Task 23 Step 1a), which must match. |
| R15 | **Undo keys through the DOM.** tka's undo shortcuts press hidden buttons that `EditHistoryShortcutBridge` renders; a package component cannot render tka's bridge. | tka's keyboard manager presses only targets inside the focused `[data-edit-history-shortcut-scope]` (`shortcut-target-resolution.ts:200-242`), so the bridge must sit in the editor's section. `editHistory(handlers, scope)` takes an element the package renders there (`EditHistoryKeys.svelte`'s anchor, Task 15b Step 7); tka's `editHistory` mounts its bridge into `scope` with getter props and unmounts it on the returned stop (Task 4); the package default listens on the window and acts only while focus is in that section or on nothing (Task 4's tests). Task 23 Step 2 presses Ctrl+Z with focus on an editor control and checks the edit is undone. |
| R16 | **The wrapper's `selectPart` shim.** Between Tasks 9 and 15a the wrapper answers `selectPart` by routing `"tunnel"` to the timing state, so two part selections exist for a while. | Task 15a Step 1 makes the wrapper forward `mode` and `selectedPart` to the package state and removes the shim's special case. |
| R17 | **Item 15 cannot close as written.** The bound `evaluatePresetFrame` and `evaluatePresetLayers` have no `src` caller, but the frozen parity test and 12 other tka tests import them. | Task 20 Step 7 keeps them as tka's test API and Task 23 records the decision. |
| R18 | **Row and add order drift.** Splitting `toolRow` and the add panel can reorder tka's rows silently. | Task 12 pins every row and the add order with literals taken from today's code before the split. |
