// The bytes a trusted phone signs to approve one sign-in request by itself.
// The phone (client/trusted-phone-key.ts) and the server
// (server/trusted-phones.ts) both build them here, so they can never
// disagree. The purpose prefix keeps the signature from meaning anything
// anywhere else; each app passes its own (Ringmaster uses
// 'ringmaster-phone-sign-in-auto').

export function autoApprovalMessage(purpose: string, requestId: string): Uint8Array {
	return new TextEncoder().encode(`${purpose}\u0000${requestId}`);
}
