import assert from "node:assert/strict";
import test from "node:test";

import { getScenarioProjection } from "../dist/application/index.js";

const expectedScenario = {
  dayEndMinute: 480,
  objective: {
    kind: "deliver_all_loads",
    loadIds: ["L1", "L2", "L3", "L4"],
  },
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
};

test("the application exposes a detached authored scenario projection", () => {
  const first = getScenarioProjection();
  assert.deepEqual(first, expectedScenario);

  first.objective.loadIds.push("MUTATED");
  first.locations.reverse();
  first.travelMinutes.Depot.North = 999;
  first.trucks.T1.capacity = 999;
  first.loads.L1.size = 999;

  const second = getScenarioProjection();
  assert.deepEqual(second, expectedScenario);
  assert.notStrictEqual(second, first);
  assert.notStrictEqual(second.objective, first.objective);
  assert.notStrictEqual(second.objective.loadIds, first.objective.loadIds);
  assert.notStrictEqual(second.locations, first.locations);
  assert.notStrictEqual(second.travelMinutes, first.travelMinutes);
  assert.notStrictEqual(second.travelMinutes.Depot, first.travelMinutes.Depot);
  assert.notStrictEqual(second.trucks, first.trucks);
  assert.notStrictEqual(second.loads, first.loads);
});
