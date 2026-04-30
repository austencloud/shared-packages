import type { PropState, PropColor } from '../../domain/types.js';

export interface Prop3DProps {
  propState: PropState;
  color: PropColor;
  visible?: boolean;
  scale?: number;
}
