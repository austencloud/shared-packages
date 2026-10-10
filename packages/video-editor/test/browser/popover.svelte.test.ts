import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import PopoverHarness from "./fixtures/PopoverHarness.svelte";

describe("Popover", () => {
	it("opens above its anchor and closes on an outside press", async () => {
		render(PopoverHarness);
		await page.getByRole("button", { name: "Zoom" }).click();
		const panel = page.getByRole("dialog", { name: "Zoom options" });
		await expect.element(panel).toBeVisible();
		const anchorTop = page
			.getByRole("button", { name: "Zoom" })
			.element()
			.getBoundingClientRect().top;
		expect(panel.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(anchorTop);
		await page.getByRole("button", { name: "Outside" }).click();
		await expect.element(panel).not.toBeInTheDocument();
	});

	it("closes on Escape and gives focus back to its anchor", async () => {
		render(PopoverHarness);
		await page.getByRole("button", { name: "Zoom" }).click();
		await userEvent.keyboard("{Escape}");
		await expect
			.element(page.getByRole("dialog", { name: "Zoom options" }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Zoom" })).toHaveFocus();
	});
});
