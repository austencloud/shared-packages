import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeDevice } from '../shared/describe-device';
import { createMemoryStore } from '../testing/memory-store';
import { createPhoneSignInServer, killSwitchOn, verifiedUserFromClaims } from './handlers';
import { createRequestLifecycle } from './requests';
import type { RevokeSessions } from './revoke-sessions';
import { asRoute, error, notUsed, RINGMASTER, testServerSecret } from './route-harness.test-support';
import { createServerKeys } from './server-key';
import type { TrustedPhones } from './trusted-phones';

// Ringmaster's route tests (auto, not-me, trusted-phone), ported: the routes
// are the package's handlers with Ringmaster's values, called the way
// SvelteKit calls a +server.ts route. The same edges are stand-ins.
const mocks = { env: {} as Record<string, string | undefined> };
const requireAuth = vi.fn<(request: Request) => Promise<unknown>>();

const store = createMemoryStore();
// hashNetwork is the real one, so it needs the key material the server keys come from.
const real = createRequestLifecycle({
	store,
	keys: createServerKeys({ secret: testServerSecret, salt: RINGMASTER.salt })
});
const { hashNetwork } = real;
const decideRequest = vi.fn<typeof real.decideRequest>();
const reportNotMe = vi.fn<typeof real.reportNotMe>();
const enrollTrustedPhone = vi.fn<TrustedPhones['enrollTrustedPhone']>();
const verifyAutoSignature = vi.fn<TrustedPhones['verifyAutoSignature']>();
const removeTrustedPhone = vi.fn<TrustedPhones['removeTrustedPhone']>();
const revokeSessions = vi.fn<RevokeSessions>();

const routes = createPhoneSignInServer(
	{
		...RINGMASTER,
		store,
		serverSecret: testServerSecret,
		signJwt: notUsed,
		verifyUser: async (request) => verifiedUserFromClaims((await requireAuth(request)) as never),
		rateLimit: notUsed,
		emulator: () => false,
		accessToken: notUsed,
		forgetAccessToken: notUsed,
		disabled: () => killSwitchOn(mocks.env.PHONE_SIGN_IN_DISABLED),
		dev: false
	},
	{
		requests: { ...real, decideRequest, reportNotMe },
		trustedPhones: { enrollTrustedPhone, verifyAutoSignature, removeTrustedPhone },
		revokeSessions
	}
);
const auto = asRoute(routes.auto);
const notMe = asRoute(routes.notMe);
const trust = asRoute(routes.trust);
const stopTrusting = asRoute(routes.stopTrusting);

