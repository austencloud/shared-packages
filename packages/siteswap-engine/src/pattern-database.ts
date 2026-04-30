// Pattern names are common juggling community knowledge, not copyrightable.
// Compiled from publicly available juggling education resources.

export interface PatternEntry {
  siteswap: string;
  name: string;
  aliases?: string[];
  numObjects: number;
  numJugglers: number;
  category: PatternCategory;
  difficulty: number;
  description?: string;
}

export type PatternCategory =
  | 'solo-async'
  | 'solo-sync'
  | 'solo-multiplex'
  | 'passing-async'
  | 'passing-sync';

const PATTERNS: PatternEntry[] = [
  // --- Solo 3-object ---
  { siteswap: '3', name: 'Cascade', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 1 },
  { siteswap: '423', name: 'Burke\'s Barrage', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 3 },
  { siteswap: '441', name: 'Half-Box', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 3 },
  { siteswap: '531', name: 'Flash', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 3 },
  { siteswap: '522', name: 'Shower', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 3 },
  { siteswap: '51', name: '3-Ball Shower', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 4 },
  { siteswap: '42', name: '2-in-1-Hand', numObjects: 2, numJugglers: 1, category: 'solo-async', difficulty: 2 },
  { siteswap: '40', name: 'Two in One Hand', numObjects: 2, numJugglers: 1, category: 'solo-async', difficulty: 2 },
  { siteswap: '312', name: 'Box', aliases: ['Factory'], numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 4 },
  { siteswap: '501', name: 'Flash Cascade', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 4 },
  { siteswap: '45141', name: 'Sprung Cascade', numObjects: 3, numJugglers: 1, category: 'solo-async', difficulty: 5 },

  // --- Solo 4-object ---
  { siteswap: '4', name: 'Fountain', numObjects: 4, numJugglers: 1, category: 'solo-async', difficulty: 4 },
  { siteswap: '534', name: '4-Ball Mills Mess', numObjects: 4, numJugglers: 1, category: 'solo-async', difficulty: 6 },
  { siteswap: '552', name: '4-Ball Shower', numObjects: 4, numJugglers: 1, category: 'solo-async', difficulty: 5 },
  { siteswap: '53', name: '4-Ball Half Shower', numObjects: 4, numJugglers: 1, category: 'solo-async', difficulty: 4 },
  { siteswap: '633', name: '4-Ball Columns', numObjects: 4, numJugglers: 1, category: 'solo-async', difficulty: 5 },
  { siteswap: '71', name: '4-Ball Shower', numObjects: 4, numJugglers: 1, category: 'solo-async', difficulty: 6 },

  // --- Solo 5-object ---
  { siteswap: '5', name: '5-Ball Cascade', numObjects: 5, numJugglers: 1, category: 'solo-async', difficulty: 7 },
  { siteswap: '645', name: 'Killer Bunny', numObjects: 5, numJugglers: 1, category: 'solo-async', difficulty: 7 },
  { siteswap: '744', name: '5-Ball Half Shower', numObjects: 5, numJugglers: 1, category: 'solo-async', difficulty: 7 },
  { siteswap: '97531', name: 'Cascade Waterfall', numObjects: 5, numJugglers: 1, category: 'solo-async', difficulty: 8 },
  { siteswap: '91', name: '5-Ball Shower', numObjects: 5, numJugglers: 1, category: 'solo-async', difficulty: 9 },

  // --- Solo 6-7 object ---
  { siteswap: '6', name: '6-Ball Fountain', numObjects: 6, numJugglers: 1, category: 'solo-async', difficulty: 8 },
  { siteswap: '7', name: '7-Ball Cascade', numObjects: 7, numJugglers: 1, category: 'solo-async', difficulty: 9 },

  // --- Passing 6-club (2 jugglers) ---
  { siteswap: '<3p|3p>', name: '4-Count', aliases: ['Every Others'], numObjects: 6, numJugglers: 2, category: 'passing-async', difficulty: 2, description: 'Pass on every 4th beat' },
  { siteswap: '<3p 3 3|3p 3 3>', name: '3-Count', numObjects: 6, numJugglers: 2, category: 'passing-async', difficulty: 3, description: 'Pass on every 3rd beat' },
  { siteswap: '<3p 3|3p 3>', name: '2-Count', aliases: ['Every Others'], numObjects: 6, numJugglers: 2, category: 'passing-async', difficulty: 3, description: 'Pass on every 2nd beat' },
  { siteswap: '<3p|3p>', name: '1-Count', aliases: ['Ultimate'], numObjects: 6, numJugglers: 2, category: 'passing-async', difficulty: 5, description: 'Pass on every beat' },

  // --- Passing 7-club (2 jugglers) ---
  { siteswap: '<4p 3|3 4p>', name: '7-Club 2-Count', numObjects: 7, numJugglers: 2, category: 'passing-async', difficulty: 6 },
  { siteswap: '<4p 3 3|3 4p 3>', name: '7-Club 3-Count', numObjects: 7, numJugglers: 2, category: 'passing-async', difficulty: 5 },
  { siteswap: '<3p 4 3 3|3p 3 4 3>', name: 'Jim\'s 7-Club 4-Count', numObjects: 7, numJugglers: 2, category: 'passing-async', difficulty: 5 },

  // --- Passing tricks ---
  { siteswap: '<4p 3 4p 3 3|3 4p 3 4p 3>', name: 'Why Not', numObjects: 7, numJugglers: 2, category: 'passing-async', difficulty: 7 },
  { siteswap: '<5p 3 3|3 5p 3>', name: 'Zap', numObjects: 6, numJugglers: 2, category: 'passing-async', difficulty: 4 },

  // --- Solo sync ---
  { siteswap: '(4,4)', name: 'Sync Fountain', numObjects: 4, numJugglers: 1, category: 'solo-sync', difficulty: 4 },
  { siteswap: '(4x,4x)', name: 'Sync Crossing', numObjects: 4, numJugglers: 1, category: 'solo-sync', difficulty: 4 },
  { siteswap: '(6x,4)(4,6x)', name: 'Sync Half Shower', numObjects: 5, numJugglers: 1, category: 'solo-sync', difficulty: 6 },
];

