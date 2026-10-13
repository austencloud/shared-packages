// The phone's answer from a sign-in notification's own buttons, run where the
// app handles notification clicks (its service worker) with no page on screen.
// Approve is the automatic approval the approve page makes: this phone's key
// signs the request id, and the server checks the key, a fresh Google ID
// token and that the phone is on the computer's network. Deny is the tap
// flow's denial. Whatever cannot finish here (another network, no key, a
// signed-out phone, any failure) opens the approve page, which explains it
// and offers Approve and Deny as always.
// Spec: Ringmaster docs/superpowers/specs/2026-10-13-phone-push-sign-in-design.md
import type { PhoneSignInClient } from './phone-sign-in';
import type { TrustedPhoneKey } from './trusted-phone-key';

/** What a notification button led to. */
export type NotificationOutcome =
	// Finished in the notification.
	| 'approved'
	| 'denied'
	| 'expired'
	| 'already-decided'
	// Finished on the approve page.
	| 'different-network'
	| 'not-trusted'
	| 'no-key'
	| 'signed-out'
	| 'error';

export interface NotificationApproverOptions {
	client: Pick<PhoneSignInClient, 'autoApproveRequest' | 'decideApprovalRequest'>;
	keys: Pick<TrustedPhoneKey, 'loadTrustedKey' | 'signAutoApproval' | 'forgetTrustedKey'>;
	/** The account signed in on this phone, or null when none is. */
	currentUid: () => Promise<string | null>;
}

export interface NotificationApprover {
	approve(requestId: string): Promise<NotificationOutcome>;
	deny(requestId: string): Promise<NotificationOutcome>;
}

/** True when the outcome needs the approve page: the tap flow, or an explanation. */
export function opensApprovePage(outcome: NotificationOutcome): boolean {
	return !(outcome === 'approved' || outcome === 'denied' || outcome === 'expired' || outcome === 'already-decided');
}

export function createNotificationApprover({ client, keys, currentUid }: NotificationApproverOptions): NotificationApprover {
	async function uidOrNull(): Promise<string | null> {
		try {
			return await currentUid();
		} catch {
			return null;
		}
	}

	async function approve(requestId: string): Promise<NotificationOutcome> {
		const uid = await uidOrNull();
		if (!uid) return 'signed-out';

		let pair: CryptoKeyPair | null;
		try {
			pair = await keys.loadTrustedKey(uid);
		} catch {
			pair = null;
		}
		if (!pair) return 'no-key';

		let signature: string;
		try {
			signature = await keys.signAutoApproval(pair, requestId);
		} catch {
			// A key that cannot sign never will, so it goes, as on the approve page.
			await keys.forgetTrustedKey().catch(() => {});
			return 'not-trusted';
		}

		let answer: Awaited<ReturnType<typeof client.autoApproveRequest>>;
		try {
			answer = await client.autoApproveRequest(requestId, signature);
		} catch {
			// Network or server trouble says nothing about the key, so it stays.
			return 'error';
		}
		// The server no longer knows this key: another phone was trusted, or automatic approval was stopped.
		if (answer === 'not-trusted') await keys.forgetTrustedKey().catch(() => {});
		return answer;
	}

	async function deny(requestId: string): Promise<NotificationOutcome> {
		if (!(await uidOrNull())) return 'signed-out';
		try {
			const result = await client.decideApprovalRequest(requestId, 'deny');
			// A denial never asks to confirm the network; an answer like that is a server this phone does not understand.
			return result === 'confirm-network' || result === 'approved' ? 'error' : result;
		} catch {
			return 'error';
		}
	}

	return { approve, deny };
}
