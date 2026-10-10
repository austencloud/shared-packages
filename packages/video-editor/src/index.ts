export { default as VideoEditorSpike } from "./ui/VideoEditorSpike.svelte";
export { createSpikeWorker } from "./workers/index.js";
export type { SpikeWorkerPing, SpikeWorkerPong } from "./workers/messages.js";
export { runtimeProbe } from "./runtime-probe.js";
export { VIDEO_EDITOR_VERSION, formatTimecode } from "./core/index.js";
export type * from "./plugin.js";
export type { CompositionSourceBinding, CompositionSourceStatus } from "./state/source-binding.js";
export type {
	EditorHaptic,
	EditorNotify,
	EditorShortcuts,
	LibraryTake,
	MediaLibrary,
	VideoEditorHost,
} from "./host.js";
export {
	createUnsupportedPreviewCache,
	createWindowShortcuts,
	resolveServices,
	type EditorServices,
} from "./host-defaults.js";
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
export { provideStrings, useStrings } from "./strings/context.js";
export {
	createDeviceStore,
	deviceStoreKeys,
	type DeviceStore,
	type DeviceStoreKeys,
	type DeviceStoreOptions,
} from "./store/device-store.js";
export { createHistoryStorage, type HistoryStorageOptions } from "./store/history-storage.js";
export {
	createVideoEditorState,
	type LibraryTakeSource,
	type PostEdit,
	type StateExtension,
	type VideoEditorState,
	type VideoEditorStateOptions,
} from "./state/video-editor-state.svelte.js";
export { createVideoPreviews } from "./state/video-previews.svelte.js";
export { createTabSync, type TabSync } from "./state/tab-sync.js";
export { provideEditorUi, useEditorUi, type EditorUi } from "./ui/editor-context.js";
