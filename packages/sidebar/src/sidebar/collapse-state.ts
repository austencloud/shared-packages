/**
 * collapse-state.ts - localStorage persistence for sidebar collapse state
 *
 * Reads/writes a boolean to localStorage under a configurable key.
 * Returns false (expanded) if no key is provided or localStorage is unavailable.
 */

export function readCollapseState(storageKey: string | null): boolean {
	if (!storageKey) return false;
	if (typeof localStorage === 'undefined') return false;

	try {
		const stored = localStorage.getItem(storageKey);
		return stored === 'true';
	} catch {
		return false;
	}
}

export function writeCollapseState(storageKey: string | null, collapsed: boolean): void {
	if (!storageKey) return;
	if (typeof localStorage === 'undefined') return;

	try {
		localStorage.setItem(storageKey, String(collapsed));
	} catch {
		// Silently fail if storage is full or unavailable
	}
}
