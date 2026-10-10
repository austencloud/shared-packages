// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { trackRecordClicks } from './record-morph';
import { routeMotionHandler } from './route-motion';

const routes = {
	'/acts/[id]': { kind: 'act', params: ['id'] },
	'/services/[category]/[service]': { kind: 'service', params: ['category', 'service'] }
} as const;

function nav(
	fromId: string | null,
	fromPath: string,
	toId: string | null,
	toPath: string,
	params: { from?: Record<string, string>; to?: Record<string, string> } = {}
) {
	return {
		from: { route: { id: fromId }, params: params.from ?? {}, url: new URL(`http://x${fromPath}`) },
		to: { route: { id: toId }, params: params.to ?? {}, url: new URL(`http://x${toPath}`) },
		complete: Promise.resolve()
	};
}

const root = document.documentElement;
const nameOf = (element: Element | null) => (element as HTMLElement | null)?.style.viewTransitionName ?? '';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Stands in for the browser: runs the update callback at once and keeps the
 * transition "running" until `finish()`. `atStart` is read the moment the
 * transition starts, before the update callback clears the source's name.
 */
function stubViewTransition<T>(atStart: () => T) {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => (finish = resolve));
	const started: T[] = [];
	(document as { startViewTransition?: unknown }).startViewTransition = vi.fn((update: () => Promise<void>) => {
		started.push(atStart());
		const done = update();
		return { ready: done, updateCallbackDone: done, finished };
	});
	return { finish, started };
}

let stopTracking: (() => void) | null = null;

// jsdom has no CSS.escape. This one backslash-escapes anything that is not a
// word character or hyphen, which is enough for the selectors under test.
beforeAll(() => {
	const css = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS ?? {};
	css.escape ??= (value: string) => value.replace(/[^\w-]/g, '\\$&');
	(globalThis as { CSS?: unknown }).CSS = css;
});

afterEach(() => {
	stopTracking?.();
	stopTracking = null;
	vi.restoreAllMocks();
	delete (document as { startViewTransition?: unknown }).startViewTransition;
	document.body.innerHTML = '';
	root.classList.remove('route-transition', 'route-morph');
});

describe('routeMotionHandler', () => {
	it('does nothing when the browser has no view transitions', () => {
		const handle = routeMotionHandler(routes);
		expect(handle(nav('/acts', '/acts', '/acts/[id]', '/acts/a1', { to: { id: 'a1' } }))).toBeUndefined();
	});

	it('does nothing for a query-only change', () => {
		(document as { startViewTransition?: unknown }).startViewTransition = vi.fn();
		const handle = routeMotionHandler(routes);
		expect(handle(nav('/acts', '/acts', '/acts', '/acts'))).toBeUndefined();
		expect(document.startViewTransition).not.toHaveBeenCalled();
	});

	it('starts a transition for a page change and resolves once the old page is captured', async () => {
		const start = vi.fn((update: () => Promise<void>) => {
			const done = update();
			return { ready: done, updateCallbackDone: done, finished: done };
		});
		(document as { startViewTransition?: unknown }).startViewTransition = start;
		const handle = routeMotionHandler(routes);
		const result = handle(nav('/', '/', '/about', '/about'));
		expect(result).toBeInstanceOf(Promise);
		await result;
		expect(start).toHaveBeenCalledOnce();
	});

	it('fades without a morph when no record box was clicked', async () => {
		document.body.innerHTML = '<a data-record="act:a1"><img data-record-photo></a>';
		const box = document.querySelector('a');
		const { finish, started } = stubViewTransition(() => ({
			morph: root.classList.contains('route-morph'),
			boxName: nameOf(box)
		}));
		const handle = routeMotionHandler(routes);
		await handle(nav('/', '/', '/acts/[id]', '/acts/a1', { to: { id: 'a1' } }));
		expect(started).toEqual([{ morph: false, boxName: '' }]);
		expect(root.classList.contains('route-transition')).toBe(true);
		finish();
		await tick();
		expect(root.classList.contains('route-transition')).toBe(false);
	});

	it('morphs the clicked box and its photo into the record page, then cleans up', async () => {
		document.body.innerHTML =
			'<a data-record="act:a1"><img data-record-photo></a><header data-record-target="act:a1"><img data-record-photo></header>';
		const box = document.querySelector('a')!;
		const boxPhoto = box.querySelector('img');
		const header = document.querySelector('header')!;
		stopTracking = trackRecordClicks(document);
		box.click();

		const { finish, started } = stubViewTransition(() => ({
			morph: root.classList.contains('route-morph'),
			boxName: nameOf(box),
			photoName: nameOf(boxPhoto)
		}));
		const handle = routeMotionHandler(routes);
		await handle(nav('/acts', '/acts', '/acts/[id]', '/acts/a1', { to: { id: 'a1' } }));

		expect(started).toEqual([{ morph: true, boxName: 'record-box', photoName: 'record-photo' }]);
		expect(root.classList.contains('route-morph')).toBe(true);
		// The old box hands its name over once the old page is captured.
		expect(nameOf(box)).toBe('');
		await tick();
		expect(nameOf(header)).toBe('record-box');
		expect(nameOf(header.querySelector('img'))).toBe('record-photo');

		finish();
		await tick();
		expect(root.classList.contains('route-morph')).toBe(false);
		expect(root.classList.contains('route-transition')).toBe(false);
		expect(nameOf(header)).toBe('');
	});

	it('morphs the page header back into its box when going back', async () => {
		document.body.innerHTML =
			'<header data-record-target="act:a1"><img data-record-photo></header><a data-record="act:a1"></a>';
		const header = document.querySelector('header')!;
		const { finish, started } = stubViewTransition(() => ({
			morph: root.classList.contains('route-morph'),
			headerName: nameOf(header),
			photoName: nameOf(header.querySelector('img'))
		}));
		const handle = routeMotionHandler(routes);
		await handle(nav('/acts/[id]', '/acts/a1', '/acts', '/acts', { from: { id: 'a1' } }));

		expect(started).toEqual([{ morph: true, headerName: 'record-box', photoName: 'record-photo' }]);
		finish();
		await tick();
		expect(root.classList.contains('route-morph')).toBe(false);
	});

	it('names a record by every param, joined with a slash', async () => {
		const record = 'service:fire/fire-show';
		document.body.innerHTML = `<a data-record="${record}"></a><header data-record-target="${record}"></header>`;
		const box = document.querySelector('a')!;
		const header = document.querySelector('header')!;
		stopTracking = trackRecordClicks(document);
		box.click();

		const { finish, started } = stubViewTransition(() => ({
			morph: root.classList.contains('route-morph'),
			boxName: nameOf(box)
		}));
		const handle = routeMotionHandler(routes);
		await handle(
			nav('/services', '/services', '/services/[category]/[service]', '/services/fire/fire-show', {
				to: { category: 'fire', service: 'fire-show' }
			})
		);

		expect(started).toEqual([{ morph: true, boxName: 'record-box' }]);
		await tick();
		expect(nameOf(header)).toBe('record-box');
		finish();
		await tick();
	});
});
