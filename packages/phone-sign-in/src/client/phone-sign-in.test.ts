import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPhoneSignInClient } from './phone-sign-in';

// The browser helpers talk to the phone sign-in routes. fetch and apiFetch are
// stubbed, so each test reads exactly what the page would send and feeds back
// what the server could answer. Ported from Ringmaster with its values.
const fake = { apiFetch: vi.fn() };
const {
	autoApproveRequest,
	collectPhoneSignIn,
	decideApprovalRequest,
	loadApprovalRequest,
	reportNotMe,
	startPhoneSignIn,
	stopTrustingPhone,
	trustThisPhone
} = createPhoneSignInClient({ appName: 'Ringmaster', apiFetch: fake.apiFetch });

const fetchMock = vi.fn();

function reply(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function sentBody(mock: ReturnType<typeof vi.fn>): unknown {
	const init = mock.mock.calls[0][1] as RequestInit;
	return JSON.parse(init.body as string);
}

beforeEach(() => {
	fetchMock.mockReset();
	fake.apiFetch.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('startPhoneSignIn', () => {
	const started = {
		id: 'abcdefghij0123456789',
		code: '482173',
		secret: 'secret-value',
		expiresAt: '2026-10-07T18:03:00.000Z',
		expiresInMs: 180_000,
		approveUrl: 'https://ringmaster.example/sign-in/abcdefghij0123456789'
	};

	it('posts an empty JSON body so the server accepts it', async () => {
		fetchMock.mockResolvedValue(reply(started));

		await expect(startPhoneSignIn()).resolves.toEqual({ ...started, notified: false });

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/phone-sign-in');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(init.body).toBe('{}');
	});

	it('asks for a notification when told to, and reads whether a phone got one', async () => {
		fetchMock.mockResolvedValue(reply({ ...started, notified: true }));

		await expect(startPhoneSignIn({ notify: true })).resolves.toEqual({ ...started, notified: true });
		expect(sentBody(fetchMock)).toEqual({ notify: true });
	});

	it('reads anything but a plain true as not notified, so the QR code shows', async () => {
		fetchMock.mockResolvedValue(reply({ ...started, notified: 'yes' }));
		await expect(startPhoneSignIn({ notify: true })).resolves.toMatchObject({ notified: false });
	});

	it.each([
		[503, 'Phone sign-in is turned off.'],
		[429, 'Too many sign-in codes. Try again in a few minutes.']
	])("shows the server's own words on a %i", async (status, error) => {
		fetchMock.mockResolvedValue(reply({ error }, status));
		await expect(startPhoneSignIn()).rejects.toThrow(error);
	});

	it('says so plainly when Ringmaster cannot be reached', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(startPhoneSignIn()).rejects.toThrow('Could not reach Ringmaster');
	});

	it('rejects an answer that is not a request', async () => {
		fetchMock.mockResolvedValue(reply({ id: 'x' }));
		await expect(startPhoneSignIn()).rejects.toThrow('Could not start a phone sign-in');
	});

	it('needs the server-measured lifetime, so the countdown never leans on this clock', async () => {
		const { expiresInMs: _omitted, ...withoutLifetime } = started;
		fetchMock.mockResolvedValueOnce(reply(withoutLifetime));
		await expect(startPhoneSignIn()).rejects.toThrow('Could not start a phone sign-in');

		for (const bad of ['180000', -1, null, Number.NaN]) {
			fetchMock.mockResolvedValueOnce(reply({ ...started, expiresInMs: bad }));
			await expect(startPhoneSignIn()).rejects.toThrow('Could not start a phone sign-in');
		}
	});
});

describe('collectPhoneSignIn', () => {
	it('returns the token when approved', async () => {
		fetchMock.mockResolvedValue(reply({ status: 'approved', token: 'custom-token' }));
		await expect(collectPhoneSignIn('id1', 's')).resolves.toEqual({ status: 'approved', token: 'custom-token' });
		expect(sentBody(fetchMock)).toEqual({ secret: 's' });
	});

	it.each(['pending', 'denied', 'expired'])('passes %s through', async (status) => {
		fetchMock.mockResolvedValue(reply({ status }));
		await expect(collectPhoneSignIn('id1', 's')).resolves.toEqual({ status });
	});

	it('throws on a server error and on an answer it does not know, so the page polls again', async () => {
		fetchMock.mockResolvedValueOnce(reply({ error: 'boom' }, 500));
		await expect(collectPhoneSignIn('id1', 's')).rejects.toThrow('500');

		fetchMock.mockResolvedValueOnce(reply({ status: 'approved' }));
		await expect(collectPhoneSignIn('id1', 's')).rejects.toThrow();

		fetchMock.mockResolvedValueOnce(reply({ status: 'used' }));
		await expect(collectPhoneSignIn('id1', 's')).rejects.toThrow();
	});
});

describe('loadApprovalRequest', () => {
	const loaded = {
		status: 'pending',
		code: '482173',
		device: { label: "Claude's browser on Windows", place: 'Chicago, US', site: 'a local copy (127.0.0.1:5231)' },
		sameNetwork: true,
		createdAt: '2026-10-07T18:00:00.000Z',
		expiresAt: '2026-10-07T18:03:00.000Z',
		ageMs: 45_000,
		expiresInMs: 135_000
	};

	it('returns the age and time left as the server measured them', async () => {
		fake.apiFetch.mockResolvedValue(reply(loaded));
		await expect(loadApprovalRequest('id1')).resolves.toEqual(loaded);
	});

	it('needs both server-measured durations', async () => {
		const { ageMs: _age, ...withoutAge } = loaded;
		const { expiresInMs: _left, ...withoutLeft } = loaded;
		for (const body of [withoutAge, withoutLeft, { ...loaded, ageMs: '45000' }, { ...loaded, expiresInMs: -5 }]) {
			fake.apiFetch.mockResolvedValueOnce(reply(body));
			await expect(loadApprovalRequest('id1')).rejects.toThrow();
		}
	});

	it('reads a request from before sites were recorded as the live site', async () => {
		fake.apiFetch.mockResolvedValue(reply({ ...loaded, device: { label: 'Chrome on Windows', place: '' } }));
		await expect(loadApprovalRequest('id1')).resolves.toMatchObject({
			device: { label: 'Chrome on Windows', place: '', site: '' }
		});
	});

	it('returns null when the request does not exist', async () => {
		fake.apiFetch.mockResolvedValue(reply({ message: 'Sign-in request not found' }, 404));
		await expect(loadApprovalRequest('id1')).resolves.toBeNull();
	});

	it('keeps sameNetwork only when the server says true', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply(loaded));
		await expect(loadApprovalRequest('id1')).resolves.toMatchObject({ sameNetwork: true });

		fake.apiFetch.mockResolvedValueOnce(reply({ ...loaded, sameNetwork: false }));
		await expect(loadApprovalRequest('id1')).resolves.toMatchObject({ sameNetwork: false });

		const { sameNetwork: _omitted, ...withoutFlag } = loaded;
		fake.apiFetch.mockResolvedValueOnce(reply(withoutFlag));
		await expect(loadApprovalRequest('id1')).resolves.toMatchObject({ sameNetwork: false });
	});

	it('words a 403 without the server dash', async () => {
		fake.apiFetch.mockResolvedValue(reply({ message: `Access denied ${String.fromCharCode(0x2014)} admin role required` }, 403));
		await expect(loadApprovalRequest('id1')).rejects.toThrow('Only an admin can approve sign-ins.');
	});
});

