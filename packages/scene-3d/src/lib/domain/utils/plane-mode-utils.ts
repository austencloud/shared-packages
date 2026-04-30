import { Plane } from "../enums/Plane";
import { PlaneMode } from "../enums/PlaneMode";

export function derivePlaneModeFromHands(bluePlane: Plane, redPlane: Plane): PlaneMode {
	if (bluePlane === Plane.WALL && redPlane === Plane.WALL) return PlaneMode.WALL;
	if (bluePlane === Plane.WHEEL && redPlane === Plane.WHEEL) return PlaneMode.DUAL_WHEEL;
	return PlaneMode.CUSTOM;
}
