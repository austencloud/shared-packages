import { DURATION, EASE_STANDARD } from './durations';
import { motionDuration } from './reduced-motion';

/**
 * Eases a box's height to follow its first child as that child grows or
 * shrinks, so the content below glides instead of jumping.
 */
export function followHeight(node: HTMLElement, preserveOverflow = false) {
	const content = node.firstElementChild as HTMLElement | null;
	if (!content || typeof ResizeObserver === 'undefined') return {};
	const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
	const outerHeight = () => {
		const style = getComputedStyle(node);
		return content.getBoundingClientRect().height +
			parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
			parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
	};
	let previous = outerHeight();
	let settledHeight = node.getBoundingClientRect().height;
	let animation: Animation | null = null;
	let ready = false;
	let hidden = !node.getClientRects().length;
	function clear() {
		animation?.cancel();
		animation = null;
		node.style.height = '';
		if (!preserveOverflow) node.style.overflow = '';
	}
	const observer = new ResizeObserver(() => {
		if (!node.getClientRects().length) {
			hidden = true;
			clear();
			return;
		}
		const next = outerHeight();
		if (!ready || hidden) {
			ready = true;
			hidden = false;
			previous = next;
			settledHeight = node.getBoundingClientRect().height;
			return;
		}
		if (Math.abs(next - previous) < 1) return;
		const from = animation ? node.getBoundingClientRect().height : settledHeight;
		previous = next;
		clear();
		if (preference.matches || Math.abs(from - next) < 1) {
			settledHeight = node.getBoundingClientRect().height;
			return;
		}
		node.style.height = `${next}px`;
		if (!preserveOverflow) node.style.overflow = 'clip';
		const current = node.animate([{ height: `${from}px` }, { height: `${next}px` }], {
			duration: motionDuration(DURATION.normal), easing: EASE_STANDARD
		});
		animation = current;
		current.onfinish = () => {
			if (animation === current) {
				clear();
				settledHeight = node.getBoundingClientRect().height;
			}
		};
	});
	observer.observe(content);
	const onPreference = () => {
		if (preference.matches) {
			clear();
			settledHeight = node.getBoundingClientRect().height;
		}
	};
	preference.addEventListener('change', onPreference);
	return {
		destroy() {
			observer.disconnect();
			preference.removeEventListener('change', onPreference);
			clear();
		}
	};
}
