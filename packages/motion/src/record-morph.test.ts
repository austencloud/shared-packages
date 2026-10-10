// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { runRouteTransition, visibleRecord } from './record-morph';

type Callback = () => Promise<void>;

// jsdom has no CSS.escape; the ids here need no escaping.
globalThis.CSS ??= { escape: (value: string) => value } as typeof CSS;

/**
 * A stand-in for the browser API. Like the browser, it captures the old page
 * a tick later and then runs the update callback. Starting a second
 * transition skips the first, which settles `finished` before that capture.
 */
function fakeViewTransitions() {
	const captures: string[][] = [];
	let skipRunning: (() => void) | null = null;
	document.startViewTransition = ((update: Callback) => {
		skipRunning?.();
		let settle!: () => void;
		const finished = new Promise<void>((resolve) => (settle = resolve));
		skipRunning = settle;
		const updateCallbackDone = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
			captures.push(
				[...document.querySelectorAll<HTMLElement>('*')]
					.filter((element) => element.style.viewTransitionName)
					.map((element) => `${element.tagName.toLowerCase()} ${element.style.viewTransitionName}`)
			);
			return update();
		});
		return { ready: Promise.resolve(), updateCallbackDone, finished, skipTransition: settle, finish: settle };
	}) as unknown as typeof document.startViewTransition;
	return { captures, finishRunning: () => skipRunning?.() };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
	document.body.innerHTML = '';
	document.documentElement.className = '';
});

describe('record morph names', () => {
	it('keeps the header named when a quick Back stamps it again', async () => {
		const { captures, finishRunning } = fakeViewTransitions();
		document.body.innerHTML = `
			<a data-record="performer:a"><span data-record-photo></span></a>
			<header data-record-target="performer:a"><span data-record-photo></span></header>`;
		const card = document.querySelector<HTMLElement>('[data-record]')!;
		const header = document.querySelector<HTMLElement>('header')!;

		// Forward: the card is captured, then the header is named.
		await runRouteTransition(Promise.resolve(), { source: card, destination: () => header });
		await flush();
		expect(captures[0]).toEqual(['a record-box', 'span record-photo']);
		expect(header.style.viewTransitionName).toBe('record-box');

		// Back while the forward morph still runs. The skipped forward
		// transition cleans up before the back capture; it must leave the
		// header, which the back transition has claimed, named.
		await runRouteTransition(Promise.resolve(), { source: header, destination: () => card });
		await flush();
		expect(captures[1]).toEqual(['header record-box', 'span record-photo']);
		expect(card.style.viewTransitionName).toBe('record-box');

		finishRunning();
		await flush();
		expect(card.style.viewTransitionName).toBe('');
		expect(document.documentElement.classList.contains('route-transition')).toBe(false);
	});

	it('does not stamp the next page when a newer change took over during the hold', async () => {
		let release!: () => void;
		const slow = new Promise<void>((resolve) => (release = resolve));
		const calls: Callback[] = [];
		document.startViewTransition = ((update: Callback) => {
			calls.push(update);
			const never = new Promise<void>(() => {});
			return { ready: Promise.resolve(), updateCallbackDone: never, finished: never, skipTransition() {}, finish() {} };
		}) as unknown as typeof document.startViewTransition;
		document.body.innerHTML = `<a data-record="performer:a"></a><header data-record-target="performer:a"></header>`;
		const card = document.querySelector<HTMLElement>('[data-record]')!;
		const header = document.querySelector<HTMLElement>('header')!;

		const first = runRouteTransition(slow, { source: card, destination: () => header });
		const firstUpdate = calls[0]();
		await first;
		// A plain page change starts before the first one's page arrives.
		void runRouteTransition(Promise.resolve(), null);
		release();
		await firstUpdate;
		expect(header.style.viewTransitionName).toBe('');
	});
});

describe('visibleRecord', () => {
	it('passes over a box in a leaving crossfade layer', () => {
		document.body.innerHTML = `
			<div inert><a id="old" data-record="performer:a"></a></div>
			<a id="live" data-record="performer:a"></a>`;
		for (const element of document.querySelectorAll('a')) {
			element.getBoundingClientRect = () => ({ width: 100, height: 40, top: 10, bottom: 50, left: 0, right: 100, x: 0, y: 10, toJSON() {} });
		}
		expect(visibleRecord('performer:a')?.id).toBe('live');
	});
});
