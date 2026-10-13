// The one phone per account that may approve a phone sign-in by itself. The
// phone keeps a non-extractable ECDSA P-256 private key in its browser; this
// stores the public half in `trusted_phones/<uid>`. Only this server writes
// these records, and each carries a `keyTag`, an HMAC under the server's
// 'trusted-phone' key over the uid and the coordinates, so a record this server
// did not write never verifies. If the app's Firestore rules let a client
// write trusted_phones, that client could restore a record this server wrote
// earlier, for example after "Stop approving automatically", and the old key
// would work again; the rules must keep browsers out.
// Spec: Ringmaster docs/superpowers/specs/2026-10-08-phone-auto-approve-design.md
import { autoApprovalMessage } from '../shared/auto-message';
import { constantTimeEqual, type ServerKeys } from './server-key';
import type { PhoneSignInStore } from './store';

export const TRUSTED_PHONES_COLLECTION = 'trusted_phones';

/** The two base64url coordinates of a P-256 public key. */
export interface PublicKeyCoordinates {
	x: string;
	y: string;
}

const LABEL_LIMIT = 100;
/** 32 bytes of base64url without padding. */
const COORDINATE = /^[A-Za-z0-9_-]{43}$/;
/** A raw (r || s) P-256 signature is 64 bytes: 86 base64url characters. */
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const CURVE = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGNING = { name: 'ECDSA', hash: 'SHA-256' } as const;

function fromBase64Url(text: string): Uint8Array {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function importPublicKey({ x, y }: PublicKeyCoordinates): Promise<CryptoKey> {
	return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, ext: true }, CURVE, false, ['verify']);
}

/**
 * The coordinates of a P-256 public key sent as a JWK, or null for anything
 * else: another key type or curve, a private key (it has `d`), or a point that
 * is not on the curve (the import refuses it).
 */
export async function parsePublicKey(value: unknown): Promise<PublicKeyCoordinates | null> {
	if (typeof value !== 'object' || value === null) return null;
	const { kty, crv, x, y, d } = value as Record<string, unknown>;
	if (kty !== 'EC' || crv !== 'P-256' || d !== undefined) return null;
	if (typeof x !== 'string' || typeof y !== 'string' || !COORDINATE.test(x) || !COORDINATE.test(y)) return null;
	try {
		await importPublicKey({ x, y });
	} catch {
		return null;
	}
	return { x, y };
}

export interface TrustedPhonesOptions {
	store: PhoneSignInStore;
	keys: ServerKeys;
	/** The app's signing purpose; the phone signs with the same one. */
	autoPurpose: string;
	/** Default 'trusted_phones'. */
	collection?: string;
}

export interface TrustedPhones {
	enrollTrustedPhone(uid: string, key: PublicKeyCoordinates, label: string, now?: number): Promise<void>;
	verifyAutoSignature(uid: string, requestId: string, signature: string): Promise<boolean>;
	removeTrustedPhone(uid: string): Promise<void>;
}

export function createTrustedPhones({
	store,
	keys,
	autoPurpose,
	collection = TRUSTED_PHONES_COLLECTION
}: TrustedPhonesOptions): TrustedPhones {
	function keyTag(uid: string, { x, y }: PublicKeyCoordinates): Promise<string> {
		return keys.hmacHex('trusted-phone', `${uid}\u0000${x}\u0000${y}`);
	}

	/**
	 * Makes this key the account's only trusted phone, replacing any earlier one.
	 * Throws if the coordinates are not well-formed; callers get them from
	 * parsePublicKey, and this checks again so a bad value never reaches the store.
	 */
	async function enrollTrustedPhone(
		uid: string,
		key: PublicKeyCoordinates,
		label: string,
		now = Date.now()
	): Promise<void> {
		if (!COORDINATE.test(key.x) || !COORDINATE.test(key.y)) {
			throw new Error('The trusted phone key has malformed coordinates');
		}
		await store.set(collection, uid, {
			x: key.x,
			y: key.y,
			label: label.slice(0, LABEL_LIMIT),
			enrolledAt: new Date(now),
			keyTag: await keyTag(uid, key)
		});
	}

	/**
	 * True only when the account has a trusted phone record this server wrote and
	 * `signature` is that phone's signature over this request id. A record this
	 * server did not write never verifies. A signature names one request, and a
	 * request is approved once, so a copied signature is worth nothing afterwards.
	 */
	async function verifyAutoSignature(uid: string, requestId: string, signature: string): Promise<boolean> {
		if (!SIGNATURE.test(signature)) return false;
		const record = await store.get(collection, uid);
		if (!record) return false;
		const { x, y, keyTag: tag } = record;
		if (typeof x !== 'string' || typeof y !== 'string' || typeof tag !== 'string') return false;
		if (!COORDINATE.test(x) || !COORDINATE.test(y)) return false;
		if (!constantTimeEqual(await keyTag(uid, { x, y }), tag)) {
			// No uid in the log line, like the rest of phone sign-in.
			console.warn('[phone-sign-in] a trusted phone record has no valid key tag; ignored');
			return false;
		}
		let key: CryptoKey;
		try {
			key = await importPublicKey({ x, y });
		} catch {
			return false;
		}
		// The Uint8Array generics in lib.dom do not line up with BufferSource here.
		return crypto.subtle.verify(
			SIGNING,
			key,
			fromBase64Url(signature) as BufferSource,
			autoApprovalMessage(autoPurpose, requestId) as BufferSource
		);
	}

	/** Forgets the account's trusted phone. Removing a record that is not there is fine. */
	async function removeTrustedPhone(uid: string): Promise<void> {
		await store.delete(collection, uid);
	}

	return { enrollTrustedPhone, verifyAutoSignature, removeTrustedPhone };
}
