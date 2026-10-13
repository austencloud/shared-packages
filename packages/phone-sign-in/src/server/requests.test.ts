import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for Firestore. Like the real thing it stamps a
// createTime when a document is first written and never changes it afterwards.
// The injected clock reaches it through the createdAt field createRequest
// writes from `now`, and a test can still overwrite any stored field (even
// createdAt or expiresAt) without moving createTime, as a planted document
// would.
const store = vi.hoisted(() => {
	const docs = new Map<string, { data: Record<string, unknown>; revision: string; createTime: string }>();
	let counter = 0;
	const nextRevision = () => `rev-${++counter}`;
	// Stands in for the service account key the server keys are derived from.
	const keyMaterial = new TextEncoder().encode('test service account private key');
	return { docs, nextRevision, keyMaterial };
});

// The store the request lifecycle runs on, as each app supplies it.
const rest = {
	firestoreSet: vi.fn(async (collection: string, id: string, data: Record<string, unknown>) => {
		const key = `${collection}/${id}`;
		const clock = data.createdAt instanceof Date ? data.createdAt : new Date(0);
		store.docs.set(key, {
			data: structuredClone(data),
			revision: store.nextRevision(),
			createTime: store.docs.get(key)?.createTime ?? clock.toISOString()
		});
	}),
	firestoreGetWithRevision: vi.fn(async (collection: string, id: string) => {
		const doc = store.docs.get(`${collection}/${id}`);
		return doc ? { data: structuredClone(doc.data), revision: doc.revision, createTime: doc.createTime } : null;
	}),
	firestoreUpdateIfCurrent: vi.fn(
		async (collection: string, id: string, data: Record<string, unknown>, revision: string) => {
			const doc = store.docs.get(`${collection}/${id}`);
			if (!doc || doc.revision !== revision) return false;
			doc.data = { ...doc.data, ...structuredClone(data) };
			doc.revision = store.nextRevision();
			return true;
		}
	)
};

import { createServerKeys } from './server-key';
import {
	REQUESTS_COLLECTION,
	PURGE_AFTER_MS,
	REQUEST_LIFETIME_MS,
	createRequestLifecycle,
	isRequestId,
	sameNetwork,
	type DecisionNetwork,
	type NetworkInfo
} from './requests';

const { hmacHex } = createServerKeys({ secret: () => store.keyMaterial, salt: 'ringmaster-phone-sign-in' });
const { collectRequest, createRequest, decideRequest, getRequestSummary, hashNetwork, networkInfo, reportNotMe } =
	createRequestLifecycle({
		store: {
			get: async () => {
				throw new Error('not used by the request lifecycle');
			},
			getWithRevision: (collection, id) => rest.firestoreGetWithRevision(collection, id),
			set: (collection, id, data) => rest.firestoreSet(collection, id, data),
			updateIfCurrent: (collection, id, data, revision) => rest.firestoreUpdateIfCurrent(collection, id, data, revision),
			delete: async () => {
				throw new Error('not used by the request lifecycle');
			}
		},
		keys: { hmacHex }
	});

const T0 = Date.UTC(2026, 9, 7, 20, 0, 0);
const DAY_MS = 24 * 60 * 60_000;
const DEVICE = { label: "Claude's browser on Windows", userAgent: 'UA', place: 'Chicago, IL, US', site: '' };
const AUSTEN = { uid: 'austen-uid', email: 'austencloud@gmail.com' };
const mint = vi.fn(async (uid: string, _now: number) => `token-for-${uid}`);
const NUL = String.fromCharCode(0);

