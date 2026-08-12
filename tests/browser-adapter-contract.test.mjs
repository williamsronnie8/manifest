import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getScenarioProjection } from "../dist/application/index.js";
import {
  mountManifest,
  parseCommandInput,
} from "../dist/adapters/browser/index.js";

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

test("the browser adapter is Node-safe and imports only the application facade", async () => {
  assert.equal(typeof parseCommandInput, "function");
  assert.equal(typeof mountManifest, "function");

  const module = await import("../dist/adapters/browser/index.js");
  assert.deepEqual(Object.keys(module).sort(), ["mountManifest", "parseCommandInput"]);

  const source = await readFile(
    new URL("../src/adapters/browser/index.ts", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(imports, ["../../application/index.js"]);
  assert.doesNotMatch(source, /engine\/index|\.\.\/\.\.\/engine/);
});

test("parseCommandInput constructs every command without mutating external values", () => {
  const cases = [
    [
      { type: "pickup", truckId: "T1", loadId: "L1" },
      { ok: true, command: { type: "pickup", truckId: "T1", loadId: "L1" } },
    ],
    [
      { type: "travel", truckId: "T2", destinationId: "South" },
      {
        ok: true,
        command: { type: "travel", truckId: "T2", destinationId: "South" },
      },
    ],
    [
      { type: "deliver", truckId: "T1", loadId: "L3" },
      { ok: true, command: { type: "deliver", truckId: "T1", loadId: "L3" } },
    ],
    [{ type: "advance" }, { ok: true, command: { type: "advance" } }],
    [
      { type: "pickup", truckId: "UNKNOWN_TRUCK", loadId: "UNKNOWN_LOAD" },
      {
        ok: true,
        command: {
          type: "pickup",
          truckId: "UNKNOWN_TRUCK",
          loadId: "UNKNOWN_LOAD",
        },
      },
    ],
  ];

  for (const [input, expected] of cases) {
    const before = structuredClone(input);
    assert.deepEqual(parseCommandInput(input), expected);
    assert.deepEqual(input, before);
  }
});

test("parseCommandInput reports the first malformed field and throws nothing", () => {
  const malformed = [
    [null, "command"],
    [[], "command"],
    ["pickup", "command"],
    [{}, "type"],
    [{ type: 1 }, "type"],
    [{ type: "reroute" }, "type"],
    [{ type: "pickup" }, "truckId"],
    [{ type: "pickup", truckId: "", loadId: "L1" }, "truckId"],
    [{ type: "pickup", truckId: 1, loadId: "L1" }, "truckId"],
    [{ type: "pickup", truckId: "T1" }, "loadId"],
    [{ type: "pickup", truckId: "T1", loadId: "" }, "loadId"],
    [{ type: "travel", truckId: "T1" }, "destinationId"],
    [{ type: "travel", truckId: "T1", destinationId: 1 }, "destinationId"],
    [{ type: "deliver", truckId: "T1" }, "loadId"],
  ];

  for (const [input, field] of malformed) {
    const before = structuredClone(input);
    assert.doesNotThrow(() => parseCommandInput(input));
    assert.deepEqual(parseCommandInput(input), {
      ok: false,
      error: { code: "MALFORMED_INPUT", field },
    });
    assert.deepEqual(input, before);
  }
});
