# Manifest domain language and invariants

This document is the shared language for product decisions, code, tests, and
player-facing explanations. A later implementation may refine representations,
but it must not silently change these meanings or invariants.

## Terminology

### Operating day

The bounded simulation interval for one scenario. The first slice has one
start, one end, and no activity outside that interval.

### Simulation clock

The authoritative logical time inside an operating day. It advances because
the engine processes commands and scheduled events, never because wall time
passes.

### Location

A named node where a truck may begin, arrive, pick up a load, or deliver a
load. The first slice contains exactly three locations.

### Truck

A capacity-constrained vehicle that occupies a location or travels on one
declared leg. The first slice contains exactly two trucks.

### Load

A shipment with one origin, one destination, a size, and a lifecycle state.
The first slice contains exactly four loads.

### Dispatch

An accepted command assigning an eligible truck to a valid next action or
travel leg at a defined simulation time.

### Arrival

The event that completes a truck's declared travel leg and places it at the
leg's destination.

### Pickup

The state transition that moves an available load at its origin onto an
eligible co-located truck.

### Delivery

The state transition that moves a carried load off its co-located truck at the
load's destination and marks the load delivered.

### Event log

The append-only, ordered record of accepted domain facts. It explains how the
current state was reached and is the basis for replay and review.

## Load lifecycle

A load is in exactly one of these conceptual states:

1. `available`: waiting at its origin;
2. `in_transit`: carried by one truck;
3. `delivered`: completed at its destination.

The names may change only through an ADR or an explicit domain-contract change.
The ordering may not run backward.

## Invariants

1. **Time is monotonic.** No accepted command or event moves the simulation
   clock backward. Events at equal times have an explicit stable order.
2. **Identifiers are unique.** Every operating day, location, truck, load,
   command, and event has an identifier unique within its required scope.
3. **Truck position is singular.** Every truck has exactly one current location
   or one declared in-transit leg, never both and never neither.
4. **Load state is singular.** Every load has exactly one lifecycle state. An
   in-transit load is carried by at most one truck.
5. **Capacity cannot be exceeded.** The sum of carried load size never exceeds
   the truck's declared capacity.
6. **Pickup and delivery require co-location.** A truck may pick up only at the
   load's origin and deliver only at the load's destination.
7. **A delivered load is terminal.** It cannot be picked up, reassigned, moved,
   or delivered again.
8. **Travel is explicit.** A truck cannot teleport. Its location changes only
   through a declared leg followed by an arrival event.
9. **Invalid commands are atomic failures.** They emit a typed rejection and
   leave domain state unchanged.
10. **Determinism is observable.** Equal initial state, equal seed, and equal
    ordered commands produce an equal ordered event log and equal final state.
    In shorthand: equal ordered commands under equal starting conditions have
    equal outcomes.
11. **The operating-day boundary holds.** New work cannot start after day end;
    the final result reports delivered and undelivered loads explicitly.
12. **The engine owns truth.** UI projections, persistence adapters, and logs
    derived for display cannot create or alter domain facts.

## Resolved M1 contract

[ADR-0002](adr/0002-m1-scenario-semantics.md) binds the first implementation
to integer simulation minutes from 0 through 480, the fixed Depot, North, and
South scenario, two capacity-2 trucks, four declared loads, symmetric travel
durations, four command types, ordered typed rejections, and a delivered-load
count score with no due dates or lateness.

The ADR is authoritative when a concise rule here needs implementation detail.
Later milestones may add scenario configuration or richer scoring through a
successor decision, but M1 code must not invent or substitute those rules.
