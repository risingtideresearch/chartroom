# Hydrostatic table JSON — v1 draft

**Status: v1 draft contract.** This
contract describes the static buoyancy response of one fixed hull envelope. It
contains no Camber document state, loading condition, water density, stability
criteria, interpolation caches or mesh.

- Structural schema: [schema.json](schema.json)
- Readable type definitions: [types.ts](types.ts)
- Numerical example: [box.json](examples/box.json)

The structural schema is generated from [TypeScript types](types.ts) and their
JSDoc constraints. A dry/immersed sample union describes the volume/center
relationship; the generated JSON Schema also enforces the positive-volume bound
that TypeScript cannot express. Neither replaces the numerical and cross-field
validation rules in this specification.

The intended pipeline is:

```text
Hull geometry → hydrostatic table → flotation / stability / loading explorers
```

An upright-only table and a table covering heel and trim use the same format.
Their capabilities differ according to their coverage and supplied properties;
consumers must not manufacture missing coverage or properties.

## 1. Smallest useful document

This example contains two upright states of a 4 × 2 × 2 m rectangular box, with
its origin at mid-length on the bottom centreline. It supports interpolation of
upright buoyancy, not large-angle stability or free-trim analysis.

```json
{
  "format": "hydrostatic-table",
  "version": 1,
  "name": "Upright box",
  "frame": {
    "axes": "x-forward-y-port-z-up",
    "originDescription": "Mid-length on the bottom centreline",
    "knReferenceM": [0, 0, 0]
  },
  "body": {
    "description": "Closed rectangular box: x from -2 to 2, y from -1 to 1, z from 0 to 2 m",
    "buoyancyEnvelope": "closed-watertight"
  },
  "table": {
    "interpolation": "linear",
    "rows": [
      {
        "heelDeg": 0,
        "trimDeg": 0,
        "samples": [
          {
            "waterplaneOffsetM": 0.5,
            "volumeM3": 4,
            "buoyancyCenterM": [0, 0, 0.25]
          },
          {
            "waterplaneOffsetM": 1,
            "volumeM3": 8,
            "buoyancyCenterM": [0, 0, 0.5]
          }
        ]
      }
    ]
  }
}
```

The required core is `format`, `version`, `frame`, `body` and `table`. Field
suffixes define units: `M` is metres, `M2` m², `M3` m³, `M4` m⁴ and `Deg` degrees.
There is no configurable unit system. Exporters convert into these units.

## 2. Coordinate and attitude conventions

All positions are in one **hull-fixed, right-handed frame**, unaffected by the
loading condition:

- `x`: forward.
- `y`: port.
- `z`: up.

`originDescription` explains where the producer placed the origin. Every
position, including later loading CGs, must use that origin; LCB is not implicitly
measured from a perpendicular or the transom, and vertical positions are not
implicitly measured from the current waterline.

`knReferenceM` is an explicit K reference on the centreplane (`y = 0`). A reported
KG is the body-z height above this point; K is not inferred from an immersed
state. K's x coordinate matters when the hull trims. No symmetry is implied by
having a centreplane reference.

Positive heel lowers starboard; positive trim raises the bow near the upright
attitude. To remove ambiguity at combined heel and trim, the body-to-world
rotation is exactly:

```text
R = Rx(heel) · Ry(-trim)
```

Both matrices are standard right-handed active rotations. Apply trim first about
the body y axis, then heel about the world x axis. World z is vertically upward;
world x and y provide the horizontal basis. Trigonometric calculations use
radians, despite the file storing degrees. There is no translation or yaw in R.

A sample's waterplane is:

```text
n · r = h
n = Rᵀ · [0, 0, 1]
  = [sin(trim) cos(heel), sin(heel), cos(trim) cos(heel)]
h = waterplaneOffsetM
```

The immersed half-space is `n · r <= h`. Since n is a unit vector, h is the signed
perpendicular plane offset from the origin, or equivalently its world height
after this rotation. It is **not a draft**. Negative h is legal.

