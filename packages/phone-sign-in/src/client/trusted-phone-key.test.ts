import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoApprovalMessage as messageFor } from '../shared/auto-message';
import { createTrustedPhoneKey, trustedPhoneSupported, type KeyStore, type StoredKey } from './trusted-phone-key';

// Ported from Ringmaster with its values.
const DB_NAME = 'ringmaster-trusted-phone';
const PURPOSE = 'ringmaster-phone-sign-in-auto';
const autoApprovalMessage = (id: string) => messageFor(PURPOSE, id);
const {
	keyStore: indexedDbKeyStore,
	loadTrustedKey,
	createTrustedKey,
	forgetTrustedKey,
	signAutoApproval
} = createTrustedPhoneKey({ dbName: DB_NAME, purpose: PURPOSE });

const ID = 'abcdefghij0123456789';
const OTHER_ID = 'zyxwvutsrq9876543210';

function memoryStore(): KeyStore & { value: StoredKey | null } {
	return {
		value: null,
		async get() {
			return this.value;
		},
		async put(v) {
			this.value = v;
		},
		async delete() {
			this.value = null;
		}
	};
}

function fromBase64Url(text: string): Uint8Array {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createTrustedKey', () => {
	it('returns the public half as a P-256 key and stores the pair for that account', async () => {
		const store = memoryStore();
		const jwk = await createTrustedKey('austen-uid', store);

		expect(jwk).toEqual({ kty: 'EC', crv: 'P-256', x: expect.stringMatching(/^[\w-]{43}$/), y: expect.stringMatching(/^[\w-]{43}$/) });
		expect(Object.keys(jwk).sort()).toEqual(['crv', 'kty', 'x', 'y']);
		expect(store.value?.uid).toBe('austen-uid');
	});

	it('makes a private key nothing can read out', async () => {
		const store = memoryStore();
		await createTrustedKey('austen-uid', store);
		const { privateKey } = store.value!.keyPair;

		expect(privateKey.extractable).toBe(false);
		await expect(crypto.subtle.exportKey('jwk', privateKey)).rejects.toThrow();
		await expect(crypto.subtle.exportKey('pkcs8', privateKey)).rejects.toThrow();
	});

	it('replaces an earlier key', async () => {
		const store = memoryStore();
		const first = await createTrustedKey('austen-uid', store);
		const second = await createTrustedKey('austen-uid', store);

		expect(second.x).not.toBe(first.x);
		const exported = await crypto.subtle.exportKey('jwk', store.value!.keyPair.publicKey);
		expect(exported.x).toBe(second.x);
	});

	it('stores nothing when the browser cannot keep it, so the page does not trust a key it lost', async () => {
		const store = memoryStore();
		store.put = async () => {
			throw new Error('quota');
		};
		await expect(createTrustedKey('austen-uid', store)).rejects.toThrow('quota');
		expect(store.value).toBeNull();
	});
});

describe('loadTrustedKey', () => {
	it('returns the pair made for that account', async () => {
		const store = memoryStore();
		await createTrustedKey('austen-uid', store);
		await expect(loadTrustedKey('austen-uid', store)).resolves.toBe(store.value!.keyPair);
	});

	it('returns null for another account, for an empty store and when storage fails', async () => {
		const store = memoryStore();
		await expect(loadTrustedKey('austen-uid', store)).resolves.toBeNull();

		await createTrustedKey('austen-uid', store);
		await expect(loadTrustedKey('someone-else', store)).resolves.toBeNull();

		store.get = async () => {
			throw new Error('storage is blocked');
		};
		await expect(loadTrustedKey('austen-uid', store)).resolves.toBeNull();
	});
});

describe('signAutoApproval', () => {
	it('gives a raw 64 byte signature as 86 base64url characters that only this request id verifies', async () => {
		const store = memoryStore();
		await createTrustedKey('austen-uid', store);
		const pair = store.value!.keyPair;

		const signature = await signAutoApproval(pair, ID);
		expect(signature).toMatch(/^[A-Za-z0-9_-]{86}$/);

		const bytes = fromBase64Url(signature) as BufferSource;
		const check = (id: string) =>
			crypto.subtle.verify(
				{ name: 'ECDSA', hash: 'SHA-256' },
				pair.publicKey,
				bytes,
				autoApprovalMessage(id) as BufferSource
			);
		await expect(check(ID)).resolves.toBe(true);
		await expect(check(OTHER_ID)).resolves.toBe(false);
	});

	it('does not verify under another phone key', async () => {
		const mine = memoryStore();
		const theirs = memoryStore();
		await createTrustedKey('austen-uid', mine);
		await createTrustedKey('austen-uid', theirs);

		const signature = fromBase64Url(await signAutoApproval(mine.value!.keyPair, ID)) as BufferSource;
		await expect(
			crypto.subtle.verify(
				{ name: 'ECDSA', hash: 'SHA-256' },
				theirs.value!.keyPair.publicKey,
				signature,
				autoApprovalMessage(ID) as BufferSource
			)
		).resolves.toBe(false);
	});
});

describe('forgetTrustedKey', () => {
	it('empties the store', async () => {
		const store = memoryStore();
		await createTrustedKey('austen-uid', store);
		await forgetTrustedKey(store);
		expect(store.value).toBeNull();
	});

	it('swallows a store that cannot be opened', async () => {
		const store = memoryStore();
		store.delete = async () => {
			throw new Error('storage is blocked');
		};
		await expect(forgetTrustedKey(store)).resolves.toBeUndefined();
	});
});

