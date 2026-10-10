import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

describe("rune modules in package tests", () => {
	it("tracks $state through $derived", () => {
		let count = $state(1);
		const double = $derived(count * 2);
		// Read the derived value through a function: a direct read in the same scope would capture
		// its first value and make the compiler warn (state_referenced_locally).
		const doubled = () => double;
		expect(doubled()).toBe(2);
		count = 3;
		flushSync();
		expect(doubled()).toBe(6);
	});
});
