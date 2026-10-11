import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { EN } from "../../src/strings/en.js";
import VideoEditorHarness from "./fixtures/VideoEditorHarness.svelte";

describe("VideoEditor with no plugin", () => {
	it("adds text, edits it, undoes, saves and reopens", async () => {
		const ownerId = `owner-${Date.now()}`;
		const first = render(VideoEditorHarness, { ownerId });
		await page.getByRole("button", { name: EN.post_editor_add, exact: true }).click();
		await page.getByRole("button", { name: EN.post_editor_kind_text, exact: true }).click();
		// The add panel's Text row is still leaving while the new text's tools
		// arrive, so the Text tool is found in the tool row.
		await page
			.getByRole("group", { name: EN.post_editor_tools, exact: true })
			.getByRole("button", { name: EN.post_editor_kind_text, exact: true })
			.click();
		await page.getByRole("textbox").first().fill("Hello");
		await expect.element(page.getByText("Hello").first()).toBeVisible();
		await page.getByRole("button", { name: EN.post_editor_undo, exact: true }).click();
		await expect.element(page.getByText("Hello")).not.toBeInTheDocument();
		await page.getByRole("button", { name: EN.post_editor_redo, exact: true }).click();
		await expect.element(page.getByText("Hello").first()).toBeVisible();
		// With no page header there is no Save button: every edit saves itself
		// to the device store, and the reopen below reads that save.
		first.unmount();
		render(VideoEditorHarness, { ownerId });
		await expect.element(page.getByText("Hello").first()).toBeVisible();
	});

	it("shows no plugin entry in the add panel", async () => {
		render(VideoEditorHarness, { ownerId: `owner-${Date.now()}-b` });
		await page.getByRole("button", { name: EN.post_editor_add, exact: true }).click();
		await expect
			.element(page.getByRole("button", { name: EN.post_editor_kind_text, exact: true }))
			.toBeVisible();
		// No moved file names an animation kind, so EN has no key for it.
		await expect.element(page.getByRole("button", { name: "Animation" })).not.toBeInTheDocument();
	});

	it("mounts with no preview cache and shows no library section", async () => {
		render(VideoEditorHarness, { ownerId: `owner-${Date.now()}-c` });
		await page.getByRole("button", { name: EN.post_editor_videos, exact: true }).click();
		await expect.element(page.getByText(EN.share_studio_choose_device_video)).toBeVisible();
		await expect
			.element(page.getByText(EN.share_studio_finding_saved_videos))
			.not.toBeInTheDocument();
		await expect.element(page.getByText(EN.share_studio_saved_videos)).not.toBeInTheDocument();
	});
});
