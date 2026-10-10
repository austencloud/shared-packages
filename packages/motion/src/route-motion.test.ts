// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeMotionHandler } from './route-motion';

const routes = { '/acts/[id]': { kind: 'act', params: ['id'] } } as const;

function nav(fromId: string | null, fromPath: string, toId: string | null, toPath: string, params: Record<string, string> = {}) {
	return {
		from: { route: { id: fromId }, params: {}, url: new URL(`http://x${fromPath}`) },
		to: { route: { id: toId }, params, url: new URL(`http://x${toPath}`) },
		complete: Promise.resolve()
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	delete (document as { startViewTransition?: unknown }).startViewTransition;
	document.body.innerHTML = '';
});

describe('routeMotionHandler', () => {
	it('does nothing when the browser has no view transitions', () => {
		const handle = routeMotionHandler(routes);
		expect(handle(nav('/acts', '/acts', '/acts/[id]', '/acts/a1', { id: 'a1' }))).toBeUndefined();
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
});
