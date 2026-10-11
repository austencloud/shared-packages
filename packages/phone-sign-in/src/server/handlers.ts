// Every phone sign-in route, as plain functions over a standard Request. An
// app's route files only pass the request and { id, clientAddress, cf }:
//
//   POST   /api/phone-sign-in                    create        public
//   GET    /api/phone-sign-in/<id>               lookup        admin
//   POST   /api/phone-sign-in/<id>/decision      decision      fresh Google admin
//   POST   /api/phone-sign-in/<id>/collect       collect       holder of the secret
//   POST   /api/phone-sign-in/<id>/auto          auto          fresh Google admin + trusted phone
//   POST   /api/phone-sign-in/<id>/not-me        notMe         fresh Google admin
//   POST   /api/phone-sign-in/trusted-phone      trust         fresh Google admin
//   DELETE /api/phone-sign-in/trusted-phone      stopTrusting  admin
//
// An auth refusal the app's verifyUser throws (anything with a numeric
// `status`, such as SvelteKit's error()) becomes a JSON response with that
// status and a `message`, the shape SvelteKit's own error responses have.
// Specs: Ringmaster docs/superpowers/specs/2026-10-07-phone-approval-sign-in-design.md,
//        2026-10-08-phone-auto-approve-design.md, 2026-10-09-phone-sign-in-any-server-design.md
import { describeDevice, describePlace, describeSite } from '../shared/describe-device';
import { approveUrl } from './approve-link';
import { readCappedJsonObject, readCappedBody } from './capped-body';
import { createCustomTokenMinter, CUSTOM_TOKEN_LIFETIME_SECONDS, type MintCustomToken, type SignJwt } from './custom-token';
import { logMessage } from './log-message';
import { networkFamily } from './network-scope';
import { publicAddress } from './public-address';
import { requesterAddress } from './requester-address';
import { createRequestLifecycle, isRequestId, sameNetwork, type NotMeResult, type RequestLifecycle } from './requests';
import { createSessionRevoker, type RevokeSessions } from './revoke-sessions';
import { createServerKeys } from './server-key';
import type { PhoneSignInStore } from './store';
import { createTrustedPhones, parsePublicKey, type TrustedPhones } from './trusted-phones';

export const DISABLED_MESSAGE = 'Phone sign-in is turned off.';
export const NO_STORE = { 'cache-control': 'no-store' };
/** How old an ID token may be when it arrives at a route that approves, trusts or reports. */
export const MAX_TOKEN_AGE_SECONDS = 300;

/** The signed-in admin, as the app's own check found them. */
export interface VerifiedUser {
	uid: string;
	email: string | null;
	/** The ID token's firebase.sign_in_provider, such as 'google.com' or 'custom'. */
	signInProvider: string | null;
	/** The ID token's iat, in seconds. */
	issuedAt: number;
}

export interface PhoneSignInServerConfig {
	/** Shown in error messages, such as "Ringmaster". */
	appName: string;
	/** The live site's origin; the QR always opens it. */
	liveOrigin: string;
	/** Where approve pages live. Default '/sign-in'. */
	approvePath?: string;
	/** The HKDF salt for the server keys. Fixed per app; changing it invalidates trusted phones. */
	salt: string;
	/** What a trusted phone's signature is over; the browser uses the same one. */
	autoPurpose: string;
	collections?: { requests?: string; trustedPhones?: string };
	store: PhoneSignInStore;
	/** The service account private key PEM as bytes; null only on the Firestore emulator with no credentials. */
	serverSecret: () => Uint8Array | null;
	/** Signs the custom token's claims (Identity Toolkit audience). */
	signJwt: SignJwt;
	/**
	 * The app's own check: verifies the ID token in the request and applies the
	 * app's admin rule. Throws an error with a numeric `status` (401 or 403) to
	 * refuse. Must check that the account is an admin.
	 */
	verifyUser: (request: Request) => Promise<VerifiedUser>;
	/** True when this caller may start another request. */
	rateLimit: (check: { route: string; ip: string; limit: number; windowMs: number }) => Promise<boolean>;
	projectId: string | (() => string);
	/** True on a Firestore emulator run: "That wasn't me" never signs the real account out from it. */
	emulator: () => boolean;
	/** An OAuth access token for ACCOUNTS_UPDATE_SCOPE (cloud-platform), cached by the app. */
	accessToken: () => Promise<string>;
	forgetAccessToken: (token: string) => void;
	/** The kill switch: true turns phone sign-in off without a deploy. */
	disabled: () => boolean;
	/** A dev build: stamps local callers with this computer's public network (requester-address.ts). */
	dev: boolean;
}

