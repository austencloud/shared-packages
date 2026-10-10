/**
 * Page changes for a SvelteKit app in one call from the root layout:
 *
 *   installRouteMotion({ routes: RECORD_ROUTES, onNavigate });
 *
 * The page area (`data-route-content`) fades, and a clicked record box
 * (`data-record="kind:id"`) morphs into the page header that carries the
 * same `data-record-target`. Back reverses it. A query-only change is the
 * page's own motion. Reduced motion and browsers without view transitions
 * get the plain swap. Styles: css/route-transitions.css.
 */
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
	return (navigation: NavigationLike): Promise<void> | undefined => {
		if (typeof window === 'undefined') return;
		const toRecord = recordOf(navigation.to);
		const fromRecord = recordOf(navigation.from);
		const forward = toRecord ? clickedRecord(toRecord) : null;
		const backward = !forward && fromRecord ? recordTarget(fromRecord) : null;
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

let tracking = false;

/**
 * Call once from the root layout's script, during component init (SvelteKit's
 * onNavigate requires that). Pass SvelteKit's `onNavigate` from `$app/navigation`.
 */
export function installRouteMotion(options: {
	routes: RecordRoutes;
	onNavigate: (callback: (navigation: NavigationLike) => Promise<void> | undefined) => void;
}): void {
	if (typeof document !== 'undefined' && !tracking) {
		tracking = true;
		trackRecordClicks(document);
	}
	options.onNavigate(routeMotionHandler(options.routes));
}
