import assert from "node:assert/strict";
import test from "node:test";

import {
  M1_SCENARIO,
  createInitialState,
  getResult,
  transition,
} from "../dist/engine/index.js";
import {
  createSession,
  projectSession,
  replayCommands,
  submitCommand,
} from "../dist/application/index.js";

const pickup = (truckId, loadId) => ({ type: "pickup", truckId, loadId });
const travel = (truckId, destinationId) => ({
  type: "travel",
  truckId,
  destinationId,
});
const deliver = (truckId, loadId) => ({ type: "deliver", truckId, loadId });
const advance = () => ({ type: "advance" });

function accepted(state, command) {
  const outcome = transition(state, command);
  assert.equal(outcome.ok, true, `expected ${command.type} to be accepted`);
  return outcome;
}

function rejected(state, command, code) {
  const before = structuredClone(state);
  const outcome = transition(state, command);
  assert.deepEqual(outcome, {
    ok: false,
    state,
    rejection: { code },
  });
  assert.deepEqual(state, before, `${code} mutated the input state`);
  return outcome;
}

function apply(state, command) {
  return accepted(state, command).state;
}

function stateAtNorthWithL1Delivered() {
  let state = createInitialState();
  state = apply(state, pickup("T1", "L1"));
  state = apply(state, travel("T1", "North"));
  state = apply(state, advance());
  return apply(state, deliver("T1", "L1"));
}

const completeDayCommands = [
  pickup("T1", "L1"),
  travel("T1", "North"),
  pickup("T2", "L2"),
  travel("T2", "South"),
  advance(),
  deliver("T1", "L1"),
  pickup("T1", "L3"),
  travel("T1", "South"),
  advance(),
  deliver("T2", "L2"),
  pickup("T2", "L4"),
  travel("T2", "Depot"),
  advance(),
  deliver("T1", "L3"),
  advance(),
  deliver("T2", "L4"),
];

test("the fixed M1 scenario and initial state are explicit plain data", () => {
  assert.deepEqual(M1_SCENARIO, {
    dayEndMinute: 480,
    locations: ["Depot", "North", "South"],
    travelMinutes: {
      Depot: { North: 60, South: 75 },
      North: { Depot: 60, South: 45 },
      South: { Depot: 75, North: 45 },
    },
    trucks: {
      T1: { id: "T1", initialLocationId: "Depot", capacity: 2 },
      T2: { id: "T2", initialLocationId: "Depot", capacity: 2 },
    },
    loads: {
      L1: { id: "L1", originId: "Depot", destinationId: "North", size: 2 },
      L2: { id: "L2", originId: "Depot", destinationId: "South", size: 1 },
      L3: { id: "L3", originId: "North", destinationId: "South", size: 1 },
      L4: { id: "L4", originId: "South", destinationId: "Depot", size: 2 },
    },
  });

  assert.deepEqual(createInitialState(), {
    minute: 0,
    nextEventSequence: 1,
    nextScheduleSequence: 1,
    trucks: {
      T1: {
        id: "T1",
        capacity: 2,
        position: { kind: "at", locationId: "Depot" },
        carriedLoadIds: [],
      },
      T2: {
        id: "T2",
        capacity: 2,
        position: { kind: "at", locationId: "Depot" },
        carriedLoadIds: [],
      },
    },
    loads: {
      L1: {
        id: "L1",
        originId: "Depot",
        destinationId: "North",
        size: 2,
        status: { kind: "available" },
      },
      L2: {
        id: "L2",
        originId: "Depot",
        destinationId: "South",
        size: 1,
        status: { kind: "available" },
      },
      L3: {
        id: "L3",
        originId: "North",
        destinationId: "South",
        size: 1,
        status: { kind: "available" },
      },
      L4: {
        id: "L4",
        originId: "South",
        destinationId: "Depot",
        size: 2,
        status: { kind: "available" },
      },
    },
    scheduledEvents: [],
  });
});

test("pickup is immutable and returns one ordered accepted event", () => {
  const initial = createInitialState();
  const before = structuredClone(initial);
  const outcome = accepted(initial, pickup("T1", "L1"));

  assert.deepEqual(initial, before);
  assert.notStrictEqual(outcome.state, initial);
  assert.deepEqual(outcome.events, [
    {
      type: "load_picked_up",
      sequence: 1,
      minute: 0,
      truckId: "T1",
      loadId: "L1",
    },
  ]);
  assert.deepEqual(outcome.state.trucks.T1.carriedLoadIds, ["L1"]);
  assert.deepEqual(outcome.state.loads.L1.status, {
    kind: "carried",
    truckId: "T1",
  });
  assert.equal(outcome.state.nextEventSequence, 2);
});

test("travel schedules arrival and advance prevents teleportation", () => {
  let state = apply(createInitialState(), pickup("T1", "L1"));
  const traveling = accepted(state, travel("T1", "North"));

  assert.deepEqual(traveling.events, [
    {
      type: "travel_started",
      sequence: 2,
      minute: 0,
      truckId: "T1",
      originId: "Depot",
      destinationId: "North",
      arrivalMinute: 60,
      scheduleSequence: 1,
    },
  ]);
  assert.deepEqual(traveling.state.trucks.T1.position, {
    kind: "in_transit",
    originId: "Depot",
    destinationId: "North",
    arrivalMinute: 60,
    scheduleSequence: 1,
  });
  assert.deepEqual(traveling.state.scheduledEvents, [
    {
      type: "truck_arrival",
      minute: 60,
      scheduleSequence: 1,
      truckId: "T1",
      originId: "Depot",
      destinationId: "North",
    },
  ]);

  const arrived = accepted(traveling.state, advance());
  assert.equal(arrived.state.minute, 60);
  assert.deepEqual(arrived.state.trucks.T1.position, {
    kind: "at",
    locationId: "North",
  });
  assert.deepEqual(arrived.events, [
    {
      type: "truck_arrived",
      sequence: 3,
      minute: 60,
      truckId: "T1",
      originId: "Depot",
      destinationId: "North",
    },
  ]);
});

