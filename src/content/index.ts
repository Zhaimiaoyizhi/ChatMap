import type { ExtractedTurnsMessage, JumpToTurnMessage, Turn } from "../shared/types";
import { selectConversationAdapter, type ConversationAdapter } from "./conversation-adapters";
import { getTurnMapLauncherIconUrl, loadTurnMapLauncherIconSrc } from "./launcher-icon";

declare global {
  interface Window {
    __chatMapContentStarted?: boolean;
    __chatMapContentMessageListenerStarted?: boolean;
    __chatMapContentStorageListenerStarted?: boolean;
  }
}

function isContentMessage(message: unknown): message is JumpToTurnMessage | { type: string } {
  return Boolean(
    message &&
      typeof message === "object" &&
      "type" in message &&
      typeof (message as { type: unknown }).type === "string" &&
      (message as { type: string }).type.startsWith("TURNMAP_")
  );
}

function broadcastTurns(message: ExtractedTurnsMessage): void {
  floatingTurns = message.turns;
  renderFloatingPanel();
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may be closed. The next explicit request will fetch current turns.
  });
}

const activeAdapter = selectConversationAdapter();

function getCurrentAdapter(): ConversationAdapter | null {
  return activeAdapter;
}

function toUnsupportedTurnsMessage(): ExtractedTurnsMessage {
  return {
    type: "TURNMAP_TURNS_UPDATED",
    turns: [],
    conversationTitle: document.title || "Current AI conversation",
    conversationId: window.location.href,
    site: {
      id: "unsupported",
      displayName: "Unsupported site"
    }
  };
}

let floatingPanel: HTMLElement | null = null;
let launcherButton: HTMLButtonElement | null = null;
let floatingCollapsed = false;
let floatingTurns: Turn[] = [];
let floatingDragCleanup: (() => void) | null = null;
let launcherMovedDuringPointer = false;

type FloatingPosition = {
  left: number;
  top: number;
};

function floatingPanelEnabledKey(): string {
  return "turnmap.floatingPanel.enabled";
}

function floatingPanelPositionKey(): string {
  return "turnmap.floatingPanel.position";
}

function launcherEnabledKey(): string {
  return "turnmap.launcher.enabled";
}

function launcherPositionKey(): string {
  return "turnmap.launcher.position";
}

function removeFloatingPanel(): void {
  floatingDragCleanup?.();
  floatingDragCleanup = null;
  floatingPanel?.remove();
  floatingPanel = null;
}

