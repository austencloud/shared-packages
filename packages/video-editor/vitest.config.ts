import { svelte } from "@sveltejs/vite-plugin-svelte";
import { configDefaults, defineConfig } from "vitest/config";

// The tests written against tka's canvas stand-in (document.createElement("canvas")
// returns a mock with a 2d context). Only they get it.
const CANVAS = ["test/CanvasFrameCapturer.test.ts", "test/preview-video-frame-recovery.test.ts"];
// Rune tests: a test whose name has .svelte. may use runes, and it may import .svelte.ts modules.
const STATE = "test/**/*.svelte.test.ts";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "jsdom",
					include: ["test/**/*.test.ts"],
					exclude: [...configDefaults.exclude, ...CANVAS, STATE],
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
					setupFiles: ["./test/setup/blob.ts"],
				},
			},
		],
	},
});
