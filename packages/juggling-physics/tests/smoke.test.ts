import { describe, it, expect } from 'vitest';
import {
  vec3, add, sub, scale, lerp, length, distance, normalize, dot, cross,
  identity, fromAxisAngle, slerp, multiply,
  GRAVITY, ThrowTrajectory, BounceTrajectory,
  CubicDwellCurve, CircularDwellCurve, LinearDwellCurve,
  solveIK2Link,
  Movement,
  JIFAnimator,
  type JIFData,
} from '../src/index.js';

const approx = (v: number, expected: number, tol = 1e-6) =>
  expect(v).toBeCloseTo(expected, -Math.log10(tol));

describe('Vec3', () => {
  it('add / sub / scale', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    expect(add(a, b)).toEqual(vec3(5, 7, 9));
    expect(sub(b, a)).toEqual(vec3(3, 3, 3));
    expect(scale(a, 2)).toEqual(vec3(2, 4, 6));
  });

  it('lerp', () => {
    const a = vec3(0, 0, 0);
    const b = vec3(10, 10, 10);
    const mid = lerp(a, b, 0.5);
    expect(mid).toEqual(vec3(5, 5, 5));
  });

  it('length / distance', () => {
    approx(length(vec3(3, 4, 0)), 5);
    approx(distance(vec3(0, 0, 0), vec3(1, 0, 0)), 1);
  });

  it('normalize', () => {
    const n = normalize(vec3(0, 0, 5));
    approx(n.z, 1);
    approx(length(n), 1);
  });

  it('normalize zero vector', () => {
    const n = normalize(vec3(0, 0, 0));
    expect(n).toEqual(vec3(0, 0, 0));
  });

  it('dot / cross', () => {
    approx(dot(vec3(1, 0, 0), vec3(0, 1, 0)), 0);
    approx(dot(vec3(1, 0, 0), vec3(1, 0, 0)), 1);
    const c = cross(vec3(1, 0, 0), vec3(0, 1, 0));
    approx(c.z, 1);
    approx(c.x, 0);
    approx(c.y, 0);
  });
});

