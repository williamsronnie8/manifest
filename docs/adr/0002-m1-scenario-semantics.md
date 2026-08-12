# ADR-0002: M1 scenario semantics

Date: 2026-08-11
Status: Accepted

## Context

ADR-0001 fixes Manifest's headless deterministic boundary, but M1 cannot be
implemented without concrete time, capacity, travel, rejection, and scoring
rules. Leaving those choices to implementation would let code silently define
the product and would make replay fixtures ambiguous.

## Decision

The constants and rules below are the complete M1 scenario contract. They are
deliberately small and fixed. Later milestones may add scenario data or richer
rules through a successor ADR, but M1 code and tests must not infer alternatives.

## Time and event ordering

Simulation time is an integer number of minutes from day start. M1 begins at
minute `0` and ends at minute `480`. The engine never reads wall time.

Every scheduled event receives a monotonic scheduling sequence when it is
created. Events are ordered first by minute and then by that sequence. All due
scheduled events at a minute resolve before the next player command at that
minute. Accepted instantaneous commands at the same minute retain their input
order.

## M1 scenario

Travel is symmetric and fixed:

| Origin | Destination | Minutes |
| --- | --- | ---: |
| Depot | North | 60 |
| North | South | 45 |
| South | Depot | 75 |

The reverse direction has the same duration. Travel to a truck's current
location is not a valid leg.

Both trucks begin at Depot. Capacity and load size use integer cargo units.

| Truck | Initial location | Capacity |
| --- | --- | ---: |
| T1 | Depot | 2 |
| T2 | Depot | 2 |

| Load | Origin | Destination | Size |
| --- | --- | --- | ---: |
| L1 | Depot | North | 2 |
| L2 | Depot | South | 1 |
| L3 | North | South | 1 |
| L4 | South | Depot | 2 |

## Commands

M1 accepts four command types: `pickup`, `travel`, `deliver`, and `advance`.

- `pickup(truck_id, load_id)` moves an available, co-located load onto a truck
  when capacity permits.
- `travel(truck_id, destination_id)` declares a valid leg and schedules its
  arrival. The truck and its carried loads remain in transit until arrival.
- `deliver(truck_id, load_id)` completes a carried load at its destination.
- `advance()` advances to the next scheduled event minute and resolves every
  event due then in scheduling-sequence order. With no scheduled event it
  returns `NO_SCHEDULED_EVENT` without changing state.

Pickup, travel, and delivery are instantaneous at the current minute. A travel
command is valid only when its arrival is no later than minute 480:
arrival exactly at minute 480 is allowed, and a later arrival is rejected. At
minute 480, delivery at minute 480 is allowed, while
pickup and `travel` at minute 480 return `DAY_ENDED`.

## Rejection contract

An invalid command returns exactly one typed rejection code. A rejection
appends no accepted domain event, consumes no event sequence,
does not advance simulation time, and leaves domain state unchanged.
Diagnostic text may add context but is not part of the stable contract.

The engine validates in the order below and returns the first applicable code.
Codes that do not apply to a command type are skipped.

### Rejection precedence

1. `UNKNOWN_COMMAND`: the command type is not one of the four M1 commands.
2. `UNKNOWN_TRUCK`: pickup, travel, or delivery names no scenario truck.
3. `UNKNOWN_LOAD`: pickup or delivery names no scenario load.
4. `UNKNOWN_LOCATION`: travel names no scenario location.
5. `DAY_ENDED`: pickup or travel is attempted at minute 480; any command is
   attempted after minute 480, should an invalid state expose such a time.
6. `TRUCK_IN_TRANSIT`: pickup, travel, or delivery targets a traveling truck.
7. `LOAD_ALREADY_DELIVERED`: pickup or delivery targets a delivered load.
8. `LOAD_NOT_AVAILABLE`: pickup targets a load already carried by a truck.
9. `LOAD_NOT_CARRIED`: delivery targets a load not carried by the named truck.
10. `WRONG_LOCATION`: pickup is not at the load origin, or delivery is not at
    the load destination.
11. `INVALID_TRAVEL_LEG`: travel targets the truck's current location.
12. `CAPACITY_EXCEEDED`: pickup would put carried size above truck capacity.
13. `ARRIVAL_AFTER_DAY_END`: travel would arrive after minute 480.
14. `NO_SCHEDULED_EVENT`: advance is requested with no scheduled event.

## Result and scoring

M1 has no due dates or lateness. At day end, or when requested after all loads
are delivered, the result contains:

- delivered load IDs in ascending identifier order;
- undelivered load IDs in ascending identifier order;
- `delivered_count`, an integer from 0 through 4;
- `all_delivered`, true only when `delivered_count` is 4;
- `completion_minute` only when all four loads are delivered.

The M1 score is exactly `delivered_count`. There is no time bonus, lateness
penalty, distance penalty, or hidden adjustment.

## Complete-day proof

This accepted command sequence proves that all four loads can be delivered.
Commands shown at the same minute execute in the listed order. Each `advance`
resolves the next arrival or arrivals before the following command.

| Minute | Command or resolved event | Result |
| ---: | --- | --- |
| 0 | T1 pickup L1; T1 travel North | T1 arrival scheduled for 60 |
| 0 | T2 pickup L2; T2 travel South | T2 arrival scheduled for 75 |
| 60 | advance; T1 arrives North | T1 and L1 at North |
| 60 | T1 deliver L1; T1 pickup L3; T1 travel South | T1 arrival scheduled for 105 |
| 75 | advance; T2 arrives South | T2 and L2 at South |
| 75 | T2 deliver L2; T2 pickup L4; T2 travel Depot | T2 arrival scheduled for 150 |
| 105 | advance; T1 arrives South | T1 and L3 at South |
| 105 | T1 deliver L3 | L1, L2, and L3 delivered |
| 150 | advance; T2 arrives Depot | T2 and L4 at Depot |
| 150 | T2 deliver L4 | All four delivered |

The final delivery occurs at minute 150, so the result has
`delivered_count: 4`, `all_delivered: true`, and `completion_minute: 150`.

## Consequences

- Engine contracts and replay fixtures now have one interpretation.
- M1 is feasible and exercises capacity, co-location, travel, event order,
  terminal delivery, and day-end rules.
- The scenario is intentionally authored rather than configurable in M1.
- Framework, language, UI, persistence, and serialization choices remain open.

## Alternatives considered

**Use clock timestamps and real distances.** Rejected because they add parsing,
time-zone, and routing concerns without improving the first learning slice.

**Score speed or lateness.** Rejected because M1 has no due-date model and a
second objective would obscure whether the logistics loop itself works.

**Let implementation select convenient constants.** Rejected because the
worker would be making product decisions and the acceptance fixtures would not
be independent.

## Reversal conditions

Supersede this ADR if implementation evidence proves the fixed scenario cannot
exercise a required M1 invariant, or if play evidence shows the resulting loop
cannot teach a meaningful dispatch choice. Convenience of a chosen framework
or implementation language is not sufficient.
