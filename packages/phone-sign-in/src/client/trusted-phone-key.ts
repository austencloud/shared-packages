// This phone's key for approving sign-ins by itself. The private key is made
// non-extractable, so code on this page can sign with it but nothing can read
// it out, and it lives in this browser's IndexedDB next to the uid it was made
// for. The server keeps only the public half (server/trusted-phones.ts).
// Spec: Ringmaster docs/superpowers/specs/2026-10-08-phone-auto-approve-design.md
import { autoApprovalMessage } from '../shared/auto-message';
import type { PublicKeyJwk } from '../types';

export interface StoredKey {
	uid: string;
	keyPair: CryptoKeyPair;
}

/** Where the key lives: IndexedDB in the browser, an in-memory stand-in in tests. */
export interface KeyStore {
	get(): Promise<StoredKey | null>;
	put(value: StoredKey): Promise<void>;
	delete(): Promise<void>;
}

export interface TrustedPhoneKeyOptions {
	/** The app's own IndexedDB database, such as 'ringmaster-trusted-phone'. Fixed per app. */
	dbName: string;
	/** What the signature is over; the server's autoPurpose. */
	purpose: string;
}

export interface TrustedPhoneKey {
	/** This app's IndexedDB store, the default for the calls below. */
	keyStore: KeyStore;
	/** This phone's key for `uid`, or null when it has none, has one for another account, or storage fails. */
	loadTrustedKey(uid: string, store?: KeyStore): Promise<CryptoKeyPair | null>;
	/** Makes and saves a new key for `uid`, replacing any earlier one, and returns the public half to register. */
	createTrustedKey(uid: string, store?: KeyStore): Promise<PublicKeyJwk>;
	/** Forgets this phone's key. Nothing stored is the same as nothing to forget. */
	forgetTrustedKey(store?: KeyStore): Promise<void>;
	/** This phone's signature over one request id, as base64url. */
	signAutoApproval(keyPair: CryptoKeyPair, requestId: string): Promise<string>;
}

const STORE_NAME = 'keys';
const RECORD = 'device';

/** False where the browser lacks IndexedDB or Web Crypto; the page then never offers to trust the phone. */
export function trustedPhoneSupported(): boolean {
	return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/** One record in the app's own IndexedDB database. */
export function indexedDbKeyStore(dbName: string): KeyStore {
	function openDb(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const open = indexedDB.open(dbName, 1);
			open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME);
			open.onsuccess = () => resolve(open.result);
			open.onerror = () => reject(open.error);
		});
	}

	async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
		const db = await openDb();
		try {
			return await new Promise<T>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, mode);
				const request = act(tx.objectStore(STORE_NAME));
				// Wait for the transaction, not the request, so a write has been saved before this resolves.
				tx.oncomplete = () => resolve(request.result);
				tx.onerror = () => reject(tx.error);
				tx.onabort = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	}

	return {
		async get() {
			return ((await run('readonly', (s) => s.get(RECORD))) as StoredKey | undefined) ?? null;
		},
		async put(value) {
			await run('readwrite', (s) => s.put(value, RECORD));
		},
		async delete() {
			await run('readwrite', (s) => s.delete(RECORD));
		}
	};
}

export function createTrustedPhoneKey({ dbName, purpose }: TrustedPhoneKeyOptions): TrustedPhoneKey {
	const keyStore = indexedDbKeyStore(dbName);

	async function loadTrustedKey(uid: string, store: KeyStore = keyStore): Promise<CryptoKeyPair | null> {
		try {
			const stored = await store.get();
			return stored && stored.uid === uid ? stored.keyPair : null;
		} catch {
			return null;
		}
	}

	async function createTrustedKey(uid: string, store: KeyStore = keyStore): Promise<PublicKeyJwk> {
		const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
		// The public half of a pair can always be exported, even when the pair is non-extractable.
		const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
		if (!jwk.x || !jwk.y) throw new Error('This browser made a key without coordinates');
		await store.put({ uid, keyPair });
		return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
	}

	async function forgetTrustedKey(store: KeyStore = keyStore): Promise<void> {
		try {
			await store.delete();
		} catch {
			// Storage that cannot be opened holds no key anyone can use.
		}
	}

	async function signAutoApproval(keyPair: CryptoKeyPair, requestId: string): Promise<string> {
		const signature = new Uint8Array(
			await crypto.subtle.sign(
				{ name: 'ECDSA', hash: 'SHA-256' },
				keyPair.privateKey,
				// The Uint8Array generics in lib.dom do not line up with BufferSource here.
				autoApprovalMessage(purpose, requestId) as BufferSource
			)
		);
		return btoa(String.fromCharCode(...signature))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	}

	return { keyStore, loadTrustedKey, createTrustedKey, forgetTrustedKey, signAutoApproval };
}
