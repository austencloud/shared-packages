import { describe, expect, it } from "vitest";
import * as icons from "../src/ui/kit/icons.js";

describe("icon table", () => {
	const entries = Object.entries(icons);

	// 84 from the editor UI, plus the kit copies' faCircleInfo, faGift, faTasks and faTrash.
	it("holds the 92 icons the editor UI and the kit use", () => {
		expect(entries).toHaveLength(92);
	});

	it("holds only solid icon definitions", () => {
		for (const [name, definition] of entries) {
			expect(name).toMatch(/^fa[A-Z]/);
			expect(definition.prefix).toBe("fas");
			expect(definition.icon).toHaveLength(5);
		}
	});
});
