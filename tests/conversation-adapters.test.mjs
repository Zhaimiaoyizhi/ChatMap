import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adapterSites,
  chatGptSite,
  isChatGptUrl,
  selectAdapter,
  siteMatchesUrl
} from "../src/content/adapter-registry.ts";
import { TURNMAP_LAUNCHER_ICON_PATH } from "../src/content/launcher-icon.ts";
import {
  blocksToTurns,
  conversationTitleFromCandidates,
  conversationTitleFromBlocks,
  dropAssistantEchoBlocks,
  extractBlocksFromDocument,
  joinUniqueWebTextParts,
  mergeWebTurns,
  roleCandidatesToBlocks
} from "../src/content/web-adapter-core.ts";

test("selectConversationAdapter selects ChatGPT for chatgpt.com conversations", () => {
  const chatGptAdapter = {
    site: chatGptSite,
    detectSite: isChatGptUrl
  };
  const adapter = selectAdapter([chatGptAdapter], new URL("https://chatgpt.com/c/example-id"));

  assert.equal(adapter?.site.id, "chatgpt");
  assert.equal(adapter?.site.displayName, "ChatGPT");
  assert.equal(adapter, chatGptAdapter);
});

test("selectConversationAdapter returns null for unsupported sites", () => {
  const adapter = selectAdapter(
    [
      {
        site: chatGptSite,
        detectSite: isChatGptUrl
      }
    ],
    new URL("https://example.com/c/example-id")
  );

  assert.equal(adapter, null);
});

test("adapter sites follow the confirmed 0.4.0 order", () => {
  assert.deepEqual(
    adapterSites.map((site) => site.id),
    [
      "chatgpt",
      "deepseek",
      "kimi",
      "doubao",
      "qwen",
      "gemini",
      "google-ai-studio",
      "claude",
      "perplexity",
      "grok",
      "glm",
      "mistral",
      "arena"
    ]
  );
});

test("siteMatchesUrl recognizes the planned AI conversation websites", () => {
  const cases = [
    ["deepseek", "https://chat.deepseek.com/a/chat/s/abc"],
    ["kimi", "https://www.kimi.com/chat/abc"],
    ["doubao", "https://www.doubao.com/chat/abc"],
    ["qwen", "https://chat.qwen.ai/c/abc"],
    ["qwen", "https://www.qianwen.com/chat/6815e278319349a1addcb9f30b4b1afa?st=null&bizPassParams=%26x-platform%3DexternalH5"],
    ["gemini", "https://gemini.google.com/app/abc"],
    ["google-ai-studio", "https://aistudio.google.com/prompts/abc"],
    ["google-ai-studio", "https://makersuite.google.com/app/prompts/abc"],
    ["claude", "https://claude.ai/chat/abc"],
    ["perplexity", "https://www.perplexity.ai/search/abc"],
    ["grok", "https://grok.com/chat/abc"],
    ["glm", "https://chatglm.cn/main/alltoolsdetail"],
    ["glm", "https://chat.z.ai/c/abc"],
    ["mistral", "https://chat.mistral.ai/chat/abc"],
    ["arena", "https://arena.ai/"],
    ["arena", "https://arena.ai/max"],
    ["arena", "https://lmarena.ai/"],
    ["arena", "https://www.lmarena.ai/"]
  ];

  for (const [siteId, href] of cases) {
    const site = adapterSites.find((candidate) => candidate.id === siteId);
    assert.ok(site, `missing site ${siteId}`);
    assert.equal(siteMatchesUrl(site, new URL(href)), true, `${siteId} should match ${href}`);
  }
});

test("manifest injects the content script on Gemini conversations", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const contentScriptMatches = manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [];
  const webAccessibleMatches =
    manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

  assert.ok(manifest.host_permissions.includes("https://gemini.google.com/*"));
  assert.ok(contentScriptMatches.includes("https://gemini.google.com/*"));
  assert.ok(webAccessibleMatches.includes("https://gemini.google.com/*"));
});

test("manifest injects the content script on Google AI Studio conversations", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const contentScriptMatches = manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [];
  const webAccessibleMatches =
    manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

  for (const match of ["https://aistudio.google.com/*", "https://makersuite.google.com/*"]) {
    assert.ok(manifest.host_permissions.includes(match), `${match} should be in host permissions`);
    assert.ok(contentScriptMatches.includes(match), `${match} should inject content script`);
    assert.ok(webAccessibleMatches.includes(match), `${match} should expose launcher icon`);
  }
});

test("manifest injects the content script on qianwen.com conversations", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const contentScriptMatches = manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [];
  const webAccessibleMatches =
    manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

  assert.ok(manifest.host_permissions.includes("https://qianwen.com/*"));
  assert.ok(manifest.host_permissions.includes("https://www.qianwen.com/*"));
  assert.ok(manifest.host_permissions.includes("https://*.qianwen.com/*"));
  assert.ok(contentScriptMatches.includes("https://qianwen.com/*"));
  assert.ok(contentScriptMatches.includes("https://www.qianwen.com/*"));
  assert.ok(contentScriptMatches.includes("https://*.qianwen.com/*"));
  assert.ok(webAccessibleMatches.includes("https://qianwen.com/*"));
  assert.ok(webAccessibleMatches.includes("https://www.qianwen.com/*"));
  assert.ok(webAccessibleMatches.includes("https://*.qianwen.com/*"));
});

test("DeepSeek profile strips visible thinking text before assistant answers", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const profile = source.slice(source.indexOf('site: siteById("deepseek")'), source.indexOf('site: siteById("kimi")'));

  assert.match(profile, /cleanDeepSeekConversationText/);
  assert.match(profile, /\[class\*='think' i\]/);
  assert.match(profile, /\[class\*='reason' i\]/);
  assert.match(source, /finalAnswerMarkers/);
});

test("manifest injects the content script on GLM conversations", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const contentScriptMatches = manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [];
  const webAccessibleMatches =
    manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

  for (const match of ["https://chatglm.cn/*", "https://chat.z.ai/*", "https://z.ai/*"]) {
    assert.ok(manifest.host_permissions.includes(match), `${match} should be in host permissions`);
    assert.ok(contentScriptMatches.includes(match), `${match} should inject content script`);
    assert.ok(webAccessibleMatches.includes(match), `${match} should expose launcher icon`);
  }
});

