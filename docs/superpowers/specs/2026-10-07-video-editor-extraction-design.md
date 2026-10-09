# Video editor extraction: `@austencloud/video-editor`

Date: 2026-10-07. Status: approved in conversation (Austen: "go ahead and make
it happen"). Name chosen by Austen: `video-editor`.

## Goal

Post Studio, the custom video editor inside tka-platform, becomes one shared
package that both tka-platform and Ringmaster (E:/cirque-aflame/ringmaster)
run with full feature parity for everything generic. TKA's sequence-specific
pieces stay in tka-platform as a plugin the package loads. Every change to the
editor from now on happens in the package and reaches both apps.

## Decisions (Austen, 2026-10-07)

| Topic | Decision |
| --- | --- |
| Parity scope | The generic editor is identical in both apps: timeline, trim, split, speed, reorder, snapping, zoom, undo, keyframes with easing, transitions, looks, text, cards (once step 3 settles the card, see "Step 1 as built"), music lane, media sources, export, drafts. Sequence overlays (animation, moves, carousel, titles), the Tutorial preset, take timing, tap-fit and staff-tip tracking stay in tka-platform behind a plugin interface. |
| Ringmaster persistence | A Firestore `videoProjects` collection scoped to the signed-in user, through the existing store port, with the same device and session caching TKA uses. |
| In-flight work | Extract from tka-platform `main` now. The `codex/feature-video-captures` branch (CLI and server work, plus a few editor-domain edits) is rebased onto the package afterwards. |
| Name | `@austencloud/video-editor`, folder `E:/shared-packages/packages/video-editor`. Screens may still say Post Studio (TKA) or Studio (Ringmaster). |

## What moves and what stays

Inventory of tka-platform on 2026-10-07 (paths relative to E:/tka-platform):

- `src/lib/shared/media-composition` (about 100 files, 32.7k lines): domain
  (project schema, edits, keyframes, compiler, preset schema), services
  (evaluator, painters, compositor, exporter, audio plan and mix, stores,
  preview cache), state (`post-editor-state.svelte.ts`), workers (preview
  video, staff-tip tracker).
- `src/lib/shared/share/components/post-studio` (about 90 files, 23k lines):
  `PostStudio.svelte`, `editor/PostEditorWorkspace.svelte` (3867 lines),
  `editor/PostEditorCanvas.svelte` (3314), `editor/PostItemTool.svelte`
  (1688), `editor/timeline/*`, keyframe and curve editors, tool panels,
  `builder/*` (take timing UI).
- The encoder in `src/lib/shared/animation-engine/{services/background-video-encoder.ts, workers/video-export.worker.ts}`
  and `src/lib/shared/video-export/*` (frame capturer, takeover, captured
  frame), shared with TKA's animation and 3D exports.
- Generic helpers the editor leans on: `ui/components/{SegmentedControl, TypeableValue, ValueSlider, ScrubbableNumber, OverflowMenu}`,
  `components/panel/PanelButton`, `components/Crossfade`,
  `foundation/ui/{Drawer, DrawerHeader, ConfirmDialog}`, `panels/ResizeHandle`,
  `timeline/TimeRuler`, `transitions/{motion, layout-flip, transitions, ws-ease}`,
  `ui/typed-number`, `render/utils/trace-rounded-rect`, `audio/bpm-analyzer`,
  `foundation/services/file-downloader`, `getVideoFileMetadata`, `deepEqual`.

**Package side** (about 45k lines before cleanup): the generic domain, render
path, encoder, editor UI, the helpers above, and the English strings.

**Stays in tka-platform**: `SequenceData`/`StepData` types and everything that
needs them (animation-engine, effects, mandala, pictograph, sequence-viewer
surfaces, grid-join, create transforms, QR detector, share card state), the
`builder/` timing UI and `take-timing.ts`/`tap-fit.ts`, the Tutorial preset and
looks that place sequence items, staff-tip tracking, the share sheet and
Instagram publishing (`PostShareSheet`, `InstagramPostReview`, `meta-publish`,
`r2-video-uploader`), `features/post` (PostModule, account sync), the
feature-video folder backend (`/api/dev/*`, `feature-video-store.ts`,
`post-studio-draft-storage.mjs`) and the CLI (`scripts/post-project.mjs`,
`scripts/feature-video/*`).

**Deleted, not moved** (dead since the slots iteration):
`composition-playback-adapter.ts`, `media-composition-preset-repository.ts`,
`caption-painter.ts` and their tests. `state/media-composition-state.svelte.ts`
stays until step 2: it is dead at run time but still supplies the types
`CompositionSourceBinding` and `MediaCompositionState` to three components and
the context file, so step 2 moves the binding type and then deletes it.

## Package anatomy

```
packages/video-editor/
  package.json        name @austencloud/video-editor, version 0.1.0, type module
  tsconfig.json       extends ../../tsconfig.base.json (strict, verbatimModuleSyntax)
  src/
    index.ts          VideoEditor.svelte, host and plugin types, createVideoEditorState
    core/             project schema, item kinds, edits, keyframes, normalize, compiler, preset schema
    render/           frame evaluator, painters, compositor, audio plan and mix, preview cache
    encoder/          CanvasFrameCapturer, BackgroundVideoEncoder, video-export.worker.ts, ExportTakeover, captured-frame
    workers/          preview-video.worker.ts
    ui/               editor components (workspace, canvas, timeline, tools, keyframes, music lane) and the UI kit
    strings/          en.ts: every key the editor uses, with English text
  css/video-editor-tokens.css   --ve-* variables with dark fallbacks
  test/               vitest (jsdom) for core, render, strings; vitest browser mode for components
```

Exports map, each with `types`, `svelte` (where a Svelte entry exists) and
`import` conditions resolving to `dist` (media-manager's commit `ec21f52`
pattern):

| Subpath | Contents | Svelte? |
| --- | --- | --- |
| `.` | `VideoEditor` component, `createVideoEditorState`, host and plugin types | yes |
| `./core` | schema factory, item kinds, edits, keyframes, normalize, compiler | no |
| `./render` | evaluator, painter registry, compositor, audio | no |
| `./encoder` | capturer, background encoder, takeover | yes (takeover) |
| `./css/*` | tokens | n/a |

`sideEffects: false` except the CSS. `files: ["dist", "css"]` (not `src`,
so the published tarball stays small; `svelte` conditions point at `dist`).

Dependencies (runtime): `zod ^4`, `wavesurfer.js ^7`, `modern-screenshot ^4`,
`dexie ^4`, `@fortawesome/free-solid-svg-icons ^7`, `h264-mp4-encoder ^1`
(WASM fallback). Peer: `svelte ^5` and `mediabunny ^1.44` (step 0 made
mediabunny a peer so the package shares the host's copy; the package
type-checks against `~1.44.2`, the oldest host version). No `bits-ui`: the
two components that use it get plain replacements. No `firebase`.

Workers ship as `dist/workers/*.worker.js` and `dist/encoder/*.worker.js`,
created by `new Worker(new URL("./x.worker.js", import.meta.url), { type: "module" })`
from the module beside them. Hosts add `@austencloud/video-editor` to
`optimizeDeps.exclude` and keep `resolve.dedupe: ["svelte", "mediabunny"]`.

Icons render as inline SVG from `@fortawesome/free-solid-svg-icons` through
one `Icon.svelte`; the `fa-*` class usage (89 classes) is replaced.

Styling: scoped `<style>` blocks reading `var(--ve-*, fallback)`. The token
file maps `--ve-*` to `--theme-*` from `@austencloud/theme` when present.
Ringmaster's token-usage scan must pass, so no hard-coded colours in the
app-side integration.

## Host contract

```ts
export interface VideoEditorHost {
  ownerId: string;                       // scopes device storage keys (was auth.currentUser)
  store?: VideoEditorStore;              // the PostEditorStore port, renamed; default devicePostEditorStore
  mediaLibrary?: MediaLibrary;           // list and resolve library takes; fetch policy for CORS media
  translate?: (key: StringKey, params?: Record<string, string | number>) => string; // default: English table
  notify?: (toast: { kind: "info" | "error"; text: string }) => void;
  shortcuts?: ShortcutRegistrar;         // default: a window keydown listener scoped to the editor
  now?: () => number;
  dev?: boolean;                         // replaces import.meta.env.DEV gates
}

export interface MediaLibrary {
  listTakes(): Promise<LibraryTake[]>;
  resolveTake(id: string): Promise<LibraryTake | null>;
  /** Rewrites or re-requests a media URL so fetch and decode succeed (proxy, cache: "no-store"). */
  requestFor(url: string): Request;
}
```

`VideoEditorStore` keeps the current `PostEditorStore` shape (openProject,
saveProject, timing load and save, history load and save) with the owner id
passed in instead of read from Firebase.

Step 2A as planned (2026-10-09): timing load and save leave the store port.
Take timing is a tka concern, so it lives in a tka state extension beside the
package state, and `VideoEditorStore` carries `openProject`, `saveProject`,
`backupBeforeImport`, `loadHistory` and `saveHistory` only, all synchronous.
The Ringmaster store (step 3) prefetches Firestore into a device cache before
the editor mounts and syncs in the background, so the port stays synchronous.
See the step 2A plan, Risks R4.

## Plugin contract

```ts
export interface VideoEditorPlugin {
  id: string;                                   // "tka"
  itemKinds: ItemKindDefinition[];              // zod schema, label, defaults, compile hook, tool panel, lane renderer, media sublayer
  projectExtension?: z.ZodRawShape;             // extra top-level fields (sequenceId, timings, sequenceActions)
  painters?: PainterFactory[];                  // strip, carousel, staff effects, tunnel titles
  surfaces?: SurfaceCapture[];                  // DOM-captured render modes (choreo card, sequence animation)
  alignment?: AlignmentProvider;                // take clocks and StepData for the evaluator
  presets?: ProjectPreset[];                    // Tutorial
  looks?: LookDefinition[];                     // Dual, Breakdown
  modes?: EditorMode[];                         // "timing" mode and its toolbar
  canvasOverlays?: CanvasOverlay[];             // staff tracking UI, animation panel reparenting
}
```

Core item kinds: `video`, `image`, `card`, `text`. Step 3 target: `card` in the
core is a plain card (background, text lines, optional image or QR); TKA's
choreo card is a plugin surface drawn into a `card` item through `surfaces`.
Step 1 built neither the core card's content fields nor a core card painter, so
this is the intent and not the as-built state; see "The card as built" under
"Step 1 as built".

`createProjectSchema(plugin?)` builds the discriminated union from the core
kinds plus the plugin's and merges `projectExtension`. The core project has
`subjectId: string` (TKA passes the sequence id). A TKA saved v2 project must
parse and normalize to the same object as today; a test loads real drafts from
`~/.tka/post-studio-drafts` fixtures copied into the test tree. Schema version
stays 2. Unknown kinds fail parsing with a message naming the kind.

### Step 1 as built (2026-10-08)

The plugin object in `src/plugin.ts` has these members: `id`, `itemKinds` (each
with `kind`, `schema`, `label`, `defaultBox`, `compile` and the optional
`transitionVisual`, `placement` and `ownsIntroKeys`), `kindExtensions` (extra
fields on a core kind), `projectExtension` (a zod shape plus an `order` array
naming every merged key, so parsed objects keep today's key order), `normalize`
(`before`, `after`), `compileHooks` (`begin`, `footageIntro`,
`videoCompanions`, `regionSpan`), `compileOutputs`, `isMediaUrl`, `alignment`,
`painters` and `surfaces`. The last three are typed but unread: the host hands
an alignment to the evaluator, painter factories to `createPainterRegistry` and
surfaces to the compositor and exporter, and step 2 decides whether they stay
plugin members. `presets`, `looks`, `modes`, `canvasOverlays` and the kind's
tool panel, lane renderer and media sublayer wait for step 2. Against the
sketch above, `projectExtension` is `{ shape, order }` rather than a bare shape,
`itemKinds` is readonly, and `kindExtensions`, `normalize`, `compileHooks`,
`compileOutputs` and `isMediaUrl` are additions.

tka binds the plugin in `post-studio-plugin/bound.ts`, which exports
`tkaPlugin`, `PostProjectSchema`, `PostMusicSchema`, `defaultBoxFor`,
`normalizeProject`, `compilePostProject`, `createEmptyPostProject`,
`evaluatePresetFrame` and `evaluatePresetLayers`, so call sites change an
import path and not a call shape. The bound-only test lets only `bound.ts`
import `createProjectSchema`, `createEmptyPostProject`, `defaultBoxFor`,
`normalizeProject` and `compilePostProject` from the package core, and
`evaluatePresetLayers` and `evaluatePresetFrame` from the package render
entry, because each takes the plugin or the package's alignment as an argument;
a whole-module import is caught too. The value-closure test has two roots,
`bound.ts` and `surfaces.ts` (the second since the Task 10 fix round), and keeps
the plugin index out of what either loads by value, because the index
re-exports `bound.ts` and an import back is a load-time cycle.

Parity is draw-call parity in jsdom, not pixel parity (step 1 plan,
"Parity-test decision"): jsdom has no pixels and the DCK draft's footage is not
on disk. For two fixtures, the DCK draft and a plugin-free project, tka's
`tests/unit/video-editor-parity.test.ts` hashes (a) the normalized project JSON,
(b) the compiled preset JSON and, per timestamp, (c) the evaluated layers and
(d) the log of every call on a recording 2D context, with video, images and DOM
captures replaced by stand-ins. The committed "before" hashes and 12 draw logs
come from the tree before the extraction. `PARITY_WRITE=1` regenerates them and
is set neither in CI nor by an agent.

Corrections from the Task 6 review. The `auto` motion key schema (`tunnel`,
`handoff`) is core vocabulary, not a tka cut. The core `createEmptyPostProject`
takes no plugin; it spreads the extension fields right after `schemaVersion`.
The core-only `Post{Video,Image,Card,Text}ItemSchema` exports keep their old
names but reject tka fields. `POST_BOX` carries the strip boxes from
`BREAKDOWN_GEOMETRY`. From the Task 4 review: `encoder/codec.ts` computes
`IS_MOBILE` in an IIFE that now also runs on the main thread; it is guarded by
try/catch and must not become an unguarded `navigator` read.

**The card as built.** The core card is not the plain card the design above
describes, and step 3 plans from this record:

- The core card shape is `itemBase` plus `kind: "card"` and nothing more: no
  background, text lines, image or QR field.
- `core/compile/compiler.ts:729` compiles every card to the one shared role
  `presetRole(POST_STUDIO_ROLE.card, "Choreo card", "linked-choreo-card", ["choreo-card"])`.
- The package has no card painter: `render/painter-registry.ts:48` exports only
  `textPainterFactory`.
- `render/frame-compositor.ts:469` lists `choreo-card` among the DOM surface
  modes. A plugin-free host that offers a card therefore gets a role with no
  content to draw, and the compositor throws: at `:553-556` ("has no surface for
  its choreo-card render mode") when the host binds that mode, or at `:505`
  ("not ready to render") when no media element is mounted for the layer.

The card's `qrUrl` scan link, which tka main added on 2026-10-08 (commit
`ad6afcaf73`), is ported into tka's card kind extension in the plugin and not
into the core card, which matches this as-built state. Step 3 may lift it into
the core if the core card gains content fields.

Step 3 decides the card, and the decision is Austen's. The options, as the step
1 carry-over recorded them: (a) drop the card kind for Ringmaster, (b) bind
cards as external-media images, (c) give cards per-item roles, content fields
and a core card painter. The intent in "Plugin contract" and "Render path"
points at (c). The same decision settles whether `qrUrl` is a core card field.

The package suite is 23 vitest files with 176 tests plus 34 node tests: 31 tool
tests in `test/step1-tools.test.mjs` and 3 core tests in `test/core.test.mjs`.
Its Task 13 additions came from earlier reviews: the encoder entry test (Task
4), the schema-factory messages and comment wraps (Task 6b), the
frame-evaluator test (Task 9), the painter-registry test (Task 10), and the
`PreviewMediaReading` rename, the store options rename, the comment fixes and
the node-entry test (Task 11). Five package-only tests stay in tka until the
package has a setup file or browser mode (they need `Blob.prototype.arrayBuffer`
and canvas `getContext("2d")`); two of them are in the export smoke, which is
now five files.

## Render path

- `compileProject(project, context, plugin?)`: core regions and clips; each
  plugin kind contributes through its compile hook; sequence splitting at main
  video boundaries moves into the TKA kinds' hooks.
- `evaluatePresetLayers(preset, duration, t, alignment?)`: alignment stays an
  optional argument supplied by `plugin.alignment`.
- Painters come from a registry: core plus `plugin.painters`. The
  `PostStudioLayerPainter` interface is unchanged. The step 3 target for the
  core list is text, backdrop and card. Step 1 built the text factory only
  (`textPainterFactory`, `render/painter-registry.ts:48`); the compositor draws
  the backdrop itself through `backdrop-painter.ts`, and there is no card
  painter until step 3 settles the card.
- The compositor's `renderMode` DOM captures become `plugin.surfaces`.
- The encoder is `./encoder`; tka-platform's animation and 3D exporters import
  it from the package (their `get-*` deferred registrations keep working).

## Dev loop and publishing

During steps 0 to 3 the apps resolve the package by Vite alias and tsconfig
`paths`, not by installing it:

- tka worktree: `svelte.config.js` `kit.alias` gets `@austencloud/video-editor/css`
  and `@austencloud/video-editor` entries pointing at
  `E:/worktrees/shared-packages/video-editor/packages/video-editor/{css,dist}`
  (SvelteKit derives the Vite aliases and the generated tsconfig `paths` from
  them), `kit.typescript.config` pins every svelte subpath to the app's own
  copy, `server.fs.allow` reaches that worktree, and `optimizeDeps.exclude`
  lists the package. The package's runtime deps resolve from the
  shared-packages worktree's `node_modules` (pnpm install there once).
- Ringmaster worktree: the same, in `ringmaster/svelte.config.js` and
  `ringmaster/vite.config.ts`.
- This keeps both primary checkouts' `node_modules` and lockfiles untouched
  until step 4, which matters because tka worktrees junction `node_modules`
  into the primary and Ringmaster CI fails on linked lock entries.

Step 4 replaces the alias with a real dependency: publish
`@austencloud/video-editor@0.1.0` through changesets, pin `^0.1.0` in both
apps, regenerate Ringmaster's lockfile from a clean install, run both gates.

### Step 0 findings (2026-10-07)

- Aliases live in `kit.alias` in each app's `svelte.config.js`, not in
  `vite.config.ts` or hand-written tsconfig `paths`: SvelteKit derives both
  the Vite alias list and the generated tsconfig `paths` from it. The
  `@austencloud/video-editor/css` entry precedes the package entry because
  Vite takes the first matching prefix. tka's `server.fs.allow` already
  reaches `E:/worktrees` through `"../../"`; Ringmaster's committed
  `server.fs.allow` adds the shared-packages worktree, because the worker
  file is reached through `new URL(..., import.meta.url)`, which Vite
  rewrites without marking the file safe.
- An alias that points outside `node_modules` makes TypeScript load a second
  copy of svelte's ambient types from the shared-packages worktree (5.49.1
  there; tka 5.49.2, Ringmaster 5.43.6), which surfaces as `Snippet`
  mismatches in untouched files (tka +41 errors, Ringmaster +10). Both apps
  pin TypeScript's svelte to their own copy through `kit.typescript.config`,
  generating one `paths` entry per subpath from svelte's exports map
  (`svelte`, `svelte/store`, `svelte/elements`, ... 14 entries), because a
  bare `svelte` entry is an exact match and would not cover subpath imports
  once the real UI moves in. Vite's `resolve.dedupe` handles the runtime.
  Both pins go away with the aliases in step 4.
- Both apps dedupe `mediabunny`; the explicit `svelte` entry is
  documentation, since vite-plugin-svelte already dedupes every svelte
  export. The package declares both as peer dependencies and type-checks
  against mediabunny `~1.44.2`, the oldest host version (tka 1.44.2,
  Ringmaster 1.61.0). The package is `"private": true` until step 4, because
  `changeset publish` on a push to shared-packages main would otherwise ship
  the placeholder as 0.1.0; `changeset publish` skips private packages
  silently, so step 4 removes the flag in the same commit as the changeset.
- The worker chunk lands at `_app/immutable/workers/preview-video.worker-<hash>.js`
  in both production builds as a self-contained IIFE with mediabunny bundled
  in (Ringmaster: `preview-video.worker-Dkmj8Ue1.js`, 46 KB, referenced from
  a route node; tka: `preview-video.worker-DGlyAZgN.js`, 36 KB, beside tka's
  own 540 KB `preview-video.worker` from `media-composition/workers/`, which
  step 1 moves into the package, so worker-proof picks the package chunk by
  its ping handler), and runs from a static server with no
  app shell (`scripts/spike/worker-proof.mjs`).
- tka's `/test/*` routes are emptied from a normal production build and the
  `/test` layout redirects outside dev, so the spike route and its
  machine-specific alias never reach a normal build. `npm run build:all`
  keeps them but fails on main for an unrelated reason (the primary's
  installed `@austencloud/backgrounds` 0.7.12 lacks
  `setOceanFishSimulationSeed`, which the ocean-character-lab test page
  imports), so the tka proof used the normal production build
  (`NODE_ENV=production vite build`, not `npm run build`, whose chain ends
  in `upload-sourcemaps.js`) with a temporary uncommitted copy of the spike
  page outside `/test`; it passed in 3m 46s.
  tka's `check:fast` gate exits 1 on main (624 pre-existing errors); the
  branch is judged by intersecting error files with its own diff, and the
  intersection is empty at 622 errors. Ringmaster's `/showcase/*` pages
  ship behind the login gate; the spike page adds the `+page.ts` dev guard
  its siblings have (404 outside dev). `npm run check` reports 0 errors and
  the 18 pre-existing warnings; `npm test` passes (296 files).
- Merge hold: the aliases are absolute `E:/` paths, so both app branches
  stay unmerged and unpushed until step 4 swaps them for the published
  dependency. On CI's ubuntu runners `svelte-kit sync` would turn them into
  paths that do not exist, and tka's `check` and Ringmaster's `gate.yml`
  and `deploy-ringmaster.yml` would fail.
- What the alias loop does not exercise: the package's exports map, `files`,
  `sideEffects` and `optimizeDeps.exclude` are all ignored while the package
  resolves from a path outside `node_modules`. Step 4's exit criteria add a
  worker-proof PASS on both apps' production builds against the installed
  published version.
- Proof scripts: `packages/video-editor/scripts/spike/` (cdp.mjs,
  page-proof.mjs, dev-proof.mjs, worker-proof.mjs). They are outside `files`
  and stay for steps 1 to 3. dev-proof refuses a busy port, spawns `node`
  directly so the server dies with the proof, and kills by PID only.
- For step 1: worker globals type-check as `Window` under the package's
  single tsconfig, so `postMessage(msg, [buffer])` fails; each worker gets a
  typed `self` shim rather than a second WebWorker-lib tsconfig (svelte-check
  reads one). For step 2: the `--ve-*` mapping is declared on the editor root
  as well as `:root`, so subtree `--theme-*` overrides apply. For step 4:
  package tests do not run in CI yet (root has no `test` script).

## tka-platform integration

- New folder `src/lib/shared/post-studio-plugin/` holds the TKA plugin:
  sequence item kinds (animation, moves, carousel, titles), their panels and
  lanes, surfaces (ChoreoCard, sequence animation), painters, the alignment
  provider over take timing, the Tutorial preset and looks, the timing mode
  and `builder/`, staff tracking overlay.
- `PostModule.svelte` renders `<VideoEditor host={...} plugin={tkaPlugin} ...>`
  with the host built from the current stores (`devicePostEditorStore`,
  feature-video sync store, account projects), `t`, the toast and shortcut
  services, `getSequenceVideosStore` as the media library.
- `src/lib/shared/share/components/post-studio` and
  `src/lib/shared/media-composition` shrink to what stays; moved files are
  deleted in the same change that switches the import, never duplicated.
- i18n: the package's English table is the source of the keys; tka's
  `messages/*.json` keep their translations and `t` is passed in.
- Parity proof: `tests/unit/video-editor-parity.test.ts` renders fixed
  projects (the DCKΨ- post draft and `promo-1-0`) at 6 timestamps each through
  the compositor before and after the switch and asserts pixel equality within
  a tolerance of 0 on the frame hash. The "before" frames are captured once
  on `main` into `tests/fixtures/video-editor-parity/` at the start of step 1.

## Ringmaster integration

- `packages/shared/src/schemas/video-projects.ts`: the Firestore doc shape
  (`ownerId`, `project` as the package's core project, `revision`,
  `updatedAt`, `title`); drift test like `media-items.ts`.
- `src/lib/services/video-projects.svelte.ts`: `FirestoreVideoProjectStore`
  implementing `VideoEditorStore` with revision checks, plus the device cache
  and session undo caching copied from TKA's device store behaviour.
- `src/lib/services/video-editor-media-library.ts`: `MediaLibrary` over
  `mediaItems` videos and images in R2 and Firebase Storage; `requestFor`
  returns `cache: "no-store"` requests for CORS media and routes legacy
  Firebase Storage originals through `/api/r2/proxy`.
- Routes: `/studio` (project list as EntityCard boxes, "New project" pill),
  `/studio/[id]` (the editor full-bleed; sheets through a Portal). Spotlight's
  trim action becomes "Open in Studio": it creates a project seeded with that
  video and navigates; `/media?item=<id>&trim=1` redirects there.
- Export: the editor's `onExported(blob)` uploads through the existing media
  upload path (multipart above the single-upload cap) and creates a
  `mediaItems` doc tagged like the source, then runs playback preparation.
- Removal after parity: `MediaSnipEditor`, `MediaTrimTimeline`,
  `MediaClipEditor`, `MediaClipExportList`, `media-clips-worker.ts`,
  `media-clip-render.ts`, the `showcase/media-trim` page, and the
  `mediaClipJobs` queue once no job is in flight.
- House rules: pills and segmented controls, no `<select>` or checkboxes,
  whole-box clicks, `--theme-*` tokens, phone layout checked.

## Testing

- Package: the TKA-free tests (about 65 files) move as they are under
  `packages/video-editor/test`; core tests with TKA fixtures (edits, compiler,
  evaluator) get plugin-free fixtures. Component tests run in vitest browser
  mode inside the package (the first in shared-packages; config copied from
  tka's `tests/config/vitest.components.config.ts`).
- tka-platform: plugin tests stay; the parity test above; `npm run check`,
  `npm run test:ci`, `npm run build`.
- Ringmaster: store and schema tests (`tests/unit`), a browser-runes test for
  the store's undo caching, `npm run check`, `npm test`, `npm run build`.
- Each step ends with the app opened in the in-app browser on a worktree
  dev server: tka `/post` with a real sequence; Ringmaster `/studio/<id>`
  with a real library video, including one export.

## Steps and exit criteria

| Step | Work | Exit criteria |
| --- | --- | --- |
| 0 Spike | Package skeleton with one Svelte component, one module worker and the token CSS; alias wiring in both app worktrees | The worker runs in both apps' dev servers and production builds; svelte-check resolves the subpaths |
| 1 Core | `./core`, `./render`, `./encoder` moved with plugin seams; tka consumes them; TKA plugin's compile, painters, alignment and surfaces | Parity test green; tka check, tests and build green; animation and 3D exports still work |
| 2 UI | `VideoEditor` and the editor UI moved with the plugin's panels, lanes, modes and overlays; PostModule switched | Parity test green; `/post` works for a real sequence and a feature video in the app browser; tests moved |
| 3 Ringmaster | Store, schema, media library, routes, Spotlight entry, export, old editor removed | Open, trim, keyframe, add music, export a real clip on a worktree server; gate scripts green |
| 4 Release | Changeset, publish 0.1.0, swap aliases for pins, clean lockfiles, integrate all three repos, rebase `codex/feature-video-captures` | CI green in all three repos; worker-proof PASS on both apps' production builds against the installed published version (the alias loop never exercises the exports map, `files`, `sideEffects` or `optimizeDeps.exclude`); `private` removed and the package description corrected in the changeset commit; captures branch rebased and its tests green |

Each step gets its own plan under `docs/superpowers/plans/` in this repo and
runs subagent-driven (sonnet implementers, opus review between tasks, haiku
for mechanical moves and censuses).

## Worktrees and branches

- shared-packages: `E:/worktrees/shared-packages/video-editor`, branch
  `video-editor`, from `main`.
- tka-platform: `E:/worktrees/tka-platform/video-editor`, branch
  `codex/video-editor`, from local `main`, `node_modules` junctioned to the
  primary as the other tka worktrees are; integrate with
  `npm run wt:finish -- codex/video-editor --route /post`.
- cirque-aflame: `E:/worktrees/cirque-aflame/video-editor`, branch
  `video-editor`, created with `git -c core.autocrlf=false worktree add`,
  `core.autocrlf false` set in the worktree, three junctions (root,
  `cirque-website/node_modules`, `mcp-server/node_modules`), `.env` copied,
  dev server on a free port with the scratchpad vite config.
- Never edit a primary checkout. Unlink every junction before removing a
  worktree.

## Gates that wait for Austen

One bundled yes at the end of step 4 for: pushing shared-packages `main`
(which also publishes media-manager 1.7.1 through changesets), publishing
`@austencloud/video-editor`, pushing tka-platform and cirque-aflame `main`.
Nothing else needs a decision from him; recommended options are taken.

## Risks

- Workers from a package: retired for the alias dev loop by step 0 on
  2026-10-07 (dev servers and production builds of both apps run the
  packaged worker; see the Step 0 findings above). The installed-package
  path is proven in step 4.
- The three monoliths: splitting `PostEditorWorkspace`, `PostEditorCanvas` and
  `PostItemTool` along the plugin seam is the largest single job; step 2 is
  planned file by file with the parity test as the safety net.
- Duplicate Svelte: alias resolution can pull a second Svelte copy from the
  shared-packages worktree. Runtime: `resolve.dedupe: ["svelte", "mediabunny"]`
  in both apps and the `singleSvelte` probe in the spike pages (true in
  both). Types: the `kit.typescript.config` pin of every svelte subpath (see
  the step 0 findings); without it svelte-check loads the worktree's copy of
  the ambient types and every Snippet prop mismatches.
- Ringmaster CSP: no `worker-src` today; step 3 adds `worker-src 'self' blob:`
  and `'wasm-unsafe-eval'` to `hooks.server.ts` and verifies on the preview.
- Captures branch rebase: its editor-domain edits (`post-project-ops.ts`,
  `post-project-edits.ts`, `post-project-bridge-guard.ts`, `take-timing.ts`)
  are small; the uncommitted worktree edits are committed to that branch
  first so nothing is lost.

Everything step 1 left for steps 2 to 4, with file, line and proposed fix, is
listed in `2026-10-09-video-editor-open-items-after-step-1.md` beside this spec.
