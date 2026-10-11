// This computer's public internet address, for a dev server's phone sign-in
// requests (requester-address.ts). A dev server sees its callers as loopback,
// which names no network; the computer's own public address is the network a
// phone on the same Wi-Fi reaches the live site from.
// Spec: docs/superpowers/specs/2026-10-09-phone-sign-in-any-server-design.md
import { networkScope } from './network-scope';

const TRACE_URL = 'https://cloudflare.com/cdn-cgi/trace';
const KEEP_MS = 5 * 60_000;
const TIMEOUT_MS = 3_000;

let remembered: { address: string; until: number } | null = null;

interface Options {
	fetcher?: typeof fetch;
	now?: number;
}

/** The public address from Cloudflare's trace, cached for 5 minutes; 'unknown' when it cannot be read. Failures are not cached. */
export async function publicAddress({ fetcher = fetch, now = Date.now() }: Options = {}): Promise<string> {
	if (remembered && now < remembered.until) return remembered.address;
	try {
		const response = await fetcher(TRACE_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!response.ok) return 'unknown';
		const address = /^ip=(.+)$/m.exec(await response.text())?.[1]?.trim() ?? '';
		if (networkScope(address) === '') return 'unknown';
		remembered = { address, until: now + KEEP_MS };
		return address;
	} catch {
		return 'unknown';
	}
}

/** Drops the cached address. For tests. */
export function forgetPublicAddress(): void {
	remembered = null;
}
