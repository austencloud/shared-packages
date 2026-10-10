import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import Icon from "../../src/ui/kit/Icon.svelte";
import { faCheck } from "../../src/ui/kit/icons.js";

describe("Icon", () => {
	it("draws the definition's path in the current colour, hidden from assistive tech", async () => {
		const screen = render(Icon, { icon: faCheck });
		const svg = screen.container.querySelector("svg");
		expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${faCheck.icon[0]} ${faCheck.icon[1]}`);
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
		expect(svg?.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
	});

	it("takes Font Awesome's box: 1.25em wide, 1em tall", async () => {
		const screen = render(Icon, { icon: faCheck });
		const svg = screen.container.querySelector("svg") as SVGElement;
		const fontSize = parseFloat(getComputedStyle(svg).fontSize);
		expect(svg.getBoundingClientRect().width).toBeCloseTo(fontSize * 1.25, 0);
		expect(svg.getBoundingClientRect().height).toBeCloseTo(fontSize, 0);
	});

	it("names itself when it is a control's only content", async () => {
		const screen = render(Icon, { icon: faCheck, label: "Done" });
		await expect.element(screen.getByRole("img", { name: "Done" })).toBeVisible();
	});
});
