# Video editor extraction: open items after step 1

Date: 2026-10-09. Status: the single list of what steps 2, 3 and 4 still owe.
Parent spec: `2026-10-07-video-editor-extraction-design.md`.

Step 2A update (2026-10-09): a struck title below was closed in step 2A, with the
task and commit that closed it. A bullet marked "partly closed" names what is
left. The 2A record and its gate numbers are in the parent spec under "Step 2A
as built"; what 2A left over is under "Carried out of step 2A" in the Step 2
section.

This file condenses the step 1 per-task reviews, the whole-step review and the
notes carried between tasks. They lived in a session scratchpad under a Temp
folder, which can be cleaned, so this file is now the record. It describes the
package at `fc60de3` (branch `video-editor`) and tka-platform at `7b1deab32c`
(branch `codex/video-editor`), both before tka main is merged into that branch.
Package paths are relative to `packages/video-editor`. Paths that start with
`tka:` are relative to the tka worktree root. Line numbers come from those two
commits and drift, so find each passage by its text. Each bullet names the
place, then the proposed fix.

## Standing

Applies at the start of steps 2, 3 and 4 and in every task after.

- **Sync tka main into the branch first.** Make "merge tka main into
  `codex/video-editor`" the first step of steps 2, 3 and 4. At the step 1 review
  main was 351 commits ahead of the merge base and edits files this branch split
  into the package or the plugin: `post-project.ts`, `post-project-edits.ts`,
  `take-timing.ts`, the ops modules, `post-editor-state`, `PostEditorWorkspace`,
  `PostEditorCanvas`, `PostItemTool`, `PostStudioMediaLayer`,
  `PostStudioChoreoLayer` and `docs/development/post-studio-manifest-bridge.md`.
  A textual merge cannot resolve an edit to lines that now live in the package,
  so each one is ported by hand. The first case is done: main commit
  `ad6afcaf73` (2026-10-08) added the card field `qrUrl` with
  `POST_MAX_QR_URL_LENGTH`, `POST_QR_URL_RULE` and `isPostCardQrUrl`, and the
  merge `10ca855e29` (2026-10-09, main at `533b9d1355`) ported it into tka's
  plugin: `tka:src/lib/shared/post-studio-plugin/card-qr.ts` holds the three
  names, `item-kinds.ts` adds `qrUrl` to `tkaCardShape` with the card order
  `kind`, `qrUrl`, `cardAppearance`, and `post-card-qr-url.test.ts` parses a
  card through the bound `PostProjectSchema`. The package's item and project
  schemas are `.strict()` (`src/core/project/schema-factory.ts:53`, `:74`,
  `:88`), so any later main edit to a moved schema needs the same treatment.
  Step 2 moves `PostItemTool` and the workspace, so the conflict grows every
  day main keeps editing them. After a sync, rerun the gates below, and run
  tka's `check:docs` if main has it. 2A applied it twice: Task 1 found main
  `533b9d1355` already merged, and Task 15 merged the local `main` ref
  (`6de9ce8fc6`) with `git merge --no-ff main` as `32f1ee5675`, no conflicts, no
  rebase. tka has no `check:docs` script.
- ~~**Guard the core per-kind schemas in tka.**~~ Closed in 2A Task 2 (tka `e073fbae7a`). The core exports strict
  `PostCardItemSchema` and `PostVideoItemSchema` with no TKA fields. No tka
  file imports them today, but a main sync can bring one in and the rewriter
  maps it to the strict core name, so tka's `qrUrl`, `cardAppearance` and
  `staffEffect` then fail at run time while type-checking cleanly. List both
  names as forbidden in tka in `tests/unit/video-editor-bound-only.test.ts`;
  if tka needs a per-kind schema, export one from `bound.ts`, taken from the
  bound union. (Step 1 re-review, 2026-10-09.)
- ~~**Fix the type-gate tooling before relying on it again.**~~ Closed in 2A Task 1 (package `b53eee8`): the normalizer cuts each path at its
  last `node_modules/` and sorts union members and object properties, and the
  baseline is taken at the synced tip, one environment for both runs. After the main
  merge, `scripts/step1/check-intersection.mjs` printed `new 9` against a
  baseline taken in the primary checkout: eight keys differ only by the
  worktree junction prefix `../../../tka-platform/` on pnpm-store paths, and
  one (`Viewer3DScene.svelte:961:23`) is the same error with a union member
  printed in another order. Normalize each path up to its last `node_modules/`
  before comparing (lines 19-20), compare error text with union members sorted,
  and take baselines from a clean main worktree so both runs share one
  environment (the primary's 951 errors against the branch's 625 cluster where
  generated SvelteKit types are stale, not in branch code).
- **Gates to rerun after a sync and in any task that touches the plugin
  folder.** Expected results at the two commits above:
  - Parity,
    `npx vitest run --config tests/config/vitest.config.ts tests/unit/video-editor-parity.test.ts`
    from the tka worktree: `Tests 4 passed | 1 skipped (5)`.
  - `tka:tests/unit/video-editor-bound-only.test.ts`: 5 passed. A new bound name
    goes in its `BOUND_ONLY` record, per entry.
  - `tka:tests/unit/video-editor-value-closure.test.ts`: 4 passed.
    `tka:tests/unit/video-editor-copies.test.ts`: 6 passed.
    `tka:src/lib/shared/post-studio-plugin/plugin.test.ts`: 4 passed.
  - The tka type gate (`check:fast`): baseline 622, after 622, new 0. Main's own
    count differs; judge the branch by intersecting error files with its own
    diff.
  - `npx tsx --tsconfig scripts/tsconfig.json scripts/post-handoff-trace.ts`
    must load (the usage line or `No saved post for`, never
    `ERR_MODULE_NOT_FOUND`). A real read-only run passes `--sequence` with a
    saved sequence name and no `--out`.
  - Package: 23 vitest files with 176 tests, 34 node tests, `svelte-check` 0
    errors and 0 warnings, `node scripts/step1/forbidden-imports.mjs` all zero,
    `node scripts/step1/move.mjs --check` exit 0.
  - tka `test:ci`: one failure, `scene-effects-batching-contract`, which is in
    the baseline. Under load these also time out at 30 s and pass alone:
    `print-qr-guard`, `serialized-card-front-scan`, `relaxed-contact-grip`
    (baseline loop, saved transition) and `shape-matrix-three-four-parity`.
    Rerun once, keep both outputs, then run the timed-out files alone.
  - At the end of step 2A (tka `32f1ee5675`, package `dfc3b8f`): parity `Tests 4
    passed | 1 skipped (5)`; tka type gate baseline 625, after 625, new 0; package
    37 vitest files with 268 tests, 38 node tests and `svelte-check` 0 errors and
    0 warnings for both tsconfigs; the trace script prints `No saved post for .`.
    `test:ci` passed on its second run (2597 files, 22861 tests); the first run
    failed two `src/lib/shared/landing/data/__tests__/hero-act.test.ts` cases
    ("shape-matrix source") that pass alone, so that file joins the list of files
    that time out under load. The tka test subset is
    `tests/unit/media-composition` plus `tests/unit/post-studio-media-csp.test.ts`
    (`tests/unit/post-studio` does not exist).
