import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../testing/memory-store';
import { createPhoneSignInServer, type SignInNotice } from './handlers';
import { createRequestLifecycle } from './requests';
import { asRoute, notUsed, RINGMASTER, testServerSecret } from './route-harness.test-support';
import { createServerKeys } from './server-key';

// Creating a request with { notify: true } hands it to the app's notifier, and
// the answer says whether a phone took it. The notifier never changes the
// request itself, and a notifier that fails only means the QR code shows.
const store = createMemoryStore();
const requests = createRequestLifecycle({ store, keys: createServerKeys({ secret: testServerSecret, salt: RINGMASTER.salt }) });
const notifyPhones = vi.fn<(notice: SignInNotice) => Promise<boolean>>();

function server(withNotifier: boolean) {
	return createPhoneSignInServer(
		{
			...RINGMASTER,
			store,
			serverSecret: testServerSecret,
			signJwt: notUsed,
			verifyUser: notUsed,
			rateLimit: async () => true,
			emulator: () => false,
			accessToken: notUsed,
			forgetAccessToken: notUsed,
			disabled: () => false,
			dev: false,
			...(withNotifier ? { notifyPhones } : {})
		},
		{ requests, publicAddress: async () => '198.51.100.7' }
	);
}

const ORIGIN = 'https://ringmaster.test';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

function create(body: string | undefined, withNotifier = true) {
	return asRoute(server(withNotifier).create)({
		request: new Request(`${ORIGIN}/api/phone-sign-in`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'user-agent': UA },
			body
		}),
		url: new URL(`${ORIGIN}/api/phone-sign-in`),
		platform: { cf: { city: 'Chicago', regionCode: 'IL', country: 'US' } },
		getClientAddress: () => '203.0.113.9'
	});
}

beforeEach(() => {
	notifyPhones.mockReset().mockResolvedValue(true);
});

describe('POST /api/phone-sign-in with notify', () => {
	it('hands the new request to the notifier and says a phone took it', async () => {
		const response = await create('{"notify":true}');
		const body = (await response.json()) as { id: string; code: string; notified: boolean };

		expect(body.notified).toBe(true);
		expect(notifyPhones).toHaveBeenCalledOnce();
		expect(notifyPhones).toHaveBeenCalledWith({
			id: body.id,
			code: body.code,
			device: { label: 'Chrome on Windows', place: 'Chicago, IL, US', site: 'ringmaster.test' },
			expiresInMs: 180_000
		});
		// The notice describes the request that was stored.
		const summary = await requests.getRequestSummary(body.id);
		expect(summary?.status).toBe('pending');
		expect(summary?.device.label).toBe('Chrome on Windows');
	});

	it('says no phone took it when the notifier found none', async () => {
		notifyPhones.mockResolvedValue(false);
		const response = await create('{"notify":true}');
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ notified: false });
	});

	it('still answers with the request when the notifier throws', async () => {
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
		notifyPhones.mockRejectedValue(new Error('push service down'));
		const response = await create('{"notify":true}');
		expect(response.status).toBe(200);
		const body = (await response.json()) as { id: string; notified: boolean };
		expect(body.notified).toBe(false);
		expect(await requests.getRequestSummary(body.id)).not.toBeNull();
		quiet.mockRestore();
	});

	it.each([
		['an empty object', '{}'],
		['notify not exactly true', '{"notify":"true"}'],
		['no body', undefined],
		['a body that is not JSON', 'notify'],
		['an oversized body', JSON.stringify({ notify: true, pad: 'x'.repeat(2000) })]
	])('does not notify for %s', async (_label, body) => {
		const response = await create(body);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ notified: false });
		expect(notifyPhones).not.toHaveBeenCalled();
	});

	it('answers notified false when the app has no notifier', async () => {
		const response = await create('{"notify":true}', false);
		expect(await response.json()).toMatchObject({ notified: false });
	});
});
