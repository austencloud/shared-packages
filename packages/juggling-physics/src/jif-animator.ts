// Converts JIF data into per-prop and per-hand movement sequences.
// Pure computation — returns positions/rotations per timestep, no rendering.

import { type Vec3, vec3, sub, scale } from './vec3.js';
import { type Quaternion, identity } from './quaternion.js';
import { ThrowTrajectory } from './trajectory.js';
import { CubicDwellCurve } from './dwell-curve.js';
import { LinearDwellCurve } from './dwell-curve.js';
import { Movement, type MovementSegment } from './movement.js';

export interface JIFData {
  timeStretchFactor: number;
  jugglers: { position: number[]; lookAt: number[] }[];
  limbs: { juggler: number; type: string }[];
  props: { color: string; type: string }[];
  throws: { time: number; duration: number; from: number; to: number; label?: string; prop?: number }[];
  repetition: { period?: number; limbPermutation?: number[] };
}

export interface JugglerLayout {
  position: Vec3;
  facing: Vec3;
  rightShoulder: Vec3;
  leftShoulder: Vec3;
  restRight: Vec3;
  restLeft: Vec3;
}

export interface AnimationFrame {
  props: { position: Vec3; rotation: Quaternion; color: string; type: string }[];
  hands: { juggler: number; side: 'right' | 'left'; position: Vec3 }[];
  time: number;
}

export interface AnimationConfig {
  beatsPerSecond?: number;
  dwellRatio?: number;
  shoulderWidth?: number;
  handHeight?: number;
  throwHeight?: number;
  gravity?: number;
}

const DEFAULT_CONFIG: Required<AnimationConfig> = {
  beatsPerSecond: 4,
  dwellRatio: 0.5,
  shoulderWidth: 0.25,
  handHeight: 1.0,
  throwHeight: 1.1,
  gravity: -9.81,
};

export class JIFAnimator {
  private propMovements: Movement[] = [];
  private handMovements: Map<string, Movement> = new Map();
  private periodSeconds: number;
  private jugglerLayouts: JugglerLayout[] = [];
  private jif: JIFData;
  private config: Required<AnimationConfig>;

  constructor(jif: JIFData, config?: AnimationConfig) {
    this.jif = jif;
    this.config = { ...DEFAULT_CONFIG, ...config };

    const period = jif.repetition.period ?? 1;
    const bps = this.config.beatsPerSecond / (jif.timeStretchFactor || 1);
    this.periodSeconds = period / bps;

    this.buildLayouts();
    this.buildMovements();
  }

  private buildLayouts(): void {
    for (const j of this.jif.jugglers) {
      const pos = vec3(j.position[0] ?? 0, j.position[1] ?? 0, j.position[2] ?? 0);
      const look = vec3(j.lookAt[0] ?? 0, j.lookAt[1] ?? 0, j.lookAt[2] ?? 0);
      const facing = sub(look, pos);
      const len = Math.sqrt(facing.x * facing.x + facing.z * facing.z) || 1;
      const norm = { x: facing.x / len, y: 0, z: facing.z / len };
      const right = { x: norm.z, y: 0, z: -norm.x };

      const sw = this.config.shoulderWidth;
      const hh = this.config.handHeight;
      const th = this.config.throwHeight;

      this.jugglerLayouts.push({
        position: pos,
        facing: norm,
        rightShoulder: vec3(pos.x + right.x * sw, pos.y + hh + 0.4, pos.z + right.z * sw),
        leftShoulder: vec3(pos.x - right.x * sw, pos.y + hh + 0.4, pos.z - right.z * sw),
        restRight: vec3(pos.x + right.x * sw * 0.8, pos.y + hh, pos.z + right.z * sw * 0.8),
        restLeft: vec3(pos.x - right.x * sw * 0.8, pos.y + hh, pos.z - right.z * sw * 0.8),
      });
    }
  }

  private limbPosition(limbIndex: number): Vec3 {
    const limb = this.jif.limbs[limbIndex];
    if (!limb) return vec3(0, 1, 0);
    const layout = this.jugglerLayouts[limb.juggler];
    if (!layout) return vec3(0, 1, 0);
    return limb.type.includes('right') ? layout.restRight : layout.restLeft;
  }

