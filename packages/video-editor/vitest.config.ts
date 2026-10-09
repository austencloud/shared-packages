import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		// Kept for parity with tka's config; no test relies on it today.
		globals: true,
		include: ["test/**/*.test.ts"],
	},
});
