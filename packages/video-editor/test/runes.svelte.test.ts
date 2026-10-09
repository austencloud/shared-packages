import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

describe("rune modules in package tests", () => {
	it("tracks $state through $derived", () => {
		let count = $state(1);
		const double = $derived(count * 2);
		expect(double).toBe(2);
		count = 3;
		flushSync();
		expect(double).toBe(6);
	});
});