describe('decideApprovalRequest', () => {
	it('approves from the same network with the decision alone', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'approved' }));
		await expect(decideApprovalRequest('id1', 'approve')).resolves.toBe('approved');
		expect(sentBody(fake.apiFetch)).toEqual({ decision: 'approve' });
	});

	it('adds the confirmation only on a confirmed approval', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'approved' }));
		await decideApprovalRequest('id1', 'approve', true);
		expect(sentBody(fake.apiFetch)).toEqual({ decision: 'approve', confirmDifferentNetwork: true });
	});

	it('never sends the confirmation with a denial', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'denied' }));
		await expect(decideApprovalRequest('id1', 'deny', true)).resolves.toBe('denied');
		expect(sentBody(fake.apiFetch)).toEqual({ decision: 'deny' });
	});

	it('returns confirm-network, not an error, when the server wants the second tap', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'confirm-network' }, 409));
		await expect(decideApprovalRequest('id1', 'approve')).resolves.toBe('confirm-network');
	});

	it('passes expired and already-decided through', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'expired' }));
		await expect(decideApprovalRequest('id1', 'approve')).resolves.toBe('expired');
		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'already-decided' }));
		await expect(decideApprovalRequest('id1', 'deny')).resolves.toBe('already-decided');
	});

	it('sends a force-refreshed token, because the server refuses one older than five minutes', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'approved' }));
		await decideApprovalRequest('id1', 'approve');
		expect(fake.apiFetch).toHaveBeenCalledTimes(1);
		expect(fake.apiFetch.mock.calls[0][0]).toBe('/api/phone-sign-in/id1/decision');
		expect(fake.apiFetch.mock.calls[0][2]).toEqual({ forceRefresh: true });

		fake.apiFetch.mockResolvedValue(reply({ status: 'denied' }));
		await decideApprovalRequest('id1', 'deny');
		expect(fake.apiFetch.mock.calls[1][2]).toEqual({ forceRefresh: true });
	});

	it.each([
		[403, 'Approve from a phone signed in with Google.'],
		[401, 'Your sign-in is too old. Reload this page and try again.']
	])("shows the server's own words on a %i", async (status, error) => {
		fake.apiFetch.mockResolvedValue(reply({ error }, status));
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow(error);
	});

	it('keeps the old wording on a 401 or 403 that carries no error text', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Missing authorization header' }, 401));
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow(
			'Your session has ended. Sign in again, then scan the code again.'
		);

		fake.apiFetch.mockResolvedValueOnce(
			reply({ message: `Access denied ${String.fromCharCode(0x2014)} admin role required` }, 403)
		);
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow('Only an admin can approve sign-ins.');

		fake.apiFetch.mockResolvedValueOnce(new Response('not json', { status: 403 }));
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow('Only an admin can approve sign-ins.');

		fake.apiFetch.mockResolvedValueOnce(reply({ error: '' }, 401));
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow(
			'Your session has ended. Sign in again, then scan the code again.'
		);
	});

	it("throws the server's words when sign-in is turned off, and on any other 409", async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ error: 'Phone sign-in is turned off.' }, 503));
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow('Phone sign-in is turned off.');

		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Conflict' }, 409));
		await expect(decideApprovalRequest('id1', 'approve')).rejects.toThrow('Conflict');
	});
});

