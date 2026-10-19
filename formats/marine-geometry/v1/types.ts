/**
 * Portable sampled marine geometry for drawing and measurement, not an editable
 * hull design, loading condition, solver cache, or promise of solver suitability.
 * @title Marine geometry — v1 experiment
 */
export interface MarineGeometry {
  /** Optional structural schema reference.
   * @format uri-reference
   */
  $schema?: string;
  format: "marine-geometry";
  version: 1;
  name?: NonemptyString;
  frame: Frame;
  /** Complete available geometry, including topsides; not just wetted surfaces.
   * @minItems 1
   */
  meshes: TriangleMesh[];
  /** Explicit membership; consumers must not infer hulls from connectivity.
   * @minItems 1
   */
  bodies: Body[];
  /** Optional explicitly closed analysis boundaries. Missing means not supplied. */
  envelopes?: Envelope[];
  references?: ReferenceGeometry[];
  referenceState?: ReferenceState;
  source?: Source;
  notes?: Notes;
  /** Namespaced supplemental metadata only. Must not override core semantics. */
  extensions?: { [namespace: string]: unknown };
}

/**
 * @minLength 1
 */
export type NonemptyString = string;
export type Notes = NonemptyString[];

/** A zero-based index. The upper bound requires cross-field validation.
 * @asType integer
 * @minimum 0
 */
export type Index = number;

/** Hull-fixed [x, y, z] in metres. */
export type PointM = [x: number, y: number, z: number];
/** Dimensionless unit vector; normalization requires numerical validation. */
export type UnitVector = [x: number, y: number, z: number];
export type Triangle = [a: Index, b: Index, c: Index];

export interface Frame {
  axes: "x-forward-y-port-z-up";
  originDescription: NonemptyString;
}

export interface TriangleMesh {
  id: NonemptyString;
  name?: NonemptyString;
  /** Shared vertices use shared indices; nearby vertices are not implicitly welded.
   * @minItems 3
   */
  verticesM: PointM[];
  /** Winding defines the face normal by (b-a) cross (c-a).
   * @minItems 1
   */
  triangles: Triangle[];
  /** A disjoint, exhaustive partition of this mesh's triangles.
   * @minItems 1
   */
  regions: SurfaceRegion[];
}

/**
 * Named selection for drawing or measuring. IDs are local to a mesh; no category
 * automatically implies shell area, wetted area, or inclusion in a volume.
 */
export type SurfaceRegion = NonIdealizedSurfaceRegion | IdealizedSurfaceRegion;

interface SurfaceRegionProperties {
  id: NonemptyString;
  name?: NonemptyString;
  /** Explicit membership; indices are local to the containing mesh.
   * @minItems 1
   * @uniqueItems
   */
  triangleIndices: Index[];
}

export interface NonIdealizedSurfaceRegion extends SurfaceRegionProperties {
  representation: "physical" | "reference";
  description?: NonemptyString;
}

export interface IdealizedSurfaceRegion extends SurfaceRegionProperties {
  representation: "idealized";
  /** Explain what was assumed; an idealization must not be silently physical. */
  description: NonemptyString;
}

export interface RegionRef {
  meshId: NonemptyString;
  regionId: NonemptyString;
}

/**
 * One named component, not necessarily a closed volume. A surface region belongs
 * to exactly one body. A multihull has distinct hull bodies even if a deck joins them.
 */
export interface Body {
  id: NonemptyString;
  name?: NonemptyString;
  kind: "hull" | "appendage" | "structure" | "reference" | "other";
  /** The body's source surfaces, including any disclosed idealizations.
   * @minItems 1
   */
  regions: RegionRef[];
  /** Optional body centreplane y in the shared frame; does not assert symmetry. */
  centerplaneYM?: number;
}

/**
 * Explicit outward-oriented closed boundary of an analysis volume. Consumers must
 * validate closure and orientation; the declaration is not a validation result.
 */
export interface Envelope {
  id: NonemptyString;
  name?: NonemptyString;
  /** The body this envelope represents. */
  bodyId: NonemptyString;
  boundary: "closed-watertight";
  /** Explain included surfaces, appendages, caps and other closure assumptions. */
  description: NonemptyString;
  /** Selected regions of that body; reference geometry must not bound a volume.
   * @minItems 1
   */
  regions: RegionRef[];
}

/** All reference geometry uses the document's hull-fixed frame. */
export type ReferenceGeometry =
  ReferencePoint | ReferencePlane | ReferencePolyline;

export interface ReferencePoint {
  id: NonemptyString;
  name?: NonemptyString;
  kind: "point";
  pointM: PointM;
}

export interface ReferencePlane {
  id: NonemptyString;
  name?: NonemptyString;
  kind: "plane";
  /** Plane equation: normal dot r = offsetM. */
  normal: UnitVector;
  offsetM: number;
}

/**
 * An independent piecewise-linear curve, not a mesh-edge constraint, continuous
 * spline, or point-set immersion marker. Arc length is Euclidean in this frame.
 */
export interface ReferencePolyline {
  id: NonemptyString;
  name?: NonemptyString;
  kind: "polyline";
  /** Ordered points; for a closed curve, do not repeat the first point.
   * @minItems 2
   */
  pointsM: PointM[];
  /** Whether an additional segment joins the last point to the first. */
  closed: boolean;
}

/**
 * Design-waterplane hint only. Matches Chartroom hydrostatic-table's rotation
 * R = Rx(heel) Ry(-trim); geometry remains unposed. Not a load or solver setting.
 */
export interface ReferenceState {
  /** Positive heel lowers starboard.
   * @minimum -180
   * @maximum 180
   */
  heelDeg: number;
  /** Positive trim raises the bow near upright.
   * @exclusiveMinimum -90
   * @exclusiveMaximum 90
   */
  trimDeg: number;
  /** Signed plane offset h: immersed points satisfy (R^T [0,0,1]) dot r <= h. Not draft. */
  waterplaneOffsetM: number;
}

export interface Source {
  tool?: NonemptyString;
  toolVersion?: NonemptyString;
  modelId?: NonemptyString;
  /**
   * @format date-time
   */
  generatedAt?: string;
  /** Describe discretization, approximation and convergence evidence. */
  method?: NonemptyString;
  notes?: Notes;
}
