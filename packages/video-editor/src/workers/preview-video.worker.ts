import { Input } from "mediabunny";
import { formatTimecode } from "../core/index.js";
import type { PreviewWorkerPing, PreviewWorkerPong } from "./messages.js";

// Spike worker: answers a ping with a formatted timecode. It imports a package
// module and a dependency on purpose, so the proof covers both resolutions
// from inside a worker that a host app bundles. The real preview-video worker
// replaces this body in step 1.
addEventListener("message", (event: MessageEvent<PreviewWorkerPing>) => {
	if (event.data?.type !== "ping") return;
	const reply: PreviewWorkerPong = {
		type: "pong",
		timecode: formatTimecode(event.data.seconds),
		mediabunny: typeof Input === "function",
	};
	postMessage(reply);
});
