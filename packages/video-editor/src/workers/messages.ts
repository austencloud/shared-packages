export interface PreviewWorkerPing {
	type: "ping";
	seconds: number;
}

export interface PreviewWorkerPong {
	type: "pong";
	timecode: string;
	/** True when the worker could import mediabunny, the first runtime dependency. */
	mediabunny: boolean;
}
