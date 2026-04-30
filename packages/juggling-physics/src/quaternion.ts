import { type Vec3, normalize } from './vec3.js';

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function identity(): Quaternion {
  return { x: 0, y: 0, z: 0, w: 1 };
}

export function fromAxisAngle(axis: Vec3, angle: number): Quaternion {
  const half = angle / 2;
  const s = Math.sin(half);
  const a = normalize(axis);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(half) };
}

export function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  if (d < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
    d = -d;
  }

  if (d > 0.9995) {
    return normalizeQ({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    });
  }

  const theta = Math.acos(d);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  return {
    x: a.x * wa + bx * wb,
    y: a.y * wa + by * wb,
    z: a.z * wa + bz * wb,
    w: a.w * wa + bw * wb,
  };
}

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function normalizeQ(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (len === 0) return identity();
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}
