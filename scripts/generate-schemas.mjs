import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";
import { format, resolveConfig } from "prettier";

const root = new URL("../", import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const catalog = await readJson("catalog.json");
const pkg = await readJson("package.json");
const check = process.argv.includes("--check");

for (const contract of catalog.formats) {
  const schemaUrl = new URL(contract.schema, root);
  const schema = createGenerator({
    path: fileURLToPath(new URL(contract.types, root)),
    tsconfig: fileURLToPath(new URL("tsconfig.json", root)),
    type: contract.schemaType,
    topRef: false,
    jsDoc: "extended",
    sortProps: false,
    strictTuples: true,
    additionalProperties: false,
  }).createSchema(contract.schemaType);

  const output = await format(
    JSON.stringify({
      $id: `https://raw.githubusercontent.com/risingtideresearch/chartroom/v${pkg.version}/${contract.schema}`,
      $comment: "Generated from types.ts. Do not edit; run npm run generate.",
      ...schema,
    }),
    {
      ...(await resolveConfig(fileURLToPath(schemaUrl))),
      parser: "json",
    },
  );
  if (check) {
    if ((await readFile(schemaUrl, "utf8")) !== output) {
      console.error(`${contract.schema} is stale. Run npm run generate.`);
      process.exitCode = 1;
    }
  } else {
    await writeFile(schemaUrl, output);
    console.log(`Generated ${contract.schema}`);
  }
}
