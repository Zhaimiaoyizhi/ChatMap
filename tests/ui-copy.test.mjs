import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("empty map copy is site-neutral for multi-site adapters", async () => {
  const canvasSource = await readFile(new URL("../src/side-panel/graph/TurnMapCanvas.tsx", import.meta.url), "utf8");
  const i18nSource = await readFile(new URL("../src/side-panel/i18n/i18n-storage.ts", import.meta.url), "utf8");

  assert.doesNotMatch(canvasSource, /Open a ChatGPT conversation/);
  assert.match(canvasSource, /Open a supported AI conversation with at least one complete answer\./);
  assert.match(i18nSource, /Open a supported AI conversation tab, then refresh TurnMap\./);
});