/** The pieces the handlers are built from. Tests replace some; apps never need to. */
export interface PhoneSignInParts {
	requests: RequestLifecycle;
	trustedPhones: TrustedPhones;
	revokeSessions: RevokeSessions;
	mintCustomToken: MintCustomToken;
	publicAddress: () => Promise<string>;
}

export interface RouteContext {
	/** The `[id]` route parameter. */
	id?: string;
	/** The caller's address, or 'unknown' (clientAddress() turns SvelteKit's getClientAddress into this). */
	clientAddress: string;
	/** Cloudflare's request metadata (platform.cf), for the place shown on the phone. */
	cf?: Record<string, unknown>;
	/** The page URL as the framework sees it; the request's URL otherwise. */
	url?: URL;
}

export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

export interface PhoneSignInHandlers {
	create: RouteHandler;
	lookup: RouteHandler;
	decision: RouteHandler;
	collect: RouteHandler;
	auto: RouteHandler;
	notMe: RouteHandler;
	trust: RouteHandler;
	stopTrusting: RouteHandler;
}

/** "1" or "true", in any case and with spaces around it, turns the switch on. */
export function killSwitchOn(value: string | undefined | null): boolean {
	const v = value?.trim().toLowerCase();
	return v === '1' || v === 'true';
}

/** The caller's address, or 'unknown' where the framework cannot supply one (outside the Workers runtime). */
export function clientAddress(getClientAddress: () => string): string {
	try {
		return getClientAddress() || 'unknown';
	} catch {
		return 'unknown';
	}
}

/** A decoded Firebase ID token's claims as a VerifiedUser. A missing iat reads as NaN, which the age check refuses. */
export function verifiedUserFromClaims(claims: {
	sub: string;
	email?: string | null;
	firebase?: { sign_in_provider?: string } | null;
	iat?: number;
}): VerifiedUser {
	return {
		uid: claims.sub,
		email: claims.email ?? null,
		signInProvider: claims.firebase?.sign_in_provider ?? null,
		issuedAt: typeof claims.iat === 'number' ? claims.iat : Number.NaN
	};
}

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: { 'content-type': 'application/json', ...NO_STORE, ...init.headers }
	});
}

/** SvelteKit's error() shape: a status and a `message`. */
function refuse(status: number, message: string): Response {
	return json({ message }, { status });
}

/** A thrown auth refusal (SvelteKit's HttpError or anything shaped like it) as a response; null for anything else. */
function refusalFrom(e: unknown): Response | null {
	if (typeof e !== 'object' || e === null) return null;
	const { status, body, message } = e as { status?: unknown; body?: { message?: unknown }; message?: unknown };
	if (typeof status !== 'number' || !Number.isInteger(status) || status < 400 || status > 599) return null;
	const text = typeof body?.message === 'string' ? body.message : typeof message === 'string' ? message : 'Error';
	return refuse(status, text);
}

function guarded(handler: RouteHandler): RouteHandler {
	return async (request, context) => {
		try {
			return await handler(request, context);
		} catch (e) {
			const refusal = refusalFrom(e);
			if (refusal) return refusal;
			throw e;
		}
	};
}

const notFound = () => refuse(404, 'Sign-in request not found');
const turnedOff = () => json({ error: DISABLED_MESSAGE }, { status: 503 });

const CREATE_LIMIT = { limit: 10, windowMs: 10 * 60_000 };
/** Every body these routes read is a few hundred bytes at most. */
const MAX_BODY = 1024;

/**
 * "That wasn't me": the leeway assumed past a custom token's exp. The last
 * sign-out goes out this long after the token's expiry, so a session made in
 * that leeway is still older than its validSince.
 */
