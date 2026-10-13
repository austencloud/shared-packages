/**
 * Decides how a page change moves. Pure, so the rules are tested apart from
 * the browser's view transitions (record-morph.ts runs them).
 */

/** Route ids of pages that show one record, with the params naming it. */
export type RecordRoutes = Record<string, { kind: string; params: readonly string[] }>;

export interface RouteTarget {
	route: { id: string | null };
	params: Record<string, string> | null;
}

/**
 * Returns `recordOf(target)`: `kind:value` (several params joined by `/`) for
 * a record page, else null. The value matches the `data-record` attribute on
 * the boxes that open that page.
 */
export function createRecordResolver(routes: RecordRoutes) {
	return function recordOf(target: RouteTarget | null | undefined): string | null {
		const entry = target?.route.id ? routes[target.route.id] : undefined;
		if (!entry) return null;
		const values = entry.params.map((param) => target?.params?.[param]);
		if (values.some((value) => !value)) return null;
		return `${entry.kind}:${values.join('/')}`;
	};
}

export type RouteMotion = 'none' | 'fade' | 'morph';

export function decideRouteMotion(input: {
	fromPath: string | undefined;
	toPath: string | undefined;
	supported: boolean;
	reduced: boolean;
	/** A record box on the old page that should morph into the new one. */
	hasSource: boolean;
}): RouteMotion {
	if (!input.supported || input.reduced) return 'none';
	// A query-only change is the page's own business (a filter, a picked row).
	if (!input.fromPath || !input.toPath || input.fromPath === input.toPath) return 'none';
	return input.hasSource ? 'morph' : 'fade';
}
