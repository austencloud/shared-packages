// Phone approval sign-in requests. A browser asks, an admin approves on a
// signed-in phone, and only the browser holding the collection secret can
// collect the one-time custom token. Every status change is a conditional
// write, so each request is approved once and collected once.
//
// Status moves pending to approved or denied, then approved to used. "That
// wasn't me" adds one more move: an approved request the computer has not
// collected goes to denied, so it can never be collected.
// Specs: Ringmaster docs/superpowers/specs/2026-10-07-phone-approval-sign-in-design.md
//        Ringmaster docs/superpowers/specs/2026-10-08-phone-auto-approve-design.md
//
// Expiry is createTime + REQUEST_LIFETIME_MS, where createTime is the stamp
// Firestore sets when the document is first written. Every field a document
// stores, expiresAt included, could be rewritten by a client the rules let in,
// so a stored time is kept for the audit trail and never trusted.
//
// The same goes for every other stored field, so an approval also carries an
// `approvalTag`: an HMAC under a key only this server can compute (server-key.ts)
// over the request id, the approver's uid, Firestore's createTime and the secret
// hash. Collection recomputes it before minting anything, so a document written
// from a client, with or without a valid secretHash, never yields a token.
//
// reportNotMe is the one place that does read stored fields as they are:
// `status`, `usedAt` and `decidedBy`. It relies on the app's Firestore rules
// keeping browsers out of the requests collection, so only this server writes
// them. The not-me handler bounds the damage anyway: whatever those fields
// say, it always signs out, and a bad `usedAt` can never make its wait longer
// than one token life.
import { networkFamily, networkScope, type NetworkFamily } from './network-scope';
import { constantTimeEqual, type ServerKeys } from './server-key';
import type { PhoneSignInStore } from './store';

export const REQUESTS_COLLECTION = 'phone_sign_in_requests';
export const REQUEST_LIFETIME_MS = 3 * 60_000;
/** A Firestore TTL policy on `purgeAt` can delete the document this long after it was created. */
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60_000;

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 20;
const USER_AGENT_LIMIT = 300;

export type StoredStatus = 'pending' | 'approved' | 'denied' | 'used';
export type VisibleStatus = StoredStatus | 'expired';

export interface DeviceInfo {
	label: string;
	userAgent: string;
	place: string;
	/** Which copy of the app asked (describeSite): '' for the live site. */
	site: string;
}

export interface CreatedRequest {
	id: string;
	code: string;
	secret: string;
	expiresAt: Date;
	/** How long the request lasts from now, by the server's clock. Clients count down from this, never from `expiresAt`. */
	expiresInMs: number;
}

export interface RequestSummary {
	status: VisibleStatus;
	code: string;
	device: DeviceInfo;
	/** The network hash stored at creation; '' when it was unknown. Compare with `sameNetwork`. */
	network: string;
	/** Firestore's createTime. */
	createdAt: Date;
	/** createTime plus the request lifetime. */
	expiresAt: Date;
	/** How long ago the request was created, by the server's clock. */
	ageMs: number;
	/** How long until it expires, by the server's clock; 0 once it has. */
	expiresInMs: number;
}

export interface Approver {
	uid: string;
	email: string | null;
}

export type Decision = 'approve' | 'deny';
export type StoredDecisionResult =
	| 'approved'
	| 'denied'
	| 'expired'
	| 'not-found'
	| 'already-decided'
	| 'confirm-network';

/** What the server keeps about the network a request came from. */
export interface NetworkInfo {
	/** `hashNetwork` of the address; '' when unknown. */
	hash: string;
	family: NetworkFamily;
}

export interface DecisionNetwork {
	/** `hashNetwork` of the approving device's address; '' when it is unknown. */
	approverNetwork: string;
	/** `networkFamily` of the approving device's address, for the audit trail. */
	approverFamily: NetworkFamily;
	/** True only when the approver was shown the different-network warning and chose to go on. */
	confirmDifferentNetwork: boolean;
	/** 'auto' when a trusted phone approved by itself. An automatic approval never takes the confirmation. */
	method: 'tap' | 'auto';
}
export type CollectResult = { status: 'pending' | 'denied' | 'expired' } | { status: 'approved'; token: string };

export type NotMeResult =
	| { status: 'not-found' }
	/** `collectedAt` is the `usedAt` the collect write stored, in ms; null when the computer never collected. */
	| { status: 'reported'; collectedAt: number | null };