- **The parity baseline is frozen.** Never set `PARITY_WRITE`; no agent or CI
  run regenerates it. The gate compares 12 committed draw logs
  (`tka:tests/fixtures/video-editor-parity/draw-logs/`) and the hashes in
  `before.json`, and writes diagnostics to
  `os.tmpdir()/claude/video-editor-step1` (`PARITY_LOG_DIR` overrides). The
  capture lifecycle is part of the hash: one `PostStudioPictographCapture` per
  rendered frame, with `createContext`, `domToCanvas` and `destroyContext` in
  that order. A task that moves capture ownership (surfaces, the pictograph
  capture, DOM capture options) must keep the same calls in the same order for
  the same frame, or the gate fails for a lifecycle reason. The log also records
  `getContext("2d",{alpha:false})`, the DOM capture options with sorted keys and
  every painter call, with numbers rounded to 6 decimals. Read the comments in
  the parity test and its `harness.ts` before touching the compositor's capture
  path.
- **Run order and environment.** Rebuild the package
  (`pnpm --filter @austencloud/video-editor build` from the package worktree
  root) before any tka gate, or tka tests the previous `dist`. Confirm the
  shared `node_modules` still has jsdom 27.4.0 and vitest 4.0.18 before a tka
  gate; the tka worktree's `node_modules` is a junction into the primary
  checkout. The package runs vitest 4.1.11 and the moved tests pass under both.
- **zod stays one instance in tka.** tka dedupes zod (4.3.6) in `vite.config.ts`
  and both vitest configs; do not remove it. Package code must not use zod APIs
  newer than 4.3.6 (for example `validate`, `validateAsync`, `withParser`),
  because tka runs the package on 4.3.6. If the tka type gate shows NEW errors
  naming zod types from two paths (unique-symbol brands, "two different types
  with this name"), pin `zod` and `zod/*` to tka's own `./node_modules/zod`
  under `kit.typescript.config` in `tka:svelte.config.js`, next to the svelte
  subpath pins; step 4 removes it with the others.
- **Seam rules for moved code.**
  - Core code never names a tka kind or field (`"animation"`, `tunnelHook`,
    `timings`); reach tka behaviour through `ItemKindDefinition` members
    (`transitionVisual`, `placement`, `ownsIntroKeys`, `compile`) or plugin
    hooks. Under the package's own type-check `PluginItemKinds` is empty, so
    after the core `case` labels an item narrows to `never`: read
    `const kind: string = item.kind` before comparing, or cast through
    `unknown`, as `normalize.ts` and `keyframes.ts` do.
  - Nothing that `bound.ts` or `surfaces.ts` reaches by value may import the
    plugin index `$lib/shared/post-studio-plugin`, or create-plugin to
    normalize-hooks to index to bound forms a load-time cycle. Type-only imports
    are erased and fine. A new value import in that closure targets `item-kinds`
    or `project-extension` directly. Never import `index.ts` from inside the
    plugin folder, and never re-export a core name from the plugin folder unless
    it is a bound wrapper (the rewriter routes a name to the first route that
    exports it).
  - Keep the `declare module "@austencloud/video-editor/core"` augmentation and
    the empty `Plugin*` interfaces in tka's `item-kinds.ts`; the fallback in
    `core/index.ts` is not in force.
  - Any new core item or project field throws `shape order mismatch` at tka load
    unless tka's `order` arrays (`project-extension.ts` and the kind extensions
    in `item-kinds.ts`) change in the same task. A move task that adds no schema
    field must not see that throw.
  - A package file imports a name by relative path from its defining file, never
    through `core/index.ts` or `render/index.ts` (`move.mjs --check` fails on a
    barrel import). `TakeSample`, `SequencePhase`, `SequenceFrame`,
    `TAKE_MIN_BPM` and `TAKE_MAX_BPM` come from `src/core/sequence-types.ts`.
  - Keep `compileSequenceItem` and `compileTitlesItem` as `export function`
    declarations; `item-kinds.ts` reads them at load time and a declaration
    survives a future cycle where a `const` would not.
  - The plain-project fixture under `test/fixtures/` backs three package tests
    (`plain-project`, `frame-evaluator`, `painter-registry`). A core schema
    change that adds a required plain field or renames one must update it.
- **Type gate and test conventions.** The tka type gate covers `src` only
  (`tsconfig` includes `src/**`; `tests/` and `scripts/` are never
  type-checked), so a claim that the gate proves X needs a `src` caller for X.
  Tests under `src` (`alignment.test.ts`, `plugin.test.ts`) are inside the gate,
  and a partial-object fixture cast needs `as unknown as SequenceData` or it
  fails with TS2352. `check-intersection.mjs` keys errors by path, message and
  TS code with line and column stripped and pnpm hashes normalized, so an error
  that moves to a new path counts as NEW: confirm it is the same error under the
  old path in the baseline and record it.
- **Prettier.** Run `prettier --check` on the files first and `--write` only the
  files that were clean before, plus new files; name the rest in the report.
  `post-project-compiler.test.ts` and three others (Task 5), 22 more files (Task
  6), `post-picture-pan-drag.ts`, the spec and the step plans are never-clean at
  HEAD and are edited by hand. In tka, greps for moved paths exclude
  `scripts/ceremony-manifest.json`, a generated inventory (410 of its 1450 paths
  were already dangling); leave it alone.
- **Commit trailer.** Every commit of the extension ends with
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, even when a
  harness reminder names another model, so the branch carries one attribution.
  Implementers sometimes follow the reminder; the controller amends and
  re-points the tka `Package:` line.