describe('trustedPhoneSupported', () => {
	it('is false where IndexedDB is missing', () => {
		vi.stubGlobal('indexedDB', undefined);
		expect(trustedPhoneSupported()).toBe(false);
	});

	it('is false where Web Crypto is missing', () => {
		vi.stubGlobal('indexedDB', {});
		vi.stubGlobal('crypto', {});
		expect(trustedPhoneSupported()).toBe(false);
	});

	it('is true where both exist', () => {
		vi.stubGlobal('indexedDB', {});
		expect(trustedPhoneSupported()).toBe(true);
	});
});

// A small stand-in for the parts of IndexedDB the store touches. It answers
// asynchronously and fires oncomplete after the request settles, like the real
// one, so the store's wiring (open, upgrade, transaction, close) gets exercised.
function fakeIndexedDb(options: { abort?: boolean } = {}) {
	const records = new Map<string, unknown>();
	const seen = { opened: 0, closed: 0, stores: [] as string[] };

	const db = {
		close: () => {
			seen.closed += 1;
		},
		createObjectStore: (name: string) => {
			seen.stores.push(name);
		},
		transaction: (_name: string, _mode: string) => {
			const tx: Record<string, unknown> = { error: null };
			const settle = (request: { result?: unknown }, work: () => void) => {
				setTimeout(() => {
					if (options.abort) {
						tx.error = new Error('aborted');
						(tx.onabort as (() => void) | undefined)?.();
						return;
					}
					work();
					(tx.oncomplete as (() => void) | undefined)?.();
				}, 0);
				return request;
			};
			tx.objectStore = () => ({
				get: (key: string) => {
					const request: { result?: unknown } = {};
					return settle(request, () => {
						request.result = records.get(key);
					});
				},
				put: (value: unknown, key: string) => {
					const request: { result?: unknown } = {};
					return settle(request, () => {
						records.set(key, value);
						request.result = key;
					});
				},
				delete: (key: string) => {
					const request: { result?: unknown } = {};
					return settle(request, () => {
						records.delete(key);
					});
				}
			});
			return tx;
		}
	};

	let created = false;
	const factory = {
		open: () => {
			seen.opened += 1;
			const request: Record<string, unknown> = { result: db, error: null };
			setTimeout(() => {
				if (!created) {
					created = true;
					(request.onupgradeneeded as (() => void) | undefined)?.();
				}
				(request.onsuccess as (() => void) | undefined)?.();
			}, 0);
			return request;
		}
	};
	return { factory, records, seen };
}

describe('indexedDbKeyStore', () => {
	it('keeps one record, reads it back and deletes it, closing the database each time', async () => {
		const idb = fakeIndexedDb();
		vi.stubGlobal('indexedDB', idb.factory);
		const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
			'sign',
			'verify'
		])) as CryptoKeyPair;

		await expect(indexedDbKeyStore.get()).resolves.toBeNull();
		await indexedDbKeyStore.put({ uid: 'austen-uid', keyPair: pair });
		await expect(indexedDbKeyStore.get()).resolves.toEqual({ uid: 'austen-uid', keyPair: pair });
		expect(idb.records.size).toBe(1);

		await indexedDbKeyStore.delete();
		await expect(indexedDbKeyStore.get()).resolves.toBeNull();
		expect(idb.records.size).toBe(0);

		expect(idb.seen.stores).toEqual(['keys']);
		expect(idb.seen.closed).toBe(idb.seen.opened);
	});

	it('rejects when the transaction aborts, and still closes the database', async () => {
		const idb = fakeIndexedDb({ abort: true });
		vi.stubGlobal('indexedDB', idb.factory);

		await expect(indexedDbKeyStore.get()).rejects.toThrow('aborted');
		expect(idb.seen.closed).toBe(1);
	});

	it('reads as no key where IndexedDB is missing, so the page falls back to tapping', async () => {
		vi.stubGlobal('indexedDB', undefined);
		await expect(loadTrustedKey('austen-uid')).resolves.toBeNull();
		await expect(forgetTrustedKey()).resolves.toBeUndefined();
	});
});

describe('createTrustedPhoneKey', () => {
	it('keeps the key in the app database, so two apps on one phone never share a key', async () => {
		const idb = fakeIndexedDb();
		const open = vi.spyOn(idb.factory, 'open');
		vi.stubGlobal('indexedDB', idb.factory);

		await createTrustedPhoneKey({ dbName: 'flow-arts-trusted-phone', purpose: PURPOSE }).keyStore.get();
		expect(open).toHaveBeenCalledWith('flow-arts-trusted-phone', 1);
	});

	it('signs over its own purpose', async () => {
		const other = createTrustedPhoneKey({ dbName: DB_NAME, purpose: 'flow-arts-phone-sign-in-auto' });
		const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
			'sign',
			'verify'
		])) as CryptoKeyPair;
		const signature = fromBase64Url(await other.signAutoApproval(pair, ID)) as BufferSource;
		const verifiesFor = (purpose: string) =>
			crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, signature, messageFor(purpose, ID) as BufferSource);
		await expect(verifiesFor('flow-arts-phone-sign-in-auto')).resolves.toBe(true);
		await expect(verifiesFor(PURPOSE)).resolves.toBe(false);
	});
});
