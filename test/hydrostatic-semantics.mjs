// Test-only implementation of the specification's cross-field rules.
// Not a public solver or a guarantee of physical accuracy. Call after structural validation.
export function semanticErrors(document) {
  const errors = new Set();
  const fail = (code) => errors.add(code);
  function finite(value) {
    if (typeof value === "number" && !Number.isFinite(value)) fail("finite");
    else if (value && typeof value === "object")
      Object.values(value).forEach(finite);
  }
  finite(document);

  const rows = document.table.rows;
  const heels = [...new Set(rows.map((row) => row.heelDeg))].sort(
    (a, b) => a - b,
  );
  const trims = [...new Set(rows.map((row) => row.trimDeg))].sort(
    (a, b) => a - b,
  );
  const pairs = new Set();
  for (const [i, row] of rows.entries()) {
    const key = JSON.stringify([row.heelDeg, row.trimDeg]);
    if (pairs.has(key)) fail("duplicate-attitude");
    pairs.add(key);
    if (i) {
      const previous = rows[i - 1];
      if (!(
        row.trimDeg > previous.trimDeg ||
        (row.trimDeg === previous.trimDeg && row.heelDeg > previous.heelDeg)
      )) {
        fail("row-order");
      }
    }
    const heel = (row.heelDeg * Math.PI) / 180;
    const trim = (row.trimDeg * Math.PI) / 180;
    const normal = [
      Math.sin(trim) * Math.cos(heel),
      Math.sin(heel),
      Math.cos(trim) * Math.cos(heel),
    ];
    for (const [j, sample] of row.samples.entries()) {
      if (j) {
        const previous = row.samples[j - 1];
        if (!(sample.waterplaneOffsetM > previous.waterplaneOffsetM))
          fail("offset-order");
        if (sample.volumeM3 < previous.volumeM3) fail("volume-order");
      }
      const waterplane = sample.waterplane;
      if (waterplane?.centroidM) {
        const height = normal.reduce(
          (sum, n, k) => sum + n * waterplane.centroidM[k],
          0,
        );
        // Absolute tolerance 1e-12 m plus relative tolerance 1e-10 of the position scale.
        const scale = Math.max(
          Math.abs(sample.waterplaneOffsetM),
          ...waterplane.centroidM.map(Math.abs),
        );
        if (Math.abs(height - sample.waterplaneOffsetM) > 1e-12 + 1e-10 * scale)
          fail("waterplane-centroid");
      }
      const moments = waterplane?.secondMomentsM4;
      if (moments && ["xx", "xy", "yy"].every((key) => key in moments)) {
        const { xx, xy, yy } = moments;
        const scale = Math.max(Math.abs(xx), Math.abs(xy), Math.abs(yy));
        // Matrix-entry tolerance 1e-12 m^4 + relative 1e-10. Normalize before
        // multiplying so finite, large moments cannot overflow the determinant.
        if (
          scale > 0 &&
          (xx / scale) * (yy / scale) - (xy / scale) ** 2 <
            -(1e-12 / scale + 1e-10)
        )
          fail("waterplane-moments");
      }
    }
  }
  if (pairs.size !== heels.length * trims.length) fail("complete-grid");

  const ids = new Set();
  for (const marker of document.immersionMarkers ?? []) {
    if (ids.has(marker.id)) fail("marker-ids");
    ids.add(marker.id);
  }

  function contributors(axis, value) {
    if (axis.includes(value)) return [value];
    const upper = axis.findIndex((coordinate) => coordinate > value);
    return upper > 0 ? [axis[upper - 1], axis[upper]] : [];
  }
  if (document.referenceState) {
    const { heelDeg, trimDeg, waterplaneOffsetM } = document.referenceState;
    const referenceHeels = contributors(heels, heelDeg);
    const referenceTrims = contributors(trims, trimDeg);
    if (!referenceHeels.length || !referenceTrims.length)
      fail("reference-domain");
    for (const heel of referenceHeels) {
      for (const trim of referenceTrims) {
        const row = rows.find(
          (row) => row.heelDeg === heel && row.trimDeg === trim,
        );
        if (
          !row ||
          waterplaneOffsetM < row.samples[0].waterplaneOffsetM ||
          waterplaneOffsetM > row.samples.at(-1).waterplaneOffsetM
        )
          fail("reference-domain");
      }
    }
  }
  return [...errors];
}
