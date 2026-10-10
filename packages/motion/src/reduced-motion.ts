import { DURATION } from './durations';

/** True when the reader asked for less motion. Safe on the server (false). */
export function reducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		((typeof document !== 'undefined' && document.documentElement?.dataset?.motionPreference === 'reduce') ||
			(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false))
	);
}

/** A duration that drops to zero under reduced motion. Read when a transition starts. */
export function motionDuration(ms: number): number {
	return reducedMotion() ? 0 : ms;
}

/** The duration for `animate:flip` on keyed lists. */
export function flipDuration(): number {
	return motionDuration(DURATION.normal);
}