describe('autoApproveRequest', () => {
	const SIGNATURE = 'A'.repeat(86);

	it('posts the signature as JSON with a newly issued token', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'approved' }));
		await expect(autoApproveRequest('id1', SIGNATURE)).resolves.toBe('approved');

		expect(fake.apiFetch).toHaveBeenCalledTimes(1);
		const [url, init, options] = fake.apiFetch.mock.calls[0] as [string, RequestInit, unknown];
		expect(url).toBe('/api/phone-sign-in/id1/auto');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init.body as string)).toEqual({ signature: SIGNATURE });
		expect(options).toEqual({ forceRefresh: true });
	});

	it.each(['approved', 'expired', 'already-decided'])('passes %s through', async (status) => {
		fake.apiFetch.mockResolvedValue(reply({ status }));
		await expect(autoApproveRequest('id1', SIGNATURE)).resolves.toBe(status);
	});

	it('reads a 409 different-network as the cue to show the tap flow with its warning', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'different-network' }, 409));
		await expect(autoApproveRequest('id1', SIGNATURE)).resolves.toBe('different-network');
	});

	it('reads a 403 not-trusted as the cue to forget this phone key and show the tap flow', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'not-trusted' }, 403));
		await expect(autoApproveRequest('id1', SIGNATURE)).resolves.toBe('not-trusted');
	});

	it('only trusts those two answers on the status code the server sends them with', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'different-network' }, 403));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Only an admin can approve sign-ins.');

		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'not-trusted' }, 409));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Could not approve automatically');
	});

	it('reads a 400 as an ordinary failure, never as not-trusted, so the phone keeps its key', async () => {
		// The server answers 400 when it could not read the upload. The page treats
		// any throw as "show the tap flow" and forgets the key only on not-trusted.
		fake.apiFetch.mockResolvedValueOnce(reply({ error: 'This request could not be read.' }, 400));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('This request could not be read.');

		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'not-trusted' }, 400));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Could not approve automatically');

		fake.apiFetch.mockResolvedValueOnce(new Response('', { status: 400 }));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Could not approve automatically');
	});

	it.each([
		[403, 'Approve from a phone signed in with Google.'],
		[401, 'Your sign-in is too old. Reload this page and try again.']
	])("shows the server's own words on a %i", async (status, error) => {
		fake.apiFetch.mockResolvedValue(reply({ error }, status));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow(error);
	});

	it('uses plain words for a 401 or 403 that carries no error text', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Missing authorization header' }, 401));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow(
			'Your session has ended. Sign in again, then scan the code again.'
		);

		fake.apiFetch.mockResolvedValueOnce(
			reply({ message: `Access denied ${String.fromCharCode(0x2014)} admin role required` }, 403)
		);
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Only an admin can approve sign-ins.');
	});

	it('throws when sign-in is turned off, when the request is gone and when the answer is unknown', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ error: 'Phone sign-in is turned off.' }, 503));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Phone sign-in is turned off.');

		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Sign-in request not found' }, 404));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Sign-in request not found');

		// A denial can never come from this route, and nothing else is a status it sends.
		for (const body of [{ status: 'denied' }, { status: 'confirm-network' }, { status: 7 }, {}]) {
			fake.apiFetch.mockResolvedValueOnce(reply(body));
			await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Could not approve automatically');
		}
		fake.apiFetch.mockResolvedValueOnce(new Response('not json', { status: 200 }));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Could not approve automatically');
	});

	it('says so plainly when Ringmaster cannot be reached', async () => {
		fake.apiFetch.mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(autoApproveRequest('id1', SIGNATURE)).rejects.toThrow('Could not reach Ringmaster');
	});
});

