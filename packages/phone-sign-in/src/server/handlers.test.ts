import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../testing/memory-store';
import { createPhoneSignInServer, killSwitchOn, verifiedUserFromClaims } from './handlers';
import { createRequestLifecycle } from './requests';
import { asRoute, error, notUsed, RINGMASTER, testServerSecret } from './route-harness.test-support';
import { createServerKeys } from './server-key';

// Ringmaster's route tests (create, lookup, decision, collect), ported: the
// routes are the package's handlers with Ringmaster's values, called the way
// SvelteKit calls a +server.ts route. The same edges are stand-ins.
const mocks = { env: {} as Record<string, string | undefined>, dev: false };
const requireAuth = vi.fn<(request: Request) => Promise<unknown>>();
const checkRateLimit =
	vi.fn<
		(check: { route: string; ip: string; limit: number; windowMs: number }) => Promise<{ allowed: boolean; count: number }>
	>();
const createCustomToken = vi.fn<(uid: string, now?: number) => Promise<string>>();
// A dev server looks up this computer's public address; never over the network in tests.
const publicAddress = vi.fn(async () => '198.51.100.7');

const store = createMemoryStore();
// hashNetwork is the real one, so it needs the key material the server keys come from.
const real = createRequestLifecycle({
	store,
	keys: createServerKeys({ secret: testServerSecret, salt: RINGMASTER.salt })
});
const { hashNetwork } = real;
const createRequest = vi.fn<typeof real.createRequest>();
const getRequestSummary = vi.fn<typeof real.getRequestSummary>();
const decideRequest = vi.fn<typeof real.decideRequest>();
const collectRequest = vi.fn<typeof real.collectRequest>();

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
		get dev() {
			return mocks.dev;
		}
	},
	{
		requests: { ...real, createRequest, getRequestSummary, decideRequest, collectRequest },
		mintCustomToken: (uid, now) => createCustomToken(uid, now),
		publicAddress
	}
);
const create = asRoute(routes.create);
const summary = asRoute(routes.lookup);
const decide = asRoute(routes.decision);
const collect = asRoute(routes.collect);

