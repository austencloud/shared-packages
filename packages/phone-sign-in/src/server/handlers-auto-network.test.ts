import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../testing/memory-store';
import { createPhoneSignInServer, killSwitchOn, verifiedUserFromClaims } from './handlers';
import { createRequestLifecycle, REQUESTS_COLLECTION } from './requests';
import { asRoute, notUsed, RINGMASTER, testServerSecret } from './route-harness.test-support';
import { createServerKeys } from './server-key';
import { createTrustedPhones, type TrustedPhones } from './trusted-phones';

// The create route, the automatic approval route and decideRequest run for real
// against an in-memory Firestore, so these tests can see whether a request was
// approved. The signature check is the one stand-in: it is not what is tested.
// Ported from Ringmaster with its values.
const store = createMemoryStore();
const mocks = { env: {} as Record<string, string | undefined>, dev: false };
// A dev server stamps loopback callers with this computer's public address (requester-address.ts).
const publicAddress = vi.fn(async () => '198.51.100.7');
const requireAuth = vi.fn<(request: Request) => Promise<unknown>>();
const checkRateLimit =
	vi.fn<
		(check: { route: string; ip: string; limit: number; windowMs: number }) => Promise<{ allowed: boolean; count: number }>
	>();
const verifyAutoSignature = vi.fn<TrustedPhones['verifyAutoSignature']>();

const keys = createServerKeys({ secret: testServerSecret, salt: RINGMASTER.salt });
const routes = createPhoneSignInServer(
	{
		...RINGMASTER,
		store,
		serverSecret: testServerSecret,
		signJwt: notUsed,
		verifyUser: async (request) => verifiedUserFromClaims((await requireAuth(request)) as never),
		rateLimit: async (check) => (await checkRateLimit(check)).allowed,
		emulator: () => false,
		accessToken: notUsed,
		forgetAccessToken: notUsed,
		disabled: () => killSwitchOn(mocks.env.PHONE_SIGN_IN_DISABLED),
		// The live site's rules unless a test says otherwise.
		get dev() {
			return mocks.dev;
		}
	},
	{
		requests: createRequestLifecycle({ store, keys }),
		trustedPhones: {
			...createTrustedPhones({ store, keys, autoPurpose: RINGMASTER.autoPurpose }),
			verifyAutoSignature
		},
		publicAddress
	}
);
const create = asRoute(routes.create);
const auto = asRoute(routes.auto);

const ORIGIN = 'https://ringmaster.test';
const SIGNATURE = 'S'.repeat(86);
const NOW = Date.UTC(2026, 9, 8, 20, 0, 0);
const NOW_SECONDS = NOW / 1000;

const addressOf = (ip: string) => () => ip;

/** The computer asks to sign in from `ip`; returns the request id. */
async function askFrom(ip: string): Promise<string> {
	const response = await create({
		request: new Request(`${ORIGIN}/api/phone-sign-in`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 Chrome/141.0.0.0' },
			body: '{}'
		}),
		url: new URL(`${ORIGIN}/api/phone-sign-in`),
		getClientAddress: addressOf(ip)
	} as never);
	return (await response.json()).id;
}

/** The trusted phone approves by itself from `ip`. */
const approveFrom = (id: string, ip: string) =>
	auto({
		request: new Request(`${ORIGIN}/api/phone-sign-in/${id}/auto`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
			body: JSON.stringify({ signature: SIGNATURE })
		}),
		params: { id },
		getClientAddress: addressOf(ip)
	} as never);

const stored = (id: string) => store.docs.get(`${REQUESTS_COLLECTION}/${id}`)!;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'], now: NOW });
	store.docs.clear();
	delete mocks.env.PHONE_SIGN_IN_DISABLED;
	mocks.dev = false;
	vi.mocked(requireAuth).mockReset().mockResolvedValue({
		sub: 'austen-uid',
		email: 'austencloud@gmail.com',
		admin: true,
		firebase: { sign_in_provider: 'google.com' },
		iat: NOW_SECONDS - 5,
		auth_time: NOW_SECONDS - 86_400
	} as never);
	vi.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true, count: 1 });
	vi.mocked(verifyAutoSignature).mockReset().mockResolvedValue(true);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('automatic approval and the network a request came from', () => {
	it('approves when the phone and the computer share a public address', async () => {
		const id = await askFrom('203.0.113.9');
		const response = await approveFrom(id, '203.0.113.9');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'approved' });
		expect(stored(id).data).toMatchObject({ status: 'approved', method: 'auto', approverSameNetwork: true });
	});

	// Under vite dev behind the tunnel the server sees its own loopback address for
	// every caller, so the phone and any computer would otherwise look like one network.
	it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.1.20', '10.0.0.5', 'fe80::1'])(
		'answers 409 different-network and approves nothing when both come from %s',
		async (ip) => {
			const id = await askFrom(ip);
			expect(stored(id).data.network).toBe('');
			const before = stored(id).revision;

			const response = await approveFrom(id, ip);
			expect(verifyAutoSignature).toHaveBeenCalledWith('austen-uid', id, SIGNATURE);
			expect(response.status).toBe(409);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'different-network' });

			expect(stored(id).revision).toBe(before);
			expect(stored(id).data.status).toBe('pending');
			expect(stored(id).data.method).toBeUndefined();
			expect(stored(id).data.decidedBy).toBeUndefined();
		}
	);

	it('answers 409 different-network when only the phone is on a loopback address', async () => {
		const id = await askFrom('203.0.113.9');
		const response = await approveFrom(id, '127.0.0.1');
		expect(response.status).toBe(409);
		expect(stored(id).data.status).toBe('pending');
	});

	it('answers 409 different-network when only the computer is on a loopback address', async () => {
		const id = await askFrom('127.0.0.1');
		const response = await approveFrom(id, '203.0.113.9');
		expect(response.status).toBe(409);
		expect(stored(id).data.status).toBe('pending');
	});

	describe('a request from a local dev server', () => {
		beforeEach(() => {
			mocks.dev = true;
		});

		it("approves when the phone shares this computer's public address", async () => {
			const id = await askFrom('127.0.0.1');
			const response = await approveFrom(id, '198.51.100.7');
			expect(response.status).toBe(200);
			expect(stored(id).data).toMatchObject({ status: 'approved', method: 'auto', approverSameNetwork: true });
		});

		it('answers 409 different-network when the phone is elsewhere', async () => {
			const id = await askFrom('127.0.0.1');
			const response = await approveFrom(id, '203.0.113.9');
			expect(response.status).toBe(409);
			expect(stored(id).data.status).toBe('pending');
		});
	});
});
