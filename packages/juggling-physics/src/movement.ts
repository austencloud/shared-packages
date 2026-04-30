// Curve sequencer: chains multiple trajectory/dwell segments into a looping animation.
// Each segment has a start time and duration within the period.

import { type Vec3, vec3 } from './vec3.js';
import { type Quaternion, identity } from './quaternion.js';

export interface MovementSegment {
  startTime: number;
  duration: number;
  sample: (t: number) => { position: Vec3; rotation?: Quaternion };
}

export class Movement {
  private segments: MovementSegment[] = [];
  private periodDuration: number;

  constructor(periodDuration: number) {
    this.periodDuration = periodDuration;
  }

  addSegment(segment: MovementSegment): void {
    this.segments.push(segment);
    this.segments.sort((a, b) => a.startTime - b.startTime);
  }

  sample(time: number): { position: Vec3; rotation: Quaternion } {
    const t = ((time % this.periodDuration) + this.periodDuration) % this.periodDuration;

    for (const seg of this.segments) {
      const end = seg.startTime + seg.duration;
      if (t >= seg.startTime && t < end) {
        const localT = (t - seg.startTime) / seg.duration;
        const result = seg.sample(localT);
        return {
          position: result.position,
          rotation: result.rotation ?? identity(),
        };
      }
    }

    if (this.segments.length > 0) {
      const last = this.segments[this.segments.length - 1];
      const result = last.sample(1);
      return { position: result.position, rotation: result.rotation ?? identity() };
    }

    return { position: vec3(0, 0, 0), rotation: identity() };
  }

  get duration(): number {
    return this.periodDuration;
  }

  get segmentCount(): number {
    return this.segments.length;
  }
}
