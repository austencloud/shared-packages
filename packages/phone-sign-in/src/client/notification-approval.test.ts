import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoAnswer, DecisionResult } from '../types';
import { createNotificationApprover, opensApprovePage } from './notification-approval';

// The notification's Approve and Deny buttons. Each test feeds back what the
// key store, the session and the server could answer and reads where that
// leaves Austen: done in the notification, or on the approve page.
const KEY = { publicKey: {}, privateKey: {} } as CryptoKeyPair;
const ID = 'AbCdEfGhIjKlMnOpQr12';

const autoApproveRequest = vi.fn<(id: string, signature: string) => Promise<AutoAnswer>>();
const decideApprovalRequest = vi.fn<(id: string, decision: 'approve' | 'deny') => Promise<DecisionResult>>();
const loadTrustedKey = vi.fn<(uid: string) => Promise<CryptoKeyPair | null>>();
const signAutoApproval = vi.fn<(pair: CryptoKeyPair, id: string) => Promise<string>>();
const forgetTrustedKey = vi.fn<() => Promise<void>>();
const currentUid = vi.fn<() => Promise<string | null>>();

const { approve, deny } = createNotificationApprover({
	client: { autoApproveRequest, decideApprovalRequest },
	keys: { loadTrustedKey, signAutoApproval, forgetTrustedKey },
	currentUid
});

beforeEach(() => {
	autoApproveRequest.mockReset().mockResolvedValue('approved');
	decideApprovalRequest.mockReset().mockResolvedValue('denied');
	loadTrustedKey.mockReset().mockResolvedValue(KEY);
	signAutoApproval.mockReset().mockResolvedValue('signature');
	forgetTrustedKey.mockReset().mockResolvedValue();
	currentUid.mockReset().mockResolvedValue('austen-uid');
});

describe('approve', () => {
	it("signs this request with the signed-in account's key and approves it", async () => {
		await expect(approve(ID)).resolves.toBe('approved');
		expect(loadTrustedKey).toHaveBeenCalledWith('austen-uid');
		expect(signAutoApproval).toHaveBeenCalledWith(KEY, ID);
		expect(autoApproveRequest).toHaveBeenCalledWith(ID, 'signature');
		expect(forgetTrustedKey).not.toHaveBeenCalled();
	});

	it.each(['expired', 'already-decided', 'different-network'] as const)('passes on %s and keeps the key', async (answer) => {
		autoApproveRequest.mockResolvedValue(answer);
		await expect(approve(ID)).resolves.toBe(answer);
		expect(forgetTrustedKey).not.toHaveBeenCalled();
	});

	it('forgets the key when the server no longer trusts it', async () => {
		autoApproveRequest.mockResolvedValue('not-trusted');
		await expect(approve(ID)).resolves.toBe('not-trusted');
		expect(forgetTrustedKey).toHaveBeenCalledOnce();
	});

	it('forgets a key that cannot sign, without asking the server', async () => {
		signAutoApproval.mockRejectedValue(new Error('bad key'));
		await expect(approve(ID)).resolves.toBe('not-trusted');
		expect(forgetTrustedKey).toHaveBeenCalledOnce();
		expect(autoApproveRequest).not.toHaveBeenCalled();
	});

	it('keeps the key through network or server trouble', async () => {
		autoApproveRequest.mockRejectedValue(new Error('Could not reach Ringmaster.'));
		await expect(approve(ID)).resolves.toBe('error');
		expect(forgetTrustedKey).not.toHaveBeenCalled();
	});

	it('sends nothing from a phone with no key for this account', async () => {
		loadTrustedKey.mockResolvedValue(null);
		await expect(approve(ID)).resolves.toBe('no-key');
		expect(autoApproveRequest).not.toHaveBeenCalled();
	});

	it('treats a key store that fails as no key', async () => {
		loadTrustedKey.mockRejectedValue(new Error('IndexedDB closed'));
		await expect(approve(ID)).resolves.toBe('no-key');
		expect(autoApproveRequest).not.toHaveBeenCalled();
	});

	it.each([
		['no account', async () => null],
		['a session that cannot be read', async () => Promise.reject(new Error('auth failed'))]
	])('sends nothing with %s signed in', async (_label, uid) => {
		currentUid.mockImplementation(uid);
		await expect(approve(ID)).resolves.toBe('signed-out');
		expect(loadTrustedKey).not.toHaveBeenCalled();
		expect(autoApproveRequest).not.toHaveBeenCalled();
	});
});

describe('deny', () => {
	it('denies the request', async () => {
		await expect(deny(ID)).resolves.toBe('denied');
		expect(decideApprovalRequest).toHaveBeenCalledWith(ID, 'deny');
	});

	it.each(['expired', 'already-decided'] as const)('passes on %s', async (answer) => {
		decideApprovalRequest.mockResolvedValue(answer);
		await expect(deny(ID)).resolves.toBe(answer);
	});

	it.each(['confirm-network', 'approved'] as const)('reads a denial answered with %s as an error', async (answer) => {
		decideApprovalRequest.mockResolvedValue(answer);
		await expect(deny(ID)).resolves.toBe('error');
	});

	it('reads a failure as an error', async () => {
		decideApprovalRequest.mockRejectedValue(new Error('Your sign-in is too old.'));
		await expect(deny(ID)).resolves.toBe('error');
	});

	it('sends nothing when no account is signed in', async () => {
		currentUid.mockResolvedValue(null);
		await expect(deny(ID)).resolves.toBe('signed-out');
		expect(decideApprovalRequest).not.toHaveBeenCalled();
	});
});

describe('opensApprovePage', () => {
	it('finishes the four final answers in the notification and sends the rest to the page', () => {
		const finished = ['approved', 'denied', 'expired', 'already-decided'] as const;
		const toPage = ['different-network', 'not-trusted', 'no-key', 'signed-out', 'error'] as const;
		for (const outcome of finished) expect(opensApprovePage(outcome)).toBe(false);
		for (const outcome of toPage) expect(opensApprovePage(outcome)).toBe(true);
	});
});
