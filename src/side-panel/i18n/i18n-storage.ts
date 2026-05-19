import { requestChatCompletion } from "../ai/openai-compatible";
import { loadAiSettings } from "../settings/ai-settings-storage";

export type BuiltInLanguage = "en" | "zh";
export type LanguageMode = "browser" | BuiltInLanguage | `custom:${string}`;

export type CustomLanguage = {
  id: string;
  label: string;
  languageName: string;
  translations: Record<string, string>;
  createdAt: string;
};

export const LANGUAGE_STORAGE_KEY = "turnmap.interface.language";
export const CUSTOM_LANGUAGES_STORAGE_KEY = "turnmap.interface.customLanguages";
export const DEFAULT_LANGUAGE: LanguageMode = "browser";

export const BUILT_IN_LANGUAGE_OPTIONS: Array<{ value: LanguageMode; label: string }> = [
  { value: "browser", label: "Follow browser" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" }
];

export const EN_TRANSLATIONS = {
  "app.kicker": "Conversation mind map",
  "app.subtitle.hasTurns": "Click a node to jump back to the source turn.",
  "app.subtitle.noTurns": "No complete turns found yet.",
  "app.action.refresh": "Refresh",
  "app.action.deepScan": "Deep Scan",
  "app.action.settings": "Settings",
  "app.action.debug": "Debug",
  "app.action.view": "View",
  "app.view.sidePanel": "Side Panel",
  "app.view.fullPage": "Full Page",
  "app.view.showFloat": "Show Float",
  "app.view.hideFloat": "Hide Float",
  "app.view.current": "Current",
  "app.status.waiting": "Waiting for an AI conversation...",
  "app.status.cacheFailed": "Turns loaded, but IndexedDB caching failed.",
  "app.status.mappedDeepScan": "{count} turns mapped via deep-scan after {steps} steps",
  "app.status.mappedVia": "{count} turns mapped via {source}",
  "app.status.loadedTurns": "{count} loaded turns mapped",
  "app.status.reading": "Reading the full AI conversation...",
  "app.status.openConversation": "Open a supported AI conversation tab, then refresh TurnMap.",
  "app.status.deepScanning": "Deep scanning loaded conversation history...",
  "app.status.deepScanFailed": "Deep scan could not reach the active conversation tab.",
  "app.status.noActiveTab": "No active supported AI conversation tab was found.",
  "app.status.floatEnabled": "Floating panel enabled",
  "app.status.floatDisabled": "Floating panel disabled",
  "app.status.floatFailed": "Could not reach the conversation tab for floating panel.",
  "debug.conversation": "Conversation",
  "debug.site": "Site",
  "debug.id": "ID",
  "debug.turns": "Turns",
  "debug.source": "Source",
  "debug.steps": "Steps",
  "debug.scroll": "Scroll",
  "debug.apiTasks": "API tasks",
  "debug.exportReport": "Export Report",
  "debug.exportTaskLog": "Export Task Log",
  "debug.exportTaskLogDone": "Exported {filename}",
  "toolbar.layout": "Layout",
  "toolbar.suggestLinks": "Suggest Links",
  "toolbar.suggesting": "Suggesting...",
  "toolbar.search": "Search",
  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "toolbar.summarizeAll": "Summarize All",
  "toolbar.summarizing": "Summarizing...",
  "toolbar.files": "Files",
  "file.importJson": "Import JSON",
  "file.exportJson": "Export JSON",
  "file.exportCanvas": "Export Canvas",
  "file.exportOpml": "Export OPML",
  "file.exportObsidianVault": "Export Obsidian Vault",
  "file.exportSvg": "Export SVG",
  "file.exportPng": "Export PNG",
  "file.exportMd": "Export MD",
  "file.copyMd": "Copy MD",
  "file.resetMap": "Reset Map",
  "file.exported": "Exported {filename}",
  "search.title": "Search Map",
  "search.close": "Close",
  "search.placeholder": "Search title, summary, tag...",
  "search.empty": "No matching nodes.",
  "suggestions.title": "AI Link Suggestions",
  "suggestions.acceptAll": "Accept All",
  "suggestions.accept": "Accept",
  "suggestions.reject": "Reject",
  "suggestions.clear": "Clear",
  "settings.title": "TurnMap Settings",
  "settings.subtitle": "Manage global settings without crowding the map workspace.",
  "settings.close": "Close",
  "settings.status.local": "Settings are stored locally in this browser profile.",
  "settings.status.interfaceSaved": "Interface settings saved.",
  "settings.section.interface": "Interface",
  "settings.section.interfaceHint": "Defaults for map views and supported-site page helpers",
  "settings.defaultLayout": "Default layout",
  "layout.single": "Single-side",
  "layout.radial": "Radial",
  "layout.matrix": "Matrix",
  "layout.twoSided": "Two-sided",
  "relationship.related": "Related",
  "relationship.dependsOn": "Depends on",
  "relationship.extends": "Extends",
  "relationship.supports": "Supports",
  "relationship.contradicts": "Contradicts",
  "relationship.contrasts": "Contrasts",
  "relationship.duplicates": "Duplicates",
  "relationship.verifies": "Verifies",
  "relationship.references": "References",
  "relationship.todo": "Todo",
  "node.conversation": "Conversation",
  "node.note": "Note",
  "node.turn": "Turn {number}",
  "node.ai": "AI",
  "node.aiWorking": "AI...",
  "panel.nodesSelected": "{count} Nodes Selected",
  "panel.organizeSelected": "Organize selected turns as notes or review groups.",
  "panel.nodeActions": "Node Actions",
  "panel.nodeHint": "Create notes, split this turn, or start bulk organization.",
  "panel.linkTitle": "Link Actions",
  "panel.headerTitle": "Header",
  "panel.headerHint": "Double-click the header text to edit it.",
  "field.type": "Type",
  "field.label": "Label",
  "action.close": "Close",
  "action.mergeNodes": "Merge Nodes",
  "action.collapseTopic": "Collapse Topic",
  "action.addTag": "Add Tag",
  "action.colorNode": "Color",
  "action.collapseNode": "Fold",
  "action.expandNode": "Unfold",
  "action.open": "Open",
  "action.review": "Review",
  "action.done": "Done",
  "action.duplicateAsNote": "Duplicate as Note",
  "action.splitNode": "Split Node",
  "action.selectAllTurns": "Select All Turns",
  "action.important": "Important",
  "action.convertToNote": "Convert to Note",
  "action.deleteLink": "Delete Link",
  "action.deleteHeader": "Delete Header",
  "label.confidence": "Confidence",
  "color.theme": "Theme",
  "color.slate": "Slate",
  "color.blue": "Blue",
  "color.emerald": "Emerald",
  "color.amber": "Yellow",
  "color.red": "Red",
  "color.violet": "Violet",
  "color.cyan": "Cyan",
  "color.rose": "Brown",
  "status.nodesCollapsed": "Selected nodes folded.",
  "status.nodesExpanded": "Selected nodes unfolded.",
  "status.nodesImportant": "Selected nodes marked important.",
  "status.nodesNormal": "Selected nodes unmarked important.",
  "task.summarizeOne": "Summarizing turn {current}... 5%",
  "task.summarizeOneDone": "Turn {current} summarized. 100%",
  "task.summarizeAll": "Summarizing {total} turns... 0%",
  "task.summarizeProgress": "AI task progress: {current}/{total}",
  "task.summarizeAllDone": "Batch summary finished: {total} turns updated. 100%",
  "task.summarizeFailed": "AI summary failed.",
  "task.autoSummarize": "Auto summarizing {total} default nodes... 0%",
  "task.autoSummarizeDone": "Auto summarize finished: {total} nodes updated. 100%",
  "task.autoSummarizeFailed": "Auto summarize failed.",
  "task.suggestLinks": "Asking AI to suggest semantic links... 15%",
  "task.suggestLinksDone": "{count} AI link suggestions ready for review. 100%",
  "task.suggestLinksFailed": "AI link suggestion failed.",
  "task.translate": "Translating TurnMap UI to {language}... 10%",
  "task.translateDone": "Translation generated for {language}. 100%",
  "settings.theme": "Theme",
  "settings.theme.browser": "Follow browser",
  "settings.theme.day": "Day",
  "settings.theme.night": "Night",
  "settings.theme.eyeCare": "Eye-care",
  "settings.language": "Language",
  "settings.language.browser": "Follow browser",
  "settings.language.english": "English",
  "settings.language.chinese": "Chinese",
  "settings.languageHint": "Built-in Chinese and English follow the browser by default.",
  "settings.customLanguage": "Custom language",
  "settings.customLanguagePlaceholder": "Spanish, Japanese, German...",
  "settings.generateTranslation": "Generate with AI",
  "settings.generatingTranslation": "Generating...",
  "settings.customTranslationHint":
    "AI translation only sends TurnMap UI labels, not your conversation content. Generated labels are stored locally.",
  "settings.enableFloat": "Enable Float navigator by default",
  "settings.showLauncher": "Show TurnMap launcher on supported AI pages",
  "settings.nodeColorRendering": "Node color rendering",
  "settings.nodeColorRenderMode": "Render mode",
  "settings.nodeColorRenderGradient": "Gradient",
  "settings.nodeColorRenderSolid": "Solid",
  "settings.nodeColorRenderStrength": "Render strength",
  "settings.saveInterface": "Save Interface",
  "settings.loadingInterface": "Loading interface settings...",
  "settings.section.updates": "Updates",
  "settings.section.updatesHint": "Preview controls for release notifications",
  "settings.showUpdates": "Show update notices when available",
  "settings.includePrerelease": "Include pre-release versions",
  "settings.ignoredVersion": "Ignored version",
  "settings.updateHint":
    "GitHub/unpacked installs cannot be silently updated by the extension. Update notices will point users to a release page or package when this feature is connected.",
  "settings.saveUpdates": "Save Updates",
  "settings.loadingUpdates": "Loading update settings...",
  "settings.translationSaved": "Generated translation saved.",
  "settings.translationNeedsName": "Enter a target language name first.",
  "settings.translationFailed": "AI translation failed.",
  "ai.title": "AI Provider",
  "ai.subtitle": "OpenAI-compatible chat completions",
  "ai.provider": "Provider",
  "ai.customCompatible": "Custom compatible",
  "ai.baseUrl": "Base URL",
  "ai.model": "Model",
  "ai.apiKey": "API Key",
  "ai.apiKeyPlaceholder": "Stored locally",
  "ai.privacy":
    "API keys are saved in this browser's extension storage. TurnMap sends conversation text only when you run AI features or enable auto summarize.",
  "ai.autoSummarize": "Auto summarize new/default nodes",
  "ai.status.local": "Settings are stored locally. AI features send selected conversation text to your configured provider.",
  "ai.status.saved": "Saved.",
  "ai.status.aiSaved": "AI settings saved.",
  "ai.status.testing": "Testing connection...",
  "ai.status.connectionSaved": "Connection succeeded. Settings saved.",
  "ai.status.connectionSavedGlobal": "AI connection succeeded. Settings saved.",
  "ai.status.failed": "Connection test failed.",
  "ai.save": "Save",
  "ai.test": "Test Connection",
  "ai.testing": "Testing..."
} as const;

export type I18nKey = keyof typeof EN_TRANSLATIONS;
export type TranslationMap = Record<I18nKey, string>;

export const ZH_TRANSLATIONS: TranslationMap = {
  "app.kicker": "对话思维导图",
  "app.subtitle.hasTurns": "点击节点即可跳回来源轮次。",
  "app.subtitle.noTurns": "还没有找到完整问答轮次。",
  "app.action.refresh": "刷新",
  "app.action.deepScan": "深度扫描",
  "app.action.settings": "设置",
  "app.action.debug": "调试",
  "app.action.view": "视图",
  "app.view.sidePanel": "侧边栏",
  "app.view.fullPage": "全屏页",
  "app.view.showFloat": "显示浮窗",
  "app.view.hideFloat": "隐藏浮窗",
  "app.view.current": "当前",
  "app.status.waiting": "正在等待 AI 对话...",
  "app.status.cacheFailed": "对话已加载，但 IndexedDB 缓存失败。",
  "app.status.mappedDeepScan": "已通过深度扫描映射 {count} 个节点，共 {steps} 步",
  "app.status.mappedVia": "已通过 {source} 映射 {count} 个节点",
  "app.status.loadedTurns": "已映射 {count} 个已加载节点",
  "app.status.reading": "正在读取完整 AI 对话...",
  "app.status.openConversation": "请打开一个受支持的 AI 对话标签页，然后刷新 TurnMap。",
  "app.status.deepScanning": "正在深度扫描已加载的对话历史...",
  "app.status.deepScanFailed": "深度扫描无法连接到当前对话标签页。",
  "app.status.noActiveTab": "没有找到当前活动的受支持 AI 对话标签页。",
  "app.status.floatEnabled": "浮窗已启用",
  "app.status.floatDisabled": "浮窗已关闭",
  "app.status.floatFailed": "无法连接到对话标签页以显示浮窗。",
  "debug.conversation": "对话",
  "debug.site": "站点",
  "debug.id": "ID",
  "debug.turns": "轮次",
  "debug.source": "来源",
  "debug.steps": "步数",
  "debug.scroll": "滚动",
  "debug.apiTasks": "API 任务",
  "debug.exportReport": "导出报告",
  "debug.exportTaskLog": "导出任务日志",
  "debug.exportTaskLogDone": "已导出 {filename}",
  "toolbar.layout": "布局",
  "toolbar.suggestLinks": "建议链接",
  "toolbar.suggesting": "建议中...",
  "toolbar.search": "搜索",
  "toolbar.undo": "撤销",
  "toolbar.redo": "重做",
  "toolbar.summarizeAll": "全部总结",
  "toolbar.summarizing": "总结中...",
  "toolbar.files": "文件",
  "file.importJson": "导入 JSON",
  "file.exportJson": "导出 JSON",
  "file.exportCanvas": "导出 Canvas",
  "file.exportOpml": "导出 OPML",
  "file.exportObsidianVault": "导出 Obsidian Vault",
  "file.exportSvg": "导出 SVG",
  "file.exportPng": "导出 PNG",
  "file.exportMd": "导出 MD",
  "file.copyMd": "复制 MD",
  "file.resetMap": "重置导图",
  "file.exported": "已导出 {filename}",
  "search.title": "搜索导图",
  "search.close": "关闭",
  "search.placeholder": "搜索标题、摘要、标签...",
  "search.empty": "没有匹配的节点。",
  "suggestions.title": "AI 链接建议",
  "suggestions.acceptAll": "全部接受",
  "suggestions.accept": "接受",
  "suggestions.reject": "拒绝",
  "suggestions.clear": "清空",
  "settings.title": "TurnMap 设置",
  "settings.subtitle": "管理全局设置，让地图工作区保持清爽。",
  "settings.close": "关闭",
  "settings.status.local": "设置会保存在当前浏览器配置文件中。",
  "settings.status.interfaceSaved": "界面设置已保存。",
  "settings.section.interface": "界面",
  "settings.section.interfaceHint": "地图视图与受支持站点页面助手的默认设置",
  "settings.defaultLayout": "默认布局",
  "layout.single": "单侧式",
  "layout.radial": "环绕式",
  "layout.matrix": "矩阵式",
  "layout.twoSided": "两侧式",
  "relationship.related": "相关",
  "relationship.dependsOn": "依赖",
  "relationship.extends": "延伸",
  "relationship.supports": "支持",
  "relationship.contradicts": "反驳",
  "relationship.contrasts": "对比",
  "relationship.duplicates": "重复",
  "relationship.verifies": "验证",
  "relationship.references": "引用",
  "relationship.todo": "待办",
  "node.conversation": "对话",
  "node.note": "笔记",
  "node.turn": "轮次 {number}",
  "node.ai": "AI",
  "node.aiWorking": "AI...",
  "panel.nodesSelected": "已选择 {count} 个节点",
  "panel.organizeSelected": "将所选轮次整理为笔记或复习组。",
  "panel.nodeActions": "节点操作",
  "panel.nodeHint": "为所选节点添加标签、染色、折叠或标记重点。",
  "panel.linkTitle": "链接操作",
  "panel.headerTitle": "表头",
  "panel.headerHint": "双击表头文字即可编辑。",
  "field.type": "类型",
  "field.label": "标签",
  "action.close": "关闭",
  "action.mergeNodes": "合并节点",
  "action.collapseTopic": "折叠主题",
  "action.addTag": "添加标签",
  "action.colorNode": "染色",
  "action.collapseNode": "折叠",
  "action.expandNode": "展开",
  "action.open": "打开",
  "action.review": "复习",
  "action.done": "完成",
  "action.duplicateAsNote": "复制为笔记",
  "action.splitNode": "拆分节点",
  "action.selectAllTurns": "选择全部轮次",
  "action.important": "重要",
  "action.convertToNote": "转换为笔记",
  "action.deleteLink": "删除链接",
  "action.deleteHeader": "删除表头",
  "label.confidence": "置信度",
  "color.theme": "主题",
  "color.slate": "石板灰",
  "color.blue": "蓝色",
  "color.emerald": "翠绿色",
  "color.amber": "明黄色",
  "color.red": "红色",
  "color.violet": "紫色",
  "color.cyan": "青色",
  "color.rose": "深褐色",
  "status.nodesCollapsed": "已折叠所选节点。",
  "status.nodesExpanded": "已展开所选节点。",
  "status.nodesImportant": "已将所选节点标记为重要。",
  "status.nodesNormal": "已取消所选节点的重要标记。",
  "task.summarizeOne": "正在总结第 {current} 轮... 5%",
  "task.summarizeOneDone": "第 {current} 轮已总结。100%",
  "task.summarizeAll": "正在总结 {total} 个轮次... 0%",
  "task.summarizeProgress": "AI 任务进度: {current}/{total}",
  "task.summarizeAllDone": "批量总结完成: 已更新 {total} 个轮次。100%",
  "task.summarizeFailed": "AI 总结失败。",
  "task.autoSummarize": "正在自动总结 {total} 个默认节点... 0%",
  "task.autoSummarizeDone": "自动总结完成: 已更新 {total} 个节点。100%",
  "task.autoSummarizeFailed": "自动总结失败。",
  "task.suggestLinks": "正在请求 AI 建议语义链接... 15%",
  "task.suggestLinksDone": "已有 {count} 条 AI 链接建议可供审阅。100%",
  "task.suggestLinksFailed": "AI 链接建议失败。",
  "task.translate": "正在将 TurnMap 界面翻译为 {language}... 10%",
  "task.translateDone": "已生成 {language} 翻译。100%",
  "settings.theme": "主题",
  "settings.theme.browser": "跟随浏览器",
  "settings.theme.day": "白天",
  "settings.theme.night": "夜晚",
  "settings.theme.eyeCare": "护眼",
  "settings.language": "语言",
  "settings.language.browser": "跟随浏览器",
  "settings.language.english": "English",
  "settings.language.chinese": "中文",
  "settings.languageHint": "内置中文和英文，默认跟随浏览器语言。",
  "settings.customLanguage": "自定义语言",
  "settings.customLanguagePlaceholder": "西班牙语、日语、德语...",
  "settings.generateTranslation": "用 AI 生成",
  "settings.generatingTranslation": "生成中...",
  "settings.customTranslationHint": "AI 翻译只会发送 TurnMap 界面文案，不会发送你的对话内容。生成后的文案会保存在本地。",
  "settings.enableFloat": "默认启用浮窗导航",
  "settings.showLauncher": "在受支持 AI 页面显示 TurnMap 悬浮按钮",
  "settings.nodeColorRendering": "节点染色渲染",
  "settings.nodeColorRenderMode": "渲染方式",
  "settings.nodeColorRenderGradient": "渐变",
  "settings.nodeColorRenderSolid": "底色",
  "settings.nodeColorRenderStrength": "渲染程度",
  "settings.saveInterface": "保存界面设置",
  "settings.loadingInterface": "正在加载界面设置...",
  "settings.section.updates": "更新",
  "settings.section.updatesHint": "发布通知的预览控制",
  "settings.showUpdates": "有更新时显示提示",
  "settings.includePrerelease": "包含预发布版本",
  "settings.ignoredVersion": "忽略的版本",
  "settings.updateHint": "GitHub/解压安装无法由扩展静默更新。该功能接通后，更新提示会指向发布页或安装包。",
  "settings.saveUpdates": "保存更新设置",
  "settings.loadingUpdates": "正在加载更新设置...",
  "settings.translationSaved": "翻译已生成并保存。",
  "settings.translationNeedsName": "请先输入目标语言名称。",
  "settings.translationFailed": "AI 翻译失败。",
  "ai.title": "AI 服务",
  "ai.subtitle": "OpenAI 兼容的 Chat Completions",
  "ai.provider": "服务商",
  "ai.customCompatible": "自定义兼容接口",
  "ai.baseUrl": "Base URL",
  "ai.model": "模型",
  "ai.apiKey": "API Key",
  "ai.apiKeyPlaceholder": "保存在本地",
  "ai.privacy": "API Key 会保存在浏览器扩展存储中。只有在你运行 AI 功能或启用自动总结时，TurnMap 才会发送对话文本。",
  "ai.autoSummarize": "自动总结新的默认节点",
  "ai.status.local": "设置保存在本地。AI 功能会把选中的对话文本发送给你配置的 provider。",
  "ai.status.saved": "已保存。",
  "ai.status.aiSaved": "AI 设置已保存。",
  "ai.status.testing": "正在测试连接...",
  "ai.status.connectionSaved": "连接成功，设置已保存。",
  "ai.status.connectionSavedGlobal": "AI 连接成功，设置已保存。",
  "ai.status.failed": "连接测试失败。",
  "ai.save": "保存",
  "ai.test": "测试连接",
  "ai.testing": "测试中..."
};
export const BUILT_IN_TRANSLATIONS: Record<BuiltInLanguage, TranslationMap> = {
  en: EN_TRANSLATIONS,
  zh: ZH_TRANSLATIONS
};

type LanguageSettings = {
  mode: LanguageMode;
  customLanguages: CustomLanguage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeLanguageMode(value: unknown): LanguageMode {
  if (value === "browser" || value === "en" || value === "zh") return value;
  if (typeof value === "string" && value.startsWith("custom:")) return value as `custom:${string}`;
  return DEFAULT_LANGUAGE;
}

export function browserLanguage(): BuiltInLanguage {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

export function customLanguageId(languageName: string): string {
  const base = languageName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `custom-${Date.now()}`;
}

function normalizeCustomLanguages(value: unknown): CustomLanguage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      label: typeof item.label === "string" ? item.label : "",
      languageName: typeof item.languageName === "string" ? item.languageName : "",
      translations: isRecord(item.translations)
        ? Object.fromEntries(
            Object.entries(item.translations).filter((entry): entry is [string, string] => typeof entry[1] === "string")
          )
        : {},
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
    }))
    .filter((item) => item.id && item.label);
}

