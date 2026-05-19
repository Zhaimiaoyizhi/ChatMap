import type { AiSettings } from "../settings/ai-settings-storage";

const DEFAULT_REQUEST_MAX_TOKENS = 1200;
const MIN_REQUEST_MAX_TOKENS = 256;
const MAX_REQUEST_MAX_TOKENS = 12000;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  retriedEmptyResponse?: boolean;
};

type ProviderPayload = {
  choices?: Array<{
    message?: {
      content?: unknown;
      function_call?: {
        arguments?: unknown;
      };
      tool_calls?: Array<{
        function?: {
          arguments?: unknown;
        };
      }>;
    };
    delta?: {
      content?: unknown;
      function_call?: {
        arguments?: unknown;
      };
      tool_calls?: Array<{
        function?: {
          arguments?: unknown;
        };
      }>;
    };
    text?: unknown;
  }>;
  output_text?: unknown;
  output?: unknown;
  candidates?: unknown;
  content?: unknown;
  message?: unknown;
  response?: unknown;
  text?: unknown;
  rawText?: unknown;
  ssePayloads?: unknown;
  error?: unknown;
};

export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function assertSettings(settings: AiSettings): void {
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    throw new Error("Configure AI provider, model, and API key first.");
  }
}

function errorMessageFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  const type = (error as { type?: unknown }).type;
  const code = (error as { code?: unknown }).code;
  const parts = [message, type, code].filter((part): part is string => typeof part === "string");
  return parts.length > 0 ? parts.join(" ") : null;
}

