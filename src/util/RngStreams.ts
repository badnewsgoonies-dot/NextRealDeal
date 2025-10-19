/*
 * RngStreams: Centralized management of independent RNG streams.
 * 
 * Creates deterministic, independent sub-streams for different game systems:
 * - route: Route generation and node placement
 * - battle: Combat mechanics and damage rolls
 * - economy: Loot drops and reward generation
 * - map: Map generation and procedural content
 * - unit: Unit spawning and AI decisions
 * - save: Checksum and validation seeds
 * - events: Random events and triggers
 * - loot: Item drops and treasure generation
 * 
 * Usage:
 *   const streams = new RngStreams(rootRng);
 *   const battleRng = streams.get('battle');
 *   const damage = battleRng.int(10, 20);
 */

import type { IRng } from './Rng.js';

type KnownStream =
  | 'route'
  | 'battle'
  | 'economy'
  | 'map'
  | 'unit'
  | 'save'
  | 'events'
  | 'loot';

const DEFAULT_STREAMS: KnownStream[] = [
  'route', 'battle', 'economy', 'map', 'unit', 'save', 'events', 'loot',
];

export class RngStreams {
  private readonly streams = new Map<string, IRng>();

  constructor(root: IRng, labels: readonly string[] = DEFAULT_STREAMS) {
    for (const label of labels) {
      // Fork once so sub-systems can't contaminate each other
      this.streams.set(label, root.fork(label));
    }
  }

  get<T extends string = KnownStream>(label: T): IRng {
    const stream = this.streams.get(label);
    if (!stream) {
      throw new Error(`RNG stream '${label}' not initialized`);
    }
    return stream;
  }

  // Optional: sanity check used in tests
  sampleDistinct(n = 3): boolean {
    const samples: number[][] = [];
    for (const stream of this.streams.values()) {
      const arr = Array.from({ length: n }, () => stream.int(0, 1e9));
      samples.push(arr);
    }
    // crude distinctness heuristic
    const asKey = (a: number[]): string => a.join(',');
    const keys = new Set(samples.map(asKey));
    return keys.size === samples.length;
  }

  // Debug helper
  describeStreams(): Record<string, { seed: number; forks: number; label?: string }> {
    const result: Record<string, { seed: number; forks: number; label?: string }> = {};
    for (const [label, stream] of this.streams.entries()) {
      result[label] = stream.describe();
    }
    return result;
  }
}
