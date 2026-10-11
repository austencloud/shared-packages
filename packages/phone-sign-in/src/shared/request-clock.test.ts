import { describe, expect, it } from 'vitest';
import { ageLabel, askedAgoMs, hasExpired } from './request-clock';

// The server said: asked 45 seconds ago, 135 seconds left. The phone received
// that at LOADED_AT on its own clock, which may be minutes off the server's.
const request = { ageMs: 45_000, expiresInMs: 135_000 };
const LOADED_AT = 5_000_000;

describe('askedAgoMs', () => {
	it('starts at the age the server reported', () => {
		expect(askedAgoMs(request, LOADED_AT, LOADED_AT)).toBe(45_000);
	});

	it('grows with the time since the answer arrived', () => {
		expect(askedAgoMs(request, LOADED_AT, LOADED_AT + 20_000)).toBe(65_000);
	});

	it('does not depend on how wrong the phone clock is, only on elapsed time', () => {
		const skew = 7 * 60_000;
		expect(askedAgoMs(request, LOADED_AT + skew, LOADED_AT + skew + 10_000)).toBe(55_000);
		expect(askedAgoMs(request, LOADED_AT - skew, LOADED_AT - skew + 10_000)).toBe(55_000);
	});

	it('never runs backward when the clock is set back', () => {
		expect(askedAgoMs(request, LOADED_AT, LOADED_AT - 60_000)).toBe(45_000);
	});
});

describe('hasExpired', () => {
	it('is false until the time the server reported has passed', () => {
		expect(hasExpired(request, LOADED_AT, LOADED_AT)).toBe(false);
		expect(hasExpired(request, LOADED_AT, LOADED_AT + 134_999)).toBe(false);
	});

	it('is true from the moment it runs out', () => {
		expect(hasExpired(request, LOADED_AT, LOADED_AT + 135_000)).toBe(true);
		expect(hasExpired(request, LOADED_AT, LOADED_AT + 500_000)).toBe(true);
	});

	it('ignores a wrong phone clock', () => {
		// A phone five minutes ahead of the server would have called this expired on arrival.
		const ahead = 5 * 60_000;
		expect(hasExpired(request, LOADED_AT + ahead, LOADED_AT + ahead)).toBe(false);
		expect(hasExpired(request, LOADED_AT - ahead, LOADED_AT - ahead + 135_000)).toBe(true);
	});

	it('is not tripped by a clock set back', () => {
		expect(hasExpired(request, LOADED_AT, LOADED_AT - 10 * 60_000)).toBe(false);
	});

	it('is expired on arrival when the server had no time left', () => {
		expect(hasExpired({ ageMs: 180_000, expiresInMs: 0 }, LOADED_AT, LOADED_AT)).toBe(true);
	});
});

describe('ageLabel', () => {
	it.each([
		[0, '0 seconds'],
		[999, '0 seconds'],
		[1000, '1 second'],
		[1999, '1 second'],
		[2000, '2 seconds'],
		[59_999, '59 seconds'],
		[60_000, '1 minute'],
		[119_999, '1 minute'],
		[120_000, '2 minutes'],
		[-5000, '0 seconds']
	])('writes %i ms as %s', (ms, label) => {
		expect(ageLabel(ms)).toBe(label);
	});
});