export class PatternDatabase {
  private entries: PatternEntry[];
  private byName: Map<string, PatternEntry>;
  private bySiteswap: Map<string, PatternEntry>;

  constructor(extraEntries: PatternEntry[] = []) {
    this.entries = [...PATTERNS, ...extraEntries];
    this.byName = new Map();
    this.bySiteswap = new Map();

    for (const entry of this.entries) {
      this.byName.set(entry.name.toLowerCase(), entry);
      this.bySiteswap.set(entry.siteswap, entry);
      if (entry.aliases) {
        for (const alias of entry.aliases) {
          this.byName.set(alias.toLowerCase(), entry);
        }
      }
    }
  }

  lookupByName(name: string): PatternEntry | undefined {
    return this.byName.get(name.toLowerCase());
  }

  lookupBySiteswap(siteswap: string): PatternEntry | undefined {
    return this.bySiteswap.get(siteswap);
  }

  search(query: string): PatternEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.siteswap.includes(q) ||
        e.aliases?.some((a) => a.toLowerCase().includes(q)) ||
        e.description?.toLowerCase().includes(q)
    );
  }

  byCategory(category: PatternCategory): PatternEntry[] {
    return this.entries.filter((e) => e.category === category);
  }

  byObjectCount(count: number): PatternEntry[] {
    return this.entries.filter((e) => e.numObjects === count);
  }

  byJugglerCount(count: number): PatternEntry[] {
    return this.entries.filter((e) => e.numJugglers === count);
  }

  byDifficultyRange(min: number, max: number): PatternEntry[] {
    return this.entries.filter((e) => e.difficulty >= min && e.difficulty <= max);
  }

  all(): PatternEntry[] {
    return [...this.entries];
  }

  add(entry: PatternEntry): void {
    this.entries.push(entry);
    this.byName.set(entry.name.toLowerCase(), entry);
    this.bySiteswap.set(entry.siteswap, entry);
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        this.byName.set(alias.toLowerCase(), entry);
      }
    }
  }
}
