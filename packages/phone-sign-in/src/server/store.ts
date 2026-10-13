// The four Firestore operations phone sign-in needs, supplied by each app over
// its own Firestore client. Times go in and come out as Date.

export interface StoredDocument {
	data: Record<string, unknown>;
	/** Firestore's opaque updateTime, for conditional writes. */
	revision: string;
	/**
	 * Firestore's createTime, as RFC 3339 text. Firestore sets it when the
	 * document is first written and no client can change it, unlike any field
	 * the document stores, so request expiry is counted from it.
	 */
	createTime: string;
}

export interface PhoneSignInStore {
	/** The document's fields, or null when it does not exist. */
	get(collection: string, id: string): Promise<Record<string, unknown> | null>;
	/** The document with its revision and createTime, or null when it does not exist. */
	getWithRevision(collection: string, id: string): Promise<StoredDocument | null>;
	/** Creates or replaces the whole document. */
	set(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
	/**
	 * Updates only the given fields while the document is still at `revision`.
	 * False when the revision changed (Firestore's FAILED_PRECONDITION or
	 * ABORTED); throws on any other failure. Never retried: a lost response
	 * followed by a retry would report a conflict for a write that landed.
	 */
	updateIfCurrent(collection: string, id: string, data: Record<string, unknown>, revision: string): Promise<boolean>;
	/** Deletes the document. Deleting one that is not there is fine. */
	delete(collection: string, id: string): Promise<void>;
}
