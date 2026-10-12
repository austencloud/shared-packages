# Video editor step 3: Ringmaster Studio

Spec: `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md`, "Ringmaster integration" and "Steps and exit criteria". Open items: `2026-10-09-video-editor-open-items-after-step-1.md`, "Step 3".

**Goal:** Ringmaster gets a Studio: a list of video projects and the shared editor opening each one, saved to Firestore with a device copy, picking videos from the Media library, exporting finished videos back into the library.

**Execution:** inline in the main session (Agent Budget), one review at the end.

## Decisions taken (Austen's standing "take the recommended options", 2026-10-12)

- **The card:** option (a). Ringmaster offers no card. Its add panel lists video, image and text. The core card stays as built; options (b) and (c) wait for a request.
- **Old trim tools stay.** Spotlight keeps `MediaSnipEditor` and `MediaClipEditor`, and an "Open in Studio" pill appears beside them. The spec's removal list waits until Austen has used Studio and says it covers them, because the clip editor's named, tagged multi-clip queue has no Studio equivalent yet.
- **Popover menus stay:** the More actions menu, the keyframe clip actions menu and the curve picker. They are action menus, not data selectors. Revisit if Austen objects.
- **Install route:** vendored tarball, as tka does and as Ringmaster already does for media-manager, phone-sign-in and undo: `ringmaster/vendor/austencloud-video-editor-0.1.1.tgz`. The alias loop and the old `video-editor` branch (3 commits, 575 behind main) are retired; the work starts from main on `codex/ringmaster-studio`.
- **Preview cache:** none for now. The host default plays original files, and Ringmaster's library videos already have playback copies.

## Task 1: package host additions (shared-packages worktree)

- `host.ts`: `savedPlace?: string`, the words the draft status uses for where saves land. The default stays "Saved to this computer" with `onSaveDraft`, else "Saved in this browser".
- `PostDraftStatus.svelte` takes `place: string`; the workspace passes `host.savedPlace ?? (onSaveDraft ? ... : ...)`.
- Bump to 0.1.1, `npm run check`, `npx vitest run`, build, `pnpm pack` into `E:/worktrees/cirque-aflame/studio/ringmaster/vendor/`.

## Task 2: Ringmaster worktree and install

- `git -c core.autocrlf=false worktree add E:/worktrees/cirque-aflame/studio -b codex/ringmaster-studio main`, then `git config --worktree core.autocrlf false`.
- `ringmaster/package.json`: `"@austencloud/video-editor": "file:vendor/austencloud-video-editor-0.1.1.tgz"`.
- `npm install --package-lock-only`, then inspect the lock diff: only the editor and its new dependencies (dexie, h264-mp4-encoder, realtime-bpm-analyzer, wavesurfer.js) may appear; no `"link": true`, no hoist bumps. Then `npm ci` in the worktree so it has its own `node_modules` (no junction into the primary).
- `vite.config.ts`: `optimizeDeps.exclude` gains the editor; `resolve.dedupe` gains `mediabunny`.
- `hooks.server.ts`: `worker-src 'self' blob:`.

## Task 3: Ringmaster data layer

- `packages/shared/src/schemas/video-projects.ts`: the `videoProjects` doc: `title`, `project` (the editor's project, validated by the package schema when it loads), `revision`, `sourceMediaIds`, `exportMediaIds`, `createdBy`, `createdAt`, `updatedAt`. Register the collection name.
- `ringmaster/src/lib/services/video-projects.svelte.ts`:
  - `videoProjectsStore`: live list ordered by `updatedAt`, `create(title, source?)` (Firestore auto id; a source library video seeds the project's first clip), `rename`, `remove`.
  - `createVideoProjectSync(doc)` modeled on tka's `createFeatureVideoSync`: a device buffer (createDeviceStore keyed by project id) so a reload before the cloud save loses nothing; `save(project)` settles, then writes in a transaction against the revision it started from; a newer revision (from `onSnapshot` or a refused save) loads into the editor with `adoptSaved(..., { evenIfOlder: true })` as an undo step; `connect(editor, onReplaced)` for the host's `sync`.
- `ringmaster/src/lib/services/video-editor-media-library.ts`: `MediaLibrary` over `mediaItems` videos (playback copy when present, else the original), newest first; `requestFor` routes Firebase Storage originals through `/api/r2/proxy` and asks R2 with `cache: "no-store"`.
- Tests: the sync (save, conflict adopts the newer copy, buffer survives a reload), the library mapping, the schema.

## Task 4: routes and entry points

- `/studio`: one screen, project boxes (EntityCard, kind `videoProject`, opening `/studio/<id>`), a "New project" pill, the list panning inside its own area.
- `/studio/[id]`: the editor full screen; host `{ ownerId: uid, store: sync.store, mediaLibrary, notify, savedPlace: "Saved to Ringmaster", now }`, `sync`, `onSaveDraft = sync.save`, `onExported` uploads the file through `uploadMediaFileAdvanced`, then sets tags and event links from the project's source videos, a thumbnail and `studioProjectId`, and records the export on the project. A header with Back, the title, the save status and Export, through `providePostEditorHeader`.
- Spotlight: an "Open in Studio" pill for videos that creates a project seeded with the video and navigates there.
- Navigation: a "Studio" section under Media.
- Route morph: the project box carries `data-record="videoProject:<id>"`, the editor header `data-record-target`.

## Task 5: verification and delivery

- Gates: `npm run check` and `npm test` in ringmaster, `npm run build`, the package gates from Task 1.
- Dev server from the worktree on a free port with its own `node_modules`. Signed-in proof needs Austen's sign-in approval on his phone. Exit criteria: open a project, add a library video, trim, add a keyframe, add music, export. The export writes a real `mediaItems` doc and an R2 file in production, so it waits for his one yes.
- One review of the whole step, then integrate into cirque-aflame local main with the primary's `npm install` (lock already committed), and report.