- **Step 1 tooling, valid until step 4 deletes `scripts/step1/`.**
  - `move.mjs --task N` skips an existing target (prints SKIP) unless `--force`.
    `--dry` prints the copy list, every rewritten specifier and every UNRESOLVED
    line without writing; run it first and read it. A name declared only in
    `core/index.ts`, or routed to the plugin, prints UNRESOLVED and needs a hand
    edit.
  - `rewrite-imports.mjs --task N --dry` computes every edit before writing and
    prints ERROR lines for hand edits (`vi.mock` paths, `typeof import()` of a
    split module, a tka file still using a worker module that moves); an ERROR
    means exit 1. A dry run on the tip before the move lists one ERROR per
    importer, and the real run's `would change` list matched it exactly for Task 9. A merge or type-only normalization shows as `would change` too: read the
    real diff for import lines only, and move any `// @ts-expect-error` or
    `eslint-disable-next-line` that the merge stranded above a package import.
    The `would change 0 files` rerun counts only after prettier.
    `scripts/post-handoff-trace.ts` draws an ERROR in every task that moves one
    of its imports; prove resolution with the `tsx` run above.
  - `check-intersection.mjs` exits 2 when either file lacks the
    `Found N error(s)` summary, when the count disagrees, or when the after
    file's `Failed to convert N files` count is higher than the baseline's 6;
    exit 1 means NEW keys. Compare the svelte2tsx "Error converting" count by
    hand.
  - `forbidden-imports.mjs` also fails when a tka specifier
    `@austencloud/video-editor/<x>` is not a key of the package exports map.
  - `ascii.mjs` iterates UTF-16 code units, so an emoji in a comment maps as
    both surrogate halves (it prints them, for example U+d83d and U+dd25), each
    to an empty string. A file with a rejected character is left unchanged and
    the script exits 1. It turns a spaced em dash into one hyphen.
  - The node test helper in `test/step1-tools.test.mjs` takes a `task` option
    (default 4). Package vitest has `globals: true`; node tests live in
    `test/*.test.mjs` and vitest tests in `test/**/*.test.ts`.
  - The Bash tool halves doubled backslashes in heredocs; write any file with
    regex escapes (`String.raw`, `\s`) with the Write tool.
  - The census output folder
    `C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/census/` holds
    a `node_modules` junction into the tka worktree. Never delete it
    recursively; remove the junction with a non-recursive `rmdir` first.
  - Optional tidy-ups if the tools are used again: a fail-safe in the rewrite
    CLI tests asserting every `would change` path starts with the `STEP1_TKA`
    fixture root; one test that does a rewrite and a merge in the same block
    (ideally a `.svelte` instance block after a module block); an `ascii` case
    for a dash at a line start or end; `slash(...)` on the `STEP1_TKA` value in
    `lib.mjs`; the `rewrite-imports` header should say a moving file is one that
    moves "in this task or earlier"; extend the same-specifier merge to every
    route destination in `moves.json` (`post-music.test.ts` keeps two
    `$lib/shared/post-studio-plugin` declarations, which is harmless);
    `moves.json` gives the preview worker's `entry` as
    `@austencloud/video-editor/render` although the worker is deliberately not
    exported, so add a comment if the tooling is tidied.

## Step 2 (editor UI moves)

