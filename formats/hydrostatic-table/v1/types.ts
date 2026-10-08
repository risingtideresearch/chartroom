/**
 * Static buoyancy response of a fixed closed envelope. See specification.md for
 * coordinate, interpolation and cross-row validation rules not expressible here.
 * @title Hydrostatic table — v1 draft
 */
export interface HydrostaticTable {
  /**
   * Optional URI reference to the document's structural schema.
   * @format uri-reference
   */
  $schema?: string;
  format: "hydrostatic-table";
  version: 1;
  name?: NonemptyString;
  frame: Frame;
  body: Body;
  table: Table;
  referenceState?: ReferenceState;
  immersionMarkers?: ImmersionMarker[];
  source?: Source;
  notes?: Notes;

  /** Namespaced supplemental metadata only. Must not override core semantics. */
  extensions?: { [namespace: string]: unknown };
}

/** @minLength 1 */
export type NonemptyString = string;

export type Notes = NonemptyString[];

/** @minimum 0 */
export type NonNegative = number;

/** @exclusiveMinimum 0 */
export type Positive = number;

/** Hull-fixed [x, y, z] in metres. */
export type PointM = [x: number, y: number, z: number];

/** Hull-fixed [x, 0, z] in metres. */
export type CenterplanePointM = [x: number, y: 0, z: number];

/**
 * Positive heel lowers starboard. See the normative rotation order.
 * @minimum -180
 * @maximum 180
 */
export type HeelDeg = number;

/**
 * Positive trim raises the bow near upright. See the normative rotation order.
 * @exclusiveMinimum -90
 * @exclusiveMaximum 90
 */
export type TrimDeg = number;

export interface Frame {
  axes: "x-forward-y-port-z-up";
  originDescription: NonemptyString;
  knReferenceM: CenterplanePointM;
}

export interface Body {
  description: NonemptyString;
  buoyancyEnvelope: "closed-watertight";
}

export interface Table {
  /**
   * Linear in immersion, heel and trim, interpolating volume and derived volume
   * first moments rather than independently interpolating centroids.
   */
  interpolation: "linear";

  /**
   * Complete Cartesian product of sampled angles, sorted by trim then heel.
   * Cross-row constraints require semantic validation.
   * @minItems 1
   */
  rows: Row[];
}

export interface Row {
  heelDeg: HeelDeg;
  trimDeg: TrimDeg;

  /**
   * Strictly increasing offsets and nondecreasing volumes; offsets may differ
   * between attitude rows.
   * @minItems 2
   */
  samples: Sample[];
}

/**
 * A dry sample has zero volume and a null center; an immersed sample has positive
 * volume and a hull-fixed center. The Positive bound is enforced by JSON Schema,
 * not TypeScript, so the union still requires runtime validation.
 */
export type Sample = DrySample | ImmersedSample;

interface SampleProperties {
  /** Signed plane offset h: submerged points satisfy n dot r <= h. Not draft. */
  waterplaneOffsetM: number;

  /** Omitted means unknown; null means known to have no free waterplane. */
  waterplane?: Waterplane | null;
  wettedAreaM2?: NonNegative;
}

export interface DrySample extends SampleProperties {
  volumeM3: 0;
  buoyancyCenterM: null;
}

export interface ImmersedSample extends SampleProperties {
  volumeM3: Positive;
  buoyancyCenterM: PointM;
}

export interface Waterplane {
  areaM2: Positive;
  centroidM?: PointM;
  secondMomentsM4?: SecondMomentsM4;
}

/**
 * Central integrals of X squared, X times Y and Y squared in the rotated
 * world-horizontal frame. Missing components are unknown, not zero.
 * A complete matrix must be positive semidefinite.
 * @minProperties 1
 */
export interface SecondMomentsM4 {
  xx?: NonNegative;
  xy?: number;
  yy?: NonNegative;
}

export interface ReferenceState {
  heelDeg: HeelDeg;
  trimDeg: TrimDeg;
  waterplaneOffsetM: number;
}

export interface ImmersionMarker {
  id: NonemptyString;
  label: NonemptyString;
  kind: "deck-edge" | "downflooding" | "reference";

  /** @minItems 1 */
  pointsM: PointM[];
}

export interface Source {
  tool?: NonemptyString;
  toolVersion?: NonemptyString;
  modelId?: NonemptyString;

  /** @format date-time */
  generatedAt?: string;

  method?: NonemptyString;
  notes?: Notes;
}
