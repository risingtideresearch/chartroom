import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { semanticErrors } from "./marine-geometry-semantics.mjs";

const base = new URL("../formats/marine-geometry/v1/", import.meta.url);
const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, base), "utf8"));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(readJson("schema.json"));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

test("marine geometry: structural boundaries, semantic checks, and analytic selections", () => {
  const minimal = {
    format: "marine-geometry",
    version: 1,
    frame: {
      axes: "x-forward-y-port-z-up",
      originDescription: "Authored origin",
    },
    meshes: [
      {
        id: "m",
        verticesM: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        triangles: [[0, 1, 2]],
        regions: [
          { id: "r", representation: "physical", triangleIndices: [0] },
        ],
      },
    ],
    bodies: [
      { id: "h", kind: "hull", regions: [{ meshId: "m", regionId: "r" }] },
    ],
  };
  const capped = readJson("examples/capped-box.json");
  const open = readJson("examples/open-box.json");
  for (const doc of [minimal, capped, open]) {
    assert.ok(validate(doc), JSON.stringify(validate.errors));
    assert.deepEqual(semanticErrors(doc), []);
  }
  assert.equal(
    open.envelopes,
    undefined,
    "open shells do not promise a volume",
  );
  // Explicit two-hull membership survives without component clustering.
  const twin = structuredClone(capped);
  const second = structuredClone(twin.meshes[0]);
  second.id = "second";
  second.verticesM = second.verticesM.map(([x, y, z]) => [x, y + 4, z]);
  twin.meshes.push(second);
  twin.bodies.push({
    id: "second-hull",
    kind: "hull",
    centerplaneYM: 4,
    regions: second.regions.map((r) => ({ meshId: second.id, regionId: r.id })),
  });
  assert.ok(validate(twin), JSON.stringify(validate.errors));
  assert.deepEqual(semanticErrors(twin), []);
  // Structural invalid fixtures: all constraints originate in types.ts.
  const structural = [
    ["fractional vertex index", (d) => (d.meshes[0].triangles[0][0] = 0.5)],
    ["negative vertex index", (d) => (d.meshes[0].triangles[0][0] = -1)],
    [
      "duplicate region index",
      (d) => d.meshes[0].regions[0].triangleIndices.push(0),
    ],
    [
      "fractional region index",
      (d) => (d.meshes[0].regions[0].triangleIndices[0] = 0.5),
    ],
    ["empty geometry", (d) => (d.meshes = [])],
    ["empty bodies", (d) => (d.bodies = [])],
    ["empty regions", (d) => (d.meshes[0].regions = [])],
    ["empty id", (d) => (d.meshes[0].id = "")],
    [
      "undisclosed idealization",
      (d) => delete d.meshes[0].regions[3].description,
    ],
    ["out-of-range trim", (d) => (d.referenceState.trimDeg = 90)],
    ["out-of-range heel", (d) => (d.referenceState.heelDeg = 181)],
    ["unknown field", (d) => Object.assign(d, { unit: "mm" })],
    [
      "unknown nested field",
      (d) => Object.assign(d.meshes[0], { normals: [] }),
    ],
    [
      "wrong axes",
      (d) => Object.assign(d.frame, { axes: "x-forward-y-starboard-z-up" }),
    ],
    [
      "short point tuple",
      (d) => Object.assign(d.meshes[0].verticesM, { 0: [0, 0] }),
    ],
    [
      "long triangle tuple",
      (d) => Object.assign(d.meshes[0].triangles, { 0: [0, 1, 2, 3] }),
    ],
    [
      "short polyline",
      (d) => Object.assign(d.references[2], { pointsM: [[0, 0, 0]] }),
    ],
  ];
  for (const [name, mutate] of structural) {
    const doc = structuredClone(capped);
    mutate(doc);
    assert.equal(validate(doc), false, name);
  }
  // Semantic invalid fixtures deliberately PASS the structural schema.
  const semantic = [
    ["vertex range", (d) => (d.meshes[0].triangles[0][0] = 99)],
    ["triangle range", (d) => (d.meshes[0].regions[0].triangleIndices[0] = 99)],
    ["disjoint regions", (d) => d.meshes[0].regions[1].triangleIndices.push(0)],
    ["exhaustive regions", (d) => d.meshes[0].regions[0].triangleIndices.pop()],
    ["region reference", (d) => (d.bodies[0].regions[0].meshId = "missing")],
    ["unique ids", (d) => d.bodies.push(structuredClone(d.bodies[0]))],
    [
      "single body membership",
      (d) => d.bodies[0].regions.push(d.bodies[0].regions[0]),
    ],
    ["body reference", (d) => (d.envelopes[0].bodyId = "missing")],
    [
      "closed, consistently oriented edges",
      (d) => d.envelopes[0].regions.pop(),
    ],
    [
      "not a volume surface",
      (d) => (d.meshes[0].regions[0].representation = "reference"),
    ],
    ["nondegenerate triangles", (d) => (d.meshes[0].triangles[0][0] = 2)],
    [
      "unit normal",
      (d) => Object.assign(d.references[0], { normal: [0, 0, 2] }),
    ],
  ];
  for (const [name, mutate] of semantic) {
    const doc = structuredClone(capped);
    mutate(doc);
    assert.ok(validate(doc), `${name}: ${JSON.stringify(validate.errors)}`);
    assert.ok(
      semanticErrors(doc).includes(name),
      JSON.stringify(semanticErrors(doc)),
    );
  }
  const extended = {
    ...minimal,
    extensions: { "org.camber.experiment": { color: "pink" } },
  };
  assert.ok(validate(extended), JSON.stringify(validate.errors));
  // Independent analytic fixture: surface selections do not silently include caps.
  const mesh = capped.meshes[0];
  const area = (indices) =>
    indices.reduce((sum, i) => {
      const [a, b, c] = mesh.triangles[i].map((j) => mesh.verticesM[j]);
      return sum + Math.hypot(...cross(sub(b, a), sub(c, a))) / 2;
    }, 0);
  assert.equal(area(mesh.regions[0].triangleIndices), 24);
  assert.equal(area(mesh.regions[3].triangleIndices), 8);
  assert.equal(
    area(
      mesh.regions
        .filter((r) => r.representation === "physical")
        .flatMap((r) => r.triangleIndices),
    ),
    32,
  );
  const volume = mesh.triangles.reduce((sum, t) => {
    const [a, b, c] = t.map((i) => mesh.verticesM[i]);
    return sum + dot(a, cross(b, c)) / 6;
  }, 0);
  assert.ok(Math.abs(volume - 16) < 1e-12);
  const volumeMoment = [0, 0, 0];
  for (const t of mesh.triangles) {
    const [a, b, c] = t.map((i) => mesh.verticesM[i]);
    const tetraVolume = dot(a, cross(b, c)) / 6;
    for (let k = 0; k < 3; k++)
      volumeMoment[k] += (tetraVolume * (a[k] + b[k] + c[k])) / 4;
  }
  for (const [k, expected] of [2, 0, 1].entries())
    assert.ok(Math.abs(volumeMoment[k] / volume - expected) < 1e-12);
  const shellMoment = [0, 0, 0];
  for (const i of mesh.regions[0].triangleIndices) {
    const [a, b, c] = mesh.triangles[i].map((j) => mesh.verticesM[j]);
    const triangleArea = area([i]);
    for (let k = 0; k < 3; k++)
      shellMoment[k] += (triangleArea * (a[k] + b[k] + c[k])) / 3;
  }
  for (const [k, expected] of [2, 0, 2 / 3].entries())
    assert.ok(Math.abs(shellMoment[k] / 24 - expected) < 1e-12);
});

test("marine geometry: numeric overflow is not a finite coordinate", () => {
  const doc = readJson("examples/open-box.json");
  doc.meshes[0].verticesM[0][0] = JSON.parse("1e400");
  assert.ok(semanticErrors(doc).includes("finite"));
});
