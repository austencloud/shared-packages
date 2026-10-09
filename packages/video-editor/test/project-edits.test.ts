import { describe, expect, it, vi } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import {
	finish,
	isCrossfadeVisual,
	newItemOfKind,
	relinkTake,
	updateItem,
} from "../src/core/edit/project-edits.js";
import type { ItemKindDefinition, VideoEditorPlugin } from "../src/plugin.js";
import plain from "./fixtures/plain.project.json";

const plugin = (fields: Partial<VideoEditorPlugin>): VideoEditorPlugin => ({
	id: "collide",
	itemKinds: [],
	...fields,
});

const project = () => normalizeProject(createProjectSchema().parse(plain));
const textId = () =>
	project()
		.tracks.flatMap((track) => track.items)
		.find((item) => item.kind === "text")!.id;

describe("edit engine without a plugin", () => {
	it("refuses to finish a project with plugin data when the context has no plugin", () => {
		const withPluginField = { ...project(), sequenceId: "x" } as ReturnType<typeof project>;
		expect(() => finish(withPluginField, { now: 1 })).toThrow(/edit context has no plugin/);
	});

	it("edits a plain project with the core alone", () => {
		const next = updateItem(project(), textId(), { text: "Hello" }, { now: 2 });
		const item = next.tracks.flatMap((track) => track.items).find((entry) => entry.id === textId());
		expect(item).toMatchObject({ kind: "text", text: "Hello" });
	});
});

describe("edit hooks", () => {
	it("hands the plugin's patch fields to patchItem after the core fields", () => {
		const patchItem = vi.fn();
		const editHooks = { patchItem };
		updateItem(project(), textId(), { text: "Hi" }, { now: 2, plugin: plugin({ editHooks }) });
		expect(patchItem).toHaveBeenCalledOnce();
		const [item, next, patch] = patchItem.mock.calls[0]!;
		expect(item).toMatchObject({ id: textId() });
		expect(next).toMatchObject({ text: "Hi" });
		expect(patch).toEqual({ text: "Hi" });
	});

	it("tells takeMediaChanged about a relinked take", () => {
		const base = project();
		const take = base.takes[0]!;
		const takeMediaChanged = vi.fn((p) => p);
		relinkTake(
			base,
			take.id,
			{ ref: take.ref, takeKey: "relinked", durationSeconds: take.durationSeconds },
			{ now: 3, plugin: plugin({ editHooks: { takeMediaChanged } }) },
		);
		expect(takeMediaChanged).toHaveBeenCalledWith(
			expect.anything(),
			{
				kind: "relink",
				takeId: take.id,
				ref: take.ref,
				takeKey: "relinked",
				durationSeconds: take.durationSeconds,
			},
			expect.objectContaining({ now: 3 }),
		);
	});

	it("builds a plugin kind through its create member", () => {
		const sticker = {
			kind: "sticker",
			create: (base: object) => ({ ...base, kind: "sticker", shiny: true }),
		} as unknown as ItemKindDefinition;
		const item = newItemOfKind(
			{ kind: "sticker", at: 0 } as never,
			{ id: "s1" } as never,
			plugin({ itemKinds: [sticker] }),
		);
		expect(item).toMatchObject({ id: "s1", kind: "sticker", shiny: true });
	});

	it("crossfades a plugin kind only when it says transitionVisual", () => {
		const still = { kind: "still", transitionVisual: true } as unknown as ItemKindDefinition;
		const label = { kind: "label" } as unknown as ItemKindDefinition;
		const p = plugin({ itemKinds: [still, label] });
		expect(isCrossfadeVisual({ kind: "still" } as never, p)).toBe(true);
		expect(isCrossfadeVisual({ kind: "label" } as never, p)).toBe(false);
		expect(isCrossfadeVisual({ kind: "card" } as never, undefined)).toBe(true);
	});
});
