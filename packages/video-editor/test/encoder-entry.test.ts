import { describe, expect, it } from "vitest";
import * as encoder from "../src/encoder/index.js";
import * as workers from "../src/workers/index.js";
import { workerScope } from "../src/workers/worker-scope.js";

describe("encoder entry", () => {
	it("exports exactly the encoder, the capturer and the codec helpers", () => {
		// The value exports listed by dist/encoder/index.d.ts and the four modules it re-exports.
		expect(Object.keys(encoder).sort()).toEqual([
			"BackgroundVideoEncoder",
			"CanvasFrameCapturer",
			"selectCodec",
			"selectCodecAv1",
			"selectSupportedEncoderConfig",
		]);
	});

	it("leaks nothing from workers/", () => {
		const exported = Object.keys(encoder);
		// workers/index.ts exports the spike worker factory; worker-scope.ts is what the real workers use.
		const fromWorkers = [...Object.keys(workers), "workerScope"];
		expect(fromWorkers).toContain("createSpikeWorker");
		expect(typeof workerScope).toBe("object");
		for (const name of fromWorkers) expect(exported).not.toContain(name);
	});
});
