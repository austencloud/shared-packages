import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionRevoker, RETRY_PAUSE_MS } from './revoke-sessions';

const mocks = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	getScopedAccessToken: vi.fn<(scope: string) => Promise<string>>(),
	forgetScopedAccessToken: vi.fn<(scope: string, token: string) => void>()
}));

const NOW = 1791403200_000;
const ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/projects/cirque-aflame/accounts:update';
// The one scope the public Identity Toolkit v1 discovery document lists for
// projects.accounts.update.
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const ok = () => new Response('{}', { status: 200 });
const refused = (status: number, body = 'refused') => new Response(body, { status });

/** Answers each call in turn with a fresh Response (a Response body can be read only once). */
function answerWith(...answers: Array<() => Response | Promise<Response>>) {
	fetchMock.mockReset();
	for (const answer of answers) fetchMock.mockImplementationOnce(async () => answer());
}

/** Wired the way Ringmaster wires it: project and emulator from the environment, a cloud-platform token. */
const revokeSessions = createSessionRevoker({
	projectId: () => mocks.env.FIREBASE_PROJECT_ID || 'cirque-aflame',
	emulator: () => !!mocks.env.FIRESTORE_EMULATOR_HOST,
	accessToken: () => mocks.getScopedAccessToken(SCOPE),
	forgetAccessToken: (token) => mocks.forgetScopedAccessToken(SCOPE, token)
});

function bodyOf(call: number): unknown {
	return JSON.parse(String(fetchMock.mock.calls[call][1]?.body));
}

