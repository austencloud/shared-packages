/**
 * Page changes for a SvelteKit app in one call from the root layout:
 *
 *   installRouteMotion({ routes: RECORD_ROUTES, onNavigate });
 *
 * The page area (`data-route-content`) fades, and a clicked record box
 * (`data-record="kind:id"`) morphs into the page header that carries the
 * same `data-record-target`. Going back to the page that box was on reverses
 * it; any other page change from a record page fades. A query-only change is the
 * page's own motion. Reduced motion and browsers without view transitions
 * get the plain swap. Styles: css/route-transitions.css.
 */
import { onMount } from 'svelte';
import { reducedMotion } from './reduced-motion';
import { createRecordResolver, decideRouteMotion, type RecordRoutes, type RouteTarget } from './route-morph';
import { clickedRecord, recordTarget, runRouteTransition, trackRecordClicks, visibleRecord } from './record-morph';
import { supportsViewTransitions } from './view-transitions';

export interface NavigationLike {
	from: (RouteTarget & { url: URL }) | null;
	to: (RouteTarget & { url: URL }) | null;
	complete: Promise<void>;
}

/** The `onNavigate` callback. Exported for tests; apps call installRouteMotion. */
export function routeMotionHandler(routes: RecordRoutes) {
	const recordOf = createRecordResolver(routes);
	// The page each record was opened from by a box click. Only the way back to
	// that page morphs the header into a box: any other page (a form, a sibling
	// record) may hold no box for it, and a header named with nowhere to go
	// lifts its photo above its own headline for the whole fade.
	const openedFrom = new Map<string, string>();
	return (navigation: NavigationLike): Promise<void> | undefined => {
		if (typeof window === 'undefined') return;
		const toRecord = recordOf(navigation.to);
		const fromRecord = recordOf(navigation.from);
		const forward = toRecord ? clickedRecord(toRecord) : null;
		if (forward && navigation.from) openedFrom.set(toRecord!, navigation.from.url.pathname);
		const returning = !!fromRecord && openedFrom.get(fromRecord) === navigation.to?.url.pathname;
		const backward = !forward && returning ? recordTarget(fromRecord!) : null;
		const motion = decideRouteMotion({
			fromPath: navigation.from?.url.pathname,
			toPath: navigation.to?.url.pathname,
			supported: supportsViewTransitions(),
			reduced: reducedMotion(),
			hasSource: !!(forward || backward)
		});
		if (motion === 'none') return;
		const source = forward ?? backward;
		return runRouteTransition(
			navigation.complete,
			motion === 'morph' && source
				? {
						source,
						destination: () => (forward ? recordTarget(toRecord!) : visibleRecord(fromRecord!))
					}
				: null
		);
	};
}

/**
 * Call once from the root layout's script, during component init (SvelteKit's
 * onNavigate and Svelte's onMount both require that). Pass SvelteKit's
 * `onNavigate` from `$app/navigation`. The click listener behind the record
 * morphs is removed when the component unmounts.
 */
export function installRouteMotion(options: {
	routes: RecordRoutes;
	onNavigate: (callback: (navigation: NavigationLike) => Promise<void> | undefined) => void;
}): void {
	onMount(() => trackRecordClicks(document));
	options.onNavigate(routeMotionHandler(options.routes));
}