Heel coordinates lie in [-180°, 180°]; trim coordinates lie strictly between
-90° and 90°. These are encoding limits, not promises of dataset coverage. No
periodic wrapping, equivalent-angle substitution or mirrored states are implicit.

## 3. Rows and samples

Each row fixes `heelDeg` and `trimDeg`, and contains an immersion sweep:

| Field               | Required | Meaning                                                              |
| ------------------- | -------- | -------------------------------------------------------------------- |
| `waterplaneOffsetM` | Yes      | Plane offset h in the convention above                               |
| `volumeM3`          | Yes      | Volume of the envelope below the plane, not displaced mass           |
| `buoyancyCenterM`   | Yes      | Centroid of that volume in hull coordinates; null at zero volume     |
| `waterplane`        | No       | Geometric waterplane properties; see below                           |
| `wettedAreaM2`      | No       | Submerged physical exterior area, excluding artificial closure faces |

Volume must be nonnegative. At zero volume, `buoyancyCenterM` is **null**, not an
invented coordinate; at positive volume it must be a finite [x, y, z] vector.

Rows form a complete Cartesian product of their distinct heel and trim values.
Angles need not be uniformly spaced. For example, heels [-10, 0, 10] and trims
[-2, 0, 2] require nine rows. There are no duplicate attitude pairs or missing
cells. A single value on an axis means only that value is supported, not that the
response is independent of that axis.

For deterministic files, rows are ordered by increasing trim, then increasing
heel. Each row has at least two samples ordered by strictly increasing plane
offset. Its volumes are nondecreasing; dry and fully submerged plateaus are legal.
Rows may have different offsets, numbers of samples and immersion ranges.

Plateaus do not provide a unique immersion inverse. Solvers must distinguish a
nonunique solution from an ordinary floating equilibrium. If a volume never
appears in the supported domain, that does not prove the vessel cannot float
outside that domain.

## 4. Optional waterplane properties

A waterplane block can contain:

```json
{
  "areaM2": 8,
  "centroidM": [0, 0, 1],
  "secondMomentsM4": {
    "xx": 10.666666666666666,
    "xy": 0,
    "yy": 2.6666666666666665
  }
}
```

- `areaM2` is required when the block is present and must be positive.
- `centroidM`, if supplied, is the centre of flotation in **hull coordinates**,
  lying on the sample's waterplane.
- `secondMomentsM4`, if supplied, contains any known components of the central
  geometric second moments. An omitted component is unknown, not zero.

The moment basis is **world-horizontal X and Y after R**, not the inclined body
axes. About the waterplane centroid:

```text
xx = ∫(X - Xf)² dA
xy = ∫(X - Xf)(Y - Yf) dA
yy = ∫(Y - Yf)² dA
```

These names identify the integrands, not engineering inertia-axis names: `yy` is
the transverse-stability quantity normally called It; `xx` is normally Il. When
all components are present, the matrix must be positive semidefinite.

For upright, zero-trim states:

```text
B   = buoyancyCenterM
KB  = B.z - K.z
KMt = KB + yy / volumeM3
KMl = KB + xx / volumeM3
```

These are upright initial-stability quantities, not a general heeled-GM formula.
For arbitrary equilibria, use the restoring-moment response or a consistently
derived coupled stiffness calculation.

The three representations of availability are deliberately different:

- Field omitted: not supplied / unknown.
- `waterplane: null`: known to have no free waterplane, for example a fully
  submerged envelope.
- A waterplane object: a known positive-area waterplane.

A numerical method failing to calculate a property is not evidence that the
physical property is zero or absent. Do not encode NaN, infinity or placeholder
zeros. Deck immersion does not universally eliminate the waterplane of a closed
hull; report the actual geometry or leave the property unknown.

## 5. Interpolation and coverage

V1 specifies a reproducible baseline, `interpolation: "linear"`:

1. Locate the enclosing heel and trim grid coordinates. On a stored coordinate,
   use that coordinate only; no neighbouring row is needed along that axis.
2. In every participating row, bracket h and linearly interpolate volume V and
   the **volume first moment Q = V · B**, with Q = [0, 0, 0] at V = 0.
