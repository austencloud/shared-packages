// High-level pattern analysis combining all engine capabilities.

import { Siteswap } from 'universal-siteswap';
import { PatternDatabase, type PatternEntry } from './pattern-database.js';
import { DifficultyRating, type DifficultyResult } from './difficulty.js';
import { CausalGraph, type CausalGraphData } from './causal-graph.js';

export interface PatternAnalysis {
  siteswap: string;
  isValid: boolean;
  errorMessage?: string;
  numObjects: number;
  numJugglers: number;
  period: number;
  maxHeight: number;
  hasSync: boolean;
  hasPass: boolean;
  maxMultiplex: number;
  knownPattern?: PatternEntry;
  difficulty: DifficultyResult;
  causalGraph: CausalGraphData;
  suggestions: string[];
}

const db = new PatternDatabase();

export class PatternAnalyzer {
  private database: PatternDatabase;

  constructor(database?: PatternDatabase) {
    this.database = database ?? db;
  }

  analyze(siteswapStr: string): PatternAnalysis {
    let ss: Siteswap;
    try {
      ss = Siteswap.Parse(siteswapStr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parse error';
      return {
        siteswap: siteswapStr,
        isValid: false,
        errorMessage: msg,
        numObjects: 0,
        numJugglers: 0,
        period: 0,
        maxHeight: 0,
        hasSync: false,
        hasPass: false,
        maxMultiplex: 0,
        difficulty: { score: 0, breakdown: { height: 0, variance: 0, length: 0, complexity: 0 }, label: 'beginner' as const },
        causalGraph: { nodes: [], edges: [], period: 0, numJugglers: 0, numObjects: 0 },
        suggestions: [`Invalid siteswap: ${msg}`],
      };
    }

    if (!ss.isValid) {
      return {
        siteswap: siteswapStr,
        isValid: false,
        errorMessage: ss.errorMessage,
        numObjects: 0,
        numJugglers: 0,
        period: 0,
        maxHeight: 0,
        hasSync: false,
        hasPass: false,
        maxMultiplex: 0,
        difficulty: DifficultyRating.rate(siteswapStr),
        causalGraph: { nodes: [], edges: [], period: 0, numJugglers: 0, numObjects: 0 },
        suggestions: [`Invalid siteswap: ${ss.errorMessage}`],
      };
    }

    const knownPattern = this.database.lookupBySiteswap(siteswapStr);
    const difficulty = DifficultyRating.rate(siteswapStr);
    const causalGraph = CausalGraph.generate(siteswapStr);

    const suggestions = this.generateSuggestions(ss, knownPattern, difficulty);

    return {
      siteswap: siteswapStr,
      isValid: true,
      numObjects: ss.numObjects,
      numJugglers: ss.numJugglers,
      period: ss.period,
      maxHeight: ss.maxHeight,
      hasSync: ss.hasSync,
      hasPass: ss.hasPass,
      maxMultiplex: ss.maxMultiplex,
      knownPattern,
      difficulty,
      causalGraph,
      suggestions,
    };
  }

  private generateSuggestions(
    ss: Siteswap,
    known: PatternEntry | undefined,
    difficulty: DifficultyResult
  ): string[] {
    const suggestions: string[] = [];

    if (known) {
      const related = this.database
        .byObjectCount(ss.numObjects)
        .filter((p) => p.siteswap !== ss.toString())
        .filter((p) => Math.abs(p.difficulty - difficulty.score) <= 2)
        .slice(0, 3);

      if (related.length > 0) {
        suggestions.push(
          `Try similar patterns: ${related.map((p) => `${p.name} (${p.siteswap})`).join(', ')}`
        );
      }
    }

    if (difficulty.label === 'beginner' && ss.numObjects <= 3) {
      const harder = this.database
        .byObjectCount(ss.numObjects)
        .filter((p) => p.difficulty > difficulty.score)
        .sort((a, b) => a.difficulty - b.difficulty)
        .slice(0, 2);
      if (harder.length > 0) {
        suggestions.push(
          `Ready for more? Try: ${harder.map((p) => `${p.name} (${p.siteswap})`).join(', ')}`
        );
      }
    }

    return suggestions;
  }
}
