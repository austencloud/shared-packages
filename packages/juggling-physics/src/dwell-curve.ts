// Dwell paths: curves describing prop motion while held in hand.
// Cubic spline for smooth catch-to-throw transition.
// Circular arc for mills mess / factory style patterns.

import { type Vec3, vec3, lerp, add, scale, sub, normalize, cross, length } from './vec3.js';

export interface DwellParams {
  catchPos: Vec3;
  throwPos: Vec3;
  catchVelocity?: Vec3;
  throwVelocity?: Vec3;
  duration: number;
}

export class CubicDwellCurve {
  private p0: Vec3;
  private p1: Vec3;
  private p2: Vec3;
  private p3: Vec3;

  constructor(params: DwellParams) {
    const cv = params.catchVelocity ?? vec3(0, 0, 0);
    const tv = params.throwVelocity ?? vec3(0, 0, 0);
    const dampedDuration = params.duration * 0.33;

    this.p0 = params.catchPos;
    this.p1 = add(params.catchPos, scale(cv, dampedDuration));
    this.p2 = sub(params.throwPos, scale(tv, dampedDuration));
    this.p3 = params.throwPos;
  }

  sample(t: number): Vec3 {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;
    return vec3(
      uu * u * this.p0.x + 3 * uu * t * this.p1.x + 3 * u * tt * this.p2.x + tt * t * this.p3.x,
      uu * u * this.p0.y + 3 * uu * t * this.p1.y + 3 * u * tt * this.p2.y + tt * t * this.p3.y,
      uu * u * this.p0.z + 3 * uu * t * this.p1.z + 3 * u * tt * this.p2.z + tt * t * this.p3.z,
    );
  }
}

export interface CircularDwellParams {
  center: Vec3;
  radius: number;
  startAngle: number;
  endAngle: number;
  normal?: Vec3;
}

export class CircularDwellCurve {
  private center: Vec3;
  private radius: number;
  private startAngle: number;
  private sweep: number;
  private u: Vec3;
  private v: Vec3;

  constructor(params: CircularDwellParams) {
    this.center = params.center;
    this.radius = params.radius;
    this.startAngle = params.startAngle;
    this.sweep = params.endAngle - params.startAngle;

    const normal = params.normal ?? vec3(0, 0, 1);
    const up = Math.abs(normal.y) > 0.99 ? vec3(1, 0, 0) : vec3(0, 1, 0);
    this.u = normalize(cross(up, normal));
    this.v = normalize(cross(normal, this.u));
  }

  sample(t: number): Vec3 {
    const angle = this.startAngle + this.sweep * t;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return vec3(
      this.center.x + this.radius * (cos * this.u.x + sin * this.v.x),
      this.center.y + this.radius * (cos * this.u.y + sin * this.v.y),
      this.center.z + this.radius * (cos * this.u.z + sin * this.v.z),
    );
  }
}

export class LinearDwellCurve {
  constructor(private from: Vec3, private to: Vec3) {}

  sample(t: number): Vec3 {
    return lerp(this.from, this.to, t);
  }
}