const ID = 'AbCdEfGhIjKlMnOpQr12';
const PANE_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/2.26454.2 Chrome/152.0.7977.130 Safari/537.36 MSIX';
const ORIGIN = 'https://ringmaster.test';
const COMPUTER_IP = '203.0.113.9';
const OFF_MESSAGE = { error: 'Phone sign-in is turned off.' };
const NOT_GOOGLE = { error: 'Approve from a phone signed in with Google.' };
const TOO_OLD = { error: 'Your sign-in is too old. Reload this page and try again.' };
const NOW = Date.UTC(2026, 9, 7, 20, 0, 0);
const NOW_SECONDS = NOW / 1000;

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
	return new Request(`${ORIGIN}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

async function status(result: Response | Promise<Response>): Promise<number> {
	try {
		return (await result).status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}

function addressOf(ip: string | null) {
	return () => {
		if (ip === null) throw new Error('no client address');
		return ip;
	};
}

/** What requireAuth returns for the admin's phone: a Google sign-in whose ID token was just refreshed. */
function adminToken(overrides: Record<string, unknown> = {}) {
	return {
		sub: 'austen-uid',
		email: 'austencloud@gmail.com',
		admin: true,
		firebase: { sign_in_provider: 'google.com' },
		iat: NOW_SECONDS - 5,
		auth_time: NOW_SECONDS - 86_400,
		...overrides
	};
}

function turnOff(value = '1') {
	mocks.env.PHONE_SIGN_IN_DISABLED = value;
}

afterEach(() => {
	vi.useRealTimers();
});

beforeEach(() => {
	// Only Date is frozen: the token age check reads the clock, and nothing here waits on a timer.
	vi.useFakeTimers({ toFake: ['Date'], now: NOW });
	delete mocks.env.PHONE_SIGN_IN_DISABLED;
	mocks.dev = false;
	vi.mocked(requireAuth).mockReset().mockResolvedValue(adminToken() as never);
	vi.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true, count: 1 });
	vi.mocked(createCustomToken).mockReset().mockResolvedValue('custom-token');
	vi.mocked(createRequest).mockReset();
	vi.mocked(getRequestSummary).mockReset();
	vi.mocked(decideRequest).mockReset();
	vi.mocked(collectRequest).mockReset();
});

describe('POST /api/phone-sign-in', () => {
	const call = (
		options: {
			ua?: string;
			headers?: Record<string, string>;
			request?: Request;
			ip?: string | null;
			origin?: string;
		} = {}
	) =>
		create({
			request:
				options.request ??
				post('/api/phone-sign-in', {}, { 'user-agent': options.ua ?? PANE_UA, ...options.headers }),
			url: new URL(`${options.origin ?? ORIGIN}/api/phone-sign-in`),
			platform: { cf: { city: 'Chicago', regionCode: 'IL', country: 'US' } },
			getClientAddress: addressOf(options.ip === undefined ? COMPUTER_IP : options.ip)
		} as never);

	const created = {
		id: ID,
		code: '482173',
		secret: 'the-secret',
		expiresAt: new Date('2026-10-07T20:03:00Z'),
		expiresInMs: 180_000
	};

	it('creates a request described by its browser, place and network', async () => {
		vi.mocked(createRequest).mockResolvedValue(created);
		const response = await call();
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			id: ID,
			code: '482173',
			secret: 'the-secret',
			expiresAt: '2026-10-07T20:03:00.000Z',
			expiresInMs: 180_000,
			approveUrl: `https://ringmaster.cirqueaflame.com/sign-in/${ID}`
		});
		const network = await hashNetwork(COMPUTER_IP);
		expect(network).toMatch(/^[0-9a-f]{64}$/);
		expect(createRequest).toHaveBeenCalledWith(
			{ label: "Claude's browser on Windows", userAgent: PANE_UA, place: 'Chicago, IL, US', site: 'ringmaster.test' },
			{ hash: network, family: 'ipv4' }
		);
		expect(checkRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ route: 'phone-sign-in-create', ip: COMPUTER_IP, limit: 10, windowMs: 600_000 })
		);
	});

	describe('from a local copy', () => {
		const LOCAL = 'http://127.0.0.1:5231';
		const HOME = '198.51.100.7';

		it('sends the phone to the live site and says which copy asked', async () => {
			vi.mocked(createRequest).mockResolvedValue(created);
			const response = await call({ origin: LOCAL, ip: '127.0.0.1' });
			expect((await response.json()).approveUrl).toBe(`https://ringmaster.cirqueaflame.com/sign-in/${ID}`);
			expect(vi.mocked(createRequest).mock.calls[0][0].site).toBe('a local copy (127.0.0.1:5231)');
		});

		it("stamps a dev server's request with this computer's public network", async () => {
			mocks.dev = true;
			vi.mocked(createRequest).mockResolvedValue(created);
			await call({ origin: LOCAL, ip: '127.0.0.1' });
			expect(vi.mocked(createRequest).mock.calls[0][1]).toEqual({ hash: await hashNetwork(HOME), family: 'ipv4' });
		});

		it("stamps a tunnel visitor with the visitor's own network", async () => {
			mocks.dev = true;
			vi.mocked(createRequest).mockResolvedValue(created);
			await call({
				origin: 'https://dev-ringmaster.cirqueaflame.com',
				ip: '127.0.0.1',
				headers: { 'cf-connecting-ip': '203.0.113.50' }
			});
			expect(vi.mocked(createRequest).mock.calls[0][1]).toEqual({
				hash: await hashNetwork('203.0.113.50'),
				family: 'ipv4'
			});
			expect(vi.mocked(createRequest).mock.calls[0][0].site).toBe('dev-ringmaster.cirqueaflame.com');
		});

		it('keeps a loopback caller unknown in a production build', async () => {
			vi.mocked(createRequest).mockResolvedValue(created);
			await call({ origin: LOCAL, ip: '127.0.0.1' });
			expect(vi.mocked(createRequest).mock.calls[0][1]).toEqual({ hash: '', family: '' });
		});

		it('rate limits by the raw caller address', async () => {
			mocks.dev = true;
			vi.mocked(createRequest).mockResolvedValue(created);
			await call({ origin: LOCAL, ip: '127.0.0.1' });
			expect(checkRateLimit).toHaveBeenCalledWith(expect.objectContaining({ ip: '127.0.0.1' }));
		});
	});

	it('never passes the raw address on to be stored', async () => {
		vi.mocked(createRequest).mockResolvedValue(created);
		await call();
		expect(JSON.stringify(vi.mocked(createRequest).mock.calls)).not.toContain(COMPUTER_IP);
	});

	it('stores no network when the address is unavailable', async () => {
		vi.mocked(createRequest).mockResolvedValue(created);
		await call({ ip: null });
		expect(vi.mocked(createRequest).mock.calls[0][1]).toEqual({ hash: '', family: '' });
	});

	it('refuses past the rate limit without creating anything', async () => {
		vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, count: 11 });
		const response = await call();
		expect(response.status).toBe(429);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(createRequest).not.toHaveBeenCalled();
	});

	describe('content type', () => {
		it('answers 415 when the body is not declared as JSON, before the rate limit', async () => {
			for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
				const response = await call({ headers: { 'content-type': type } });
				expect(response.status).toBe(415);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual({ error: 'Expected JSON' });
			}
			expect(checkRateLimit).not.toHaveBeenCalled();
			expect(createRequest).not.toHaveBeenCalled();
		});

		it('answers 415 when there is no content type at all', async () => {
			const bare = new Request(`${ORIGIN}/api/phone-sign-in`, { method: 'POST' });
			expect(bare.headers.get('content-type')).toBeNull();
			expect((await call({ request: bare })).status).toBe(415);
			expect(createRequest).not.toHaveBeenCalled();
		});

		it('accepts application/json with a charset', async () => {
			vi.mocked(createRequest).mockResolvedValue(created);
			const response = await call({ headers: { 'content-type': 'application/json; charset=utf-8' } });
			expect(response.status).toBe(200);
		});
	});

	describe('origin', () => {
		it('answers 403 when the Origin header is another site, without touching the rate limit', async () => {
			for (const origin of ['https://evil.example', 'http://ringmaster.test', 'null']) {
				const response = await call({ headers: { origin } });
				expect(response.status).toBe(403);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual({ error: 'Wrong origin' });
			}
			expect(checkRateLimit).not.toHaveBeenCalled();
			expect(createRequest).not.toHaveBeenCalled();
		});

		it('accepts the same origin, and a request that sends no Origin', async () => {
			vi.mocked(createRequest).mockResolvedValue(created);
			expect((await call({ headers: { origin: ORIGIN } })).status).toBe(200);
			expect((await call()).status).toBe(200);
		});
	});

	describe('kill switch', () => {
		it('answers 503 for 1 and true, without a rate limit check or a new request', async () => {
			for (const value of ['1', 'true']) {
				turnOff(value);
				const response = await call();
				expect(response.status).toBe(503);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual(OFF_MESSAGE);
			}
			expect(checkRateLimit).not.toHaveBeenCalled();
			expect(createRequest).not.toHaveBeenCalled();
		});

		it('stays on for any other value', async () => {
			vi.mocked(createRequest).mockResolvedValue(created);
			for (const value of ['', '0', 'false', 'no']) {
				turnOff(value);
				expect((await call()).status).toBe(200);
			}
		});
	});
});

