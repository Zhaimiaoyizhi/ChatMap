export type AiProvider = "openai" | "deepseek" | "custom";

export type AiSettings = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  autoSummarize: boolean;
};

const SETTINGS_KEY = "turnmap.aiSettings";
export const DEFAULT_MAX_TOKENS = 1200;
export const MIN_MAX_TOKENS = 256;
export const MAX_MAX_TOKENS = 12000;

const DEFAULTS: Record<AiProvider, Omit<AiSettings, "provider" | "apiKey" | "maxTokens" | "autoSummarize">> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  },
  custom: {
    baseUrl: "",
    model: ""
  }
};

export function defaultsForProvider(provider: AiProvider): AiSettings {
  return {
    provider,
    apiKey: "",
    maxTokens: DEFAULT_MAX_TOKENS,
    autoSummarize: false,
    ...DEFAULTS[provider]
  };
}

export function normalizeMaxTokens(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_MAX_TOKENS;
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_TOKENS;
  return Math.max(MIN_MAX_TOKENS, Math.min(MAX_MAX_TOKENS, Math.round(parsed)));
}

export async function loadAiSettings(): Promise<AiSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<AiSettings> | undefined;
  const provider = stored?.provider ?? "openai";

  return {
    ...defaultsForProvider(provider),
    ...stored,
    provider,
    maxTokens: normalizeMaxTokens(stored?.maxTokens)
  };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: {
      ...settings,
      maxTokens: normalizeMaxTokens(settings.maxTokens)
    }
  });
}