2A status (2026-10-09): the bullets struck below are closed. Still open and
deferred to 2B by the 2A plan: the `surfaces` factory, the memoized text painter
(2A only pinned the registry's null-factory and first-wins cases, Task 14), the
per-update `muted` assignment, one module instance of the package, the frame
recovery type exports and stale request, the weight of the render entry in
`PostShareSheet`, the vitest browser project and component tests, and the
`alignment` equivalence case with the bound evaluate wrappers.

### Plugin members to settle before wiring

The spec's "Step 1 as built" says `alignment`, `painters` and `surfaces` are
typed but unread. Settle each before anything wires it.

- ~~**`alignment` provider design.**~~ Closed in 2A Task 11 with option (b): the plugin member is gone (package
  `5c609b2`) and tka builds its alignment in a `$derived` inside
  `post-timing-state.svelte.ts` (tka `5426dd3728`). Still open for 2B: the
  equivalence case in `alignment.test.ts` and the bound wrappers, below. `src/plugin.ts` declares
  `alignment?: AlignmentProvider` and `createTkaPlugin()` does not wire it;
  tka's `createTkaAlignment(getSequence, getTimings)` is in
  `tka:src/lib/shared/post-studio-plugin/alignment.ts`.
  `AlignmentProvider.create(project)` cannot carry tka's inputs as a member of a
  module-singleton plugin, because take timings are editor state. Choose between
  (a) `create(project, input)` with an augmentable `PluginAlignmentInput` and
  (b) dropping `alignment` from the plugin so the host's editor deps supply
  `alignmentFor(project)`. Either way, build the alignment in a `$derived` keyed
  on its inputs, never per frame.
  - tka `media-composition-state.svelte.ts` (324-337) builds a second, different
    alignment (`timeMap`, `startPlacementDuration`, `mediaTimeOffsetSeconds`, no
    clocks). It is dead at run time (re-review, 2026-10-09): every production
    import is type-only (`CompositionSourceBinding`, `MediaCompositionState`),
    `setMediaCompositionContext` has no caller, so `PostStudioMediaLayer.svelte`
    line 121 always gets null, and `createMediaCompositionState` runs only in
    its own test. The alignment design need not cover it. Step 2 task: move
    `CompositionSourceBinding` to where its readers live, then delete the state
    file, its context file, the null branch in `PostStudioMediaLayer` and its
    test. Closed in 2A Task 4 (package `f2699a6`, tka `f00a174c8a`); the slots
    and breakdown modules only it used went too.
  - Before wiring, add an equivalence case to `alignment.test.ts`: the bound
    wrapper with the editor's literal against the package evaluator with the
    provider, deep-equal layers at a few timestamps.
  - The bound `evaluatePresetLayers` and `evaluatePresetFrame` wrappers and the
    `render` entry of `BOUND_ONLY` stay until both callers build a
    `FrameAlignment` themselves. The "today's" comments in tka `alignment.ts`
    (33, 117, 120) and `bound.ts` (58) go stale then, and `bound.ts`'s
    `evaluatePresetLayers` wants a doc comment.
  - `tkaFrameAlignment(input)` copies optional fields by identity, so its result
    carries `undefined` for absent keys. That is harmless while tka compiles
    with `exactOptionalPropertyTypes: false` and the evaluator only reads them.
- **`surfaces` factory.** `src/plugin.ts:87` declares `surfaces?` as a static
  array on a module-singleton plugin, and nothing reads it. Surfaces hold
  per-export state and the exporter releases them, so wiring it as written would
  share one `PostStudioPictographCapture` across exports and between a preview
  and an export, and two concurrent renders would dispose each other's context.
  Before anything wires it, replace the member with
  `createSurfaces?(): readonly SurfaceCapture[]`, or drop it and let the host
  pass `createTkaSurfaces()` per export as the workspace does now.
  - tka `post-studio-dom-capture.ts` and `post-studio-pictograph-capture.ts` are
    live (tka `surfaces.ts` imports both); never delete them as dead modules.
  - Whatever moves capture ownership must keep the parity lifecycle (see
    Standing).
- **Memoized text painter (font flash).** `textPainterFactory`
  (`src/render/painter-registry.ts:48`) builds a fresh `TextItemPainter` per
  `paintersFor` call, and that painter's `fontReady` starts false, so every
  compile would flash the fallback font in the preview. The workspace today
  keeps one text painter per item id reading the live compile. Before the
  workspace moves onto the registry, add a memoizing
  `createTextPainterFactory()` keyed per item id that reads a live env, or give
  the factory a live getter as tka's `createTkaPainters` does with `latest`.
  Ringmaster only exports, so it is unaffected.
  - tka's memoized titles and staff painters read `latest` through a plain
    closure with no Svelte dependency tracking: call `paintersFor` inside a
    `$derived`, or give the deps reactive getters. The async overlay painter
    resolves itself once `paintersFor` runs in a `$derived` that reads the
    `$state.raw overlayPainter`; otherwise the overlay role stays unpainted
    until the next compile.
  - `plugin.test.ts` has no positive-path case for the tka factories (the DCK
    fixture has only text roles). Add synthetic carousel, strip, titles and
    staff roles, and assert non-null painters, the same instances across two
    `paintersFor` calls, and a new carousel or strip painter for a new sequence
    object.
  - `src/render/painter-registry.ts:33` asks again, for every repeated clip,
    about a role no factory answers, which is undocumented either way; pin it
    with a null-factory case. A duplicate role resolves first-wins and has no
    test.
- **A painted mode with no painter vanishes silently.** Partly closed in 2A Task 14 (package `dfc3b8f`): a
  painted layer with no painter now throws, and the DOM-surface branch restores
  in a `finally`. Still open: `drawPaintedLayer` and the `sourceGeometry` branch
  restore outside a `finally` (see "Carried out of step 2A"). The registry's
  null-factory and first-wins cases below were closed in the same task. In
  `src/render/frame-compositor.ts` (the layer drawing path, around 535-587), a
  painted render mode with no matching painter falls into the media branch and
  draws nothing. Treat a missing painter like a missing surface and throw,
  naming the layer and the mode. The same function leaves the context without
  `restore()` when a surface throws (it predates the move; the original branches
  did the same): restore in a `finally`.

### Moved callers and the preview cache

- ~~**Every moved caller of `normalizeProject` must take and pass `plugin`.**~~ Closed in 2A Task 6 (package `4715df2`): `EditContext` carries the
  plugin, both normalize calls in `finish` pass it, and `assertPluginFor` throws
  when a project with plugin data meets a context without one.
  Callers that move into the package (`post-project-edits.ts` and the other edit
  modules) that omit it make tka silently lose its hook migrations and motion
  keys on that path. The bound-only test guards only tka `src` imports, not
  calls made inside the package. Add a package test that fails when a moved edit
  path drops the plugin, or route those callers through a plugin-carrying
  context.
- **One app-wide `IPreviewVideoCache`.** Partly closed in 2A Task 12 (package `f0d959a`, tka
  `bca6c8474b`): `createVideoPreviews` takes the cache as a required parameter, the
  host contract carries `previewCache`, and tka's workspace passes
  `getPreviewVideoCache()`. The UI that moves in 2B must take the cache from the
  host as well. The editor UI that moves reads the
  cache through tka's `getPreviewVideoCache()` singleton (via
  `tka:src/lib/shared/media-composition/state/post-video-previews.svelte.ts`).
  The host contract must supply an `IPreviewVideoCache`, or the UI takes one as
  a dependency, never tka's singleton. The instance owns the one-encode queue
  and the active-bytes budget, so two instances double the budget and run
  encodes in parallel.
- **Keep the per-update `muted` assignment.** Frame recovery mutes the video
  (`src/render/preview-frame-recovery.ts:207`) and never unmutes it; tka's
  `PostStudioMediaLayer.svelte` (633) re-applies the assignment on every update.
  Keep that when the media layer moves.
- **Keep one module instance of the package.** tka catches
  `AudioDownloadStalledError` with `instanceof`, so the host dedupe must hold
  when the UI moves.
- **Export the frame recovery types.** `PreviewFrameRecoveryOptions` and
  `PreviewFrameState` (`src/render/preview-frame-recovery.ts:1`, `:7`) and
  `PreviewSeekState` (`src/render/video-preview-seek.ts:1`) are not exported;
  export them when the media layer moves and needs them.
- **Frame recovery stale request.** In `src/render/preview-frame-recovery.ts`
  (`requestFrame`, about 104-115), a frame callback that fires while
  `isCurrent()` is false leaves its request id set, so `update()` can skip
  restarting playback capture. It is unlikely; review it together with the seek
  listener handling, which lives in tka's media layer.
- **Weight of the render entry in `PostShareSheet`.** tka
  `PostShareSheet.svelte` imports `hasDecodableAudioTrack` from the whole render
  entry, which pulls dexie and the compositor into that component's graph. Task
  14 measured its chunk at 83,527 bytes, with `sideEffects` keeping the package
  store out and Dexie arriving only through a shared chunk. Step 2 may want a
  lighter entry or a tree-shake check.

### Workers and exporter