export async function loadLanguageSettings(): Promise<LanguageSettings> {
  const stored = await chrome.storage.local.get([LANGUAGE_STORAGE_KEY, CUSTOM_LANGUAGES_STORAGE_KEY]);
  return {
    mode: normalizeLanguageMode(stored[LANGUAGE_STORAGE_KEY]),
    customLanguages: normalizeCustomLanguages(stored[CUSTOM_LANGUAGES_STORAGE_KEY])
  };
}

export async function saveLanguageMode(mode: LanguageMode): Promise<void> {
  await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: mode });
}

export async function saveCustomLanguage(language: CustomLanguage): Promise<void> {
  const settings = await loadLanguageSettings();
  const next = [language, ...settings.customLanguages.filter((item) => item.id !== language.id)].slice(0, 12);
  await chrome.storage.local.set({
    [CUSTOM_LANGUAGES_STORAGE_KEY]: next,
    [LANGUAGE_STORAGE_KEY]: `custom:${language.id}` satisfies LanguageMode
  });
}

export function translationsFor(mode: LanguageMode, customLanguages: CustomLanguage[]): TranslationMap {
  if (mode === "browser") return BUILT_IN_TRANSLATIONS[browserLanguage()];
  if (mode === "en" || mode === "zh") return BUILT_IN_TRANSLATIONS[mode];

  const id = mode.slice("custom:".length);
  const custom = customLanguages.find((language) => language.id === id);
  return { ...EN_TRANSLATIONS, ...(custom?.translations ?? {}) };
}