  private buildMovements(): void {
    const period = this.jif.repetition.period ?? 1;
    const bps = this.config.beatsPerSecond / (this.jif.timeStretchFactor || 1);
    const dwell = this.config.dwellRatio;

    for (let i = 0; i < this.jif.props.length; i++) {
      this.propMovements.push(new Movement(this.periodSeconds));
    }

    const throwsByProp = new Map<number, typeof this.jif.throws>();
    for (const t of this.jif.throws) {
      const propIdx = t.prop ?? 0;
      if (!throwsByProp.has(propIdx)) throwsByProp.set(propIdx, []);
      throwsByProp.get(propIdx)!.push(t);
    }

    for (const [propIdx, throws] of throwsByProp) {
      if (propIdx >= this.propMovements.length) continue;
      const movement = this.propMovements[propIdx];

      const sorted = [...throws].sort((a, b) => a.time - b.time);

      for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
        const throwPos = this.limbPosition(t.from);
        const catchPos = this.limbPosition(t.to);

        const throwTimeBeats = t.time + dwell;
        const catchTimeBeats = t.time + t.duration;
        const flightBeats = catchTimeBeats - throwTimeBeats;
        const flightSeconds = flightBeats / bps;
        const throwTimeSeconds = throwTimeBeats / bps;

        if (flightSeconds <= 0) continue;

        const trajectory = new ThrowTrajectory({
          throwPos: vec3(throwPos.x, throwPos.y + 0.1, throwPos.z),
          catchPos: vec3(catchPos.x, catchPos.y + 0.1, catchPos.z),
          flightTime: flightSeconds,
          gravity: this.config.gravity,
        });

        movement.addSegment({
          startTime: throwTimeSeconds % this.periodSeconds,
          duration: flightSeconds,
          sample: (st) => trajectory.sample(st),
        });

        const dwellSeconds = dwell / bps;
        const dwellStart = (t.time / bps) % this.periodSeconds;

        const dwellCurve = new CubicDwellCurve({
          catchPos,
          throwPos: vec3(throwPos.x, throwPos.y + 0.1, throwPos.z),
          duration: dwellSeconds,
        });

        movement.addSegment({
          startTime: dwellStart,
          duration: dwellSeconds,
          sample: (st) => ({ position: dwellCurve.sample(st) }),
        });
      }
    }

    for (const limb of this.jif.limbs) {
      const layout = this.jugglerLayouts[limb.juggler];
      if (!layout) continue;
      const side = limb.type.includes('right') ? 'right' : 'left';
      const key = `${limb.juggler}-${side}`;
      const restPos = side === 'right' ? layout.restRight : layout.restLeft;

      const handMovement = new Movement(this.periodSeconds);
      const handThrows = this.jif.throws.filter(
        (t) => this.jif.limbs[t.from]?.juggler === limb.juggler &&
               this.jif.limbs[t.from]?.type === limb.type
      );

      for (const t of handThrows) {
        const throwPos = this.limbPosition(t.from);
        const dwellSeconds = dwell / bps;
        const throwTimeSeconds = (t.time / bps) % this.periodSeconds;

        handMovement.addSegment({
          startTime: throwTimeSeconds,
          duration: dwellSeconds,
          sample: (st) => ({ position: throwPos }),
        });
      }

      this.handMovements.set(key, handMovement);
    }
  }

  sampleFrame(time: number): AnimationFrame {
    const t = ((time % this.periodSeconds) + this.periodSeconds) % this.periodSeconds;

    const props = this.propMovements.map((movement, i) => {
      const state = movement.sample(t);
      const propDef = this.jif.props[i] ?? { color: '#ff0000', type: 'ball' };
      return {
        position: state.position,
        rotation: state.rotation,
        color: propDef.color,
        type: propDef.type,
      };
    });

    const hands: AnimationFrame['hands'] = [];
    for (const [key, movement] of this.handMovements) {
      const [jugglerStr, side] = key.split('-');
      const state = movement.sample(t);
      hands.push({
        juggler: parseInt(jugglerStr),
        side: side as 'right' | 'left',
        position: state.position,
      });
    }

    return { props, hands, time: t };
  }

  get period(): number {
    return this.periodSeconds;
  }

  get propCount(): number {
    return this.propMovements.length;
  }

  get jugglerCount(): number {
    return this.jugglerLayouts.length;
  }

  getJugglerLayout(index: number): JugglerLayout | undefined {
    return this.jugglerLayouts[index];
  }
}