test("manifest injects the content script on Mistral Le Chat conversations", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const contentScriptMatches = manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [];
  const webAccessibleMatches =
    manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

  assert.ok(manifest.host_permissions.includes("https://chat.mistral.ai/*"));
  assert.ok(contentScriptMatches.includes("https://chat.mistral.ai/*"));
  assert.ok(webAccessibleMatches.includes("https://chat.mistral.ai/*"));
});

test("manifest injects the content script on Arena / LMArena conversations", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const contentScriptMatches = manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [];
  const webAccessibleMatches =
    manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

  for (const match of [
    "https://arena.ai/*",
    "https://www.arena.ai/*",
    "https://lmarena.ai/*",
    "https://www.lmarena.ai/*"
  ]) {
    assert.ok(manifest.host_permissions.includes(match), `${match} should be in host permissions`);
    assert.ok(contentScriptMatches.includes(match), `${match} should inject content script`);
    assert.ok(webAccessibleMatches.includes(match), `${match} should expose launcher icon`);
  }
});

test("package script refreshes the unpacked QA folder", () => {
  const source = readFileSync(new URL("../scripts/package-extension.mjs", import.meta.url), "utf8");

  assert.match(source, /turnmap-v\$\{version\}-unpacked/);
  assert.match(source, /await rm\(unpackedDir, \{ recursive: true, force: true \}\)/);
  assert.match(source, /await cp\(distDir, unpackedDir, \{ recursive: true \}\)/);
});

test("messaging requests current site access when dynamic content injection fails", () => {
  const source = readFileSync(new URL("../src/shared/messaging.ts", import.meta.url), "utf8");

  assert.match(source, /async function requestHostAccess/);
  assert.match(source, /chrome\.permissions\.request\(\{ origins: \[origin\] \}\)/);
  assert.match(source, /const granted = await requestHostAccess\(tabUrl\)/);
  assert.match(source, /await chrome\.tabs\.get\(tabId\)/);
});

test("Kimi profile recognizes current kimi.com segment role classes", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");

  assert.match(source, /site:\s*siteById\("kimi"\)/);
  assert.match(source, /\.segment\b/);
  assert.match(source, /\.segment-user\b/);
  assert.match(source, /\.segment-assistant\b/);
  assert.match(source, /\.segment-content-box\b/);
});

test("launcher uses the packaged TurnMap plugin icon", () => {
  const source = readFileSync(new URL("../src/content/index.ts", import.meta.url), "utf8");

  assert.equal(TURNMAP_LAUNCHER_ICON_PATH, "icons/turnmap-128.png");
  assert.match(source, /document\.createElement\("img"\)/);
  assert.match(source, /loadTurnMapLauncherIconSrc/);
  assert.doesNotMatch(source, /buildTurnMapLauncherIconSvg/);
  assert.doesNotMatch(source, /launcherButton\.innerHTML\s*=/);
});

test("content script can repair missing launcher after a previous partial start", () => {
  const source = readFileSync(new URL("../src/content/index.ts", import.meta.url), "utf8");

  assert.match(source, /launcherNeedsRepair/);
  assert.match(source, /!document\.querySelector\("\.turnmap-launcher"\)/);
  assert.match(source, /!document\.getElementById\("turnmap-launcher-style"\)/);
  assert.match(source, /__chatMapContentMessageListenerStarted/);
  assert.match(source, /startTurnMapContentMessageListener\(\)/);
});

test("joinUniqueWebTextParts removes nested selector duplicates", () => {
  const text = joinUniqueWebTextParts([
    "Search TurnMap GitHub Suggestions Check whether the user name is spelled correctly.",
    "Search TurnMap GitHub",
    "Suggestions",
    "Check whether the user name is spelled correctly."
  ]);

  assert.equal(text, "Search TurnMap GitHub Suggestions Check whether the user name is spelled correctly.");
});
test("Kimi profile extracts real segment roots instead of nested message fragments", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");

  assert.match(source, /selector: "\.segment-user, \.segment-assistant, \.segment\.segment-user, \.segment\.segment-assistant"/);
  assert.match(source, /"\.segment-content-box > \.segment-content"/);
  assert.match(source, /roleMessageSelectors:\s*\[\]/);
  assert.doesNotMatch(source, /\.segment-user \.segment-content-box/);
  assert.doesNotMatch(source, /\.segment-assistant \.segment-content-box/);
});

test("Gemini profile reads current user-query and model-response text paths", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");

  assert.match(source, /site:\s*siteById\("gemini"\)/);
  assert.match(source, /selector: "user-query, \[data-role='user'\], \[class\*='user-query' i\]"/);
  assert.match(source, /"\.query-text-line"/);
  assert.match(source, /"\[class\*='query-text' i\]"/);
  assert.match(source, /"\.model-response-text \.markdown"/);
  assert.match(source, /"message-content\[class\*='model-response-text' i\]"/);
  assert.match(source, /messageRootSelector:/);
  assert.match(source, /turnPairRootSelectors:/);
  assert.match(source, /selector: "\.conversation-container, \[class\*='conversation-container' i\]"/);
  assert.match(source, /scrollContainerSelectors: \["\[data-test-id='chat-history-container'\]", "infinite-scroller"\]/);
  assert.match(source, /role === "user" \? text\.replace\(\/\^\\s\*\(\?:你说\|You said\)\\s\*\[:：\]\?\\s\*\/i, ""\) : text/);
});

test("Google AI Studio profile reads prompt user and model turns", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("google-ai-studio")');
  const end = source.indexOf('site: siteById("claude")', start);
  const profile = source.slice(start, end);

  assert.match(profile, /site:\s*siteById\("google-ai-studio"\)/);
  assert.match(profile, /titleFromFirstUserMessage:\s*true/);
  assert.match(profile, /ms-chat-turn/);
  assert.match(profile, /ms-prompt-input-wrapper/);
  assert.match(profile, /ms-cmark-node/);
  assert.match(profile, /model-response/);
  assert.match(profile, /cleanGoogleAiStudioText/);
  assert.match(profile, /\[class\*='thought' i\]/);
  assert.match(profile, /ms-cmark-node:not\(\[class\*='thought' i\]\)/);
  assert.match(profile, /roleMessageRootSelectors:/);
  assert.match(profile, /roleMessageSelectors:/);
  assert.match(profile, /role === "user"[\s\S]*?text\.replace\(\/\^\\s\*\(\?:User\|You\)\\s\*\[:：\]\?\\s\*\/i, ""\)/);
  assert.match(profile, /text\.replace\(\/\^\\s\*\(\?:Model\|Assistant\)\\s\*\[:：\]\?\\s\*\/i, ""\)/);
});

