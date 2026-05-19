import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public package and extension branding use TurnMap", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(packageJson.name, "turnmap");
  assert.equal(manifest.name, "TurnMap");
  assert.equal(manifest.action.default_title, "Open TurnMap");
  assert.match(readme, /^# TurnMap/m);
});
