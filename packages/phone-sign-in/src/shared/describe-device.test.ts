import { describe, expect, it } from 'vitest';
import { describeDevice, describePlace, describeSite } from './describe-device';

const UA = {
	claudePane:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/2.26454.2 Chrome/152.0.7977.130 Safari/537.36 MSIX',
	chromeWindows:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
	edgeWindows:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
	chromeAndroid:
		'Mozilla/5.0 (Linux; Android 15; SM-F956U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
	safariIphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
	safariMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
	firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'
};

describe('describeDevice', () => {
	it.each([
		[UA.claudePane, "Claude's browser on Windows"],
		[UA.chromeWindows, 'Chrome on Windows'],
		[UA.edgeWindows, 'Edge on Windows'],
		[UA.chromeAndroid, 'Chrome on Android'],
		[UA.safariIphone, 'Safari on iPhone or iPad'],
		[UA.safariMac, 'Safari on Mac'],
		[UA.firefoxLinux, 'Firefox on Linux']
	])('names %s', (ua, expected) => {
		expect(describeDevice(ua)).toBe(expected);
	});

	it('falls back for an empty or unknown agent', () => {
		expect(describeDevice('')).toBe('A browser');
		expect(describeDevice('curl/8.4.0')).toBe('A browser');
	});
});

describe('describePlace', () => {
	it('joins city, region and country', () => {
		expect(describePlace({ city: 'Chicago', regionCode: 'IL', country: 'US' })).toBe('Chicago, IL, US');
	});

	it('skips missing or non-string parts', () => {
		expect(describePlace({ country: 'US', city: 42 })).toBe('US');
		expect(describePlace(undefined)).toBe('');
	});
});

describe('describeSite', () => {
	const LIVE = 'ringmaster.cirqueaflame.com';

	it('says nothing for the live site', () => {
		expect(describeSite(new URL('https://ringmaster.cirqueaflame.com/api/phone-sign-in'), LIVE)).toBe('');
	});

	it.each([
		['http://127.0.0.1:5231/api/phone-sign-in', 'a local copy (127.0.0.1:5231)'],
		['http://localhost:3000/api/phone-sign-in', 'a local copy (localhost:3000)'],
		['http://app.localhost:5300/x', 'a local copy (app.localhost:5300)'],
		['http://[::1]:5231/x', 'a local copy ([::1]:5231)']
	])('calls %s %s', (url, site) => {
		expect(describeSite(new URL(url), LIVE)).toBe(site);
	});

	it('names any other host', () => {
		expect(describeSite(new URL('https://dev-ringmaster.cirqueaflame.com/x'), LIVE)).toBe('dev-ringmaster.cirqueaflame.com');
		expect(describeSite(new URL('https://abc123.cirque-aflame-admin.pages.dev/x'), LIVE)).toBe(
			'abc123.cirque-aflame-admin.pages.dev'
		);
	});

	it("treats another app's live host as just a host", () => {
		expect(describeSite(new URL('https://tkaflowarts.com/x'), 'tkaflowarts.com')).toBe('');
		expect(describeSite(new URL('https://ringmaster.cirqueaflame.com/x'), 'tkaflowarts.com')).toBe(
			'ringmaster.cirqueaflame.com'
		);
	});
});
