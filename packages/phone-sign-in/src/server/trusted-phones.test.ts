import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for Firestore: set stores a clone, get returns a clone
// (or null), delete forgets. A test can overwrite a stored record directly, as
// someone with admin access to the database could.
const store = vi.hoisted(() => {
	const docs = new Map<string, Record<string, unknown>>();
	// Stands in for the service account key the server keys are derived from.
	const keyMaterial = new TextEncoder().encode('test service account private key');
	return { docs, keyMaterial };
});

const PURPOSE = 'ringmaster-phone-sign-in-auto';

import { autoApprovalMessage } from '../shared/auto-message';
import { createServerKeys } from './server-key';
import { TRUSTED_PHONES_COLLECTION, createTrustedPhones, parsePublicKey } from './trusted-phones';

const { hmacHex } = createServerKeys({ secret: () => store.keyMaterial, salt: 'ringmaster-phone-sign-in' });
const { enrollTrustedPhone, removeTrustedPhone, verifyAutoSignature } = createTrustedPhones({
	store: {
		get: async (collection, id) => {
			const doc = store.docs.get(`${collection}/${id}`);
			return doc ? structuredClone(doc) : null;
		},
		getWithRevision: async () => {
			throw new Error('not used by trusted phones');
		},
		set: async (collection, id, data) => {
			store.docs.set(`${collection}/${id}`, structuredClone(data));
		},
		updateIfCurrent: async () => {
			throw new Error('not used by trusted phones');
		},
		delete: async (collection, id) => {
			store.docs.delete(`${collection}/${id}`);
		}
	},
	keys: { hmacHex },
	autoPurpose: PURPOSE
});

const ID = 'AbCdEfGhIjKlMnOpQr12';
const OTHER_ID = 'ZyXwVuTsRqPoNmLkJi98';
const UID = 'austen-uid';
const T0 = Date.UTC(2026, 9, 8, 14, 0, 0);
const NUL = String.fromCharCode(0);

async function phoneKey() {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
	const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
	return { pair, jwk: { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! } };
}

function base64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(pair: CryptoKeyPair, id: string): Promise<string> {
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		pair.privateKey,
		autoApprovalMessage(PURPOSE, id) as BufferSource
	);
	return base64Url(new Uint8Array(sig));
}

function stored(uid = UID) {
	return store.docs.get(`${TRUSTED_PHONES_COLLECTION}/${uid}`);
}

beforeEach(() => {
	store.docs.clear();
});

describe('parsePublicKey', () => {
	it("accepts the phone's JWK and returns only the coordinates", async () => {
		const { jwk } = await phoneKey();
		expect(await parsePublicKey(jwk)).toEqual({ x: jwk.x, y: jwk.y });
	});

	it('refuses anything that is not a P-256 public key', async () => {
		const { jwk } = await phoneKey();
		expect(await parsePublicKey(null)).toBeNull();
		expect(await parsePublicKey('not a key')).toBeNull();
		expect(await parsePublicKey({ ...jwk, kty: 'RSA' })).toBeNull();
		expect(await parsePublicKey({ ...jwk, crv: 'P-384' })).toBeNull();
	});

	it('refuses a coordinate that is a number, a missing coordinate, and an array', async () => {
		const { jwk } = await phoneKey();
		const { y: _removed, ...withoutY } = jwk;
		expect(await parsePublicKey({ ...jwk, x: 42 })).toBeNull();
		expect(await parsePublicKey(withoutY)).toBeNull();
		expect(await parsePublicKey([jwk])).toBeNull();
		expect(await parsePublicKey([])).toBeNull();
	});

	it('refuses a private key', async () => {
		const { jwk } = await phoneKey();
		expect(await parsePublicKey({ ...jwk, d: jwk.x })).toBeNull();
	});

	it('refuses a coordinate of the wrong length', async () => {
		const { jwk } = await phoneKey();
		expect(await parsePublicKey({ ...jwk, x: jwk.x.slice(0, 42) })).toBeNull();
		expect(await parsePublicKey({ ...jwk, y: `${jwk.y}A` })).toBeNull();
	});

	it('refuses coordinates that are well formed but not a point on the curve', async () => {
		const { jwk } = await phoneKey();
		expect(await parsePublicKey({ ...jwk, x: 'A'.repeat(43), y: 'A'.repeat(43) })).toBeNull();
	});
});

