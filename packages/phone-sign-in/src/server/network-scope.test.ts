import { describe, expect, it } from 'vitest';
import { localAddressKind, networkFamily, networkScope } from './network-scope';

describe('networkScope', () => {
	describe('IPv4', () => {
		it('returns a strict dotted address as is', () => {
			expect(networkScope('203.0.113.9')).toBe('203.0.113.9');
			expect(networkScope('8.8.8.8')).toBe('8.8.8.8');
			expect(networkScope('255.255.255.255')).toBe('255.255.255.255');
		});

		it.each([
			['an octet over 255', '256.1.1.1'],
			['too few octets', '203.0.113'],
			['too many octets', '203.0.113.9.1'],
			['a leading zero', '203.0.113.09'],
			['a leading zero in the first octet', '010.0.0.1'],
			['a letter', '203.0.113.x'],
			['a port', '203.0.113.9:443'],
			['a trailing dot', '203.0.113.9.'],
			['spaces around it', ' 203.0.113.9'],
			['a trailing newline', '203.0.113.9\n'],
			['a negative octet', '203.0.-1.9'],
			['an empty octet', '203..113.9']
		])('gives nothing for %s', (_why, ip) => {
			expect(networkScope(ip)).toBe('');
		});
	});

	describe('IPv6', () => {
		it('gives the first four hextets', () => {
			expect(networkScope('2001:db8:1234:5678:aaaa:bbbb:cccc:1111')).toBe('2001:db8:1234:5678');
		});

		it('reads zero compression', () => {
			expect(networkScope('2001:db8:1234:5678::2222')).toBe('2001:db8:1234:5678');
			expect(networkScope('2001:db8::1')).toBe('2001:db8:0:0');
			expect(networkScope('2001:db8:1234:5678:9abc:def0:1234::')).toBe('2001:db8:1234:5678');
		});

		it('puts two addresses in one /64 on one scope and another /64 on another', () => {
			const a = networkScope('2001:db8:1234:5678:aaaa:bbbb:cccc:1111');
			expect(networkScope('2001:db8:1234:5678::2222')).toBe(a);
			expect(networkScope('2001:db8:1234:9999::1')).not.toBe(a);
		});

		it('spells one prefix one way whatever the case or leading zeros', () => {
			expect(networkScope('2001:0DB8:0000:0001::1')).toBe('2001:db8:0:1');
			expect(networkScope('2001:db8:0:1::2')).toBe('2001:db8:0:1');
		});

		it('keeps an embedded IPv4 tail out of the prefix', () => {
			expect(networkScope('2001:db8:1:2:3:4:203.0.113.9')).toBe('2001:db8:1:2');
		});

		it.each([
			['brackets', '[2001:db8::1]'],
			['a zone id', 'fe80::1%eth0'],
			['a zone id with brackets', '[fe80::1%25eth0]'],
			['two compressions', '2001::db8::1'],
			['three colons', '2001:::1'],
			['nine groups', '1:2:3:4:5:6:7:8:9'],
			['seven groups and no compression', '1:2:3:4:5:6:7'],
			['a compression beside eight groups', '1:2:3:4::5:6:7:8'],
			['a group of five digits', '2001:db8:12345::1'],
			['a non-hex digit', '2001:db8:xyz::1'],
			['a lone leading colon', ':2001:db8::1'],
			['a lone trailing colon', '2001:db8::1:'],
			['an IPv4 tail in the middle', '::1.2.3.4:5'],
			['an IPv4 tail before a compression', '1.2.3.4::1'],
			['a bad IPv4 tail', '::ffff:999.1.1.1'],
			['a port', '[2001:db8::1]:443']
		])('gives nothing for %s', (_why, ip) => {
			expect(networkScope(ip)).toBe('');
		});
	});

	describe('IPv4-mapped IPv6', () => {
		it('gives the embedded IPv4 address', () => {
			expect(networkScope('::ffff:203.0.113.9')).toBe('203.0.113.9');
			expect(networkScope('::FFFF:203.0.113.9')).toBe('203.0.113.9');
			expect(networkScope('0:0:0:0:0:ffff:203.0.113.9')).toBe('203.0.113.9');
		});

		it('reads the same address written in hex', () => {
			expect(networkScope('::ffff:cb00:7109')).toBe('203.0.113.9');
		});

		it('keeps different mapped addresses apart', () => {
			expect(networkScope('::ffff:198.51.100.7')).not.toBe(networkScope('::ffff:203.0.113.9'));
		});

		it('gives nothing when the embedded address is not strict', () => {
			expect(networkScope('::ffff:203.0.113.09')).toBe('');
			expect(networkScope('::ffff:203.0.113')).toBe('');
		});
	});

	// A caller behind a tunnel to a dev server shows up as 127.0.0.1 or ::1. These
	// addresses say nothing about the connection, so none of them is a network.
	describe('non-public addresses', () => {
		it.each([
			['this host', '0.0.0.0'],
			['the start of 0.0.0.0/8', '0.1.2.3'],
			['the end of 0.0.0.0/8', '0.255.255.255'],
			['the start of 10.0.0.0/8', '10.0.0.0'],
			['10.x.x.x', '10.1.2.3'],
			['the end of 10.0.0.0/8', '10.255.255.255'],
			['the start of 100.64.0.0/10', '100.64.0.0'],
			['carrier-grade NAT', '100.64.0.1'],
			['the end of 100.64.0.0/10', '100.127.255.255'],
			['loopback', '127.0.0.1'],
			['the end of 127.0.0.0/8', '127.255.255.255'],
			['the start of 169.254.0.0/16', '169.254.0.0'],
			['link-local', '169.254.169.254'],
			['the end of 169.254.0.0/16', '169.254.255.255'],
			['the start of 172.16.0.0/12', '172.16.0.0'],
			['172.16.x.x', '172.20.5.5'],
			['the end of 172.16.0.0/12', '172.31.255.255'],
			['the start of 192.168.0.0/16', '192.168.0.0'],
			['home Wi-Fi', '192.168.1.20'],
			['the end of 192.168.0.0/16', '192.168.255.255']
		])('gives nothing for IPv4 %s (%s)', (_why, ip) => {
			expect(networkScope(ip)).toBe('');
			expect(networkScope(`::ffff:${ip}`)).toBe('');
		});

		it.each([
			['just below 10.0.0.0/8', '9.255.255.255'],
			['just above 10.0.0.0/8', '11.0.0.0'],
			['just below 100.64.0.0/10', '100.63.255.255'],
			['just above 100.64.0.0/10', '100.128.0.0'],
			['just below 127.0.0.0/8', '126.255.255.255'],
			['just above 127.0.0.0/8', '128.0.0.0'],
			['169.253.x.x', '169.253.255.255'],
			['169.255.x.x', '169.255.0.0'],
			['just below 172.16.0.0/12', '172.15.255.255'],
			['just above 172.16.0.0/12', '172.32.0.0'],
			['192.167.x.x', '192.167.255.255'],
			['192.169.x.x', '192.169.0.0'],
			['the first documentation range', '192.0.2.1'],
			['the second documentation range', '198.51.100.7'],
			['the third documentation range', '203.0.113.9']
		])('keeps IPv4 %s (%s) as a network', (_why, ip) => {
			expect(networkScope(ip)).toBe(ip);
			expect(networkScope(`::ffff:${ip}`)).toBe(ip);
		});

		it('reads an IPv4-mapped address written in hex the same way', () => {
			expect(networkScope('::ffff:7f00:1')).toBe('');
			expect(networkScope('::ffff:a01:203')).toBe('');
			expect(networkScope('::ffff:c0a8:114')).toBe('');
			expect(networkScope('::ffff:cb00:7109')).toBe('203.0.113.9');
		});

		it.each([
			['the unspecified address', '::'],
			['the unspecified address, spelled out', '0:0:0:0:0:0:0:0'],
			['loopback', '::1'],
			['loopback, spelled out', '0000:0000:0000:0000:0000:0000:0000:0001'],
			['the start of fe80::/10', 'fe80::'],
			['link-local', 'fe80::1'],
			['link-local, uppercase', 'FE80::ABCD'],
			['the end of fe80::/10', 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
			['near the end of fe80::/10', 'febf::1'],
			['the start of fc00::/7', 'fc00::1'],
			['unique local', 'fd12:3456:789a:1::1'],
			['the end of fc00::/7', 'fdff::1'],
			['the end of fc00::/7, in full', 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff']
		])('gives nothing for IPv6 %s (%s)', (_why, ip) => {
			expect(networkScope(ip)).toBe('');
		});

		it.each([
			['just above fe80::/10', 'fec0::1', 'fec0:0:0:0'],
			['just below fe80::/10', 'fe7f::1', 'fe7f:0:0:0'],
			['just below fc00::/7', 'fbff::1', 'fbff:0:0:0'],
			['just above fc00::/7', 'fe00::1', 'fe00:0:0:0'],
			['the address after loopback', '::2', '0:0:0:0'],
			['a global unicast address', '2606:4700:4700::1111', '2606:4700:4700:0'],
			['the documentation range', '2001:db8::1', '2001:db8:0:0']
		])('keeps IPv6 %s (%s) as a network', (_why, ip, scope) => {
			expect(networkScope(ip)).toBe(scope);
		});
	});

	describe('anything else', () => {
		it.each(['', 'unknown', 'global', 'localhost', 'not an address', '|', '203.0.113.9|198.51.100.7', 'http://203.0.113.9'])(
			'gives nothing for %j',
			(ip) => {
				expect(networkScope(ip)).toBe('');
			}
		);

		it('gives nothing for a value that is not a string', () => {
			expect(networkScope(undefined as never)).toBe('');
			expect(networkScope(null as never)).toBe('');
		});
	});
});

describe('networkFamily', () => {
	it('calls a dotted address ipv4', () => {
		expect(networkFamily('203.0.113.9')).toBe('ipv4');
	});

	it('calls an IPv6 address ipv6', () => {
		expect(networkFamily('2001:db8::1')).toBe('ipv6');
	});

	it('counts an IPv4-mapped IPv6 address as ipv4, like its scope', () => {
		expect(networkFamily('::ffff:203.0.113.9')).toBe('ipv4');
	});

	it.each(['unknown', '', '[2001:db8::1]'])('gives nothing for %j', (ip) => {
		expect(networkFamily(ip)).toBe('');
	});

	it.each(['127.0.0.1', '10.1.2.3', '192.168.1.20', '::ffff:127.0.0.1', '::1', '::', 'fe80::1', 'fd12::1'])(
		'gives nothing for the non-public address %j, exactly as networkScope does',
		(ip) => {
			expect(networkScope(ip)).toBe('');
			expect(networkFamily(ip)).toBe('');
		}
	);
});

describe('localAddressKind', () => {
	it.each([
		['127.0.0.1', 'loopback'],
		['127.8.9.10', 'loopback'],
		['::1', 'loopback'],
		['::ffff:127.0.0.1', 'loopback'],
		['10.0.0.5', 'lan'],
		['172.16.4.2', 'lan'],
		['172.31.255.1', 'lan'],
		['192.168.12.208', 'lan'],
		['169.254.10.1', 'lan'],
		['::ffff:192.168.1.4', 'lan'],
		['fe80::1', 'lan'],
		['fd12:3456::1', 'lan']
	])('%s is %s', (ip, kind) => {
		expect(localAddressKind(ip)).toBe(kind);
	});

	it.each([
		['a public IPv4 address', '203.0.113.9'],
		['a public IPv6 address', '2001:db8::1'],
		['shared CGNAT space, which Tailscale peers use', '100.101.102.103'],
		['this-host 0.0.0.0/8', '0.0.0.1'],
		['the unspecified IPv6 address', '::'],
		['junk', 'unknown'],
		['an empty string', ''],
		['172.32, just past the private range', '172.32.0.1']
	])('gives null for %s', (_why, ip) => {
		expect(localAddressKind(ip)).toBeNull();
	});
});
