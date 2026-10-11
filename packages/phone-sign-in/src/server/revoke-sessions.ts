// "That wasn't me" signs every session of the account out. Setting the
// account's validSince to now revokes all of its refresh tokens; it is the
// call the Admin SDK's revokeRefreshTokens makes. ID tokens already issued
// keep working until they expire, up to an hour, and the phone says so.
//
// It uses its own OAuth token with a single non-Firestore scope
// (ACCOUNTS_UPDATE_SCOPE); the app's Firestore token stays datastore-only. An
// emulator run never calls it, so a local test can never sign the real
// account out.
//
// A call is retried once: at once with a fresh token after a 401, and after a
// short pause after a 429, a 5xx or a failed request. The same validSince
// sent twice does the same thing, so the retry is safe. A 403, or any other
// refusal, will not change on a second try and is not retried. The access
// token never reaches a log line, even when an error echoes it.

/**
 * The one scope the public Identity Toolkit v1 discovery document lists for
 * projects.accounts.update:
 * https://identitytoolkit.googleapis.com/$discovery/rest?version=v1
 * The document has no Identity Toolkit scope at all, so this is cloud-platform.
 * The app's `accessToken` must return a token for exactly this scope.
 */
export const ACCOUNTS_UPDATE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/** How long to wait before the retry after a 429, a 5xx or a failed request. */
export const RETRY_PAUSE_MS = 500;

export interface SessionRevokerOptions {
	/** The Firebase project whose account is signed out. */
	projectId: string | (() => string);
	/** True on a Firestore emulator run, which never calls out. */
	emulator: () => boolean;
	/** An OAuth access token for ACCOUNTS_UPDATE_SCOPE, cached by the app. */
	accessToken: () => Promise<string>;
	/** Drops a token Google refused, so the next `accessToken` mints a new one. */
	forgetAccessToken: (token: string) => void;
	/** For tests; the global fetch otherwise. */
	fetcher?: typeof fetch;
}

/** Signs every session of `uid` out as of `now`. True when Identity Toolkit accepted it. Never throws. */
export type RevokeSessions = (uid: string, now?: number) => Promise<boolean>;

type Attempt = 'done' | 'refused' | 'retry-now' | 'retry-later';

function pause(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function createSessionRevoker(options: SessionRevokerOptions): RevokeSessions {
	const { emulator, accessToken, forgetAccessToken } = options;

	/** One call to accounts:update. Never throws; the result says whether a retry could help. */
	async function attempt(url: string, uid: string, validSince: string): Promise<Attempt> {
		let token: string;
		try {
			token = await accessToken();
		} catch (e) {
			// The token exchange has its own retries; a second pass would only repeat them.
			console.error(`[phone-sign-in] revoking sessions failed: no access token (${messageOf(e)})`);
			return 'refused';
		}
		// Whatever a log line is built from passes through here first.
		const clean = (text: string) => (token ? text.split(token).join('[token]') : text);
		try {
			const response = await (options.fetcher ?? fetch)(url, {
				method: 'POST',
				headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
				body: JSON.stringify({ localId: uid, validSince })
			});
			if (response.ok) return 'done';
			console.error(
				`[phone-sign-in] revoking sessions failed (${response.status}): ${clean(await response.text().catch(() => ''))}`
			);
			if (response.status === 401) {
				// Google no longer accepts this token, so mint a new one instead of
				// reusing it until it expires.
				forgetAccessToken(token);
				return 'retry-now';
			}
			return response.status === 429 || response.status >= 500 ? 'retry-later' : 'refused';
		} catch (e) {
			console.error(`[phone-sign-in] revoking sessions failed: ${clean(messageOf(e))}`);
			return 'retry-later';
		}
	}

	return async (uid, now = Date.now()) => {
		if (emulator()) {
			console.warn('[phone-sign-in] emulator run: sessions not revoked');
			return false;
		}
		const projectId = typeof options.projectId === 'function' ? options.projectId() : options.projectId;
		const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`;
		// Whole seconds, rounded down, as the Admin SDK sends it.
		const validSince = String(Math.floor(now / 1000));

		let result = await attempt(url, uid, validSince);
		if (result === 'retry-later') {
			await pause(RETRY_PAUSE_MS);
			result = await attempt(url, uid, validSince);
		} else if (result === 'retry-now') {
			result = await attempt(url, uid, validSince);
		}
		return result === 'done';
	};
}
