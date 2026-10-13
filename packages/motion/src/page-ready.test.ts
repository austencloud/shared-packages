import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdPageReady, waitForPageReady } from './page-ready';

describe('page readiness', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('resolves at once when nothing holds', async () => {
		let done = false;
		void waitForPageReady(300).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(0);
		expect(done).toBe(true);
	});

	it('waits for the hold to release', async () => {
		const release = holdPageReady();
		let done = false;
		void waitForPageReady(300).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(100);
		expect(done).toBe(false);
		release();
		await vi.advanceTimersByTimeAsync(0);
		expect(done).toBe(true);
	});

	it('gives up after the cap', async () => {
		const release = holdPageReady();
		let done = false;
		void waitForPageReady(300).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(299);
		expect(done).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(done).toBe(true);
		release();
	});

	it('a second release is harmless', async () => {
		const first = holdPageReady();
		const second = holdPageReady();
		first();
		first();
		let done = false;
		void waitForPageReady(300).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(0);
		expect(done).toBe(false);
		second();
		await vi.advanceTimersByTimeAsync(0);
		expect(done).toBe(true);
	});
});
