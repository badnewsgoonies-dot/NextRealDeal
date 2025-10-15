/*
 * Test helper for creating system stubs.
 * Used to test GameController lifecycle ordering without real systems.
 */

import { ok, err, type Result } from '../../src/util/Result.js';
import type { ISystem } from '../../src/types/contracts.js';

type Method = 'initialize' | 'update' | 'destroy';

export interface TraceEntry {
  at: number;
  sys: string;
  method: Method;
}

export const makeTrace = (): {
  entries: TraceEntry[];
  record: (sys: string, method: Method) => void;
} => {
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

export const makeSystemStub = <T extends ISystem>(
  name: string,
  trace: ReturnType<typeof makeTrace>,
  opts: StubOpts = {}
): { stub: T } => {
  const { initOk = true, debugPending = 0 } = opts;

  const stub: ISystem = {
    name,
    async initialize(_signal?: AbortSignal): Promise<Result<void, Error>> {
      trace.record(name, 'initialize');
      return initOk ? ok(undefined) : { ok: false, error: new Error('boom') };
    },
    async update(_dt: number): Promise<Result<void, Error>> {
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

