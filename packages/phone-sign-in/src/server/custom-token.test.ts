import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
	createCustomTokenMinter,
	createServiceAccountSigner,
	CUSTOM_TOKEN_LIFETIME_SECONDS,
	IDENTITY_TOOLKIT_AUDIENCE
} from './custom-token';

const CLIENT_EMAIL = 'signer@test-project.iam.gserviceaccount.com';
let publicKey: CryptoKey;
let privateKeyPem: string;

function toPem(der: ArrayBuffer): string {
	const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
	const lines = b64.match(/.{1,64}/g) ?? [];
	return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

function decodePart(part: string): Record<string, unknown> {
	const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
	return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
}

function decodeBytes(part: string): Uint8Array {
	const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifies(token: string): Promise<boolean> {
	const [header, payload, signature] = token.split('.');
	return crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		publicKey,
		decodeBytes(signature) as BufferSource,
		new TextEncoder().encode(`${header}.${payload}`)
	);
}

beforeAll(async () => {
	const pair = (await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['sign', 'verify']
	)) as CryptoKeyPair;
	publicKey = pair.publicKey;
	privateKeyPem = toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
});

const signer = () => createServiceAccountSigner({ clientEmail: CLIENT_EMAIL, privateKey: privateKeyPem });

describe('createCustomTokenMinter', () => {
	it('signs a Firebase custom token for the uid with the service account key', async () => {
		const now = Date.UTC(2026, 9, 7, 20, 0, 0);
		const token = await createCustomTokenMinter(signer())('austen-uid', now);
		const [header, payload] = token.split('.');

		expect(decodePart(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
		const iat = Math.floor(now / 1000);
		expect(decodePart(payload)).toEqual({
			iss: CLIENT_EMAIL,
			sub: CLIENT_EMAIL,
			aud: IDENTITY_TOOLKIT_AUDIENCE,
			iat,
			exp: iat + CUSTOM_TOKEN_LIFETIME_SECONDS,
			uid: 'austen-uid'
		});
		expect(await verifies(token)).toBe(true);
	});

	it('hands the claims to the app\'s own signer', async () => {
		const signJwt = vi.fn(async () => 'signed');
		const now = Date.UTC(2026, 9, 7, 20, 0, 0);
		expect(await createCustomTokenMinter(signJwt)('austen-uid', now)).toBe('signed');
		expect(signJwt).toHaveBeenCalledWith({
			aud: IDENTITY_TOOLKIT_AUDIENCE,
			iat: now / 1000,
			exp: now / 1000 + CUSTOM_TOKEN_LIFETIME_SECONDS,
			uid: 'austen-uid'
		});
	});

	it('lives half a minute, so "That wasn\'t me" waits only about a minute before its last sign-out', () => {
		expect(CUSTOM_TOKEN_LIFETIME_SECONDS).toBe(30);
	});

	it('takes its iat from the clock reading it is given, rounded down to the second', async () => {
		const now = Date.UTC(2026, 9, 7, 20, 0, 0) + 999;
		const claims = decodePart((await createCustomTokenMinter(signer())('austen-uid', now)).split('.')[1]);
		expect(claims.iat).toBe(Math.floor(now / 1000));
		expect(claims.exp).toBe(Math.floor(now / 1000) + CUSTOM_TOKEN_LIFETIME_SECONDS);
	});

	it('refuses an empty or overlong uid', async () => {
		const mint = createCustomTokenMinter(signer());
		await expect(mint('')).rejects.toThrow();
		await expect(mint('x'.repeat(129))).rejects.toThrow();
	});
});

describe('createServiceAccountSigner', () => {
	it('sets iss and sub to the service account email, whatever the caller supplies', async () => {
		const token = await signer()({
			iss: 'attacker@example.com',
			sub: 'attacker@example.com',
			aud: IDENTITY_TOOLKIT_AUDIENCE,
			uid: 'austen-uid'
		});
		expect(decodePart(token.split('.')[1])).toEqual({
			iss: CLIENT_EMAIL,
			sub: CLIENT_EMAIL,
			aud: IDENTITY_TOOLKIT_AUDIENCE,
			uid: 'austen-uid'
		});
		expect(await verifies(token)).toBe(true);
	});

	it('reads a key whose line breaks arrive escaped, as environment variables often carry them', async () => {
		const escaped = createServiceAccountSigner({
			clientEmail: CLIENT_EMAIL,
			privateKey: () => privateKeyPem.replace(/\n/g, '\\n')
		});
		expect(await verifies(await escaped({ aud: IDENTITY_TOOLKIT_AUDIENCE, uid: 'austen-uid' }))).toBe(true);
	});

	it('refuses every audience but Firebase custom tokens, so it cannot sign for an arbitrary service', async () => {
		const sign = signer();
		const refused: unknown[] = [
			'https://oauth2.googleapis.com/token',
			'https://example.test/',
			'https://identitytoolkit.googleapis.com/',
			`${IDENTITY_TOOLKIT_AUDIENCE} `,
			IDENTITY_TOOLKIT_AUDIENCE.toUpperCase(),
			'',
			undefined,
			null,
			[IDENTITY_TOOLKIT_AUDIENCE],
			{ toString: () => IDENTITY_TOOLKIT_AUDIENCE }
		];
		for (const aud of refused) {
			await expect(sign({ aud, uid: 'austen-uid' })).rejects.toThrow('does not sign for this audience');
		}
		await expect(sign({ uid: 'austen-uid' })).rejects.toThrow('does not sign for this audience');
	});
});
