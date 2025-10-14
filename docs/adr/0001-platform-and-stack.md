# ADR 0001: Platform and Stack Selection

## Status

Accepted

## Context

We need to establish the foundational technology stack for a turn-based tactical game. The game must:

- Run at 60 FPS with 200 units on a 64×64 grid
- Provide deterministic simulation for replays and testing
- Support modular system architecture with clear boundaries
- Enable comprehensive testing and debugging
- Minimize runtime errors through strong typing

## Decision

We will use the following stack:

### Core Platform

- **TypeScript 5.5+**: Strict mode, full type safety
- **Node 20+**: ESM modules, modern JavaScript features
- **Vitest**: Fast unit testing with coverage
- **ESLint**: Code quality enforcement (max 500 lines per file)

### Key Libraries

- **pure-rand**: Deterministic RNG for reproducible gameplay
- **Valibot**: Lightweight schema validation for external data

### Architecture Patterns

1. **Dependency Injection**: Constructor-only, no `new` of other systems
2. **Resource Management**: All cleanup through `Scope` pattern
3. **Async Safety**: All async ops through `AsyncQueue` to prevent races
4. **Error Handling**: `Result<T, E>` types for expected failures
5. **Determinism**: All randomness through seeded RNG, no `Math.random()`

### Tooling

- **dependency-cruiser**: Enforce dependency rules
- **madge**: Detect circular dependencies
- **Plop**: Code generation for consistency
- **tsx**: Script execution

## Consequences

### Positive

- Strong type safety reduces runtime errors
- Deterministic simulation enables:
  - Reliable testing with fixed seeds
  - Replay systems
  - Network play with input sync
- Clear patterns prevent common bugs
- Fast iteration with hot reload support
- Comprehensive test coverage

### Negative

- Learning curve for Result types and functional patterns
- Slightly more verbose code (DI constructors)
- Must be disciplined about async/await patterns
- Cannot use browser-specific APIs directly

### Risks Mitigated

- Race conditions: AsyncQueue serializes operations
- Memory leaks: Scope ensures cleanup
- Non-determinism: Pure RNG with seeding
- Circular dependencies: Tools enforce DAG structure
- Large files: ESLint enforces 500-line limit

## Alternatives Considered

### JavaScript instead of TypeScript

**Rejected**: Type safety is critical for large codebases. Runtime bugs in a complex simulation are expensive to debug.

### Zod instead of Valibot

**Rejected**: Valibot is 10x smaller with equivalent functionality. Bundle size matters for initial load.

### Class-based OOP vs Functional

**Hybrid approach**: Systems use classes for lifecycle management, utilities use functional style. Best of both worlds.

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [pure-rand documentation](https://github.com/dubzzz/pure-rand)
- [Valibot documentation](https://valibot.dev/)
- [Result type pattern](https://www.ietf.org/archive/id/draft-ietf-core-href-08.html)