describe('GET /api/phone-sign-in/[id]', () => {
	const call = (id = ID, ip: string | null = COMPUTER_IP) =>
		summary({
			request: new Request(`${ORIGIN}/api/phone-sign-in/${id}`, {
				headers: { authorization: 'Bearer t' }
			}),
			params: { id },
			getClientAddress: addressOf(ip)
		} as never);

	async function pendingRequest(askedFrom: string | null = COMPUTER_IP) {
		vi.mocked(getRequestSummary).mockResolvedValue({
			status: 'pending',
			code: '482173',
			device: {
				label: "Claude's browser on Windows",
				userAgent: PANE_UA,
				place: 'Chicago, IL, US',
				site: 'a local copy (127.0.0.1:5231)'
			},
			network: askedFrom === null ? '' : await hashNetwork(askedFrom),
			createdAt: new Date('2026-10-07T20:00:00Z'),
			expiresAt: new Date('2026-10-07T20:03:00Z'),
			ageMs: 42_000,
			expiresInMs: 138_000
		});
	}

	it('needs an admin', async () => {
		vi.mocked(requireAuth).mockImplementation(async () => error(403, 'admin role required'));
		expect(await status(call())).toBe(403);
		expect(getRequestSummary).not.toHaveBeenCalled();
	});

	it('returns the code, device label, place and site, but not the user agent or the network hash', async () => {
		await pendingRequest();
		const response = await call();
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			status: 'pending',
			code: '482173',
			device: { label: "Claude's browser on Windows", place: 'Chicago, IL, US', site: 'a local copy (127.0.0.1:5231)' },
			createdAt: '2026-10-07T20:00:00.000Z',
			expiresAt: '2026-10-07T20:03:00.000Z',
			ageMs: 42_000,
			expiresInMs: 138_000,
			sameNetwork: true
		});
	});

	it('says whether the phone is on the network that asked', async () => {
		await pendingRequest('203.0.113.9');
		expect((await (await call(ID, '203.0.113.9')).json()).sameNetwork).toBe(true);
		expect((await (await call(ID, '198.51.100.7')).json()).sameNetwork).toBe(false);
	});

	it('treats two addresses in one IPv6 /64 as the same network', async () => {
		await pendingRequest('2001:db8:1234:5678:aaaa:bbbb:cccc:1111');
		expect((await (await call(ID, '2001:db8:1234:5678::2222')).json()).sameNetwork).toBe(true);
		expect((await (await call(ID, '2001:db8:1234:9999::1')).json()).sameNetwork).toBe(false);
	});

	it('is false when the phone address is unavailable', async () => {
		await pendingRequest();
		expect((await (await call(ID, null)).json()).sameNetwork).toBe(false);
	});

	it('is false when the request stored no network', async () => {
		await pendingRequest(null);
		expect((await (await call()).json()).sameNetwork).toBe(false);
	});

	it('is false when neither side is known', async () => {
		await pendingRequest(null);
		expect((await (await call(ID, null)).json()).sameNetwork).toBe(false);
	});

	it('still answers while phone sign-in is turned off', async () => {
		turnOff();
		await pendingRequest();
		expect((await call()).status).toBe(200);
	});

	it('404s for an unknown or malformed id', async () => {
		vi.mocked(getRequestSummary).mockResolvedValue(null);
		expect(await status(call())).toBe(404);
		expect(await status(call('../users'))).toBe(404);
	});
});

