// Parabolic ballistic trajectory under constant gravity.
// s = ut + ½at², v = u + at

import { type Vec3, vec3 } from './vec3.js';
import { type Quaternion, identity, fromAxisAngle, slerp } from './quaternion.js';

export const GRAVITY = -9.81; // m/s²

export interface TrajectoryParams {
  throwPos: Vec3;
  catchPos: Vec3;
  flightTime: number;
  gravity?: number;
  spinAxis?: Vec3;
  spinCount?: number;
  throwAngle?: number;
  catchAngle?: number;
}

export interface TrajectoryState {
  position: Vec3;
  rotation: Quaternion;
}

export class ThrowTrajectory {
  private throwPos: Vec3;
  private catchPos: Vec3;
  private flightTime: number;
  private gravity: number;
  private v0: Vec3;
  private spinAxis: Vec3;
  private spinCount: number;
  private throwAngle: number;
  private totalSpin: number;
  private throwRotation: Quaternion;

  constructor(params: TrajectoryParams) {
    this.throwPos = params.throwPos;
    this.catchPos = params.catchPos;
    this.flightTime = params.flightTime;
    this.gravity = params.gravity ?? GRAVITY;
    this.spinAxis = params.spinAxis ?? vec3(1, 0, 0);
    this.spinCount = params.spinCount ?? 0;
    this.throwAngle = params.throwAngle ?? 0;
    const catchAngle = params.catchAngle ?? 0;
    this.totalSpin = catchAngle - this.throwAngle + this.spinCount * Math.PI * 2;

    const t = this.flightTime;
    this.v0 = vec3(
      (this.catchPos.x - this.throwPos.x) / t,
      (this.catchPos.y - this.throwPos.y - 0.5 * this.gravity * t * t) / t,
      (this.catchPos.z - this.throwPos.z) / t,
    );

    this.throwRotation = fromAxisAngle(this.spinAxis, this.throwAngle);
  }

  sample(t: number): TrajectoryState {
    const dt = t * this.flightTime;

    const position = vec3(
      this.throwPos.x + this.v0.x * dt,
      this.throwPos.y + this.v0.y * dt + 0.5 * this.gravity * dt * dt,
      this.throwPos.z + this.v0.z * dt,
    );

    const currentAngle = this.throwAngle + this.totalSpin * t;
    const rotation = fromAxisAngle(this.spinAxis, currentAngle);

    return { position, rotation };
  }

  get peakHeight(): number {
    if (this.v0.y <= 0) return this.throwPos.y;
    const tPeak = -this.v0.y / this.gravity;
    if (tPeak > this.flightTime) return this.throwPos.y + this.v0.y * this.flightTime + 0.5 * this.gravity * this.flightTime * this.flightTime;
    return this.throwPos.y + this.v0.y * tPeak + 0.5 * this.gravity * tPeak * tPeak;
  }

  get initialVelocity(): Vec3 {
    return { ...this.v0 };
  }
}

export class BounceTrajectory {
  private throwPos: Vec3;
  private v0: Vec3;
  private gravity: number;
  private restitution: number;
  private floorY: number;
  private flightTime: number;

  constructor(params: TrajectoryParams & { restitution?: number; floorY?: number }) {
    this.throwPos = params.throwPos;
    this.flightTime = params.flightTime;
    this.gravity = params.gravity ?? GRAVITY;
    this.restitution = params.restitution ?? 0.8;
    this.floorY = params.floorY ?? 0;

    const t = params.flightTime;
    this.v0 = vec3(
      (params.catchPos.x - params.throwPos.x) / t,
      (params.catchPos.y - params.throwPos.y - 0.5 * this.gravity * t * t) / t,
      (params.catchPos.z - params.throwPos.z) / t,
    );
  }

  sample(t: number): TrajectoryState {
    const totalTime = t * this.flightTime;
    let y = this.throwPos.y;
    let vy = this.v0.y;
    let elapsed = 0;
    const dt = 0.001;

    while (elapsed < totalTime) {
      const step = Math.min(dt, totalTime - elapsed);
      y += vy * step + 0.5 * this.gravity * step * step;
      vy += this.gravity * step;

      if (y <= this.floorY && vy < 0) {
        y = this.floorY;
        vy = -vy * this.restitution;
      }

      elapsed += step;
    }

    const x = this.throwPos.x + this.v0.x * totalTime;
    const z = this.throwPos.z + this.v0.z * totalTime;

    return { position: vec3(x, y, z), rotation: identity() };
  }
}
