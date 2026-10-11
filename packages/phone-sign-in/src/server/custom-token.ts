// Firebase custom tokens for phone sign-in. The computer trades one for a
// session with signInWithCustomToken, and Firebase checks the signature
// against the service account's public keys.

export const IDENTITY_TOOLKIT_AUDIENCE =
	'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

/**
 * Firebase accepts up to an hour. The computer signs in within a second or two
 * of collecting the token, so half a minute is plenty. A custom token can be
 * traded for a new session until it expires, and each new session has a later
 * auth_time than the revocation's validSince, so "That wasn't me" cannot sign
 * it out. A short life bounds how long that route must wait before its last
 * sign-out (see the not-me handler).
 */
export const CUSTOM_TOKEN_LIFETIME_SECONDS = 30;

/**
 * Signs JWT claims with the service account key, setting `iss` and `sub` to the
 * service account email. An app passes its own allowlisted signer or one from
 * createServiceAccountSigner.
 */
export type SignJwt = (claims: Record<string, unknown>) => Promise<string>;

/** Mints a custom token for `uid`; `now` is the caller's clock reading in ms. */
export type MintCustomToken = (uid: string, now?: number) => Promise<string>;

/**
 * `now` is the caller's clock reading, in ms. collectRequest passes the one it
 * stores as `usedAt`, so a token's exp is never later than the collection time
 * plus the lifetime (rounded down to the second), which is what the not-me
 * handler counts on.
 */
export function createCustomTokenMinter(signJwt: SignJwt): MintCustomToken {
	return async (uid, now = Date.now()) => {
		if (!uid || uid.length > 128) {
			throw new Error('A custom token needs a uid of 1 to 128 characters');
		}
		const iat = Math.floor(now / 1000);
		return signJwt({
			aud: IDENTITY_TOOLKIT_AUDIENCE,
			iat,
			exp: iat + CUSTOM_TOKEN_LIFETIME_SECONDS,
			uid
		});
	};
}

function base64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const encoder = new TextEncoder();

export interface ServiceAccount {
	clientEmail: string;
	/** The PKCS #8 private key as PEM text. */
	privateKey: string | (() => string);
}

/**
 * An RS256 signer over the service account key for apps that have none of
 * their own. It signs only Firebase custom tokens (the Identity Toolkit
 * audience), so it can never become a general purpose signer for the service
 * account, and it always sets `iss` and `sub` itself.
 */
export function createServiceAccountSigner(account: ServiceAccount | (() => ServiceAccount)): SignJwt {
	let imported: { pem: string; key: Promise<CryptoKey> } | null = null;

	function keyFor(pem: string): Promise<CryptoKey> {
		if (imported?.pem === pem) return imported.key;
		const body = pem
			.split('\n')
			.filter((line) => !line.startsWith('-----'))
			.join('')
			.trim();
		const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
		const key = crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
			'sign'
		]);
		imported = { pem, key };
		// A key that fails to import is not remembered.
		key.catch(() => {
			if (imported?.key === key) imported = null;
		});
		return key;
	}

	return async (claims) => {
		if (claims.aud !== IDENTITY_TOOLKIT_AUDIENCE) {
			throw new Error('The service account key does not sign for this audience');
		}
		const { clientEmail, privateKey } = typeof account === 'function' ? account() : account;
		const pem = (typeof privateKey === 'function' ? privateKey() : privateKey).replace(/\\n/g, '\n');
		const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
		const payload = base64Url(encoder.encode(JSON.stringify({ ...claims, iss: clientEmail, sub: clientEmail })));
		const signingInput = `${header}.${payload}`;
		const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await keyFor(pem), encoder.encode(signingInput));
		return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
	};
}
