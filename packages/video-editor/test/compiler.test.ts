import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	POST_BOX,
	compilePostProject,
	createEmptyPostProject,
	normalizeProject,
	type PostProject,
	type VideoEditorPlugin,
} from "../src/core/index.js";

function item(id: string, kind: string, start: number, duration: number, extra = {}) {
	const base = { id, kind, start, duration, box: { ...POST_BOX.full }, opacity: 1 };
	return { ...base, fadeIn: 0, fadeOut: 0, anchor: null, fill: false, ...extra };
}

/** One image on the main track and a text over it, with `overlay` items after the text. */
function project(overlay: object[] = [], plugin?: VideoEditorPlugin): PostProject {
	const empty = createEmptyPostProject({ now: 0 });
	const picture = {
		id: "pic",
		label: "Picture",
		ref: { kind: "local", name: "a.png", size: 1, lastModified: 0 },
	};
	const main = { ...empty.tracks[0]!, items: [item("i1", "image", 0, 2, { imageId: "pic" })] };
	const text = item("t1", "text", 0, 1, { text: "Hello", size: "m" });
	const over = { id: "o1", hidden: false, locked: false, items: [text, ...overlay] };
	const stored = { ...empty, images: [picture], tracks: [main, over] };
	return normalizeProject(stored as unknown as PostProject, plugin);
}

const CORE_KEYS = ["preset", "durationSeconds", "takeIds", "imageIds", "videoSegments", "texts"];

describe("compilePostProject", () => {
	it("returns the core outputs in order, with the default preset id", () => {
		const compiled = compilePostProject(project(), { now: 0 });
		expect(Object.keys(compiled!)).toEqual(CORE_KEYS);
		expect(compiled!.preset.id).toBe("post-project");
		expect(compiled!.durationSeconds).toBe(2);
		expect(compiled!.imageIds).toEqual(["pic"]);
		expect(compiled!.texts.map((text) => text.itemId)).toEqual(["t1"]);
	});

	it("uses the context's preset id", () => {
		expect(compilePostProject(project(), { now: 0, presetId: "x" })!.preset.id).toBe("x");
	});

	it("compiles a plugin kind through its definition and appends the plugin's outputs", () => {
		const plugin: VideoEditorPlugin = {
			id: "fake",
			itemKinds: [
				{
					kind: "sticker",
					schema: z.object({ kind: z.literal("sticker") }),
					label: "Sticker",
					defaultBox: () => ({ ...POST_BOX.full }),
					compile: (_item, env) => (env.addOutput("extra", 1), true),
				},
			],
			compileOutputs: { extra: () => [] },
		};
		const stored = project([item("s1", "sticker", 0, 5)], plugin);
		const compiled: Record<string, unknown> = { ...compilePostProject(stored, { now: 0 }, plugin) };
		expect(Object.keys(compiled)).toEqual([...CORE_KEYS, "extra"]);
		expect(compiled.extra).toEqual([1]);
		expect(compiled.durationSeconds).toBe(5);
	});

	it("skips a kind with no definition without extending the duration", () => {
		const compiled = compilePostProject(project([item("m1", "mystery", 0, 10)]), { now: 0 });
		expect(compiled!.durationSeconds).toBe(2);
		expect(compiled!.preset.clips.map((clip) => clip.id)).toEqual(["i1", "t1"]);
	});
});
