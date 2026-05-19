import test from "node:test";
import assert from "node:assert/strict";

import { buildCollapsedTopic } from "../src/side-panel/graph/topic-collapse.ts";

test("buildCollapsedTopic creates a topic note from selected turns", () => {
  const result = buildCollapsedTopic({
    now: 12345,
    selectedNodes: [
      {
        id: "turn-a",
        title: "Calvin cycle overview",
        summary: "Explains fixation and reduction.",
        position: { x: 100, y: 80 },
        turnIndex: 0
      },
      {
        id: "turn-b",
        title: "C3 and C4 plant comparison",
        summary: "Compares carbon fixation strategies.",
        position: { x: 300, y: 180 },
        turnIndex: 1
      }
    ]
  });

  assert.equal(result.id, "custom-topic-12345-turn-a");
  assert.equal(result.title, "Topic: Calvin cycle overview");
  assert.deepEqual(result.hiddenNodeIds, ["turn-a", "turn-b"]);
  assert.deepEqual(result.position, { x: 200, y: 130 });
  assert.deepEqual(result.tags, ["topic"]);
  assert.match(result.summary, /Collapsed topic from 2 turns/);
  assert.match(result.summary, /Turn 1: Calvin cycle overview/);
  assert.match(result.summary, /Turn 2: C3 and C4 plant comparison/);
});

