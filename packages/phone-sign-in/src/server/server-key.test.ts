import { createHmac, hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { constantTimeEqual, createServerKeys } from './server-key';

const SALT = 'ringmaster-phone-sign-in';
// Only the bytes matter to the derivation, so these stand in for the PEM text.
const KEY_A = 'service account key material A, line one\nline two\n';
const KEY_B = 'service account key material B, line one\nline two\n';
const MESSAGE = 'request\u0000uid\u0000createTime\u0000secretHash';

const bytes = (text: string) => new TextEncoder().encode(text);

/** HKDF-SHA256 then HMAC-SHA256 with node:crypto, for checking the derivation independently. */
function expected(privateKey: string, purpose: string, message: string, salt = SALT): string {
	const key = hkdfSync('sha256', Buffer.from(privateKey), salt, purpose, 32);
	return createHmac('sha256', Buffer.from(key)).update(message).digest('hex');
}

/** A new set of keys stands for a new Workers isolate. */
const keysFor = (privateKey: string | null, salt = SALT) =>
	createServerKeys({ secret: () => (privateKey === null ? null : bytes(privateKey)), salt });

describe('hmacHex with the service account key', () => {
	it('is HMAC-SHA256 under an HKDF-SHA256 key from the secret, the salt and the purpose', async () => {
		const { hmacHex } = keysFor(KEY_A);
		expect(await hmacHex('approval', MESSAGE)).toBe(expected(KEY_A, 'approval', MESSAGE));
		expect(await hmacHex('network', MESSAGE)).toBe(expected(KEY_A, 'network', MESSAGE));
		expect(await hmacHex('trusted-phone', MESSAGE)).toBe(expected(KEY_A, 'trusted-phone', MESSAGE));
	});

	it('gives the same answer in a new isolate with the same credentials', async () => {
		const first = await keysFor(KEY_A).hmacHex('approval', MESSAGE);
		const second = await keysFor(KEY_A).hmacHex('approval', MESSAGE);
		expect(second).toBe(first);
		expect(first).toMatch(/^[0-9a-f]{64}$/);
	});

	it('keeps the purposes apart, so a network hash can never pass as an approval tag', async () => {
		const { hmacHex } = keysFor(KEY_A);
		expect(await hmacHex('approval', MESSAGE)).not.toBe(await hmacHex('network', MESSAGE));
	});

	it('keeps the trusted-phone purpose apart from the approval and network purposes', async () => {
		const { hmacHex } = keysFor(KEY_A);
		const trusted = await hmacHex('trusted-phone', MESSAGE);
		expect(trusted).not.toBe(await hmacHex('approval', MESSAGE));
		expect(trusted).not.toBe(await hmacHex('network', MESSAGE));
	});

	it('changes with the private key, so another deployment cannot forge this one', async () => {
		const underA = await keysFor(KEY_A).hmacHex('approval', MESSAGE);
		const underB = await keysFor(KEY_B).hmacHex('approval', MESSAGE);
		expect(underB).not.toBe(underA);
	});

	it("changes with the salt, so two apps sharing a service account never accept each other's tags", async () => {
		const ringmaster = await keysFor(KEY_A).hmacHex('approval', MESSAGE);
		const other = await keysFor(KEY_A, 'flow-arts-phone-sign-in').hmacHex('approval', MESSAGE);
		expect(other).toBe(expected(KEY_A, 'approval', MESSAGE, 'flow-arts-phone-sign-in'));
		expect(other).not.toBe(ringmaster);
	});

	it('changes with the message', async () => {
		const { hmacHex } = keysFor(KEY_A);
		expect(await hmacHex('approval', MESSAGE)).not.toBe(await hmacHex('approval', MESSAGE + 'x'));
	});

	it('reads the secret once per purpose and keeps only the derived key', async () => {
		let reads = 0;
		const { hmacHex } = createServerKeys({
			secret: () => {
				reads++;
				return bytes(KEY_A);
			},
			salt: SALT
		});
		await hmacHex('approval', MESSAGE);
		await hmacHex('approval', MESSAGE + 'x');
		await hmacHex('network', MESSAGE);
		expect(reads).toBe(2);
	});
});

describe('hmacHex in emulator mode', () => {
	it('uses a fixed key when the secret is null, the same in every isolate', async () => {
		const first = await keysFor(null).hmacHex('approval', MESSAGE);
		const second = await keysFor(null).hmacHex('approval', MESSAGE);
		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(second).toBe(first);
	});

	it('keeps the purposes apart there too, and differs from a real key', async () => {
		const emulator = keysFor(null);
		const approval = await emulator.hmacHex('approval', MESSAGE);
		expect(approval).not.toBe(await emulator.hmacHex('network', MESSAGE));
		expect(await keysFor(KEY_A).hmacHex('approval', MESSAGE)).not.toBe(approval);
	});
});

describe('hmacHex with no key at all', () => {
	it('rejects when the secret throws', async () => {
		const { hmacHex } = createServerKeys({
			secret: () => {
				throw new Error('Missing Firebase credentials');
			},
			salt: SALT
		});
		await expect(hmacHex('approval', MESSAGE)).rejects.toThrow('Missing Firebase credentials');
		await expect(hmacHex('network', MESSAGE)).rejects.toThrow('Missing Firebase credentials');
	});

	it('does not remember a failure, so a later call with credentials works', async () => {
		let configured = false;
		const { hmacHex } = createServerKeys({
			secret: () => {
				if (!configured) throw new Error('Missing Firebase credentials');
				return bytes(KEY_A);
			},
			salt: SALT
		});
		await expect(hmacHex('approval', MESSAGE)).rejects.toThrow();
		configured = true;
		expect(await hmacHex('approval', MESSAGE)).toBe(expected(KEY_A, 'approval', MESSAGE));
	});
});

describe('constantTimeEqual', () => {
	it('is true for equal strings', () => {
		expect(constantTimeEqual('abc', 'abc')).toBe(true);
		expect(constantTimeEqual('', '')).toBe(true);
	});

	it('is false when one character differs', () => {
		expect(constantTimeEqual('abc', 'abd')).toBe(false);
		expect(constantTimeEqual('xbc', 'abc')).toBe(false);
	});

	it('is false when the lengths differ', () => {
		expect(constantTimeEqual('abc', 'abcd')).toBe(false);
		expect(constantTimeEqual('abcd', 'abc')).toBe(false);
	});
});
