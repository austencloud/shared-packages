import { describe, it, expect } from 'vitest';
import {
  Siteswap,
  PatternDatabase,
  DifficultyRating,
  CausalGraph,
  PatternAnalyzer,
  generateSiteswapList,
} from '../src/index.js';

describe('Siteswap (from universal-siteswap)', () => {
  it('parses valid async pattern', () => {
    const ss = Siteswap.Parse('531');
    expect(ss.isValid).toBe(true);
    expect(ss.numObjects).toBe(3);
    expect(ss.period).toBe(3);
  });

  it('parses sync pattern', () => {
    const ss = Siteswap.Parse('(4,4)');
    expect(ss.isValid).toBe(true);
    expect(ss.numObjects).toBe(4);
    expect(ss.hasSync).toBe(true);
  });

  it('parses passing pattern', () => {
    const ss = Siteswap.Parse('<3p|3p>');
    expect(ss.isValid).toBe(true);
    expect(ss.hasPass).toBe(true);
    expect(ss.numJugglers).toBe(2);
  });

  it('rejects invalid pattern', () => {
    const ss = Siteswap.Parse('432');
    expect(ss.isValid).toBe(false);
  });

  it('generates JIF', () => {
    const ss = Siteswap.Parse('531');
    const jif = ss.toJIF();
    expect(jif.throws.length).toBeGreaterThan(0);
    expect(jif.jugglers.length).toBe(1);
  });

  it('converts to JIF and back', () => {
    const ss = Siteswap.Parse('531');
    const jif = ss.toJIF();
    const ss2 = Siteswap.FromJif(jif);
    expect(ss2.isValid).toBe(true);
    expect(ss2.numObjects).toBe(3);
  });
});

describe('Generator', () => {
  it('generates 3-ball period-3 patterns', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 3, maxThrow: 7 });
    const siteswaps = results.map((r) => r.siteswap);
    expect(siteswaps).toContain('531');
    expect(siteswaps).toContain('441');
    expect(siteswaps).toContain('522');
    expect(results.length).toBeGreaterThan(3);
  });

  it('all results are valid siteswaps', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 3, maxThrow: 7 });
    for (const r of results) {
      const ss = Siteswap.Parse(r.siteswap);
      expect(ss.isValid).toBe(true);
      expect(ss.numObjects).toBe(3);
    }
  });

  it('respects maxResults', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 3, maxThrow: 9, maxResults: 5 });
    expect(results.length).toBe(5);
  });

  it('excludes specified throws', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 3, maxThrow: 7, excludeThrows: [0] });
    for (const r of results) {
      expect(r.siteswap).not.toContain('0');
    }
  });

  it('requires included throws', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 3, maxThrow: 7, includeThrows: [5] });
    for (const r of results) {
      expect(r.siteswap).toContain('5');
    }
  });

  it('generates 4-ball patterns', () => {
    const results = generateSiteswapList({ numObjects: 4, period: 2, maxThrow: 7 });
    const siteswaps = results.map((r) => r.siteswap);
    expect(siteswaps).toContain('53');
    expect(siteswaps).toContain('71');
  });

  it('generates period-1 patterns', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 1, maxThrow: 5 });
    const siteswaps = results.map((r) => r.siteswap);
    expect(siteswaps).toContain('3');
  });

  it('produces no duplicates', () => {
    const results = generateSiteswapList({ numObjects: 3, period: 4, maxThrow: 7 });
    const siteswaps = results.map((r) => r.siteswap);
    const unique = new Set(siteswaps);
    expect(unique.size).toBe(siteswaps.length);
  });
});

describe('PatternDatabase', () => {
  const db = new PatternDatabase();

  it('looks up by name', () => {
    const cascade = db.lookupByName('Cascade');
    expect(cascade).toBeDefined();
    expect(cascade!.siteswap).toBe('3');
  });

  it('looks up by siteswap', () => {
    const pattern = db.lookupBySiteswap('531');
    expect(pattern).toBeDefined();
    expect(pattern!.name).toBe('Flash');
  });

  it('searches by query', () => {
    const results = db.search('shower');
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by object count', () => {
    const fiveObj = db.byObjectCount(5);
    expect(fiveObj.every((p) => p.numObjects === 5)).toBe(true);
  });

  it('filters by juggler count', () => {
    const passing = db.byJugglerCount(2);
    expect(passing.every((p) => p.numJugglers === 2)).toBe(true);
    expect(passing.length).toBeGreaterThan(0);
  });
});

describe('DifficultyRating', () => {
  it('rates cascade as easy', () => {
    const result = DifficultyRating.rate('3');
    expect(result.label).toBe('beginner');
    expect(result.score).toBeLessThan(3);
  });

  it('rates 5-ball cascade as hard', () => {
    const result = DifficultyRating.rate('5');
    expect(result.score).toBeGreaterThan(2);
  });

  it('rates invalid pattern as 0', () => {
    const result = DifficultyRating.rate('xyz_bad');
    expect(result.score).toBe(0);
  });
});

describe('CausalGraph', () => {
  it('generates graph for cascade', () => {
    const graph = CausalGraph.generate('531');
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.numObjects).toBe(3);
  });

  it('generates graph for passing pattern', () => {
    const graph = CausalGraph.generate('<3p|3p>');
    expect(graph.numJugglers).toBe(2);
    expect(graph.edges.some((e) => e.isPass)).toBe(true);
  });

  it('returns empty for invalid', () => {
    const graph = CausalGraph.generate('432');
    expect(graph.nodes.length).toBe(0);
  });
});

describe('PatternAnalyzer', () => {
  const analyzer = new PatternAnalyzer();

  it('analyzes known pattern', () => {
    const analysis = analyzer.analyze('531');
    expect(analysis.isValid).toBe(true);
    expect(analysis.numObjects).toBe(3);
    expect(analysis.knownPattern).toBeDefined();
    expect(analysis.knownPattern!.name).toBe('Flash');
  });

  it('analyzes unknown valid pattern', () => {
    const analysis = analyzer.analyze('612');
    expect(analysis.isValid).toBe(true);
    expect(analysis.numObjects).toBe(3);
  });

  it('handles invalid pattern', () => {
    const analysis = analyzer.analyze('432');
    expect(analysis.isValid).toBe(false);
  });
});
