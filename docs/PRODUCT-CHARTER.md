# Manifest product charter

## Player promise

Manifest lets a player run a compact logistics operation, make dispatch
decisions, and see the operational consequences clearly. The game should make
discipline rewarding: plan from explicit constraints, act through valid
commands, inspect what happened, and improve from evidence.

## Learning goals

The project teaches disciplined software engineering through a working game:

- translate product intent into explicit domain rules;
- separate deterministic business logic from presentation technology;
- make small vertical slices with observable outcomes;
- use tests, event history, and architecture decisions as durable evidence;
- route bounded implementation through Foreman without giving the worker
  product or architecture decisions.

## Initial scope

The initial playable slice is exactly one simulated operating day with:

- two trucks;
- four loads;
- three locations;
- a finite schedule of travel, pickup, and delivery activity;
- player dispatch choices;
- a deterministic day-end result that can be replayed.

The slice should be understandable in one sitting and complete enough to prove
the engine-to-interface path. It is not a prototype of every future system.

## Non-goals

This initialization ticket does not:

- build game functionality or executable simulation behavior;
- select or scaffold an application framework, language, renderer, or storage
  technology;
- implement multiplayer, networking, accounts, monetization, or live services;
- model a full transportation-management system, regulated operations, or
  real-world routing data;
- add procedural maps, open-ended economies, vehicle maintenance, staffing,
  weather, traffic, or stochastic disruptions;
- optimize for visual polish before the headless slice is correct and replayable.

## Success criteria

The first playable milestone succeeds when:

1. A player can understand the three locations, four loads, two trucks, and
   operating-day objective without outside explanation.
2. The same initial state, seed, and ordered commands always produce the same
   ordered events and final result.
3. The entire operating day can run without a graphical UI.
4. An interface can display state and submit commands without owning domain
   rules.
5. Invalid actions fail explicitly and leave state unchanged.
6. `make verify` proves the repository's documented contracts and later grows
   to prove the executable slice.

## Decision principles

- Prefer one complete, inspectable route through the system over broad feature
  coverage.
- Put domain rules in the simulation core, never in a UI adapter.
- Make time, ordering, identifiers, randomness, and invalid actions explicit.
- Record architecture choices as ADRs before scaffolding around them.
- Add a dependency only when a documented decision names the capability it
  buys.
- Keep outputs replayable and useful for both players and engineering review.