describe('POST /api/phone-sign-in/[id]/decision', () => {
	const call = (body: unknown, id = ID, ip: string | null = COMPUTER_IP) =>
		decide({
			request: post(`/api/phone-sign-in/${id}/decision`, body, { authorization: 'Bearer t' }),
			params: { id },
			getClientAddress: addressOf(ip)
		} as never);

	const austen = { uid: 'austen-uid', email: 'austencloud@gmail.com' };

	it('needs an admin', async () => {
		vi.mocked(requireAuth).mockImplementation(async () => error(401, 'Missing authorization header'));
		expect(await status(call({ decision: 'approve' }))).toBe(401);
		expect(decideRequest).not.toHaveBeenCalled();
	});

	describe('fresh Google sign-in', () => {
		const expectRefused = async (response: Response, status: number, body: unknown) => {
			expect(response.status).toBe(status);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual(body);
			expect(decideRequest).not.toHaveBeenCalled();
		};

		it.each(['custom', 'password', 'anonymous', 'phone', 'github.com', 'Google.com', ''])(
			'refuses a %j sign-in with a 403 and decides nothing',
			async (provider) => {
				vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: { sign_in_provider: provider } }) as never);
				await expectRefused(await call({ decision: 'approve' }), 403, NOT_GOOGLE);
			}
		);

		it('refuses a token with no sign-in provider at all', async () => {
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: {} }) as never);
			await expectRefused(await call({ decision: 'approve' }), 403, NOT_GOOGLE);

			vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: undefined }) as never);
			await expectRefused(await call({ decision: 'approve' }), 403, NOT_GOOGLE);
		});

		it('refuses a session this feature minted, even with the network confirmation set', async () => {
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: { sign_in_provider: 'custom' } }) as never);
			await expectRefused(
				await call({ decision: 'approve', confirmDifferentNetwork: true }),
				403,
				NOT_GOOGLE
			);
		});

		it('refuses a token issued 301 seconds ago with a 401', async () => {
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat: NOW_SECONDS - 301 }) as never);
			await expectRefused(await call({ decision: 'approve' }), 401, TOO_OLD);
		});

		it('refuses a denial from an old token too', async () => {
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat: NOW_SECONDS - 3600 }) as never);
			await expectRefused(await call({ decision: 'deny' }), 401, TOO_OLD);
		});

		it('refuses a token with no usable issue time', async () => {
			for (const iat of [undefined, null, 'soon', Number.NaN]) {
				vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat }) as never);
				await expectRefused(await call({ decision: 'approve' }), 401, TOO_OLD);
			}
		});

		it('accepts a fresh Google token, including one exactly 300 seconds old', async () => {
			vi.mocked(decideRequest).mockResolvedValue('approved');
			for (const age of [0, 5, 299, 300, -30]) {
				vi.mocked(decideRequest).mockClear();
				vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat: NOW_SECONDS - age }) as never);
				const response = await call({ decision: 'approve' });
				expect(response.status).toBe(200);
				expect(decideRequest).toHaveBeenCalledTimes(1);
			}
		});

		it('does not depend on how long ago the Google sign-in itself was', async () => {
			vi.mocked(decideRequest).mockResolvedValue('approved');
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ auth_time: NOW_SECONDS - 30 * 86_400 }) as never);
			expect((await call({ decision: 'approve' })).status).toBe(200);
		});

		it('answers before the body is read', async () => {
			const attempt = (request: Request) =>
				decide({ request, params: { id: ID }, getClientAddress: addressOf(COMPUTER_IP) } as never);

			vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: { sign_in_provider: 'custom' } }) as never);
			const refused = post(`/api/phone-sign-in/${ID}/decision`, { decision: 'approve' });
			expect((await attempt(refused)).status).toBe(403);
			expect(refused.bodyUsed).toBe(false);

			vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat: NOW_SECONDS - 400 }) as never);
			const stale = post(`/api/phone-sign-in/${ID}/decision`, { decision: 'approve' });
			expect((await attempt(stale)).status).toBe(401);
			expect(stale.bodyUsed).toBe(false);
		});
	});

	it('approves as the signed-in admin, from the network the phone is on', async () => {
		vi.mocked(decideRequest).mockResolvedValue('approved');
		const response = await call({ decision: 'approve' });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'approved' });
		expect(decideRequest).toHaveBeenCalledWith(ID, 'approve', austen, {
			approverNetwork: await hashNetwork(COMPUTER_IP),
			approverFamily: 'ipv4',
			confirmDifferentNetwork: false,
			method: 'tap'
		});
	});

	it('takes the approver from the verified token, never from the body', async () => {
		vi.mocked(decideRequest).mockResolvedValue('approved');
		await call({
			decision: 'approve',
			uid: 'attacker-uid',
			sub: 'attacker-uid',
			email: 'attacker@example.com',
			approver: { uid: 'attacker-uid', email: 'attacker@example.com' }
		});
		expect(decideRequest).toHaveBeenCalledTimes(1);
		expect(vi.mocked(decideRequest).mock.calls[0][2]).toEqual(austen);
	});

	it('passes the confirmation only when the body says true', async () => {
		vi.mocked(decideRequest).mockResolvedValue('approved');
		await call({ decision: 'approve', confirmDifferentNetwork: true });
		expect(vi.mocked(decideRequest).mock.calls[0][3]).toMatchObject({ confirmDifferentNetwork: true });

		for (const value of ['true', 1, 'yes', null, {}]) {
			vi.mocked(decideRequest).mockClear();
			await call({ decision: 'approve', confirmDifferentNetwork: value });
			expect(vi.mocked(decideRequest).mock.calls[0][3]).toMatchObject({ confirmDifferentNetwork: false });
		}
	});

	it('asks the phone to confirm with a 409 and no change when the networks differ', async () => {
		vi.mocked(decideRequest).mockResolvedValue('confirm-network');
		const response = await call({ decision: 'approve' }, ID, '198.51.100.7');
		expect(response.status).toBe(409);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'confirm-network' });
		expect(vi.mocked(decideRequest).mock.calls[0][3]).toEqual({
			approverNetwork: await hashNetwork('198.51.100.7'),
			approverFamily: 'ipv4',
			confirmDifferentNetwork: false,
			method: 'tap'
		});
	});

	it('sends an empty approver network when the phone address is unavailable', async () => {
		vi.mocked(decideRequest).mockResolvedValue('confirm-network');
		await call({ decision: 'approve' }, ID, null);
		expect(vi.mocked(decideRequest).mock.calls[0][3]).toEqual({
			approverNetwork: '',
			approverFamily: '',
			confirmDifferentNetwork: false,
			method: 'tap'
		});
	});

	it('denies without any confirmation', async () => {
		vi.mocked(decideRequest).mockResolvedValue('denied');
		const response = await call({ decision: 'deny' });
		expect(await response.json()).toEqual({ status: 'denied' });
		expect(vi.mocked(decideRequest).mock.calls[0][1]).toBe('deny');
	});

	it('reports expired and already-decided requests as before', async () => {
		vi.mocked(decideRequest).mockResolvedValue('expired');
		expect(await (await call({ decision: 'approve' })).json()).toEqual({ status: 'expired' });
		vi.mocked(decideRequest).mockResolvedValue('already-decided');
		expect(await (await call({ decision: 'approve' })).json()).toEqual({ status: 'already-decided' });
	});

	it('rejects anything but approve or deny', async () => {
		expect(await status(call({ decision: 'maybe' }))).toBe(400);
		expect(await status(call(null))).toBe(400);
		expect(decideRequest).not.toHaveBeenCalled();
	});

	it('404s for an unknown or malformed id', async () => {
		vi.mocked(decideRequest).mockResolvedValue('not-found');
		expect(await status(call({ decision: 'approve' }))).toBe(404);
		expect(await status(call({ decision: 'approve' }, 'nope'))).toBe(404);
	});

	it('answers 503 and decides nothing while phone sign-in is turned off', async () => {
		for (const value of ['1', 'true']) {
			turnOff(value);
			const response = await call({ decision: 'approve' });
			expect(response.status).toBe(503);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual(OFF_MESSAGE);
		}
		expect(decideRequest).not.toHaveBeenCalled();
	});
});

