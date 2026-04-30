export const RotationDirection = {
	CLOCKWISE: "cw",
	COUNTER_CLOCKWISE: "ccw",
	NO_ROTATION: "noRotation",
} as const;

export type RotationDirection =
	(typeof RotationDirection)[keyof typeof RotationDirection];
