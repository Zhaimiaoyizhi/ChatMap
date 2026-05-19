import type {
  TurnMapMessage,
  ExtractedTurnsMessage,
  JumpToTurnMessage,
  JumpToTurnResult
} from "./types";

export function isTurnMapMessage(value: unknown): value is TurnMapMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof (value as { type: unknown }).type === "string" &&
      (value as { type: string }).type.startsWith("TURNMAP_")
  );
}

export async function requestTurnsFromActiveTab(options?: {
  harvest?: boolean;
  ensureFull?: boolean;
  tabId?: number;
}): Promise<ExtractedTurnsMessage | null> {
  const tab = await getTargetTab(options?.tabId);
  const tabId = tab?.id;
  if (!tabId) return null;

  const firstResponse = await requestTurns(tabId, options?.harvest ?? false, options?.ensureFull ?? false);
  if (firstResponse) return firstResponse;

  const injected = await injectContentScript(tabId, tab?.url);
  if (!injected) return null;

  await delay(150);
  return requestTurns(tabId, options?.harvest ?? false, options?.ensureFull ?? false);
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.id;
}

async function getTargetTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
  if (tabId) {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return { id: tabId } as chrome.tabs.Tab;
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function requestTurns(
  tabId: number,
  harvest: boolean,
  ensureFull: boolean
): Promise<ExtractedTurnsMessage | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "TURNMAP_REQUEST_TURNS",
      harvest,
      ensureFull
    });
    return response?.type === "TURNMAP_TURNS_UPDATED" ? response : null;
  } catch {
    return null;
  }
}

async function injectContentScript(tabId: number, tabUrl?: string): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/index.js"]
    });
    return true;
  } catch {
    const granted = await requestHostAccess(tabUrl);
    if (!granted) return false;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/index.js"]
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function requestHostAccess(tabUrl?: string): Promise<boolean> {
  if (!tabUrl || !chrome.permissions?.request) return false;

  let origin: string;
  try {
    const url = new URL(tabUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    origin = `${url.origin}/*`;
  } catch {
    return false;
  }

  try {
    const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
    if (alreadyGranted) return true;
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function jumpToTurnInActiveTab(
  message: JumpToTurnMessage,
  tabId?: number
): Promise<JumpToTurnResult> {
  const targetTabId = tabId ?? (await getActiveTabId());
  if (!targetTabId) return { ok: false, reason: "No active supported AI conversation tab was found." };

  try {
    await chrome.tabs.update(targetTabId, { active: true });
    return await chrome.tabs.sendMessage(targetTabId, message);
  } catch {
    return {
      ok: false,
      reason: "TurnMap could not communicate with the conversation page."
    };
  }
}

export async function setFloatingPanelInTab(enabled: boolean, tabId?: number): Promise<boolean> {
  const targetTab = await getTargetTab(tabId);
  const targetTabId = targetTab?.id;
  if (!targetTabId) return false;

  const send = async () => {
    await chrome.tabs.sendMessage(targetTabId, {
      type: "TURNMAP_SET_FLOATING_PANEL",
      enabled
    });
  };

  try {
    await send();
    return true;
  } catch {
    const injected = await injectContentScript(targetTabId, targetTab?.url);
    if (!injected) return false;
    await delay(150);
    try {
      await send();
      return true;
    } catch {
      return false;
    }
  }
}
