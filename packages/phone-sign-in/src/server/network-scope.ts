// Which network an address belongs to, for telling whether the phone that
// approves a sign-in is on the same connection as the computer that asked.
// The parser is strict on purpose: an input that is not clearly an address
// gives '' (unknown), and an unknown network never counts as a match.
// A private, loopback or link-local address is unknown too. It says nothing
// about which connection a caller is on: under `vite dev` behind a tunnel the
// server sees only its own loopback address for every caller, so counting it
// would make every caller look like one network.

/** Four dotted decimal octets, each 0 to 255, with no leading zeros ("010" reads as octal in some parsers). */
function parseIpv4(text: string): [number, number, number, number] | null {
	const parts = text.split('.');
	if (parts.length !== 4) return null;
	const octets: number[] = [];
	for (const part of parts) {
		if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return null;
		const value = Number(part);
		if (value > 255) return null;
		octets.push(value);
	}
	return octets as [number, number, number, number];
}

/** False for the IPv4 ranges that belong to no one public network: this-host, private, shared (CGNAT), loopback and link-local. */
function isPublicIpv4([first, second]: [number, number, number, number]): boolean {
	if (first === 0 || first === 10 || first === 127) return false;
	if (first === 100 && second >= 64 && second <= 127) return false;
	if (first === 169 && second === 254) return false;
	if (first === 172 && second >= 16 && second <= 31) return false;
	if (first === 192 && second === 168) return false;
	return true;
}

/** False for the IPv6 ranges that belong to no one public network: unspecified, loopback, link-local and unique local. */
function isPublicIpv6(hextets: number[]): boolean {
	if (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] <= 1) return false;
	if ((hextets[0] & 0xffc0) === 0xfe80) return false;
	if ((hextets[0] & 0xfe00) === 0xfc00) return false;
	return true;
}

/** One side of an IPv6 literal split at "::". A dotted IPv4 may only be the very last part of the whole address. */
function parseIpv6Side(side: string, mayEndWithIpv4: boolean): number[] | null {
	if (side === '') return [];
	const parts = side.split(':');
	const hextets: number[] = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part.includes('.')) {
			if (!mayEndWithIpv4 || i !== parts.length - 1) return null;
			const v4 = parseIpv4(part);
			if (!v4) return null;
			hextets.push(v4[0] * 256 + v4[1], v4[2] * 256 + v4[3]);
		} else {
			if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) return null;
			hextets.push(parseInt(part, 16));
		}
	}
	return hextets;
}

/** The 8 hextets of a valid IPv6 literal, or null for anything else (brackets, zone ids, junk). */
function parseIpv6(text: string): number[] | null {
	if (!/^[0-9A-Fa-f:.]+$/.test(text)) return null;
	const gap = text.indexOf('::');
	if (gap !== text.lastIndexOf('::')) return null;

	if (gap === -1) {
		const all = parseIpv6Side(text, true);
		return all && all.length === 8 ? all : null;
	}
	const head = parseIpv6Side(text.slice(0, gap), false);
	const tail = parseIpv6Side(text.slice(gap + 2), true);
	if (!head || !tail || head.length + tail.length > 7) return null;
	return [...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail];
}

/**
 * The network an address belongs to, as text:
 * - a strict dotted IPv4 address is returned as is;
 * - a valid IPv6 address gives its first four hextets (its /64), lowercase and
 *   without leading zeros, so two spellings of one prefix match;
 * - an IPv4-mapped IPv6 address ("::ffff:203.0.113.9", or the same address
 *   written in hex) gives the embedded IPv4 address;
 * - a non-public address gives '', in either form: IPv4 0.0.0.0/8, 10.0.0.0/8,
 *   100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12 and
 *   192.168.0.0/16; IPv6 "::", "::1", fe80::/10 and fc00::/7. The documentation
 *   ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32) count
 *   as ordinary public addresses, so tests can use them;
 * - anything else ('unknown', '', junk, brackets, a zone id) gives ''.
 */
export function networkScope(ip: string): string {
	if (typeof ip !== 'string') return '';
	const octets = parseIpv4(ip);
	if (octets) return isPublicIpv4(octets) ? ip : '';

	const hextets = parseIpv6(ip);
	if (!hextets) return '';

	const mapped = hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff;
	if (mapped) {
		const [high, low] = [hextets[6], hextets[7]];
		const embedded: [number, number, number, number] = [high >> 8, high & 255, low >> 8, low & 255];
		return isPublicIpv4(embedded) ? embedded.join('.') : '';
	}
	if (!isPublicIpv6(hextets)) return '';
	return hextets
		.slice(0, 4)
		.map((h) => h.toString(16))
		.join(':');
}

export type NetworkFamily = 'ipv4' | 'ipv6' | '';

/**
 * Which kind of address the network scope came from, for the audit trail: an
 * IPv4-mapped IPv6 address counts as IPv4, like its scope. '' exactly when
 * networkScope gives ''.
 */
export function networkFamily(ip: string): NetworkFamily {
	const scope = networkScope(ip);
	if (scope === '') return '';
	return scope.includes(':') ? 'ipv6' : 'ipv4';
}

export type LocalAddressKind = 'loopback' | 'lan';

function localIpv4Kind([first, second]: [number, number, number, number]): LocalAddressKind | null {
	if (first === 127) return 'loopback';
	if (first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31)) return 'lan';
	if (first === 169 && second === 254) return 'lan';
	return null;
}

/**
 * Whether an address is this computer ('loopback') or a device on the same
 * local network ('lan': private and link-local ranges), or null for anything
 * else. Shared CGNAT space (100.64.0.0/10) is not local: Tailscale peers use it
 * and may be anywhere. Used only by dev servers, which see every caller this way
 * (see requester-address.ts).
 */
export function localAddressKind(ip: string): LocalAddressKind | null {
	if (typeof ip !== 'string') return null;
	const octets = parseIpv4(ip);
	if (octets) return localIpv4Kind(octets);

	const hextets = parseIpv6(ip);
	if (!hextets) return null;
	const mapped = hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff;
	if (mapped) {
		const [high, low] = [hextets[6], hextets[7]];
		return localIpv4Kind([high >> 8, high & 255, low >> 8, low & 255]);
	}
	if (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1) return 'loopback';
	if ((hextets[0] & 0xffc0) === 0xfe80 || (hextets[0] & 0xfe00) === 0xfc00) return 'lan';
	return null;
}