async function sha256Hex(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

let HOME: string;
let ELSEWHERE: string;
let HOME_NET: NetworkInfo;
const UNKNOWN_NET: NetworkInfo = { hash: '', family: '' };
let HOME_ONLY: DecisionNetwork;
let CONFIRMED_ELSEWHERE: DecisionNetwork;
let UNCONFIRMED_ELSEWHERE: DecisionNetwork;
let AUTO_HOME: DecisionNetwork;
let AUTO_ELSEWHERE: DecisionNetwork;

beforeEach(async () => {
	store.docs.clear();
	mint.mockReset().mockImplementation(async (uid: string) => `token-for-${uid}`);
	HOME = await hashNetwork('203.0.113.9');
	ELSEWHERE = await hashNetwork('198.51.100.7');
	HOME_NET = { hash: HOME, family: 'ipv4' };
	HOME_ONLY = { approverNetwork: HOME, approverFamily: 'ipv4', confirmDifferentNetwork: false, method: 'tap' };
	CONFIRMED_ELSEWHERE = {
		approverNetwork: ELSEWHERE,
		approverFamily: 'ipv4',
		confirmDifferentNetwork: true,
		method: 'tap'
	};
	UNCONFIRMED_ELSEWHERE = {
		approverNetwork: ELSEWHERE,
		approverFamily: 'ipv4',
		confirmDifferentNetwork: false,
		method: 'tap'
	};
	AUTO_HOME = { approverNetwork: HOME, approverFamily: 'ipv4', confirmDifferentNetwork: false, method: 'auto' };
	AUTO_ELSEWHERE = {
		approverNetwork: ELSEWHERE,
		approverFamily: 'ipv4',
		confirmDifferentNetwork: false,
		method: 'auto'
	};
});

function stored(id: string) {
	return store.docs.get(`${REQUESTS_COLLECTION}/${id}`)!;
}

describe('hashNetwork', () => {
	it('is a keyed hash of the network scope: not the address, not the plain SHA-256 of the scope', async () => {
		const hash = await hashNetwork('203.0.113.9');
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(hash).not.toBe(await sha256Hex('203.0.113.9'));
		expect(hash).not.toBe(await sha256Hex('phone-sign-in-network\u0000203.0.113.9'));
		// The key is what makes it unguessable: the same scope under the other
		// purpose's key, which has the same derivation but different info, differs.
		expect(hash).toBe(await hmacHex('network', '203.0.113.9'));
		expect(hash).not.toBe(await hmacHex('approval', '203.0.113.9'));
	});

	it('treats two IPv6 addresses in one /64 as the same network and another /64 as different', async () => {
		const a = await hashNetwork('2001:db8:1234:5678:aaaa:bbbb:cccc:1111');
		expect(await hashNetwork('2001:db8:1234:5678::2222')).toBe(a);
		expect(await hashNetwork('2001:0DB8:1234:5678::3')).toBe(a);
		expect(await hashNetwork('2001:db8:1234:9999::1')).not.toBe(a);
	});

	it('tells different IPv4 networks apart, and reads a mapped IPv6 address as its IPv4 address', async () => {
		const home = await hashNetwork('203.0.113.9');
		expect(await hashNetwork('198.51.100.7')).not.toBe(home);
		expect(await hashNetwork('::ffff:203.0.113.9')).toBe(home);
		expect(await hashNetwork('::ffff:198.51.100.7')).not.toBe(home);
	});

	it('is empty when the address is unknown, empty or not a clear address', async () => {
		for (const ip of ['unknown', '', 'global', '[2001:db8::1]', 'fe80::1%eth0', '203.0.113.9|198.51.100.7', '999.1.1.1']) {
			expect(await hashNetwork(ip)).toBe('');
		}
	});

	it('is empty for a private, loopback or link-local address, so it never matches another one', async () => {
		for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.1.20', '10.1.2.3', 'fe80::1', 'fd12::1']) {
			expect(await hashNetwork(ip), ip).toBe('');
			expect(sameNetwork(await hashNetwork(ip), await hashNetwork(ip)), ip).toBe(false);
		}
	});
});

describe('networkInfo', () => {
	it('pairs the hash of an address with its family', async () => {
		expect(await networkInfo('203.0.113.9')).toEqual({ hash: await hashNetwork('203.0.113.9'), family: 'ipv4' });
		expect(await networkInfo('2001:db8:1234:5678::2')).toEqual({
			hash: await hashNetwork('2001:db8:1234:5678::2'),
			family: 'ipv6'
		});
	});

	it('is empty when the address is unknown', async () => {
		expect(await networkInfo('unknown')).toEqual({ hash: '', family: '' });
	});

	it('is empty for a loopback or private address, in both fields', async () => {
		for (const ip of ['127.0.0.1', '::1', '192.168.1.20', '::ffff:10.0.0.5']) {
			expect(await networkInfo(ip), ip).toEqual({ hash: '', family: '' });
		}
	});
});

describe('sameNetwork', () => {
	it('matches equal hashes only', async () => {
		expect(sameNetwork(HOME, HOME)).toBe(true);
		expect(sameNetwork(HOME, ELSEWHERE)).toBe(false);
	});

	it('is false when either side is empty', () => {
		expect(sameNetwork('', '')).toBe(false);
		expect(sameNetwork(HOME, '')).toBe(false);
		expect(sameNetwork('', HOME)).toBe(false);
	});
});

describe('createRequest', () => {
	it('stores a pending request with a hashed secret and returns the secret once', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);

		expect(isRequestId(created.id)).toBe(true);
		expect(created.code).toMatch(/^\d{6}$/);
		expect(created.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(created.expiresAt.getTime()).toBe(T0 + REQUEST_LIFETIME_MS);
		expect(created.expiresInMs).toBe(REQUEST_LIFETIME_MS);

		const data = stored(created.id).data;
		expect(data.status).toBe('pending');
		expect(data.code).toBe(created.code);
		expect(data.secretHash).toBe(await sha256Hex(created.secret));
		expect(JSON.stringify(data)).not.toContain(created.secret);
		expect(data.device).toEqual(DEVICE);
		expect(data.createdAt).toEqual(new Date(T0));
		expect(data.expiresAt).toEqual(new Date(T0 + REQUEST_LIFETIME_MS));
	});

	it('records which network asked, as a hash, and an empty network when it is unknown', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(stored(created.id).data.network).toBe(HOME);
		expect(JSON.stringify(stored(created.id).data)).not.toContain('203.0.113.9');

		const anonymous = await createRequest(DEVICE, UNKNOWN_NET, T0);
		expect(stored(anonymous.id).data.network).toBe('');
	});

	it('records the family of the asking network next to its hash', async () => {
		const v4 = await createRequest(DEVICE, HOME_NET, T0);
		expect(stored(v4.id).data.networkFamily).toBe('ipv4');

		const v6 = await createRequest(DEVICE, { hash: ELSEWHERE, family: 'ipv6' }, T0);
		expect(stored(v6.id).data.networkFamily).toBe('ipv6');

		const anonymous = await createRequest(DEVICE, UNKNOWN_NET, T0);
		expect(stored(anonymous.id).data.networkFamily).toBe('');
	});

	it('schedules the document for cleanup 30 days after it was created', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(PURGE_AFTER_MS).toBe(30 * DAY_MS);
		expect(stored(created.id).data.purgeAt).toEqual(new Date(T0 + 30 * DAY_MS));
	});

	it('keeps only the first 300 characters of the user agent', async () => {
		const created = await createRequest({ ...DEVICE, userAgent: 'x'.repeat(500) }, HOME_NET, T0);
		const device = stored(created.id).data.device as { userAgent: string };
		expect(device.userAgent).toHaveLength(300);
	});

	it('lasts three minutes', () => {
		expect(REQUEST_LIFETIME_MS).toBe(180_000);
	});
});

