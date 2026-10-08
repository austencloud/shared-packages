/**
 * Spawns the spike worker. The URL points at the built .js beside this
 * module, which Vite rewrites into a worker chunk in dev and in builds.
 */
export function createSpikeWorker(): Worker {
	return new Worker(new URL("./spike.worker.js", import.meta.url), { type: "module" });
}

export type { SpikeWorkerPing, SpikeWorkerPong } from "./messages.js";
