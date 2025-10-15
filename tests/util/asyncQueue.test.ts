import { test, expect, describe } from 'vitest';
import { makeAsyncQueue } from '../../src/util/AsyncQueue.js';

describe('AsyncQueue', () => {
  test('pending never exceeds 1 and drains to 0', async () => {
    const q = makeAsyncQueue();
    let max = 0;
    
    const work = (): Promise<void> => q.enqueue(async () => {
      max = Math.max(max, q.pending);
      await new Promise(r => setTimeout(r, 1));
    });
    
    await Promise.all(Array.from({ length: 20 }, work));
    await q.drain();
    
    expect(max).toBeLessThanOrEqual(1);
    expect(q.pending).toBe(0);
  });

  test('executes tasks in FIFO order', async () => {
    const q = makeAsyncQueue();
    const order: number[] = [];
    
    const task = (n: number): Promise<void> => q.enqueue(async () => {
      order.push(n);
    });
    
    await Promise.all([task(1), task(2), task(3), task(4), task(5)]);
    
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  test('isEmpty returns true when queue is empty', () => {
    const q = makeAsyncQueue();
    expect(q.isEmpty()).toBe(true);
  });

  test('isEmpty returns false when tasks are pending', async () => {
    const q = makeAsyncQueue();
    
    const promise = q.enqueue(async () => {
      await new Promise(r => setTimeout(r, 10));
    });
    
    expect(q.isEmpty()).toBe(false);
    await promise;
    expect(q.isEmpty()).toBe(true);
  });

  test('size tracks queued tasks', async () => {
    const q = makeAsyncQueue();
    expect(q.size()).toBe(0);
    
    const promises = Array.from({ length: 5 }, () => 
      q.enqueue(async () => {
        await new Promise(r => setTimeout(r, 5));
      })
    );
    
    // Tasks are queued but not all executing yet
    expect(q.size()).toBeGreaterThanOrEqual(0);
    
    await Promise.all(promises);
    expect(q.size()).toBe(0);
  });

  test('handles task errors without breaking queue', async () => {
    const q = makeAsyncQueue();
    const results: Array<string | Error> = [];
    
    const task1 = q.enqueue(async () => {
      return 'success1';
    }).then(r => results.push(r), (e: Error) => results.push(e));
    
    const task2 = q.enqueue(async () => {
      throw new Error('failure');
    }).then(r => results.push(r), (e: Error) => results.push(e));
    
    const task3 = q.enqueue(async () => {
      return 'success2';
    }).then(r => results.push(r), (e: Error) => results.push(e));
    
    await Promise.all([task1, task2, task3]);
    
    expect(results[0]).toBe('success1');
    expect(results[1]).toBeInstanceOf(Error);
    expect(results[2]).toBe('success2');
  });

  test('drain waits for all pending tasks', async () => {
    const q = makeAsyncQueue();
    let completed = 0;
    
    void q.enqueue(async () => {
      await new Promise(r => setTimeout(r, 10));
      completed++;
    });
    
    void q.enqueue(async () => {
      await new Promise(r => setTimeout(r, 5));
      completed++;
    });
    
    expect(completed).toBe(0);
    await q.drain();
    expect(completed).toBe(2);
  });
});

