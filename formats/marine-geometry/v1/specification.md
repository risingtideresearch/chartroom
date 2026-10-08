# Marine geometry — v1 experiment

**Experimental Chartroom contract; not yet released.** This proposes a portable
sampled geometry snapshot for views, geometric weight estimates, and physics
importers. It does not describe an editable Camber hull, loading condition,
materials, formulas, uncertainty model, cameras, solver settings, or solver caches.
The experiment may change incompatibly.

- Source of structural constraints: [types.ts](types.ts)
- Generated draft-07 JSON Schema: [schema.json](schema.json)
- Examples: [open box](examples/open-box.json), [capped box](examples/capped-box.json)
- Conformance experiments: `test/marine-geometry-schema.test.mjs`,
  `test/marine-geometry-semantics.mjs`, and `fixtures/manifest.json`

## 1. Coordinates and source geometry

All positions use metres in one hull-fixed, right-handed frame: x forward, y port,
z up. `originDescription` explains the authored origin. There is no configurable
unit system and no implicit translation, scaling, symmetry, or design rotation.
Geometry includes all available topsides, not only the wetted part at a design
waterplane. Missing surfaces cannot be reconstructed from the declaration of a
body. A snapshot is not an exact reconstruction of the author's continuous hull.

`verticesM` and reference points are finite coordinates. Triangles have three
zero-based integer indices into their own mesh's vertices. Their winding defines
normals by `(b-a) cross (c-a)`; normals are derived, not separately authoritative.
Coincident vertices within a mesh should share indices; nearby coordinates are not
implicitly welded. Consumers must not use a tolerance to merge away deliberate
openings, creases, or separate surfaces.

## 2. Regions, bodies, and envelopes

A mesh's named regions form a **disjoint, exhaustive partition** of its triangles.
Names and IDs express selections, not inferred physical categories. A shell area
query selects particular regions; it does not automatically include a transom,
deck, or every physical surface.

Every region belongs to exactly one body. Body membership is explicit and does
not depend on connectivity. Two demihulls are two `kind: "hull"` bodies, even when
a separate structural body joins them. A body's optional `centerplaneYM` is a
transverse datum, not a symmetry assertion. All meshes are already placed in the
shared frame; v1 has no instance transforms or half-hull mirroring convention.

Region `representation` is one of:

- `physical`: a sampled intended physical surface, not necessarily an as-built
  measurement or a statement about permeability.
- `idealized`: a disclosed analysis idealization. `description` is required;
  examples include a cap across an open sheer or a simplified appendage.
- `reference`: construction/drawing geometry, not a volume boundary.

Bodies may be open. **Absence of an envelope means none was supplied**, not that
an application may infer a closed body or add a deck.

An optional envelope selects regions belonging to one body as an explicit
`closed-watertight` analysis boundary. It may combine physical and idealized
regions, but never reference regions. Its description explains closure assumptions
and what is included. These are claims for consumers to validate, not validation
certificates. Envelope faces must point out of the bounded region; cavity faces
point into cavities. Orientation must not be inferred solely from nesting.

The capped-box example separates 24 m² of bottom/side plating, 8 m² of end faces,
and an 8 m² idealized cap. The closed analysis volume is 16 m³; the cap must not
silently become physical plating or wetted exterior. The open-box example has the
same physical surfaces but supplies no volume boundary. If multiple analyses use
different closure geometries, regions and envelope selections must keep those
alternatives explicit rather than summing all triangles indiscriminately.

## 3. Reference geometry and design state

Reference geometry has its own ID namespace and uses the same body-fixed frame:

- Point: one coordinate.
- Plane: `normal dot r = offsetM`, with a finite dimensionless **unit** normal.
- Polyline: straight segments between successive ordered points; `closed: true`
  adds the last-to-first segment without repeating the first point.

Polylines are independent sampled curves, not constraints tying them to mesh edges,
splines, or Chartroom immersion-marker point sets. No interpolated construction
station family is implied. Camber sweep stations are not generally equivalent to
transverse plane cuts and cannot be recovered from arbitrary triangles.

An optional `referenceState` identifies a design waterplane, not a loading state
or instruction to pose the stored vertices. It follows Chartroom hydrostatic-table
v1 exactly: positive heel lowers starboard, positive trim raises the bow near
upright, and the active body-to-world rotation is:

```text
R = Rx(heel) · Ry(-trim)
n = Rᵀ · [0, 0, 1]
  = [sin(trim) cos(heel), sin(heel), cos(trim) cos(heel)]
n · r = waterplaneOffsetM
```

