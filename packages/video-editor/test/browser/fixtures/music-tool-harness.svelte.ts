import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import type { PostMusic } from "../../../src/core/music/post-music.js";
import { trimMusic, updateMusic, type MusicPatch } from "../../../src/core/edit/music-edits.js";
import PostMusicTool from "../../../src/ui/editor/PostMusicTool.svelte";
import { POST_BOX, createEmptyPostProject } from "../../../src/core/project/schema.js";
import type { PostItem, PostProject, PostVideoItem } from "../../../src/core/project/item-kinds.js";
import type { PostTake } from "../../../src/core/plan/post-plan.js";

// tka's tests/unit/media-composition/post-project-fixtures.ts builds these. The panel's edits only
// need a post with one video on it, and a post with no plugin kinds needs no plugin in its edit
// context, so the package test carries the few lines it uses.
const NOW = 1_700_000_000_000;

function take(id: string): PostTake {
	return {
		id,
		label: `Take ${id}`,
		ref: { kind: "linked", url: `https://example.test/${id}.mp4` },
		takeKey: `key-${id}`,
		durationSeconds: 20,
	};
}

function video(id: string): PostVideoItem {
	return {
		start: 0,
		box: { ...POST_BOX.full },
		opacity: 1,
		fadeIn: 0,
		fadeOut: 0,
		anchor: null,
		fill: false,
		id,
		kind: "video",
		takeId: "a",
		sourceIn: 0,
		sourceOut: 10,
		speed: 1,
		duration: 10,
		fit: "cover",
		zoom: 1,
		panX: 0,
		panY: 0,
		rotation: 0,
		flip: false,
		volume: 1,
	};
}

function project(main: PostItem[]): PostProject {
	return {
		...createEmptyPostProject({ now: NOW }),
		takes: [take("a"), take("b")],
		tracks: [{ id: "main", hidden: false, locked: false, items: main }],
	};
}

/**
 * Mounts the music's panel the way the workspace does: every change goes
 * through updateMusic and every trim through trimMusic, and the panel gets
 * the new music back. The playhead starts at the post's 0 s, paused, and the
 * music's file loads.
 */
export function mountMusicTool(initial: PostMusic) {
	const changes: Array<[string, MusicPatch]> = [];
	const trims: Array<[edge: "start" | "end", postSeconds: number]> = [];
	let music = $state.raw(initial);
	let playing = $state(false);
	let playhead = $state(0);
	let missing = $state(false);
	const screen = render(PostMusicTool, {
		props: {
			get music() {
				return music;
			},
			get playing() {
				return playing;
			},
			get missing() {
				return missing;
			},
			playheadSeconds: () => playhead,
			onChange: (key: string, patch: MusicPatch) => {
				changes.push([key, patch]);
				const next = updateMusic({ ...project([video("v1")]), music }, patch, { now: NOW + 1 });
				if (next.music) music = next.music;
			},
			onTrim: (edge: "start" | "end", postSeconds: number) => {
				trims.push([edge, postSeconds]);
				const next = trimMusic({ ...project([video("v1")]), music }, edge, postSeconds, {
					now: NOW + 1,
				});
				if (next.music) music = next.music;
			},
		},
	});
	flushSync();
	return {
		container: screen.container,
		unmount: screen.unmount,
		changes,
		trims,
		get music() {
			return music;
		},
		setPlaying(next: boolean) {
			playing = next;
			flushSync();
		},
		setPlayhead(seconds: number) {
			playhead = seconds;
			flushSync();
		},
		/** The preview reports that the music's file can't be loaded, or can be. */
		setMissing(next: boolean) {
			missing = next;
			flushSync();
		},
		/** Swaps in another music, as adding a new file does. */
		setMusic(next: PostMusic) {
			music = next;
			flushSync();
		},
	};
}
