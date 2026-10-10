import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

// The tests written against tka's canvas stand-in (document.createElement("canvas")
// returns a mock with a 2d context). Only they get it.
const CANVAS = ["test/CanvasFrameCapturer.test.ts", "test/preview-video-frame-recovery.test.ts"];
// Rune tests: a test whose name has .svelte. may use runes, and it may import .svelte.ts modules.
const STATE = "test/**/*.svelte.test.ts";
// Component tests run in headless chromium: test/browser/<component or module>.svelte.test.ts,
// with their probe components in test/browser/fixtures/. A real browser has canvas and
// Blob.arrayBuffer, so this project needs no setup file. Nothing else runs here (the node
// docblock test in render-entry-node.test.ts must never run in a browser).
const BROWSER = "test/browser/**/*.svelte.test.ts";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "jsdom",
					include: ["test/**/*.test.ts"],
					exclude: [...configDefaults.exclude, ...CANVAS, STATE, BROWSER],
					setupFiles: ["./test/setup/blob.ts"],
				},
			},
			{
				test: {
					name: "canvas",
					environment: "jsdom",
					include: CANVAS,
					setupFiles: ["./test/setup/blob.ts", "./test/setup/canvas.ts"],
				},
			},
			{
				plugins: [svelte()],
				resolve: { conditions: ["browser"] },
				test: {
					name: "state",
					environment: "jsdom",
					include: [STATE],
					exclude: [...configDefaults.exclude, BROWSER],
					setupFiles: ["./test/setup/blob.ts"],
				},
			},
			{
				plugins: [svelte()],
				resolve: { conditions: ["browser"] },
				test: {
					name: "browser",
					include: [BROWSER],
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