describe('trustThisPhone', () => {
	const publicKey = { kty: 'EC', crv: 'P-256', x: 'x'.repeat(43), y: 'y'.repeat(43) } as const;

	it('posts the public key with a newly issued token', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'trusted' }));
		await expect(trustThisPhone(publicKey)).resolves.toBeUndefined();

		const [url, init, options] = fake.apiFetch.mock.calls[0] as [string, RequestInit, unknown];
		expect(url).toBe('/api/phone-sign-in/trusted-phone');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init.body as string)).toEqual({ publicKey });
		expect(options).toEqual({ forceRefresh: true });
	});

	it.each([
		[400, 'This phone sent a key Ringmaster cannot use.'],
		[503, 'Phone sign-in is turned off.'],
		[403, 'Approve from a phone signed in with Google.'],
		[401, 'Your sign-in is too old. Reload this page and try again.']
	])("throws the server's words on a %i", async (status, error) => {
		fake.apiFetch.mockResolvedValue(reply({ error }, status));
		await expect(trustThisPhone(publicKey)).rejects.toThrow(error);
	});

	it('falls back to its own words, and says so plainly when Ringmaster cannot be reached', async () => {
		fake.apiFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
		await expect(trustThisPhone(publicKey)).rejects.toThrow('Could not trust this phone');

		fake.apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await expect(trustThisPhone(publicKey)).rejects.toThrow('Could not reach Ringmaster');
	});
});

describe('stopTrustingPhone', () => {
	it('sends DELETE with the cached token, because removing a key needs nothing fresh', async () => {
		fake.apiFetch.mockResolvedValue(reply({ status: 'removed' }));
		await expect(stopTrustingPhone()).resolves.toBeUndefined();

		const [url, init, options] = fake.apiFetch.mock.calls[0] as [string, RequestInit, unknown];
		expect(url).toBe('/api/phone-sign-in/trusted-phone');
		expect(init.method).toBe('DELETE');
		expect(init.body).toBeUndefined();
		expect(options).toBeUndefined();
	});

	it('throws on a refusal or a failure, and says so plainly when Ringmaster cannot be reached', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Missing authorization header' }, 401));
		await expect(stopTrustingPhone()).rejects.toThrow('Your session has ended. Sign in again, then scan the code again.');

		fake.apiFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
		await expect(stopTrustingPhone()).rejects.toThrow('Could not stop automatic approval');

		fake.apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await expect(stopTrustingPhone()).rejects.toThrow('Could not reach Ringmaster');
	});
});

