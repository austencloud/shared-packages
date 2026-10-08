import { describe, expect, it } from "vitest";
import { formatTimecode } from "../src/core/index.js";

describe("package test runner", () => {
	it("runs TypeScript tests under jsdom", () => {
		expect(typeof document.createElement).toBe("function");
		expect(formatTimecode(83.5)).toBe("1:23.500");
	});
});