test("equal-minute arrivals resolve by scheduling sequence", () => {
  let state = createInitialState();
  state = apply(state, travel("T2", "North"));
  state = apply(state, travel("T1", "North"));
  const outcome = accepted(state, advance());

  assert.deepEqual(
    outcome.events.map((event) => [event.truckId, event.sequence]),
    [
      ["T2", 3],
      ["T1", 4],
    ],
  );
  assert.equal(outcome.state.minute, 60);
  assert.deepEqual(outcome.state.scheduledEvents, []);
});

test("rejections follow ADR-0002 precedence and are atomic", () => {
  const initial = createInitialState();
  rejected(initial, { type: "reroute", truckId: "NOPE" }, "UNKNOWN_COMMAND");
  rejected(initial, pickup("NOPE", "MISSING"), "UNKNOWN_TRUCK");
  rejected(initial, pickup("T1", "MISSING"), "UNKNOWN_LOAD");
  rejected(initial, travel("T1", "Missing"), "UNKNOWN_LOCATION");
  rejected({ ...initial, minute: 480 }, pickup("T1", "L1"), "DAY_ENDED");

  let state = apply(initial, travel("T1", "North"));
  rejected(state, pickup("T1", "L1"), "TRUCK_IN_TRANSIT");

  state = stateAtNorthWithL1Delivered();
  rejected(state, pickup("T1", "L1"), "LOAD_ALREADY_DELIVERED");

  state = apply(initial, pickup("T1", "L1"));
  rejected(state, pickup("T2", "L1"), "LOAD_NOT_AVAILABLE");
  rejected(initial, deliver("T1", "L1"), "LOAD_NOT_CARRIED");

  state = stateAtNorthWithL1Delivered();
  rejected(state, pickup("T1", "L2"), "WRONG_LOCATION");
  rejected(initial, travel("T1", "Depot"), "INVALID_TRAVEL_LEG");

  state = apply(initial, pickup("T1", "L2"));
  rejected(state, pickup("T1", "L1"), "CAPACITY_EXCEEDED");
  rejected({ ...initial, minute: 450 }, travel("T1", "North"), "ARRIVAL_AFTER_DAY_END");
  rejected(initial, advance(), "NO_SCHEDULED_EVENT");
});

test("arrival and delivery at minute 480 are allowed, but new work is not", () => {
  let state = apply(createInitialState(), pickup("T1", "L1"));
  state = { ...state, minute: 420 };
  state = apply(state, travel("T1", "North"));
  state = apply(state, advance());
  assert.equal(state.minute, 480);
  state = apply(state, deliver("T1", "L1"));
  assert.deepEqual(state.loads.L1.status, {
    kind: "delivered",
    truckId: "T1",
    minute: 480,
  });
  rejected(state, pickup("T1", "L3"), "DAY_ENDED");
  rejected(state, travel("T1", "South"), "DAY_ENDED");
});

test("the complete M1 route finishes at minute 150 with the exact result", () => {
  let state = createInitialState();
  const history = [];
  for (const command of completeDayCommands) {
    const outcome = accepted(state, command);
    state = outcome.state;
    history.push(...outcome.events);
  }

  assert.deepEqual(getResult(state), {
    delivered_load_ids: ["L1", "L2", "L3", "L4"],
    undelivered_load_ids: [],
    delivered_count: 4,
    all_delivered: true,
    completion_minute: 150,
  });
  assert.deepEqual(
    history.filter((event) => event.type === "load_delivered").map((event) => event.loadId),
    ["L1", "L2", "L3", "L4"],
  );
  assert.equal(state.minute, 150);
});

test("application sessions own history, reject atomically, and expose projections", () => {
  const initial = createSession();
  assert.deepEqual(initial, { state: createInitialState(), events: [] });

  const picked = submitCommand(initial, pickup("T1", "L1"));
  assert.equal(picked.ok, true);
  assert.deepEqual(picked.acceptedEvents, picked.session.events);
  assert.deepEqual(initial, { state: createInitialState(), events: [] });

  const bad = submitCommand(picked.session, pickup("T2", "L1"));
  assert.deepEqual(bad, {
    ok: false,
    session: picked.session,
    rejection: { code: "LOAD_NOT_AVAILABLE" },
  });

  const projection = projectSession(picked.session);
  assert.deepEqual(projection, {
    minute: 0,
    trucks: picked.session.state.trucks,
    loads: picked.session.state.loads,
    result: {
      delivered_load_ids: [],
      undelivered_load_ids: ["L1", "L2", "L3", "L4"],
      delivered_count: 0,
      all_delivered: false,
    },
  });
  assert.notStrictEqual(projection.trucks, picked.session.state.trucks);
  assert.notStrictEqual(projection.loads, picked.session.state.loads);
});

test("application replay is deterministic and reports the first rejection", () => {
  const first = replayCommands(completeDayCommands);
  const second = replayCommands(structuredClone(completeDayCommands));
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.deepEqual(getResult(first.session.state), {
    delivered_load_ids: ["L1", "L2", "L3", "L4"],
    undelivered_load_ids: [],
    delivered_count: 4,
    all_delivered: true,
    completion_minute: 150,
  });

  assert.deepEqual(replayCommands([pickup("T1", "L1"), pickup("T2", "L1")]), {
    ok: false,
    commandIndex: 1,
    session: submitCommand(createSession(), pickup("T1", "L1")).session,
    rejection: { code: "LOAD_NOT_AVAILABLE" },
  });
});
