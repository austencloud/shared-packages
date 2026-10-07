# @austencloud/video-editor

Keyframe video editor for Svelte 5 apps. Extracted from tka-platform's Post Studio so tka-platform and Ringmaster run the same editor.

Status: step 0 spike. The package ships a placeholder `VideoEditor` component, a `./core` entry with `formatTimecode`, and a module worker that proves the packaging works in a host app. The design lives in `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md`.

## Entry points

- `@austencloud/video-editor`: `VideoEditor` component, `createPreviewWorker`, `runtimeProbe`
- `@austencloud/video-editor/core`: `formatTimecode`, `VIDEO_EDITOR_VERSION`
- `@austencloud/video-editor/css/video-editor-tokens.css`: `--ve-*` tokens with dark fallbacks, mapped to `--theme-*` when the host defines them

## Host requirements

- `resolve.dedupe: ["svelte", "mediabunny"]` in the host's Vite config, so the package shares the host's copies
- `optimizeDeps.exclude: ["@austencloud/video-editor"]`, because the package ships `.svelte` files and a module worker that the host's Vite compiles
