import { describe, expect, it } from "vitest";
import {
	POST_BOX,
	createEmptyPostProject,
	normalizeProject,
	type PostProject,
	type VideoEditorPlugin,
} from "../src/core/index.js";

function item(id: string, kind: string, start: number, duration: number, extra = {}) {
	const base = { id, kind, start, duration, box: { ...POST_BOX.full }, opacity: 1 };
	return { ...base, fadeIn: 0, fadeOut: 0, anchor: null, fill: false, ...extra };
}

function laidOut(): PostProject {
	const empty = createEmptyPostProject({ now: 0 });
	const main = { ...empty.tracks[0]!, items: [item("c1", "card", 0, 2), item("t0", "text", 0, 1)] };
	const overlay = {
		id: "o1",
		hidden: false,
		locked: false,
		items: [
			item("i1", "image", 0, 2, { transitionOut: { type: "crossfade", duration: 0.5 } }),
			item("i2", "image", 1.6, 2),
			item("t1", "text", 0.5, 2),
		],
	};
	return normalizeProject({ ...empty, tracks: [main, overlay] } as unknown as PostProject);
}

const placement = (project: PostProject) =>
	project.tracks.map((track) => `${track.id}[${track.items.map((x) => `${x.id}@${x.start}`)}]`);

describe("normalizeProject with no plugin", () => {
	it("moves a text off the main track onto a new track", () => {
		const tracks = placement(laidOut());
		expect(tracks[0]).toBe("main[c1@0]");
		expect(tracks[2]).toBe("track-1[t0@0]");
	});

	it("bumps a text that overlaps the images up a track", () => {
		const tracks = placement(laidOut());
		expect(tracks[1]).toBe("o1[i1@0,i2@1.6]");
		expect(tracks[3]).toBe("track-2[t1@0.5]");
		expect(tracks).toHaveLength(4);
	});

	it("keeps a transition overlap between two images and names the incoming one", () => {
		const images = laidOut().tracks[1]!.items;
		expect(images[0]!.transitionOut).toMatchObject({ duration: 0.5, incomingId: "i2" });
	});

	it("returns the same project when a second pass changes nothing", () => {
		const once = laidOut();
		expect(normalizeProject(once)).toBe(once);
	});
});

describe("normalizeProject with a plugin", () => {
	it("runs before, then after, and keeps the project when neither changes it", () => {
		const once = laidOut();
		const calls: string[] = [];
		const plugin: VideoEditorPlugin = {
			id: "fake",
			itemKinds: [],
			normalize: {
				before: (project) => (calls.push("before"), project),
				after: (project) => (calls.push("after"), project),
			},
		};
		expect(normalizeProject(once, plugin)).toBe(once);
		expect(calls).toEqual(["before", "after"]);
	});
});
