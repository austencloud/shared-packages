// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as render from "../src/render/index.js";

// The Cloudflare host evaluates the render entry on the server, where there is no DOM and no
// IndexedDB. Importing it must not touch either; this file runs without jsdom to prove it.
describe("render entry in a node environment", () => {
	it("is running without a DOM", () => {
		expect(typeof window).toBe("undefined");
		expect(typeof document).toBe("undefined");
		expect(typeof indexedDB).toBe("undefined");
	});

	it("evaluates and exports its API", () => {
		expect(Object.keys(render).length).toBeGreaterThan(50);
	});

	it("answers a missing device-cache key with null instead of throwing", async () => {
		// PreviewVideoLocalStore.read(key: string): Promise<PreviewVideoCopy | null>
		const store = new render.PreviewVideoLocalStore();
		await expect(store.read("never-written")).resolves.toBeNull();
	});
});
