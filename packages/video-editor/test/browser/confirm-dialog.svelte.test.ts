import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import ConfirmHarness from "./fixtures/ConfirmHarness.svelte";

describe("ConfirmDialog", () => {
	it("confirms from its confirm button", async () => {
		render(ConfirmHarness);
		const dialog = page.getByRole("dialog", { name: "Delete clip?" });
		await expect.element(dialog).toBeVisible();
		await page.getByRole("button", { name: "Continue" }).click();
		await expect.element(page.getByTestId("result")).toHaveTextContent("confirmed");
	});

	it("cancels on Escape", async () => {
		render(ConfirmHarness);
		await expect.element(page.getByRole("dialog", { name: "Delete clip?" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByTestId("result")).toHaveTextContent("cancelled");
	});

	it("keeps Tab inside the dialog", async () => {
		render(ConfirmHarness);
		const dialog = page.getByRole("dialog", { name: "Delete clip?" });
		await expect.element(dialog).toBeVisible();
		const panel = dialog.element();
		// The harness dialog has two buttons, cancel and confirm: Tab through them and once more.
		for (let press = 0; press < 3; press++) {
			await userEvent.keyboard("{Tab}");
			expect(panel.contains(document.activeElement)).toBe(true);
		}
	});
});
