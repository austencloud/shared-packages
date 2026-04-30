import { describe, it, expect } from 'vitest';

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