beforeEach(() => {
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	mocks.getScopedAccessToken.mockReset();
	mocks.getScopedAccessToken.mockResolvedValue('it-token');
	mocks.forgetScopedAccessToken.mockReset();
	fetchMock.mockReset();
	fetchMock.mockImplementation(async () => ok());
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('revokeSessions', () => {
	it('posts validSince to Identity Toolkit with a token scoped for accounts:update', async () => {
		const result = await revokeSessions('austen-uid', NOW);

		expect(result).toBe(true);
		expect(mocks.getScopedAccessToken).toHaveBeenCalledWith(SCOPE);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(ENDPOINT);
		expect(init?.method).toBe('POST');
		expect(init?.headers).toEqual({
			authorization: 'Bearer it-token',
			'content-type': 'application/json'
		});
		expect(bodyOf(0)).toEqual({ localId: 'austen-uid', validSince: '1791403200' });
	});

	it('rounds validSince down to the whole second, never up', async () => {
		await revokeSessions('austen-uid', NOW + 999);
		await revokeSessions('austen-uid', NOW + 1000);
		await revokeSessions('austen-uid', NOW - 1);

		expect(bodyOf(0)).toEqual({ localId: 'austen-uid', validSince: '1791403200' });
		expect(bodyOf(1)).toEqual({ localId: 'austen-uid', validSince: '1791403201' });
		expect(bodyOf(2)).toEqual({ localId: 'austen-uid', validSince: '1791403199' });
	});

	it('uses the configured project id in the URL', async () => {
		mocks.env.FIREBASE_PROJECT_ID = 'other-project';

		await revokeSessions('austen-uid', NOW);

		expect(fetchMock.mock.calls[0][0]).toBe(
			'https://identitytoolkit.googleapis.com/v1/projects/other-project/accounts:update'
		);
	});

	it('never calls out during an emulator run', async () => {
		mocks.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

		await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
		expect(mocks.getScopedAccessToken).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	describe('a refusal that a second try cannot change', () => {
		it.each([400, 403, 404])('returns false without throwing or retrying on a %i', async (status) => {
			answerWith(() => refused(status, 'denied'));

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(mocks.getScopedAccessToken).toHaveBeenCalledTimes(1);
			expect(mocks.forgetScopedAccessToken).not.toHaveBeenCalled();
		});

		it('returns false without throwing or retrying when the access token cannot be minted', async () => {
			mocks.getScopedAccessToken.mockRejectedValue(new Error('no key'));

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
			expect(mocks.getScopedAccessToken).toHaveBeenCalledTimes(1);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});

	describe('a 401', () => {
		it('forgets the token and tries once more at once with a fresh one', async () => {
			// Not faked timers: an unexpected pause would never finish and fail the test.
			mocks.getScopedAccessToken.mockResolvedValueOnce('stale-token').mockResolvedValueOnce('fresh-token');
			answerWith(() => refused(401, 'expired'), ok);

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(true);

			expect(mocks.forgetScopedAccessToken).toHaveBeenCalledTimes(1);
			expect(mocks.forgetScopedAccessToken).toHaveBeenCalledWith(SCOPE, 'stale-token');
			expect(mocks.getScopedAccessToken).toHaveBeenCalledTimes(2);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('authorization')).toBe('Bearer stale-token');
			expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer fresh-token');
		});

		it('sends the same validSince the second time', async () => {
			answerWith(() => refused(401), ok);
			await revokeSessions('austen-uid', NOW + 999);
			expect(bodyOf(1)).toEqual(bodyOf(0));
			expect(bodyOf(1)).toEqual({ localId: 'austen-uid', validSince: '1791403200' });
		});

		it('returns false after one retry when the fresh token is refused too', async () => {
			answerWith(() => refused(401), () => refused(401));

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(mocks.forgetScopedAccessToken).toHaveBeenCalledTimes(2);
		});

		it('returns false when the fresh token cannot be minted', async () => {
			mocks.getScopedAccessToken.mockResolvedValueOnce('stale-token').mockRejectedValueOnce(new Error('no key'));
			answerWith(() => refused(401));

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
	});

	describe.each([
		['a 429', () => refused(429, 'slow down')],
		['a 500', () => refused(500, 'oops')],
		['a 503', () => refused(503, 'unavailable')]
	])('%s', (_name, failure) => {
		it(`tries once more after ${RETRY_PAUSE_MS} ms, with the same validSince`, async () => {
			vi.useFakeTimers();
			answerWith(failure, ok);

			const pending = revokeSessions('austen-uid', NOW + 999);
			await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS - 1);
			expect(fetchMock).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			await expect(pending).resolves.toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(bodyOf(1)).toEqual({ localId: 'austen-uid', validSince: '1791403200' });
			expect(mocks.forgetScopedAccessToken).not.toHaveBeenCalled();
		});

		it('returns false after one retry when it keeps failing', async () => {
			vi.useFakeTimers();
			answerWith(failure, failure);

			const pending = revokeSessions('austen-uid', NOW);
			await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS);

			await expect(pending).resolves.toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
	});

	describe('a request that fails outright', () => {
		it(`tries once more after ${RETRY_PAUSE_MS} ms`, async () => {
			vi.useFakeTimers();
			fetchMock.mockReset();
			fetchMock.mockRejectedValueOnce(new Error('network down')).mockImplementationOnce(async () => ok());

			const pending = revokeSessions('austen-uid', NOW);
			await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS - 1);
			expect(fetchMock).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			await expect(pending).resolves.toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it('returns false without throwing after one retry when it keeps failing', async () => {
			vi.useFakeTimers();
			fetchMock.mockReset();
			fetchMock.mockRejectedValue(new Error('network down'));

			const pending = revokeSessions('austen-uid', NOW);
			await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS);

			await expect(pending).resolves.toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
	});

	describe('the access token never reaches a log', () => {
		// Each failure below echoes the token back, the way a hostile or sloppy
		// upstream error could, so the test shows the logging strips it.
		const TOKEN = 'ya29.secret-access-token';
		const logged = () =>
			JSON.stringify([...vi.mocked(console.error).mock.calls, ...vi.mocked(console.warn).mock.calls]);

		beforeEach(() => {
			mocks.getScopedAccessToken.mockResolvedValue(TOKEN);
		});

		it('on a 401', async () => {
			fetchMock.mockReset();
			fetchMock.mockImplementation(async () => refused(401, `invalid credentials Bearer ${TOKEN}`));

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
			expect(vi.mocked(console.error)).toHaveBeenCalled();
			expect(logged()).toContain('401');
			expect(logged()).not.toContain(TOKEN);
		});

		it('on a 403', async () => {
			fetchMock.mockReset();
			fetchMock.mockImplementation(async () => refused(403, `caller ${TOKEN} lacks permission`));

			await expect(revokeSessions('austen-uid', NOW)).resolves.toBe(false);
			expect(vi.mocked(console.error)).toHaveBeenCalled();
			expect(logged()).toContain('403');
			expect(logged()).not.toContain(TOKEN);
		});

		it('when the request throws', async () => {
			vi.useFakeTimers();
			fetchMock.mockReset();
			fetchMock.mockRejectedValue(new Error(`request failed: authorization Bearer ${TOKEN}`));

			const pending = revokeSessions('austen-uid', NOW);
			await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS);

			await expect(pending).resolves.toBe(false);
			expect(vi.mocked(console.error)).toHaveBeenCalled();
			expect(logged()).toContain('request failed');
			expect(logged()).not.toContain(TOKEN);
		});
	});
});
