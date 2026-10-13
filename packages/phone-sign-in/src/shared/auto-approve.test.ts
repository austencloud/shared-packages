import { describe, expect, it } from 'vitest';
import type { ApprovalRequest, ApprovalStatus, AutoAnswer, NotMeAnswer } from '../types';
import { afterAutoAnswer, autoApprovedText, notMeNotice, shouldTryAuto, type AutoContext } from './auto-approve';

const request: ApprovalRequest = {
	status: 'pending',
	code: '482173',
	device: { label: "Claude's browser on Windows", place: 'Chicago, US', site: '' },
	sameNetwork: true,
	createdAt: '2026-10-08T18:00:00.000Z',
	expiresAt: '2026-10-08T18:03:00.000Z',
	ageMs: 20_000,
	expiresInMs: 160_000
};

const ready: AutoContext = {
	request,
	expired: false,
	hasKey: true,
	visible: true,
	prerendering: false,
	tried: false
};

describe('shouldTryAuto', () => {
	it('is true for a live pending request on the same network, with a key, on a visible page, not yet tried', () => {
		expect(shouldTryAuto(ready)).toBe(true);
	});

	it.each<[string, Partial<AutoContext>]>([
		['no key on this phone', { hasKey: false }],
		['the page is hidden', { visible: false }],
		['the page is being prerendered', { prerendering: true }],
		["the page's own clock says it ran out", { expired: true }],
		['it already tried for this request', { tried: true }],
		['the server saw a different network', { request: { ...request, sameNetwork: false } }]
	])('is false when %s', (_why, change) => {
		expect(shouldTryAuto({ ...ready, ...change })).toBe(false);
	});

	it.each<ApprovalStatus>(['approved', 'denied', 'used', 'expired'])('is false for a %s request', (status) => {
		expect(shouldTryAuto({ ...ready, request: { ...request, status } })).toBe(false);
	});
});

describe('afterAutoAnswer', () => {
	it('shows the done screen once approved', () => {
		expect(afterAutoAnswer('approved')).toEqual({ show: 'done' });
	});

	it.each<AutoAnswer>(['expired', 'already-decided'])('shows the %s outcome', (answer) => {
		expect(afterAutoAnswer(answer)).toEqual({ show: 'outcome', outcome: answer });
	});

	it('forgets the key and shows the tap flow when the server no longer knows this phone', () => {
		expect(afterAutoAnswer('not-trusted')).toEqual({ show: 'request', forgetKey: true, warnNetwork: false });
	});

	it('keeps the key and shows the tap flow with its warning on a different network', () => {
		expect(afterAutoAnswer('different-network')).toEqual({ show: 'request', forgetKey: false, warnNetwork: true });
	});

	it('keeps the key and shows the plain tap flow when no answer came', () => {
		expect(afterAutoAnswer('error')).toEqual({ show: 'request', forgetKey: false, warnNetwork: false });
	});
});

describe('autoApprovedText', () => {
	it('names the browser that signed in', () => {
		expect(autoApprovedText("Claude's browser on Windows")).toBe(
			"Signed in Claude's browser on Windows. This phone approved it by itself because it is trusted and on the same internet connection."
		);
	});
});

describe('notMeNotice', () => {
	const SIGN_IN_CONSOLES = 'Turn phone sign-in off in Cloudflare and sign out in the Firebase console.';
	const NEVER_GOT_IN = 'The computer never got in.';

	it('says the computer never got in when the request was blocked and everything worked', () => {
		expect(notMeNotice({ signedOut: true, autoOff: true, blocked: true }, 'Ringmaster')).toEqual({
			tone: 'good',
			text: 'The computer never got in. Automatic approval is off and every session is signing out.'
		});
	});

	it('warns that a signed-in computer can keep working when it was not blocked', () => {
		expect(notMeNotice({ signedOut: true, autoOff: true, blocked: false }, 'Ringmaster')).toEqual({
			tone: 'good',
			text: 'Done. Every session is signing out, and automatic approval is off. A computer that already signed in can keep working for up to an hour.'
		});
	});

	it('sends Austen to the consoles when signing everyone out failed', () => {
		expect(notMeNotice({ signedOut: false, autoOff: true, blocked: false }, 'Ringmaster')).toEqual({
			tone: 'warn',
			text: `Automatic approval is off, but signing everyone out didn't go through. ${SIGN_IN_CONSOLES}`
		});
	});

	it("says Ringmaster still has this phone's record when neither step worked", () => {
		expect(notMeNotice({ signedOut: false, autoOff: false, blocked: false }, 'Ringmaster')).toEqual({
			tone: 'warn',
			text: `Signing everyone out didn't go through, and Ringmaster still has this phone's record. ${SIGN_IN_CONSOLES}`
		});
	});

	it("points at Stop approving automatically when the sign-out worked but Ringmaster still has the phone's record", () => {
		expect(notMeNotice({ signedOut: true, autoOff: false, blocked: false }, 'Ringmaster')).toEqual({
			tone: 'warn',
			text: 'Every session is signing out. This phone no longer approves by itself, but Ringmaster still has its record. Tap Stop approving automatically to remove it.'
		});
	});

	it.each<[string, NotMeAnswer, string]>([
		[
			'the sign-out failed',
			{ signedOut: false, autoOff: true, blocked: true },
			`${NEVER_GOT_IN} Automatic approval is off, but signing everyone out didn't go through. ${SIGN_IN_CONSOLES}`
		],
		[
			'neither step worked',
			{ signedOut: false, autoOff: false, blocked: true },
			`${NEVER_GOT_IN} Signing everyone out didn't go through, and Ringmaster still has this phone's record. ${SIGN_IN_CONSOLES}`
		],
		[
			"Ringmaster still has the phone's record",
			{ signedOut: true, autoOff: false, blocked: true },
			`${NEVER_GOT_IN} Every session is signing out. This phone no longer approves by itself, but Ringmaster still has its record. Tap Stop approving automatically to remove it.`
		]
	])('puts "The computer never got in." in front of a partial result when %s', (_why, answer, text) => {
		expect(notMeNotice(answer, 'Ringmaster')).toEqual({ tone: 'warn', text });
	});

	it('names the app it is given', () => {
		expect(notMeNotice({ signedOut: true, autoOff: false, blocked: false }, 'Flow Arts Composer').text).toBe(
			'Every session is signing out. This phone no longer approves by itself, but Flow Arts Composer still has its record. Tap Stop approving automatically to remove it.'
		);
	});
});