- ~~**Split zod out of the preview worker.**~~ Closed in 2A Task 5 (package `d91b6d8`). `src/core/preview-video.ts` defines
  `EditCopyManifestSchema` beside the preview constants the worker imports, so
  zod lands in the preview worker chunk (540,267 bytes in the Task 14 build; the
  36,226-byte second chunk of the 2026-10-07 build is gone, origin
  undetermined). Move the manifest schema into its own module so the worker
  stops bundling zod, then recheck the chunk.
- ~~**The worker's uncaught rejection on a failed source.**~~ Closed in 2A Task 5 (package `d91b6d8`): the worker keeps a
  `WeakSet` of replied errors, because mediabunny's stray rejection carries the
  same Error object the caught path already answered. On a bad source the
  preview worker posts its error reply, yet the worker proof console still shows
  `Uncaught (in promise) Error: Error fetching ...`. Something in the
  failed-source path (mediabunny's `UrlSource` prefetch, or `input.dispose()` in
  the `finally` of `src/workers/preview-video.worker.ts`) rejects outside the
  awaited chain. Find it, so the host's `worker.onerror` does not fire a second
  failure for one bad source.
- ~~**Exporter `finally` order.**~~ Closed in 2A Task 14 (package `dfc3b8f`). `src/render/post-exporter.ts:157-160` releases
  surfaces before `videoFrames.dispose()`, so a throwing `release` masks the
  real error and skips dispose. Dispose first, or wrap each release. It matters
  once surfaces carry per-export state.
- ~~**Exporter setup runs before `try`.**~~ Closed in 2A Task 14 (package `dfc3b8f`). In `src/render/post-exporter.ts` the
  RangeError guard (61-63) and the constructors (71-77) run before `try`, so
  surfaces are not released on those paths. Move them inside the `try` or
  release in the guard.

### Package tests and checks

- ~~**Type-check `test/`.**~~ Closed in 2A Task 3 (package `89e06d8`): `tsconfig.test.json`, in `check`. `tsconfig.json` includes `src` only, so nothing
  type-checks `test/`. `tsc --noEmit` over `test/*.ts` with the package tsconfig
  gives 8 errors, all in moved files: `post-backdrop-painter.test.ts` 47,
  `post-studio-export-video-frames.test.ts` 34 (`findLastIndex` is ES2023 and
  the package lib is ES2022), `post-video-color-grade.test.ts` 39, 50, 69 and 80
  (a readonly `Rgb` into a mutable tuple) and `text-item-painter.test.ts` 348.
  Add a `tsconfig.test.json`, add it to the `check` script and fix the 8.
- **Vitest `projects`.** Partly closed in 2A Task 3 (package `89e06d8`): the `unit` (jsdom),
  `canvas` and `state` (svelte plugin) projects exist. The browser project and
  component tests wait for 2B. Add a jsdom unit project that honors the node docblock
  in `test/render-entry-node.test.ts` (that test must never run in a browser
  project) and a browser-mode project with a setup file that supplies a canvas
  2d mock and a `Blob.prototype.arrayBuffer` polyfill (tka's
  `tests/setup/vitest-setup.ts` lines 92 and 139-148 supply both today). The
  browser project needs `@vitest/browser` at the package's vitest version
  (4.1.11). Component tests go there, as the spec's Testing section says. Once a
  second project exists, add one line of `test/` conventions: flat,
  `<src module>.test.ts`, and `fixtures/` holds only plugin-free, hash-free
  project JSON.
- ~~**Move the five NEEDS_TKA_SETUP tests in.**~~ Closed in 2A Task 3 (package `89e06d8`, tka `02e97b1e22`). `scripts/step1/portable-tests.mjs`
  keeps the list: `CanvasFrameCapturer` and `preview-video-frame-recovery`
  (canvas `getContext("2d")`), and `background-encoder-timeout`,
  `post-audio-plan` and `post-audio-track` (`Blob.prototype.arrayBuffer`). When
  they move, drop their `NEEDS_TKA_SETUP` entries, rerun the script (expect
  `movers: 0`) and shrink tka's export smoke, since two of its five files
  (`background-encoder-timeout`, `CanvasFrameCapturer`) are send-backs. The
  script also lists 74 near-misses, tests that import the package but not
  portably; review them as the UI moves.
- ~~**Package compositor and exporter tests with no plugin.**~~ Closed in 2A Task 14 (package `dfc3b8f`). None exists;
  `test/plain-project.test.ts` stops at evaluate. Add: media plus text drawn; a
  DOM mode throwing with the layer name; a painted mode with no painter throwing
  instead of vanishing; surfaces released on success, on a throw and on cancel;
  and a registry first-wins case for a duplicate role.
- ~~**Test housekeeping.**~~ Closed in 2A Task 3 (package `89e06d8`). `globals: true` can go (no test relies on it). Drop the
  redundant `@vitest-environment jsdom` docblocks in
  `test/post-studio-export-video-frames.test.ts` and
  `test/video-export-codec.test.ts`; the second one's describe titles say
  "video-export worker" although the functions live in `src/encoder/codec.ts`
  (pre-existing, left as is). `prettier --check test` with the package flags
  flags `test/core.test.mjs`, `test/schema-factory.test.ts` (74) and the plain
  fixture (a tab re-serialization); format them or exempt them.
- ~~**tka-side test nits for the next touch.**~~ Closed in 2A Task 13 (package `1d04edc`, tka `1d6c95fcd9`). The compositor case "names the
  layer when a mounted sequence animation has no surface" should pin the label
  (`compiled.preset.regions.find((r) => r.id === "motion")!.label`, since the
  compositor builds the name from `staticRegion.label ?? layer.sourceRole`)
  instead of matching any text.
  `tka:tests/unit/video-editor-value-closure.test.ts` has a header (lines 1-11)
  and a describe title that still describe `bound.ts` only, although
  `surfaces.ts` is a second root. `tka:tests/unit/video-editor-copies.test.ts`
  compares only `PLAYBACK_MIN_BPM` and `PLAYBACK_MAX_BPM`; it should also
  compare `PLAYBACK_BASELINE_BPM`, `PLAYBACK_MIN_SPEED` and
  `PLAYBACK_MAX_SPEED`. Optionally add a compile-time assertion in tka's
  `collaborative-video.ts` that `StepMap` extends the package's `LegacyStepMap`.

### Carried out of step 2A

For 2B's first tidy; no 2A task is left to own them.

