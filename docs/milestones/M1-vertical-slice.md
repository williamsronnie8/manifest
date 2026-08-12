# M1: One-day dispatch vertical slice

## Outcome

A player can plan and execute four loads among three locations using two trucks
during one operating day, observe the consequences of each accepted decision,
and reach an explicit day-end result. The slice proves one complete path from
player command through the headless engine to a usable interface projection.

## Required player loop

1. Inspect the initial locations, trucks, loads, capacities, travel durations,
   operating-day limit, and objective.
2. Choose valid dispatch, pickup, travel, and delivery actions.
3. Advance the simulation through explicit commands or the next scheduled
   event.
4. See accepted events, current truck and load state, and typed reasons for
   rejected actions.
5. Finish the day and see delivered loads, undelivered loads, and the defined
   result or score.
6. Replay the same scenario and commands to reproduce the outcome.

## Acceptance scenarios

The fixed scenario and command semantics are defined by ADR-0002. The valid
complete-day route delivers L1 and L3 with T1, and L2 and L4 with T2. Its final
delivery occurs at minute 150.

1. **Complete day:** a valid command sequence delivers all four loads with two
   trucks before the operating day ends and reports `delivered_count: 4`,
   `all_delivered: true`, and `completion_minute: 150`.
2. **Capacity rejection:** a pickup that would exceed truck capacity is
   rejected as `CAPACITY_EXCEEDED` and changes no state.
3. **Location rejection:** pickup or delivery without required co-location is
   rejected as `WRONG_LOCATION` and changes no state.
4. **No teleportation:** truck location changes only after a declared travel
   leg reaches an arrival event.
5. **Terminal delivery:** a delivered load cannot be moved or delivered again.
6. **Day boundary:** work that cannot validly begin after day end is rejected,
   travel that would arrive after minute 480 returns
   `ARRIVAL_AFTER_DAY_END`, and undelivered loads remain visible in the result.
7. **Replay:** the same scenario, seed, and ordered commands produce the same
   ordered event log and final state in repeated headless runs.
8. **Interface parity:** the playable interface reports the same state and
   result as the headless run; it owns no logistics rule.

Every rejected command returns the first applicable rejection code in
ADR-0002's precedence, appends no accepted event, consumes no event sequence,
does not advance time, and leaves domain state unchanged.

## Engineering exit criteria

- The domain decisions formerly left open in `docs/DOMAIN.md` remain resolved
  by ADR-0002; implementation does not substitute different constants or
  rejection semantics.
- The deterministic simulation engine runs the complete scenario without a UI.
- Unit tests cover every domain invariant exercised by M1.
- At least one end-to-end headless fixture proves the complete-day scenario and
  replay equality.
- Adapter tests prove commands and projections cross the UI boundary without
  duplicating engine rules.
- `make verify` runs all repository checks from the root with a nonzero exit on
  failure.
- No unresolved blocker is disguised as a default value or inferred domain
  rule.

## Out of scope

- More than two trucks, four loads, three locations, or one operating day.
- Multiplayer, remote services, accounts, monetization, or real map data.
- Dynamic traffic, weather, breakdowns, staffing, fuel, maintenance, or an
  open-ended economy.
- Save migration, cloud sync, analytics, modding, localization, and production
  deployment.
- Framework selection inside this initialization. A later ADR must justify it
  before scaffolding begins.

## Suggested ticket sequence

This sequence records dependencies, not authorization to implement:

1. decide the remaining M1 domain constants and rejection taxonomy;
2. choose the implementation language and application boundary through an ADR;
3. define red engine contracts for state, commands, events, and replay;
4. implement the headless complete-day scenario;
5. select the smallest interface approach supported by evidence;
6. connect projections and commands into the playable loop;
7. verify all acceptance scenarios and capture the milestone evidence.
