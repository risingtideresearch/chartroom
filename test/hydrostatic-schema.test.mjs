import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const directory = new URL("../formats/hydrostatic-table/v1/", import.meta.url);
const read = (path) =>
  JSON.parse(readFileSync(new URL(path, directory), "utf8"));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(read("schema.json"));
const base = read("examples/upright-box.json");
const sample = (document) => document.table.rows[0].samples[0];

// Exercise annotation-generated constraints beyond the conformance fixtures.
const invalid = [
  ["empty name", (d) => (d.name = "")],
  ["empty origin description", (d) => (d.frame.originDescription = "")],
  ["empty body description", (d) => (d.body.description = "")],
  ["empty note", (d) => (d.notes = [""])],
  ["invalid schema URI", (d) => (d.$schema = "not a URI")],
  ["invalid timestamp", (d) => (d.source = { generatedAt: "yesterday" })],
  ["empty source string", (d) => (d.source = { tool: "" })],
  ["empty source note", (d) => (d.source = { notes: [""] })],
  ["unknown nested field", (d) => (sample(d).volumM3 = 1)],
  ["missing center", (d) => delete sample(d).buoyancyCenterM],
  ["short point", (d) => (sample(d).buoyancyCenterM = [0, 0])],
  ["long point", (d) => (sample(d).buoyancyCenterM = [0, 0, 0, 0])],
  ["nonnumeric point", (d) => (sample(d).buoyancyCenterM = [0, "0", 0])],
  ["off-centerplane K", (d) => (d.frame.knReferenceM = [0, 1, 0])],
  ["long K point", (d) => (d.frame.knReferenceM = [0, 0, 0, 0])],
  ["empty rows", (d) => (d.table.rows = [])],
  ["one sample", (d) => d.table.rows[0].samples.pop()],
  ["heel below bound", (d) => (d.table.rows[0].heelDeg = -180.1)],
  ["heel above bound", (d) => (d.table.rows[0].heelDeg = 180.1)],
  ["trim at lower bound", (d) => (d.table.rows[0].trimDeg = -90)],
  ["trim at upper bound", (d) => (d.table.rows[0].trimDeg = 90)],
  ["negative wetted area", (d) => (sample(d).wettedAreaM2 = -1)],
  ["null wetted area", (d) => (sample(d).wettedAreaM2 = null)],
  ["zero waterplane area", (d) => (sample(d).waterplane = { areaM2: 0 })],
  ["missing waterplane area", (d) => (sample(d).waterplane = {})],
  [
    "empty second moments",
    (d) => (sample(d).waterplane = { areaM2: 1, secondMomentsM4: {} }),
  ],
  [
    "negative xx moment",
    (d) => (sample(d).waterplane = { areaM2: 1, secondMomentsM4: { xx: -1 } }),
  ],
  [
    "negative yy moment",
    (d) => (sample(d).waterplane = { areaM2: 1, secondMomentsM4: { yy: -1 } }),
  ],
  [
    "empty marker points",
    (d) =>
      (d.immersionMarkers = [
        { id: "deck", label: "Deck", kind: "deck-edge", pointsM: [] },
      ]),
  ],
  ["array extensions", (d) => (d.extensions = [])],
];

for (const [name, edit] of invalid) {
  test(`structural constraint: ${name}`, () => {
    const document = structuredClone(base);
    edit(document);
    assert.equal(validate(document), false);
  });
}

const valid = [
  ["lower heel endpoint", (d) => (d.table.rows[0].heelDeg = -180)],
  ["upper heel endpoint", (d) => (d.table.rows[0].heelDeg = 180)],
  ["trim inside bounds", (d) => (d.table.rows[0].trimDeg = 89.9)],
  ["unknown waterplane", (d) => delete sample(d).waterplane],
  ["absent waterplane", (d) => (sample(d).waterplane = null)],
  ["zero wetted area", (d) => (sample(d).wettedAreaM2 = 0)],
  [
    "partial signed moment",
    (d) => (sample(d).waterplane = { areaM2: 1, secondMomentsM4: { xy: -1 } }),
  ],
  [
    "empty optional collections",
    (d) => Object.assign(d, { notes: [], immersionMarkers: [] }),
  ],
  [
    "empty optional objects",
    (d) => Object.assign(d, { source: {}, extensions: {} }),
  ],
  [
    "arbitrary extension metadata",
    (d) => (d.extensions = { "org.example": { nested: [null, true, 3, "x"] } }),
  ],
];

for (const [name, edit] of valid) {
  test(`structurally allowed: ${name}`, () => {
    const document = structuredClone(base);
    edit(document);
    assert.ok(validate(document), JSON.stringify(validate.errors));
  });
}

// Cover both union branches and the boundaries between them, independently of
// the generated schema's representation (anyOf versus a conditional).
test("sample union preserves volume, center, and waterplane rules", () => {
  const volumes = [
    undefined,
    null,
    "1",
    -1,
    -Number.MIN_VALUE,
    -0,
    0,
    Number.MIN_VALUE,
    1,
    Number.MAX_VALUE,
  ];
  const centers = [
    undefined,
    null,
    [],
    [0, 0],
    [0, 0, 0],
    [0, 0, 0, 0],
    [0, "0", 0],
    {},
  ];
  const waterplanes = [undefined, null, {}, { areaM2: 0 }, { areaM2: 1 }];
  for (const volume of volumes) {
    for (const center of centers) {
      for (const waterplane of waterplanes) {
        const document = structuredClone(base);
        const value = sample(document);
        value.volumeM3 = volume;
        value.buoyancyCenterM = center;
        value.waterplane = waterplane;
        if (volume === undefined) delete value.volumeM3;
        if (center === undefined) delete value.buoyancyCenterM;
        if (waterplane === undefined) delete value.waterplane;

        const isPoint =
          Array.isArray(center) &&
          center.length === 3 &&
          center.every((coordinate) => typeof coordinate === "number");
        const expected =
          typeof volume === "number" &&
          volume >= 0 &&
          (volume === 0 ? center === null : isPoint) &&
          (waterplane === undefined ||
            waterplane === null ||
            waterplane.areaM2 > 0);
        assert.equal(validate(document), expected, JSON.stringify(value));
      }
    }
  }
});
