# Chartroom

Application-independent marine data contracts. Each format includes a JSON Schema,
its normative specification, examples, and conformance fixtures. Chartroom defines
interchange data, not hull geometry algorithms, application state, or solver caches.

## Formats

| Format            | Version | Status | Contract                                                                                                            |
| ----------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Hydrostatic table | 1       | Draft  | [Specification](formats/hydrostatic-table/v1/specification.md) · [Schema](formats/hydrostatic-table/v1/schema.json) |

The [catalog](catalog.json) lists the available contracts and their paths.
Hydrostatic table v1 describes the static buoyancy response of one fixed closed
hull envelope, independently of a loading condition or water density. It was
extracted from Camber without changing its structural or physical semantics.

## Consume a GitHub release

Once this repository has been pushed and tagged `v0.1.0`:

```sh
npm install --save-dev --save-exact \
  'github:risingtideresearch/chartroom#v0.1.0'
```

The package name is `@risingtideresearch/chartroom`. It contains committed JSON and
Markdown artifacts; installation requires no build or generation step. Use a
regular dependency instead of a dev dependency if the application loads schemas
at runtime. Commit the consumer's lockfile, which records the resolved Git commit.

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

Tests validate the schemas, all examples, and valid fixtures. Invalid fixtures
are classified in `fixtures/manifest.json`: structural failures must fail JSON
Schema validation; semantic failures must pass it and violate the named semantic
rule. Test tolerances are documented in `test/hydrostatic-semantics.mjs`; producers
and consumers must select tolerances appropriate to their scale and precision.
CI runs these checks and checks the package contents.

## Versioning and releases

- A **repository/package release** (`v0.1.0`) versions the whole collection.
- A **format version** (`hydrostatic-table/v1`, `"version": 1`) versions one data
  contract. Formats evolve independently.
- Draft contracts may change, including incompatibly, but every change must be
  documented in the changelog and released under a new repository tag.
- Once a contract is stable, incompatible structure or semantics require a new
  format version. Do not reinterpret an existing stable version.
- Never move or replace a released tag. Consumers may pin a commit SHA instead
  of a tag when they need a stronger immutable reference.

Before a release:

1. Update `package.json`, the lockfile, and `CHANGELOG.md`.
2. Update schema `$id` URLs to the intended release tag. Paths within each format
   remain unchanged; examples use local relative schema references.
3. Run `npm ci`, `npm run check`, and `npm pack --dry-run`.
4. Commit the release, then create and push its annotated tag:

```sh
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin main
git push origin v0.1.0
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

Create `formats/<name>/v<version>/` with `schema.json`, `specification.md`,
`examples/`, and `fixtures/valid/` and `fixtures/invalid/`. Add it to the catalog
and supply format-specific conformance tests. Share definitions only when
multiple real contracts need the same semantics; avoid speculative abstractions.
