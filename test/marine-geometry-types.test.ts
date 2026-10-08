import type {
  MarineGeometry,
  PointM,
  SurfaceRegion,
} from "@risingtideresearch/chartroom/formats/marine-geometry/v1";

const document: MarineGeometry = {
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
        { id: "skin", representation: "physical", triangleIndices: [0] },
      ],
    },
  ],
  bodies: [
    { id: "h", kind: "hull", regions: [{ meshId: "m", regionId: "skin" }] },
  ],
};

// @ts-expect-error The schema version is literal, not an arbitrary number.
document.version = 2;
// @ts-expect-error Core fields do not accept arbitrary extensions.
document.unit = "mm";
// @ts-expect-error Optional fields are omitted rather than assigned undefined.
document.referenceState = undefined;
// @ts-expect-error Coordinates have exactly three components.
const shortPoint: PointM = [0, 0];
// @ts-expect-error Idealizations require disclosure.
const cap: SurfaceRegion = {
  id: "cap",
  representation: "idealized",
  triangleIndices: [0],
};

// Valid TypeScript, but invalid JSON Schema: numeric annotations need runtime checks.
document.meshes[0].triangles[0][0] = 0.5;
// Valid TypeScript and structural JSON, but invalid cross-field semantics.
document.meshes[0].triangles[0][0] = 99;
