import { describe, expect, it } from 'vitest';
import { logMessage } from './log-message';

describe('logMessage', () => {
	it('replaces every copy of the uid and keeps the rest', () => {
		const e = new Error('Firestore GET /trusted_phones/austen-uid failed (503): austen-uid unavailable');
		expect(logMessage(e, 'austen-uid')).toBe(
			'Firestore GET /trusted_phones/[uid] failed (503): [uid] unavailable'
		);
	});

	it('reads a value that is not an Error as text', () => {
		expect(logMessage('trusted_phones/austen-uid', 'austen-uid')).toBe('trusted_phones/[uid]');
		expect(logMessage(undefined, 'austen-uid')).toBe('undefined');
	});

	it('leaves the message alone when there is no uid to remove', () => {
		expect(logMessage(new Error('firestore is down'), '')).toBe('firestore is down');
	});
});
