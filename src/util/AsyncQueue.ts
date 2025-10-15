/*
 * AsyncQueue: Serializes async operations to prevent race conditions.
 * All operations execute in FIFO order, even if enqueued concurrently.
 */

export interface IAsyncQueue {
  enqueue<T>(task: () => Promise<T>): Promise<T>;
  isEmpty(): boolean;
  size(): number;
  pending: number; // Number of tasks waiting to execute
}

export const makeAsyncQueue = (): IAsyncQueue => {
  const queue: Array<() => Promise<void>> = [];
  let running = false;

  const processQueue = async (): Promise<void> => {
    if (running || queue.length === 0) return;
    running = true;

    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        try {
          await task();
        } catch {
          // Task errors are already handled in enqueue
          // This catch prevents unhandled promise rejection
        }
      }
    }

    running = false;
  };

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const wrappedTask = async (): Promise<void> => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      queue.push(wrappedTask);
      void processQueue();
    });
  };

  const isEmpty = (): boolean => queue.length === 0 && !running;
  const size = (): number => queue.length;

  return { 
    enqueue, 
    isEmpty, 
    size,
    get pending(): number {
      return queue.length;
    }
  };
};