function compactPayload(payload: unknown): string {
  if (payload == null) return "no JSON body";

  try {
    const serialized = JSON.stringify(payload);
    return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
  } catch {
    return "unreadable response body";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTextCandidate(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const text = value
      .map((part) => normalizeTextCandidate(part) ?? "")
      .join("")
      .trim();
    return text || null;
  }

  if (!isRecord(value)) return null;
  if ("title" in value && "summary" in value) return JSON.stringify(value);
  if ("edges" in value && Array.isArray((value as { edges?: unknown }).edges)) return JSON.stringify(value);

  const typed = value as {
    text?: unknown;
    content?: unknown;
    output_text?: unknown;
    arguments?: unknown;
    parts?: unknown;
    message?: unknown;
    function?: unknown;
    tool_calls?: unknown;
    value?: unknown;
  };
  return (
    normalizeTextCandidate(typed.text) ??
    normalizeTextCandidate(typed.output_text) ??
    normalizeTextCandidate(typed.arguments) ??
    normalizeTextCandidate(typed.parts) ??
    normalizeTextCandidate(typed.content) ??
    normalizeTextCandidate(typed.message) ??
    normalizeTextCandidate(typed.function) ??
    normalizeTextCandidate(typed.tool_calls) ??
    normalizeTextCandidate(typed.value)
  );
}

function pushCandidate(candidates: unknown[], value: unknown): void {
  if (value !== undefined && value !== null) candidates.push(value);
}

function contentCandidatesFromPayload(payload: unknown): unknown[] {
  const candidates: unknown[] = [];
  if (!payload || typeof payload !== "object") {
    pushCandidate(candidates, payload);
    return candidates;
  }

  const typed = payload as ProviderPayload;
  pushCandidate(candidates, typed.output_text);
  pushCandidate(candidates, typed.response);
  pushCandidate(candidates, typed.text);
  pushCandidate(candidates, typed.rawText);
  pushCandidate(candidates, typed.content);
  pushCandidate(candidates, typed.message);

  for (const choice of typed.choices ?? []) {
    pushCandidate(candidates, choice.message?.content);
    pushCandidate(candidates, choice.message?.function_call?.arguments);
    for (const toolCall of choice.message?.tool_calls ?? []) {
      pushCandidate(candidates, toolCall.function?.arguments);
    }
    pushCandidate(candidates, choice.delta?.content);
    pushCandidate(candidates, choice.delta?.function_call?.arguments);
    for (const toolCall of choice.delta?.tool_calls ?? []) {
      pushCandidate(candidates, toolCall.function?.arguments);
    }
    pushCandidate(candidates, choice.text);
  }

  if (Array.isArray(typed.output)) {
    for (const item of typed.output) {
      pushCandidate(candidates, item);
    }
  }
  if (Array.isArray(typed.candidates)) {
    for (const item of typed.candidates) {
      pushCandidate(candidates, item);
    }
  }
  if (Array.isArray(typed.ssePayloads)) {
    for (const item of typed.ssePayloads) {
      candidates.push(...contentCandidatesFromPayload(item));
    }
  }

  return candidates;
}

function contentFromPayload(payload: unknown): string | null {
  for (const candidate of contentCandidatesFromPayload(payload)) {
    const text = normalizeTextCandidate(candidate);
    if (text) return text;
  }

  return null;
}

function parseSsePayloads(text: string): unknown[] {
  const payloads: unknown[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;

    try {
      payloads.push(JSON.parse(data));
    } catch {
      payloads.push(data);
    }
  }

  return payloads;
}

async function parseProviderPayload(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;

  const ssePayloads = parseSsePayloads(text);
  if (ssePayloads.length > 0) {
    return { rawText: text.slice(0, 500), ssePayloads };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function hostPatternForBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return null;
    }
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

async function ensureHostPermission(settings: AiSettings): Promise<void> {
  const pattern = hostPatternForBaseUrl(settings.baseUrl);
  if (!pattern) return;

  const hasPermission = await chrome.permissions.contains({ origins: [pattern] }).catch(() => true);
  if (hasPermission) return;

  const granted = await chrome.permissions.request({ origins: [pattern] }).catch(() => false);
  if (!granted) {
    throw new Error(`Permission is required to contact ${pattern}`);
  }
}

function effectiveMaxTokens(settings: AiSettings, requested?: number): number {
  const configured = normalizeRequestMaxTokens(settings.maxTokens);
  if (requested == null) return configured;
  return Math.max(configured, normalizeRequestMaxTokens(requested));
}

function expandedMaxTokens(current: number): number {
  return normalizeRequestMaxTokens(Math.max(current + 512, current * 2, MIN_REQUEST_MAX_TOKENS));
}

function normalizeRequestMaxTokens(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_REQUEST_MAX_TOKENS;
  if (!Number.isFinite(parsed)) return DEFAULT_REQUEST_MAX_TOKENS;
  return Math.max(MIN_REQUEST_MAX_TOKENS, Math.min(MAX_REQUEST_MAX_TOKENS, Math.round(parsed)));
}

export async function requestChatCompletion(
  settings: AiSettings,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  assertSettings(settings);
  await ensureHostPermission(settings);
  const maxTokens = effectiveMaxTokens(settings, options.maxTokens);

  const body: Record<string, unknown> = {
    model: settings.model,
    temperature: options.temperature ?? 0.2,
    max_tokens: maxTokens,
    messages
  };
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${stripTrailingSlash(settings.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${settings.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await parseProviderPayload(response);
  if (!response.ok) {
    const message = errorMessageFromPayload(payload);
    const detail = message ?? compactPayload(payload);
    if (options.jsonMode && /response_format|json_object/i.test(detail)) {
      return requestChatCompletion(settings, messages, { ...options, jsonMode: false });
    }
    throw new Error(`AI request failed (${response.status} ${response.statusText || "HTTP"}): ${detail}`);
  }

  const content = contentFromPayload(payload);
  if (content == null && options.jsonMode) {
    return requestChatCompletion(settings, messages, {
      ...options,
      jsonMode: false,
      maxTokens: expandedMaxTokens(maxTokens),
      retriedEmptyResponse: true
    });
  }

  if (content == null && !options.retriedEmptyResponse) {
    return requestChatCompletion(settings, messages, {
      ...options,
      jsonMode: false,
      maxTokens: expandedMaxTokens(maxTokens),
      retriedEmptyResponse: true
    });
  }

  if (content == null) {
    throw new Error(
      `AI response did not contain readable text. Expected choices[0].message.content; received ${compactPayload(
        payload
      )}`
    );
  }

  return content;
}

export async function testAiConnection(settings: AiSettings): Promise<void> {
  const content = await requestChatCompletion(
    settings,
    [
      {
        role: "system",
        content: "Reply with exactly: ok"
      },
      {
        role: "user",
        content: "Connection test"
      }
    ],
    { temperature: 0, maxTokens: 256 }
  );

  if (!content.trim()) {
    throw new Error(
      "AI provider returned an empty text response. Check the model name, account quota, and whether this endpoint returns OpenAI-compatible chat content."
    );
  }
}