const EXPIRY_MARGIN_MS = 30_000;
/**
 * validSince and a session's auth_time are whole seconds, and a session
 * survives a revocation whose validSince equals its auth_time. One more
 * second puts the last sign-out in a later second than any session the token
 * could make.
 */
const SECOND_MS = 1000;
const PASS_LIFETIME_MS = CUSTOM_TOKEN_LIFETIME_SECONDS * 1000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

export function createPhoneSignInServer(
	config: PhoneSignInServerConfig,
	parts: Partial<PhoneSignInParts> = {}
): PhoneSignInHandlers {
	const { appName, store } = config;
	const keys = createServerKeys({ secret: config.serverSecret, salt: config.salt });
	const requests =
		parts.requests ?? createRequestLifecycle({ store, keys, collection: config.collections?.requests });
	const trustedPhones =
		parts.trustedPhones ??
		createTrustedPhones({
			store,
			keys,
			autoPurpose: config.autoPurpose,
			collection: config.collections?.trustedPhones
		});
	const revokeSessions =
		parts.revokeSessions ??
		createSessionRevoker({
			projectId: config.projectId,
			emulator: config.emulator,
			accessToken: config.accessToken,
			forgetAccessToken: config.forgetAccessToken
		});
	const mintCustomToken = parts.mintCustomToken ?? createCustomTokenMinter(config.signJwt);
	const lookupPublicAddress = parts.publicAddress ?? (() => publicAddress());
	const liveHost = new URL(config.liveOrigin).hostname;

	/**
	 * Who may approve a sign-in, trust a phone or report one: an admin whose ID
	 * token comes from a Google sign-in and was issued within the last five
	 * minutes. A session minted by phone sign-in signs in with a custom token,
	 * and a stolen ID token lives up to an hour, so without these checks either
	 * could keep approving new sessions after the owner revoked the old ones.
	 * The phone asks Firebase for a fresh token before each of these calls. The
	 * app's own refusals (no token, bad token, not an admin) are thrown as usual.
	 */
	async function freshGoogleAdmin(
		request: Request
	): Promise<{ user: VerifiedUser; refusal?: undefined } | { user?: undefined; refusal: Response }> {
		const user = await config.verifyUser(request);
		if (user.signInProvider !== 'google.com') {
			return { refusal: json({ error: 'Approve from a phone signed in with Google.' }, { status: 403 }) };
		}
		// Not "older than", so a token with no usable issue time is refused too.
		if (!(Math.floor(Date.now() / 1000) - user.issuedAt <= MAX_TOKEN_AGE_SECONDS)) {
			return {
				refusal: json({ error: 'Your sign-in is too old. Reload this page and try again.' }, { status: 401 })
			};
		}
		return { user };
	}

	/** Starts a phone approval sign-in. Public: the browser asking is signed out. */
	const create: RouteHandler = async (request, context) => {
		if (config.disabled()) return turnedOff();
		const url = context.url ?? new URL(request.url);

		// Another site could ask the browser to start requests on a visitor's behalf.
		// Checked before the rate limit so such a page cannot use up the visitor's allowance.
		const origin = request.headers.get('origin');
		if (origin !== null && origin !== url.origin) {
			return json({ error: 'Wrong origin' }, { status: 403 });
		}
		if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
			return json({ error: 'Expected JSON' }, { status: 415 });
		}

		const ip = context.clientAddress;
		if (!(await config.rateLimit({ route: 'phone-sign-in-create', ip, ...CREATE_LIMIT }))) {
			return json({ error: 'Too many sign-in codes. Try again in a few minutes.' }, { status: 429 });
		}

		const userAgent = request.headers.get('user-agent') ?? '';
		const created = await requests.createRequest(
			{
				label: describeDevice(userAgent),
				userAgent,
				place: describePlace(context.cf),
				site: describeSite(url, liveHost)
			},
			await requests.networkInfo(
				await requesterAddress({ address: ip, headers: request.headers, dev: config.dev, lookup: lookupPublicAddress })
			)
		);

		return json({
			id: created.id,
			code: created.code,
			secret: created.secret,
			expiresAt: created.expiresAt.toISOString(),
			// Count down from this when the answer arrives. The browser's clock may not agree with ours.
			expiresInMs: created.expiresInMs,
			// null key material means the Firestore emulator alone, which the live site cannot see.
			approveUrl: approveUrl(created.id, url.origin, config.serverSecret() === null, {
				liveOrigin: config.liveOrigin,
				approvePath: config.approvePath
			})
		});
	};

	/** What the phone's approve page shows about a sign-in request. Admins only. */
	const lookup: RouteHandler = async (request, context) => {
		await config.verifyUser(request);
		if (!isRequestId(context.id)) return notFound();

		const summary = await requests.getRequestSummary(context.id);
		if (!summary) return notFound();

		// Lets the approve page warn when this phone is not on the network that asked.
		const phoneNetwork = await requests.hashNetwork(context.clientAddress);

		return json({
			status: summary.status,
			code: summary.code,
			device: { label: summary.device.label, place: summary.device.place, site: summary.device.site },
			createdAt: summary.createdAt.toISOString(),
			expiresAt: summary.expiresAt.toISOString(),
			// Both by our clock. The phone's own clock may be off, so the page counts from these.
			ageMs: summary.ageMs,
			expiresInMs: summary.expiresInMs,
			sameNetwork: sameNetwork(summary.network, phoneNetwork)
		});
	};

	/**
	 * Approve or deny a request. The new session belongs to the admin who
	 * approves, taken from their verified ID token and never from the body.
	 */
	const decision: RouteHandler = async (request, context) => {
		if (config.disabled()) return turnedOff();
		const { user, refusal } = await freshGoogleAdmin(request);
		if (refusal) return refusal;
		if (!isRequestId(context.id)) return notFound();

		const body = (await request.json().catch(() => null)) as {
			decision?: unknown;
			confirmDifferentNetwork?: unknown;
		} | null;
		const choice = body?.decision;
		if (choice !== 'approve' && choice !== 'deny') return refuse(400, 'decision must be approve or deny');

		const ip = context.clientAddress;
		const result = await requests.decideRequest(
			context.id,
			choice,
			{ uid: user.uid, email: user.email ?? null },
			{
				approverNetwork: await requests.hashNetwork(ip),
				approverFamily: networkFamily(ip),
				confirmDifferentNetwork: body?.confirmDifferentNetwork === true,
				method: 'tap'
			}
		);
		if (result === 'not-found') return notFound();
		if (result === 'confirm-network') {
			// Nothing changed. The phone shows the warning and sends the request again with the confirmation.
			return json({ status: result }, { status: 409 });
		}
		return json({ status: result });
	};

	/**
	 * The asking browser polls here with its collection secret. A wrong secret,
	 * unknown id, used request, oversized or unreadable body, or a switched-off
	 * feature all read as expired.
	 */
	const collect: RouteHandler = async (request, context) => {
		const expired = () => json({ status: 'expired' });
		if (config.disabled()) return expired();

		const text = await readCappedBody(request, MAX_BODY);
		if (text === null) return expired();

		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return expired();
		}
		const secret = typeof body === 'object' && body !== null ? (body as { secret?: unknown }).secret : undefined;
		if (!isRequestId(context.id) || typeof secret !== 'string' || !secret || secret.length > 100) {
			return expired();
		}

		// collectRequest hands over the clock reading it stores as usedAt, so the
		// token's exp can never be later than usedAt plus its lifetime.
		const result = await requests.collectRequest(context.id, secret, (uid, now) => mintCustomToken(uid, now));
		return json(result);
	};

	/**
	 * A trusted phone approves by itself. Everything a tap approval checks still
	 * applies, plus three things checked here: the account's trusted phone
	 * record, that phone's signature over this request id, and the phone being
	 * on the network that asked. A different network has no override; the phone
	 * falls back to the tap flow and its warning.
	 *
	 * A body that is missing, oversized, unreadable or not JSON, or a signature
	 * that is not a string, answers 400. Only a signature that fails verification
	 * answers 403 not-trusted, because the phone forgets its key on that answer
	 * and a truncated upload must never cost it the key. A store failure answers
	 * 500 with a plain message and logs without the uid; the phone keeps its key
	 * and shows the tap flow.
	 */
	const auto: RouteHandler = async (request, context) => {
		if (config.disabled()) return turnedOff();
		const { user, refusal } = await freshGoogleAdmin(request);
		if (refusal) return refusal;
		if (!isRequestId(context.id)) return notFound();

		const body = await readCappedJsonObject(request, MAX_BODY);
		const signature = body?.signature;
		if (typeof signature !== 'string') {
			return json({ error: 'This request could not be read.' }, { status: 400 });
		}

		let result: Awaited<ReturnType<RequestLifecycle['decideRequest']>>;
		try {
			if (!(await trustedPhones.verifyAutoSignature(user.uid, context.id, signature))) {
				return json({ status: 'not-trusted' }, { status: 403 });
			}
			const ip = context.clientAddress;
			result = await requests.decideRequest(
				context.id,
				'approve',
				{ uid: user.uid, email: user.email ?? null },
				{
					approverNetwork: await requests.hashNetwork(ip),
					approverFamily: networkFamily(ip),
					confirmDifferentNetwork: false,
					method: 'auto'
				}
			);
		} catch (e) {
			console.error(`[phone-sign-in] automatic approval failed: ${logMessage(e, user.uid)}`);
			return json({ error: 'Could not approve automatically.' }, { status: 500 });
		}
		if (result === 'not-found') return notFound();
		if (result === 'confirm-network') return json({ status: 'different-network' }, { status: 409 });
		return json({ status: result });
	};

	type Reported = Extract<NotMeResult, { status: 'reported' }>;

	/**
	 * Records the report. null means nothing is known about the request: the
	 * report threw, or the request is not one this account decided. Neither is
	 * a reason to refuse, because the sign-out has to run either way.
	 */
	async function tryReport(id: string, uid: string): Promise<Reported | null> {
		try {
			const report = await requests.reportNotMe(id, uid);
			return report.status === 'reported' ? report : null;
		} catch (e) {
			console.error(`[phone-sign-in] recording "That wasn't me" failed: ${logMessage(e, uid)}`);
			return null;
		}
	}

	/**
	 * The latest moment a custom token for this request could still make a
	 * session, or null when none was ever collected. With no report (unknown) it
	 * is the full window from `now`.
	 *
	 * A token collected before `now` was minted no later than `now`, so the answer
	 * never goes past `now` plus the lifetime, whatever the stored `usedAt` says. A
	 * bad value there can shorten the wait to nothing at worst (the sign-out
	 * still happens) but never stretches it.
	 */
	function passUsableUntil(report: Reported | null, now: number): number | null {
		const latest = now + PASS_LIFETIME_MS;
		if (report === null) return latest;
		if (report.collectedAt === null) return null;
		return Math.min(report.collectedAt + PASS_LIFETIME_MS, latest);
	}

	/** When the last sign-out for a pass goes out: past the token's life, the assumed leeway and the second rounding. */
	const signOutDeadline = (usableUntil: number) => usableUntil + EXPIRY_MARGIN_MS + SECOND_MS;

	/**
	 * "That wasn't me" from the phone's done screen. Blocks the request if the
	 * computer has not collected it yet, turns off automatic approval and signs
	 * every session of the account out. It works with phone sign-in switched
	 * off, because it is the answer to a compromise, and it always signs out: a
	 * request it cannot find or read is handled as one whose state is unknown,
	 * never refused. The trusted phone and the sessions are handled separately,
	 * so one failing does not stop the other, and the answer says which worked.
	 *
	 * Signing out has a gap a single call cannot close. A custom token can be
	 * traded for a new session until it expires, and Firebase revokes only
	 * sessions whose auth_time is before validSince, so a session created from
	 * the token after the sign-out survives it. When the computer collected one
	 * that could still be used, this waits until it has expired and signs out
	 * once more. That sign-out's validSince comes from the deadline itself, not
	 * from the clock after the timer, because a Worker's Date.now() only
	 * advances on I/O.
	 *
	 * Assumptions, from Ringmaster's spec: Identity Toolkit's leeway past a
	 * custom token's exp is at most EXPIRY_MARGIN_MS (unverified), and the wait
	 * survives because a Worker's request has no duration limit while the
	 * client stays connected. If the wait is cut off, the first sign-out has
	 * already happened.
	 */
	const notMe: RouteHandler = async (request, context) => {
		const { user, refusal } = await freshGoogleAdmin(request);
		if (refusal) return refusal;
		if (!isRequestId(context.id)) return notFound();
		const id = context.id;
		const uid = user.uid;

		let report = await tryReport(id, uid);
		const startedAt = Date.now();

		const [autoOff, firstSignOut] = await Promise.all([
			trustedPhones.removeTrustedPhone(uid).then(
				() => true,
				(e) => {
					console.error(`[phone-sign-in] removing the trusted phone failed: ${logMessage(e, uid)}`);
					return false;
				}
			),
			revokeSessions(uid)
		]);

		let signedOut = firstSignOut;
		// The validSince, in ms, of the latest sign-out so far.
		let latestSignOut = startedAt;

		/** Waits for the deadline, then signs out with a validSince taken from it, never from an earlier clock. */
		async function signOutAt(deadline: number) {
			await wait(deadline - Date.now());
			latestSignOut = Math.max(Date.now(), deadline);
			const done = await revokeSessions(uid, latestSignOut);
			signedOut = signedOut && done;
		}

		// A deadline at or before the first sign-out needs no second one: the token
		// was dead, leeway included, before that sign-out's second began.
		const usableUntil = passUsableUntil(report, startedAt);
		if (usableUntil !== null && signOutDeadline(usableUntil) > latestSignOut) {
			await signOutAt(signOutDeadline(usableUntil));
		}

		// Unknown: the report threw or found nothing, so the request may still have
		// been approved and collected while this waited. A report that works now
		// also blocks it (reportNotMe is safe to repeat). One more round at most.
		if (report === null) {
			report = await tryReport(id, uid);
			const lateUsableUntil = passUsableUntil(report, Date.now());
			// Nothing more is known if the report failed again, and nothing is left to
			// wait for if the computer never collected. Otherwise only a collection
			// after the last sign-out was planned for is new.
			if (report !== null && lateUsableUntil !== null && signOutDeadline(lateUsableUntil) > latestSignOut) {
				await signOutAt(signOutDeadline(lateUsableUntil));
			}
		}

		// The report worked and nothing was collected, so the computer never got in.
		const blocked = report !== null && report.collectedAt === null;
		return json({ status: 'reported', signedOut, autoOff, blocked });
	};

	/**
	 * Trusting this phone. It needs the same fresh Google sign-in as a tap
	 * approval, so it gives nobody more than a tap would. A store failure
	 * answers 500 with a plain message and logs without the uid.
	 */
	const trust: RouteHandler = async (request) => {
		if (config.disabled()) return turnedOff();
		const { user, refusal } = await freshGoogleAdmin(request);
		if (refusal) return refusal;

		const body = await readCappedJsonObject(request, MAX_BODY);
		const key = await parsePublicKey(body?.publicKey);
		if (!key) {
			return json({ error: `This phone sent a key ${appName} cannot use.` }, { status: 400 });
		}

		try {
			await trustedPhones.enrollTrustedPhone(user.uid, key, describeDevice(request.headers.get('user-agent') ?? ''));
		} catch (e) {
			console.error(`[phone-sign-in] trusting the phone failed: ${logMessage(e, user.uid)}`);
			return json({ error: 'Could not trust this phone right now.' }, { status: 500 });
		}
		return json({ status: 'trusted' });
	};

	/** Stopping only takes automatic approval away, so any admin session may, even with phone sign-in switched off. */
	const stopTrusting: RouteHandler = async (request) => {
		const user = await config.verifyUser(request);
		try {
			await trustedPhones.removeTrustedPhone(user.uid);
		} catch (e) {
			console.error(`[phone-sign-in] removing the trusted phone failed: ${logMessage(e, user.uid)}`);
			return json({ error: 'Could not stop automatic approval right now.' }, { status: 500 });
		}
		return json({ status: 'removed' });
	};

	return {
		create: guarded(create),
		lookup: guarded(lookup),
		decision: guarded(decision),
		collect: guarded(collect),
		auto: guarded(auto),
		notMe: guarded(notMe),
		trust: guarded(trust),
		stopTrusting: guarded(stopTrusting)
	};
}
