// When the phone's approve page approves by itself, what each answer leads to,
// and the words for the done screen. Kept apart from Svelte so the rules can be
// tested without a screen. Nothing here sends anything or reads a clock.
// Spec: Ringmaster docs/superpowers/specs/2026-10-08-phone-auto-approve-design.md
import type { ApprovalRequest, AutoAnswer, NotMeAnswer } from '../types';

export interface AutoContext {
	request: ApprovalRequest;
	/** The page's own clock says the request ran out. */
	expired: boolean;
	/** This phone holds a key for the signed-in account. */
	hasKey: boolean;
	/** document.visibilityState is 'visible'. */
	visible: boolean;
	/** document.prerendering is true. */
	prerendering: boolean;
	/** The page already tried once for this request. */
	tried: boolean;
}

/** Once per request, only for a live pending request on the same network, and only while Austen can see the page. */
export function shouldTryAuto(c: AutoContext): boolean {
	return (
		!c.tried &&
		c.hasKey &&
		c.visible &&
		!c.prerendering &&
		!c.expired &&
		c.request.status === 'pending' &&
		c.request.sameNetwork
	);
}

export type AfterAuto =
	| { show: 'done' }
	| { show: 'outcome'; outcome: 'expired' | 'already-decided' }
	| { show: 'request'; forgetKey: boolean; warnNetwork: boolean };

/** 'error' stands for any failure to get an answer. */
export function afterAutoAnswer(answer: AutoAnswer | 'error'): AfterAuto {
	switch (answer) {
		case 'approved':
			return { show: 'done' };
		case 'expired':
		case 'already-decided':
			return { show: 'outcome', outcome: answer };
		case 'not-trusted':
			// The server no longer knows this key: another phone was trusted, or automatic approval was stopped.
			return { show: 'request', forgetKey: true, warnNetwork: false };
		case 'different-network':
			// The server saw a different network than the page was told, so the warning and two-tap Approve apply.
			return { show: 'request', forgetKey: false, warnNetwork: true };
		default:
			return { show: 'request', forgetKey: false, warnNetwork: false };
	}
}

/** The green notice at the top of the done screen. */
export function autoApprovedText(deviceLabel: string): string {
	return `Signed in ${deviceLabel}. This phone approved it by itself because it is trusted and on the same internet connection.`;
}

export interface NotMeNotice {
	/** 'good' when every session is signing out and automatic approval is off, 'warn' when part of it failed. */
	tone: 'good' | 'warn';
	text: string;
}

/**
 * What "That wasn't me" managed, in words. `blocked` means the computer never
 * collected a sign-in, so it never got in; the copy says so only then. The
 * partial results say what Austen has to do next: the consoles when signing
 * everyone out failed, or the Stop control when the app (`appName`) still holds
 * this phone's record. The key on this phone is forgotten on the confirming
 * tap, so only the app's record can be left behind, and the copy says that.
 */
export function notMeNotice({ signedOut, autoOff, blocked }: NotMeAnswer, appName: string): NotMeNotice {
	if (signedOut && autoOff) {
		return {
			tone: 'good',
			text: blocked
				? 'The computer never got in. Automatic approval is off and every session is signing out.'
				: 'Done. Every session is signing out, and automatic approval is off. A computer that already signed in can keep working for up to an hour.'
		};
	}
	const front = blocked ? 'The computer never got in. ' : '';
	if (signedOut) {
		return {
			tone: 'warn',
			text: `${front}Every session is signing out. This phone no longer approves by itself, but ${appName} still has its record. Tap Stop approving automatically to remove it.`
		};
	}
	const lead = autoOff
		? "Automatic approval is off, but signing everyone out didn't go through."
		: `Signing everyone out didn't go through, and ${appName} still has this phone's record.`;
	return {
		tone: 'warn',
		text: `${front}${lead} Turn phone sign-in off in Cloudflare and sign out in the Firebase console.`
	};
}
