/** True when the browser can run view transitions. Safe on the server (false). */
export function supportsViewTransitions(): boolean {
	return typeof document !== 'undefined' && 'startViewTransition' in document;
}
