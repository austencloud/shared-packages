/**
 * The AustenCloud motion clock, shared by Ringmaster, the Cirque Aflame website and the Flow Arts Composer.
 * Feature code picks a token here; it never writes its own milliseconds.
 */
export const DURATION = {
	/** Hover, press and toggle feedback. */
	instant: 100,
	/** Small controls and badges. */
	fast: 150,
	/** Panels, tabs, rows and list changes. */
	normal: 200,
	/** A page's content arriving, a whole region changing. */
	emphasis: 280,
	/** A record morphing into its page, drawers and sheets. */
	dramatic: 350,
	/** A whole scene moving. Never a control or panel. */
	scene: 800
} as const;

export const STAGGER = {
	micro: 30,
	normal: 50,
	relaxed: 80
} as const;

export const SLIDE = {
	sm: 8,
	md: 12,
	lg: 20
} as const;

export const EASE_STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const EASE_STANDARD_OUT = 'cubic-bezier(0, 0, 0.2, 1)';
export const EASE_STANDARD_IN = 'cubic-bezier(0.4, 0, 1, 1)';

/** Sideways drift for a stepped swap, such as the list-detail panel. */
export const STEP_DRIFT_PX = 12;
