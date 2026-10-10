import { afterEach, describe, expect, it, vi } from 'vitest';
import { DURATION } from './durations';
import { flipDuration, motionDuration, reducedMotion } from './reduced-motion';

function stubMotion(reduce: boolean, attribute?: string) {
	vi.stubGlobal('window', { matchMedia: () => ({ matches: reduce }) });
	vi.stubGlobal('document', { documentElement: { dataset: attribute ? { motionPreference: attribute } : {} } });
}

describe('reduced motion', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('keeps durations when motion is welcome', () => {
		stubMotion(false);
		expect(reducedMotion()).toBe(false);
		expect(motionDuration(DURATION.emphasis)).toBe(280);
		expect(flipDuration()).toBe(DURATION.normal);
	});

	it('drops every duration to zero under the system setting', () => {
		stubMotion(true);
		expect(reducedMotion()).toBe(true);
		expect(motionDuration(DURATION.dramatic)).toBe(0);
		expect(flipDuration()).toBe(0);
	});

	it('honours a page-level reduce preference', () => {
		stubMotion(false, 'reduce');
		expect(motionDuration(200)).toBe(0);
	});

	it('is safe without a window', () => {
		expect(reducedMotion()).toBe(false);
		expect(motionDuration(150)).toBe(150);
	});
});

describe('clock', () => {
	it('matches the composer', () => {
		expect(DURATION).toEqual({ instant: 100, fast: 150, normal: 200, emphasis: 280, dramatic: 350, scene: 800 });
	});
});
