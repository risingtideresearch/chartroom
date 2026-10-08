import type {
  CenterplanePointM,
  HydrostaticTable,
  PointM,
  Sample,
} from "@risingtideresearch/chartroom/formats/hydrostatic-table/v1";

const document: HydrostaticTable = {
  format: "hydrostatic-table",
  version: 1,
  frame: {
    axes: "x-forward-y-port-z-up",
    originDescription: "Bottom centreline",
    knReferenceM: [0, 0, 0],
  },
  body: {
    description: "Closed box",
    buoyancyEnvelope: "closed-watertight",
  },
  table: {
    interpolation: "linear",
    rows: [
      {
        heelDeg: 0,
        trimDeg: 0,
        samples: [
          { waterplaneOffsetM: 0, volumeM3: 0, buoyancyCenterM: null },
          { waterplaneOffsetM: 1, volumeM3: 8, buoyancyCenterM: [0, 0, 0.5] },
        ],
      },
    ],
  },
  extensions: { "org.example.metadata": { arbitrary: [true, null, 3] } },
};

const sample: Sample = document.table.rows[0].samples[0];
sample.waterplane = null;
sample.waterplane = { areaM2: 8, secondMomentsM4: { xy: -1 } };
delete sample.waterplane;

// Optional and explicitly nullable are deliberately different.
// @ts-expect-error Omit optional fields instead of assigning undefined.
sample.waterplane = undefined;
// @ts-expect-error Wetted area is optional but not nullable.
sample.wettedAreaM2 = null;
// @ts-expect-error The buoyancy center is required, even for dry samples.
const missingCenter: Sample = { waterplaneOffsetM: 0, volumeM3: 0 };
// @ts-expect-error Coordinates have exactly three components.
const shortPoint: PointM = [0, 0];
// @ts-expect-error Coordinates have exactly three components.
const longPoint: PointM = [0, 0, 0, 0];
// @ts-expect-error The K reference lies on the centerplane.
const offCenterplane: CenterplanePointM = [0, 1, 0];
// @ts-expect-error The format version is a literal, not any number.
document.version = 2;
// @ts-expect-error Core fields do not accept arbitrary extensions.
document.unknownField = true;

// A null center narrows the union to the dry branch.
if (sample.buoyancyCenterM === null) {
  const dryVolume: 0 = sample.volumeM3;
}

// @ts-expect-error A nonzero volume cannot use the dry branch's null center.
const positiveNullCenter: Sample = {
  waterplaneOffsetM: 0,
  volumeM3: 1,
  buoyancyCenterM: null,
};
// @ts-expect-error A negative volume cannot use the dry branch's null center.
const negativeNullCenter: Sample = {
  waterplaneOffsetM: 0,
  volumeM3: -1,
  buoyancyCenterM: null,
};

// These are valid TypeScript but invalid JSON documents: Positive is still a
// number in TypeScript, so its bound requires runtime schema validation.
const negativeVolume: Sample = {
  waterplaneOffsetM: 0,
  volumeM3: -1,
  buoyancyCenterM: [0, 0, 0],
};
const zeroVolumeWithCenter: Sample = {
  waterplaneOffsetM: 0,
  volumeM3: 0,
  buoyancyCenterM: [0, 0, 0],
};
