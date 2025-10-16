/*
 * Test helper: System stubs for testing GameController integration.
 * Provides reusable mocks that track lifecycle method calls.
 */

import { ok, err, type Result } from '../../src/util/Result.js';
import type { ISystem } from '../../src/types/contracts.js';

type Method = 'initialize' | 'update' | 'destroy';

export interface TraceEntry {
  at: number;
  sys: string;
  method: Method;
}

/**
 * Creates a trace recorder for verifying lifecycle call order.
 * 
 * @example
 * const trace = makeTrace();
 * trace.record('map', 'initialize');
 * trace.record('battle', 'initialize');
 * expect(trace.entries[0].sys).toBe('map');
 */
export const makeTrace = (): { entries: TraceEntry[]; record: (sys: string, method: Method) => void } => {
  let at = 0;
  const entries: TraceEntry[] = [];

  return {
    entries,
    record(sys: string, method: Method): void {
      entries.push({ at: at++, sys, method });
    },
  };
};

interface StubOpts {
  initOk?: boolean;
  debugPending?: number;
}

/**
 * Creates a mock system for testing GameController integration.
 * 
 * @param name - System identifier for trace logging
 * @param trace - Trace recorder to track lifecycle calls
 * @param opts - Configuration (success/failure, debug stats)
 */
export const makeSystemStub = <T extends ISystem>(
  name: string,
  trace: ReturnType<typeof makeTrace>,
  opts: StubOpts = {}
): { stub: T } => {
  const { initOk = true, debugPending = 0 } = opts;

  const stub: ISystem = {
    async initialize(signal?: AbortSignal): Promise<Result<void, string>> {
      if (signal?.aborted) return err('aborted');
      trace.record(name, 'initialize');
      return initOk ? ok(undefined) : err('boom');
    },

    async update(_dt: number, _signal?: AbortSignal): Promise<Result<void, string>> {
      trace.record(name, 'update');
      return ok(undefined);
    },

    async destroy(): Promise<void> {
      trace.record(name, 'destroy');
    },

    getDebugStats(): { queuePending: number } | undefined {
      if (process.env.NODE_ENV !== 'test') return undefined;
      return { queuePending: debugPending };
    },
  };

  return { stub: stub as unknown as T };
};