- **Task 13 review nits.** tka `post-editor-state.svelte.ts:434`: the dispose
  comment is one 155-character line. tka
  `docs/development/post-studio-manifest-bridge.md:26` omits
  `core/edit/music-edits.ts` for the music ops and names PIP edits that ops never
  call. Package `scripts/step1/check-intersection.mjs` keeps a dead `PNPM_STORE`
  replace.
- **Task 14 review nits.** The `DOM_SURFACE_MODES` doc comment at
  `src/render/frame-compositor.ts:468` still says every other mode reaches the
  media branch, but a painted mode now throws. The `POST_STUDIO_SOURCES` read at
  `frame-compositor.ts:28` and `481-485` is one more generic place that knows
  tka's sequence-carousel (ties to the `DOM_SURFACE_MODES` item in Step 3). The
  save and restore spans of `drawPaintedLayer` and the `sourceGeometry` branch
  (`frame-compositor.ts:341-357` and `546-551`) restore outside a `finally`; a
  next frame cannot see it today, because any frame error ends the export and the
  canvas is per export. `painter-registry.test.ts` "builds a fresh painter each
  time" asserts on the fake factory, not the registry.
- **No package test of `core/edit/music-edits.ts`.** Its only coverage is tka's
  19-case `post-music-edits.test.ts`, through tka's plugin and fixtures. Add a
  plugin-free case.
- **The surface test pins names, not signatures** (plan risk R13), and tka's type
  gate covers `src` only. A member no `src` file uses has no type check.
- **`hero-act.test.ts` under load.** `src/lib/shared/landing/data/__tests__/`
  failed two "shape-matrix source" cases in one of two full `test:ci` runs at
  Task 15 and passes alone; its `flushUntil` waits 50 timer ticks. Not a video
  editor file; raise the wait or wait on the mock instead.

## Step 3 (Ringmaster adopts it)

### The card and the Ringmaster host

