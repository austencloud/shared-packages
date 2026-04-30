// Siteswap pattern generator using backtracking search.
// Algorithm: enumerate throw sequences, validate via landing collision check,
// eliminate rotational duplicates by requiring canonical (lexicographically largest) form.
// Reference: standard siteswap generation algorithm documented in juggling math literature.

import { Siteswap } from 'universal-siteswap';

export interface GeneratorOptions {
  numObjects: number;
  period: number;
  maxThrow?: number;
  minThrow?: number;
  includeThrows?: number[];
  excludeThrows?: number[];
  maxResults?: number;
}

export interface GeneratedPattern {
  siteswap: string;
  numObjects: number;
  period: number;
  maxThrow: number;
}

export function* generateSiteswaps(options: GeneratorOptions): Generator<GeneratedPattern> {
  const {
    numObjects,
    period,
    maxThrow = numObjects * 2,
    minThrow = 0,
    excludeThrows = [],
    maxResults = Infinity,
  } = options;

  const excludeSet = new Set(excludeThrows);
  const includeSet = options.includeThrows ? new Set(options.includeThrows) : null;
  const seen = new Set<string>();
  let count = 0;

  const pattern: number[] = new Array(period).fill(0);

  function isValid(len: number): boolean {
    const landings = new Set<number>();
    for (let i = 0; i < len; i++) {
      const landing = (i + pattern[i]) % period;
      if (landings.has(landing)) return false;
      landings.add(landing);
    }
    return true;
  }

  function averageIsCorrect(): boolean {
    let sum = 0;
    for (let i = 0; i < period; i++) sum += pattern[i];
    return sum === numObjects * period;
  }

  function isCanonical(): boolean {
    for (let rotation = 1; rotation < period; rotation++) {
      for (let i = 0; i < period; i++) {
        const a = pattern[i];
        const b = pattern[(i + rotation) % period];
        if (a > b) break;
        if (a < b) return false;
      }
    }
    return true;
  }

  function isNotPeriodReduction(): boolean {
    for (let subPeriod = 1; subPeriod < period; subPeriod++) {
      if (period % subPeriod !== 0) continue;
      let isReduction = true;
      for (let i = 0; i < period; i++) {
        if (pattern[i] !== pattern[i % subPeriod]) {
          isReduction = false;
          break;
        }
      }
      if (isReduction) return false;
    }
    return true;
  }

  function hasRequiredThrows(): boolean {
    if (!includeSet) return true;
    const patternSet = new Set(pattern);
    for (const t of includeSet) {
      if (!patternSet.has(t)) return false;
    }
    return true;
  }

  function patternToString(): string {
    return pattern.map((t) => (t < 10 ? String(t) : String.fromCharCode(87 + t))).join('');
  }

  function* search(pos: number): Generator<GeneratedPattern> {
    if (pos === period) {
      if (!averageIsCorrect()) return;
      if (!isCanonical()) return;
      if (!isNotPeriodReduction()) return;
      if (!hasRequiredThrows()) return;

      const str = patternToString();
      if (seen.has(str)) return;
      seen.add(str);

      yield {
        siteswap: str,
        numObjects,
        period,
        maxThrow: Math.max(...pattern),
      };
      return;
    }

    const remaining = period - pos - 1;
    const currentSum = pattern.slice(0, pos).reduce((a, b) => a + b, 0);
    const target = numObjects * period;

    for (let t = maxThrow; t >= minThrow; t--) {
      if (excludeSet.has(t)) continue;

      const sumWithThis = currentSum + t;
      if (sumWithThis + remaining * maxThrow < target) break;
      if (sumWithThis + remaining * minThrow > target) continue;

      pattern[pos] = t;

      if (!isValid(pos + 1)) continue;

      yield* search(pos + 1);
    }
  }

  for (const result of search(0)) {
    yield result;
    count++;
    if (count >= maxResults) return;
  }
}

export function generateSiteswapList(options: GeneratorOptions): GeneratedPattern[] {
  return [...generateSiteswaps(options)];
}