test("Google AI Studio assistant cleanup removes collapsed thoughts chrome", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");

  assert.match(source, /function cleanGoogleAiStudioText/);
  assert.match(source, /Thoughts\?\\s\+Expand to view model thoughts/);
  assert.match(source, /Expand to view model thoughts/);
});

test("Doubao profile recognizes 2026-05 message wrappers and markdown answers", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("doubao")');
  const end = source.indexOf('site: siteById("qwen")', start);
  const doubaoProfile = source.slice(start, end);

  assert.match(doubaoProfile, /site:\s*siteById\("doubao"\)/);
  assert.match(doubaoProfile, /titleSuffixPattern:\s*\/\\s\*\[-\|\]\\s\*豆包\.\*\$\/i/);
  assert.match(doubaoProfile, /\[class\*='message-list-S2Fv2S'\]/);
  assert.match(doubaoProfile, /\[class\*='inner-item-'\]/);
  assert.match(doubaoProfile, /\[class\*='top-item-'\]/);
  assert.match(doubaoProfile, /\[data-testid='send_message'\]/);
  assert.match(doubaoProfile, /\[data-testid='receive_message'\]/);
  assert.match(doubaoProfile, /\.flow-markdown-body/);
  assert.match(doubaoProfile, /\[data-foundation-type='receive-message-action-bar'\]/);
});

test("Doubao observer does not broadcast transient empty refreshes", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("doubao")');
  const end = source.indexOf('site: siteById("qwen")', start);
  const doubaoProfile = source.slice(start, end);

  assert.match(doubaoProfile, /suppressEmptyObserverRefresh:\s*true/);
  assert.match(source, /if \(turns\.length === 0 && profile\.suppressEmptyObserverRefresh\) return;/);
});

test("Qwen profile recognizes qianwen.com chat rounds and scroll container", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("qwen")');
  const end = source.indexOf('site: siteById("gemini")', start);
  const qwenProfile = source.slice(start, end);

  assert.match(qwenProfile, /#message-list-scroller/);
  assert.match(qwenProfile, /\.message-list-scroll-container/);
  assert.match(qwenProfile, /\.chat-message-item\[data-chat\]/);
  assert.match(qwenProfile, /\.chat-round\[data-chat\]/);
  assert.match(qwenProfile, /\.chat-question-wrap/);
  assert.match(qwenProfile, /\[data-chat-question-wrap\]/);
  assert.match(qwenProfile, /\[data-chat-answers-wrap\]/);
  assert.match(qwenProfile, /\.chat-answers-card-wrap/);
});

test("Qwen profile reads conversation titles before generic Qwen page titles", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("qwen")');
  const end = source.indexOf('site: siteById("gemini")', start);
  const qwenProfile = source.slice(start, end);
  const title = conversationTitleFromCandidates(
    {
      site: { id: "qwen", displayName: "Qwen", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(Qwen|通义|千问).*$/i,
      titleBlocklistPatterns: [
        /^Qwen$/i,
        /^Qwen Studio$/i,
        /^Qwen(?:\d+(?:\.\d+)*)?[-\s]*(?:Plus|Max|Turbo|Coder|VL|Omni|Instruct)$/i,
        /^New Chat$/i
      ],
      titleFromFirstUserMessage: true
    },
    ["Qwen Studio", "Qwen3.6-Plus", "搜索对话", "GitHub TurnMap 项目查找"],
    "Qwen",
    [{ role: "user", text: "查找github上turnmap项目" }]
  );

  assert.match(qwenProfile, /titleFromFirstUserMessage:\s*true/);
  assert.match(qwenProfile, /titleSelectors:/);
  assert.match(qwenProfile, /aside \[title\]/);
  assert.match(qwenProfile, /titleBlocklistPatterns:/);
  assert.match(qwenProfile, /\^Qwen Studio\$/);
  assert.match(qwenProfile, /Qwen\(\?:\\d\+\(\?:\\\.\\d\+\)\*\)\?/);
  assert.equal(title, "GitHub TurnMap 项目查找");
});

test("Grok profile recognizes current grok response and user bubble paths", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("grok")');
  const end = source.indexOf('site: siteById("glm")', start);
  const grokProfile = source.slice(start, end);

  assert.match(grokProfile, /site:\s*siteById\("grok"\)/);
  assert.match(grokProfile, /\[data-testid='grok-response'\]/);
  assert.match(grokProfile, /\.response-content-markdown/);
  assert.match(grokProfile, /\.justify-end \.message-bubble/);
  assert.match(grokProfile, /\.items-end \.message-bubble/);
  assert.match(grokProfile, /\[style\*='justify-content: flex-end'\] \.message-bubble/);
  assert.match(grokProfile, /skipAssistantEchoText:\s*true/);
  assert.doesNotMatch(grokProfile, /roleExtractionOnly:\s*true/);
  assert.match(grokProfile, /sameRoleStrategy:\s*"last"/);
  assert.match(grokProfile, /\.message-bubble\.max-w-none:not\(\.bg-surface-l1\)/);
  assert.match(grokProfile, /\.thinking-container/);
  assert.match(grokProfile, /\.action-buttons/);
  assert.match(grokProfile, /"div\[dir='ltr'\]"/);
  assert.doesNotMatch(grokProfile, /\[class\*='grok' i\]/);
  assert.doesNotMatch(grokProfile, /assistantMarkerSelectors: \["\.max-w-none:not\(\.bg-surface-l1\)"/);
  assert.doesNotMatch(grokProfile, /\.max-w-none:not\(\.bg-surface-l1\) div\[dir='ltr'\]/);
  assert.doesNotMatch(grokProfile, /selector: "\.message-bubble",\s*userMarkerSelectors:[\s\S]*?assistantMarkerSelectors:/);
  assert.doesNotMatch(grokProfile, /role: "assistant",[\s\S]*?selector:[^\n]*"\.message-bubble[,"]/);
  assert.match(grokProfile, /role: "assistant",[\s\S]*?rootSelector:[\s\S]*?div\[id\^='response-'\]/);
  assert.match(grokProfile, /role: "assistant",[\s\S]*?contentSelectors: \[[^\]]*"p\.break-words"/);
});

