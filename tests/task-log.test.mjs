import test from "node:test";
import assert from "node:assert/strict";

import { buildApiTaskLogExport, sanitizeTaskLogEntry } from "../src/side-panel/task-log.ts";

test("sanitizeTaskLogEntry keeps progress bounded and trims sensitive-sized messages", () => {
  const entry = sanitizeTaskLogEntry({
    id: "task-1",
    kind: "summarize",
    status: "running",
    message: "x".repeat(260),
    progress: 140,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z"
  });

  assert.equal(entry.progress, 100);
  assert.equal(entry.message.length, 200);
  assert.equal(entry.kind, "summarize");
});

test("buildApiTaskLogExport returns portable JSON payload", () => {
  const payload = buildApiTaskLogExport([
    sanitizeTaskLogEntry({
      id: "task-1",
      kind: "summarize",
      status: "success",
      message: "Done",
      progress: 100,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:01.000Z"
    })
  ]);

  assert.equal(payload.version, 1);
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.entries[0].kind, "summarize");
});