export function isRequestId(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Za-z0-9]{20}$/.test(value);
}

/** Two network hashes match only when both are known and equal. */
export function sameNetwork(a: string, b: string): boolean {
	return a !== '' && b !== '' && constantTimeEqual(a, b);
}

function randomId(): string {
	// 248 is the largest multiple of 62 below 256, so rejecting bytes at or
	// above it keeps every character equally likely.
	let id = '';
	while (id.length < ID_LENGTH) {
		for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH))) {
			if (byte < 248 && id.length < ID_LENGTH) id += ID_ALPHABET[byte % 62];
		}
	}
	return id;
}

function randomCode(): string {
	// 4_294_000_000 is the largest multiple of 1_000_000 below 2^32.
	const value = new Uint32Array(1);
	do crypto.getRandomValues(value);
	while (value[0] >= 4_294_000_000);
	return String(value[0] % 1_000_000).padStart(6, '0');
}

function randomSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function storedNetwork(data: Record<string, unknown>): string {
	return typeof data.network === 'string' ? data.network : '';
}

/** createTime plus the lifetime, or null if Firestore's stamp cannot be read. */
function expiryFromCreateTime(createTime: string): Date | null {
	const created = Date.parse(createTime);
	return Number.isNaN(created) ? null : new Date(created + REQUEST_LIFETIME_MS);
}

/** Pending and approved requests expire; a decided or used one keeps its status. */
function visibleStatus(data: Record<string, unknown>, createTime: string, now: number): VisibleStatus {
	const status = data.status as StoredStatus;
	if (status === 'pending' || status === 'approved') {
		const expiresAt = expiryFromCreateTime(createTime);
		if (!expiresAt || now >= expiresAt.getTime()) return 'expired';
	}
	return status;
}

/**
 * When the computer collected the approval, in ms, or null if it never did.
 * Only the collect write sets `used`, and it stores `usedAt` with it. A `used`
 * request whose `usedAt` cannot be read (it can only have been rewritten) is
 * treated as collected right now, the latest it could have been, so the
 * caller errs toward waiting instead of claiming the computer never got in.
 */
function collectedAtOf(data: Record<string, unknown>, now: number): number | null {
	if (data.status !== 'used') return null;
	const usedAt = data.usedAt;
	return usedAt instanceof Date && !Number.isNaN(usedAt.getTime()) ? usedAt.getTime() : now;
}

export interface RequestLifecycleOptions {
	store: PhoneSignInStore;
	keys: ServerKeys;
	/** Default 'phone_sign_in_requests'. */
	collection?: string;
}

export interface RequestLifecycle {
	hashNetwork(ip: string): Promise<string>;
	networkInfo(ip: string): Promise<NetworkInfo>;
	createRequest(device: DeviceInfo, network: NetworkInfo, now?: number): Promise<CreatedRequest>;
	getRequestSummary(id: string, now?: number): Promise<RequestSummary | null>;
	decideRequest(
		id: string,
		decision: Decision,
		approver: Approver,
		network: DecisionNetwork,
		now?: number
	): Promise<StoredDecisionResult>;
	collectRequest(
		id: string,
		secret: string,
		mintToken: (uid: string, now: number) => Promise<string>,
		now?: number
	): Promise<CollectResult>;
	reportNotMe(id: string, uid: string, now?: number): Promise<NotMeResult>;
}

