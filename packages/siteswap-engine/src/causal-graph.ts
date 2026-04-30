// Causal diagram theory developed by Martin Frost.
// Public domain juggling theory, implemented fresh.

import { Siteswap } from 'universal-siteswap';

export interface CausalNode {
  time: number;
  juggler: number;
  hand: 'L' | 'R';
}

export interface CausalEdge {
  from: CausalNode;
  to: CausalNode;
  throwHeight: number;
  isPass: boolean;
  isCrossing: boolean;
}

export interface CausalGraphData {
  nodes: CausalNode[];
  edges: CausalEdge[];
  period: number;
  numJugglers: number;
  numObjects: number;
}

export class CausalGraph {
  static generate(siteswapStr: string, periods: number = 2): CausalGraphData {
    let ss: Siteswap;
    try {
      ss = Siteswap.Parse(siteswapStr);
    } catch {
      return { nodes: [], edges: [], period: 0, numJugglers: 0, numObjects: 0 };
    }

    if (!ss.isValid) {
      return { nodes: [], edges: [], period: 0, numJugglers: 0, numObjects: 0 };
    }

    const jif = ss.toJIF();
    const jifPeriod = jif.repetition?.period ?? ss.period;
    const totalBeats = jifPeriod * periods;
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    for (let t = 0; t < totalBeats; t++) {
      for (let j = 0; j < ss.numJugglers; j++) {
        nodes.push({ time: t, juggler: j, hand: 'R' });
        nodes.push({ time: t, juggler: j, hand: 'L' });
      }
    }

    for (const jifThrow of jif.throws) {
      const fromLimb = jif.limbs[jifThrow.from];
      const toLimb = jif.limbs[jifThrow.to];
      if (!fromLimb || !toLimb) continue;

      const fromTime = jifThrow.time;
      const toTime = jifThrow.time + jifThrow.duration;
      const isPass = fromLimb.juggler !== toLimb.juggler;
      const fromHand = fromLimb.type.includes('right') ? 'R' as const : 'L' as const;
      const toHand = toLimb.type.includes('right') ? 'R' as const : 'L' as const;

      for (let rep = 0; rep < periods; rep++) {
        const actualFrom = fromTime + rep * jifPeriod;
        const actualTo = toTime + rep * jifPeriod;
        if (actualFrom >= totalBeats || actualTo >= totalBeats) continue;

        edges.push({
          from: { time: actualFrom, juggler: fromLimb.juggler, hand: fromHand },
          to: { time: actualTo, juggler: toLimb.juggler, hand: toHand },
          throwHeight: jifThrow.duration,
          isPass,
          isCrossing: fromHand !== toHand && !isPass,
        });
      }
    }

    return {
      nodes,
      edges,
      period: jifPeriod,
      numJugglers: ss.numJugglers,
      numObjects: ss.numObjects,
    };
  }
}