describe('isRequestId', () => {
	it('accepts 20 letters and digits only', () => {
		expect(isRequestId('AbCdEfGhIjKlMnOpQr12')).toBe(true);
		expect(isRequestId('short')).toBe(false);
		expect(isRequestId('AbCdEfGhIjKlMnOpQr1/')).toBe(false);
		expect(isRequestId(undefined)).toBe(false);
	});
});

describe('getRequestSummary', () => {
	it('reports a pending request, its device and the network it came from', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		const summary = await getRequestSummary(created.id, T0 + 1000);
		expect(summary).toMatchObject({ status: 'pending', code: created.code, device: DEVICE, network: HOME });
		expect(summary?.createdAt).toEqual(new Date(T0));
		expect(summary?.expiresAt).toEqual(new Date(T0 + REQUEST_LIFETIME_MS));
	});

	it('keeps the site that asked, and reads a request stored without one as the live site', async () => {
		const local = await createRequest({ ...DEVICE, site: 'a local copy (127.0.0.1:5231)' }, HOME_NET, T0);
		expect((await getRequestSummary(local.id, T0))?.device.site).toBe('a local copy (127.0.0.1:5231)');

		const older = await createRequest(DEVICE, HOME_NET, T0);
		delete (stored(older.id).data.device as Record<string, unknown>).site;
		expect((await getRequestSummary(older.id, T0))?.device.site).toBe('');
	});

	it('measures its age and time left by the server clock, from createTime', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		const summary = await getRequestSummary(created.id, T0 + 25_000);
		expect(summary?.ageMs).toBe(25_000);
		expect(summary?.expiresInMs).toBe(REQUEST_LIFETIME_MS - 25_000);

		const late = await getRequestSummary(created.id, T0 + REQUEST_LIFETIME_MS + 5000);
		expect(late?.ageMs).toBe(REQUEST_LIFETIME_MS + 5000);
		expect(late?.expiresInMs).toBe(0);
	});

	it('never reports a negative age when the server clock reads before createTime', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		const summary = await getRequestSummary(created.id, T0 - 1000);
		expect(summary?.ageMs).toBe(0);
		expect(summary?.expiresInMs).toBe(REQUEST_LIFETIME_MS + 1000);
	});

	it('reports expired once the lifetime passes', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect((await getRequestSummary(created.id, T0 + REQUEST_LIFETIME_MS))?.status).toBe('expired');
	});

	it('returns null for an unknown id', async () => {
		expect(await getRequestSummary('AbCdEfGhIjKlMnOpQr12', T0)).toBeNull();
	});

	it('reports an empty network for a document that stores none', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		delete stored(created.id).data.network;
		expect((await getRequestSummary(created.id, T0))?.network).toBe('');
	});
});

describe('expiry comes from the server-set createTime', () => {
	/** A document whose stored times were rewritten, as an admin client could with the default rule. */
	async function plantedRequest() {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		stored(created.id).data.expiresAt = new Date(T0 + 365 * DAY_MS);
		stored(created.id).data.createdAt = new Date(T0 + 364 * DAY_MS);
		return created;
	}

	it('reports expired three minutes after createTime however far off the stored expiresAt is', async () => {
		const created = await plantedRequest();
		const before = await getRequestSummary(created.id, T0 + REQUEST_LIFETIME_MS - 1);
		expect(before?.status).toBe('pending');
		expect(before?.expiresAt).toEqual(new Date(T0 + REQUEST_LIFETIME_MS));
		expect(before?.createdAt).toEqual(new Date(T0));

		const after = await getRequestSummary(created.id, T0 + REQUEST_LIFETIME_MS);
		expect(after?.status).toBe('expired');
		expect(after?.expiresAt).toEqual(new Date(T0 + REQUEST_LIFETIME_MS));
	});

	it('refuses to decide it once createTime plus three minutes has passed', async () => {
		const created = await plantedRequest();
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + REQUEST_LIFETIME_MS)).toBe(
			'expired'
		);
		expect(stored(created.id).data.status).toBe('pending');
	});

	it('refuses to collect it once createTime plus three minutes has passed', async () => {
		const created = await plantedRequest();
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(await collectRequest(created.id, created.secret, mint, T0 + REQUEST_LIFETIME_MS)).toEqual({
			status: 'expired'
		});
		expect(mint).not.toHaveBeenCalled();
	});

	it('does not move createTime when the document is updated', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 100_000);
		expect(stored(created.id).createTime).toBe(new Date(T0).toISOString());
		expect(await collectRequest(created.id, created.secret, mint, T0 + REQUEST_LIFETIME_MS)).toEqual({
			status: 'expired'
		});
	});

	it('treats an unreadable createTime as expired', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		stored(created.id).createTime = 'not a time';
		expect((await getRequestSummary(created.id, T0))?.status).toBe('expired');
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0)).toBe('expired');
	});
});

