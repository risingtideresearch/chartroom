import assert from "node:assert/strict";

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const refKey = (r) => JSON.stringify([r.meshId, r.regionId]);
/** Limited fixture checker, not a public geometry validator or solver. */
function checkFixtureSemantics(doc) {
  const uniqueIds = (items) =>
    assert.equal(
      new Set(items.map((i) => i.id)).size,
      items.length,
      "unique ids",
    );
  uniqueIds(doc.meshes);
  uniqueIds(doc.bodies);
  uniqueIds(doc.envelopes ?? []);
  uniqueIds(doc.references ?? []);
  const regions = new Map();
  for (const mesh of doc.meshes) {
    uniqueIds(mesh.regions);
    assert.ok(mesh.verticesM.flat().every(Number.isFinite), "finite vertices");
    const triangles = mesh.triangles.map((ids) => {
      assert.ok(
        ids.every((i) => i < mesh.verticesM.length),
        "vertex range",
      );
      const p = ids.map((i) => mesh.verticesM[i]);
      assert.ok(
        Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) > 0,
        "nondegenerate triangles",
      );
      return p;
    });
    const assigned = new Set();
    for (const region of mesh.regions) {
      for (const i of region.triangleIndices) {
        assert.ok(i < triangles.length, "triangle range");
        assert.ok(!assigned.has(i), "disjoint regions");
        assigned.add(i);
      }
      regions.set(refKey({ meshId: mesh.id, regionId: region.id }), {
        representation: region.representation,
        triangles: region.triangleIndices.map((i) => triangles[i]),
      });
    }
    assert.equal(assigned.size, triangles.length, "exhaustive regions");
  }
  const owner = new Map();
  for (const body of doc.bodies) {
    assert.ok(
      body.centerplaneYM === undefined || Number.isFinite(body.centerplaneYM),
      "finite centreplane",
    );
    for (const r of body.regions) {
      const key = refKey(r);
      assert.ok(regions.has(key), "region reference");
      assert.ok(!owner.has(key), "single body membership");
      owner.set(key, body.id);
    }
  }
  assert.equal(owner.size, regions.size, "every region has a body");
  for (const envelope of doc.envelopes ?? []) {
    assert.ok(
      doc.bodies.some((b) => b.id === envelope.bodyId),
      "body reference",
    );
    const selected = new Set();
    const edges = new Map();
    for (const r of envelope.regions) {
      const key = refKey(r);
      assert.ok(!selected.has(key), "unique envelope selection");
      selected.add(key);
      assert.equal(owner.get(key), envelope.bodyId, "envelope body membership");
      const region = regions.get(key);
      assert.notEqual(
        region.representation,
        "reference",
        "not a volume surface",
      );
      // Exact coordinates join boundaries across meshes for these fixtures.
      for (const p of region.triangles) {
        for (let i = 0; i < 3; i++) {
          const a = JSON.stringify(p[i]);
          const b = JSON.stringify(p[(i + 1) % 3]);
          const key = JSON.stringify([a, b].sort());
          const edge = edges.get(key) ?? { count: 0, direction: 0 };
          edge.count++;
          edge.direction += a < b ? 1 : -1;
          edges.set(key, edge);
        }
      }
    }
    assert.ok(
      [...edges.values()].every((e) => e.count === 2 && e.direction === 0),
      "closed, consistently oriented edges",
    );
    // This does not prove vertex manifoldness, absence of intersections, or
    // outward cavity orientation; those remain normative consumer checks.
  }
  for (const r of doc.references ?? []) {
    if (r.kind === "plane") {
      assert.ok(r.normal.every(Number.isFinite) && Number.isFinite(r.offsetM));
      assert.ok(Math.abs(Math.hypot(...r.normal) - 1) < 1e-12, "unit normal");
    } else {
      const points = r.kind === "point" ? [r.pointM] : r.pointsM;
      assert.ok(
        points.flat().every(Number.isFinite),
        "finite reference points",
      );
      if (r.kind === "polyline") {
        assert.ok(
          points.slice(1).every((p, i) => Math.hypot(...sub(p, points[i])) > 0),
          "nonzero polyline segments",
        );
        if (r.closed) assert.notDeepEqual(points[0], points[points.length - 1]);
      }
    }
  }
  if (doc.referenceState)
    assert.ok(Object.values(doc.referenceState).every(Number.isFinite));
}

// Test-only checks, not a public solid validator. Call after structural validation.
export function semanticErrors(document) {
  function finite(value) {
    if (typeof value === "number") return Number.isFinite(value);
    if (value && typeof value === "object")
      return Object.values(value).every(finite);
    return true;
  }
  if (!finite(document)) return ["finite"];
  try {
    checkFixtureSemantics(document);
    return [];
  } catch (error) {
    if (error instanceof assert.AssertionError)
      return [error.message.split("\n")[0]];
    throw error;
  }
}
