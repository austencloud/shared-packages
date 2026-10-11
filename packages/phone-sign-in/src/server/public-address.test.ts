import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPublicAddress, publicAddress } from './public-address';

const TRACE = 'fl=123\nh=cloudflare.com\nip=203.0.113.9\nts=1760000000.1\nloc=US\n';

function answer(body: string, ok = true) {
	return vi.fn(async () => new Response(body, { status: ok ? 200 : 500 }));
}

beforeEach(() => forgetPublicAddress());

describe('publicAddress', () => {
	it("reads the ip line from Cloudflare's trace", async () => {
		const fetcher = answer(TRACE);
		expect(await publicAddress({ fetcher, now: 0 })).toBe('203.0.113.9');
		expect(fetcher).toHaveBeenCalledWith('https://cloudflare.com/cdn-cgi/trace', expect.anything());
	});

	it('asks once in five minutes', async () => {
		const fetcher = answer(TRACE);
		await publicAddress({ fetcher, now: 0 });
		expect(await publicAddress({ fetcher, now: 299_999 })).toBe('203.0.113.9');
		expect(fetcher).toHaveBeenCalledTimes(1);
		await publicAddress({ fetcher, now: 300_000 });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('reads an IPv6 answer', async () => {
		expect(await publicAddress({ fetcher: answer('ip=2001:db8:1:2::9\n'), now: 0 })).toBe('2001:db8:1:2::9');
	});

	it.each([
		['an error status', answer(TRACE, false)],
		['no ip line', answer('fl=123\nloc=US\n')],
		['a private address', answer('ip=192.168.1.4\n')],
		['junk in the ip line', answer('ip=not-an-address\n')],
		['a network failure', vi.fn(async () => Promise.reject(new Error('offline')))]
	])('gives unknown for %s and does not remember it', async (_why, fetcher) => {
		expect(await publicAddress({ fetcher, now: 0 })).toBe('unknown');
		const good = answer(TRACE);
		expect(await publicAddress({ fetcher: good, now: 1 })).toBe('203.0.113.9');
	});
});
