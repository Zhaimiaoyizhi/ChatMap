export type AiProvider = "openai" | "deepseek" | "custom";

export type AiSettings = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  autoSummarize: boolean;
};

const SETTINGS_KEY = "turnmap.aiSettings";

const DEFAULTS: Record<AiProvider, Omit<AiSettings, "provider" | "apiKey" | "autoSummarize">> = {
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
    autoSummarize: false,
    ...DEFAULTS[provider]
  };
}

export async function loadAiSettings(): Promise<AiSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<AiSettings> | undefined;
  const provider = stored?.provider ?? "openai";

  return {
    ...defaultsForProvider(provider),
    ...stored,
    provider
  };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
