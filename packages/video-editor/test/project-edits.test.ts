import { describe, expect, it, vi } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import {
	finish,
	isCrossfadeVisual,
	newItemOfKind,
	relinkTake,
	replaceTakeMedia,
	splitItemAt,
	trimItem,
	updateItem,
} from "../src/core/edit/project-edits.js";
import type { PostProject } from "../src/core/project/item-kinds.js";
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

	it("tells takeMediaChanged about a replaced take, and keeps what the hook returns", () => {
		const base = project();
		const take = base.takes[0]!;
		const marked = (p: ReturnType<typeof project>) => ({
			...p,
			takes: p.takes.map((entry) => (entry.id === take.id ? { ...entry, label: "marked" } : entry)),
		});
		const takeMediaChanged = vi.fn(marked);
		const next = replaceTakeMedia(
			base,
			take.id,
			{ ref: take.ref, takeKey: "replaced", durationSeconds: 30, offsetSeconds: 4 },
			{ now: 3, plugin: plugin({ editHooks: { takeMediaChanged } }) },
		);
		expect(takeMediaChanged).toHaveBeenCalledWith(
			expect.anything(),
			{
				kind: "replace",
				takeId: take.id,
				offsetSeconds: 4,
				takeKey: "replaced",
				durationSeconds: 30,
			},
			expect.objectContaining({ now: 3 }),
		);
		// The hook sees the project with the take already pointed at the longer copy.
		const seen = takeMediaChanged.mock.calls[0]![0];
		expect(seen.takes[0]).toMatchObject({ takeKey: "replaced", durationSeconds: 30 });
		// What it returns is what the edit finishes, so its mark survives into the result.
		expect(next.takes[0]).toMatchObject({ label: "marked", takeKey: "replaced" });
		expect(next.updatedAt).toBe(3);
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

describe("a plugin kind that plays a source of its own", () => {
	// A reel plays a span of its own `length` seconds, as a clip plays its take.
	const reel = {
		kind: "reel",
		mainTrack: true,
		sourceLength: (item: { length: number }) => item.length,
	} as unknown as ItemKindDefinition;
	const p = plugin({ itemKinds: [reel] });
	const withReel = (fields: object, track = 0) => {
		const base = project();
		const card = base.tracks[0]!.items.find((item) => item.kind === "card")!;
		const item = {
			...card,
			id: "r1",
			kind: "reel",
			start: 20,
			length: 6,
			sourceIn: 0,
			sourceOut: 6,
			speed: 1,
			...fields,
		};
		const tracks = base.tracks.map((entry, index) =>
			index === track ? { ...entry, items: [...entry.items, item] } : entry,
		);
		return normalizeProject({ ...base, tracks } as PostProject, p);
	};
	const reelOf = (next: PostProject) =>
		next.tracks.flatMap((track) => track.items).find((item) => item.id === "r1") as unknown as {
			start: number;
			duration: number;
			sourceIn: number;
			sourceOut: number;
			fill?: boolean;
		};

	it("sizes the item from its span and speed, inside the source", () => {
		const reelItem = reelOf(withReel({ sourceIn: 1, sourceOut: 9, speed: 2 }));
		expect(reelItem).toMatchObject({ sourceIn: 1, sourceOut: 6 });
		expect(reelItem.duration).toBeCloseTo(2.5);
	});

	it("never fills as an overlay", () => {
		expect(reelOf(withReel({ fill: true }, 1)).duration).toBeCloseTo(6);
	});

	it("trims into its source and no further than its end", () => {
		const start = withReel({});
		const end = reelOf(start).start + reelOf(start).duration;
		const longer = reelOf(trimItem(start, "r1", "end", end + 5, { now: 2, plugin: p }));
		expect(longer).toMatchObject({ sourceOut: 6 });
		expect(longer.duration).toBeCloseTo(6);
		const shorter = reelOf(trimItem(start, "r1", "start", reelOf(start).start + 2, { now: 2, plugin: p }));
		expect(shorter).toMatchObject({ sourceIn: 2, sourceOut: 6 });
		expect(shorter.duration).toBeCloseTo(4);
	});

	it("splits into two spans of the same source", () => {
		const start = withReel({});
		const split = splitItemAt(start, "r1", reelOf(start).start + 2, { now: 2, plugin: p })!;
		const pieces = split.project.tracks
			.flatMap((track) => track.items)
			.filter((item) => (item.kind as string) === "reel") as unknown as { sourceIn: number; sourceOut: number }[];
		expect(pieces.map((piece) => [piece.sourceIn, piece.sourceOut])).toEqual([
			[0, 2],
			[2, 6],
		]);
	});
});
