import type { PropState3D } from "../models/PropState3D";
import type { Plane } from "../enums/Plane";
import type { PlaneMode } from "../enums/PlaneMode";

export interface BeatPlaneOverride {
	blue?: Plane;
	red?: Plane;
}

export interface AvatarInstanceState {
	id: string;
	bluePropState: PropState3D | null;
	redPropState: PropState3D | null;
	planeMode: PlaneMode;
	beatPlaneOverrides: Map<number, BeatPlaneOverride>;
	hasSequence: boolean;
	totalSteps: number;
	currentStepIndex: number;
	progress: number;
	snapFacingAngle(angle: number): void;
}