describe('decideRequest', () => {
	it('approves a pending request once and records who approved it', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000)).toBe('approved');
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 6000)).toBe('already-decided');
		const data = stored(created.id).data;
		expect(data.status).toBe('approved');
		expect(data.decidedBy).toEqual(AUSTEN);
		expect(data.decidedAt).toEqual(new Date(T0 + 5000));
	});

	it('denies a pending request', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(await decideRequest(created.id, 'deny', AUSTEN, HOME_ONLY, T0 + 5000)).toBe('denied');
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 6000)).toBe('already-decided');
	});

	it('refuses an expired or unknown request', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + REQUEST_LIFETIME_MS)).toBe(
			'expired'
		);
		expect(await decideRequest('AbCdEfGhIjKlMnOpQr12', 'approve', AUSTEN, HOME_ONLY, T0)).toBe('not-found');
	});

	it('refuses a request that was already collected', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		await collectRequest(created.id, created.secret, mint, T0 + 6000);
		expect(stored(created.id).data.status).toBe('used');

		expect(await decideRequest(created.id, 'approve', AUSTEN, CONFIRMED_ELSEWHERE, T0 + 7000)).toBe(
			'already-decided'
		);
		expect(await decideRequest(created.id, 'deny', AUSTEN, HOME_ONLY, T0 + 7000)).toBe('already-decided');
		expect(stored(created.id).data.status).toBe('used');
	});

	it('loses cleanly when another write lands between the read and the update', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		vi.mocked(rest.firestoreUpdateIfCurrent).mockResolvedValueOnce(false);
		expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 1000)).toBe('already-decided');
	});

	describe('how it was decided', () => {
		it('records a tap approval on the same network', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000)).toBe('approved');
			expect(stored(created.id).data).toMatchObject({
				method: 'tap',
				approverSameNetwork: true,
				approverNetworkFamily: 'ipv4'
			});
		});

		it('records a confirmed approval from elsewhere, with the approver family', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			const fromV6 = { ...CONFIRMED_ELSEWHERE, approverFamily: 'ipv6' as const };
			expect(await decideRequest(created.id, 'approve', AUSTEN, fromV6, T0 + 5000)).toBe('approved');
			expect(stored(created.id).data).toMatchObject({
				method: 'tap',
				approverSameNetwork: false,
				approverNetworkFamily: 'ipv6'
			});
		});

		it('records a denial the same way', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			expect(await decideRequest(created.id, 'deny', AUSTEN, UNCONFIRMED_ELSEWHERE, T0 + 5000)).toBe('denied');
			expect(stored(created.id).data).toMatchObject({
				status: 'denied',
				method: 'tap',
				approverSameNetwork: false,
				approverNetworkFamily: 'ipv4'
			});
		});

		it('approves an automatic approval on the same network, records it, and lets the browser collect', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			expect(await decideRequest(created.id, 'approve', AUSTEN, AUTO_HOME, T0 + 2000)).toBe('approved');
			expect(stored(created.id).data).toMatchObject({
				status: 'approved',
				method: 'auto',
				approverSameNetwork: true,
				approverNetworkFamily: 'ipv4'
			});
			expect(await collectRequest(created.id, created.secret, mint, T0 + 3000)).toEqual({
				status: 'approved',
				token: 'token-for-austen-uid'
			});
		});

		it('refuses an automatic approval from another network and changes nothing', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			const before = stored(created.id).revision;

			expect(await decideRequest(created.id, 'approve', AUSTEN, AUTO_ELSEWHERE, T0 + 2000)).toBe('confirm-network');
			expect(stored(created.id).revision).toBe(before);
			expect(stored(created.id).data.status).toBe('pending');
			expect(stored(created.id).data.method).toBeUndefined();
		});

		it('gives an automatic approval no way to confirm a different network', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			const forced = { ...AUTO_ELSEWHERE, confirmDifferentNetwork: true };
			expect(await decideRequest(created.id, 'approve', AUSTEN, forced, T0 + 2000)).toBe('confirm-network');
			expect(stored(created.id).data.status).toBe('pending');
		});

		it('fails closed: only a tap confirmed with exactly true goes ahead on a mismatch', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			const before = stored(created.id).revision;
			const refusedOnMismatch: Array<[string, Partial<DecisionNetwork>]> = [
				['an unknown method', { method: 'phone' as never }],
				['an empty method', { method: '' as never }],
				['no method', { method: undefined as never }],
				['a null method', { method: null as never }],
				['a confirmation of the string "true"', { confirmDifferentNetwork: 'true' as never }],
				['a confirmation of 1', { confirmDifferentNetwork: 1 as never }],
				['no confirmation', { confirmDifferentNetwork: undefined as never }],
				['an unknown method with a confirmation', { method: 'phone' as never, confirmDifferentNetwork: true }]
			];
			for (const [name, override] of refusedOnMismatch) {
				const network = { ...CONFIRMED_ELSEWHERE, ...override };
				expect(await decideRequest(created.id, 'approve', AUSTEN, network, T0 + 2000), name).toBe(
					'confirm-network'
				);
				expect(stored(created.id).revision, name).toBe(before);
				expect(stored(created.id).data.status, name).toBe('pending');
			}

			// The one allowed combination still works.
			expect(await decideRequest(created.id, 'approve', AUSTEN, CONFIRMED_ELSEWHERE, T0 + 3000)).toBe('approved');
		});

		it('refuses an automatic approval when either network is unknown', async () => {
			const unknownAsker = await createRequest(DEVICE, UNKNOWN_NET, T0);
			expect(await decideRequest(unknownAsker.id, 'approve', AUSTEN, AUTO_HOME, T0 + 2000)).toBe('confirm-network');

			const known = await createRequest(DEVICE, HOME_NET, T0);
			const unknownApprover = { ...AUTO_HOME, approverNetwork: '', approverFamily: '' as const };
			expect(await decideRequest(known.id, 'approve', AUSTEN, unknownApprover, T0 + 2000)).toBe('confirm-network');
			expect(stored(known.id).data.status).toBe('pending');
		});
	});

	describe('same-network check', () => {
		it('asks for confirmation before approving from another network, and changes nothing', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			const before = stored(created.id).revision;

			expect(await decideRequest(created.id, 'approve', AUSTEN, UNCONFIRMED_ELSEWHERE, T0 + 5000)).toBe(
				'confirm-network'
			);
			expect(stored(created.id).revision).toBe(before);
			expect(stored(created.id).data.status).toBe('pending');
			expect(stored(created.id).data.decidedBy).toBeUndefined();
		});

		it('approves from another network once the approver confirms', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			expect(await decideRequest(created.id, 'approve', AUSTEN, CONFIRMED_ELSEWHERE, T0 + 5000)).toBe(
				'approved'
			);
		});

		it('approves from the same network without any confirmation', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000)).toBe('approved');
		});

		it('denies from any network without confirmation', async () => {
			const created = await createRequest(DEVICE, HOME_NET, T0);
			expect(await decideRequest(created.id, 'deny', AUSTEN, UNCONFIRMED_ELSEWHERE, T0 + 5000)).toBe('denied');
		});

		it('asks for confirmation when the asking network is unknown', async () => {
			const created = await createRequest(DEVICE, UNKNOWN_NET, T0);
			expect(await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000)).toBe('confirm-network');
			expect(await decideRequest(created.id, 'approve', AUSTEN, { ...HOME_ONLY, confirmDifferentNetwork: true }, T0 + 5000)).toBe(
				'approved'
			);
		});

		it('asks for confirmation when the approver network is unknown, even if both are empty', async () => {
			const known = await createRequest(DEVICE, HOME_NET, T0);
			expect(
				await decideRequest(known.id, 'approve', AUSTEN, { ...HOME_ONLY, approverNetwork: '', approverFamily: '' }, T0 + 5000)
			).toBe('confirm-network');

			const neither = await createRequest(DEVICE, UNKNOWN_NET, T0);
			expect(
				await decideRequest(neither.id, 'approve', AUSTEN, { ...HOME_ONLY, approverNetwork: '', approverFamily: '' }, T0 + 5000)
			).toBe('confirm-network');
		});

		it('reports expired, unknown and already-decided requests before asking about the network', async () => {
			const expired = await createRequest(DEVICE, HOME_NET, T0);
			expect(
				await decideRequest(expired.id, 'approve', AUSTEN, UNCONFIRMED_ELSEWHERE, T0 + REQUEST_LIFETIME_MS)
			).toBe('expired');
			expect(await decideRequest('AbCdEfGhIjKlMnOpQr12', 'approve', AUSTEN, UNCONFIRMED_ELSEWHERE, T0)).toBe(
				'not-found'
			);

			const denied = await createRequest(DEVICE, HOME_NET, T0);
			await decideRequest(denied.id, 'deny', AUSTEN, HOME_ONLY, T0 + 1000);
			expect(await decideRequest(denied.id, 'approve', AUSTEN, UNCONFIRMED_ELSEWHERE, T0 + 2000)).toBe(
				'already-decided'
			);
		});
	});
});

