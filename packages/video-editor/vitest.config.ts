import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		// As in tka's vitest config, so tests moved from tka keep their global describe and it.
		globals: true,
		include: ["test/**/*.test.ts"],
	},
});
