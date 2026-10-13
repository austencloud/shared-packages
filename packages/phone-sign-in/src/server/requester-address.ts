// The address whose network a new sign-in request is stamped with. Production
// uses the caller's address as Cloudflare reports it. A dev server sees every
// caller as loopback (or, bound to the LAN, a private address), which names no
// network, so every local sign-in would warn and auto-approval could never
// apply. In a dev build only:
// - a loopback caller with cf-connecting-ip came through the dev tunnel, and
//   Cloudflare sets that header (replacing any value a visitor sends), so the
//   visitor is stamped with their own network, never with Austen's;
// - any other loopback or LAN caller is on this computer or its network, so it
//   is stamped with this computer's public address.
// Spec: docs/superpowers/specs/2026-10-09-phone-sign-in-any-server-design.md
import { localAddressKind, networkScope } from './network-scope';
import { publicAddress } from './public-address';

interface Input {
	/** The caller's address from getClientAddress, or 'unknown'. */
	address: string;
	headers: Headers;
	/** `dev` from $app/environment. */
	dev: boolean;
	lookup?: () => Promise<string>;
}

export async function requesterAddress({ address, headers, dev, lookup = publicAddress }: Input): Promise<string> {
	if (!dev) return address;
	const kind = localAddressKind(address);
	if (kind === null) return address;
	if (kind === 'loopback') {
		const tunnelled = headers.get('cf-connecting-ip');
		if (tunnelled !== null && tunnelled !== '') {
			const caller = tunnelled.trim();
			return networkScope(caller) === '' ? 'unknown' : caller;
		}
	}
	return lookup();
}
