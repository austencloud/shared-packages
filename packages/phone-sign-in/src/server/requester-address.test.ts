import { describe, expect, it, vi } from 'vitest';
import { requesterAddress } from './requester-address';

const HOME = '198.51.100.7';
const lookup = () => vi.fn(async () => HOME);

function headers(values: Record<string, string> = {}) {
	return new Headers(values);
}

describe('requesterAddress', () => {
	it('leaves every address alone in a production build', async () => {
		const find = lookup();
		for (const address of ['127.0.0.1', '192.168.1.4', '203.0.113.9', 'unknown']) {
			expect(
				await requesterAddress({ address, headers: headers({ 'cf-connecting-ip': '203.0.113.50' }), dev: false, lookup: find })
			).toBe(address);
		}
		expect(find).not.toHaveBeenCalled();
	});

	it("uses this computer's public address for a loopback caller in dev", async () => {
		expect(await requesterAddress({ address: '127.0.0.1', headers: headers(), dev: true, lookup: lookup() })).toBe(HOME);
		expect(await requesterAddress({ address: '::1', headers: headers(), dev: true, lookup: lookup() })).toBe(HOME);
	});

	it("uses this computer's public address for a caller on the same LAN in dev", async () => {
		expect(await requesterAddress({ address: '192.168.12.208', headers: headers(), dev: true, lookup: lookup() })).toBe(HOME);
	});

	it("uses the tunnel's cf-connecting-ip for a loopback caller that came through Cloudflare", async () => {
		const find = lookup();
		const address = await requesterAddress({
			address: '127.0.0.1',
			headers: headers({ 'cf-connecting-ip': '203.0.113.50' }),
			dev: true,
			lookup: find
		});
		expect(address).toBe('203.0.113.50');
		expect(find).not.toHaveBeenCalled();
	});

	it('never takes cf-connecting-ip from a LAN caller, who could have written it', async () => {
		expect(
			await requesterAddress({
				address: '192.168.12.208',
				headers: headers({ 'cf-connecting-ip': '203.0.113.50' }),
				dev: true,
				lookup: lookup()
			})
		).toBe(HOME);
	});

	it('passes a blank or junk tunnel header on as unknown, never as the home network', async () => {
		for (const value of ['', 'junk', '10.0.0.1']) {
			const find = lookup();
			expect(
				await requesterAddress({ address: '127.0.0.1', headers: headers({ 'cf-connecting-ip': value }), dev: true, lookup: find })
			).toBe(value === '' ? HOME : 'unknown');
		}
	});

	it('leaves public, CGNAT and unknown callers alone in dev', async () => {
		const find = lookup();
		for (const address of ['203.0.113.9', '100.101.102.103', 'unknown']) {
			expect(await requesterAddress({ address, headers: headers(), dev: true, lookup: find })).toBe(address);
		}
		expect(find).not.toHaveBeenCalled();
	});
});
