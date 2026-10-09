/**
 * Structural equality; `undefined` properties are treated as absent.
 * Copied from tka's `viewer-url-state-codec.ts`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== "object" || typeof b !== "object") return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}
	const aKeys = Object.keys(a as object).filter(
		(k) => (a as Record<string, unknown>)[k] !== undefined,
	);
	const bKeys = Object.keys(b as object).filter(
		(k) => (b as Record<string, unknown>)[k] !== undefined,
	);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((k) =>
		deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
	);
}