test("Grok selector fallback can recover nodes without echoing user bubbles", () => {
  const source = readFileSync(new URL("../src/content/web-adapter-core.ts", import.meta.url), "utf8");
  const implementationStart = source.indexOf("export function extractBlocksFromDocument");
  const implementationEnd = source.indexOf("export function extractTurnsFromDocument", implementationStart);
  const implementation = source.slice(implementationStart, implementationEnd);

  assert.doesNotMatch(implementation, /roleExtractionOnly/);
  assert.match(implementation, /profile\.site\.id === "grok"/);
  assert.match(implementation, /profile\.roleExtraction\?\.skipAssistantEchoText/);
  assert.match(implementation, /dropAssistantEchoBlocks\(selectorBlocks\)/);
});

test("selector fallback echo filter keeps Grok answers after dropping copied prompts", () => {
  const blocks = dropAssistantEchoBlocks([
    { role: "user", text: "在github上搜索turnmap项目", elementId: "grok-user" },
    { role: "assistant", text: "在github上搜索turnmap项目", elementId: "grok-echo" },
    { role: "assistant", text: "找到了 GitHub 项目：Zhaimiaoyizhi/TurnMap。", elementId: "response-1" }
  ]);

  assert.deepEqual(
    blocks.map((block) => [block.role, block.text]),
    [
      ["user", "在github上搜索turnmap项目"],
      ["assistant", "找到了 GitHub 项目：Zhaimiaoyizhi/TurnMap。"]
    ]
  );
  assert.equal(blocksToTurns(blocks).length, 1);
});

test("Grok assistant candidates do not reuse the user prompt as the answer", () => {
  const blocks = roleCandidatesToBlocks(
    [
      { role: "user", text: "为什么无法联网", top: 10, elementId: "grok-user-echo" },
      { role: "assistant", text: "为什么无法联网", top: 20, elementId: "grok-assistant-echo" },
      { role: "assistant", text: "Grok 当前回答说明它无法直接访问外部网络。", top: 30, elementId: "response-1" }
    ],
    {
      skipAssistantEchoText: true
    }
  );
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "为什么无法联网");
  assert.equal(turns[0].assistantText, "Grok 当前回答说明它无法直接访问外部网络。");
});

test("web adapter supports Gemini-style paired turn roots and explicit scroll containers", () => {
  const source = readFileSync(new URL("../src/content/web-adapter-core.ts", import.meta.url), "utf8");

  assert.match(source, /export type TurnPairRootSelector/);
  assert.match(source, /turnPairRootSelectors\?: TurnPairRootSelector\[\]/);
  assert.match(source, /profile\.turnPairRootSelectors/);
  assert.match(source, /profile\.scrollContainerSelectors/);
  assert.match(source, /cleanText\?: \(text: string, role: ConversationBlock\["role"\]\) => string/);
  assert.match(source, /function cleanProfileText/);
  assert.match(source, /const text = cleanProfileText\(profile, rawText, role\);/);
});
test("Kimi fixture: one user + one assistant segment produces exactly 1 turn", () => {
  const blocks = roleCandidatesToBlocks([
    {
      role: "user",
      text: "What is artificial intelligence?",
      top: 120,
      elementId: "segment-user-0"
    },
    {
      role: "assistant",
      text: "Artificial intelligence (AI) is the simulation of human intelligence by machines.",
      top: 240,
      elementId: "segment-assistant-0"
    }
  ]);
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "What is artificial intelligence?");
  assert.equal(turns[0].assistantText, "Artificial intelligence (AI) is the simulation of human intelligence by machines.");
});

test("Kimi fixture: nested content/markdown/paragraph inside segment still yields 1 turn", () => {
  const blocks = roleCandidatesToBlocks([
    {
      role: "user",
      text: "Explain AI",
      top: 100,
      elementId: "segment-user-0"
    },
    {
      role: "assistant",
      text: "AI refers to machines that mimic human cognitive functions.\n\nKey areas include machine learning and natural language processing.\n\nApplications span healthcare, finance, and autonomous vehicles.",
      top: 200,
      elementId: "segment-assistant-0"
    }
  ]);
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "Explain AI");
  assert.match(turns[0].assistantText, /machine learning/);
  assert.match(turns[0].assistantText, /natural language processing/);
});

test("Kimi fixture: sidebar history, input box, and action button text excluded from turns", () => {
  const blocks = roleCandidatesToBlocks(
    [
      { role: "user", text: "Previous question from sidebar", top: 50, elementId: "sidebar-item", excluded: true },
      { role: "user", text: "Explain AI", top: 100, elementId: "segment-user-0" },
      { role: "assistant", text: "AI is artificial intelligence.", top: 200, elementId: "segment-assistant-0" },
      {
        role: "assistant",
        text: "引用 复制 重新生成 点赞 点踩",
        top: 260,
        elementId: "action-bar"
      },
      { role: "user", text: "Type your message here", top: 320, elementId: "chat-input", excluded: true }
    ],
    {
      actionTextPatterns: [/^引用$/, /^复制$/, /^重新生成$/, /^点赞$/, /^点踩$/, /引用|复制|重新生成|点赞|点踩/]
    }
  );
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "Explain AI");
  assert.doesNotMatch(turns[0].userText, /sidebar/);
  assert.doesNotMatch(turns[0].userText, /Type your message/);
  assert.doesNotMatch(turns[0].assistantText, /引用|复制|重新生成|点赞|点踩/);
});

test("Kimi fixture: consecutive same-role candidates merge into one block", () => {
  const blocks = roleCandidatesToBlocks([
    { role: "user", text: "First part of question", top: 100, elementId: "u1" },
    { role: "user", text: "Second part of question", top: 110, elementId: "u2" },
    { role: "assistant", text: "This is the answer.", top: 200, elementId: "a1" }
  ]);
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.match(turns[0].userText, /First part/);
  assert.match(turns[0].userText, /Second part/);
  assert.equal(turns[0].assistantText, "This is the answer.");
});

