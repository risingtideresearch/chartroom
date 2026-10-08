# Chartroom

Application-independent marine data contracts. Each format includes a JSON Schema,
its normative specification, examples, and conformance fixtures. Chartroom defines
interchange data, not hull geometry algorithms, application state, or solver caches.

## Formats

| Format            | Version | Status       | Contract                                                                                                            |
| ----------------- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Hydrostatic table | 1       | Draft        | [Specification](formats/hydrostatic-table/v1/specification.md) · [Schema](formats/hydrostatic-table/v1/schema.json) |
| Marine geometry   | 1       | Experimental | [Specification](formats/marine-geometry/v1/specification.md) · [Schema](formats/marine-geometry/v1/schema.json)     |

The [catalog](catalog.json) lists the available contracts, their paths, and the
TypeScript root types used to generate their schemas.
Hydrostatic table v1 describes the static buoyancy response of one fixed closed
hull envelope, independently of a loading condition or water density. It was
extracted from Camber without changing its structural or physical semantics.

Marine geometry v1 is an unreleased experiment: a whole-geometry mesh snapshot
with named surface regions, explicit hull bodies, optional closed analysis
envelopes, and reference geometry. It is intended as source data for views,
geometric weight estimates, and physics importers—not editable CAD or solver
caches. It has no dependency on Camber or Boatmath.

## Consume a GitHub release

After this repository has been pushed and tagged `v0.1.1`:

```sh
npm install --save-dev --save-exact \
  'github:risingtideresearch/chartroom#v0.1.1'
```

The package name is `@risingtideresearch/chartroom`. It contains committed JSON,
Markdown, and type-only TypeScript artifacts; installation requires no build or
generation step. Use a regular dependency instead of a dev dependency if the
application loads schemas at runtime. Commit the consumer's lockfile, which
records the resolved Git commit.

For example, a Node-based exporter test can replace its local schema read with:

```js
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const schema = JSON.parse(
  readFileSync(
    require.resolve("@risingtideresearch/chartroom/formats/hydrostatic-table/v1/schema.json"),
    "utf8",
  ),
);
```

TypeScript consumers can import the type-only contract:

```ts
import type { HydrostaticTable } from "@risingtideresearch/chartroom/formats/hydrostatic-table/v1";
```

This subpath has no runtime API. TypeScript types do not validate JSON, enforce
JSDoc bounds, reject all extra fields, or enforce the volume/center relationship.

Use a JSON Schema draft-07 validator. Validation libraries are not runtime
package dependencies; consumers choose their own. Schemas are loaded locally,
not fetched from GitHub during validation. The schema `$id` is a release-specific
identifier and becomes publicly resolvable only after that release is pushed.

The JSON Schema checks structure only. Consumers must also apply the
[cross-field and numerical rules](formats/hydrostatic-table/v1/specification.md#8-validation-beyond-json-schema).
Chartroom's test-only checker exercises those rules but is **not a public validator
API or a physical accuracy guarantee**. Exporter accuracy and convergence tests
belong in the producing application.

## Develop

Requires Node.js 22 or newer.

```sh
npm ci
npm run check
npm pack --dry-run
```

### Authoring schemas

Edit [`types.ts`](formats/hydrostatic-table/v1/types.ts), not `schema.json`.
Use ordinary interfaces, literal types, optional properties, unions, and labelled
tuples. JSDoc supplies human descriptions and local constraints such as
`@minimum`, `@exclusiveMaximum`, `@minLength`, `@minItems`, `@minProperties`, and
`@format`.

```sh
npm run generate       # Regenerate and format committed JSON Schemas
npm run check          # Typecheck, verify generation freshness, test, and formatcheck
```

The pinned `ts-json-schema-generator` emits draft-07 with unknown core fields
rejected. Only explicit index signatures, such as `extensions`, allow arbitrary
keys. Generation preserves field declaration order and derives release `$id`
URLs from the package version and catalog paths.

All structural constraints come from `types.ts`; there are no schema overrides.
`Sample` is a union of `DrySample` (zero volume, null center) and `ImmersedSample`
(positive volume, point center). A shared interface holds the common properties.
The `Positive` alias uses `@exclusiveMinimum 0`, so the generated branches enforce
the relationship without a hand-written conditional. TypeScript itself still
sees `Positive` as `number`; consumers must validate at runtime. Cross-row and
physical semantics remain in `specification.md`, exercised by conformance tests.

CI verifies that committed schemas match their sources without rewriting them.
Generation tools are development dependencies only; consumers still load the
committed schema without installing a generator or running a build.

Tests validate the schemas, all examples, and valid fixtures. Invalid fixtures
are classified in `fixtures/manifest.json`: structural failures must fail JSON
Schema validation; semantic failures must pass it and violate the named semantic
rule. Test tolerances are documented in `test/hydrostatic-semantics.mjs`; producers
and consumers must select tolerances appropriate to their scale and precision.
CI runs these checks and checks the package contents.

## Versioning and releases

- A **repository/package release** (`v0.1.1`) versions the whole collection.
- A **format version** (`hydrostatic-table/v1`, `"version": 1`) versions one data
  contract. Formats evolve independently.
- Draft and experimental contracts may change, including incompatibly, but every change must be
  documented in the changelog and released under a new repository tag.
- Once a contract is stable, incompatible structure or semantics require a new
  format version. Do not reinterpret an existing stable version.
- Never move or replace a released tag. Consumers may pin a commit SHA instead
  of a tag when they need a stronger immutable reference.

Before a release:

1. Update `package.json`, the lockfile, and `CHANGELOG.md`.
2. Run `npm run generate` to update schema `$id` URLs to the intended release
   tag. Paths within each format remain unchanged; examples use local relative
   schema references.
3. Run `npm ci`, `npm run check`, and `npm pack --dry-run`.
4. Commit the release, then create and push its annotated tag:

```sh
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin main
git push origin v0.1.1
```

There is no npm publishing step. A future npm release can use the same layout.

**Licensing is not yet decided.** The package is marked `UNLICENSED`, which is
not an open-source license. Choose a license and confirm rights to the extracted
material before public distribution; then add `LICENSE` to the package and update
`package.json`.

## Migrating Camber

After the first release is available, pin it in Camber, load this schema in the
hydrostatic exporter tests, and replace the local generic contract with a link.
Keep Camber's exporter documentation, algorithms, application-specific output
types, and independent numerical tests in Camber. This initial extraction does
not modify Camber or introduce a dependency on an unpublished release.

## Add a format

Create `formats/<name>/v<version>/` with `types.ts`, `specification.md`,
`examples/`, and `fixtures/valid/` and `fixtures/invalid/`. Add the format to the
catalog, including its `types` path, `schemaType` root interface name, and generated
`schema` path.
Add a type-only package export for its directory, run `npm run generate`, and
supply format-specific conformance tests. Share definitions only when
multiple real contracts need the same semantics; avoid speculative abstractions.