describe('collectRequest', () => {
	it('waits while pending', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(await collectRequest(created.id, created.secret, mint, T0 + 1000)).toEqual({ status: 'pending' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('hands over a token for the approver exactly once', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);

		expect(await collectRequest(created.id, created.secret, mint, T0 + 6000)).toEqual({
			status: 'approved',
			token: 'token-for-austen-uid'
		});
		expect(stored(created.id).data.status).toBe('used');
		expect(await collectRequest(created.id, created.secret, mint, T0 + 7000)).toEqual({ status: 'expired' });
		expect(mint).toHaveBeenCalledTimes(1);
	});

	it('mints with the same clock reading it stores as usedAt', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);

		const collectedAt = T0 + 6999;
		await collectRequest(created.id, created.secret, mint, collectedAt);

		expect(mint).toHaveBeenCalledWith('austen-uid', collectedAt);
		expect((stored(created.id).data.usedAt as Date).getTime()).toBe(collectedAt);
	});

	it('reports a denial', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'deny', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(await collectRequest(created.id, created.secret, mint, T0 + 6000)).toEqual({ status: 'denied' });
	});

	it('treats a wrong secret or unknown id as expired and never mints', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(await collectRequest(created.id, 'wrong-secret', mint, T0 + 6000)).toEqual({ status: 'expired' });
		expect(await collectRequest('AbCdEfGhIjKlMnOpQr12', created.secret, mint, T0)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
		expect(stored(created.id).data.status).toBe('approved');
	});

	it('answers a wrong secret on a pending request as expired, not pending', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		expect(await collectRequest(created.id, 'wrong-secret', mint, T0 + 1000)).toEqual({ status: 'expired' });
		expect(await collectRequest(created.id, '', mint, T0 + 1000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('answers a wrong secret on a denied request as expired, not denied', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'deny', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(await collectRequest(created.id, 'wrong-secret', mint, T0 + 6000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('refuses an approved request after it expires', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(await collectRequest(created.id, created.secret, mint, T0 + REQUEST_LIFETIME_MS)).toEqual({
			status: 'expired'
		});
	});

	it('withholds the token when another collection wins the race', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		vi.mocked(rest.firestoreUpdateIfCurrent).mockResolvedValueOnce(false);
		expect(await collectRequest(created.id, created.secret, mint, T0 + 6000)).toEqual({ status: 'expired' });
	});

	it('withholds the token when "That wasn\'t me" lands between the read and the write', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, AUTO_HOME, T0 + 2000);
		// The mint callback runs after collect has read the approval and before it
		// writes `used`, which is exactly the gap the report has to be able to land in.
		mint.mockImplementationOnce(async (uid) => {
			expect(await reportNotMe(created.id, uid, T0 + 4000)).toEqual({ status: 'reported', collectedAt: null });
			return `token-for-${uid}`;
		});

		expect(await collectRequest(created.id, created.secret, mint, T0 + 3000)).toEqual({ status: 'expired' });
		expect(stored(created.id).data.status).toBe('denied');
		expect(stored(created.id).data.usedAt).toBeUndefined();
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 4000));

		// The token was minted, but nobody got it, and the request cannot be collected again.
		expect(mint).toHaveBeenCalledTimes(1);
		expect(await collectRequest(created.id, created.secret, mint, T0 + 5000)).toEqual({ status: 'denied' });
		expect(mint).toHaveBeenCalledTimes(1);
	});

	it('propagates a signing failure and leaves the request approved so the next poll can retry', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		mint.mockRejectedValueOnce(new Error('signing failed'));

		await expect(collectRequest(created.id, created.secret, mint, T0 + 6000)).rejects.toThrow('signing failed');
		expect(stored(created.id).data.status).toBe('approved');
		expect(stored(created.id).data.usedAt).toBeUndefined();

		expect(await collectRequest(created.id, created.secret, mint, T0 + 7000)).toEqual({
			status: 'approved',
			token: 'token-for-austen-uid'
		});
	});

	it('returns no token when the conditional write throws', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		vi.mocked(rest.firestoreUpdateIfCurrent).mockRejectedValueOnce(new Error('firestore down'));

		const result = await collectRequest(created.id, created.secret, mint, T0 + 6000).catch((e: Error) => e);
		expect(result).toBeInstanceOf(Error);
		expect(result).not.toHaveProperty('token');
		expect(stored(created.id).data.status).toBe('approved');
	});
});

