# @austencloud/video-editor

Keyframe video editor for Svelte 5 apps, being extracted from tka-platform's Post Studio so tka-platform and Ringmaster run the same editor.

Status: step 0 spike, private. The package ships a placeholder `VideoEditor` component, a `./core` entry with `formatTimecode`, and a module worker that proves the packaging works in a host app. The design lives in `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md`.

## Entry points

- `@austencloud/video-editor`: `VideoEditor`, `createPreviewWorker`, `runtimeProbe`, `formatTimecode`, `VIDEO_EDITOR_VERSION`
- `@austencloud/video-editor/core`: `formatTimecode`, `VIDEO_EDITOR_VERSION`
- `@austencloud/video-editor/css/video-editor-tokens.css`: `--ve-*` tokens with dark fallbacks, mapped to `--theme-*` when the host defines them

## Host requirements

- `svelte` and `mediabunny` are peer dependencies. Add `resolve.dedupe: ["svelte", "mediabunny"]` to the host's Vite config so the package runs on the host's copies; a second Svelte runtime breaks reactivity silently.
- `optimizeDeps.exclude: ["@austencloud/video-editor"]` once the package is installed from npm. The worker is spawned with `new URL("./preview-video.worker.js", import.meta.url)`, and pre-bundling would move the importing module into `.vite/deps`, away from the worker file. While a host aliases the package to a path outside `node_modules` (extraction steps 0 to 3), Vite treats it as app source and the exclude has no effect.
