// The tap rules for the phone's approve page, kept apart from Svelte so they
// can be tested without a screen.
//
// A request from the same network as the phone is approved with one tap. A
// request from a different network, or one the server says must be confirmed,
// takes two: the first tap only turns Approve into "Approve anyway", and the
// second sends the decision with the confirmation flag. A second tap that
// lands within CONFIRM_GRACE_MS of the first is a double tap, not a decision.
// Deny is always one tap and never carries the flag. Nothing is sent while an
// answer is already on its way or once the request has an outcome.
//
// Every function takes the current state and returns what should happen next.
// None of them keeps state, sends anything or reads a clock.

/** A second tap this soon after Approve turns into "Approve anyway" is a double tap. */
export const CONFIRM_GRACE_MS = 700;

export interface GateState {
	/** The server compared the networks when it loaded the request and they matched. */
	sameNetwork: boolean;
	/** The server asked for the confirmation, whatever the load said about the network. */
	serverWantsConfirm: boolean;
	/** The Approve button reads "Approve anyway". */
	confirming: boolean;
	/** The earliest time a tap on "Approve anyway" counts. */
	confirmReadyAt: number;
}

export interface GateContext {
	/** The clock, in milliseconds, when the tap happened. */
	now: number;
	/** A decision is on its way to the server. */
	sending: boolean;
	/** There is nothing left to answer: no request, or it already has an outcome. */
	finished: boolean;
}

/** What a tap does: nothing, arm the confirmation, or send a decision. */
export type Tap =
	| { kind: 'none' }
	| { kind: 'arm'; gate: GateState }
	| { kind: 'send'; decision: 'approve' | 'deny'; confirm: boolean };

/** The state for a request that was just loaded. */
export function newGate(sameNetwork: boolean): GateState {
	return { sameNetwork, serverWantsConfirm: false, confirming: false, confirmReadyAt: 0 };
}

/** True when an approval needs the second tap, which is also when the warning shows. */
export function needsConfirmation(gate: GateState): boolean {
	return !gate.sameNetwork || gate.serverWantsConfirm;
}

/** The state after Approve turns into "Approve anyway". */
function armed(gate: GateState, now: number): GateState {
	return { ...gate, confirming: true, confirmReadyAt: now + CONFIRM_GRACE_MS };
}

/** The server answered 409: it wants the confirmation even if the page thought the networks matched. */
export function serverAskedToConfirm(gate: GateState, now: number): GateState {
	return armed({ ...gate, serverWantsConfirm: true }, now);
}

/**
 * The automatic approval found a different network before Austen tapped
 * anything. The warning shows and Approve takes the usual two taps.
 */
export function serverFoundOtherNetwork(gate: GateState): GateState {
	return { ...gate, serverWantsConfirm: true, confirming: false, confirmReadyAt: 0 };
}

export function tapApprove(gate: GateState, context: GateContext): Tap {
	if (context.sending || context.finished) return { kind: 'none' };
	if (needsConfirmation(gate) && !gate.confirming) return { kind: 'arm', gate: armed(gate, context.now) };
	if (gate.confirming && context.now < gate.confirmReadyAt) return { kind: 'none' };
	return { kind: 'send', decision: 'approve', confirm: gate.confirming };
}

export function tapDeny(context: GateContext): Tap {
	if (context.sending || context.finished) return { kind: 'none' };
	return { kind: 'send', decision: 'deny', confirm: false };
}
