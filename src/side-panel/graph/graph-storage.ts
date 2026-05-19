import type { Edge, Node, XYPosition } from "@xyflow/react";
import { isNodeColorName, type NodeColorName } from "./graph-colors";

export type LayoutMode = "single" | "radial" | "list" | "two-sided";
type NodeStatus = "open" | "review" | "done";
type StoredNodeOverride = {
  title?: string;
  summary?: string;
  status?: NodeStatus;
  tags?: string[];
  color?: NodeColorName;
  collapsed?: boolean;
  important?: boolean;
};

type StoredGraph = {
  schemaVersion: number;
  positions: Record<string, XYPosition>;
  userEdges: Edge[];
  nodeOverrides: Record<string, StoredNodeOverride>;
  customNodes?: Array<{
    id: string;
    position: XYPosition;
    title: string;
    summary: string;
    status?: NodeStatus;
    tags?: string[];
    color?: NodeColorName;
    collapsed?: boolean;
    important?: boolean;
  }>;
  hiddenNodeIds?: string[];
  layoutMode?: LayoutMode;
  hiddenRoot?: boolean;
  hiddenAutoEdgeIds?: string[];
};

const STORAGE_PREFIX = "turnmap.graph.";
const DEFAULT_LAYOUT_KEY = "turnmap.defaultLayout";
const CURRENT_SCHEMA_VERSION = 2;

function isDefaultRootSummary(summary: unknown): boolean {
  return typeof summary === "string" && /^\d+\s+mapped turns$/i.test(summary.trim());
}

function isGenericConversationRootTitle(title: unknown): boolean {
  if (typeof title !== "string") return true;
  const normalized = title.trim();
  if (!normalized) return true;
  return [
    /^TurnMap$/i,
    /^Current AI conversation$/i,
    /^Current conversation$/i,
    /^Agents$/i,
    /^Intelligence$/i,
    /^Projects$/i,
    /^Chats$/i,
    /^Upgrade(?: to Pro)?$/i,
    /^Qwen$/i,
    /^Qwen Studio$/i,
    /^Qwen(?:\d+(?:\.\d+)*)?[-\s]*(?:Plus|Max|Turbo|Coder|VL|Omni|Instruct)$/i,
    /^通义$/i,
    /^通义千问$/i,
    /^鍗冮棶$/i,
    /^Claude$/i,
    /^智谱清言$/i,
    /^ChatGLM$/i,
    /^Z\.ai$/i,
    /^GLM$/i,
    /^Le Chat$/i,
    /^Mistral$/i,
    /^Mistral Le Chat$/i,
    /^Arena$/i,
    /^LMArena$/i,
    /^Chatbot Arena$/i,
    /^Arena AI: The Official AI Ranking & LLM Leaderboard$/i,
    /批量操作|重命名|删除对话/,
    /Official AI Ranking/i,
    /LLM Leaderboard/i
  ].some((pattern) => pattern.test(normalized));
}

function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

function nodeStatus(value: unknown): NodeStatus | undefined {
  return value === "open" || value === "review" || value === "done" ? value : undefined;
}

export async function loadStoredGraph(conversationId: string): Promise<StoredGraph> {
  const result = await chrome.storage.local.get(storageKey(conversationId));
  const value = result[storageKey(conversationId)] as StoredGraph | undefined;

  return {
    schemaVersion: value?.schemaVersion ?? 0,
    positions: value?.positions ?? {},
    userEdges: value?.userEdges ?? [],
    nodeOverrides: value?.nodeOverrides ?? {},
    customNodes: value?.customNodes ?? [],
    hiddenNodeIds: value?.hiddenNodeIds ?? [],
    layoutMode: value?.layoutMode,
    hiddenRoot: value?.hiddenRoot ?? false,
    hiddenAutoEdgeIds: value?.hiddenAutoEdgeIds ?? []
  };
}

export async function saveStoredGraph(
  conversationId: string,
  nodes: Node[],
  userEdges: Edge[],
  layoutMode?: LayoutMode,
  hiddenRoot = false,
  hiddenAutoEdgeIds: string[] = [],
  hiddenNodeIds: string[] = []
): Promise<void> {
  const positions = Object.fromEntries(nodes.map((node) => [node.id, node.position]));
  const nodeOverrides = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        title:
          node.id === "conversation-root" && isGenericConversationRootTitle(node.data?.title)
            ? undefined
            : typeof node.data?.title === "string"
              ? node.data.title
              : undefined,
        summary:
          node.id === "conversation-root" && isDefaultRootSummary(node.data?.summary)
            ? undefined
            : typeof node.data?.summary === "string"
              ? node.data.summary
              : undefined,
        status: nodeStatus(node.data?.status),
        tags: Array.isArray(node.data?.tags) ? node.data.tags.filter((tag) => typeof tag === "string") : undefined,
        color: isNodeColorName(node.data?.color) ? node.data.color : undefined,
        collapsed: typeof node.data?.collapsed === "boolean" ? node.data.collapsed : undefined,
        important: typeof node.data?.important === "boolean" ? node.data.important : undefined
      }
    ])
  );
  const customNodes = nodes
    .filter((node) => node.id !== "conversation-root" && !node.data?.turn)
    .map((node) => ({
      id: node.id,
      position: node.position,
      title: typeof node.data?.title === "string" ? node.data.title : node.id,
      summary: typeof node.data?.summary === "string" ? node.data.summary : "",
      status: nodeStatus(node.data?.status),
      tags: Array.isArray(node.data?.tags) ? node.data.tags.filter((tag) => typeof tag === "string") : undefined,
      color: isNodeColorName(node.data?.color) ? node.data.color : undefined,
      collapsed: typeof node.data?.collapsed === "boolean" ? node.data.collapsed : undefined,
      important: typeof node.data?.important === "boolean" ? node.data.important : undefined
    }));

  await chrome.storage.local.set({
    [storageKey(conversationId)]: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      positions,
      userEdges,
      nodeOverrides,
      customNodes,
      hiddenNodeIds,
      layoutMode,
      hiddenRoot,
      hiddenAutoEdgeIds
    } satisfies StoredGraph
  });
}

export async function resetStoredGraph(conversationId: string): Promise<void> {
  await chrome.storage.local.remove(storageKey(conversationId));
}

export async function loadDefaultLayout(): Promise<LayoutMode> {
  const result = await chrome.storage.local.get(DEFAULT_LAYOUT_KEY);
  const value = result[DEFAULT_LAYOUT_KEY];
  return value === "radial" || value === "list" || value === "two-sided" || value === "single"
    ? value
    : "single";
}

export async function saveDefaultLayout(layoutMode: LayoutMode): Promise<void> {
  await chrome.storage.local.set({ [DEFAULT_LAYOUT_KEY]: layoutMode });
}
