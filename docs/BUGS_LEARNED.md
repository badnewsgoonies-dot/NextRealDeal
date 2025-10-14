# Bugs Learned

This document tracks bugs we've encountered and the patterns we've adopted to prevent them.

## Critical Bugs Fixed

### 1. RNG Fork Non-Independence (Fixed 2025-10-14)

**Symptom**: Forked RNGs produced correlated sequences instead of independent streams.

**Root Cause**: Original `fork()` created new generator from the same seed:
```ts
// ❌ WRONG
const fork = (label?: string): IRng => {
  forks += 1;
  return makeFromGen(prand.xoroshiro128plus(seed), { seed, forks: 0, label });
};
```

**Fix**: Use generator's `jump()` method for proper stream splitting:
```ts
// ✅ CORRECT
const fork = (childLabel?: string): IRng => {
  const childGen = g.jump();  // Advance to independent sub-stream
  forks += 1;
  return makeFromGen(childGen, { seed, forks: 0, label: childLabel });
};
```

**Why It Matters**: Systems need independent random streams. Map generation shouldn't affect battle outcomes just because they share a root seed.

**Test Case**: 
```ts
const rng = makeRng(123);
const fork1 = rng.fork();
const fork2 = rng.fork();
// fork1 and fork2 must produce different sequences
expect(fork1.int(0, 100)).not.toBe(fork2.int(0, 100));
```

**Prevention**: 
- Always test fork independence
- Document RNG usage patterns clearly
- Use labeled forks for debugging

---

## Common Pitfalls

### Async Race Conditions

**Problem**: Concurrent async operations accessing shared state.

**Solution**: Use `AsyncQueue` for serialization:
```ts
// ❌ Race condition
async save() {
  const data = await this.getData();
  await this.writeFile(data);
}

// ✅ Safe
async save() {
  return this.queue.enqueue(async () => {
    const data = await this.getData();
    await this.writeFile(data);
  });
}
```

### Memory Leaks from Event Listeners

**Problem**: Forgotten event unsubscriptions.

**Solution**: Register cleanup with `Scope`:
```ts
// ✅ Automatic cleanup
const scope = makeScope();
const handler = () => { /* ... */ };
emitter.on('event', handler);
scope.add(() => emitter.off('event', handler));
```

### Non-Deterministic Behavior

**Problem**: Using `Math.random()`, `Date.now()`, or object key iteration order.

**Solutions**:
- Use `IRng` for all randomness
- Pass time as parameter, don't call `Date.now()` directly
- Sort object keys before iteration: `Object.keys(obj).sort()`

### Validation Bypasses

**Problem**: Forgetting to validate external data.

**Solution**: 
- Always validate at boundaries (file I/O, user input, network)
- Use `Result` types to make validation explicit
- Create schemas for all external data structures

### Circular Dependencies

**Problem**: Module A imports B, B imports A.

**Solution**:
- Run `npm run circular` in CI
- Use interfaces to break cycles
- Follow layered architecture: util → core → systems

### Large Files

**Problem**: Files over 500 lines become hard to maintain.

**Solution**:
- ESLint enforces 500-line limit
- Split systems into manager + validator + types
- Extract shared logic to utilities

---

## Testing Lessons

### Deterministic Tests

Always use seeded RNG in tests:
```ts
const rng = makeRng(12345); // Fixed seed
```

### Async Test Issues

Always `await` system lifecycle methods:
```ts
await system.initialize(); // Don't forget await!
const result = await system.update(16.67);
```

### Resource Cleanup in Tests

Use `beforeEach` and `afterEach`:
```ts
let system: MySystem;

beforeEach(() => {
  system = new MySystem(config, rng, logger);
  await system.initialize();
});

afterEach(async () => {
  await system.dispose();
});
```

---

## Architecture Decisions

### Why Constructor DI Only?

**Problem**: Hard to test code that does `new OtherSystem()` inside methods.

**Solution**: Pass dependencies through constructors:
```ts
// ✅ Testable
constructor(
  private mapManager: IMapManager,
  private battleManager: IBattleManager
) {}
```

### Why Result Types?

**Problem**: Exceptions make control flow hard to follow.

**Solution**: Use `Result<T, E>` for expected failures:
```ts
function loadConfig(path: string): Result<Config, Error> {
  if (!exists(path)) return Err(new Error('Config not found'));
  return Ok(parseConfig(path));
}
```

### Why AsyncQueue?

**Problem**: Multiple async operations corrupting shared state.

**Solution**: Serialize operations through a queue:
- Guarantees FIFO execution order
- Prevents race conditions
- Makes async behavior predictable

---

## Performance Notes

### Avoid Premature Optimization

- Measure first with `scripts/perf.ts`
- Target: 60 FPS (16.67ms per frame) with 200 units
- Profile before optimizing

### Known Fast Patterns

- Typed arrays for bulk data
- Object pooling for frequent allocations
- Spatial indexing for collision detection
- Dirty flags to skip unchanged updates

---

## Update Log

- **2025-10-14**: Created document, documented RNG fork bug fix
- **2025-10-14**: Added RNG regression tests, discovered and fixed sequential fork independence bug

