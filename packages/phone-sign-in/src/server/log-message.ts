// A Firestore failure names the document it was reading, and trusted_phones
// documents are keyed by uid. SvelteKit logs an unhandled error whole, so the
// phone sign-in routes catch what the store throws and log this instead.

/** An error's message for the log, without the account's uid (Firestore paths carry it). */
export function logMessage(e: unknown, uid: string): string {
	const message = e instanceof Error ? e.message : String(e);
	return uid === '' ? message : message.split(uid).join('[uid]');
}