const ID = 'AbCdEfGhIjKlMnOpQr12';
const ORIGIN = 'https://ringmaster.test';
const PHONE_IP = '203.0.113.9';
const SIGNATURE = 'S'.repeat(86);
const PHONE_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const OFF_MESSAGE = { error: 'Phone sign-in is turned off.' };
const NOT_GOOGLE = { error: 'Approve from a phone signed in with Google.' };
const TOO_OLD = { error: 'Your sign-in is too old. Reload this page and try again.' };
const NOW = Date.UTC(2026, 9, 8, 20, 0, 0);
const NOW_SECONDS = NOW / 1000;
const austen = { uid: 'austen-uid', email: 'austencloud@gmail.com' };

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
	return new Request(`${ORIGIN}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: 'Bearer t', ...headers },
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

/** What Firestore's own error text looks like: the document path carries the uid. */
const storeError = (verb: string) =>
	new Error(`Firestore ${verb} /trusted_phones/austen-uid failed (503): unavailable`);

/** Silences the console and returns, as text, everything the routes sent to it. */
function captureConsole() {
	const spies = (['error', 'warn', 'log'] as const).map((method) =>
		vi.spyOn(console, method).mockImplementation(() => {})
	);
	return () => JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
}

/** A real P-256 key pair's halves, so the key checks run the real parser against real keys. */
let publicJwk: JsonWebKey;
let privateJwk: JsonWebKey;

beforeAll(async () => {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
	publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
	privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

beforeEach(() => {
	// Only Date is frozen: the token age check reads the clock, and nothing here waits on a timer.
	vi.useFakeTimers({ toFake: ['Date'], now: NOW });
	delete mocks.env.PHONE_SIGN_IN_DISABLED;
	vi.mocked(requireAuth).mockReset().mockResolvedValue(adminToken() as never);
	vi.mocked(decideRequest).mockReset();
	vi.mocked(reportNotMe).mockReset();
	vi.mocked(enrollTrustedPhone).mockReset().mockResolvedValue(undefined);
	vi.mocked(verifyAutoSignature).mockReset().mockResolvedValue(true);
	vi.mocked(removeTrustedPhone).mockReset().mockResolvedValue(undefined);
	vi.mocked(revokeSessions).mockReset().mockResolvedValue(true);
});

const callAuto = (body: unknown = { signature: SIGNATURE }, id = ID, ip: string | null = PHONE_IP) =>
	auto({
		request: post(`/api/phone-sign-in/${id}/auto`, body),
		params: { id },
		getClientAddress: addressOf(ip)
	} as never);

const callTrust = (body: unknown = { publicKey: publicJwk }, request?: Request) =>
	trust({
		request: request ?? post('/api/phone-sign-in/trusted-phone', body, { 'user-agent': PHONE_UA })
	} as never);

const callStop = () =>
	stopTrusting({
		request: new Request(`${ORIGIN}/api/phone-sign-in/trusted-phone`, {
			method: 'DELETE',
			headers: { authorization: 'Bearer t' }
		})
	} as never);

const callNotMe = (id = ID) =>
	notMe({ request: post(`/api/phone-sign-in/${id}/not-me`, {}), params: { id } } as never);

/** The routes that need a fresh Google sign-in, with the work each must not do when it refuses. */
const gated = [
	{
		name: 'POST /api/phone-sign-in/[id]/auto',
		call: () => callAuto(),
		didNothing: () => {
			expect(verifyAutoSignature).not.toHaveBeenCalled();
			expect(decideRequest).not.toHaveBeenCalled();
		}
	},
	{
		name: 'POST /api/phone-sign-in/trusted-phone',
		call: () => callTrust(),
		didNothing: () => expect(enrollTrustedPhone).not.toHaveBeenCalled()
	},
	{
		name: 'POST /api/phone-sign-in/[id]/not-me',
		call: () => callNotMe(),
		didNothing: () => {
			expect(reportNotMe).not.toHaveBeenCalled();
			expect(removeTrustedPhone).not.toHaveBeenCalled();
			expect(revokeSessions).not.toHaveBeenCalled();
		}
	}
];

describe.each(gated)('$name: fresh Google sign-in', ({ call, didNothing }) => {
	const expectRefused = async (response: Response, code: number, body: unknown) => {
		expect(response.status).toBe(code);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual(body);
		didNothing();
	};

	it('needs an admin', async () => {
		vi.mocked(requireAuth).mockImplementation(async () => error(403, 'admin role required'));
		expect(await status(call())).toBe(403);
		didNothing();
	});

	it.each(['custom', 'password', 'anonymous', 'github.com', 'Google.com', ''])(
		'refuses a %j sign-in with a 403',
		async (provider) => {
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: { sign_in_provider: provider } }) as never);
			await expectRefused(await call(), 403, NOT_GOOGLE);
		}
	);

	it('refuses a token with no sign-in provider at all', async () => {
		vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: undefined }) as never);
		await expectRefused(await call(), 403, NOT_GOOGLE);
	});

	it('refuses a token issued 301 seconds ago with a 401', async () => {
		vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat: NOW_SECONDS - 301 }) as never);
		await expectRefused(await call(), 401, TOO_OLD);
	});

	it('refuses a token with no usable issue time', async () => {
		for (const iat of [undefined, null, 'soon', Number.NaN]) {
			vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat }) as never);
			await expectRefused(await call(), 401, TOO_OLD);
		}
	});
});

describe('POST /api/phone-sign-in/[id]/auto', () => {
	it('approves for the trusted phone, from the network it is on', async () => {
		vi.mocked(decideRequest).mockResolvedValue('approved');
		const response = await callAuto();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'approved' });
		expect(verifyAutoSignature).toHaveBeenCalledWith('austen-uid', ID, SIGNATURE);
		expect(decideRequest).toHaveBeenCalledWith(ID, 'approve', austen, {
			approverNetwork: await hashNetwork(PHONE_IP),
			approverFamily: 'ipv4',
			confirmDifferentNetwork: false,
			method: 'auto'
		});
	});

	it('checks the signature before it decides anything', async () => {
		const order: string[] = [];
		vi.mocked(verifyAutoSignature).mockImplementation(async () => {
			order.push('verify');
			return true;
		});
		vi.mocked(decideRequest).mockImplementation(async () => {
			order.push('decide');
			return 'approved';
		});
		await callAuto();
		expect(order).toEqual(['verify', 'decide']);
	});

	it('takes the approver from the verified token, never from the body', async () => {
		vi.mocked(decideRequest).mockResolvedValue('approved');
		await callAuto({ signature: SIGNATURE, uid: 'attacker-uid', email: 'attacker@example.com' });
		expect(verifyAutoSignature).toHaveBeenCalledWith('austen-uid', ID, SIGNATURE);
		expect(vi.mocked(decideRequest).mock.calls[0][2]).toEqual(austen);
	});

	it('has no way to confirm a different network', async () => {
		vi.mocked(decideRequest).mockResolvedValue('approved');
		for (const value of [true, 'true', 1]) {
			vi.mocked(decideRequest).mockClear();
			await callAuto({ signature: SIGNATURE, confirmDifferentNetwork: value });
			expect(vi.mocked(decideRequest).mock.calls[0][3]).toMatchObject({
				confirmDifferentNetwork: false,
				method: 'auto'
			});
		}
	});

	it('answers 409 different-network when the phone is on another network', async () => {
		vi.mocked(decideRequest).mockResolvedValue('confirm-network');
		const response = await callAuto(undefined, ID, '198.51.100.7');
		expect(response.status).toBe(409);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'different-network' });
		expect(vi.mocked(decideRequest).mock.calls[0][3]).toEqual({
			approverNetwork: await hashNetwork('198.51.100.7'),
			approverFamily: 'ipv4',
			confirmDifferentNetwork: false,
			method: 'auto'
		});
	});

	it('sends an empty approver network and family when the phone address is unavailable', async () => {
		vi.mocked(decideRequest).mockResolvedValue('confirm-network');
		await callAuto(undefined, ID, null);
		expect(vi.mocked(decideRequest).mock.calls[0][3]).toEqual({
			approverNetwork: '',
			approverFamily: '',
			confirmDifferentNetwork: false,
			method: 'auto'
		});
	});

	// Under vite dev behind the tunnel the server sees only its own loopback address,
	// and a private or link-local address names no connection either, so none of
	// them is a network the phone could share with the computer.
	it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.5', '192.168.1.20', '169.254.10.20', 'fe80::1', 'fd12::1'])(
		'sends an empty approver network and family for the non-public address %s',
		async (ip) => {
			vi.mocked(decideRequest).mockResolvedValue('confirm-network');
			const response = await callAuto(undefined, ID, ip);
			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({ status: 'different-network' });
			expect(vi.mocked(decideRequest).mock.calls[0][3]).toEqual({
				approverNetwork: '',
				approverFamily: '',
				confirmDifferentNetwork: false,
				method: 'auto'
			});
		}
	);

	it('passes expired and already-decided through as a 200', async () => {
		for (const result of ['expired', 'already-decided'] as const) {
			vi.mocked(decideRequest).mockResolvedValue(result);
			const response = await callAuto();
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: result });
		}
	});

	it('answers 404 for a request that does not exist', async () => {
		vi.mocked(decideRequest).mockResolvedValue('not-found');
		expect(await status(callAuto())).toBe(404);
	});

	describe('a store failure', () => {
		const failures = {
			'while it checks the signature': () => vi.mocked(verifyAutoSignature).mockRejectedValue(storeError('GET')),
			'while it decides': () => vi.mocked(decideRequest).mockRejectedValue(storeError('UPDATE'))
		};

		it.each(Object.keys(failures) as Array<keyof typeof failures>)(
			'answers 500 with a plain message, and neither the body nor the log has the uid, %s',
			async (when) => {
				const printed = captureConsole();
				failures[when]();
				const response = await callAuto();
				expect(response.status).toBe(500);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual({ error: 'Could not approve automatically.' });

				expect(printed()).toContain('503');
				expect(printed()).not.toContain('austen-uid');
			}
		);

		it('does not call it a bad signature, so the phone keeps its key', async () => {
			captureConsole();
			failures['while it checks the signature']();
			const response = await callAuto();
			expect(response.status).not.toBe(403);
			expect(decideRequest).not.toHaveBeenCalled();
		});
	});

	describe('not trusted', () => {
		const expectNotTrusted = async (response: Response) => {
			expect(response.status).toBe(403);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'not-trusted' });
			expect(decideRequest).not.toHaveBeenCalled();
		};

		it('answers 403 and never decides when the signature check fails', async () => {
			vi.mocked(verifyAutoSignature).mockResolvedValue(false);
			await expectNotTrusted(await callAuto());
			expect(verifyAutoSignature).toHaveBeenCalledTimes(1);
		});

		it('answers 403 only for a signature that fails verification, never for one that was not read', async () => {
			vi.mocked(verifyAutoSignature).mockResolvedValue(false);
			for (const signature of ['', 'not-a-signature', 'S'.repeat(86), 'S'.repeat(900)]) {
				vi.mocked(verifyAutoSignature).mockClear();
				await expectNotTrusted(await callAuto({ signature }));
				expect(verifyAutoSignature).toHaveBeenCalledWith('austen-uid', ID, signature);
			}
		});
	});

	// The phone forgets its key on a 403 not-trusted, so a body the server could
	// not read must never look like one: it answers 400, and the phone shows the
	// tap flow with its key kept.
	describe('a request that could not be read', () => {
		const expectUnreadable = async (response: Response) => {
			expect(response.status).toBe(400);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ error: 'This request could not be read.' });
			expect(verifyAutoSignature).not.toHaveBeenCalled();
			expect(decideRequest).not.toHaveBeenCalled();
		};

		it('answers 400 for a missing or non-string signature, without checking one', async () => {
			for (const body of [{}, { signature: 42 }, { signature: null }, { signature: ['S'] }, { signature: { s: 1 } }]) {
				await expectUnreadable(await callAuto(body));
			}
		});

		it('answers 400 for a missing body and for one that is not a JSON object', async () => {
			const garbage = [
				post(`/api/phone-sign-in/${ID}/auto`),
				new Request(`${ORIGIN}/x`, { method: 'POST', body: '' }),
				new Request(`${ORIGIN}/x`, { method: 'POST', body: '{"signature":"S' }),
				new Request(`${ORIGIN}/x`, { method: 'POST', body: '{not json' }),
				new Request(`${ORIGIN}/x`, { method: 'POST', body: 'null' }),
				new Request(`${ORIGIN}/x`, { method: 'POST', body: `["${SIGNATURE}"]` }),
				new Request(`${ORIGIN}/x`, { method: 'POST', body: `"${SIGNATURE}"` })
			];
			for (const request of garbage) {
				await expectUnreadable(
					await auto({ request, params: { id: ID }, getClientAddress: addressOf(PHONE_IP) } as never)
				);
			}
		});

		it('answers 400 for a body over 1 KB, without checking a signature', async () => {
			await expectUnreadable(await callAuto({ signature: SIGNATURE, padding: 'x'.repeat(1100) }));

			const declared = new Request(`${ORIGIN}/x`, {
				method: 'POST',
				headers: { 'content-length': '1025' },
				body: JSON.stringify({ signature: SIGNATURE })
			});
			await expectUnreadable(
				await auto({ request: declared, params: { id: ID }, getClientAddress: addressOf(PHONE_IP) } as never)
			);
		});

		it('answers 400 for a body that fails while it is read', async () => {
			const broken = new ReadableStream<Uint8Array>({
				pull(controller) {
					controller.error(new Error('connection reset'));
				}
			});
			const request = new Request(`${ORIGIN}/x`, { method: 'POST', body: broken, duplex: 'half' } as RequestInit);
			await expectUnreadable(
				await auto({ request, params: { id: ID }, getClientAddress: addressOf(PHONE_IP) } as never)
			);
		});
	});

	describe('a body at the size limit', () => {
		it('accepts a body of exactly 1 KB', async () => {
			vi.mocked(decideRequest).mockResolvedValue('approved');
			const shell = JSON.stringify({ signature: SIGNATURE, padding: '' });
			const body = JSON.stringify({ signature: SIGNATURE, padding: 'x'.repeat(1024 - shell.length) });
			expect(body).toHaveLength(1024);
			const request = new Request(`${ORIGIN}/x`, { method: 'POST', body });
			const response = await auto({
				request,
				params: { id: ID },
				getClientAddress: addressOf(PHONE_IP)
			} as never);
			expect(response.status).toBe(200);
		});
	});

	it('answers before the body is read when the sign-in is refused', async () => {
		vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: { sign_in_provider: 'custom' } }) as never);
		const request = post(`/api/phone-sign-in/${ID}/auto`, { signature: SIGNATURE });
		const response = await auto({ request, params: { id: ID }, getClientAddress: addressOf(PHONE_IP) } as never);
		expect(response.status).toBe(403);
		expect(request.bodyUsed).toBe(false);
	});

	it('answers 404 for an id that is not 20 letters and digits, before checking a signature', async () => {
		for (const id of ['nope', '../users', 'AbCdEfGhIjKlMnOpQr1', 'AbCdEfGhIjKlMnOpQr123', 'AbCdEfGhIjKlMnOpQr1-']) {
			expect(await status(callAuto({ signature: SIGNATURE }, id))).toBe(404);
		}
		expect(verifyAutoSignature).not.toHaveBeenCalled();
		expect(decideRequest).not.toHaveBeenCalled();
	});

	describe('kill switch', () => {
		it('answers 503 for 1 and true, before the sign-in is even checked', async () => {
			for (const value of ['1', 'true']) {
				turnOff(value);
				const response = await callAuto();
				expect(response.status).toBe(503);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual(OFF_MESSAGE);
			}
			expect(requireAuth).not.toHaveBeenCalled();
			expect(verifyAutoSignature).not.toHaveBeenCalled();
			expect(decideRequest).not.toHaveBeenCalled();
		});

		it('stays on for any other value', async () => {
			vi.mocked(decideRequest).mockResolvedValue('approved');
			for (const value of ['', '0', 'false', 'no']) {
				turnOff(value);
				expect((await callAuto()).status).toBe(200);
			}
		});
	});
});

describe('POST /api/phone-sign-in/trusted-phone', () => {
	it('enrolls the key under the caller, labelled by the phone browser', async () => {
		const response = await callTrust();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'trusted' });

		const label = describeDevice(PHONE_UA);
		expect(label).toContain('Chrome');
		expect(enrollTrustedPhone).toHaveBeenCalledTimes(1);
		// Only the two coordinates go on; the JWK's other members are dropped.
		expect(enrollTrustedPhone).toHaveBeenCalledWith('austen-uid', { x: publicJwk.x, y: publicJwk.y }, label);
	});

	it('takes the account from the verified token, never from the body', async () => {
		await callTrust({ publicKey: publicJwk, uid: 'attacker-uid', sub: 'attacker-uid' });
		expect(vi.mocked(enrollTrustedPhone).mock.calls[0][0]).toBe('austen-uid');
	});

	it('labels a phone that sends no user agent with the plain fallback', async () => {
		const request = new Request(`${ORIGIN}/x`, {
			method: 'POST',
			body: JSON.stringify({ publicKey: publicJwk })
		});
		expect(request.headers.get('user-agent')).toBeNull();
		await callTrust(undefined, request);
		expect(enrollTrustedPhone).toHaveBeenCalledWith(
			'austen-uid',
			{ x: publicJwk.x, y: publicJwk.y },
			describeDevice('')
		);
	});

	describe('a key the server cannot use', () => {
		const expectRejected = async (response: Response) => {
			expect(response.status).toBe(400);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ error: 'This phone sent a key Ringmaster cannot use.' });
			expect(enrollTrustedPhone).not.toHaveBeenCalled();
		};

		it('refuses an RSA key', async () => {
			await expectRejected(await callTrust({ publicKey: { kty: 'RSA', n: 'x'.repeat(342), e: 'AQAB' } }));
		});

		it('refuses a body with no publicKey', async () => {
			await expectRejected(await callTrust({}));
			await expectRejected(await callTrust({ publicKey: null }));
			await expectRejected(await callTrust({ publicKey: 'not a key' }));
		});

		it('refuses a private key', async () => {
			await expectRejected(await callTrust({ publicKey: { ...publicJwk, d: privateJwk.d } }));
		});

		it('refuses a body that is not a JSON object', async () => {
			for (const body of ['{not json', 'null', `[${JSON.stringify(publicJwk)}]`]) {
				const request = new Request(`${ORIGIN}/x`, { method: 'POST', body });
				await expectRejected(await callTrust(undefined, request));
			}
		});

		it('refuses a body over 1 KB', async () => {
			await expectRejected(await callTrust({ publicKey: publicJwk, padding: 'x'.repeat(1100) }));

			const declared = new Request(`${ORIGIN}/x`, {
				method: 'POST',
				headers: { 'content-length': '1025' },
				body: JSON.stringify({ publicKey: publicJwk })
			});
			await expectRejected(await callTrust(undefined, declared));
		});
	});

	describe('kill switch', () => {
		it('answers 503 and enrolls nothing, before the sign-in is even checked', async () => {
			for (const value of ['1', 'true']) {
				turnOff(value);
				const response = await callTrust();
				expect(response.status).toBe(503);
				expect(response.headers.get('cache-control')).toBe('no-store');
				expect(await response.json()).toEqual(OFF_MESSAGE);
			}
			expect(requireAuth).not.toHaveBeenCalled();
			expect(enrollTrustedPhone).not.toHaveBeenCalled();
		});
	});
});

describe('a store failure on /api/phone-sign-in/trusted-phone', () => {
	it('POST answers 500 with a plain message, and neither the body nor the log has the uid', async () => {
		const printed = captureConsole();
		vi.mocked(enrollTrustedPhone).mockRejectedValue(storeError('SET'));
		const response = await callTrust();
		expect(response.status).toBe(500);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ error: 'Could not trust this phone right now.' });

		expect(printed()).toContain('503');
		expect(printed()).not.toContain('austen-uid');
	});

	it('DELETE answers 500 with a plain message, and neither the body nor the log has the uid', async () => {
		const printed = captureConsole();
		vi.mocked(removeTrustedPhone).mockRejectedValue(storeError('DELETE'));
		const response = await callStop();
		expect(response.status).toBe(500);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ error: 'Could not stop automatic approval right now.' });

		expect(printed()).toContain('503');
		expect(printed()).not.toContain('austen-uid');
	});
});

describe('DELETE /api/phone-sign-in/trusted-phone', () => {
	const expectRemoved = async (response: Response) => {
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'removed' });
		expect(removeTrustedPhone).toHaveBeenCalledWith('austen-uid');
	};

	it('removes the caller\'s record for a fresh Google sign-in', async () => {
		await expectRemoved(await callStop());
		expect(removeTrustedPhone).toHaveBeenCalledTimes(1);
	});

	it('removes it for a session this feature minted, and for a token an hour old', async () => {
		vi.mocked(requireAuth).mockResolvedValue(adminToken({ firebase: { sign_in_provider: 'custom' } }) as never);
		await expectRemoved(await callStop());

		vi.mocked(removeTrustedPhone).mockClear();
		vi.mocked(requireAuth).mockResolvedValue(adminToken({ iat: NOW_SECONDS - 3600 }) as never);
		await expectRemoved(await callStop());
	});

	it('works with phone sign-in switched off', async () => {
		turnOff();
		await expectRemoved(await callStop());
	});

	it('lets requireAuth\'s refusal through and removes nothing', async () => {
		vi.mocked(requireAuth).mockImplementation(async () => error(403, 'admin role required'));
		expect(await status(callStop())).toBe(403);

		vi.mocked(requireAuth).mockImplementation(async () => error(401, 'Missing authorization header'));
		expect(await status(callStop())).toBe(401);
		expect(removeTrustedPhone).not.toHaveBeenCalled();
	});
});

describe('POST /api/phone-sign-in/[id]/not-me', () => {
	/** What reportNotMe answers once it has recorded the report; `collectedAt` null means the computer never collected. */
	const reported = (collectedAt: number | null) => ({ status: 'reported' as const, collectedAt });
	const NOT_FOUND = { status: 'not-found' as const };

	// This route waits on a real timer when a token could still be in use, so
	// every timer is faked here, not only Date. A wait only ends when the test
	// advances the clock.
	beforeEach(() => {
		vi.useRealTimers();
		vi.useFakeTimers({ now: NOW });
	});

	it('blocks the request, turns off automatic approval and signs the account out', async () => {
		vi.mocked(reportNotMe).mockResolvedValue(reported(null));
		const response = await callNotMe();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: true });
		expect(reportNotMe).toHaveBeenCalledWith(ID, 'austen-uid');
		expect(removeTrustedPhone).toHaveBeenCalledWith('austen-uid');
		expect(revokeSessions).toHaveBeenCalledWith('austen-uid');
	});

	it('marks the request before it removes the phone or revokes anything', async () => {
		const order: string[] = [];
		vi.mocked(reportNotMe).mockImplementation(async () => {
			order.push('report');
			return reported(null);
		});
		vi.mocked(removeTrustedPhone).mockImplementation(async () => {
			order.push('remove');
		});
		vi.mocked(revokeSessions).mockImplementation(async () => {
			order.push('revoke');
			return true;
		});
		await callNotMe();
		expect(order[0]).toBe('report');
		expect(order.slice(1).sort()).toEqual(['remove', 'revoke']);
	});

	it('takes the account from the verified token, never from the body', async () => {
		vi.mocked(reportNotMe).mockResolvedValue(reported(null));
		await notMe({
			request: post(`/api/phone-sign-in/${ID}/not-me`, { uid: 'attacker-uid', sub: 'attacker-uid' }),
			params: { id: ID }
		} as never);
		expect(reportNotMe).toHaveBeenCalledWith(ID, 'austen-uid');
		expect(removeTrustedPhone).toHaveBeenCalledWith('austen-uid');
		expect(revokeSessions).toHaveBeenCalledWith('austen-uid');
	});

	it('says the sessions were not revoked when Identity Toolkit refused', async () => {
		vi.mocked(reportNotMe).mockResolvedValue(reported(null));
		vi.mocked(revokeSessions).mockResolvedValue(false);
		expect(await (await callNotMe()).json()).toEqual({
			status: 'reported',
			signedOut: false,
			autoOff: true,
			blocked: true
		});
		expect(removeTrustedPhone).toHaveBeenCalledTimes(1);
	});

	it('says automatic approval is still on when the record could not be removed, and still revokes', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(reportNotMe).mockResolvedValue(reported(null));
		vi.mocked(removeTrustedPhone).mockRejectedValue(new Error('firestore is down'));
		const response = await callNotMe();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: false, blocked: true });
		expect(revokeSessions).toHaveBeenCalledWith('austen-uid');
	});

	// "That wasn't me" always signs out. A request it cannot find, or one this
	// account did not decide, is treated as one whose state is unknown.
	describe('a request it cannot find, or that this account did not decide', () => {
		it('still removes the trusted phone, signs out, waits the full window and signs out again, then answers 200', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(NOT_FOUND);
			const pending = callNotMe();
			await vi.advanceTimersByTimeAsync(0);
			expect(removeTrustedPhone).toHaveBeenCalledWith('austen-uid');
			expect(revokeSessions).toHaveBeenCalledTimes(1);

			// A token minted just before now dies at NOW + 30 s; the leeway and the
			// second's rounding bring the last sign-out to NOW + 61 s.
			await vi.advanceTimersByTimeAsync(60_999);
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(revokeSessions).toHaveBeenCalledTimes(2);

			const response = await pending;
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });
		});

		it('says what failed, as it does for any other request', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(NOT_FOUND);
			vi.mocked(removeTrustedPhone).mockRejectedValue(new Error('firestore is down'));
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(revokeSessions).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
			const pending = callNotMe();
			await vi.advanceTimersByTimeAsync(61_000);
			expect(await (await pending).json()).toEqual({
				status: 'reported',
				signedOut: false,
				autoOff: false,
				blocked: false
			});
		});
	});

	it('answers 404 for an id that is not 20 letters and digits, before looking anything up', async () => {
		for (const id of ['nope', '../users', 'AbCdEfGhIjKlMnOpQr123']) {
			expect(await status(callNotMe(id))).toBe(404);
		}
		expect(reportNotMe).not.toHaveBeenCalled();
		expect(removeTrustedPhone).not.toHaveBeenCalled();
		expect(revokeSessions).not.toHaveBeenCalled();
	});

	it('works with phone sign-in switched off, because it answers a compromise', async () => {
		turnOff();
		vi.mocked(reportNotMe).mockResolvedValue(reported(null));
		const response = await callNotMe();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: true });
		expect(removeTrustedPhone).toHaveBeenCalledTimes(1);
		expect(revokeSessions).toHaveBeenCalledTimes(1);
	});

	// A custom token can be traded for a session until it expires (30 seconds
	// after it was collected, plus up to 30 seconds of assumed leeway), and such
	// a session has a later auth_time than the first sign-out, so the route signs
	// out a second time once the token is dead. The second sign-out's validSince
	// is the deadline itself: collected + 30 s life + 30 s leeway + 1 s rounding.
	describe('a token the computer collected may still be in use', () => {
		/** Starts the request without waiting for it, so the test can move the clock while it waits. */
		const start = () => callNotMe();

		it('signs out once and does not wait when the computer never collected', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(null));
			const response = await callNotMe();
			expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: true });
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			expect(reportNotMe).toHaveBeenCalledTimes(1);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('collected 10 seconds ago: signs out again only after the token expires, about 51 seconds on', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 10_000));
			const pending = start();
			await vi.advanceTimersByTimeAsync(0);
			expect(revokeSessions).toHaveBeenCalledTimes(1);

			// The token dies at NOW + 20 s, its leeway at NOW + 50 s; the last
			// sign-out waits one more second.
			await vi.advanceTimersByTimeAsync(50_999);
			expect(revokeSessions).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(revokeSessions).toHaveBeenCalledTimes(2);

			const response = await pending;
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });
			expect(removeTrustedPhone).toHaveBeenCalledTimes(1);
			// A report that worked is not repeated. The first sign-out takes the
			// current time; the second takes the deadline.
			expect(reportNotMe).toHaveBeenCalledTimes(1);
			expect(vi.mocked(revokeSessions).mock.calls).toEqual([['austen-uid'], ['austen-uid', NOW + 51_000]]);
		});

		it('does not answer until the second sign-out is done', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 10_000));
			let answered = false;
			const pending = Promise.resolve(start()).then((response) => {
				answered = true;
				return response;
			});
			await vi.advanceTimersByTimeAsync(50_999);
			expect(answered).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			await pending;
			expect(answered).toBe(true);
		});

		it('collected 2 minutes ago: the token is dead, so one sign-out and no wait', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 120_000));
			const response = await callNotMe();
			expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('collected 61 seconds ago: one sign-out; 60.5 seconds ago: half a second of leeway is left, so a second one', async () => {
			// 61 s after collection the token's life, its leeway and the rounding
			// second are all over. A little earlier a session could still be made
			// after the first sign-out, so the second one goes out.
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 61_000));
			await callNotMe();
			expect(revokeSessions).toHaveBeenCalledTimes(1);

			vi.mocked(revokeSessions).mockClear();
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 60_500));
			const pending = start();
			await vi.advanceTimersByTimeAsync(499);
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(revokeSessions).toHaveBeenCalledTimes(2);
			await pending;
		});

		// Only the collect write sets `usedAt`, and the rules keep clients out of
		// the collection. If one is wrong anyway, the route still signs out, and the
		// wait never goes past a token's life from now.
		it('never waits longer than the full window, however far ahead a stored usedAt claims', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW + 3_600_000));
			const pending = start();
			await vi.advanceTimersByTimeAsync(60_999);
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(revokeSessions).toHaveBeenCalledTimes(2);
			expect(vi.mocked(revokeSessions).mock.calls[1]).toEqual(['austen-uid', NOW + 61_000]);
			expect(await (await pending).json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });
			expect(vi.getTimerCount()).toBe(0);
		});

		it('signs out once, without waiting, for a usedAt long ago', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(0));
			const response = await callNotMe();
			expect((await response.json()).signedOut).toBe(true);
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('when recording the report throws: still answers 200, treats the token as possibly in use, and does not claim it was blocked', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(reportNotMe).mockRejectedValue(new Error('firestore is down'));
			const pending = start();
			await vi.advanceTimersByTimeAsync(0);
			expect(removeTrustedPhone).toHaveBeenCalledWith('austen-uid');
			expect(revokeSessions).toHaveBeenCalledTimes(1);

			// Unknown, so a token minted just before now: it dies at NOW + 30 s,
			// its leeway at NOW + 60 s, and the last sign-out waits one more second.
			await vi.advanceTimersByTimeAsync(60_999);
			expect(revokeSessions).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(revokeSessions).toHaveBeenCalledTimes(2);

			const response = await pending;
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });
			// It tried the report once more after the wait, and that failed too.
			expect(reportNotMe).toHaveBeenCalledTimes(2);
			expect(vi.mocked(revokeSessions).mock.calls).toEqual([['austen-uid'], ['austen-uid', NOW + 61_000]]);
			expect(vi.getTimerCount()).toBe(0);
		});

		// The first report failed, so the request may have been approved and
		// collected while the route waited. reportNotMe is safe to repeat, and
		// once it works the request can no longer be collected.
		describe('when the first report failed', () => {
			const failFirst = {
				'threw': () => vi.mocked(reportNotMe).mockRejectedValueOnce(new Error('firestore is down')),
				'found nothing': () => vi.mocked(reportNotMe).mockResolvedValueOnce(NOT_FOUND)
			};

			it.each(Object.keys(failFirst) as Array<keyof typeof failFirst>)(
				'and %s: a pass the computer collected during the wait is waited out too, then signed out once more',
				async (how) => {
					vi.spyOn(console, 'error').mockImplementation(() => {});
					failFirst[how]();
					// Collected 20 seconds into the wait.
					vi.mocked(reportNotMe).mockResolvedValueOnce(reported(NOW + 20_000));
					const pending = start();

					await vi.advanceTimersByTimeAsync(60_999);
					expect(revokeSessions).toHaveBeenCalledTimes(1);
					expect(reportNotMe).toHaveBeenCalledTimes(1);
					await vi.advanceTimersByTimeAsync(1);
					expect(revokeSessions).toHaveBeenCalledTimes(2);

					// Collected at NOW + 20 s: life, leeway and rounding end at NOW + 81 s.
					await vi.advanceTimersByTimeAsync(19_999);
					expect(revokeSessions).toHaveBeenCalledTimes(2);
					await vi.advanceTimersByTimeAsync(1);
					expect(revokeSessions).toHaveBeenCalledTimes(3);

					const response = await pending;
					expect(await response.json()).toEqual({ status: 'reported', signedOut: true, autoOff: true, blocked: false });
					expect(vi.mocked(revokeSessions).mock.calls).toEqual([
						['austen-uid'],
						['austen-uid', NOW + 61_000],
						['austen-uid', NOW + 81_000]
					]);
					// One extra round at most: no third report, no fourth sign-out.
					expect(reportNotMe).toHaveBeenCalledTimes(2);
					expect(vi.getTimerCount()).toBe(0);
				}
			);

			it('a pass collected before the route started was already covered, so no extra sign-out', async () => {
				vi.spyOn(console, 'error').mockImplementation(() => {});
				vi.mocked(reportNotMe).mockRejectedValueOnce(new Error('firestore is down'));
				vi.mocked(reportNotMe).mockResolvedValueOnce(reported(NOW - 5_000));
				const pending = start();
				await vi.advanceTimersByTimeAsync(61_000);

				expect(reportNotMe).toHaveBeenCalledTimes(2);
				expect(revokeSessions).toHaveBeenCalledTimes(2);
				expect(await (await pending).json()).toEqual({
					status: 'reported',
					signedOut: true,
					autoOff: true,
					blocked: false
				});
			});

			it('a report that works now and finds nothing collected says the request was blocked', async () => {
				vi.spyOn(console, 'error').mockImplementation(() => {});
				vi.mocked(reportNotMe).mockRejectedValueOnce(new Error('firestore is down'));
				vi.mocked(reportNotMe).mockResolvedValueOnce(reported(null));
				const pending = start();
				await vi.advanceTimersByTimeAsync(61_000);

				expect(revokeSessions).toHaveBeenCalledTimes(2);
				expect(await (await pending).json()).toEqual({
					status: 'reported',
					signedOut: true,
					autoOff: true,
					blocked: true
				});
			});

			it('never repeats the report more than once', async () => {
				vi.spyOn(console, 'error').mockImplementation(() => {});
				vi.mocked(reportNotMe).mockRejectedValue(new Error('firestore is down'));
				const pending = start();
				await vi.advanceTimersByTimeAsync(10 * 60_000);
				await pending;
				expect(reportNotMe).toHaveBeenCalledTimes(2);
				expect(revokeSessions).toHaveBeenCalledTimes(2);
			});
		});

		it('logs a failed report without the account uid', async () => {
			const error = vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(reportNotMe).mockRejectedValue(
				new Error('Firestore GET /trusted_phones/austen-uid failed (503): unavailable')
			);
			vi.mocked(removeTrustedPhone).mockRejectedValue(
				new Error('Firestore DELETE /trusted_phones/austen-uid failed (503): unavailable')
			);
			const pending = start();
			await vi.advanceTimersByTimeAsync(61_000);
			await pending;

			// The report is tried twice (before and after the wait) and the phone record once.
			expect(error).toHaveBeenCalledTimes(3);
			const logged = JSON.stringify(error.mock.calls);
			expect(logged).toContain('503');
			expect(logged).not.toContain('austen-uid');
		});

		it('says the account is not signed out when the second sign-out fails', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 10_000));
			vi.mocked(revokeSessions).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
			const pending = start();
			await vi.advanceTimersByTimeAsync(51_000);
			expect(revokeSessions).toHaveBeenCalledTimes(2);
			expect(await (await pending).json()).toEqual({
				status: 'reported',
				signedOut: false,
				autoOff: true,
				blocked: false
			});
		});

		it('says the account is not signed out when only the first sign-out fails', async () => {
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 10_000));
			vi.mocked(revokeSessions).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
			const pending = start();
			await vi.advanceTimersByTimeAsync(51_000);
			expect(revokeSessions).toHaveBeenCalledTimes(2);
			expect((await (await pending).json()).signedOut).toBe(false);
		});

		it('says automatic approval is still on when the record cannot be removed, and still signs out again', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(reportNotMe).mockResolvedValue(reported(NOW - 10_000));
			vi.mocked(removeTrustedPhone).mockRejectedValue(new Error('firestore is down'));
			const pending = start();
			await vi.advanceTimersByTimeAsync(51_000);
			expect(await (await pending).json()).toEqual({
				status: 'reported',
				signedOut: true,
				autoOff: false,
				blocked: false
			});
			expect(removeTrustedPhone).toHaveBeenCalledTimes(1);
		});
	});
});