export function formatTranslation(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

function parseTranslationJson(content: string): Record<string, string> {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = (fenced ?? content).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return a JSON object.");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!isRecord(parsed)) throw new Error("Model translation payload was not an object.");

  return Object.fromEntries(
    Object.keys(EN_TRANSLATIONS).map((key) => {
      const translated = parsed[key];
      return [key, typeof translated === "string" && translated.trim() ? translated.trim() : EN_TRANSLATIONS[key as I18nKey]];
    })
  );
}

export async function generateCustomLanguage(languageName: string): Promise<CustomLanguage> {
  const trimmedLanguageName = languageName.trim();
  if (!trimmedLanguageName) throw new Error("Target language is required.");
  const settings = await loadAiSettings();
  const content = await requestChatCompletion(
    settings,
    [
      {
        role: "system",
        content:
          "You translate browser extension UI labels. Return only one JSON object. Keep placeholders such as {count}, {steps}, and {source} unchanged. Keep product names like TurnMap and ChatGPT unchanged. Prefer concise labels that fit buttons and menus."
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLanguage: trimmedLanguageName,
          sourceLanguage: "English",
          labels: EN_TRANSLATIONS
        })
      }
    ],
    { temperature: 0.1, maxTokens: 5000, jsonMode: true }
  );

  const translations = parseTranslationJson(content);
  const id = customLanguageId(trimmedLanguageName);
  return {
    id,
    label: trimmedLanguageName,
    languageName: trimmedLanguageName,
    translations,
    createdAt: new Date().toISOString()
  };
}
