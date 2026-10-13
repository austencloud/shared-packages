// Where the login page sends someone once they are signed in.
//
// A phone that scans the sign-in code lands on /sign-in/<id> before it has a
// session, gets sent to /login, and should come back to that request after
// signing in. The destination travels in `?next=`, which anyone can put in a
// link, so only the one shape this feature creates is honored. Anything else,
// including another site, an extra path segment or a trick that only decodes
// into a path, falls back to the dashboard.

export interface PagePaths {
	/** Where approve pages live; a request's page is `<approvePath>/<id>`. Default '/sign-in'. */
	approvePath?: string;
	/** The app's login page. Default '/login'. */
	loginPath?: string;
}

/** An approve page: the exact path of a phone sign-in request id. */
export function isApprovePagePath(pathname: string, approvePath = '/sign-in'): boolean {
	const prefix = `${approvePath}/`;
	return pathname.startsWith(prefix) && /^[A-Za-z0-9]{20}$/.test(pathname.slice(prefix.length));
}

/** `next` from a query string or its parsed form, if it names an approve page; otherwise '/'. */
export function safeNext(search: string | URLSearchParams, paths: PagePaths = {}): string {
	const params = typeof search === 'string' ? new URLSearchParams(search) : search;
	const next = params.get('next');
	return next !== null && isApprovePagePath(next, paths.approvePath) ? next : '/';
}

/** The login page to send a signed-out visitor to, remembering the approve page they came for. */
export function loginPathFor(pathname: string, paths: PagePaths = {}): string {
	const loginPath = paths.loginPath ?? '/login';
	return isApprovePagePath(pathname, paths.approvePath)
		? `${loginPath}?next=${encodeURIComponent(pathname)}`
		: loginPath;
}
