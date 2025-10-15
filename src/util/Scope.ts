/*
 * Scope: Manages resource cleanup via dispose pattern.
 * Ensures all registered cleanup functions run, even if some throw.
 */

export interface IDisposable {
  dispose(): void | Promise<void>;
}

export interface IScope extends IDisposable {
  add(disposable: IDisposable | (() => void | Promise<void>)): void;
  run<T>(fn: () => T): T;
}

export const makeScope = (): IScope => {
  const disposables: Array<IDisposable | (() => void | Promise<void>)> = [];
  let disposed = false;

  const add = (disposable: IDisposable | (() => void | Promise<void>)): void => {
    if (disposed) {
      throw new Error('Cannot add to disposed scope');
    }
    disposables.push(disposable);
  };

  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;

    const errors: Error[] = [];

    // Dispose in reverse order (LIFO)
    for (let i = disposables.length - 1; i >= 0; i--) {
      const d = disposables[i];
      try {
        if (typeof d === 'function') {
          await d();
        } else {
          await d.dispose();
        }
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    disposables.length = 0;

    if (errors.length > 0) {
      const message = errors.map((e) => e.message).join('; ');
      throw new Error(`Scope disposal errors: ${message}`);
    }
  };

  const run = <T>(fn: () => T): T => {
    if (disposed) {
      throw new Error('Cannot run in disposed scope');
    }
    return fn();
  };

  return { add, dispose, run };
};

/**
 * Helper to run code with automatic scope cleanup
 */
export const withScope = async <T>(
  fn: (scope: IScope) => Promise<T> | T
): Promise<T> => {
  const scope = makeScope();
  try {
    return await fn(scope);
  } finally {
    await scope.dispose();
  }
};

