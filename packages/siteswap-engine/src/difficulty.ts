// Difficulty rating based on standard siteswap properties.
// Weighted formula using throw height, variance, and pattern complexity.

import { Siteswap } from 'universal-siteswap';

export interface DifficultyResult {
  score: number;
  breakdown: {
    height: number;
    variance: number;
    length: number;
    complexity: number;
  };
  label: DifficultyLabel;
}

export type DifficultyLabel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert'
  | 'elite';

const WEIGHTS = {
  height: 0.4,
  variance: 0.2,
  length: 0.15,
  complexity: 0.25,
} as const;

export class DifficultyRating {
  static rate(siteswapStr: string): DifficultyResult {
    let ss: Siteswap;
    try {
      ss = Siteswap.Parse(siteswapStr);
    } catch {
      return {
        score: 0,
        breakdown: { height: 0, variance: 0, length: 0, complexity: 0 },
        label: 'beginner',
      };
    }
    if (!ss.isValid) {
      return {
        score: 0,
        breakdown: { height: 0, variance: 0, length: 0, complexity: 0 },
        label: 'beginner',
      };
    }

    const heights = DifficultyRating.extractHeights(ss);
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const maxHeight = Math.max(...heights);

    const heightScore = Math.min(10, avgHeight * 1.2);

    const mean = avgHeight;
    const varianceVal =
      heights.reduce((sum, h) => sum + (h - mean) ** 2, 0) / heights.length;
    const varianceScore = Math.min(10, Math.sqrt(varianceVal) * 2);

    const lengthScore = Math.min(10, ss.period * 0.8);

    let complexityScore = 0;
    if (ss.hasSync) complexityScore += 2;
    if (ss.maxMultiplex > 1) complexityScore += 3;
    if (ss.hasPass) complexityScore += 2;
    if (ss.numJugglers > 1) complexityScore += 1.5;
    if (maxHeight >= 7) complexityScore += 1.5;
    complexityScore = Math.min(10, complexityScore);

    const score =
      heightScore * WEIGHTS.height +
      varianceScore * WEIGHTS.variance +
      lengthScore * WEIGHTS.length +
      complexityScore * WEIGHTS.complexity;

    const clampedScore = Math.min(10, Math.max(1, score));

    return {
      score: Math.round(clampedScore * 10) / 10,
      breakdown: {
        height: Math.round(heightScore * 10) / 10,
        variance: Math.round(varianceScore * 10) / 10,
        length: Math.round(lengthScore * 10) / 10,
        complexity: Math.round(complexityScore * 10) / 10,
      },
      label: DifficultyRating.toLabel(clampedScore),
    };
  }

  private static extractHeights(ss: Siteswap): number[] {
    const heights: number[] = [];
    for (const juggler of ss.jugglers) {
      for (const beat of juggler.beats) {
        for (const th of beat.RH) heights.push(th.height);
        for (const th of beat.LH) heights.push(th.height);
      }
    }
    return heights.length > 0 ? heights : [0];
  }

  private static toLabel(score: number): DifficultyLabel {
    if (score < 2.5) return 'beginner';
    if (score < 4.5) return 'intermediate';
    if (score < 6.5) return 'advanced';
    if (score < 8.5) return 'expert';
    return 'elite';
  }
}
