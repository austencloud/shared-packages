# @austencloud/video-editor

Keyframe video editor for Svelte 5 apps: the project schema, a frame compositor, WebCodecs export and the editor UI. tka-platform's Post Studio and Ringmaster's Studio both run it.

## Install

```sh
npm install @austencloud/video-editor mediabunny
```

`svelte` (^5) and `mediabunny` (^1.44) are peer dependencies.

## Entry points

- `@austencloud/video-editor`: the host contract (`VideoEditorHost`, `EditorNotify`, `MediaLibrary`, `LibraryTake`, `KeptExport`), the device store (`createDeviceStore`, `deviceStoreKeys`), history storage and the string helpers.
- `@austencloud/video-editor/core`: the project schema and model (`PostProject`, `PreparedPreviewVideo`, `formatTimecode`), with no DOM.
- `@austencloud/video-editor/render`: the frame compositor, painters, preview clock, audio sync and the preview video cache (`IPreviewVideoCache`).
- `@austencloud/video-editor/encoder`: frame capture and the WebCodecs video encoder.
- `@austencloud/video-editor/ui`: the `VideoEditor` component, `providePostEditorHeader` and the UI kit.
- `@austencloud/video-editor/strings`: the English string table (`EN`), `formatString` and `translatorFor`.
- `@austencloud/video-editor/icons`: the `Icon` component with inline Font Awesome solid data.
- `@austencloud/video-editor/css/video-editor-tokens.css`: `--ve-*` tokens with dark fallbacks, mapped to `--theme-*` when the host defines them.

## Usage

```svelte
<script lang="ts">
	import '@austencloud/video-editor/css/video-editor-tokens.css';
	import type { VideoEditorHost } from '@austencloud/video-editor';
	import { VideoEditor } from '@austencloud/video-editor/ui';

	const host: VideoEditorHost = { ownerId: 'user-123' };
</script>

<VideoEditor {host} stateOptions={{ subjectId: 'project-1' }} />
```

`ownerId` is the only required host field. The rest are optional: a project `store` (default: `createDeviceStore()`, which keeps projects on the device), a `mediaLibrary` for adding videos, a `translate` function, a `previewCache`, `notify`, `sync`, `shortcuts` and `confirmations`. `stateOptions` takes the project's `subjectId`, an optional `initialProject` and a `libraryTake` lookup; `onSaveDraft` receives the project when the user saves. Without a `plugin` every generic panel renders; tka-platform passes a plugin for its own tools.

## Host setup

In the host's Vite config:

- `resolve.dedupe: ['svelte', 'mediabunny']`, so the package runs on the host's copies. A second Svelte runtime breaks reactivity silently.
- `worker: { format: 'es' }`, because the encoder and render workers import their own chunks.
- `optimizeDeps.exclude: ['@austencloud/video-editor']`. Pre-bundling moves the module that spawns a worker into `.vite/deps`, away from the worker file.

The editor root is `display: contents`. Anything the host draws outside it, such as a portal, needs the `ve-portal` class to receive the `--ve-*` tokens.

## License

MIT
