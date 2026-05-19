export type ConversationSite = {
  id: string;
  displayName: string;
  hostPatterns: string[];
};

export type DetectableConversationAdapter = {
  site: ConversationSite;
  detectSite(url: URL): boolean;
};

export const chatGptSite: ConversationSite = {
  id: "chatgpt",
  displayName: "ChatGPT",
  hostPatterns: ["chatgpt.com", "*.chatgpt.com"]
};

export const adapterSites: ConversationSite[] = [
  chatGptSite,
  {
    id: "deepseek",
    displayName: "DeepSeek",
    hostPatterns: ["chat.deepseek.com"]
  },
  {
    id: "kimi",
    displayName: "Kimi",
    hostPatterns: ["www.kimi.com", "kimi.com"]
  },
  {
    id: "doubao",
    displayName: "Doubao",
    hostPatterns: ["doubao.com", "*.doubao.com"]
  },
  {
    id: "qwen",
    displayName: "Qwen",
    hostPatterns: [
      "chat.qwen.ai",
      "qianwen.com",
      "www.qianwen.com",
      "*.qianwen.com",
      "tongyi.aliyun.com",
      "*.tongyi.aliyun.com",
      "qianwen.aliyun.com",
      "*.qianwen.aliyun.com"
    ]
  },
  {
    id: "gemini",
    displayName: "Gemini",
    hostPatterns: ["gemini.google.com"]
  },
  {
    id: "google-ai-studio",
    displayName: "Google AI Studio",
    hostPatterns: ["aistudio.google.com", "makersuite.google.com"]
  },
  {
    id: "claude",
    displayName: "Claude",
    hostPatterns: ["claude.ai", "*.claude.ai"]
  },
  {
    id: "perplexity",
    displayName: "Perplexity",
    hostPatterns: ["perplexity.ai", "*.perplexity.ai"]
  },
  {
    id: "grok",
    displayName: "Grok",
    hostPatterns: ["grok.com", "*.grok.com", "x.com"]
  },
  {
    id: "glm",
    displayName: "GLM / Z.ai",
    hostPatterns: ["chatglm.cn", "www.chatglm.cn", "chat.z.ai", "z.ai"]
  },
  {
    id: "mistral",
    displayName: "Mistral Le Chat",
    hostPatterns: ["chat.mistral.ai"]
  },
  {
    id: "arena",
    displayName: "Arena / LMArena",
    hostPatterns: ["arena.ai", "www.arena.ai", "lmarena.ai", "www.lmarena.ai"]
  }
];

export function siteMatchesUrl(site: ConversationSite, url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return site.hostPatterns.some((pattern) => {
    const normalized = pattern.toLowerCase();
    if (normalized.startsWith("*.")) {
      const suffix = normalized.slice(2);
      return hostname.endsWith(`.${suffix}`);
    }
    return hostname === normalized;
  });
}

export function isChatGptUrl(url: URL): boolean {
  return siteMatchesUrl(chatGptSite, url);
}

export function selectAdapter<TAdapter extends DetectableConversationAdapter>(
  adapters: TAdapter[],
  url: URL
): TAdapter | null {
  return adapters.find((adapter) => adapter.detectSite(url)) ?? null;
}
