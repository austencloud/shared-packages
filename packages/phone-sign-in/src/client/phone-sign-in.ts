// Browser side of the phone approval sign-in: the login page starts and
// collects a request, the phone's approve page loads and decides it. A phone
// that was trusted can also approve by itself: it signs the request id with
// its own key (trusted-phone-key.ts) and the server does the rest. Trusting,
// stopping and "That wasn't me" are the other calls the phone makes.
import type {
	ApprovalRequest,
	ApprovalStatus,
	AutoAnswer,
	CollectAnswer,
	DecisionResult,
	NotMeAnswer,
	PublicKeyJwk,
	StartedRequest
} from '../types';

/**
 * The app's authenticated fetch: sends the signed-in user's ID token, and a
 * newly issued one when `forceRefresh` is set (the server refuses an approval
 * from a token more than five minutes old).
 */
export type ApiFetch = (url: string, init?: RequestInit, options?: { forceRefresh?: boolean }) => Promise<Response>;

export interface PhoneSignInClientOptions {
	/** Shown when the server cannot be reached, such as "Ringmaster". */
	appName: string;
	apiFetch: ApiFetch;
	/** Where the routes live. Default '/api/phone-sign-in'. */
	basePath?: string;
}

export interface PhoneSignInClient {
	/** `notify` also asks the server to send the request to the owner's phone as a notification. */
	startPhoneSignIn(options?: { notify?: boolean }): Promise<StartedRequest>;
	collectPhoneSignIn(id: string, secret: string): Promise<CollectAnswer>;
	loadApprovalRequest(id: string): Promise<ApprovalRequest | null>;
	decideApprovalRequest(id: string, decision: 'approve' | 'deny', confirmDifferentNetwork?: boolean): Promise<DecisionResult>;
	autoApproveRequest(id: string, signature: string): Promise<AutoAnswer>;
	trustThisPhone(publicKey: PublicKeyJwk): Promise<void>;
	stopTrustingPhone(): Promise<void>;
	reportNotMe(id: string): Promise<NotMeAnswer>;
}

const START_TIMEOUT_MS = 15_000;
const COLLECT_TIMEOUT_MS = 10_000;

const APPROVAL_STATUSES: readonly string[] = ['pending', 'approved', 'denied', 'used', 'expired'];
const DECISION_RESULTS: readonly string[] = ['approved', 'denied', 'expired', 'already-decided', 'confirm-network'];
const AUTO_ANSWERS: readonly string[] = ['approved', 'expired', 'already-decided'];

/** The server's own words: `error` from the routes, `message` from SvelteKit's error(). */
async function errorMessage(response: Response, fallback: string): Promise<string> {
	const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
	return body?.error || body?.message || fallback;
}

/**
 * For the calls the phone makes. A 401 or 403 shows the server's own `error`
 * text when it has one (the decision route says why a token was refused). An
 * app's own auth refusal sends `message` in its own wording, so for that the
 * page gets plain words.
 */
async function approverMessage(response: Response, fallback: string): Promise<string> {
	if (response.status === 401 || response.status === 403) {
		const body = (await response.clone().json().catch(() => null)) as { error?: unknown } | null;
		if (typeof body?.error === 'string' && body.error) return body.error;
		return response.status === 401
			? 'Your session has ended. Sign in again, then scan the code again.'
			: 'Only an admin can approve sign-ins.';
	}
	return errorMessage(response, fallback);
}

