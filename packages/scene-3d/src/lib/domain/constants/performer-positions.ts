import { STAGE } from "../../scale/scale-constants";

export interface PerformerPosition {
  x: number;
  z: number;
}

const GRID_SPACING = STAGE.PERFORMER_SPACING;

export const WALL_OFFSET = -STAGE.AVATAR_GRID_OFFSET;

export function getDefaultPositions(count: number): PerformerPosition[] {
  if (count <= 0) return [];
  if (count > 8) count = 8;

  if (count === 1) {
    return [{ x: 0, z: WALL_OFFSET }];
  }

  const positions: PerformerPosition[] = [];
  const lastRow = Math.floor((count - 1) / 2);
  const lastRowIsSingleton = count % 2 === 1;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const rowZ = -row * GRID_SPACING + WALL_OFFSET;

    if (row === lastRow && lastRowIsSingleton) {
      positions.push({ x: 0, z: rowZ });
    } else {
      positions.push({
        x: (col === 0 ? -1 : 1) * (GRID_SPACING / 2),
        z: rowZ,
      });
    }
  }

  return positions;
}

export function getPerformerPosition(
  index: number,
  totalCount: number
): PerformerPosition {
  const positions = getDefaultPositions(totalCount);
  return positions[index] ?? { x: 0, z: 0 };
}

export const PERFORMER_GRID_SPACING = STAGE.PERFORMER_SPACING;

export const MAX_PERFORMERS = STAGE.MAX_PERFORMERS;