describe('Quaternion', () => {
  it('identity', () => {
    const q = identity();
    expect(q).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('fromAxisAngle 90deg around Y', () => {
    const q = fromAxisAngle(vec3(0, 1, 0), Math.PI / 2);
    approx(q.y, Math.sin(Math.PI / 4));
    approx(q.w, Math.cos(Math.PI / 4));
  });

  it('slerp endpoints', () => {
    const a = identity();
    const b = fromAxisAngle(vec3(0, 1, 0), Math.PI);
    const start = slerp(a, b, 0);
    const end = slerp(a, b, 1);
    approx(start.w, a.w);
    approx(end.y, b.y, 1e-4);
  });

  it('multiply identity', () => {
    const q = fromAxisAngle(vec3(1, 0, 0), 0.5);
    const r = multiply(q, identity());
    approx(r.x, q.x);
    approx(r.w, q.w);
  });
});

describe('ThrowTrajectory', () => {
  it('starts and ends at correct positions', () => {
    const throwPos = vec3(0, 1, 0);
    const catchPos = vec3(0.5, 1, 0);
    const traj = new ThrowTrajectory({ throwPos, catchPos, flightTime: 0.5 });

    const start = traj.sample(0);
    approx(start.position.x, 0);
    approx(start.position.y, 1);

    const end = traj.sample(1);
    approx(end.position.x, 0.5);
    approx(end.position.y, 1, 1e-3);
  });

  it('peak is above endpoints for upward throw', () => {
    const traj = new ThrowTrajectory({
      throwPos: vec3(0, 1, 0),
      catchPos: vec3(0, 1, 0),
      flightTime: 1.0,
    });
    expect(traj.peakHeight).toBeGreaterThan(1);
  });

  it('midpoint is highest for symmetric throw', () => {
    const traj = new ThrowTrajectory({
      throwPos: vec3(0, 1, 0),
      catchPos: vec3(0, 1, 0),
      flightTime: 1.0,
    });
    const mid = traj.sample(0.5);
    const quarter = traj.sample(0.25);
    expect(mid.position.y).toBeGreaterThan(quarter.position.y);
  });

  it('initialVelocity computed correctly', () => {
    const traj = new ThrowTrajectory({
      throwPos: vec3(0, 0, 0),
      catchPos: vec3(10, 0, 0),
      flightTime: 2.0,
    });
    approx(traj.initialVelocity.x, 5);
  });

  it('GRAVITY constant', () => {
    expect(GRAVITY).toBe(-9.81);
  });
});

describe('BounceTrajectory', () => {
  it('bounces off floor', () => {
    const traj = new BounceTrajectory({
      throwPos: vec3(0, 2, 0),
      catchPos: vec3(0, 2, 0),
      flightTime: 2.0,
      restitution: 0.8,
      floorY: 0,
      gravity: -9.81,
    });
    const mid = traj.sample(0.5);
    expect(mid.position.y).toBeGreaterThanOrEqual(0);
  });

  it('stays above floor', () => {
    const traj = new BounceTrajectory({
      throwPos: vec3(0, 0.5, 0),
      catchPos: vec3(1, 0.5, 0),
      flightTime: 1.0,
      restitution: 0.5,
      floorY: 0,
    });
    for (let t = 0; t <= 1; t += 0.1) {
      expect(traj.sample(t).position.y).toBeGreaterThanOrEqual(-0.01);
    }
  });
});

describe('CubicDwellCurve', () => {
  it('starts at catchPos and ends at throwPos', () => {
    const curve = new CubicDwellCurve({
      catchPos: vec3(0, 1, 0),
      throwPos: vec3(0.5, 1.1, 0),
      duration: 0.2,
    });
    const start = curve.sample(0);
    const end = curve.sample(1);
    approx(start.x, 0);
    approx(start.y, 1);
    approx(end.x, 0.5);
    approx(end.y, 1.1);
  });
});

describe('CircularDwellCurve', () => {
  it('traces arc at correct radius', () => {
    const center = vec3(0, 1, 0);
    const radius = 0.3;
    const curve = new CircularDwellCurve({
      center,
      radius,
      startAngle: 0,
      endAngle: Math.PI,
    });
    const p = curve.sample(0.5);
    const d = distance(p, center);
    approx(d, radius, 1e-4);
  });
});

describe('LinearDwellCurve', () => {
  it('lerps between endpoints', () => {
    const curve = new LinearDwellCurve(vec3(0, 0, 0), vec3(10, 0, 0));
    const mid = curve.sample(0.5);
    approx(mid.x, 5);
  });
});

describe('IK Solver', () => {
  it('reaches target within arm length', () => {
    const result = solveIK2Link(
      vec3(0, 2, 0),
      vec3(0, 1.5, 0.3),
      { upperLength: 0.6, lowerLength: 0.5 },
    );
    expect(result.reachable).toBe(true);
    approx(result.handPos.x, 0);
    approx(result.handPos.y, 1.5);
    approx(result.handPos.z, 0.3);
  });

  it('marks unreachable target', () => {
    const result = solveIK2Link(
      vec3(0, 2, 0),
      vec3(0, 2, 5),
      { upperLength: 0.3, lowerLength: 0.3 },
    );
    expect(result.reachable).toBe(false);
  });

  it('elbow is between shoulder and hand', () => {
    const result = solveIK2Link(
      vec3(0, 2, 0),
      vec3(0, 1.2, 0.3),
      { upperLength: 0.5, lowerLength: 0.5 },
    );
    expect(result.reachable).toBe(true);
    const upperLen = distance(result.shoulderPos, result.elbowPos);
    const lowerLen = distance(result.elbowPos, result.handPos);
    approx(upperLen, 0.5, 1e-3);
    approx(lowerLen, 0.5, 1e-3);
  });
});

describe('Movement', () => {
  it('samples within segment', () => {
    const m = new Movement(2.0);
    m.addSegment({
      startTime: 0.5,
      duration: 1.0,
      sample: (t) => ({ position: vec3(t, 0, 0) }),
    });
    const state = m.sample(1.0);
    approx(state.position.x, 0.5);
  });

  it('wraps time around period', () => {
    const m = new Movement(1.0);
    m.addSegment({
      startTime: 0,
      duration: 0.5,
      sample: (t) => ({ position: vec3(t * 10, 0, 0) }),
    });
    const a = m.sample(0.25);
    const b = m.sample(1.25);
    approx(a.position.x, b.position.x);
  });

  it('returns last segment end when outside all segments', () => {
    const m = new Movement(2.0);
    m.addSegment({
      startTime: 0,
      duration: 0.5,
      sample: (t) => ({ position: vec3(t, 0, 0) }),
    });
    const state = m.sample(1.5);
    approx(state.position.x, 1);
  });

  it('returns zero with no segments', () => {
    const m = new Movement(1.0);
    const state = m.sample(0.5);
    expect(state.position).toEqual(vec3(0, 0, 0));
  });

  it('segmentCount and duration', () => {
    const m = new Movement(3.0);
    expect(m.segmentCount).toBe(0);
    expect(m.duration).toBe(3.0);
    m.addSegment({ startTime: 0, duration: 1, sample: () => ({ position: vec3(0, 0, 0) }) });
    expect(m.segmentCount).toBe(1);
  });
});

describe('JIFAnimator', () => {
  const simpleJIF: JIFData = {
    timeStretchFactor: 1,
    jugglers: [{ position: [0, 0, 0], lookAt: [0, 0, 1] }],
    limbs: [
      { juggler: 0, type: 'right hand' },
      { juggler: 0, type: 'left hand' },
    ],
    props: [
      { color: '#ff0000', type: 'ball' },
      { color: '#00ff00', type: 'ball' },
      { color: '#0000ff', type: 'ball' },
    ],
    throws: [
      { time: 0, duration: 3, from: 0, to: 1, prop: 0 },
      { time: 1, duration: 3, from: 1, to: 0, prop: 1 },
      { time: 2, duration: 3, from: 0, to: 1, prop: 2 },
    ],
    repetition: { period: 3 },
  };

  it('constructs without error', () => {
    const anim = new JIFAnimator(simpleJIF);
    expect(anim.propCount).toBe(3);
    expect(anim.jugglerCount).toBe(1);
  });

  it('period matches', () => {
    const anim = new JIFAnimator(simpleJIF, { beatsPerSecond: 4 });
    approx(anim.period, 3 / 4);
  });

  it('sampleFrame returns correct prop count', () => {
    const anim = new JIFAnimator(simpleJIF);
    const frame = anim.sampleFrame(0);
    expect(frame.props.length).toBe(3);
    expect(frame.props[0].color).toBe('#ff0000');
    expect(frame.props[0].type).toBe('ball');
  });

  it('sampleFrame returns hand positions', () => {
    const anim = new JIFAnimator(simpleJIF);
    const frame = anim.sampleFrame(0);
    expect(frame.hands.length).toBeGreaterThan(0);
    expect(frame.hands[0].side).toMatch(/right|left/);
  });

  it('animation loops cleanly', () => {
    const anim = new JIFAnimator(simpleJIF);
    const f1 = anim.sampleFrame(0);
    const f2 = anim.sampleFrame(anim.period);
    approx(f1.props[0].position.x, f2.props[0].position.x, 1e-3);
    approx(f1.props[0].position.y, f2.props[0].position.y, 1e-3);
  });

  it('getJugglerLayout', () => {
    const anim = new JIFAnimator(simpleJIF);
    const layout = anim.getJugglerLayout(0);
    expect(layout).toBeDefined();
    expect(layout!.position).toBeDefined();
    expect(anim.getJugglerLayout(99)).toBeUndefined();
  });

  it('custom config overrides defaults', () => {
    const anim = new JIFAnimator(simpleJIF, { beatsPerSecond: 2, gravity: -5 });
    approx(anim.period, 3 / 2);
  });
});
