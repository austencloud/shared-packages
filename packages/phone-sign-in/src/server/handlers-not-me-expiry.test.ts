import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../testing/memory-store';
import { createPhoneSignInServer, killSwitchOn, verifiedUserFromClaims } from './handlers';
import { createRequestLifecycle, REQUESTS_COLLECTION } from './requests';
import { asRoute, notUsed, RINGMASTER } from './route-harness.test-support';
import { createServerKeys } from './server-key';
import { createTrustedPhones, type TrustedPhones } from './trusted-phones';

// The pieces that decide when "That wasn't me" signs out for the last time,
// run for real and together: the collect route, collectRequest, the custom
// token, reportNotMe, the not-me route and revokeSessions. Only the edges are
// faked: Firestore (an in-memory store), the service account signer (it hands
// back the claims it was given, so the test can read exp), the OAuth token for
// Identity Toolkit, the caller's ID token, the trusted phone record, and fetch.
// Ported from Ringmaster with its values.
const store = createMemoryStore();
const mocks = {
	env: {} as Record<string, string | undefined>,
	docs: store.docs,
	keyMaterial: new TextEncoder().encode('test service account private key'),
	/** Moves the clock on during the next Firestore read, as a slow read does in a Worker. */
	advanceOnNextRead: 0
};
const getWithRevision = store.getWithRevision;
store.getWithRevision = async (collection, id) => {
	if (mocks.advanceOnNextRead > 0) {
		vi.setSystemTime(Date.now() + mocks.advanceOnNextRead);
		mocks.advanceOnNextRead = 0;
	}
	return getWithRevision(collection, id);
};
const requireAuth = vi.fn<(request: Request) => Promise<unknown>>();
const removeTrustedPhone = vi.fn<TrustedPhones['removeTrustedPhone']>();

const keys = createServerKeys({ secret: () => mocks.keyMaterial, salt: RINGMASTER.salt });
const requests = createRequestLifecycle({ store, keys });
const { createRequest, decideRequest, hashNetwork } = requests;
const routes = createPhoneSignInServer(
	{
		...RINGMASTER,
		store,
		serverSecret: () => mocks.keyMaterial,
		signJwt: async (claims) => JSON.stringify(claims),
		verifyUser: async (request) => verifiedUserFromClaims((await requireAuth(request)) as never),
		rateLimit: notUsed,
		emulator: () => !!mocks.env.FIRESTORE_EMULATOR_HOST,
		accessToken: async () => 'it-token',
		forgetAccessToken: () => {},
		disabled: () => killSwitchOn(mocks.env.PHONE_SIGN_IN_DISABLED),
		dev: false
	},
	{
		requests,
		trustedPhones: {
			...createTrustedPhones({ store, keys, autoPurpose: RINGMASTER.autoPurpose }),
			removeTrustedPhone
		}
	}
);
const collect = asRoute(routes.collect);
const notMe = asRoute(routes.notMe);

/** A whole second, so every offset below is easy to read as "seconds past T0 plus milliseconds". */
const T0 = Date.UTC(2026, 9, 8, 20, 0, 0);
const S0 = T0 / 1000;
const ORIGIN = 'https://ringmaster.test';
const DEVICE = { label: "Claude's browser on Windows", userAgent: 'UA', place: 'Chicago, IL, US', site: '' };
const AUSTEN = { uid: 'austen-uid', email: 'austencloud@gmail.com' };
/**
 * How long past a custom token's exp Identity Toolkit is assumed to still take
 * it (the spec's assumption). The last sign-out has to be later than that.
 */
const ASSUMED_LEEWAY_SECONDS = 30;

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

/** The validSince, in seconds, of the nth accounts:update call. */
function validSince(call: number): number {
	return Number(JSON.parse(String(fetchMock.mock.calls[call][1]?.body)).validSince);
}

beforeEach(() => {
	mocks.docs.clear();
	mocks.advanceOnNextRead = 0;
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	fetchMock.mockReset().mockImplementation(async () => new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetchMock);
	vi.mocked(removeTrustedPhone).mockReset().mockResolvedValue(undefined);
	// The caller is Austen on his phone, signed in with Google a few seconds ago.
	vi.mocked(requireAuth).mockReset().mockImplementation(
		async () =>
			({
				sub: AUSTEN.uid,
				email: AUSTEN.email,
				admin: true,
				firebase: { sign_in_provider: 'google.com' },
				iat: Math.floor(Date.now() / 1000) - 5,
				auth_time: S0 - 86_400
			}) as never
	);
	// Every timer is faked: the route really waits, and only the test moves the clock.
	vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('the last sign-out of "That wasn\'t me"', () => {
	it('lands after the last second a token collected just before a second boundary could make a session', async () => {
		// An automatic approval, as the trusted phone makes it.
		const home = await hashNetwork('203.0.113.9');
		const created = await createRequest(DEVICE, { hash: home, family: 'ipv4' }, T0);
		await decideRequest(
			created.id,
			'approve',
			AUSTEN,
			{ approverNetwork: home, approverFamily: 'ipv4', confirmDifferentNetwork: false, method: 'auto' },
			T0 + 2000
		);

		// The computer polls at 5.999 s. The Firestore read inside collectRequest
		// takes 1.5 s, so a mint that read its own clock would land in the 7th
		// second and sign a token that outlives usedAt plus its lifetime.
		vi.setSystemTime(T0 + 5999);
		mocks.advanceOnNextRead = 1500;
		const collected = await collect({
			request: new Request(`${ORIGIN}/api/phone-sign-in/${created.id}/collect`, {
				method: 'POST',
				body: JSON.stringify({ secret: created.secret })
			}),
			params: { id: created.id }
		} as never);
		const answer = (await collected.json()) as { status: string; token: string };
		expect(answer.status).toBe('approved');
		expect(Date.now()).toBe(T0 + 5999 + 1500);

		const stored = mocks.docs.get(`${REQUESTS_COLLECTION}/${created.id}`)!.data;
		const usedAt = (stored.usedAt as Date).getTime();
		expect(usedAt).toBe(T0 + 5999);
		const claims = JSON.parse(answer.token) as { iat: number; exp: number };
		// Same clock for the mint and for usedAt, by construction.
		expect(claims.iat).toBe(S0 + 5);
		expect(claims.exp).toBe(S0 + 5 + 30);
		expect(claims.exp).toBeLessThanOrEqual(Math.floor(usedAt / 1000) + 30);

		// Austen taps "That wasn't me" 4.5 s after the computer collected.
		vi.setSystemTime(T0 + 12_000);
		const pending = notMe({
			request: new Request(`${ORIGIN}/api/phone-sign-in/${created.id}/not-me`, { method: 'POST', body: '{}' }),
			params: { id: created.id }
		} as never);

		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(validSince(0)).toBe(S0 + 12);

		// The token's life, the assumed leeway and one second of rounding end at
		// usedAt + 61 s, which is 54.999 s from now.
		await vi.advanceTimersByTimeAsync(54_998);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		const response = await pending;
		expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });

		// A session made from the token carries an auth_time of at most exp plus
		// the leeway, and Firebase revokes it only when auth_time is below
		// validSince. So validSince has to be strictly greater than that.
		expect(validSince(1)).toBeGreaterThan(claims.exp + ASSUMED_LEEWAY_SECONDS);
		expect(validSince(1)).toBeGreaterThan(validSince(0));
		expect(vi.getTimerCount()).toBe(0);
	});
});
