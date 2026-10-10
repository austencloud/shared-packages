import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import { DURATION } from './durations';
import { motionDuration, reducedMotion } from './reduced-motion';

/**
 * An animated list pins a leaving item with an inline translate just before
 * its outro starts. Keyframes replace inline transforms, so a transition that
 * moves or scales must carry the pin, or the item jumps before it goes.
 */
function pinned(node: Element): string {
	const transform = (node as HTMLElement).style?.transform;
	return transform && transform !== 'none' ? `${transform} ` : '';
}

interface FlyFadeParams {
	duration?: number;
	delay?: number;
	/** Drift-in offsets in px (element eases from here to rest). */
	x?: number;
	y?: number;
}

/**
 * Fade + short translate drift. No layout animation. Use for elements at the
 * end of a row or in reserved space (alerts, status text, badges) where the
 * mount itself does not shove siblings.
 */
export function flyFade(
	node: Element,
	{ duration = DURATION.normal, delay = 0, x = 0, y = 4 }: FlyFadeParams = {}
): TransitionConfig {
	const base = pinned(node);
	return {
		duration: motionDuration(duration),
		delay,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: ${base}translate(${(1 - t) * x}px, ${(1 - t) * y}px);`
	};
}

interface GrowFadeParams {
	duration?: number;
	delay?: number;
	/** Which box dimension grows: "y" = height (list rows), "x" = width (inline chips). */
	axis?: 'x' | 'y';
	/** Extra drift-in offset in px along the cross feel (translateX). */
	x?: number;
}

/**
 * Size + fade: the element's own width or height animates from 0 so siblings
 * reflow smoothly instead of snapping when it mounts or unmounts. The
 * inline-flow choice for list rows, inline count chips and expanding groups.
 */
export function growFade(
	node: HTMLElement,
	{ duration = DURATION.normal, delay = 0, axis = 'y', x = 0 }: GrowFadeParams = {}
): TransitionConfig {
	// Like svelte's `slide`, collapse padding, margin and border along the axis
	// too, otherwise a padded element ends its collapse with a residual-height pop.
	const style = getComputedStyle(node);
	const rect = node.getBoundingClientRect();
	const size = axis === 'y' ? rect.height : rect.width;
	const props =
		axis === 'y'
			? ([
					'height',
					'padding-top',
					'padding-bottom',
					'margin-top',
					'margin-bottom',
					'border-top-width',
					'border-bottom-width'
				] as const)
			: ([
					'width',
					'padding-left',
					'padding-right',
					'margin-left',
					'margin-right',
					'border-left-width',
					'border-right-width'
				] as const);
	const values = props.map((p) =>
		p === 'height' || p === 'width' ? size : parseFloat(style.getPropertyValue(p)) || 0
	);
	return {
		duration: motionDuration(duration),
		delay,
		easing: cubicOut,
		css: (t) =>
			props.map((p, i) => `${p}: ${t * (values[i] ?? 0)}px;`).join(' ') +
			` opacity: ${t}; overflow: hidden; box-sizing: border-box;` +
			` transform: translateX(${(1 - t) * x}px);`
	};
}

interface PopInParams {
	duration?: number;
	delay?: number;
	/** Starting scale. */
	start?: number;
}

/** Scale + fade pop for small controls (icon buttons, badges). */
export function popIn(
	node: HTMLElement,
	{ duration = DURATION.fast, delay = 0, start = 0.8 }: PopInParams = {}
): TransitionConfig {
	const base = pinned(node);
	return {
		duration: motionDuration(duration),
		delay,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: ${base}scale(${start + (1 - start) * t});`
	};
}

/** Arrivals wait for leavers to clear, then fill in one after another. */
const ARRIVE_DELAY_MS = 110;
const ARRIVE_STAGGER_MS = 22;
const ARRIVE_STAGGER_CAP_MS = 220;

interface ArriveParams {
	/** Position among the items shown, for the stagger. */
	index?: number;
}

/**
 * A keyed list item joining a filtered or sorted list. Pair with
 * `animate:flip={{ duration: flipDuration() }}` and `out:leave`; the list
 * container needs `position: relative` so leavers can lift out of flow while
 * survivors glide.
 */
export function arrive(_node: Element, { index = 0 }: ArriveParams = {}): TransitionConfig {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	return {
		delay: ARRIVE_DELAY_MS + Math.min(index * ARRIVE_STAGGER_MS, ARRIVE_STAGGER_CAP_MS),
		duration: DURATION.emphasis,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: scale(${0.96 + 0.04 * t});`
	};
}

/** A keyed list item leaving a filtered list: fades and shrinks a touch in place. */
export function leave(node: Element): TransitionConfig {
	const base = pinned(node);
	return {
		duration: motionDuration(DURATION.fast),
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: ${base}scale(${0.96 + 0.04 * t});`
	};
}
