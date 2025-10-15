/*
 * Performance profiling utility.
 * Run with: npm run perf
 */

interface PerfMetrics {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSec: number;
}

const measure = async (
  name: string,
  fn: () => void | Promise<void>,
  iterations = 1000
): Promise<PerfMetrics> => {
  const times: number[] = [];
  
  // Warmup
  for (let i = 0; i < 10; i++) {
    await fn();
  }
  
  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  const opsPerSec = 1000 / avgMs;
  
  return { name, iterations, totalMs, avgMs, minMs, maxMs, opsPerSec };
};

const printMetrics = (metrics: PerfMetrics): void => {
  console.error('='.repeat(60));
  console.error(`Benchmark: ${metrics.name}`);
  console.error('='.repeat(60));
  console.error(`Iterations: ${metrics.iterations}`);
  console.error(`Total time: ${metrics.totalMs.toFixed(2)}ms`);
  console.error(`Average:    ${metrics.avgMs.toFixed(4)}ms`);
  console.error(`Min:        ${metrics.minMs.toFixed(4)}ms`);
  console.error(`Max:        ${metrics.maxMs.toFixed(4)}ms`);
  console.error(`Ops/sec:    ${metrics.opsPerSec.toFixed(0)}`);
  console.error('');
};

// Example benchmarks
const runBenchmarks = async (): Promise<void> => {
  console.error('\n🔥 Performance Benchmarks\n');
  
  // Add your benchmarks here
  const m1 = await measure('Array allocation', () => {
    const arr = new Array(1000);
    arr.fill(0);
  });
  printMetrics(m1);
  
  const m2 = await measure('Object creation', () => {
    const obj = { x: 0, y: 0, z: 0 };
    return obj;
  });
  printMetrics(m2);
  
  const m3 = await measure('Map operations', () => {
    const map = new Map<number, string>();
    for (let i = 0; i < 100; i++) {
      map.set(i, `value${i}`);
    }
    map.clear();
  });
  printMetrics(m3);
};

runBenchmarks().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

