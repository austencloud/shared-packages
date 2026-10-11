<script lang="ts">
	import type { ItemLane } from "../../../plugin.js";
	import type { PostItem } from "../../../core/project/item-kinds.js";
	import { formatPostClock } from "../post-format.js";
	import { secondsToPixels } from "./post-timeline-geometry.js";

	/**
	 * One row under the selected item that a plugin asks for (`ui.itemLanes`):
	 * the item's span as a dashed outline and the lane's bar on it. Like the key
	 * lane it only reports what was pressed; the timeline does the drag and the
	 * plugin makes the edit.
	 */
	interface Props {
		item: PostItem;
		lane: ItemLane;
		heightPx: number;
		pixelsPerSecond: number;
		locked: boolean;
		onSeek: (seconds: number) => void;
		onBarPointerDown: (event: PointerEvent) => void;
		onBarClick: () => void;
		/** How the bar's start reads to a screen reader; the post's clock by default. */
		formatTime?: (seconds: number) => string;
	}

	let {
		item,
		lane,
		heightPx,
		pixelsPerSecond,
		locked,
		onSeek,
		onBarPointerDown,
		onBarClick,
		formatTime = formatPostClock,
	}: Props = $props();

	/** How far a press may travel and still count as a tap on the empty row. */
	const TAP_SLOP_PX = 6;

	const spanLeftPx = $derived(secondsToPixels(item.start, pixelsPerSecond));
	const spanWidthPx = $derived(secondsToPixels(item.duration, pixelsPerSecond));
	const barLeftPx = $derived(secondsToPixels(lane.startSeconds, pixelsPerSecond));
	const barWidthPx = $derived(
		secondsToPixels(lane.endSeconds - lane.startSeconds, pixelsPerSecond),
	);
	const dataAttributes = $derived(
		Object.fromEntries(
			Object.entries(lane.data ?? {}).map(([key, value]) => [`data-${key}`, value]),
		),
	);

	let tapStart: { x: number; y: number; pointerId: number } | null = null;

	// A tap on the empty row moves the playhead there. A swipe that scrolls the
	// timeline is not a tap: the browser cancels the pointer, or it travels.
	function handleRowPointerDown(event: PointerEvent): void {
		if (event.button !== 0 || event.target !== event.currentTarget) return;
		tapStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
	}

	function handleRowPointerUp(event: PointerEvent): void {
		const start = tapStart;
		tapStart = null;
		if (!start || start.pointerId !== event.pointerId) return;
		if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		onSeek(Math.max(0, (event.clientX - rect.left) / pixelsPerSecond));
	}

	function handleBarPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		if (locked) return;
		event.preventDefault();
		onBarPointerDown(event);
	}
</script>

<div
	class="item-lane"
	class:selected={lane.selected}
	style="height: {heightPx}px"
	role="group"
	aria-label={lane.label}
	data-item-lane={lane.id}
	{...dataAttributes}
	onpointerdown={handleRowPointerDown}
	onpointerup={handleRowPointerUp}
	onpointercancel={() => (tapStart = null)}
>
	<div class="lane-span" style="left: {spanLeftPx}px; width: {spanWidthPx}px" aria-hidden="true"></div>

	<button
		type="button"
		class="lane-bar"
		class:pinned={lane.pinned}
		class:locked
		style="left: {barLeftPx}px; width: {barWidthPx}px"
		aria-pressed={lane.selected}
		aria-label="{lane.label}, {lane.description}, from {formatTime(lane.startSeconds)}"
		data-start-seconds={lane.startSeconds}
		onpointerdown={handleBarPointerDown}
		onclick={(event) => {
			event.stopPropagation();
			onBarClick();
		}}
	>
		<span class="bar-text">{lane.label}</span>
	</button>
</div>

<style>
	.item-lane {
		position: relative;
		box-sizing: border-box;
		border-bottom: 1px solid var(--ve-theme-stroke, rgba(255, 255, 255, 0.06));
		background: color-mix(in srgb, var(--ve-theme-bg, #101018) 70%, #000);
	}

	.lane-span {
		position: absolute;
		top: 0;
		bottom: 0;
		background: color-mix(in srgb, var(--ve-theme-accent) 6%, transparent);
		border-inline: 1px dashed
			color-mix(in srgb, var(--ve-theme-accent) 30%, transparent);
		pointer-events: none;
	}

	.item-lane.selected .lane-span {
		background: color-mix(in srgb, var(--ve-theme-accent) 12%, transparent);
	}

	/* The lane's bar never drops under the touch target, so a short bar or a
		 stub past the item's end stays easy to grab. */
	.lane-bar {
		position: absolute;
		top: 7px;
		bottom: 7px;
		z-index: 1;
		display: flex;
		box-sizing: border-box;
		align-items: center;
		min-width: var(--ve-min-touch-target, 44px);
		overflow: hidden;
		padding: 0 0.5rem;
		border: 1px solid color-mix(in srgb, var(--ve-theme-accent) 35%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--ve-theme-accent) 18%, transparent);
		color: var(--ve-theme-text, #fff);
		cursor: grab;
		font: inherit;
		text-align: left;
		touch-action: none;
		transition:
			background-color var(--ve-transition-fast),
			border-color var(--ve-transition-fast);
	}

	.item-lane.selected .lane-bar {
		border-color: var(--ve-theme-accent);
		background: var(--ve-theme-accent, #d4813a);
		color: var(--ve-theme-text-on-accent, #111);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ve-theme-accent) 35%, transparent);
	}

	.lane-bar.pinned {
		border-style: dashed;
		background: color-mix(in srgb, var(--ve-theme-accent) 10%, transparent);
	}

	.lane-bar.locked {
		cursor: default;
	}

	@media (hover: hover) {
		.lane-bar:not(.locked):hover {
			border-color: var(--ve-theme-accent);
			background: color-mix(in srgb, var(--ve-theme-accent) 28%, transparent);
		}

		.item-lane.selected .lane-bar:not(.locked):hover {
			background: color-mix(in srgb, var(--ve-theme-accent) 88%, #fff);
		}
	}

	.lane-bar:focus-visible {
		outline: 2px solid var(--ve-theme-accent);
		outline-offset: 1px;
	}

	.bar-text {
		overflow: hidden;
		font-size: var(--ve-font-size-compact, 0.75rem);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.lane-bar {
			transition: none;
		}
	}
</style>
