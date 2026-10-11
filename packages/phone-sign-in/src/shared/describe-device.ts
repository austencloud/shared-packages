// Plain names for the browser asking to sign in, shown on the phone's approve
// page so Austen can tell his own computer from anything else.

export function describeDevice(userAgent: string): string {
	const ua = userAgent || '';
	const browser = / Claude\/\d/.test(ua)
		? "Claude's browser"
		: /Edg(A|iOS)?\//.test(ua)
			? 'Edge'
			: /SamsungBrowser\//.test(ua)
				? 'Samsung Internet'
				: /Firefox\/|FxiOS\//.test(ua)
					? 'Firefox'
					: /Chrome\/|CriOS\//.test(ua)
						? 'Chrome'
						: /Safari\//.test(ua)
							? 'Safari'
							: null;
	if (!browser) return 'A browser';

	// iPhone agents mention "Mac OS X" and Android agents mention Linux, so
	// those two are checked first.
	const os = /Windows/.test(ua)
		? 'Windows'
		: /Android/.test(ua)
			? 'Android'
			: /iPhone|iPad|iPod/.test(ua)
				? 'iPhone or iPad'
				: /Macintosh|Mac OS X/.test(ua)
					? 'Mac'
					: /CrOS/.test(ua)
						? 'ChromeOS'
						: /Linux/.test(ua)
							? 'Linux'
							: '';
	return os ? `${browser} on ${os}` : browser;
}

/** "Chicago, IL, US" from Cloudflare's request metadata, or "" when unknown. */
export function describePlace(cf: Record<string, unknown> | undefined): string {
	return [cf?.city, cf?.regionCode, cf?.country]
		.filter((part): part is string => typeof part === 'string' && part.length > 0)
		.join(', ');
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Which copy of the app asked, for the approve page: '' for the live site
 * (`liveHost`, such as "ringmaster.cirqueaflame.com"), "a local copy
 * (127.0.0.1:5231)" for one on the asking computer, otherwise the host name
 * ("dev-ringmaster.cirqueaflame.com").
 */
export function describeSite(url: URL, liveHost: string): string {
	if (url.hostname === liveHost) return '';
	if (LOOPBACK_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost')) return `a local copy (${url.host})`;
	return url.host;
}
