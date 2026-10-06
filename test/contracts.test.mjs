import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { semanticErrors } from "./hydrostatic-semantics.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const catalog = read("catalog.json");
const pkg = read("package.json");
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

for (const contract of catalog.formats) {
  const directory = contract.schema.slice(
    0,
    contract.schema.lastIndexOf("/") + 1,
  );
  const schema = read(contract.schema);
  const validate = ajv.compile(schema);
  const structuralCheck = (document) =>
    assert.ok(validate(document), JSON.stringify(validate.errors));
  const conformant = (document) => {
    structuralCheck(document);
    assert.deepEqual(semanticErrors(document), []);
  };

  test(`${contract.format}: catalog and release metadata`, () => {
    assert.equal(schema.properties.format.const, contract.format);
    assert.equal(schema.properties.version.const, contract.version);
    assert.equal(
      schema.$id,
      `https://raw.githubusercontent.com/risingtideresearch/chartroom/v${pkg.version}/${contract.schema}`,
    );
    assert.ok(
      readFileSync(new URL(contract.specification, root), "utf8").length,
    );
    assert.ok(contract.examples.length);
  });

  const validFixtures = readdirSync(
    new URL(`${directory}fixtures/valid/`, root),
  )
    .filter((file) => file.endsWith(".json"))
    .map((file) => `${directory}fixtures/valid/${file}`);
  for (const path of [...contract.examples, ...validFixtures]) {
    test(`conformant: ${path}`, () => {
      const document = read(path);
      conformant(document);
      assert.deepEqual(
        JSON.parse(
          readFileSync(new URL(document.$schema, new URL(path, root)), "utf8"),
        ),
        schema,
      );
    });
  }

  const manifest = read(`${directory}fixtures/manifest.json`);
  test("every invalid fixture is registered", () => {
    assert.deepEqual(
      manifest.map((fixture) => fixture.file).sort(),
      readdirSync(new URL(`${directory}fixtures/invalid/`, root))
        .filter((file) => file.endsWith(".json"))
        .map((file) => `invalid/${file}`)
        .sort(),
    );
  });
  for (const fixture of manifest) {
    test(`reject ${fixture.stage}: ${fixture.file}`, () => {
      const document = read(`${directory}fixtures/${fixture.file}`);
      if (fixture.stage === "structural")
        assert.equal(validate(document), false);
      else {
        assert.equal(fixture.stage, "semantic");
        structuralCheck(document);
        assert.ok(
          semanticErrors(document).includes(fixture.error),
          JSON.stringify(semanticErrors(document)),
        );
      }
    });
  }

  test("overflow from syntactically valid JSON is not finite", () => {
    const document = read(contract.examples[0]);
    document.table.rows[0].samples[0].volumeM3 = JSON.parse("1e400");
    assert.ok(semanticErrors(document).includes("finite"));
  });

  test("finite large moments cannot overflow the definiteness check", () => {
    const document = read(contract.examples[0]);
    const sample = document.table.rows[0].samples[0];
    sample.waterplane = {
      areaM2: 8,
      secondMomentsM4: { xx: 1e200, xy: 2e200, yy: 1e200 },
    };
    structuralCheck(document);
    assert.ok(semanticErrors(document).includes("waterplane-moments"));
    sample.waterplane.secondMomentsM4.xy = 0;
    conformant(document);
  });

  test("reference uses the immersion ranges of every contributing row", () => {
    const document = read(`${directory}examples/box.json`);
    // Between four attitude rows; one has a shorter immersion range.
    document.referenceState = {
      heelDeg: -5,
      trimDeg: -1,
      waterplaneOffsetM: 1.4,
    };
    document.table.rows[0].samples.pop();
    structuralCheck(document);
    assert.ok(semanticErrors(document).includes("reference-domain"));
    // On an exact attitude, adjacent rows must not constrain the reference.
    document.referenceState = {
      heelDeg: 0,
      trimDeg: 0,
      waterplaneOffsetM: 1.4,
    };
    conformant(document);
  });
}
