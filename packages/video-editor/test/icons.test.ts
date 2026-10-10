import { describe, expect, it } from "vitest";
import * as icons from "../src/ui/kit/icons.js";

describe("icon table", () => {
	const entries = Object.entries(icons);

	it("holds the 84 icons the editor UI uses", () => {
		expect(entries).toHaveLength(84);
	});

	it("holds only solid icon definitions", () => {
		for (const [name, definition] of entries) {
			expect(name).toMatch(/^fa[A-Z]/);
			expect(definition.prefix).toBe("fas");
			expect(definition.icon).toHaveLength(5);
		}
	});
});