describe('reportNotMe', () => {
	const reported = { status: 'reported', signedOut: true, autoOff: true, blocked: true };

	it('posts to the request with a newly issued token and no time limit of its own', async () => {
		fake.apiFetch.mockResolvedValue(reply(reported));
		await expect(reportNotMe('id1')).resolves.toEqual({ signedOut: true, autoOff: true, blocked: true });

		const [url, init, options] = fake.apiFetch.mock.calls[0] as [string, RequestInit, unknown];
		expect(url).toBe('/api/phone-sign-in/id1/not-me');
		expect(init.method).toBe('POST');
		expect(options).toEqual({ forceRefresh: true });
		// The server can take about a minute, waiting for a collected sign-in to expire.
		expect(init.signal).toBeUndefined();
	});

	it('waits out an answer that takes a minute', async () => {
		vi.useFakeTimers();
		try {
			fake.apiFetch.mockImplementation(
				() => new Promise<Response>((resolve) => setTimeout(() => resolve(reply(reported)), 70_000))
			);
			const answer = reportNotMe('id1');
			await vi.advanceTimersByTimeAsync(70_000);
			await expect(answer).resolves.toEqual({ signedOut: true, autoOff: true, blocked: true });
		} finally {
			vi.useRealTimers();
		}
	});

	it('reports what worked, and reads anything but a plain true as not done', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'reported', signedOut: false, autoOff: true, blocked: false }));
		await expect(reportNotMe('id1')).resolves.toEqual({ signedOut: false, autoOff: true, blocked: false });

		// A server that does not say blocked reads as "the computer may have got in".
		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'reported', signedOut: true, autoOff: true }));
		await expect(reportNotMe('id1')).resolves.toEqual({ signedOut: true, autoOff: true, blocked: false });

		fake.apiFetch.mockResolvedValueOnce(reply({ status: 'reported', signedOut: 'true', autoOff: 1, blocked: 'yes' }));
		await expect(reportNotMe('id1')).resolves.toEqual({ signedOut: false, autoOff: false, blocked: false });
	});

	it('throws on an answer that is not a report', async () => {
		for (const body of [{ status: 'ok', signedOut: true }, { signedOut: true }, null]) {
			fake.apiFetch.mockResolvedValueOnce(reply(body));
			await expect(reportNotMe('id1')).rejects.toThrow('Could not report this sign-in');
		}
		fake.apiFetch.mockResolvedValueOnce(new Response('not json', { status: 200 }));
		await expect(reportNotMe('id1')).rejects.toThrow('Could not report this sign-in');
	});

	it('throws on a missing request and on other failures', async () => {
		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Sign-in request not found' }, 404));
		await expect(reportNotMe('id1')).rejects.toThrow('Sign-in request not found');

		fake.apiFetch.mockResolvedValueOnce(reply({ error: 'Approve from a phone signed in with Google.' }, 403));
		await expect(reportNotMe('id1')).rejects.toThrow('Approve from a phone signed in with Google.');

		fake.apiFetch.mockResolvedValueOnce(reply({ message: 'Missing authorization header' }, 401));
		await expect(reportNotMe('id1')).rejects.toThrow('Your session has ended. Sign in again, then scan the code again.');

		fake.apiFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
		await expect(reportNotMe('id1')).rejects.toThrow('Could not report this sign-in');

		fake.apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await expect(reportNotMe('id1')).rejects.toThrow('Could not reach Ringmaster');
	});
});

describe('createPhoneSignInClient', () => {
	it('names the app and uses its own route path', async () => {
		const other = createPhoneSignInClient({
			appName: 'Flow Arts Composer',
			apiFetch: fake.apiFetch,
			basePath: '/api/sign-in-by-phone'
		});
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(other.startPhoneSignIn()).rejects.toThrow('Could not reach Flow Arts Composer');
		expect(fetchMock.mock.calls[0][0]).toBe('/api/sign-in-by-phone');

		fake.apiFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'approved' }), { status: 200 }));
		await other.decideApprovalRequest('id1', 'approve');
		expect(fake.apiFetch.mock.calls[0][0]).toBe('/api/sign-in-by-phone/id1/decision');
	});
});
