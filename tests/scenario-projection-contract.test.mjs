import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const applicationSource = await readFile(
  new URL("../src/application/index.ts", import.meta.url),
  "utf8",
);
const applicationDeclaration = await readFile(
  new URL("../dist/application/index.d.ts", import.meta.url),
  "utf8",
);

const expectedProjectionDeclaration = `export interface ScenarioProjection {
    dayEndMinute: number;
    objective: {
        kind: string;
        loadIds: string[];
    };
    locations: string[];
    travelMinutes: Record<string, Record<string, number>>;
    trucks: Record<string, {
        id: string;
        initialLocationId: string;
        capacity: number;
    }>;
    loads: Record<string, {
        id: string;
        originId: string;
        destinationId: string;
        size: number;
    }>;
}`;

const startMarker = "  // BEGIN T-0075 PROJECTION BODY\n";
const endMarker = "  // END T-0075 PROJECTION BODY\n";
const expectedPrefixHash =
  "71c6634c801a05548ae66174b1debf8562bf05b9f19ab5a114907ad00c731390";
const expectedSuffixHash =
  "917acf0e3430badb08d1c94e053477fc9a48b06bf701672b93cfc03ad65c8cf9";

test("ScenarioProjection is an exact public mutable plain-data type", () => {
  assert.ok(applicationDeclaration.includes(expectedProjectionDeclaration));
  assert.match(
    applicationDeclaration,
    /export declare function getScenarioProjection\(\): ScenarioProjection;/,
  );

  const declarationStart = applicationDeclaration.indexOf(
    "export interface ScenarioProjection",
  );
  const declarationEnd = applicationDeclaration.indexOf(
    "export declare function createSession",
    declarationStart,
  );
  assert.notEqual(declarationStart, -1);
  assert.notEqual(declarationEnd, -1);
  const projectionDeclaration = applicationDeclaration.slice(
    declarationStart,
    declarationEnd,
  );
  assert.doesNotMatch(projectionDeclaration, /\breadonly\b/);
  assert.doesNotMatch(
    projectionDeclaration,
    /import\(|\b(?:Scenario|TruckDefinition|LoadDefinition|LocationId|TruckId|LoadId)\b/,
  );
});

test("only the marked getScenarioProjection body is replaceable", () => {
  assert.equal(applicationSource.split(startMarker).length - 1, 1);
  assert.equal(applicationSource.split(endMarker).length - 1, 1);
  assert.match(
    applicationSource,
    /export function getScenarioProjection\(\): ScenarioProjection \{/,
  );

  const bodyStart = applicationSource.indexOf(startMarker) + startMarker.length;
  const bodyEnd = applicationSource.indexOf(endMarker);
  assert.ok(bodyStart >= startMarker.length);
  assert.ok(bodyEnd >= bodyStart);

  assert.equal(sha256(applicationSource.slice(0, bodyStart)), expectedPrefixHash);
  assert.equal(sha256(applicationSource.slice(bodyEnd)), expectedSuffixHash);
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
