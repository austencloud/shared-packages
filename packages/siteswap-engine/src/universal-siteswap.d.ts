declare module 'universal-siteswap' {
  export class Throw {
    dispHeight: number;
    height: number;
    x: boolean;
    pass: boolean;
    passTo?: number;
    toString(): string;
    clone(): Throw;
  }

  export enum Hand {
    Right = 0,
    Left = 1,
  }

  export interface Position {
    juggler: number;
    time: number;
    hand: Hand;
  }

  export interface LandingInfo {
    juggler: number;
    beat: number;
    hand: Hand;
    fullLandTime: number;
    rawLandHand: Hand;
  }

  export interface ThrowLanding {
    from: Position;
    to: LandingInfo;
    throw: Throw;
  }

  export class JugglerBeat {
    LH: Throw[];
    RH: Throw[];
    isSync(): boolean;
    isAsync(): boolean;
    isEmpty(): boolean;
    hasPass(): boolean;
    toString(): string;
  }

  export class GlobalBeat {
    juggler(index: number): JugglerBeat;
    toString(): string;
  }

  export class Siteswap {
    numObjects: number;
    numJugglers: number;
    period: number;
    maxHeight: number;
    maxMultiplex: number;
    hasSync: boolean;
    hasAsync: boolean;
    hasPass: boolean;
    pureAsync: boolean;
    isValid: boolean;
    errorMessage?: string;
    jugglers: { beats: JugglerBeat[] }[];
    jugglerDelays: number[][];
    state: State;

    static Parse(input: string): Siteswap;
    static ParseKHSS(input: string, hands: number, local?: boolean): Siteswap;
    static FromJif(jif: JIF): Siteswap;

    globalBeat(time: number): GlobalBeat;
    getAllLandings(): ThrowLanding[];
    toJIF(): JIF;
    toVanilla(): VanillaSiteswap;
    toString(): string;
    flip(): Siteswap;
  }

  export class State {
    isGround: boolean;
    numObjects: number;
    numJugglers: number;
    maxHeight: number;

    static ShortestTransition(s1: State, s2: State, allowFlipped?: boolean): string | null;
    static AllTransitionsOfLength(s1: State, s2: State, length: number): Generator<string>;
    static GroundState(numObjects: number, sync?: boolean, numJugglers?: number): State;

    entry(): string | null;
    exit(): string | null;
    toString(): string;
  }

  export class VanillaSiteswap {
    numObjects: number;
    period: number;
    maxHeight: number;
    maxMultiplex: number;
    state: VanillaState;
    isValid: boolean;

    static Parse(input: string): VanillaSiteswap;
    static ParseStack(input: string): VanillaSiteswap;

    toStack(): string;
    toString(): string;
  }

  export class VanillaState {
    static ShortestTransition(s1: VanillaState, s2: VanillaState): string | null;
    static AllTransitionsOfLength(s1: VanillaState, s2: VanillaState, length: number): Generator<string>;

    entry(): string | null;
    exit(): string | null;
    toString(): string;
  }

  export function stackToSiteswap(stack: number[][]): number[][];

  // Generators
  export interface VanillaOptions {
    balls: number;
    period: number;
    maxThrow?: number;
    includeThrows?: number[];
    excludeThrows?: number[];
    filters?: Filter[];
  }

  export interface NHandedOptions {
    balls: number;
    period: number;
    hands?: number;
    maxThrow?: number;
    includeThrows?: number[];
    excludeThrows?: number[];
    filterFakeNHanded?: boolean;
    filters?: Filter[];
  }

  export interface PatternFilter {
    type?: 'pattern-global' | 'pattern-local';
    pattern: string;
    mode: 'include' | 'exclude';
  }

  export interface ThrowCountFilter {
    type: 'throw-count';
    throw: string;
    comparison: 'exactly' | 'at-least' | 'at-most';
    count: number;
  }

  export interface ThrowsFilter {
    type: 'exclude-throws' | 'include-throws';
    throws: string;
  }

  export type Filter = PatternFilter | ThrowCountFilter | ThrowsFilter;

  export interface SyncPassingOptions {
    balls: number;
    period: number;
    maxThrow: number;
    filterZeros?: boolean;
    filterTwos?: boolean;
    filter1p?: boolean;
    filter2p?: boolean;
    filterFakeSync?: boolean;
    filterWimpy?: boolean;
    filterCollisiony?: boolean;
    syncMode?: 'full-sync' | 'sync-async' | 'both';
    passModification?: 'none' | 'consistent' | 'any';
    selfModification?: 'none' | 'consistent' | 'any';
  }

  export interface AnagramResult {
    count: number;
    anagrams: string[];
    error: string | null;
  }

  export function generateVanillaSiteswaps(options: VanillaOptions): string[];
  export function generateNHandedSiteswaps(options: NHandedOptions): string[];
  export function generateSyncPassing(options: SyncPassingOptions): string[];
  export function findAnagrams(siteswap: string, countOnly?: boolean): AnagramResult;

  // JIF
  export interface JIFThrow {
    time: number;
    duration: number;
    from: number;
    to: number;
    label?: string;
    prop?: number;
  }

  export interface JIFLimb {
    juggler: number;
    type: string;
  }

  export interface JIFJuggler {
    name: string;
    position: number[];
    lookAt: number[];
  }

  export interface JIFProp {
    color: string;
    type: string;
  }

  export interface JIF {
    meta?: {
      name?: string;
      type?: string;
      description?: string;
      generator?: string;
      version?: string;
    };
    timeStretchFactor: number;
    jugglers: JIFJuggler[];
    limbs: JIFLimb[];
    props: JIFProp[];
    throws: JIFThrow[];
    repetition: {
      period?: number;
      limbPermutation?: number[];
    };
  }
}
