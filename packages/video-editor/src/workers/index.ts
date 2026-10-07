/**
 * Spawns the preview worker. The URL points at the built .js beside this
 * module, which Vite rewrites into a worker chunk in dev and in builds.
 */
export function createPreviewWorker(): Worker {
	return new Worker(new URL("./preview-video.worker.js", import.meta.url), { type: "module" });
}

export type { PreviewWorkerPing, PreviewWorkerPong } from "./messages.js";