describe('POST /api/phone-sign-in/[id]/collect', () => {
	const call = (body: unknown, id = ID) =>
		collect({ request: post(`/api/phone-sign-in/${id}/collect`, body), params: { id } } as never);

	/** A request whose body must never be read, to prove a size check or the kill switch answers first. */
	const unreadable = (headers: Record<string, string>) => {
		const read = vi.fn();
		return {
			request: {
				headers: new Headers(headers),
				get body() {
					read();
					return null;
				}
			},
			read
		};
	};

	const bytes = (text: string) => new TextEncoder().encode(text);

	/**
	 * A request whose body arrives chunk by chunk with no content-length, the way
	 * HTTP/2 may deliver it. It records how much was pulled and whether the
	 * reader gave up on it.
	 */
	function streamed(chunks: Uint8Array[]) {
		const state = { pulled: 0, cancelled: false };
		const body = new ReadableStream<Uint8Array>(
			{
				pull(controller) {
					if (state.pulled >= chunks.length) controller.close();
					else controller.enqueue(chunks[state.pulled++]);
				},
				cancel() {
					state.cancelled = true;
				}
			},
			{ highWaterMark: 0 }
		);
		const request = new Request(`${ORIGIN}/x`, { method: 'POST', body, duplex: 'half' } as RequestInit);
		expect(request.headers.get('content-length')).toBeNull();
		return { request, state };
	}

	it('passes the secret through and returns the token once approved', async () => {
		vi.mocked(collectRequest).mockImplementation(async (_id, _secret, mint) => ({
			status: 'approved',
			token: await mint('austen-uid', Date.now())
		}));
		const response = await call({ secret: 'the-secret' });
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'approved', token: 'custom-token' });
		expect(collectRequest).toHaveBeenCalledWith(ID, 'the-secret', expect.any(Function));
		expect(createCustomToken).toHaveBeenCalledWith('austen-uid', expect.any(Number));
	});

	it('mints with the clock reading collectRequest hands it, not one of its own', async () => {
		const handedOver = Date.UTC(2026, 9, 8, 20, 0, 0) + 999;
		vi.mocked(collectRequest).mockImplementation(async (_id, _secret, mint) => ({
			status: 'approved',
			token: await mint('austen-uid', handedOver)
		}));
		await call({ secret: 'the-secret' });
		expect(createCustomToken).toHaveBeenCalledWith('austen-uid', handedOver);
	});

	it('reports pending without minting', async () => {
		vi.mocked(collectRequest).mockResolvedValue({ status: 'pending' });
		expect(await (await call({ secret: 'the-secret' })).json()).toEqual({ status: 'pending' });
		expect(createCustomToken).not.toHaveBeenCalled();
	});

	it('answers expired for a missing secret or malformed id without a lookup', async () => {
		expect(await (await call({})).json()).toEqual({ status: 'expired' });
		expect(await (await call({ secret: 'x'.repeat(101) })).json()).toEqual({ status: 'expired' });
		expect(await (await call({ secret: 'the-secret' }, 'nope')).json()).toEqual({ status: 'expired' });
		expect(collectRequest).not.toHaveBeenCalled();
	});

	it('answers expired for a body that is not a JSON object, with no-store', async () => {
		const garbage = [
			new Request(`${ORIGIN}/x`, { method: 'POST', body: '{not json' }),
			new Request(`${ORIGIN}/x`, { method: 'POST', body: 'null' }),
			new Request(`${ORIGIN}/x`, { method: 'POST', body: '["the-secret"]' }),
			new Request(`${ORIGIN}/x`, { method: 'POST', body: '"the-secret"' }),
			new Request(`${ORIGIN}/x`, { method: 'POST' })
		];
		for (const request of garbage) {
			const response = await collect({ request, params: { id: ID } } as never);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'expired' });
		}
		expect(collectRequest).not.toHaveBeenCalled();
	});

	describe('body size', () => {
		it('answers expired from content-length alone when it is over 1024, without reading the body', async () => {
			const { request, read } = unreadable({ 'content-length': '1025' });
			const response = await collect({ request, params: { id: ID } } as never);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'expired' });
			expect(read).not.toHaveBeenCalled();
			expect(collectRequest).not.toHaveBeenCalled();
		});

		it('stops reading a streamed body with no content-length once it passes 1024 bytes', async () => {
			// 40 chunks of 100 bytes: far past the cap if the whole stream were read.
			const { request, state } = streamed(Array.from({ length: 40 }, () => bytes('x'.repeat(100))));
			const response = await collect({ request, params: { id: ID } } as never);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'expired' });
			expect(collectRequest).not.toHaveBeenCalled();
			expect(state.cancelled).toBe(true);
			expect(state.pulled).toBeLessThan(40);
		});

		it('stops at the first chunk that crosses the cap, even when that chunk is huge', async () => {
			const { request, state } = streamed([bytes('{"secret":"x'), new Uint8Array(5_000_000), bytes('"}')]);
			expect(await (await collect({ request, params: { id: ID } } as never)).json()).toEqual({
				status: 'expired'
			});
			expect(state.cancelled).toBe(true);
			expect(state.pulled).toBe(2);
		});

		it('counts bytes, not characters', async () => {
			// 600 two-byte characters: under 1024 string characters but 1200 bytes.
			const body = JSON.stringify({ secret: 'the-secret', padding: String.fromCharCode(0xe9).repeat(600) });
			expect(body.length).toBeLessThan(1024);
			const request = new Request(`${ORIGIN}/x`, { method: 'POST', body });
			expect(await (await collect({ request, params: { id: ID } } as never)).json()).toEqual({
				status: 'expired'
			});
			expect(collectRequest).not.toHaveBeenCalled();
		});

		it('still reads a normal streamed body that has no content-length, in several chunks', async () => {
			vi.mocked(collectRequest).mockResolvedValue({ status: 'pending' });
			const full = bytes(JSON.stringify({ secret: 'the-secret' }));
			const { request } = streamed([full.slice(0, 5), full.slice(5, 9), full.slice(9)]);
			expect(await (await collect({ request, params: { id: ID } } as never)).json()).toEqual({
				status: 'pending'
			});
			expect(collectRequest).toHaveBeenCalledWith(ID, 'the-secret', expect.any(Function));
		});

		it('accepts a streamed body of exactly 1024 bytes and refuses one of 1025', async () => {
			vi.mocked(collectRequest).mockResolvedValue({ status: 'pending' });
			const shell = JSON.stringify({ secret: 'the-secret', padding: '' }).length;
			const padded = (total: number) =>
				bytes(JSON.stringify({ secret: 'the-secret', padding: 'x'.repeat(total - shell) }));

			const exact = streamed([padded(1024).slice(0, 700), padded(1024).slice(700)]);
			expect(await (await collect({ request: exact.request, params: { id: ID } } as never)).json()).toEqual({
				status: 'pending'
			});

			const over = streamed([padded(1025).slice(0, 700), padded(1025).slice(700)]);
			expect(await (await collect({ request: over.request, params: { id: ID } } as never)).json()).toEqual({
				status: 'expired'
			});
		});

		it('answers expired for a body that cannot be read', async () => {
			const body = new ReadableStream<Uint8Array>({
				pull() {
					throw new Error('connection reset');
				}
			});
			const request = new Request(`${ORIGIN}/x`, { method: 'POST', body, duplex: 'half' } as RequestInit);
			expect(await (await collect({ request, params: { id: ID } } as never)).json()).toEqual({
				status: 'expired'
			});
			expect(collectRequest).not.toHaveBeenCalled();
		});

		it('answers expired for a body over 1024 characters even with a valid secret and no content-length', async () => {
			const body = JSON.stringify({ secret: 'the-secret', padding: 'x'.repeat(1100) });
			const request = new Request(`${ORIGIN}/x`, { method: 'POST', body });
			const response = await collect({ request, params: { id: ID } } as never);
			expect(await response.json()).toEqual({ status: 'expired' });
			expect(collectRequest).not.toHaveBeenCalled();
		});

		it('accepts a body of exactly 1024 characters and a content-length of exactly 1024', async () => {
			vi.mocked(collectRequest).mockResolvedValue({ status: 'pending' });
			const shell = JSON.stringify({ secret: 'the-secret', padding: '' });
			const body = JSON.stringify({ secret: 'the-secret', padding: 'x'.repeat(1024 - shell.length) });
			expect(body).toHaveLength(1024);

			const exact = new Request(`${ORIGIN}/x`, { method: 'POST', body });
			expect(await (await collect({ request: exact, params: { id: ID } } as never)).json()).toEqual({
				status: 'pending'
			});

			const declared = new Request(`${ORIGIN}/x`, {
				method: 'POST',
				headers: { 'content-length': '1024' },
				body: JSON.stringify({ secret: 'the-secret' })
			});
			expect(declared.headers.get('content-length')).toBe('1024');
			expect(await (await collect({ request: declared, params: { id: ID } } as never)).json()).toEqual({
				status: 'pending'
			});
		});
	});

	describe('kill switch', () => {
		it('answers expired without a lookup or a token, even for an approved request', async () => {
			vi.mocked(collectRequest).mockResolvedValue({ status: 'approved', token: 'should-not-be-sent' });
			for (const value of ['1', 'true']) {
				turnOff(value);
				const response = await call({ secret: 'the-secret' });
				expect(response.status).toBe(200);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual({ status: 'expired' });
			}
			expect(collectRequest).not.toHaveBeenCalled();
			expect(createCustomToken).not.toHaveBeenCalled();
		});

		it('does not even read the body', async () => {
			turnOff();
			const { request, read } = unreadable({});
			await collect({ request, params: { id: ID } } as never);
			expect(read).not.toHaveBeenCalled();
		});
	});
});
