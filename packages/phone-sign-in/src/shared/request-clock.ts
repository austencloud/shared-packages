// How old a request is and how long it has left, as the phone shows them.
//
// The server measures both when it answers (`ageMs`, `expiresInMs`), so the
// phone's own clock only has to count the time since the answer arrived. A
// phone whose clock is wrong by minutes still shows the right age and expires
// the page at the right moment. A clock set back never runs the count in
// reverse.

export interface ServerMeasured {
	/** How long ago the request was made, by the server's clock, when it answered. */
	ageMs: number;
	/** How long until it expires, by the server's clock, when it answered. */
	expiresInMs: number;
}

/** Time this phone has held the answer, never negative. */
function sinceArrival(loadedAt: number, now: number): number {
	return Math.max(0, now - loadedAt);
}

/** How long ago the request was made. */
export function askedAgoMs(request: ServerMeasured, loadedAt: number, now: number): number {
	return request.ageMs + sinceArrival(loadedAt, now);
}

/** True once the request's time ran out, counting from when the answer arrived. */
export function hasExpired(request: ServerMeasured, loadedAt: number, now: number): boolean {
	return sinceArrival(loadedAt, now) >= request.expiresInMs;
}

/** "5 seconds", "1 minute": whole units, rounded down. */
export function ageLabel(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
