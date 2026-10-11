import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import type { PostMusic } from "../../../src/core/music/post-music.js";
import PostTimelineMusicLane from "../../../src/ui/editor/timeline/PostTimelineMusicLane.svelte";

export type LaneCall = [name: string, ...args: unknown[]];

/**
 * Mounts the music lane the way the timeline does: the music is replaced,
 * never changed in place, as the editor's `$state.raw` project replaces it.
 * Every callback is recorded in order. Selecting the music selects it.
 */
export function mountMusicLane(initial: PostMusic, snapTargets: number[] = []) {
	const calls: LaneCall[] = [];
	const record =
		(name: string) =>
		(...args: unknown[]) => {
			calls.push([name, ...args]);
		};
	let music = $state.raw(initial);
	let pixelsPerSecond = $state(100);
	let selected = $state(false);
	// Far past any music in these tests, unless a test moves it.
	let postEndSeconds = $state(1000);
	let missing = $state(false);
	const screen = render(PostTimelineMusicLane, {
		props: {
			get music() {
				return music;
			},
			get pixelsPerSecond() {
				return pixelsPerSecond;
			},
			get postEndSeconds() {
				return postEndSeconds;
			},
			get selected() {
				return selected;
			},
			get missing() {
				return missing;
			},
			snapTargets: () => snapTargets,
			onSelect: () => {
				calls.push(["select"]);
				selected = true;
			},
			onGestureStart: record("gestureStart"),
			onGestureEnd: record("gestureEnd"),
			onGestureCancel: record("gestureCancel"),
			onMove: record("move"),
			onTrim: record("trim"),
			onMoveDownbeat: record("downbeat"),
			onSnapGuide: record("guide"),
		},
	});
	flushSync();
	return {
		container: screen.container,
		unmount: screen.unmount,
		calls,
		get music() {
			return music;
		},
		setMusic(next: PostMusic) {
			music = next;
			flushSync();
		},
		setPixelsPerSecond(next: number) {
			pixelsPerSecond = next;
			flushSync();
		},
		setSelected(next: boolean) {
			selected = next;
			flushSync();
		},
		setPostEnd(next: number) {
			postEndSeconds = next;
			flushSync();
		},
		setMissing(next: boolean) {
			missing = next;
			flushSync();
		},
	};
}
