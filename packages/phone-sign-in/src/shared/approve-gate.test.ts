import { describe, expect, it } from 'vitest';
import {
	CONFIRM_GRACE_MS,
	needsConfirmation,
	newGate,
	serverAskedToConfirm,
	serverFoundOtherNetwork,
	tapApprove,
	tapDeny,
	type GateContext,
	type GateState,
	type Tap
} from './approve-gate';

const T0 = 1_000_000;
const idle = (now = T0): GateContext => ({ now, sending: false, finished: false });

/** Applies a tap the way the page does: an arm replaces the state, anything else leaves it alone. */
function apply(gate: GateState, tap: Tap): GateState {
	return tap.kind === 'arm' ? tap.gate : gate;
}

/** A different-network request after the first tap at T0. */
function armedOnce(): GateState {
	const gate = newGate(false);
	return apply(gate, tapApprove(gate, idle(T0)));
}

describe('the grace period', () => {
	it('is 700 ms', () => {
		expect(CONFIRM_GRACE_MS).toBe(700);
	});
});

describe('approving from the same network', () => {
	it('sends the approval on the first tap, without the confirmation flag', () => {
		const gate = newGate(true);
		expect(needsConfirmation(gate)).toBe(false);
		expect(tapApprove(gate, idle())).toEqual({ kind: 'send', decision: 'approve', confirm: false });
	});

	it('stays that way on later taps, such as a retry after a failed send', () => {
		expect(tapApprove(newGate(true), idle(T0 + 5000))).toEqual({
			kind: 'send',
			decision: 'approve',
			confirm: false
		});
	});
});

describe('approving from a different network', () => {
	it('arms on the first tap and sends nothing', () => {
		const gate = newGate(false);
		expect(needsConfirmation(gate)).toBe(true);
		expect(tapApprove(gate, idle())).toEqual({
			kind: 'arm',
			gate: { sameNetwork: false, serverWantsConfirm: false, confirming: true, confirmReadyAt: T0 + 700 }
		});
	});

	it('ignores a second tap within 700 ms', () => {
		const gate = armedOnce();
		expect(tapApprove(gate, idle(T0))).toEqual({ kind: 'none' });
		expect(tapApprove(gate, idle(T0 + 1))).toEqual({ kind: 'none' });
		expect(tapApprove(gate, idle(T0 + 699))).toEqual({ kind: 'none' });
	});

	it('does not restart the wait when a too-early tap is ignored', () => {
		const gate = armedOnce();
		expect(tapApprove(gate, idle(T0 + 300))).toEqual({ kind: 'none' });
		expect(tapApprove(gate, idle(T0 + 700))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
	});

	it('sends the approval with the confirmation flag on a second tap after 700 ms', () => {
		const gate = armedOnce();
		expect(tapApprove(gate, idle(T0 + 701))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
		expect(tapApprove(gate, idle(T0 + 60_000))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
	});

	it('needs no new arming to retry after a send fails', () => {
		// A send does not change the gate, so a retry is another confirmed approval.
		const gate = armedOnce();
		expect(tapApprove(gate, idle(T0 + 2000))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
		expect(tapApprove(gate, idle(T0 + 4000))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
	});
});

describe('the server asking for the confirmation', () => {
	it('arms a request that loaded as the same network', () => {
		const next = serverAskedToConfirm(newGate(true), T0);
		expect(next).toEqual({ sameNetwork: true, serverWantsConfirm: true, confirming: true, confirmReadyAt: T0 + 700 });
		expect(needsConfirmation(next)).toBe(true);
	});

	it('then ignores a tap within 700 ms and confirms after it', () => {
		const next = serverAskedToConfirm(newGate(true), T0);
		expect(tapApprove(next, idle(T0 + 100))).toEqual({ kind: 'none' });
		expect(tapApprove(next, idle(T0 + 701))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
	});

	it('restarts the wait for a request that was already armed', () => {
		const again = serverAskedToConfirm(armedOnce(), T0 + 900);
		expect(again.confirmReadyAt).toBe(T0 + 900 + 700);
		expect(tapApprove(again, idle(T0 + 1000))).toEqual({ kind: 'none' });
		expect(tapApprove(again, idle(T0 + 1600))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
	});

	it('does not change the state it was given', () => {
		const gate = newGate(true);
		serverAskedToConfirm(gate, T0);
		expect(gate).toEqual(newGate(true));
	});
});

describe('when the automatic approval finds a different network', () => {
	it('shows the warning and still takes two taps', () => {
		const next = serverFoundOtherNetwork(newGate(true));
		expect(needsConfirmation(next)).toBe(true);
		expect(next.confirming).toBe(false);
		const first = tapApprove(next, idle(T0));
		expect(first.kind).toBe('arm');
		const armedGate = apply(next, first);
		expect(tapApprove(armedGate, idle(T0 + 100))).toEqual({ kind: 'none' });
		expect(tapApprove(armedGate, idle(T0 + 701))).toEqual({ kind: 'send', decision: 'approve', confirm: true });
	});

	it('clears an armed confirmation instead of keeping it', () => {
		const next = serverFoundOtherNetwork(armedOnce());
		expect(next.confirming).toBe(false);
		expect(tapApprove(next, idle(T0 + 5000)).kind).toBe('arm');
	});
});

describe('denying', () => {
	it('sends a denial on the first tap and never carries the confirmation flag', () => {
		for (let at = 0; at < 3000; at += 250) {
			expect(tapDeny(idle(T0 + at))).toEqual({ kind: 'send', decision: 'deny', confirm: false });
		}
	});
});

describe('while an answer is on its way, or after an outcome', () => {
	const busy: Array<[string, GateContext]> = [
		['sending', { now: T0 + 5000, sending: true, finished: false }],
		['finished', { now: T0 + 5000, sending: false, finished: true }],
		['sending and finished', { now: T0 + 5000, sending: true, finished: true }]
	];
	const gates: Array<[string, GateState]> = [
		['same network', newGate(true)],
		['different network', newGate(false)],
		['armed', armedOnce()],
		['server asked', serverAskedToConfirm(newGate(true), T0)]
	];

	it.each(busy)('does nothing on Approve while %s', (_name, context) => {
		for (const [, gate] of gates) expect(tapApprove(gate, context)).toEqual({ kind: 'none' });
	});

	it.each(busy)('does nothing on Deny while %s', (_name, context) => {
		expect(tapDeny(context)).toEqual({ kind: 'none' });
	});
});
