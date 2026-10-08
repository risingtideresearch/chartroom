# Changelog

## 0.1.1

- Author hydrostatic-table v1 in readable TypeScript with JSDoc constraints and
  a dry/immersed sample union, preserving the data contract without schema
  overrides.
- Commit the generated draft-07 schema and check generation freshness in CI.
- Expose a type-only consumer import and add typechecking and structural boundary
  tests, including the dry/immersed sample relationship.
- Update release metadata and schema identification to v0.1.1. The hydrostatic
  format version remains 1. Generated schema definition names have changed;
  external references to old `#/definitions/...` paths must be updated.

## 0.1.0

- Extract the draft hydrostatic-table v1 schema, generic specification, and
  analytical box example from Camber without changing the data contract.
- Add release-specific schema identification and a format catalog.
- Add a minimal upright example and positive and negative conformance fixtures.
- Add structural and semantic conformance checks, package metadata, and CI.
- Document consumption through pinned GitHub tags and the release policy.

Licensing must be decided before public distribution.