3. Interpolate V and Q linearly across heel and trim (bilinearly when both vary).
4. Return B = Q / V for positive volume, otherwise null.

Do **not** independently linearly interpolate B and V. Moment interpolation also
avoids undefined centroids at the dry endpoint. First moments are derived by the
consumer; they are not duplicated in the file.

A requested h must be inside the immersion range of **every participating row**.
An attitude must be inside the sampled angular rectangle. Outside either domain,
return an unavailable result: no extrapolation, automatic clamping, symmetry
assumption or interpolation across a missing cell. Angle seams are not wrapped.

Optional numeric properties use the same weights only when all participating
values are supplied. A mixture of unknown values, null waterplanes and objects
makes the requested waterplane property unavailable; all-null contributors return
null. Exact samples retain their own availability. Different tensor components
may consequently have different availability. Interpolated centroids are
estimates; an interpolated waterplane centroid can be projected onto the requested
plane before use.

This interpolation is an approximation, not an exact reconstructed solid.
Supplied waterplane areas need not equal derivatives of the piecewise-linear
volume interpolant. Small-angle stiffness, GZ maxima, zero crossings and criteria
near a threshold need adequate resolution and convergence checks. A sparse heel
grid is not evidence of a well-resolved initial GM or an accurately located peak.
Interpolation slopes, derived KM profiles and criterion contours are runtime
products, not interchange data.

## 6. Reference state and immersion markers

`referenceState` optionally names a design waterplane with `heelDeg`, `trimDeg`
and `waterplaneOffsetM`, inside the supported domain. It is a framing/reference
hint, not a loading condition or an instruction to hold trim fixed. No CG or water
density is inferred from it.

`immersionMarkers` is an optional collection of labelled point sets:

```json
[
  {
    "id": "starboard-opening",
    "label": "Unprotected starboard opening",
    "kind": "downflooding",
    "pointsM": [[1, -1, 1.6]]
  }
]
```

Kinds are `deck-edge`, `downflooding` and `reference`. All points use the same body
frame. A point's signed vertical clearance is `n · point - h`; the set's minimum
clearance reaching zero is its first immersion. For an opening, provide the
boundary points needed to capture its lowest edge, not its centre. These are
point sets, not an interpolated mesh or a curved boundary reconstruction.

Deck-edge immersion is a warning and is not synonymous with downflooding.
`downflooding` identifies an unprotected opening that limits intact analysis when
immersed. The table describes an idealized closed envelope even past that event;
it **does not model subsequent flooding**. Consumers must retain that distinction
and not label intact results beyond the limit as an unrestricted assessment.

Marker ids must be unique. Missing markers mean immersion limits are unknown, not
that the hull has no openings or that downflooding happens after the last heel.

## 7. Metadata and extension policy

`body.buoyancyEnvelope` is always `closed-watertight`: the integrated volume must
have explicit closures. `body.description` should identify which decks, caps,
appendages and multiple hulls are included. It must disclose idealized closures;
an open surface must not be silently treated as a closed buoyancy volume.

Optional `source` fields are `tool`, `toolVersion`, `modelId`, `generatedAt`,
`method` and `notes`. Method and notes should describe discretization, closure
assumptions and convergence evidence. A date alone is not an accuracy guarantee.
Optional top-level `notes` are human-readable caveats.

Unknown core fields are rejected to catch misspellings. Optional top-level
`extensions` is an object for namespaced supplemental metadata, for example keys
using reverse-domain names. Consumers may ignore extensions; information that
changes the interpretation or validity of core results must not live only there.
A change to core semantics requires a new format version.

## 8. Validation beyond JSON Schema

The structural schema is not a physical or cross-row validator. Before accepting
a dataset, a consumer must additionally check:

- All numbers are finite (including overflow from syntactically valid JSON).
- Attitude pairs are unique, sorted and form a complete Cartesian product.
- Offsets strictly increase and volume is nondecreasing within each row.
- The reference state lies within the interpolation domain.
- Marker ids are unique.
- Supplied waterplane centroids satisfy the plane equation within a declared
  numerical tolerance, and complete second-moment matrices are positive
  semidefinite within tolerance.