function removeLauncher(): void {
  launcherButton?.remove();
  launcherButton = null;
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

function renderFloatingPanel(): void {
  if (!floatingPanel) return;
  floatingDragCleanup?.();
  floatingDragCleanup = null;
  floatingPanel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "turnmap-floating-header";
  const title = document.createElement("strong");
  title.textContent = "TurnMap";
  const actions = document.createElement("div");
  const collapse = document.createElement("button");
  collapse.type = "button";
  collapse.textContent = floatingCollapsed ? "Open" : "Hide";
  collapse.addEventListener("click", () => {
    floatingCollapsed = !floatingCollapsed;
    renderFloatingPanel();
  });
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Off";
  close.addEventListener("click", () => {
    void chrome.storage.local.set({ [floatingPanelEnabledKey()]: false });
    removeFloatingPanel();
  });
  actions.append(collapse, close);
  header.append(title, actions);
  floatingPanel.append(header);
  floatingDragCleanup = attachFloatingDrag(header);

  if (floatingCollapsed) return;

  const list = document.createElement("div");
  list.className = "turnmap-floating-list";
  list.addEventListener("wheel", containFloatingWheel, { passive: false });
  floatingTurns.forEach((turn) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<span>Turn ${turn.turnIndex + 1}</span><strong></strong>`;
    button.querySelector("strong")!.textContent = previewText(turn.userText);
    button.addEventListener("click", () => {
      void getCurrentAdapter()?.jumpToTurn(turn.sourceAnchor);
    });
    list.append(button);
  });

  if (floatingTurns.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No mapped turns yet.";
    list.append(empty);
  }

  floatingPanel.append(list);
}

function clampFloatingPosition(position: FloatingPosition): FloatingPosition {
  const panelRect = floatingPanel?.getBoundingClientRect();
  const width = panelRect?.width ?? 320;
  const height = panelRect?.height ?? 360;
  const margin = 8;

  return {
    left: Math.max(margin, Math.min(position.left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(position.top, window.innerHeight - height - margin))
  };
}

function applyFloatingPosition(position: FloatingPosition): void {
  if (!floatingPanel) return;
  const next = clampFloatingPosition(position);
  floatingPanel.style.left = `${next.left}px`;
  floatingPanel.style.top = `${next.top}px`;
  floatingPanel.style.right = "auto";
  floatingPanel.style.bottom = "auto";
}

function saveFloatingPosition(position: FloatingPosition): void {
  const next = clampFloatingPosition(position);
  void chrome.storage.local.set({ [floatingPanelPositionKey()]: next });
}

function loadFloatingPosition(): void {
  void chrome.storage.local.get(floatingPanelPositionKey()).then((result) => {
    const value = result[floatingPanelPositionKey()];
    if (
      value &&
      typeof value === "object" &&
      typeof (value as FloatingPosition).left === "number" &&
      typeof (value as FloatingPosition).top === "number"
    ) {
      applyFloatingPosition(value as FloatingPosition);
    }
  });
}

function attachFloatingDrag(handle: HTMLElement): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId || !floatingPanel) return;
    event.preventDefault();
    applyFloatingPosition({
      left: startLeft + event.clientX - startX,
      top: startTop + event.clientY - startY
    });
  };

  const onPointerUp = (event: PointerEvent) => {
    if (pointerId !== event.pointerId || !floatingPanel) return;
    pointerId = null;
    handle.releasePointerCapture(event.pointerId);
    const rect = floatingPanel.getBoundingClientRect();
    saveFloatingPosition({ left: rect.left, top: rect.top });
  };

  const onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    if (!floatingPanel) return;
    const rect = floatingPanel.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerUp);

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    handle.removeEventListener("pointercancel", onPointerUp);
  };
}

function containFloatingWheel(event: WheelEvent): void {
  event.preventDefault();
  event.stopPropagation();

  const list = event.currentTarget as HTMLElement;
  list.scrollTop += event.deltaY;
  list.scrollLeft += event.deltaX;
}

function ensureFloatingPanel(): void {
  if (floatingPanel) {
    renderFloatingPanel();
    return;
  }

  const style = document.createElement("style");
  style.id = "turnmap-floating-style";
  style.textContent = `
    .turnmap-floating-panel {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #d7e3ec;
      border-radius: 8px;
      bottom: 92px;
      box-shadow: 0 18px 42px rgba(20, 68, 105, 0.14);
      color: #102033;
      display: grid;
      font: 12px Inter, ui-sans-serif, system-ui, sans-serif;
      gap: 8px;
      grid-template-rows: auto minmax(0, 1fr);
      max-height: min(390px, calc(100vh - 80px));
      min-height: 0;
      overflow: hidden;
      padding: 10px;
      position: fixed;
      right: 18px;
      width: min(320px, calc(100vw - 36px));
      z-index: 2147483600;
    }
    .turnmap-floating-header {
      align-items: center;
      cursor: grab;
      display: flex;
      justify-content: space-between;
      user-select: none;
    }
    .turnmap-floating-header:active {
      cursor: grabbing;
    }
    .turnmap-floating-header div {
      display: flex;
      gap: 6px;
    }
    .turnmap-floating-panel button {
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border: 1px solid #a9c3d4;
      border-radius: 6px;
      color: #102033;
      cursor: pointer;
      font: inherit;
      padding: 5px 8px;
    }
    .turnmap-floating-list {
      display: grid;
      gap: 6px;
      max-height: 286px;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: hidden;
      padding-right: 2px;
      scrollbar-gutter: stable;
      overscroll-behavior: contain;
    }
    .turnmap-floating-panel:hover .turnmap-floating-list,
    .turnmap-floating-list:focus-within {
      overflow-y: auto;
    }
    .turnmap-floating-list button {
      box-sizing: border-box;
      display: grid;
      gap: 3px;
      justify-items: start;
      min-height: 67px;
      min-width: 0;
      text-align: left;
      width: 100%;
    }
    .turnmap-floating-list span {
      color: #708397;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .turnmap-floating-list strong {
      color: #102033;
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .turnmap-floating-list p {
      color: #5c6f82;
      margin: 0;
    }
  `;
  if (!document.getElementById(style.id)) document.documentElement.append(style);

  floatingPanel = document.createElement("aside");
  floatingPanel.className = "turnmap-floating-panel";
  document.body.append(floatingPanel);
  renderFloatingPanel();
  loadFloatingPosition();
}

function setFloatingPanel(enabled: boolean, persist = true): void {
  if (persist) {
    void chrome.storage.local.set({ [floatingPanelEnabledKey()]: enabled });
  }
  if (enabled) {
    floatingTurns = getCurrentAdapter()?.getLatestTurns() ?? [];
    ensureFloatingPanel();
  } else {
    removeFloatingPanel();
  }
}

function openSidePanelFromLauncher(): void {
  void chrome.runtime.sendMessage({ type: "TURNMAP_OPEN_SIDE_PANEL" }).catch(() => {
    launcherButton?.setAttribute("title", "TurnMap could not open the side panel.");
  });
}

function openSettingsFromLauncher(): void {
  void chrome.runtime.sendMessage({ type: "TURNMAP_OPEN_SETTINGS" }).catch(() => {
    launcherButton?.setAttribute("title", "TurnMap settings could not be opened.");
  });
}

function ensureLauncherStyle(): void {
  if (document.getElementById("turnmap-launcher-style")) return;

  const style = document.createElement("style");
  style.id = "turnmap-launcher-style";
  style.textContent = `
    .turnmap-launcher {
      all: initial;
      align-items: center;
      appearance: none;
      background: transparent;
      border: 0;
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(10, 40, 68, 0.28);
      box-sizing: border-box;
      color: #ffffff;
      cursor: pointer;
      display: grid;
      font: 700 12px Inter, ui-sans-serif, system-ui, sans-serif;
      height: 44px;
      justify-items: center;
      line-height: 1;
      overflow: hidden;
      padding: 0;
      position: fixed;
      right: 18px;
      top: 38vh;
      user-select: none;
      width: 44px;
      z-index: 2147483599;
    }
    .turnmap-launcher img {
      display: block;
      height: 44px;
      object-fit: contain;
      pointer-events: none;
      width: 44px;
    }
    .turnmap-launcher:hover {
      box-shadow: 0 14px 34px rgba(20, 120, 200, 0.32);
      transform: translateY(-1px);
    }
    .turnmap-launcher:focus-visible {
      outline: 3px solid rgba(16, 163, 127, 0.32);
      outline-offset: 3px;
    }
  `;
  document.documentElement.append(style);
}

function clampLauncherPosition(position: FloatingPosition): FloatingPosition {
  const size = 44;
  const margin = 8;
  return {
    left: Math.max(margin, Math.min(position.left, window.innerWidth - size - margin)),
    top: Math.max(margin, Math.min(position.top, window.innerHeight - size - margin))
  };
}

function applyLauncherPosition(position: FloatingPosition): void {
  if (!launcherButton) return;
  const next = clampLauncherPosition(position);
  launcherButton.style.left = `${next.left}px`;
  launcherButton.style.top = `${next.top}px`;
  launcherButton.style.right = "auto";
}

function saveLauncherPosition(position: FloatingPosition): void {
  void chrome.storage.local.set({ [launcherPositionKey()]: clampLauncherPosition(position) });
}

function loadLauncherPosition(): void {
  void chrome.storage.local.get(launcherPositionKey()).then((result) => {
    const value = result[launcherPositionKey()];
    if (
      value &&
      typeof value === "object" &&
      typeof (value as FloatingPosition).left === "number" &&
      typeof (value as FloatingPosition).top === "number"
    ) {
      applyLauncherPosition(value as FloatingPosition);
    }
  });
}

function attachLauncherDrag(button: HTMLButtonElement): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    launcherMovedDuringPointer = false;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      launcherMovedDuringPointer = true;
    }
    if (!launcherMovedDuringPointer) return;
    event.preventDefault();
    applyLauncherPosition({
      left: startLeft + dx,
      top: startTop + dy
    });
  });

  const finish = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    button.releasePointerCapture(event.pointerId);
    const rect = button.getBoundingClientRect();
    saveLauncherPosition({ left: rect.left, top: rect.top });
  };

  button.addEventListener("pointerup", finish);
  button.addEventListener("pointercancel", finish);
}

function ensureLauncher(): void {
  if (launcherButton) return;
  ensureLauncherStyle();

  launcherButton = document.createElement("button");
  launcherButton.type = "button";
  launcherButton.className = "turnmap-launcher";
  launcherButton.textContent = "";
  launcherButton.title = "TurnMap: left-click opens map, right-click opens settings";
  launcherButton.setAttribute("aria-label", "Open TurnMap");
  const icon = document.createElement("img");
  icon.src = getTurnMapLauncherIconUrl();
  icon.alt = "";
  launcherButton.append(icon);
  void loadTurnMapLauncherIconSrc().then((src) => {
    if (icon.isConnected) icon.src = src;
  });
  launcherButton.addEventListener("click", (event) => {
    if (launcherMovedDuringPointer) {
      event.preventDefault();
      launcherMovedDuringPointer = false;
      return;
    }
    openSidePanelFromLauncher();
  });
  launcherButton.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openSettingsFromLauncher();
  });
  attachLauncherDrag(launcherButton);
  document.body.append(launcherButton);
  loadLauncherPosition();
}

function syncLauncherFromStorage(): void {
  void chrome.storage.local.get(launcherEnabledKey()).then((result) => {
    if (result[launcherEnabledKey()] === false) {
      removeLauncher();
    } else {
      ensureLauncher();
    }
  });
}

function startTurnMapContentUi(): void {
  syncLauncherFromStorage();

  void chrome.storage.local.get(floatingPanelEnabledKey()).then((result) => {
    if (result[floatingPanelEnabledKey()]) {
      floatingTurns = activeAdapter?.getLatestTurns() ?? [];
      ensureFloatingPanel();
    }
  });
}

function startTurnMapContentObservers(): void {
  activeAdapter?.startObserver((turns) => broadcastTurns(activeAdapter.toTurnsMessage(turns)));
}

function startTurnMapContentStorageListener(): void {
  if (window.__chatMapContentStorageListenerStarted) return;
  window.__chatMapContentStorageListenerStarted = true;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (launcherEnabledKey() in changes) {
      syncLauncherFromStorage();
    }
    if (floatingPanelEnabledKey() in changes) {
      setFloatingPanel(Boolean(changes[floatingPanelEnabledKey()].newValue), false);
    }
  });
}

function startTurnMapContentMessageListener(): void {
  if (window.__chatMapContentMessageListenerStarted) return;
  window.__chatMapContentMessageListenerStarted = true;
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isContentMessage(message)) return false;

    if (message.type === "TURNMAP_REQUEST_TURNS") {
      const adapter = getCurrentAdapter();
      if (!adapter) {
        sendResponse(toUnsupportedTurnsMessage());
        return true;
      }

      if ("harvest" in message && message.harvest) {
        adapter
          .harvestTurnsByScrolling()
          .then((turns) => sendResponse(adapter.toTurnsMessage(turns)))
          .catch(() => sendResponse(adapter.toTurnsMessage(adapter.getLatestTurns())));
        return true;
      }

      if ("ensureFull" in message && message.ensureFull) {
        adapter
          .refreshCompleteTurns()
          .then((turns) => sendResponse(adapter.toTurnsMessage(turns)))
          .catch(() => sendResponse(adapter.toTurnsMessage(adapter.getLatestTurns())));
        return true;
      }

      adapter
        .refreshLatestTurns()
        .then((turns) => sendResponse(adapter.toTurnsMessage(turns)))
        .catch(() => sendResponse(adapter.toTurnsMessage(adapter.getLatestTurns())));
      return true;
    }

    if (message.type === "TURNMAP_JUMP_TO_TURN") {
      const adapter = getCurrentAdapter();
      if (!adapter) {
        sendResponse({ ok: false, reason: "This AI conversation site is not supported yet." });
        return true;
      }

      adapter
        .jumpToTurn((message as JumpToTurnMessage).anchor)
        .then(sendResponse)
        .catch(() =>
          sendResponse({ ok: false, reason: "The original conversation turn could not be found." })
        );
      return true;
    }

    if (message.type === "TURNMAP_SET_FLOATING_PANEL") {
      setFloatingPanel(Boolean((message as { enabled?: unknown }).enabled));
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}

const launcherNeedsRepair = !document.querySelector(".turnmap-launcher") || !document.getElementById("turnmap-launcher-style");

if (!window.__chatMapContentStarted || launcherNeedsRepair) {
  window.__chatMapContentStarted = true;
  startTurnMapContentUi();
}

startTurnMapContentObservers();
startTurnMapContentStorageListener();
startTurnMapContentMessageListener();