function isTime(value: unknown): value is string {
	return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isDuration(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function createPhoneSignInClient({
	appName,
	apiFetch,
	basePath = '/api/phone-sign-in'
}: PhoneSignInClientOptions): PhoneSignInClient {
	const unreachable = `Could not reach ${appName}. Check the connection and try again.`;
	const at = (id: string, action = '') => `${basePath}/${encodeURIComponent(id)}${action}`;

	/** A request that never got an answer (offline, timed out) reads as one plain message. */
	async function send(request: () => Promise<Response>): Promise<Response> {
		try {
			return await request();
		} catch {
			throw new Error(unreachable);
		}
	}

	async function startPhoneSignIn(options: { notify?: boolean } = {}): Promise<StartedRequest> {
		const fallback = 'Could not start a phone sign-in';
		const response = await send(() =>
			fetch(basePath, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: options.notify ? '{"notify":true}' : '{}',
				signal: AbortSignal.timeout(START_TIMEOUT_MS)
			})
		);
		if (!response.ok) throw new Error(await errorMessage(response, fallback));

		const body = (await response.json().catch(() => null)) as Partial<Record<keyof StartedRequest, unknown>> | null;
		if (
			!body ||
			typeof body.id !== 'string' ||
			typeof body.code !== 'string' ||
			typeof body.secret !== 'string' ||
			typeof body.approveUrl !== 'string' ||
			!isTime(body.expiresAt) ||
			!isDuration(body.expiresInMs)
		) {
			throw new Error(fallback);
		}
		return {
			id: body.id,
			code: body.code,
			secret: body.secret,
			expiresAt: body.expiresAt,
			expiresInMs: body.expiresInMs,
			approveUrl: body.approveUrl,
			// An older server never sends it, and anything but a plain true means show the QR code.
			notified: body.notified === true
		};
	}

	/** Throws on any failure, including an answer it doesn't understand, so the caller just polls again. */
	async function collectPhoneSignIn(id: string, secret: string): Promise<CollectAnswer> {
		const response = await send(() =>
			fetch(at(id, '/collect'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ secret }),
				signal: AbortSignal.timeout(COLLECT_TIMEOUT_MS)
			})
		);
		if (!response.ok) throw new Error(`Sign-in check failed (${response.status})`);

		const body = (await response.json().catch(() => null)) as { status?: unknown; token?: unknown } | null;
		if (body?.status === 'approved' && typeof body.token === 'string' && body.token) {
			return { status: 'approved', token: body.token };
		}
		if (body?.status === 'pending' || body?.status === 'denied' || body?.status === 'expired') {
			return { status: body.status };
		}
		throw new Error('Sign-in check gave an answer this page does not know');
	}

	/** null when the request doesn't exist. */
	async function loadApprovalRequest(id: string): Promise<ApprovalRequest | null> {
		const fallback = 'Could not load this sign-in request';
		const response = await send(() => apiFetch(at(id)));
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(await approverMessage(response, fallback));

		const body = (await response.json().catch(() => null)) as {
			status?: unknown;
			code?: unknown;
			device?: { label?: unknown; place?: unknown; site?: unknown } | null;
			sameNetwork?: unknown;
			createdAt?: unknown;
			expiresAt?: unknown;
			ageMs?: unknown;
			expiresInMs?: unknown;
		} | null;
		if (
			!body ||
			typeof body.status !== 'string' ||
			!APPROVAL_STATUSES.includes(body.status) ||
			typeof body.code !== 'string' ||
			!isTime(body.createdAt) ||
			!isTime(body.expiresAt) ||
			!isDuration(body.ageMs) ||
			!isDuration(body.expiresInMs)
		) {
			throw new Error(fallback);
		}
		return {
			status: body.status as ApprovalStatus,
			code: body.code,
			device: {
				label: typeof body.device?.label === 'string' ? body.device.label : 'An unknown browser',
				place: typeof body.device?.place === 'string' ? body.device.place : '',
				site: typeof body.device?.site === 'string' ? body.device.site : ''
			},
			// Anything but a plain true gets the different-network warning.
			sameNetwork: body.sameNetwork === true,
			createdAt: body.createdAt,
			expiresAt: body.expiresAt,
			ageMs: body.ageMs,
			expiresInMs: body.expiresInMs
		};
	}

	/**
	 * Sends the owner's answer with a newly issued ID token, because the server
	 * refuses a decision from a token more than five minutes old. Only an
	 * approval from a different network needs `confirmDifferentNetwork`; a denial
	 * never carries it. When the server wants that confirmation and didn't get
	 * it, nothing is saved and this returns 'confirm-network' so the page can ask
	 * for the second tap.
	 */
	async function decideApprovalRequest(
		id: string,
		decision: 'approve' | 'deny',
		confirmDifferentNetwork = false
	): Promise<DecisionResult> {
		const fallback = 'Could not save your answer';
		const payload: { decision: 'approve' | 'deny'; confirmDifferentNetwork?: true } = { decision };
		if (decision === 'approve' && confirmDifferentNetwork) payload.confirmDifferentNetwork = true;

		const response = await send(() =>
			apiFetch(
				at(id, '/decision'),
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload)
				},
				{ forceRefresh: true }
			)
		);

		if (response.status === 409) {
			const body = (await response.clone().json().catch(() => null)) as { status?: unknown } | null;
			if (body?.status === 'confirm-network') return 'confirm-network';
		}
		if (!response.ok) throw new Error(await approverMessage(response, fallback));

		const body = (await response.json().catch(() => null)) as { status?: unknown } | null;
		if (typeof body?.status !== 'string' || !DECISION_RESULTS.includes(body.status)) throw new Error(fallback);
		return body.status as DecisionResult;
	}

	/**
	 * Approves with this phone's signature and a newly issued ID token. The server
	 * checks the key, the signature and the network itself. 'different-network'
	 * and 'not-trusted' mean the page shows the tap flow instead.
	 */
	async function autoApproveRequest(id: string, signature: string): Promise<AutoAnswer> {
		const fallback = 'Could not approve automatically';
		const response = await send(() =>
			apiFetch(
				at(id, '/auto'),
				{ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signature }) },
				{ forceRefresh: true }
			)
		);
		const body = (await response.clone().json().catch(() => null)) as { status?: unknown } | null;
		if (response.status === 409 && body?.status === 'different-network') return 'different-network';
		if (response.status === 403 && body?.status === 'not-trusted') return 'not-trusted';
		if (!response.ok) throw new Error(await approverMessage(response, fallback));
		if (typeof body?.status !== 'string' || !AUTO_ANSWERS.includes(body.status)) throw new Error(fallback);
		return body.status as AutoAnswer;
	}

	/** Registers this phone's public key, replacing any other trusted phone. Sends a newly issued ID token. */
	async function trustThisPhone(publicKey: PublicKeyJwk): Promise<void> {
		const response = await send(() =>
			apiFetch(
				`${basePath}/trusted-phone`,
				{ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey }) },
				{ forceRefresh: true }
			)
		);
		if (!response.ok) throw new Error(await approverMessage(response, 'Could not trust this phone'));
	}

	/** Removes the account's trusted phone on the server. Any admin session may, so the cached token will do. */
	async function stopTrustingPhone(): Promise<void> {
		const response = await send(() => apiFetch(`${basePath}/trusted-phone`, { method: 'DELETE' }));
		if (!response.ok) throw new Error(await approverMessage(response, 'Could not stop automatic approval'));
	}

	/**
	 * The server can take about a minute to answer: when the computer already
	 * collected a sign-in, it waits for that pass to expire and signs everyone out
	 * a second time. So this sets no time limit of its own; the page keeps showing
	 * progress until the answer arrives.
	 */
	async function reportNotMe(id: string): Promise<NotMeAnswer> {
		const fallback = 'Could not report this sign-in';
		const response = await send(() => apiFetch(at(id, '/not-me'), { method: 'POST' }, { forceRefresh: true }));
		if (!response.ok) throw new Error(await approverMessage(response, fallback));
		const body = (await response.json().catch(() => null)) as {
			status?: unknown;
			signedOut?: unknown;
			autoOff?: unknown;
			blocked?: unknown;
		} | null;
		if (body?.status !== 'reported') throw new Error(fallback);
		// Anything but a plain true reads as not done; a missing `blocked` reads as "the computer may have got in".
		return { signedOut: body.signedOut === true, autoOff: body.autoOff === true, blocked: body.blocked === true };
	}

	return {
		startPhoneSignIn,
		collectPhoneSignIn,
		loadApprovalRequest,
		decideApprovalRequest,
		autoApproveRequest,
		trustThisPhone,
		stopTrustingPhone,
		reportNotMe
	};
}