Tolerance should be tied to scale and producer precision, not an unexplained
fixed epsilon. Structural conformance and these checks still do not prove that
the numerical table represents the stated hull. Independent fixtures and
convergence tests remain necessary.

## 9. What consumers can derive

| Explorer feature           | Needed data                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fixed-trim KN / GZ curves  | Volume and B over the requested heel/immersion range at that trim                                      |
| Free-trim GZ curves        | Volume and B over heel, immersion and a trim range bracketing the equilibrium path                     |
| Full static equilibrium    | Volume and B over the needed heel, trim and immersion domain                                           |
| Upright KMt / GMt          | Upright volume and B, plus waterplane `yy`, or sufficiently resolved perturbation data for an estimate |
| Design-waterline reference | `referenceState`                                                                                       |
| Sheer-immersion warning    | `deck-edge` markers                                                                                    |
| Downflooding limit         | `downflooding` markers                                                                                 |

A table without a particular property is still a valid table, but a consumer
must disable or explicitly label the corresponding unavailable or estimated
reading. Valid structural data does not promise every explorer feature.

Given a separate loading condition containing mass in kg, water density in kg/m³
and CG [x, y, z] in this body frame:

- Solve immersion for a required displaced volume at a prescribed attitude.
- Solve immersion and trim at a prescribed heel, balancing world-horizontal
  longitudinal positions of B and G.
- Solve immersion, heel and trim for full static equilibrium, if the table covers
  the needed states; equilibria may be multiple or unstable.
- Trace fixed- or free-trim GZ curves, assess restoring moments and follow the
  intended equilibrium branch.
- Derive upright KM profiles, KN curves, immersion limits and loading envelopes
  where the necessary coverage and properties exist.

In the rotation convention above, let q = R · (B - G). The signed transverse
righting lever is `GZ = -q.y`. KN uses K in place of G. These are world-horizontal
levers; they must not be confused with generalized torques for arbitrary Euler
coordinates. At zero trim with G on the centreplane, the familiar identity is
`GZ = KN - KG · sin(heel)`. At changing trim, use the full transformation instead.

The full restoring moment about G is `(R · (B - G)) × [0, 0, density · g · V]`.
Equilibrium also requires `mass = density · V`. A force/moment calculation does
not establish local stability; a solver must test restoring slopes/coupling and
must not silently select a different equilibrium branch.

A current-panel-style displacement/KG plot needs an explicit LCG, TCG and trim
policy. It is one slice through loading space, not a hull-only universal verdict.
A 30° or 40° area criterion needs coverage of the entire path to that angle;
partial coverage cannot be called a full pass or fail. An unavailable immersion
angle must not be rendered as greater than 90°.

The table does not supply moving-tank free surfaces, flooding evolution,
deformation, wind loads, damping or wave dynamics. Those require separate models.

## 10. Numerical example

`examples/box.json` contains analytically computed states of the
closed 4 × 2 × 2 m box for heels [-10, 0, 10]°, trims [-2, 0, 2]° and plane offsets
[0.5, 1, 1.5] m. Every cut crosses the side walls without reaching the bottom or
top at any corner, so no clipping-case approximation is needed at the samples.

For n = [a, b, c], the immersion height is `(h - a*x - b*y) / c`. With plan area
A = 8 m², mean x and y equal to zero, and variances sx² = 4/3 m² and sy² = 1/3 m²:

```text
V  = A*h/c
Qx = -A*a*sx²/c
Qy = -A*b*sy²/c
Qz = A*(h² + a²*sx² + b²*sy²)/(2*c²)
B  = Q/V
```

The example supplies waterplane properties, a deck-edge marker, a hypothetical
unprotected opening and a reference state. It is deliberately too narrow and
coarse to establish IMO large-angle criteria or an angle of vanishing stability.
The exact samples do not make their linear interpolant exact between samples.