The immersed half-space is `n dot r <= waterplaneOffsetM`. Offsets are not drafts.
Angles are stored in degrees, used in radians for trigonometry. Missing reference
state means unknown, not zero heel, zero trim, or a waterline at the origin.

## 4. Drawing and measurement are consumers

The intended architecture is:

```text
Author → marine geometry → query adapter → views / weight estimates / physics
```

A query adapter can return plane-cut contours, clipped regions, lengths, areas,
volumes, and their first moments or centroids. The source contract does not store
redundant derived measures or mandate a numerical algorithm. A centroid at zero
measure is undefined, not an invented zero point. Lengths and areas are physical
Euclidean measures in this orthonormal frame, not measures of a sheared reporting
frame or projected view. A silhouette is a projection, not a section.

In a cut of the capped box at x = 2 m, the enclosed area is 4 m², full perimeter is
8 m, and shell-selected intersection length is 6 m. An adapter should preserve the
selection identity of intersection segments, including synthetic clipping edges;
closing a drawing contour must not manufacture physical skin length. Views and
weight estimates should use the same geometric interpretation, though different
preview and measurement resolutions must be disclosed.

Repeated cuts, uncertain spacing, areal densities, and formulas belong to the
consumer. IDs name entities within one snapshot; matching IDs across snapshots do
not prove unchanged geometry. Triangle indices are not persistent identities after
remeshing. Source names or model IDs alone do not establish correspondence with a
hydrostatic table; an application must track the actual geometry revision and
analysis assumptions separately.

## 5. Boatmath and Camber adapters

Boatmath already accepts indexed mesh hulls via `MeshFleet::from_meshes`. An
adapter selects the applicable hull regions, retains the whole geometry, groups
one mesh per hull, and converts the explicit reference state into Boatmath's
design-waterline-at-z-zero convention. Applying a design pose must not be repeated
later. Cut resolution, scale experiments, mounts, loads, and transom flow models
remain Boatmath inputs, not this interchange contract.

Boatmath does not currently consume region annotations. An adapter must not assume
it honors artificial-cap exclusions, open-body semantics, or arbitrary cavities.
Its sectional model applies symmetry/fold/end-cap interpretations; importing a
valid mesh does not establish suitability for thin-ship or strip-theory analysis.
Its stability heel/trim rotation order also differs from the Chartroom convention:
convert full transforms, not just signs. Optional spline geometry is out of v1;
Boatmath's native polynomial B-spline support can motivate a later contract.

Camber's weight sheet uses starboard-positive y and a hybrid deck-x/world-height
reporting frame. A Camber adapter must explicitly map coordinates and moments,
while measuring physical lengths/areas in an orthonormal frame. That existing
application convention must not redefine the shared geometry frame.

## 6. Validation and extensions

The structural schema rejects unknown core fields and checks tuple lengths,
nonnegative integer indices, local bounds, and required disclosure for idealized
regions. TypeScript alone does not enforce numerical JSDoc constraints. Neither
TypeScript nor JSON Schema checks references or geometric validity.

Consumers additionally check:

- Finite core numbers, including JSON numeric overflow; safe index arithmetic.
- Unique mesh, body, envelope, and reference IDs within their respective lists,
  and unique region IDs within each mesh.
- In-range vertex and triangle indices; nondegenerate triangles.
- Exhaustive, disjoint region partitions and exactly one body owner per region.
- Resolvable, nonrepeated body/envelope region references; envelope regions owned
  by its declared body and no reference surfaces in its boundary.
- Unit plane normals and nonzero polyline segments, including a closed curve's
  last-to-first segment.
- For claimed envelopes: manifold, nonintersecting, consistently outward-oriented
  closed boundaries. Two oppositely directed incident faces per edge alone do not
  prove vertex manifoldness or absence of self-intersection.

The test-only fixture checker covers references, partitions, finite coordinates,
unit normals, and oriented edge incidence. It is deliberately **not** a full
solid validator or solver accuracy guarantee. Numeric tolerances must be related
to coordinate scale and producer precision; consumers must disclose convergence
and capability limits rather than fabricate missing data.

`source` follows Chartroom's provenance conventions. Method and notes should
explain mesh approximation, resolution and convergence evidence where available.
A date or a valid schema is not an accuracy guarantee. Optional namespaced
`extensions` hold supplemental metadata only; consumers may ignore them. Anything
that changes core geometric meaning must not exist only in an extension.
