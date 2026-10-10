import { describe, expect, it } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import { removeMusic, setMusic } from "../src/core/edit/music-edits.js";
import plain from "./fixtures/plain.project.json";

const project = () => normalizeProject(createProjectSchema().parse(plain));
const ctx = { now: 1 };
const song = { url: "https://example.test/song.mp3", durationSeconds: 30, label: "Song" };

describe("music edits without a plugin", () => {
	it("adds a song from its first second", () => {
		const next = setMusic(project(), song, ctx);
		expect(next.music?.url).toBe(song.url);
		expect(next.music?.label).toBe("Song");
		expect(next.music?.sourceInSeconds).toBe(0);
	});

	it("removes the song and leaves a project without one as it is", () => {
		const none = removeMusic(setMusic(project(), song, ctx), ctx);
		expect(none.music).toBeUndefined();
		expect(removeMusic(none, ctx)).toBe(none);
	});
});