describe('enrollTrustedPhone', () => {
	it('stores the coordinates, label, time and a server key tag', async () => {
		const { jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		expect(stored()).toEqual({
			x: jwk.x,
			y: jwk.y,
			label: 'Chrome on Android',
			enrolledAt: new Date(T0),
			keyTag: await hmacHex('trusted-phone', `${UID}${NUL}${jwk.x}${NUL}${jwk.y}`)
		});
	});

	it('cuts a long label to 100 characters', async () => {
		const { jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'a'.repeat(250), T0);
		expect(stored()!.label).toBe('a'.repeat(100));
	});

	it('throws on malformed coordinates and stores nothing', async () => {
		const { jwk } = await phoneKey();
		await expect(
			enrollTrustedPhone(UID, { x: jwk.x.slice(0, 42), y: jwk.y }, 'Chrome on Android', T0)
		).rejects.toThrow(/malformed coordinates/);
		await expect(
			enrollTrustedPhone(UID, { x: jwk.x, y: `${jwk.y}=` }, 'Chrome on Android', T0)
		).rejects.toThrow(/malformed coordinates/);
		expect(stored()).toBeUndefined();
	});

	it('replaces the earlier key: only the newest phone verifies', async () => {
		const first = await phoneKey();
		const second = await phoneKey();
		await enrollTrustedPhone(UID, { x: first.jwk.x, y: first.jwk.y }, 'First phone', T0);
		expect(await verifyAutoSignature(UID, ID, await sign(first.pair, ID))).toBe(true);

		await enrollTrustedPhone(UID, { x: second.jwk.x, y: second.jwk.y }, 'Second phone', T0 + 1000);
		expect(await verifyAutoSignature(UID, ID, await sign(first.pair, ID))).toBe(false);
		expect(await verifyAutoSignature(UID, ID, await sign(second.pair, ID))).toBe(true);
	});
});

describe('verifyAutoSignature', () => {
	it("is true for the enrolled phone's signature over this request id", async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		expect(await verifyAutoSignature(UID, ID, await sign(pair, ID))).toBe(true);
	});

	it('is false for a signature over a different request id', async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		expect(await verifyAutoSignature(UID, ID, await sign(pair, OTHER_ID))).toBe(false);
	});

	it('is false for a different account even when it holds a copy of the record', async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		const signature = await sign(pair, ID);
		// The copy carries Austen's coordinates and key tag, so only the uid the tag
		// was computed for can tell it apart from a record written for this account.
		store.docs.set(`${TRUSTED_PHONES_COLLECTION}/someone-else`, structuredClone(stored()!));

		expect(await verifyAutoSignature(UID, ID, signature)).toBe(true);
		expect(await verifyAutoSignature('someone-else', ID, signature)).toBe(false);
	});

	it('is false when the account has no trusted phone', async () => {
		const { pair } = await phoneKey();
		expect(await verifyAutoSignature(UID, ID, await sign(pair, ID))).toBe(false);
	});

	it('is false when the record has no valid key tag', async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		const signature = await sign(pair, ID);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		try {
			store.docs.set(`${TRUSTED_PHONES_COLLECTION}/${UID}`, { ...stored()!, keyTag: 'f'.repeat(64) });
			expect(await verifyAutoSignature(UID, ID, signature)).toBe(false);

			const { keyTag: _removed, ...untagged } = stored()!;
			store.docs.set(`${TRUSTED_PHONES_COLLECTION}/${UID}`, untagged);
			expect(await verifyAutoSignature(UID, ID, signature)).toBe(false);

			// The planted record is worth a warning, but the account's uid stays out of it.
			expect(warn).toHaveBeenCalled();
			expect(JSON.stringify(warn.mock.calls)).not.toContain(UID);
		} finally {
			warn.mockRestore();
		}
	});

	it("is false when someone swaps in another key's coordinates but keeps the old tag", async () => {
		const enrolled = await phoneKey();
		const planted = await phoneKey();
		await enrollTrustedPhone(UID, { x: enrolled.jwk.x, y: enrolled.jwk.y }, 'Chrome on Android', T0);

		store.docs.set(`${TRUSTED_PHONES_COLLECTION}/${UID}`, { ...stored()!, x: planted.jwk.x, y: planted.jwk.y });
		expect(await verifyAutoSignature(UID, ID, await sign(planted.pair, ID))).toBe(false);
		expect(await verifyAutoSignature(UID, ID, await sign(enrolled.pair, ID))).toBe(false);
	});

	it('is false when a stored coordinate is malformed, even under a matching tag', async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		const signature = await sign(pair, ID);
		const record = stored()!;

		// A padded copy of the real coordinate still names the same point, and its
		// tag is valid for the padded text, so only the shape check refuses it.
		for (const bad of [
			{ x: `${jwk.x}=`, y: jwk.y },
			{ x: jwk.x, y: `${jwk.y}=` },
			{ x: jwk.x.slice(0, 42), y: jwk.y }
		]) {
			const keyTag = await hmacHex('trusted-phone', `${UID}${NUL}${bad.x}${NUL}${bad.y}`);
			store.docs.set(`${TRUSTED_PHONES_COLLECTION}/${UID}`, { ...record, ...bad, keyTag });
			expect(await verifyAutoSignature(UID, ID, signature)).toBe(false);
		}
	});

	it('is false for a signature from a key that was never enrolled', async () => {
		const enrolled = await phoneKey();
		const stranger = await phoneKey();
		await enrollTrustedPhone(UID, { x: enrolled.jwk.x, y: enrolled.jwk.y }, 'Chrome on Android', T0);
		expect(await verifyAutoSignature(UID, ID, await sign(stranger.pair, ID))).toBe(false);
	});

	it('is false for a signature that is not 86 base64url characters', async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		const signature = await sign(pair, ID);
		expect(signature).toHaveLength(86);
		expect(await verifyAutoSignature(UID, ID, signature.slice(0, 85))).toBe(false);
		expect(await verifyAutoSignature(UID, ID, `${signature}A`)).toBe(false);
		expect(await verifyAutoSignature(UID, ID, `${signature.slice(0, 85)}!`)).toBe(false);
		expect(await verifyAutoSignature(UID, ID, '')).toBe(false);
	});

	it('is false after the phone is removed', async () => {
		const { pair, jwk } = await phoneKey();
		await enrollTrustedPhone(UID, { x: jwk.x, y: jwk.y }, 'Chrome on Android', T0);
		const signature = await sign(pair, ID);
		expect(await verifyAutoSignature(UID, ID, signature)).toBe(true);

		await removeTrustedPhone(UID);
		expect(stored()).toBeUndefined();
		expect(await verifyAutoSignature(UID, ID, signature)).toBe(false);
	});
});

describe('removeTrustedPhone', () => {
	it('is fine when there is no record to remove', async () => {
		await expect(removeTrustedPhone(UID)).resolves.toBeUndefined();
	});
});
