/**
 * localStorage persistence for the sidebar's pinned (rail<->pinned) state.
 * key === null disables persistence: read returns the fallback, write no-ops.
 * Guards `typeof localStorage` so it is SSR-safe.
 */
export function readPinState(key: string | null, fallback: boolean): boolean {
  if (!key || typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

export function writePinState(key: string | null, pinned: boolean): void {
  if (!key || typeof localStorage === 'undefined') return;
  localStorage.setItem(key, pinned ? 'true' : 'false');
}
