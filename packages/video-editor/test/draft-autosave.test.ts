import { describe, expect, it, vi } from "vitest";
import { createEmptyPostProject } from "../src/core/index.js";
import { createDraftAutosave, shouldSubmitDraft } from "../src/state/draft-autosave.js";

// The cases of tka's tests/unit/media-composition/post-draft-storage.test.ts that cover
// createPostDraftAutosave and shouldSubmitPostDraft, which these functions copy.

function draft(now: number) {
	return createEmptyPostProject({ now }, { sequenceId: "draft" });
}

describe("draft autosave", () => {
	it("skips only an empty mount, while keeping projects with takes or items", () => {
		const empty = draft(1);
		expect(shouldSubmitDraft(empty, 0)).toBe(false);
		expect(shouldSubmitDraft(empty, 1)).toBe(true);
		expect(shouldSubmitDraft({ ...empty, takes: [{ id: "take" }] } as typeof empty, 0)).toBe(true);
		expect(
			shouldSubmitDraft(
				{
					...empty,
					tracks: [{ ...empty.tracks[0]!, items: [{ id: "item" }] }],
				} as typeof empty,
				0,
			),
		).toBe(true);
	});
	it("serializes edits and never reports saved while a newer edit is waiting", async () => {
		const releases: Array<() => void> = [];
		const save = vi.fn(
			(_project: ReturnType<typeof draft>) =>
				new Promise<void>((resolve) => releases.push(resolve)),
		);
		const status = vi.fn();
		const autosave = createDraftAutosave(save, status);
		autosave.submit(draft(1));
		autosave.submit(draft(2));
		autosave.submit(draft(3));
		expect(save).toHaveBeenCalledTimes(1);
		releases[0]!();
		await Promise.resolve();
		expect(save.mock.calls[1]?.[0]).toEqual(draft(3));
		expect(status).not.toHaveBeenCalledWith(false, null);
		releases[1]!();
		await Promise.resolve();
		expect(status).toHaveBeenLastCalledWith(false, null);
	});

	it("reports a failed write and retries the intact latest draft", async () => {
		const save = vi
			.fn<(project: ReturnType<typeof draft>) => Promise<void>>()
			.mockRejectedValueOnce(new Error("Disk full"))
			.mockResolvedValueOnce(undefined);
		const status = vi.fn();
		const autosave = createDraftAutosave(save, status);
		autosave.submit(draft(2));
		await Promise.resolve();
		expect(status).toHaveBeenLastCalledWith(false, "Disk full");
		autosave.retry();
		await Promise.resolve();
		expect(save).toHaveBeenLastCalledWith(draft(2));
		expect(status).toHaveBeenLastCalledWith(false, null);
	});
});