- **Decide the card first.** The decision is Austen's. The spec's "The card as
  built" under "Step 1 as built" records the four as-built facts (no content
  fields, the shared role at `src/core/compile/compiler.ts:729`, no card
  painter, `choreo-card` in `DOM_SURFACE_MODES`) and the three options: (a) drop
  the card kind for Ringmaster, (b) bind cards as external-media images, (c)
  give cards per-item roles, content fields and a core card painter. The spec's
  intent points at (c). The decision also settles whether `qrUrl` is a core card
  field (today it is a field of tka's card kind extension) and what the core
  card painter draws. Until it lands, Ringmaster must not offer a card: a
  plugin-free host that does gets one shared "Choreo card" role with nothing to
  draw, and the compositor throws at `src/render/frame-compositor.ts:553-556`
  ("has no surface for its choreo-card render mode") or at `:505` ("not ready to
  render").
- **Ringmaster's compositor wiring.** Pass `painters` from
  `createPainterRegistry([textPainterFactory]).paintersFor(...)` and no
  surfaces. Mount a `.media-layer[data-clip-id]` element with a `<video>` or
  `<img>` for every visible non-painted layer: the surface lookup and the
  readiness check (`src/render/frame-compositor.ts:505`) run before
  `videoFrames` is consulted. The exporter's `tick` and double
  `requestAnimationFrame` waits assume a Svelte host, which Ringmaster is.
- **Ringmaster's preview cache.** Construct `PreviewVideoCache` with
  `PreviewVideoLocalStore` and `renderPreviewVideo`, and omit `findPrepared`
  (tka's `edit-copy-lookup.ts` reads tka's feature-video domain). Consider a
  package factory with browser defaults so hosts stop re-deriving the support
  test. The preview worker's ranged `UrlSource` fetches need CORS on
  Ringmaster's media origins. Ringmaster uses `buildMixedAudioTrack`, not the v1
  act-list `buildPostAudioTrack`.
- **Ringmaster config.** Add `worker-src 'self' blob:` (and
  `'wasm-unsafe-eval'`, per the spec's Risks) to `hooks.server.ts` and verify on
  the preview. Add `@austencloud/video-editor` to `optimizeDeps.exclude` in
  Ringmaster's `vite.config.ts`, as tka does: a pre-bundled copy breaks the
  relative worker URL in dev and duplicates classes. Ringmaster's vite config
  has no `worker` block, so the default `iife` format applies; set `"es"` if
  code splitting ever appears.
- **Keep client-only code client-only.** `renderPreviewVideo`,
  `new PreviewVideoFrameRecovery`, `startVideoMirror`, `buildMixedAudioTrack`
  and `hasDecodableAudioTrack` stay in client-only code.
- **Compile-level music test.** The plain fixture has no music (no `music`
  field; `audio` is "takes"). Build a Ringmaster-layers fixture with a music
  placement so `src/core/music/music-grid.ts` and `src/core/music/audio-plan.ts`
  get a compile-level test.

### Preview store options

- **Dexie name option.** `src/render/preview-cache/preview-video-store.ts:31`
  hard-codes the database name `tka-post-studio-preview-videos` (schema v1
  `records: "key,assetKey,accessed", files: "key"`). Add a `databaseName` field
  to `PreviewVideoLocalStoreOptions` with this default, so tka's existing caches
  survive, before Ringmaster constructs its own store. Construction is lazy
  (lines 45-57), so SSR is safe; the name is cosmetic because IndexedDB is per
  origin.
- **NaN validation of the store options.** In the same options type, NaN passes
  `??` and then every write evicts the whole cache. Validate `maxCacheBytes` and
  `maxVideoBytes` (finite, positive) and fall back to the defaults.

### Curating the core surface

- **tka-shaped core exports.** `src/core/index.ts` exports `POST_STUDIO_ROLE`
  (`src/core/plan/presets.ts:35`), the `BREAKDOWN_*` names
  (`presets.ts:369-453`), `STRIP_ROLE_PREFIX`, `stripRole` and
  `stripModeFromRole` (`src/core/plan/plan-compiler.ts:29-46`),
  `ChoreoCardMediaSourceSchema`, `SequenceAnimationMediaSourceSchema` and
  `SEQUENCE_DERIVED_SOURCE_KINDS` (`src/core/preset/source-schema.ts:25-99`),
  `migrateLegacyStepMap` (`src/core/time-map.ts:478`), `CAPTION_STARTERS`
  (`src/core/plan/post-plan.ts:411`), the `TUNNEL_*` names
  (`src/core/tunnel-hook.ts` 9, 15, 129 and 209, and `src/core/roles.ts:28`) and
  `OPENING_TITLES_SHARE` (`src/core/roles.ts:25`). For each name decide: stays
  as core vocabulary, moves to the tka plugin, or stays renamed and documented.
  The earlier carry-over already covered the roles and the tunnel names; the
  strip, breakdown, choreo-card source and step-map exports were on no list
  until the whole-step review. The core surface was 228 names at the Task 5
  record.
- **Other tka-flavoured core content.** `ownerId: "tka-system"`
  (`src/core/plan/presets.ts:155`); `CAPTION_FONT_FAMILY`
  (`src/core/caption-layout.ts:59`); the `MediaSource` type name shadows the
  browser global (`src/core/preset/source-schema.ts:144`); `autoGradeVideo`
  creates DOM elements inside core (`src/core/color-grade.ts:124`).
- **Comments that name LOOP, Austen and InShot.** `src/render/alignment.ts:39`
  (LOOP), `src/core/project/schema.ts:17` (InShot) and `:316` (Austen),
  `src/render/text-item-painter.ts:62` (InShot) and `:134` (Austen), and
  `src/core/compile/compiler.ts:493` (Austen). Reword each as the generic
  behaviour it describes.
- **Copy that reads as tka.** The Dexie name (above); the `[post-audio-track]`
  log prefix (`src/render/audio-track.ts:290`); "Post Studio" in
  `src/render/media-audio-inspector.ts:4`; the timing-screen history comment in
  `src/render/video-mirror.ts`; the `I` prefix on `IPreviewVideoCache`.
- **`DOM_SURFACE_MODES`.** `src/render/frame-compositor.ts:469` is
  `new Set(["sequence-animation", "choreo-card"])`: tka's render modes inside
  the package, with a doc that states them as package truth. Reword the doc as
  "the modes a host must supply a surface for" and move the set to the plugin or
  the host. A no-surface host works only while its preview never mounts those
  modes. This ties to the card decision.
- **Two `PostFraming` shapes.** `src/core/plan/post-plan.ts` (area, fit, zoom,
  pan) and `src/core/project/schema.ts` (zoom, pan, rotation) both declare
  `PostFraming` and `PostFramingSchema`. `src/core/index.ts` re-exports the
  project one explicitly, because the barrel otherwise raises TS2308, and
  `move.mjs` prints a BARREL line for a file that imports the other. Rename or
  merge them before Ringmaster imports either.
- **Compile seam clean-ups from the Task 8 review.**
  - `src/core/pip-sample.ts` (13): the doc says the core reads `movesOnTop` and
    `shared`, but only tka does. Move those two fields onto tka's `PipHandoff`
    and fix the doc.
  - `src/core/roles.ts`: `OPENING_TITLES_SHARE`, `TUNNEL_TITLE_RISE`,
    `TunnelWordLook` and `TunnelTitlesLook` serve only tka's `tunnel-titles.ts`.
    Reword the header and consider moving them to tka.
  - `src/core/compile/compiler.ts:87`: `animationOverlay` on the core compile
    context is read only by tka's `compile-hooks.ts`. Make an augmentable
    `PluginCompileContext`, as `PluginCompiledOutputs` is.
  - Optional: an exhaustiveness guard `const coreKindsCovered: never = item;` in
    the compiler's default branch, with the caveat that a package test
    augmenting `PluginItemKinds` would trip it.
  - `regionKeyframesFor`'s `output` parameter duplicates `env.output`.
    `CompileItemEnv.trackIndex` (`src/core/compile/hooks.ts:88`) is read by no
    tka hook; the design names it and step 3 may drop it. `hooks.ts` writes
    "TKA:" where `compiler.ts` writes "tka:"; pick one.
- **Alignment and output-key clean-ups from the Task 9 review.** Narrow
  `frameFields` (`src/render/alignment.ts:66`) to `(sample, holdLandings)`,
  because the evaluator only passes back the alignment's own `moveBeats`. Give
  `CORE_OUTPUT_KEYS` (`src/core/compile/compiler.ts:119`) a type link to
  `CompiledPostProject`'s output keys; the suggested
  `Record<Exclude<keyof CompiledPostProject, ...>, true>` must exclude the
  non-output fields too.
- **Stale "today" and tka wording sweep.** Locate by text:
  `src/core/project/schema-factory.ts` (about 62), `src/core/project/schema.ts`
  (about 848), `src/core/tunnel-hook.ts` (about 56),
  `src/core/project/item-kinds.ts` (about 11),
  `src/core/preset/playback-bpm.ts`, `src/core/time-map.ts`,
  `src/core/preset/preset-schema.ts` and `src/workers/video-export.worker.ts`.
  Also: `src/core/project/normalize.ts:246` cites
  `2026-09-26-post-studio-keyframes-design.md`, a tka doc the package does not
  ship; `src/core/project/keyframes.ts:22-23` says "as the other post-project
  modules do"; the "tunnel intro" comments in `normalize.ts` (about 98-107) and
  `compiler.ts` (429) read as tka; and tka `post-project-edits.ts:2100` still
  says "see `post-project-keyframes.ts`" (now `core/project/keyframes.ts`),
  which can be fixed when that file moves in step 2. That last item went with the
  edit engine in 2A Task 6 (tka `0a242bc1fd`).

## Step 4 (release and merge)

The spec's step 4 row and exit criteria stand (changeset, publish 0.1.0, swap
the aliases for pins, clean lockfiles, integrate the three repositories, rebase
`codex/feature-video-captures`, worker-proof PASS on both apps' production
builds against the installed published version). This section lists what step 1
added to that work.

### Removal checklist

Copied verbatim from the step 1 whole-step review.

Removal checklist in tka:

- `svelte.config.js`:
  - line 1, the `readFileSync` import, if nothing else uses it;
  - lines 15-23, `pinnedPackages` for svelte and zod;
  - lines 79-86, the aliases;
  - lines 103-127, the `kit.typescript.config` pin block.
- `tests/config/vitest.config.ts`: lines 71-78, the aliases. Line 106, the dedupe: rewrite its alias comment, and keep the dedupe if zod and dexie stay package dependencies.
- `tests/config/vitest.components.config.ts`: lines 86-93, the aliases; line 98, the dedupe (same note); line 106, `fs.allow`.
- `scripts/tsconfig.json`: lines 6-8.
- `tests/unit/video-editor-copies.test.ts:6`: the absolute `E:` import. Retarget the test or retire it.
- The spike route `src/routes/test/video-editor-spike/`.
- Keep `vite.config.ts:1053-1059` (dedupe of svelte, mediabunny, zod and dexie) and `:1333` (`optimizeDeps.exclude`).
- `git grep` finds no other tracked reference to `E:/worktrees/shared-packages` in tka.

In the package:

- Make zod and dexie peers, or document the host dedupe. Set the svelte peer to `^5.29.0`. Remove `private: true` in the same commit as the changeset.
- Rewrite the README to cover:
  - the four entries and `./css/*`;
  - the plugin contract and `createProjectSchema(plugin?)`;
  - host requirements: dedupe svelte, mediabunny, zod and dexie, `optimizeDeps.exclude`, a Svelte runtime for `/render`, a mounted media layer per visible clip, and surfaces for any DOM render mode;
  - the one app-wide preview cache;
  - no spike.
- Delete `scripts/step1/` except `forbidden-imports.mjs`. Make that one path-relative, with no absolute E: roots, and run it from the package `test` or `check` script. `ascii.mjs` can stay only if it is wired into `check`.
- Delete most of `test/step1-tools.test.mjs`; keep the forbidden-imports cases as `test/forbidden-imports.test.mjs`.
- Delete the spike: `scripts/spike/` (keep `cdp.mjs` only if step 2's browser tests use it), `createSpikeWorker`, the spike message types, and their exports in `src/index.ts` and `src/workers/index.ts`. Keep `worker-proof-preview.mjs` and `trail-parity-proof.mjs` (already in `scripts/spike/`) as the production-build and parity proofs; move them to `scripts/proofs/` with `cdp.mjs` when the spike folder goes.
- Add a CI test script. Run the trail export parity harness in a GPU Chrome on the branch and on main before the merge.

### Other step 4 items

- **zod and dexie as peers, or a documented host dedupe.** `package.json:47`
  lists zod as a dependency (`^4.2.1`; the package resolves 4.6.5), while the
  plugin contract takes host-built zod shapes (`projectExtension.shape`,
  `kindExtensions`, item kind schemas) and mixes them into package schemas. tka
  runs 4.3.6 and dedupes zod and dexie permanently in
  `tka:vite.config.ts:1053-1059`. Make zod (and probably dexie) a peer, or
  document that the host must dedupe both. If a zod `paths` pin was added to
  tka's `svelte.config.js` during steps 2 or 3, remove it with the other pins.
- **svelte peer floor.** `package.json:51` peers `svelte ^5.0.0`, but
  `src/render/video-mirror.ts` uses `svelte/attachments` types (Svelte 5.29 and
  later), so the `.d.ts` needs more than the peer says. Set `^5.29.0` when the
  package goes public.
- **The render entry needs a Svelte runtime.** `src/render/post-exporter.ts:1`
  imports `tick` from svelte, so `/render` needs a Svelte runtime even for
  export alone. That is fine for both hosts and backed by the svelte peer; say
  it in one README line, in the host requirements.
- **README.** `README.md:5` still describes the step 0 spike, lines 15-16 list
  only svelte and mediabunny under dedupe, and the README omits `./render` and
  `./encoder`. That is by design until step 4; what it must say is in the
  package list above.
- **Absolute paths in the kept tool.** `scripts/step1/lib.mjs:7-8` hard-code
  `E:/worktrees/...` for tka (`TKA`, overridable with `STEP1_TKA`) and the
  package (`PKG`), and `forbidden-imports.mjs`, the one keeper, inherits them.
  Derive the package root from `import.meta.url` and take the tka root from an
  argument or `STEP1_TKA` with no `E:` default.
- **Trail export parity FAIL under `--disable-gpu`.** The step 3 harness (trail
  export parity, DJDJ 1080 60 AV1) fails in headless Chrome on the branch (live
  0.006% max delta 46, encoder 0.073% max delta 49, full-res 0.302% max delta 113) with identical digits on tka main `533b9d1355`, served from the primary
  checkout on port 5173. So the moved encoder path matches main bit for bit and
  the FAIL is the software-rendering environment; the thresholds were set on a
  GPU browser. Rerun it once in a real GPU Chrome on the branch and on main and
  record both verdicts. `scripts/spike/cdp.mjs` could take a
  `--use-angle=default` flag, or a non-headless mode, for parity-class proofs
  (the proof scripts only need the result mirror). The in-app browser pane
  stalls `requestAnimationFrame` while hidden, so tka's splash never clears
  there for `/test/trail-export-parity`; use `cdp.mjs`.
- **Keep the preview worker proof.** `worker-proof-preview.mjs` is the proof
  that passes on a production build (the reply is
  `{"type":"error","reason":"Error fetching http://127.0.0.1:18444/missing.mp4: 404 Not Found"}`).
  It lives at `scripts/spike/worker-proof-preview.mjs` beside
  `scripts/spike/trail-parity-proof.mjs` (the trail parity driver), both kept in
  commit 7d899e6 on 2026-10-09; step 4 moves them out of the spike folder
  before deleting it. The step 0 spike worker
  proof cannot pass on a production build, because the only importer of the
  package root is `tka:src/routes/test/video-editor-spike/+page.svelte` and
  production builds empty `src/routes/test/` (`tka:src/config/feature-flags.ts`,
  `GUARDED_DEV_ROUTE_PATTERNS` at line 270 and `getClientEmptiedRoutePaths` at
  line 500). No spike chunk is emitted, and `createSpikeWorker` has no other
  caller.
- **Production-build baselines for the step 4 proof.** From the Task 14 build:
  one preview worker chunk of 540,267 bytes with its handler present (the step 2
  zod split should shrink it), a video-export worker chunk of 410,366 bytes that
  contains `Unknown message type`, no Dexie in the worker, and the
  `PostShareSheet` component chunk at 83,527 bytes.
- **CI test script.** The package root has no `test` script, so package tests do
  not run in CI. Add one (it is also in the checklist above) and wire
  `forbidden-imports.mjs` and `tsconfig.test.json` into the package `check` or
  `test` script.

## How to retire an item

Strike the bullet in place with `~~` and add the commit that fixed it, for
example `~~Dexie name option.~~ Fixed in 1a2b3c4.`, so this file stays the
single list. When every bullet under a step is struck, say so under its heading.