test("Kimi fixture: single user without assistant creates No text response fallback", () => {
  const blocks = roleCandidatesToBlocks([
    { role: "user", text: "Orphaned question", top: 100, elementId: "u-orphan" }
  ]);
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "Orphaned question");
  assert.equal(turns[0].assistantText, "No text response");
});

test("web jump lookup does not fall back to visible block index for virtualized chats", () => {
  const source = readFileSync(new URL("../src/content/web-adapter-core.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /userBlocks\[anchor\.turnIndex\]/);
  assert.doesNotMatch(source, /collapseRepeatedWebText/);
  assert.doesNotMatch(source, /isDuplicateUserCandidate|preferredUserCandidate/);
  assert.match(source, /export async function scrollToWebTurn/);
  assert.match(source, /getWebChatScrollCandidates/);
});

test("web jump lookup does not trust repeated generic DOM ids before text matching", () => {
  const source = readFileSync(new URL("../src/content/web-adapter-core.ts", import.meta.url), "utf8");
  const lookupStart = source.indexOf("export function findWebTurnElement");
  const lookupEnd = source.indexOf("function revealWebTurnElement", lookupStart);
  const lookup = source.slice(lookupStart, lookupEnd);

  assert.doesNotMatch(lookup, /block\.elementId === anchor\.userMessageId\) return/);
  assert.match(lookup, /const textHash = hashText\(rawText\);/);
  assert.match(lookup, /textMatches/);
  assert.match(lookup, /idLooksUnique/);
});

test("web jump reveals turns with direct container centering and stable highlight", () => {
  const source = readFileSync(new URL("../src/content/web-adapter-core.ts", import.meta.url), "utf8");

  assert.match(source, /WEB_HIGHLIGHT_CLASS = "turnmap-source-highlight"/);
  assert.match(source, /function scrollElementToCenter\(element: HTMLElement, scrollElement: HTMLElement\)/);
  assert.match(source, /function revealWebTurnElement\(element: HTMLElement, scrollElement\?: HTMLElement\)/);
  assert.match(source, /element\.classList\.add\(WEB_HIGHLIGHT_CLASS\)/);
  assert.doesNotMatch(source, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
});

test("Perplexity profile declares its own scroll and content boundaries", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("perplexity")');
  const end = source.indexOf('site: siteById("grok")', start);
  const profile = source.slice(start, end);

  assert.match(profile, /scrollContainerSelectors/);
  assert.match(profile, /main/);
  assert.match(profile, /data-testid\*='thread'/);
  assert.match(profile, /messageRootSelector/);
  assert.match(profile, /div\[id\^='markdown-content-'\]/);
  assert.match(profile, /sharedWebSelectors\.excludeSelectors/);
});

test("Claude profile reads conversation titles before generic Claude page titles", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("claude")');
  const end = source.indexOf('site: siteById("perplexity")', start);
  const claudeProfile = source.slice(start, end);
  const title = conversationTitleFromCandidates(
    {
      site: { id: "claude", displayName: "Claude", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*Claude.*$/i,
      titleBlocklistPatterns: [/^Claude$/i, /^New chat$/i],
      titleFromFirstUserMessage: true
    },
    ["Claude", "New chat"],
    "Claude",
    [{ role: "user", text: "整理 Claude 项目标题提取问题" }]
  );

  assert.match(claudeProfile, /titleFromFirstUserMessage:\s*true/);
  assert.match(claudeProfile, /titleSelectors:/);
  assert.match(claudeProfile, /titleBlocklistPatterns:/);
  assert.equal(title, "整理 Claude 项目标题提取问题");
});

test("GLM profile recognizes ChatGLM and Z.ai Open WebUI message structure", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("glm")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(profile, /site:\s*siteById\("glm"\)/);
  assert.match(profile, /\.detail \.session-block/);
  assert.match(profile, /\.detail \.item \.question/);
  assert.match(profile, /\.question-txt/);
  assert.match(profile, /\.detail \.item \.answer/);
  assert.match(profile, /\.panel \.printing/);
  assert.match(profile, /#messages-container/);
  assert.match(profile, /\.user-message/);
  assert.match(profile, /\.chat-user/);
  assert.match(profile, /\.chat-assistant/);
  assert.match(profile, /\.markdown-prose/);
  assert.match(profile, /messageInputContainer/);
  assert.match(profile, /toolsView/);
});

test("GLM profile reads current chat titles before generic page titles", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("glm")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const title = conversationTitleFromCandidates(
    {
      site: { id: "glm", displayName: "GLM / Z.ai", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(智谱清言|ChatGLM|Z\.ai|GLM).*$/i,
      titleBlocklistPatterns: [/^智谱清言$/i, /^ChatGLM$/i]
    },
    ["智谱清言", "查找 TurnMap 的最新资料"],
    "智谱清言"
  );

  assert.match(profile, /titleSelectors:/);
  assert.match(profile, /\.conversation-title/);
  assert.match(profile, /\[aria-current='page'\]/);
  assert.equal(title, "查找 TurnMap 的最新资料");
});

test("GLM profile ignores sidebar chrome and falls back to the first user message", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("glm")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const title = conversationTitleFromCandidates(
    {
      site: { id: "glm", displayName: "GLM / Z.ai", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(智谱清言|ChatGLM|Z\.ai|GLM).*$/i,
      titleBlocklistPatterns: [/^智谱清言$/i, /^ChatGLM$/i],
      titleFromFirstUserMessage: true
    },
    ["智谱清言 新对话 学习搭子 AI画图 AI阅读 最近对话 搜索github上的turnmap项目"],
    "智谱清言",
    [{ role: "user", text: "搜索github上的turnmap项目" }]
  );

  assert.match(profile, /titleFromFirstUserMessage:\s*true/);
  assert.match(profile, /"\[aria-current='page'\]"/);
  assert.match(profile, /"\[aria-selected='true'\]"/);
  assert.equal(title, "搜索github上的turnmap项目");
});

test("GLM profile strips conversation action text from selected history titles", () => {
  const title = conversationTitleFromCandidates(
    {
      site: { id: "glm", displayName: "GLM / Z.ai", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(智谱清言|ChatGLM|Z\.ai|GLM).*$/i,
      titleBlocklistPatterns: [/^智谱清言$/i, /^ChatGLM$/i],
      titleFromFirstUserMessage: true
    },
    ["搜索github上的turnmap项目 批量操作 重命名 删除对话"],
    "智谱清言",
    [{ role: "user", text: "搜索github上的turnmap项目" }]
  );

  assert.equal(title, "搜索github上的turnmap项目");
});

test("GLM profile removes hidden operation planning text from assistant answers", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("glm")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(source, /function cleanGlmConversationText/);
  assert.match(profile, /cleanGlmConversationText\(text, role\)/);
  assert.match(profile, /理解用户请求/);
  assert.match(profile, /批量操作/);
});

test("Mistral profile recognizes Le Chat message and markdown boundaries", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("mistral")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(profile, /site:\s*siteById\("mistral"\)/);
  assert.match(profile, /titleSuffixPattern:\s*\/\\s\*\[-\|\]\\s\*\(Le Chat\|Mistral\)\.\*\$\/i/);
  assert.match(profile, /\[data-testid\*=["']conversation/);
  assert.match(profile, /\[data-testid\*=["']message/);
  assert.match(profile, /\[data-role='user'\]/);
  assert.match(profile, /\[data-role='assistant'\]/);
  assert.match(profile, /\[class\*='markdown' i\]/);
  assert.match(profile, /\[class\*='prose' i\]/);
  assert.match(profile, /\[class\*='composer' i\]/);
});

test("Mistral profile recognizes current Le Chat author-role DOM", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("mistral")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(profile, /div\[data-message-author-role="user"\]/);
  assert.match(profile, /div\[data-message-author-role="assistant"\]/);
  assert.match(profile, /div\[data-message-author-role="user"\] div\[dir="auto"\]/);
  assert.match(profile, /div\[data-message-author-role="assistant"\] div\[data-message-part-type="answer"\]/);
  assert.match(profile, /div\[data-message-part-type="answer"\]/);
  assert.match(profile, /main\.bg-sidebar-subtle/);
});

test("Mistral profile reads the selected chat title before Le Chat page chrome", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("mistral")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const titleSelectors = profile.slice(profile.indexOf("titleSelectors:"), profile.indexOf("titleBlocklistPatterns:"));
  const title = conversationTitleFromCandidates(
    {
      site: { id: "mistral", displayName: "Mistral Le Chat", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(Le Chat|Mistral).*$/i,
      titleBlocklistPatterns: [/^Le Chat$/i, /^New chat$/i]
    },
    ["Le Chat", "New chat", "Roadmap adapter QA"],
    "Le Chat | Mistral"
  );

  assert.match(profile, /titleSelectors:/);
  assert.match(profile, /\[data-testid\*='conversation-title' i\]/);
  assert.match(profile, /\[aria-current='page'\]/);
  assert.equal(title, "Roadmap adapter QA");
});

test("Mistral profile ignores Le Chat navigation chrome and falls back to the first user message", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("mistral")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const titleSelectors = profile.slice(profile.indexOf("titleSelectors:"), profile.indexOf("titleBlocklistPatterns:"));
  const title = conversationTitleFromCandidates(
    {
      site: { id: "mistral", displayName: "Mistral Le Chat", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(Le Chat|Mistral).*$/i,
      titleBlocklistPatterns: [/^Le Chat$/i, /^New chat$/i],
      titleFromFirstUserMessage: true
    },
    ["Le Chat New Chat Agents Intelligence Projects Chats TurnMap项目比较 Upgrade to Pro"],
    "Le Chat | Mistral",
    [{ role: "user", text: "查找github上的TurnMap项目" }]
  );

  assert.match(profile, /titleFromFirstUserMessage:\s*true/);
  assert.match(profile, /"\[aria-current='page'\]"/);
  assert.match(profile, /"\[aria-selected='true'\]"/);
  assert.equal(title, "查找github上的TurnMap项目");
});

test("Mistral profile does not use active navigation labels as conversation titles", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("mistral")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const titleSelectors = profile.slice(profile.indexOf("titleSelectors:"), profile.indexOf("titleBlocklistPatterns:"));
  const title = conversationTitleFromCandidates(
    {
      site: { id: "mistral", displayName: "Mistral Le Chat", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(Le Chat|Mistral).*$/i,
      titleBlocklistPatterns: [/^Le Chat$/i, /^New chat$/i, /^Agents$/i],
      titleFromFirstUserMessage: true
    },
    ["Agents", "TurnMap项目比较"],
    "Le Chat | Mistral",
    [{ role: "user", text: "查找github上的TurnMap项目" }]
  );

  assert.doesNotMatch(titleSelectors, /"\[class\*='active' i\]"/);
  assert.doesNotMatch(titleSelectors, /"\[class\*='selected' i\]"/);
  assert.equal(title, "TurnMap项目比较");
});

test("Mistral profile strips Le Chat UI timestamps from extracted text", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("mistral")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(profile, /cleanText\(text\)/);
  assert.match(profile, /stripMistralUiTimestamps\(text\)/);
  assert.match(source, /Today\|Yesterday/);
  assert.match(source, /May/);
  assert.match(source, /am\|pm/);
  assert.match(source, /Worked for/);
});

test("Arena profile recognizes Arena and LMArena message boundaries", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("arena")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(profile, /site:\s*siteById\("arena"\)/);
  assert.match(profile, /titleSuffixPattern:\s*\/\\s\*\[-\|\]\\s\*\(Arena\|LMArena\|Chatbot Arena\|Max\)\.\*\$\/i/);
  assert.match(profile, /#chat-area/);
  assert.match(profile, /bg-surface-raised/);
  assert.match(profile, /max-w-prose/);
  assert.match(profile, /main\[role='presentation'\]/);
  assert.match(profile, /\[data-message-id\]/);
  assert.match(profile, /\[data-role='user'\]/);
  assert.match(profile, /\[data-role='assistant'\]/);
  assert.match(profile, /\[class\*='markdown' i\]/);
  assert.match(profile, /\[class\*='prose' i\]/);
  assert.match(profile, /\[class\*='whitespace-pre-wrap' i\]/);
  assert.match(profile, /\[class\*='composer' i\]/);
  assert.match(profile, /\[class\*='sidebar' i\]/);
  assert.match(profile, /\[class\*='source' i\]/);
  assert.match(profile, /Add files/);
});

test("Arena profile handles side-by-side battle labels without treating them as content", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("arena")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);

  assert.match(source, /function cleanArenaBattleChromeText/);
  assert.match(profile, /Assistant A/);
  assert.match(profile, /Assistant B/);
  assert.match(profile, /Response A/);
  assert.match(profile, /Response B/);
  assert.match(profile, /Option A/);
  assert.match(profile, /Option B/);
  assert.match(profile, /No Sources/);
  assert.match(profile, /sameRoleStrategy:\s*"first"/);
  assert.match(profile, /skipAssistantEchoText:\s*true/);
  assert.match(profile, /rolePriority:\s*\["assistant", "user"\]/);
  assert.match(profile, /titleFromFirstUserMessage:\s*true/);
  assert.match(profile, /cleanArenaBattleChromeText\(text\)/);
});

test("Arena assistant role markers do not treat max-w-prose user bubbles as prose answers", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("arena")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const assistantSelectors = profile.slice(profile.indexOf("assistantSelectors:"), profile.indexOf("messageRootSelector:"));
  const assistantMarkers = profile.slice(
    profile.indexOf("assistantMarkerSelectors:"),
    profile.indexOf("userContentSelectors:")
  );
  const assistantRoleSelector = profile.slice(
    profile.indexOf('role: "assistant"'),
    profile.indexOf("contentSelectors:", profile.indexOf('role: "assistant"'))
  );

  assert.doesNotMatch(assistantSelectors, /"\[class\*='prose' i\]"/);
  assert.doesNotMatch(assistantSelectors, /"#chat-area \[class\*='prose'\]"/);
  assert.doesNotMatch(assistantMarkers, /"\[class\*='prose' i\]"/);
  assert.doesNotMatch(assistantRoleSelector, /\[class\*='prose' i\]/);
  assert.match(assistantSelectors, /#chat-area \[class\*='prose'\]\[class\*='break-words'\]/);
  assert.match(assistantMarkers, /#chat-area \[class\*='prose'\]\[class\*='break-words'\]/);
});

test("Arena battle candidates use only the first side-by-side answer by default", () => {
  const blocks = roleCandidatesToBlocks(
    [
      { role: "user", text: "查找TurnMap", top: 10, elementId: "arena-user-1" },
      { role: "assistant", text: "Assistant A\n第一个回答", top: 20, elementId: "arena-a-1" },
      { role: "assistant", text: "Assistant B\n第二个回答", top: 30, elementId: "arena-b-1" }
    ],
    {
      actionTextPatterns: [/^Copy$/i],
      sameRoleStrategy: "first"
    }
  );
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "查找TurnMap");
  assert.match(turns[0].assistantText, /第一个回答/);
  assert.doesNotMatch(turns[0].assistantText, /第二个回答/);
});

test("Arena assistant candidates do not reuse the user prompt as the answer", () => {
  const blocks = roleCandidatesToBlocks(
    [
      { role: "user", text: "继续说说 TurnMap", top: 10, elementId: "arena-user-echo" },
      { role: "assistant", text: "继续说说 TurnMap", top: 20, elementId: "arena-assistant-echo" },
      { role: "assistant", text: "TurnMap 会把网页对话整理成可跳转的节点。", top: 30, elementId: "arena-assistant-real" }
    ],
    {
      sameRoleStrategy: "first",
      skipAssistantEchoText: true
    }
  );
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "继续说说 TurnMap");
  assert.equal(turns[0].assistantText, "TurnMap 会把网页对话整理成可跳转的节点。");
});

test("Arena title can use the first real user prompt instead of the SEO page title", () => {
  const title = conversationTitleFromBlocks(
    {
      site: { id: "arena", displayName: "Arena / LMArena", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(Arena|LMArena|Chatbot Arena|Max).*$/i,
      titleFromFirstUserMessage: true
    },
    [
      { role: "assistant", text: "TurnMap 会把网页对话整理成可跳转的节点。" },
      { role: "user", text: "我想要最新的，与AI、思维导图相关的" }
    ],
    "Arena AI: The Official AI Ranking & LLM Leaderboard"
  );

  assert.equal(title, "我想要最新的，与AI、思维导图相关的");
});

test("Arena profile reads selected history titles before the SEO leaderboard title", () => {
  const source = readFileSync(new URL("../src/content/conversation-adapters.ts", import.meta.url), "utf8");
  const start = source.indexOf('site: siteById("arena")');
  const end = source.indexOf("];", start);
  const profile = source.slice(start, end);
  const title = conversationTitleFromCandidates(
    {
      site: { id: "arena", displayName: "Arena / LMArena", hostPatterns: [] },
      userSelectors: [],
      assistantSelectors: [],
      titleSuffixPattern: /\s*[-|]\s*(Arena|LMArena|Chatbot Arena|Max).*$/i,
      titleBlocklistPatterns: [/^Arena AI: The Official AI Ranking & LLM Leaderboard$/i],
      titleFromFirstUserMessage: true
    },
    ["Arena AI: The Official AI Ranking & LLM Leaderboard", "查找TurnMap"],
    "Arena AI: The Official AI Ranking & LLM Leaderboard"
  );

  assert.match(profile, /titleSelectors:/);
  assert.match(profile, /\[aria-current='page'\]/);
  assert.match(profile, /titleBlocklistPatterns:/);
  assert.equal(title, "查找TurnMap");
});

test("saved generic conversation root titles do not override freshly extracted titles", () => {
  const canvasSource = readFileSync(new URL("../src/side-panel/graph/TurnMapCanvas.tsx", import.meta.url), "utf8");
  const storageSource = readFileSync(new URL("../src/side-panel/graph/graph-storage.ts", import.meta.url), "utf8");

  assert.match(canvasSource, /function isGenericConversationRootTitle/);
  assert.match(canvasSource, /rootTitleFromOverride/);
  assert.doesNotMatch(canvasSource, /title:\s*rootOverride\?\.title\s*\?\?\s*conversationTitle/);
  assert.match(storageSource, /isGenericConversationRootTitle/);
  assert.match(storageSource, /node\.id === "conversation-root" && isGenericConversationRootTitle/);
});

test("saved navigation root titles do not override freshly extracted titles", () => {
  const canvasSource = readFileSync(new URL("../src/side-panel/graph/TurnMapCanvas.tsx", import.meta.url), "utf8");
  const storageSource = readFileSync(new URL("../src/side-panel/graph/graph-storage.ts", import.meta.url), "utf8");

  assert.match(canvasSource, /\^Agents\$/);
  assert.match(canvasSource, /\^Intelligence\$/);
  assert.match(canvasSource, /\^Qwen\$/);
  assert.match(canvasSource, /\^Qwen Studio\$/);
  assert.match(canvasSource, /\^Claude\$/);
  assert.match(storageSource, /\^Agents\$/);
  assert.match(storageSource, /\^Intelligence\$/);
  assert.match(storageSource, /\^Qwen\$/);
  assert.match(storageSource, /\^Qwen Studio\$/);
  assert.match(storageSource, /\^Claude\$/);
});

test("web adapter derives titles from fallback role extraction blocks", () => {
  const source = readFileSync(new URL("../src/content/web-adapter-core.ts", import.meta.url), "utf8");
  const titleStart = source.indexOf("export function getWebConversationTitle");
  const titleEnd = source.indexOf("export function getWebConversationId", titleStart);
  const implementation = source.slice(titleStart, titleEnd);

  assert.match(implementation, /extractBlocksWithFallback\(profile\)/);
  assert.doesNotMatch(implementation, /extractBlocksFromDocument\(profile\)/);
});

test("root node context menu is swallowed before jump eligibility checks", () => {
  const source = readFileSync(new URL("../src/side-panel/graph/TurnNode.tsx", import.meta.url), "utf8");
  const handlerStart = source.indexOf("const jumpFromText");
  const handlerEnd = source.indexOf("nodeData.onJump?.(id)", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.ok(handler.indexOf("event.preventDefault()") > -1);
  assert.ok(handler.indexOf("event.stopPropagation()") > -1);
  assert.ok(handler.indexOf("event.preventDefault()") < handler.indexOf("!nodeData.turn"));
  assert.ok(handler.indexOf("event.stopPropagation()") < handler.indexOf("!nodeData.turn"));
});

test("blocksToTurns pairs ordinary web AI user and assistant blocks", () => {
  const turns = blocksToTurns([
    { role: "user", text: "Explain adapters", elementId: "u1" },
    { role: "assistant", text: "Adapters translate site-specific DOM into TurnMap turns.", elementId: "a1" },
    { role: "user", text: "What about cards?", elementId: "u2" },
    { role: "assistant", text: "Cards are conservatively flattened into readable text.", elementId: "a2" }
  ]);

  assert.equal(turns.length, 2);
  assert.equal(turns[0].userText, "Explain adapters");
  assert.equal(turns[0].assistantText, "Adapters translate site-specific DOM into TurnMap turns.");
  assert.equal(turns[0].sourceAnchor.userMessageId, "u1");
  assert.equal(turns[0].sourceAnchor.assistantMessageId, "a1");
  assert.equal(turns[1].turnIndex, 1);
});

test("role-aware candidates map only explicit user and assistant messages into turns", () => {
  const blocks = roleCandidatesToBlocks(
    [
      { role: "assistant", text: "Previous assistant answer should not become a node.", top: 120, elementId: "previous-assistant" },
      { role: "user", text: "Summarize what I solved tonight", top: 260, elementId: "user-question" },
      { role: "assistant", text: "Thinking for 1 second", top: 330, elementId: "thinking-label" },
      {
        role: "assistant",
        text: "We need a short 200 word summary about server deployment and Python issues.",
        top: 360,
        elementId: "assistant-intro"
      },
      {
        role: "assistant",
        text: "1. SSH configuration: fixed wrong -p placement and HostName containing the user name.",
        top: 420,
        elementId: "assistant-list-1"
      },
      { role: "assistant", text: "Copy Like Dislike Share", top: 560, elementId: "assistant-actions" },
      { role: "user", text: "Send message to DeepSeek", top: 620, elementId: "composer", excluded: true }
    ],
    {
      actionTextPatterns: [/^Thinking/, /Copy|Like|Dislike|Share/]
    }
  );
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].userText, "Summarize what I solved tonight");
  assert.match(turns[0].assistantText, /server deployment/);
  assert.match(turns[0].assistantText, /SSH configuration/);
  assert.doesNotMatch(turns[0].assistantText, /Previous assistant/);
  assert.doesNotMatch(turns[0].assistantText, /Thinking/);
  assert.doesNotMatch(turns[0].assistantText, /Copy|Like|Dislike|Share/);
  assert.doesNotMatch(turns[0].assistantText, /Send message/);
});

test("role-aware extraction does not create nodes from assistant-only content", () => {
  const blocks = roleCandidatesToBlocks([
    {
      role: "assistant",
      text: "This is a visible AI answer, but there is no explicit preceding user message.",
      top: 100,
      elementId: "assistant-only"
    },
    {
      role: "assistant",
      text: "Summary: fixed SSH config, created a conda env, used screen, and normalized UTF-8.",
      top: 130,
      elementId: "assistant-only-2"
    }
  ]);
  const turns = blocksToTurns(blocks);

  assert.equal(turns.length, 0);
});
test("mergeWebTurns deduplicates repeated scan passes by user text fingerprint", () => {
  const firstPass = blocksToTurns([
    { role: "user", text: "Host myserver HostName Life2406@202.120.45.149", elementId: "user-visible-1" },
    { role: "assistant", text: "Use HostName for the host only.", elementId: "assistant-visible-1" }
  ]);
  const secondPass = blocksToTurns([
    { role: "user", text: "Host myserver HostName Life2406@202.120.45.149", elementId: "user-recycled-99" },
    {
      role: "assistant",
      text: "Use HostName for the host only, and keep User as a separate field.",
      elementId: "assistant-recycled-99"
    }
  ]);

  const merged = mergeWebTurns(firstPass, secondPass);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].turnIndex, 0);
  assert.match(merged[0].assistantText, /separate field/);
});