describe('approval tag', () => {
	const tagFor = (id: string, uid: string, createTime: string, secretHash: string) =>
		hmacHex('approval', [id, uid, createTime, secretHash].join(NUL));

	/** A document someone wrote straight into Firestore, past decideRequest. */
	async function plantedApproval(extra: Record<string, unknown> = {}) {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		Object.assign(stored(created.id).data, {
			status: 'approved',
			decidedBy: { uid: 'victim-uid', email: 'austencloud@gmail.com' },
			decidedAt: new Date(T0 + 1000),
			...extra
		});
		return created;
	}

	let warn: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		warn.mockRestore();
	});

	it('is written with the approval, in the same conditional write as the status', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();

		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);

		expect(rest.firestoreUpdateIfCurrent).toHaveBeenCalledTimes(1);
		const written = vi.mocked(rest.firestoreUpdateIfCurrent).mock.calls[0][2];
		expect(written).toMatchObject({ status: 'approved', approvalTag: expect.stringMatching(/^[0-9a-f]{64}$/) });
		expect(written.approvalTag).toBe(
			await tagFor(created.id, AUSTEN.uid, stored(created.id).createTime, await sha256Hex(created.secret))
		);
	});

	it('is not written for a denial', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'deny', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(stored(created.id).data.approvalTag).toBeUndefined();
	});

	it('lets the normal path through', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		expect(await collectRequest(created.id, created.secret, mint, T0 + 6000)).toEqual({
			status: 'approved',
			token: 'token-for-austen-uid'
		});
		expect(warn).not.toHaveBeenCalled();
	});

	it('refuses a planted approved document that has no tag, and never mints', async () => {
		const created = await plantedApproval();
		expect(stored(created.id).data.approvalTag).toBeUndefined();

		expect(await collectRequest(created.id, created.secret, mint, T0 + 2000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
		expect(stored(created.id).data.status).toBe('approved');
	});

	it('refuses a planted document made from scratch with the planter own secret hash and any uid', async () => {
		const id = 'PlantedDocument123456';
		const secret = 'the-attackers-own-secret';
		await rest.firestoreSet(REQUESTS_COLLECTION, id, {
			status: 'approved',
			secretHash: await sha256Hex(secret),
			decidedBy: { uid: 'any-uid-the-attacker-likes', email: null },
			createdAt: new Date(T0)
		});

		expect(await collectRequest(id, secret, mint, T0 + 2000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('refuses a tag that is not a tag, whatever it holds', async () => {
		const created = await plantedApproval({ approvalTag: 'a'.repeat(64) });
		expect(await collectRequest(created.id, created.secret, mint, T0 + 2000)).toEqual({ status: 'expired' });

		for (const approvalTag of ['', 'not hex', 12345, null, { value: 'x' }]) {
			stored(created.id).data.approvalTag = approvalTag;
			expect(await collectRequest(created.id, created.secret, mint, T0 + 2000)).toEqual({ status: 'expired' });
		}
		expect(mint).not.toHaveBeenCalled();
	});

	it('refuses a tag computed for a different uid', async () => {
		const created = await plantedApproval();
		const createTime = stored(created.id).createTime;
		const secretHash = await sha256Hex(created.secret);
		// A valid tag, but for another approver than the uid the document names.
		stored(created.id).data.approvalTag = await tagFor(created.id, 'someone-else', createTime, secretHash);

		expect(await collectRequest(created.id, created.secret, mint, T0 + 2000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('refuses an approved request whose decidedBy uid is changed after the approval', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		stored(created.id).data.decidedBy = { uid: 'attacker-uid', email: null };

		expect(await collectRequest(created.id, created.secret, mint, T0 + 6000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('refuses an approved request whose secretHash is changed after the approval', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		const attackerSecret = 'the-attackers-own-secret';
		stored(created.id).data.secretHash = await sha256Hex(attackerSecret);

		// The planted hash makes the secret check pass; the tag is what stops it.
		expect(await collectRequest(created.id, attackerSecret, mint, T0 + 6000)).toEqual({ status: 'expired' });
		expect(await collectRequest(created.id, created.secret, mint, T0 + 6000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('refuses a tag copied from another request', async () => {
		const real = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(real.id, 'approve', AUSTEN, HOME_ONLY, T0 + 5000);
		const copied = stored(real.id).data.approvalTag;

		const planted = await plantedApproval({ approvalTag: copied, decidedBy: { uid: AUSTEN.uid, email: null } });
		expect(await collectRequest(planted.id, planted.secret, mint, T0 + 6000)).toEqual({ status: 'expired' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('names only the request id when it refuses', async () => {
		const created = await plantedApproval();
		await collectRequest(created.id, created.secret, mint, T0 + 2000);

		expect(warn).toHaveBeenCalledTimes(1);
		const logged = JSON.stringify(warn.mock.calls);
		expect(logged).toContain(created.id);
		expect(logged).not.toContain(created.secret);
		expect(logged).not.toContain('victim-uid');
		expect(logged).not.toContain(await sha256Hex(created.secret));
	});
});

describe('reportNotMe', () => {
	/** A request Austen's phone approved (automatically by default) at T0 + 2000. */
	async function approvedRequest() {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'approve', AUSTEN, AUTO_HOME, T0 + 2000);
		return created;
	}

	it('turns an approved, uncollected request into a denial the computer can never collect', async () => {
		const created = await approvedRequest();

		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000)).toEqual({
			status: 'reported',
			collectedAt: null
		});
		expect(stored(created.id).data.status).toBe('denied');
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 30_000));

		expect(await collectRequest(created.id, created.secret, mint, T0 + 31_000)).toEqual({ status: 'denied' });
		expect(mint).not.toHaveBeenCalled();
	});

	it('records the report on a used request, leaves its status alone and says when the computer collected', async () => {
		const created = await approvedRequest();
		await collectRequest(created.id, created.secret, mint, T0 + 3000);
		expect(stored(created.id).data.status).toBe('used');
		const usedAt = stored(created.id).data.usedAt as Date;

		const result = await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000);
		expect(result).toEqual({ status: 'reported', collectedAt: T0 + 3000 });
		// The time the collect write stored, not the time of the report.
		expect(result).toEqual({ status: 'reported', collectedAt: usedAt.getTime() });
		expect(stored(created.id).data.status).toBe('used');
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 30_000));
	});

	it('still says when the computer collected on a second report, and keeps the first report time', async () => {
		const created = await approvedRequest();
		await collectRequest(created.id, created.secret, mint, T0 + 3000);
		await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000);
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();

		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 90_000)).toEqual({
			status: 'reported',
			collectedAt: T0 + 3000
		});
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 30_000));
		expect(rest.firestoreUpdateIfCurrent).not.toHaveBeenCalled();
	});

	it('counts a used request whose usedAt cannot be read as collected just now, never as uncollected', async () => {
		const created = await approvedRequest();
		await collectRequest(created.id, created.secret, mint, T0 + 3000);
		for (const planted of ['not a date', null, 12345, undefined]) {
			stored(created.id).data.usedAt = planted;
			expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000)).toEqual({
				status: 'reported',
				collectedAt: T0 + 30_000
			});
		}
	});

	it('records the report on a request that was already denied, changing nothing else, and keeps the first report time', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		await decideRequest(created.id, 'deny', AUSTEN, HOME_ONLY, T0 + 2000);
		const before = structuredClone(stored(created.id).data);
		expect(before.status).toBe('denied');

		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000)).toEqual({
			status: 'reported',
			collectedAt: null
		});
		// Only reportedNotMeAt is new.
		expect(stored(created.id).data).toEqual({ ...before, reportedNotMeAt: new Date(T0 + 30_000) });

		const afterFirst = structuredClone(stored(created.id).data);
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();
		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 90_000)).toEqual({
			status: 'reported',
			collectedAt: null
		});
		expect(stored(created.id).data).toEqual(afterFirst);
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 30_000));
		expect(rest.firestoreUpdateIfCurrent).not.toHaveBeenCalled();
	});

	it('turns an approved request that has expired into a denial', async () => {
		const created = await approvedRequest();
		const afterExpiry = T0 + REQUEST_LIFETIME_MS + 1000;
		expect((await getRequestSummary(created.id, afterExpiry))?.status).toBe('expired');
		expect(stored(created.id).data.status).toBe('approved');

		expect(await reportNotMe(created.id, AUSTEN.uid, afterExpiry)).toEqual({
			status: 'reported',
			collectedAt: null
		});
		expect(stored(created.id).data.status).toBe('denied');
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(afterExpiry));
	});

	it('keeps the first report time when an approved request is reported twice', async () => {
		const created = await approvedRequest();
		await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000);
		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 90_000)).toEqual({
			status: 'reported',
			collectedAt: null
		});
		expect(stored(created.id).data.status).toBe('denied');
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 30_000));
	});

	it('is not found for an unknown id, and writes nothing', async () => {
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();
		expect(await reportNotMe('AbCdEfGhIjKlMnOpQr12', AUSTEN.uid, T0)).toEqual({ status: 'not-found' });
		expect(rest.firestoreUpdateIfCurrent).not.toHaveBeenCalled();
	});

	it('is not found for a request another uid decided, and writes nothing', async () => {
		const created = await approvedRequest();
		const before = structuredClone(stored(created.id));
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();

		expect(await reportNotMe(created.id, 'someone-else-uid', T0 + 30_000)).toEqual({ status: 'not-found' });
		expect(rest.firestoreUpdateIfCurrent).not.toHaveBeenCalled();
		expect(stored(created.id)).toEqual(before);
	});

	it('is not found for a pending request, which nobody has decided, and writes nothing', async () => {
		const created = await createRequest(DEVICE, HOME_NET, T0);
		const before = structuredClone(stored(created.id));
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();

		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 1000)).toEqual({ status: 'not-found' });
		expect(rest.firestoreUpdateIfCurrent).not.toHaveBeenCalled();
		expect(stored(created.id)).toEqual(before);
	});

	it('reads again and wins when the first conditional write loses', async () => {
		const created = await approvedRequest();
		vi.mocked(rest.firestoreGetWithRevision).mockClear();
		vi.mocked(rest.firestoreUpdateIfCurrent).mockClear();
		vi.mocked(rest.firestoreUpdateIfCurrent).mockResolvedValueOnce(false);

		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000)).toEqual({
			status: 'reported',
			collectedAt: null
		});
		expect(rest.firestoreGetWithRevision).toHaveBeenCalledTimes(2);
		expect(rest.firestoreUpdateIfCurrent).toHaveBeenCalledTimes(2);
		expect(stored(created.id).data.status).toBe('denied');
	});

	it('records the report without touching the status when a collection lands between the read and the write', async () => {
		const created = await approvedRequest();
		// The first write loses because the browser collected in the meantime; the
		// retry then sees `used` and records the report without touching the status.
		vi.mocked(rest.firestoreUpdateIfCurrent).mockImplementationOnce(async () => {
			await collectRequest(created.id, created.secret, mint, T0 + 3000);
			return false;
		});

		// It collected after all, so the answer carries the collect time and the
		// caller knows the token it got may still be in use.
		expect(await reportNotMe(created.id, AUSTEN.uid, T0 + 30_000)).toEqual({
			status: 'reported',
			collectedAt: T0 + 3000
		});
		expect(stored(created.id).data.status).toBe('used');
		expect(stored(created.id).data.reportedNotMeAt).toEqual(new Date(T0 + 30_000));
	});

	it('gives up with an error after three lost writes', async () => {
		const created = await approvedRequest();
		vi.mocked(rest.firestoreUpdateIfCurrent)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false);

		await expect(reportNotMe(created.id, AUSTEN.uid, T0 + 30_000)).rejects.toThrow(created.id);
		expect(stored(created.id).data.status).toBe('approved');
		expect(stored(created.id).data.reportedNotMeAt).toBeUndefined();
	});
});
