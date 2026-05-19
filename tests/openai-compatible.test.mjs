import assert from "node:assert/strict";
import test from "node:test";

import { requestChatCompletion, testAiConnection } from "../src/side-panel/ai/openai-compatible.ts";
import { defaultsForProvider } from "../src/side-panel/settings/ai-settings-storage.ts";

function withChromePermissions() {
  globalThis.chrome = {
    permissions: {
      contains: async () => true,
      request: async () => true
    }
  };
}

function settings(overrides = {}) {
  return {
    ...defaultsForProvider("custom"),
    provider: "custom",
    baseUrl: "https://api.example.test/v1",
    model: "reasoning-model",
    apiKey: "test-key",
    ...overrides
  };
}

test("testAiConnection sends enough max_tokens for reasoning models", async () => {
  withChromePermissions();
  let body = {};
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  };

  await testAiConnection(settings({ maxTokens: 64 }));

  assert.equal(body.model, "reasoning-model");
  assert.ok(body.max_tokens >= 256);
});

test("requestChatCompletion uses saved max_tokens when the task does not override it", async () => {
  withChromePermissions();
  let body = {};
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 });
  };

  await requestChatCompletion(
    settings({ maxTokens: 4096 }),
    [{ role: "user", content: "Say hello" }],
    { temperature: 0 }
  );

  assert.equal(body.max_tokens, 4096);
});

test("requestChatCompletion keeps task-specific max_tokens above a low saved value", async () => {
  withChromePermissions();
  let body = {};
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 });
  };

  await requestChatCompletion(
    settings({ maxTokens: 512 }),
    [{ role: "user", content: "Return long JSON" }],
    { temperature: 0, maxTokens: 1800 }
  );

  assert.equal(body.max_tokens, 1800);
});