export function createRequestLifecycle({
	store,
	keys,
	collection = REQUESTS_COLLECTION
}: RequestLifecycleOptions): RequestLifecycle {
	/**
	 * Identifies the network an address belongs to without keeping the address:
	 * the hex HMAC, under the server's own 'network' key, of the network scope
	 * (IPv4 as is, IPv6 cut to its /64; see network-scope.ts). The key keeps a
	 * leaked hash from being checked against a list of candidate addresses. Empty
	 * when the address is unknown or malformed, which never counts as a match. A
	 * private, loopback or link-local address is unknown too: a dev server behind
	 * a tunnel sees only its own loopback address for every caller, so it would
	 * make all of them one network.
	 */
	async function hashNetwork(ip: string): Promise<string> {
		const scope = networkScope(ip);
		return scope === '' ? '' : keys.hmacHex('network', scope);
	}

	async function networkInfo(ip: string): Promise<NetworkInfo> {
		return { hash: await hashNetwork(ip), family: networkFamily(ip) };
	}

	/** The proof that this server approved this request for this uid. See the header comment. */
	function approvalTag(id: string, uid: string, createTime: string, secretHash: string): Promise<string> {
		return keys.hmacHex('approval', `${id}\u0000${uid}\u0000${createTime}\u0000${secretHash}`);
	}

	/**
	 * Starts a request. `network` is the hash and family of the asking address (see
	 * `networkInfo`); the address itself is never stored. `expiresAt` and `purgeAt`
	 * are written for the audit trail and cleanup; expiry decisions use Firestore's
	 * createTime.
	 */
	async function createRequest(device: DeviceInfo, network: NetworkInfo, now = Date.now()): Promise<CreatedRequest> {
		const id = randomId();
		const code = randomCode();
		const secret = randomSecret();
		const expiresAt = new Date(now + REQUEST_LIFETIME_MS);

		await store.set(collection, id, {
			status: 'pending',
			code,
			secretHash: await sha256Hex(secret),
			network: network.hash,
			networkFamily: network.family,
			createdAt: new Date(now),
			expiresAt,
			purgeAt: new Date(now + PURGE_AFTER_MS),
			device: {
				label: device.label,
				userAgent: device.userAgent.slice(0, USER_AGENT_LIMIT),
				place: device.place,
				site: device.site
			}
		});

		return { id, code, secret, expiresAt, expiresInMs: REQUEST_LIFETIME_MS };
	}

	async function getRequestSummary(id: string, now = Date.now()): Promise<RequestSummary | null> {
		const doc = await store.getWithRevision(collection, id);
		if (!doc) return null;
		const { data, createTime } = doc;
		const device = (data.device ?? {}) as Partial<DeviceInfo>;
		const expiresAt = expiryFromCreateTime(createTime);
		return {
			status: visibleStatus(data, createTime, now),
			code: String(data.code ?? ''),
			device: {
				label: String(device.label ?? ''),
				userAgent: String(device.userAgent ?? ''),
				place: String(device.place ?? ''),
				// Ringmaster requests made before 2026-10-09 have no site; all of them came from the live site.
				site: String(device.site ?? '')
			},
			network: storedNetwork(data),
			createdAt: expiresAt ? new Date(expiresAt.getTime() - REQUEST_LIFETIME_MS) : new Date(0),
			expiresAt: expiresAt ?? new Date(0),
			ageMs: expiresAt ? Math.max(0, now - (expiresAt.getTime() - REQUEST_LIFETIME_MS)) : 0,
			expiresInMs: expiresAt ? Math.max(0, expiresAt.getTime() - now) : 0
		};
	}

	/**
	 * Approves or denies a pending request. An approval from a different network
	 * than the one that asked (or with either network unknown) needs the approver's
	 * explicit confirmation; without it nothing changes and the result is
	 * 'confirm-network'. Only a 'tap' with confirmDifferentNetwork set to true can
	 * override a mismatch. An automatic approval ('auto'), or any other method
	 * value, needs the networks to match and has no override. A denial never needs
	 * either. Every decision records how it was made and whether the networks
	 * matched. The uid comes from the verified ID token the caller passes in
	 * `approver`, never from the request body.
	 */
	async function decideRequest(
		id: string,
		decision: Decision,
		approver: Approver,
		network: DecisionNetwork,
		now = Date.now()
	): Promise<StoredDecisionResult> {
		const doc = await store.getWithRevision(collection, id);
		if (!doc) return 'not-found';

		const status = visibleStatus(doc.data, doc.createTime, now);
		if (status === 'expired') return 'expired';
		if (status !== 'pending') return 'already-decided';

		const matched = sameNetwork(storedNetwork(doc.data), network.approverNetwork);
		// Fails closed: only a tap with the confirmation set to exactly true goes
		// ahead on a mismatch. Any other method value, or any other confirmation
		// value, is refused.
		if (decision === 'approve' && !matched && !(network.method === 'tap' && network.confirmDifferentNetwork === true)) {
			return 'confirm-network';
		}

		const next = decision === 'approve' ? 'approved' : 'denied';
		const update: Record<string, unknown> = {
			status: next,
			decidedBy: { uid: approver.uid, email: approver.email },
			decidedAt: new Date(now),
			method: network.method,
			approverSameNetwork: matched,
			approverNetworkFamily: network.approverFamily
		};
		if (decision === 'approve') {
			// Written in the same conditional write as the status, so there is never an
			// approved document without its tag. The hash is the one on the document
			// this call read; the revision check fails the write if that changed.
			update.approvalTag = await approvalTag(id, approver.uid, doc.createTime, String(doc.data.secretHash ?? ''));
		}
		const won = await store.updateIfCurrent(collection, id, update, doc.revision);
		return won ? next : 'already-decided';
	}

	/**
	 * Hands the asking browser its token once the request is approved. A wrong
	 * secret looks exactly like an expired request, and so does an approval that
	 * lacks a valid approvalTag (a document written by anyone but decideRequest).
	 * The token is minted before the request is marked used, so a signing failure
	 * leaves nothing consumed, and it is only returned if this call's conditional
	 * write wins.
	 *
	 * `mintToken` gets `now`, the same reading that is stored as `usedAt`. The
	 * token's exp is therefore at most floor(usedAt / 1000) plus its lifetime, and
	 * "That wasn't me" can work out when the token is dead from `usedAt` alone.
	 * A mint that read its own clock could land in a later second than `usedAt`.
	 */
	async function collectRequest(
		id: string,
		secret: string,
		mintToken: (uid: string, now: number) => Promise<string>,
		now = Date.now()
	): Promise<CollectResult> {
		const doc = await store.getWithRevision(collection, id);
		if (!doc) return { status: 'expired' };

		const storedHash = doc.data.secretHash;
		if (typeof storedHash !== 'string' || !constantTimeEqual(await sha256Hex(secret), storedHash)) {
			return { status: 'expired' };
		}

		const status = visibleStatus(doc.data, doc.createTime, now);
		if (status === 'pending') return { status: 'pending' };
		if (status === 'denied') return { status: 'denied' };
		if (status !== 'approved') return { status: 'expired' };

		const uid = (doc.data.decidedBy as { uid?: unknown } | undefined)?.uid;
		if (typeof uid !== 'string' || !uid) return { status: 'expired' };

		// Checked before anything is minted. Every field a client can write feeds the
		// tag, so changing the uid, the secret hash or the id breaks it.
		const tag = doc.data.approvalTag;
		if (typeof tag !== 'string' || !constantTimeEqual(await approvalTag(id, uid, doc.createTime, storedHash), tag)) {
			console.warn(`[phone-sign-in] approved request ${id} has no valid approval tag; not collected`);
			return { status: 'expired' };
		}

		const token = await mintToken(uid, now);
		const won = await store.updateIfCurrent(collection, id, { status: 'used', usedAt: new Date(now) }, doc.revision);
		return won ? { status: 'approved', token } : { status: 'expired' };
	}

	/**
	 * "That wasn't me" for a request this uid decided. Records when it was
	 * reported (the first report's time is kept on later ones) and, if the
	 * computer has not collected the approval yet, turns it into a denial so it
	 * never can. The answer says when the computer did collect it, so the caller
	 * knows how long the custom token it got could still be used. A request this
	 * uid did not decide is 'not-found', so the call says nothing about anyone
	 * else's requests.
	 */
	async function reportNotMe(id: string, uid: string, now = Date.now()): Promise<NotMeResult> {
		// A collection can land between the read and the write; read again and retry.
		for (let attempt = 0; attempt < 3; attempt++) {
			const doc = await store.getWithRevision(collection, id);
			if (!doc) return { status: 'not-found' };
			const decider = (doc.data.decidedBy as { uid?: unknown } | undefined)?.uid;
			if (typeof decider !== 'string' || decider !== uid) return { status: 'not-found' };

			const update: Record<string, unknown> = {};
			if (!(doc.data.reportedNotMeAt instanceof Date)) update.reportedNotMeAt = new Date(now);
			if (doc.data.status === 'approved') update.status = 'denied';
			// A request already reported and already past approval has nothing left to change.
			if (Object.keys(update).length > 0) {
				if (!(await store.updateIfCurrent(collection, id, update, doc.revision))) continue;
			}
			return { status: 'reported', collectedAt: collectedAtOf(doc.data, now) };
		}
		throw new Error(`[phone-sign-in] could not record "That wasn't me" for ${id}`);
	}

	return { hashNetwork, networkInfo, createRequest, getRequestSummary, decideRequest, collectRequest, reportNotMe };
}
