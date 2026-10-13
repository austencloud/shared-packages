/**
 * Runs page changes as view transitions. The document root is opted out of
 * capture, so the sidebar and top bar stay live and only the main column
 * moves. When the reader clicked a record box (`data-record="kind:id"`), that
 * box and its photo morph into the new page's header (`data-record-target`).
 * Going back reverses it: the header morphs into the matching box. The
 * leaving page fades where it was on screen, whatever the new page's scroll.
 *
 * Only two names are ever used, `record-box` and `record-photo`, stamped on
 * one element per side for the length of one transition, so a list of thirty
 * cards never claims thirty names.
 *
 * A photo is drawn above its box unless either side marks it
 * `data-record-photo="backdrop"`: a banner with a scrim and a headline on it.
 * Then the box's layer stays on top, so the headline never disappears under
 * the moving photo.
 */
import { PAGE_READY_CAP_MS, waitForPageReady } from './page-ready';

const CLICK_WINDOW_MS = 1500;
const BOX = 'record-box';
const PHOTO = 'record-photo';
/** How far the old page area's top sits from the new one's, read by the page fade. */
const SHIFT = '--route-content-shift';
/** On the root while a morphing photo sits under its box's content. */
const BACKDROP = 'route-photo-backdrop';

function hasBackdrop(element: Element): boolean {
	return element.querySelector('[data-record-photo]')?.getAttribute('data-record-photo') === 'backdrop';
}

function contentTop(): number | null {
	return document.querySelector('[data-route-content]')?.getBoundingClientRect().top ?? null;
}

let lastClick: { element: Element; at: number } | null = null;
let generation = 0;

/** Remember the record box behind each click. Returns the cleanup. */
export function trackRecordClicks(target: Document): () => void {
	const remember = (event: Event) => {
		const element = event.target instanceof Element ? event.target.closest('[data-record]') : null;
		lastClick = element ? { element, at: performance.now() } : null;
	};
	target.addEventListener('click', remember, true);
	return () => target.removeEventListener('click', remember, true);
}

/** The box just clicked, if it stands for this record. */
export function clickedRecord(record: string): Element | null {
	if (!lastClick || performance.now() - lastClick.at > CLICK_WINDOW_MS) return null;
	const { element } = lastClick;
	return element.isConnected && element.getAttribute('data-record') === record ? element : null;
}

/**
 * A page's header for this record. A placeholder outline fading out beside the
 * real header is inert, so it is passed over.
 */
export function recordTarget(record: string): Element | null {
	const found = document.querySelectorAll(`[data-record-target="${CSS.escape(record)}"]`);
	for (const element of found) if (!element.closest('[inert]')) return element;
	return found[0] ?? null;
}

/**
 * The first box for this record that is on screen, for the way back. Boxes in
 * a leaving crossfade layer are passed over, and so are boxes scrolled out of
 * an inner list, because a named capture would draw them outside their clip.
 */
export function visibleRecord(record: string): Element | null {
	for (const element of document.querySelectorAll(`[data-record="${CSS.escape(record)}"]`)) {
		if (element.closest('[inert]')) continue;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) continue;
		const clip = scrollParent(element)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
		if (rect.bottom > Math.max(0, clip.top) && rect.top < Math.min(window.innerHeight, clip.bottom)) return element;
	}
	return null;
}

export function scrollParent(element: Element): Element | null {
	for (let parent = element.parentElement; parent; parent = parent.parentElement) {
		const { overflowY } = getComputedStyle(parent);
		if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
	}
	return null;
}

/**
 * Names one box and its photo for transition `owner`. The cleanup leaves an
 * element alone once a later transition has stamped it: a quick Back stamps
 * the header the forward morph just named, and the skipped forward
 * transition must not blank it.
 */
function stamp(element: Element, owner: number): () => void {
	const box = element as HTMLElement;
	const photo = element.querySelector<HTMLElement>('[data-record-photo]');
	const named: [HTMLElement, string][] = [[box, BOX]];
	if (photo) named.push([photo, PHOTO]);
	for (const [node, name] of named) {
		node.style.viewTransitionName = name;
		node.dataset.morphOwner = String(owner);
	}
	return () => {
		for (const [node] of named) {
			if (node.dataset.morphOwner !== String(owner)) continue;
			node.style.viewTransitionName = '';
			delete node.dataset.morphOwner;
		}
	};
}

/**
 * Starts the transition and resolves once the browser has captured the old
 * page, which is when SvelteKit may swap the DOM. `source` and `destination`
 * are given only for a morph.
 */
export function runRouteTransition(
	complete: Promise<void>,
	morph: { source: Element; destination: () => Element | null } | null
): Promise<void> {
	const root = document.documentElement;
	const mine = ++generation;
	root.classList.add('route-transition');
	root.classList.toggle('route-morph', !!morph);
	root.classList.toggle(BACKDROP, !!morph && hasBackdrop(morph.source));
	let clearSource = morph ? stamp(morph.source, mine) : () => {};
	let clearDestination = () => {};
	const oldTop = contentTop();

	return new Promise((resolve) => {
		const transition = document.startViewTransition(async () => {
			clearSource();
			clearSource = () => {};
			resolve();
			await complete;
			await waitForPageReady(PAGE_READY_CAP_MS);
			// A newer page change has taken over; leave its DOM alone.
			if (generation !== mine) return;
			// A link opens the new page at the top and Back restores its saved
			// scroll, so the page area's top moves. The old picture is held at
			// the spot it had on screen (css/route-transitions.css) instead of
			// sliding there.
			const newTop = contentTop();
			if (oldTop !== null && newTop !== null) root.style.setProperty(SHIFT, `${oldTop - newTop}px`);
			const destination = morph?.destination();
			if (destination) {
				clearDestination = stamp(destination, mine);
				if (hasBackdrop(destination)) root.classList.add(BACKDROP);
			}
		});
		// A second click or a back press skips a running transition. That is
		// expected, so its rejections are not errors.
		transition.ready.catch(() => {});
		transition.updateCallbackDone.catch(() => {});
		transition.finished
			.catch(() => {})
			.finally(() => {
				clearSource();
				clearDestination();
				if (generation !== mine) return;
				root.classList.remove('route-transition', 'route-morph', BACKDROP);
				root.style.removeProperty(SHIFT);
			});
	});
}
