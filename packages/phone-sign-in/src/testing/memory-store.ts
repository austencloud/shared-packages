// An in-memory PhoneSignInStore for tests, with Firestore's revision and
// createTime behaviour: every write moves the revision, a conditional write
// fails once the revision moved, and createTime is fixed by the first write.
import type { PhoneSignInStore, StoredDocument } from '../server/store';

export interface MemoryStore extends PhoneSignInStore {
	/** Every document, keyed `${collection}/${id}`. Tests may read and change it. */
	docs: Map<string, StoredDocument>;
}

export function createMemoryStore(): MemoryStore {
	const docs = new Map<string, StoredDocument>();
	let counter = 0;
	const nextRevision = () => `rev-${++counter}`;
	const key = (collection: string, id: string) => `${collection}/${id}`;

	return {
		docs,
		async get(collection, id) {
			const doc = docs.get(key(collection, id));
			return doc ? structuredClone(doc.data) : null;
		},
		async getWithRevision(collection, id) {
			const doc = docs.get(key(collection, id));
			return doc ? { data: structuredClone(doc.data), revision: doc.revision, createTime: doc.createTime } : null;
		},
		async set(collection, id, data) {
			const k = key(collection, id);
			// Firestore stamps createTime with its own clock; a request's createdAt is
			// that clock reading in tests, so a test's `now` carries through.
			const clock = data.createdAt instanceof Date ? data.createdAt : new Date();
			docs.set(k, {
				data: structuredClone(data),
				revision: nextRevision(),
				createTime: docs.get(k)?.createTime ?? clock.toISOString()
			});
		},
		async updateIfCurrent(collection, id, data, revision) {
			const doc = docs.get(key(collection, id));
			if (!doc || doc.revision !== revision) return false;
			doc.data = { ...doc.data, ...structuredClone(data) };
			doc.revision = nextRevision();
			return true;
		},
		async delete(collection, id) {
			docs.delete(key(collection, id));
		}
	};
}
