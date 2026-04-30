import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';

describe('IKSolver', () => {
  it('can be instantiated', async () => {
    const { IKSolver } = await import('../src/lib/services/IKSolver');
    const solver = new IKSolver();
    expect(solver).toBeDefined();
  });

  it('provides humanoid constraints', async () => {
    const { IKSolver } = await import('../src/lib/services/IKSolver');
    const solver = new IKSolver();
    const constraints = solver.getHumanoidConstraints();
    expect(constraints.leftElbow).toBeDefined();
    expect(constraints.rightElbow).toBeDefined();
    expect(constraints.leftKnee).toBeDefined();
    expect(constraints.rightKnee).toBeDefined();
  });
});

describe('ClavicleRaiser', () => {
  it('returns identity when hand is below shoulder', async () => {
    const { ClavicleRaiser } = await import('../src/lib/services/ClavicleRaiser');
    const raiser = new ClavicleRaiser();
    const result = raiser.computeClavicleRotation(
      new Vector3(0, 0, 0),
      'left',
      1.5,
      0.6,
    );
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
    expect(result.w).toBeCloseTo(1);
  });

  it('produces non-identity when hand is above shoulder', async () => {
    const { ClavicleRaiser } = await import('../src/lib/services/ClavicleRaiser');
    const raiser = new ClavicleRaiser();
    const result = raiser.computeClavicleRotation(
      new Vector3(0, 2.5, 0),
      'left',
      1.5,
      0.6,
    );
    // Should have some rotation when hand is well above shoulder
    expect(Math.abs(result.w)).toBeLessThan(1);
  });
});

describe('SpineTwister', () => {
  it('returns identity when no hands present', async () => {
    const { SpineTwister } = await import('../src/lib/services/SpineTwister');
    const twister = new SpineTwister();
    const result = twister.computeSpineTwist(null, null, new Vector3(0, 0, 0));
    expect(result.spine1.w).toBeCloseTo(1);
    expect(result.spine2.w).toBeCloseTo(1);
    expect(result.hips.w).toBeCloseTo(1);
  });

  it('produces twist when hands are offset laterally', async () => {
    const { SpineTwister } = await import('../src/lib/services/SpineTwister');
    const twister = new SpineTwister();
    // Both hands offset to the right = lateral bias triggers yaw
    const result = twister.computeSpineTwist(
      new Vector3(0.3, 1, 0),
      new Vector3(0.4, 1, 0),
      new Vector3(0, 1, 0),
    );
    // Spine2 should have the largest twist weight - w < 1 means rotation present
    expect(Math.abs(result.spine2.w)).toBeLessThan(1);
  });
});

describe('ElbowPoleComputer', () => {
  it('computes wall plane pole vector pointing forward', async () => {
    const { ElbowPoleComputer } = await import('../src/lib/services/ElbowPoleComputer');
    const computer = new ElbowPoleComputer();
    const pole = computer.computePoleVector(
      new Vector3(0.3, 1.5, 0),
      'wall',
      'right',
      new Vector3(0, 1, 0),
    );
    // Wall plane base is forward (+Z)
    expect(pole.z).toBeGreaterThan(0);
  });

  it('computes wheel plane pole vector pointing outward', async () => {
    const { ElbowPoleComputer } = await import('../src/lib/services/ElbowPoleComputer');
    const computer = new ElbowPoleComputer();
    const pole = computer.computePoleVector(
      new Vector3(0.3, 1.5, 0),
      'wheel',
      'right',
      new Vector3(0, 1, 0),
    );
    // Wheel plane base for right arm is +X (outward)
    expect(pole.x).toBeGreaterThan(0);
  });

  it('computes floor plane pole vector pointing up', async () => {
    const { ElbowPoleComputer } = await import('../src/lib/services/ElbowPoleComputer');
    const computer = new ElbowPoleComputer();
    const pole = computer.computePoleVector(
      new Vector3(0.5, 1.5, 0.5),
      'floor',
      'left',
      new Vector3(0, 1, 0),
    );
    // Floor plane base is upward (+Y)
    expect(pole.y).toBeGreaterThan(0);
  });
});

describe('FingerAnimator', () => {
  it('can be instantiated', async () => {
    const { FingerAnimator } = await import('../src/lib/services/FingerAnimator');
    const animator = new FingerAnimator();
    expect(animator).toBeDefined();
    expect(animator.isReady()).toBe(false);
  });
});

describe('AvatarAnimator', () => {
  it('can be instantiated with dependencies', async () => {
    const { AvatarAnimator } = await import('../src/lib/services/AvatarAnimator');
    const { IKSolver } = await import('../src/lib/services/IKSolver');
    const { AvatarSkeletonBuilder } = await import('../src/lib/services/AvatarSkeletonBuilder');
    const ikSolver = new IKSolver();
    const skeleton = new AvatarSkeletonBuilder();
    const animator = new AvatarAnimator(ikSolver, skeleton);
    expect(animator).toBeDefined();
    const pose = animator.getCurrentPose();
    expect(pose.leftHand).toBeNull();
    expect(pose.rightHand).toBeNull();
  });
});

describe('AvatarServicesFactory', () => {
  it('creates all core services', async () => {
    const { createAvatarServices } = await import('../src/lib/services/AvatarServicesFactory');
    const services = createAvatarServices();
    expect(services.skeleton).toBeDefined();
    expect(services.ikSolver).toBeDefined();
    expect(services.animator).toBeDefined();
    expect(services.fingers).toBeDefined();
  });

  it('respects enableFootPlanting option', async () => {
    const { createAvatarServices } = await import('../src/lib/services/AvatarServicesFactory');
    const services = createAvatarServices({ enableFootPlanting: true });
    expect(services.animator).toBeDefined();
  });
});
