import assert from "node:assert/strict";
import test from "node:test";

import { parseCommandInput } from "../dist/adapters/browser/parse-command.js";

test("parseCommandInput constructs detached commands from valid shapes", () => {
  const cases = [
    [
      { type: "pickup", truckId: "T1", loadId: "L1", ignored: true },
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
    [{ type: "advance", ignored: true }, { ok: true, command: { type: "advance" } }],
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
    [
      { type: "travel", truckId: " ", destinationId: " " },
      { ok: true, command: { type: "travel", truckId: " ", destinationId: " " } },
    ],
  ];

  for (const [input, expected] of cases) {
    const before = structuredClone(input);
    const parsed = parseCommandInput(input);
    assert.deepEqual(parsed, expected);
    assert.deepEqual(input, before);
    if (parsed.ok) assert.notStrictEqual(parsed.command, input);
  }
});

test("parseCommandInput reports the first malformed field and never throws", () => {
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
    [{ type: "travel" }, "truckId"],
    [{ type: "travel", truckId: "T1" }, "destinationId"],
    [{ type: "travel", truckId: "T1", destinationId: 1 }, "destinationId"],
    [{ type: "deliver" }, "truckId"],
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
