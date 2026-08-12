# ADR-0003: TypeScript implementation and application boundary

Date: 2026-08-11
Status: Accepted

## Context

ADR-0001 fixes a headless deterministic simulation core, and ADR-0002 fixes
the M1 behavior that core must implement. The next engine contracts need a
language, module shape, and public application boundary. Leaving those choices
to the first implementation ticket would let a bounded worker decide the
architecture through source layout and function signatures.

Manifest needs closed command, event, rejection, and lifecycle variants that
can be checked exhaustively. It also needs the same domain implementation to
run under a headless test host now and behind a browser interface later. The
choice should preserve that path without selecting a UI framework, persistence
technology, or deployment model before M1 provides evidence.

The relevant implementation evidence is:

- TypeScript supports [discriminated unions and exhaustiveness
  checking](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html),
  which fit Manifest's typed commands, events, and rejections.
- TypeScript recommends [strict checking for new
  codebases](https://www.typescriptlang.org/docs/handbook/2/basic-types.html),
  but its types are [erased and do not change runtime
  behavior](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html).
  External input therefore still needs runtime parsing.
- Node supports standard [ECMAScript
  modules](https://nodejs.org/api/esm.html), and its [release
  schedule](https://nodejs.org/en/about/previous-releases) lists Node 22 as a
  supported LTS line; that line is installed on the current development host.
  Node's own TypeScript execution is not the build contract because its [type
  stripping performs no type checking and ignores
  `tsconfig.json`](https://nodejs.org/api/typescript.html).

## Decision

### Language and toolchain

Manifest will be implemented in TypeScript and compiled to standard ECMAScript
modules. The compiler runs with `strict`, `exactOptionalPropertyTypes`, and
`noUncheckedIndexedAccess` enabled. Commands, events, projections, and results
use explicit data types and discriminated unions. A pinned TypeScript compiler
is a development dependency, npm owns the committed dependency lock, and
`make verify` remains the repository's root verification command.

Compiled headless code runs on a supported Node LTS line. Node 22 is the
initial verification floor because it is supported and already present on the
development host. Moving the floor to a newer supported LTS line is ordinary
toolchain maintenance, not an architectural reversal.

The engine is portable ECMAScript logic. It cannot import Node built-ins,
browser globals, UI code, filesystem, network, database, wall-clock, or ambient
random APIs. Node is the headless host and a future browser is another host;
neither is part of the engine.

### Package and dependency boundary

M1 uses one package at the repository root. It does not begin as a workspace,
monorepo, separately published engine package, or service. Package exports will
expose the intended application entry point rather than make source-tree
internals public.

The source boundary has three layers:

1. `src/engine/` owns domain types, state transitions, scheduling, accepted
   events, and typed domain rejections.
2. `src/application/` owns the adapter-facing session facade, current engine
   state, in-memory accepted-event history, replay, and read-only projections.
3. Future `src/adapters/` modules translate CLI, UI, persistence, or other I/O
   concerns into and out of the application boundary.

Dependencies point inward only: adapters import application, and application
imports engine. Production adapters do not import engine internals. Focused
engine tests may use an explicit test-only path.

### Engine and application contracts

The engine transition boundary is functional. Explicit state plus one command
produces one of two results:

- accepted: a new state plus ordered accepted domain events;
- rejected: one ADR-0002 domain rejection, with the original state unchanged
  and no accepted event.

The engine does not mutate its input, append to external storage, or own an
event loop. The application facade submits commands one at a time, replaces
its current state only after an accepted transition, appends accepted events
to its in-memory history, exposes read-only projections, and can replay an
explicit scenario plus ordered commands from the beginning.

Boundary values are plain, structurally comparable data made from primitives,
arrays, and records. Class identity, callbacks, object addresses, `Date`,
`Map`, `Set`, and runtime-specific objects do not cross the boundary. This
keeps replay comparisons and adapter tests direct without selecting a storage
or wire serialization format.

An adapter parses untrusted external values before constructing an application
request. A malformed transport payload is an adapter failure and never an
accepted domain event. A validly shaped M1 request, including an unknown
command type or identifier, reaches the engine and follows ADR-0002's exact
rejection precedence. This ADR adds no domain rejection code.

Exact exported symbol names and field shapes are deliberately left to the
senior-authored red engine-contract tests that follow this ADR. Those tests may
name the interface, but they may not weaken the dependency direction or move
domain behavior into an adapter.

## Consequences

- The headless engine and a later browser adapter can share one typed domain
  implementation without a service boundary.
- Discriminated unions and strict checking make missing command, event, and
  rejection cases visible before runtime.
- Determinism remains testable with plain structural equality and explicit
  inputs.
- Runtime parsing is still required at external boundaries because TypeScript
  types are erased.
- The project accepts npm, the TypeScript compiler, a lockfile, and a compile
  step as development costs.
- Immutable transitions may allocate more short-lived objects than an
  in-place design. M1 is too small for that to be a material cost; measure
  before optimizing.
- A later adapter may use a framework, but the framework must fit this boundary
  and cannot become the engine's owner.

## Alternatives considered

**Plain JavaScript.** It would run in the same hosts with less setup, but it
would give up compile-time exhaustiveness for the closed command, event,
rejection, and lifecycle variants that define M1. The small compiler cost buys
direct evidence against omitted cases.

**Python.** It would make the initial headless engine quick to write and test,
but a browser interface would require a second implementation language, a
server boundary, or a browser-specific Python runtime. None is justified for
the first local vertical slice.

**Rust with native or WebAssembly targets.** Rust offers strong enums and
control over mutation, but adds a heavier build, ownership and interop surface,
and a WebAssembly boundary before M1 has a performance or distribution need.
Revisit it only with measured evidence, not anticipated scale.

**Implement inside the first UI framework.** This could reduce initial file
count, but it would let renderer lifecycle and framework state own domain
truth. That directly conflicts with ADR-0001 and would make headless replay an
afterthought.

**Start with separate engine and application packages.** This would enforce a
physical boundary, but no independent consumer, release cadence, or deployment
exists yet. Source boundaries plus controlled exports provide the needed
discipline without monorepo machinery.

## Reversal conditions

Supersede the language choice if measured implementation evidence shows that
portable TypeScript cannot support a required player experience, cannot
preserve deterministic behavior, or misses a demonstrated performance target
after profiling. Syntax preference and framework convenience are not evidence.

Extract a separate package or service when a real consumer needs independent
versioning, deployment, or runtime isolation, and only after contract tests
show the split preserves replay and domain ownership. A future UI framework
does not by itself satisfy that condition.
