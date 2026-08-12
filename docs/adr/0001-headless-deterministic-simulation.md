# ADR-0001: Headless deterministic simulation core

Date: 2026-08-11
Status: Accepted

## Context

Manifest must teach disciplined engineering while becoming a playable game.
Its first slice needs both trustworthy logistics rules and an interface, but no
application framework has been selected. If rules are implemented inside a UI,
the project cannot replay operating days reliably, test them cheaply, or change
presentation technology without rewriting domain behavior.

## Decision

The simulation core will be headless and deterministic. It will accept an
explicit scenario, seed, and ordered commands; validate each command; advance a
logical simulation clock; apply atomic state transitions; and emit an
append-only ordered event log.

The core will be independent of UI, wall-clock, network, filesystem,
persistence, and ambient randomness. Interfaces will submit commands and read
projections through boundaries owned by the core. Equal initial state, seed,
and ordered commands must produce equal events and final state.

This ADR does not select a language, application framework, UI toolkit,
persistence mechanism, or serialization format.

## Consequences

- The first operating day can be verified without rendering a screen.
- Replays and deterministic fixtures become first-class evidence.
- UI work can proceed against explicit commands and projections after the core
  contract exists.
- Time, ordering, identifier generation, and randomness must be injected or
  represented explicitly.
- Adapter boundaries add some up-front structure even in a small slice.
- A later framework must fit the core boundary, not redefine it.

## Alternatives considered

**Build the simulation directly in the first UI.** Rejected because UI events,
render timing, and domain transitions would become entangled before the rules
are stable.

**Use wall-clock updates as simulation time.** Rejected because tests and
replays would depend on machine timing and race conditions.

**Choose a full event-sourcing platform now.** Rejected because an ordered
domain event log is required, but infrastructure and persistence technology are
not. A framework would add commitment without evidence from a playable slice.

## Reversal conditions

Supersede this ADR only if measured implementation evidence shows that the
headless boundary prevents a required player experience or makes the vertical
slice materially less reliable or testable. UI-framework convenience alone is
not sufficient. Any successor must preserve deterministic scenario replay or
explain, with evidence, why replay is no longer a product requirement.
