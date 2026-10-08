export interface SpikeWorkerPing {
	type: "ping";
	seconds: number;
}

export interface SpikeWorkerPong {
	type: "pong";
	timecode: string;
	/** True when the worker could import mediabunny, the first runtime dependency. */
	mediabunny: boolean;
}
