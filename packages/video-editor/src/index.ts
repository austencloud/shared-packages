export { default as VideoEditor } from "./ui/VideoEditor.svelte";
export { createSpikeWorker } from "./workers/index.js";
export type { SpikeWorkerPing, SpikeWorkerPong } from "./workers/messages.js";
export { runtimeProbe } from "./runtime-probe.js";
export { VIDEO_EDITOR_VERSION, formatTimecode } from "./core/index.js";
