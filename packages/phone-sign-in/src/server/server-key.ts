// Keys only this server can compute with. A browser holding an admin token
// may be able to write Firestore, and an ID token can be stolen, so a stored
// field alone never proves that this server accepted a request. The approval
// tag (requests.ts), the network hash and a trusted phone record's `keyTag`
// (trusted-phones.ts) are HMACs under keys derived here, and a client that
// cannot sign cannot forge any of them.
//
// Each purpose gets its own HMAC-SHA256 key: HKDF-SHA256 over the server's
// secret material (the service account private key PEM), with the app's salt
// and the purpose as `info`. Only the derived keys are cached, per isolate,
// and callers get a MAC, never a key.

export type KeyPurpose = 'approval' | 'network' | 'trusted-phone';

export interface ServerKeys {
	/** The lowercase hex HMAC-SHA256 of `message` under the server key for `purpose`. */
	hmacHex(purpose: KeyPurpose, message: string): Promise<string>;
}

export interface ServerKeyOptions {
	/**
	 * The bytes the keys come from: the service account private key as PEM text.
	 * Return null only on the Firestore emulator with no credentials, where a
	 * fixed emulator-only key is used instead. Throw when there are no
	 * credentials and no emulator; the failure is not remembered.
	 */
	secret: () => Uint8Array | null;
	/** Fixed per app. Changing it invalidates every stored tag and trusted phone. */
	salt: string;
}

const encoder = new TextEncoder();

export function createServerKeys({ secret, salt }: ServerKeyOptions): ServerKeys {
	// For the Firestore emulator only (see `secret`), so local runs and tests
	// work without a key. Production has the service account, so this is never used there.
	const emulatorOnlyMaterial = encoder.encode(`${salt} emulator-only key material; never used with real credentials`);
	const keys = new Map<KeyPurpose, Promise<CryptoKey>>();

	async function deriveKey(purpose: KeyPurpose): Promise<CryptoKey> {
		const material = secret() ?? emulatorOnlyMaterial;
		const base = await crypto.subtle.importKey('raw', material as BufferSource, 'HKDF', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits(
			{ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(salt), info: encoder.encode(purpose) },
			base,
			256
		);
		return crypto.subtle.importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	}

	function keyFor(purpose: KeyPurpose): Promise<CryptoKey> {
		let key = keys.get(purpose);
		if (!key) {
			// deriveKey is async, so a throwing `secret` rejects instead of throwing here.
			key = deriveKey(purpose);
			keys.set(purpose, key);
			// A failure (no credentials, no emulator) is not remembered, so a later call can succeed.
			key.catch(() => {
				if (keys.get(purpose) === key) keys.delete(purpose);
			});
		}
		return key;
	}

	return {
		async hmacHex(purpose, message) {
			const mac = await crypto.subtle.sign('HMAC', await keyFor(purpose), encoder.encode(message));
			return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
		}
	};
}

/** Compares two strings without stopping at the first difference, so timing says nothing about where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
