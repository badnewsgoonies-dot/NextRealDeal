/*
 * AsyncQueue: Serializes async operations to prevent race conditions.
 * All operations execute in FIFO order, even if enqueued concurrently.
 */

export interface IAsyncQueue {
  enqueue<T>(task: () => Promise<T>): Promise<T>;
  run<T>(fn: () => Promise<T>, opts?: { signal?: AbortSignal }): Promise<T>;
  isEmpty(): boolean;
  size(): number;
  pending: number; // Number of tasks currently executing (0 or 1)
  drain(): Promise<void>;
}

export class AsyncQueue implements IAsyncQueue {
  private tail: Promise<void> = Promise.resolve();
  private _pending = 0;
  private _size = 0;

  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    this._size++;
    
    const p = this.tail.then(async () => {
      this._size--;
      this._pending++;
      try {
        return await task();
      } finally {
        this._pending--;
      }
    });

    this.tail = p.then(
      () => void 0,
      () => void 0
    );

    return p;
  }

  public run<T>(fn: () => Promise<T>, opts: { signal?: AbortSignal } = {}): Promise<T> {
    const { signal } = opts;
    if (signal?.aborted) {
      return Promise.reject(Object.assign(new Error('Operation aborted'), { name: 'AbortError' }));
    }

    return this.enqueue(async () => {
      if (signal?.aborted) {
        throw Object.assign(new Error('Operation aborted'), { name: 'AbortError' });
      }
      return await fn();
    });
  }

  public async drain(): Promise<void> {
    await this.tail;
  }

  public isEmpty(): boolean {
    return this._size === 0 && this._pending === 0;
  }

  public size(): number {
    return this._size;
  }

  public get pending(): number {
    return this._pending;
  }
}

export const makeAsyncQueue = (): IAsyncQueue => new AsyncQueue();
