import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type ReactFlowInstance
} from "@xyflow/react";
import type { Turn } from "../../shared/types";
import { jumpToTurnInActiveTab } from "../../shared/messaging";
import { suggestSemanticEdges } from "../ai/link-suggestions";
import { summarizeTurn } from "../ai/node-summary";
import { Icon } from "../components/Icon";
import type { I18nKey } from "../i18n/i18n-storage";
import { useI18n } from "../i18n/useI18n";
import { loadAiSettings } from "../settings/ai-settings-storage";
import type { ApiTaskKind, ApiTaskStatus } from "../task-log";
import { TurnNode } from "./TurnNode";
import {
  loadDefaultLayout,
  loadStoredGraph,
  resetStoredGraph,
  saveDefaultLayout,
  saveStoredGraph,
  type LayoutMode
} from "./graph-storage";
import {
  createZipFromTextFiles,
  graphToObsidianVaultMarkdownFiles,
  graphToOpml,
  type ExportEdge,
  type ExportNode
} from "./export-formats";
import {
  NODE_COLOR_OPTIONS,
  colorForRelationship,
  colorValue,
  isNodeColorName,
  type NodeColorName
} from "./graph-colors";
import { buildCollapsedTopic } from "./topic-collapse";

type TurnMapCanvasProps = {
  conversationId: string;
  conversationTitle: string;
  turns: Turn[];
  sourceTabId?: number;
  onStatus?: (status: string) => void;
  onTaskStatus?: (entry: {
    id: string;
    kind: ApiTaskKind;
    status: ApiTaskStatus;
    message: string;
    progress: number;
  }) => void | Promise<void>;
};

type TurnNodeData = {
  title: string;
  summary: string;
  turn?: Turn;
  isConversationRoot?: boolean;
  isCustomNode?: boolean;
  status?: "open" | "review" | "done";
  tags?: string[];
  color?: NodeColorName;
  collapsed?: boolean;
  important?: boolean;
  onUpdate?: (nodeId: string, updates: { title?: string; summary?: string }) => void;
  onSummarize?: (nodeId: string) => void;
  onJump?: (nodeId: string) => void;
  isSummarizing?: boolean;
};

type CustomNodeRecord = {
  id: string;
  position: { x: number; y: number };
  title: string;
  summary: string;
  status?: "open" | "review" | "done";
  tags?: string[];
  color?: NodeColorName;
  collapsed?: boolean;
  important?: boolean;
};

type GraphSnapshot = {
  nodes: Node<TurnNodeData>[];
  edges: Edge[];
  hiddenRoot: boolean;
  hiddenAutoEdgeIds: string[];
  hiddenNodeIds: string[];
};

type EdgeRelationship =
  | "related"
  | "depends_on"
  | "extends"
  | "supports"
  | "contradicts"
  | "duplicates"
  | "references"
  | "todo";

type RelationshipEdgeData = {
  relationship: EdgeRelationship;
  important?: boolean;
  confidence?: number;
  reason?: string;
  createdBy?: "ai" | "user";
};

type ExportedGraph = {
  schemaVersion?: number;
  conversation?: {
    id?: string;
    title?: string;
  };
  layout?: {
    mode?: LayoutMode;
    hiddenRoot?: boolean;
    hiddenAutoEdgeIds?: string[];
    hiddenNodeIds?: string[];
  };
  nodes?: Array<{
    id?: string;
    position?: { x?: number; y?: number };
    title?: string;
    summary?: string;
    status?: "open" | "review" | "done";
    tags?: string[];
    color?: NodeColorName;
    collapsed?: boolean;
    important?: boolean;
    turnId?: string;
    isConversationRoot?: boolean;
  }>;
  edges?: Array<{
    id?: string;
    source?: string;
    target?: string;
    label?: unknown;
    relationship?: EdgeRelationship;
    important?: boolean;
    confidence?: number;
    reason?: string;
    createdBy?: "ai" | "user";
    isAuto?: boolean;
  }>;
};

const nodeTypes = {
  turnNode: TurnNode
};

const RELATIONSHIP_OPTIONS: Array<{ value: EdgeRelationship; label: string }> = [
  { value: "related", label: "Related" },
  { value: "depends_on", label: "Depends on" },
  { value: "extends", label: "Extends" },
  { value: "supports", label: "Supports" },
  { value: "contradicts", label: "Contradicts" },
  { value: "duplicates", label: "Duplicates" },
  { value: "references", label: "References" },
  { value: "todo", label: "Todo" }
];

const LAYOUT_OPTIONS: Array<{ value: LayoutMode; label: string }> = [
  { value: "single", label: "Single-side" },
  { value: "radial", label: "Radial" },
  { value: "list", label: "Matrix" },
  { value: "two-sided", label: "Two-sided" }
];

const LAYOUT_LABEL_KEYS = {
  single: "layout.single",
  radial: "layout.radial",
  list: "layout.matrix",
  "two-sided": "layout.twoSided"
} satisfies Record<LayoutMode, I18nKey>;

const RELATIONSHIP_LABEL_KEYS = {
  related: "relationship.related",
  depends_on: "relationship.dependsOn",
  extends: "relationship.extends",
  supports: "relationship.supports",
  contradicts: "relationship.contradicts",
  duplicates: "relationship.duplicates",
  references: "relationship.references",
  todo: "relationship.todo"
} satisfies Record<EdgeRelationship, I18nKey>;

function titleFromTurn(turn: Turn): string {
  const trimmed = turn.userText.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}...` : trimmed;
}

function summaryFromTurn(turn: Turn): string {
  const trimmed = turn.assistantText.trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}...` : trimmed;
}

function isDefaultRootSummary(summary?: string): boolean {
  return Boolean(summary?.trim().match(/^\d+\s+mapped turns$/i));
}

function isGenericConversationRootTitle(title?: string): boolean {
  const normalized = title?.trim();
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
    /^千问$/i,
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

function rootTitleFromOverride(overrideTitle: string | undefined, conversationTitle: string): string {
  return overrideTitle && !isGenericConversationRootTitle(overrideTitle) ? overrideTitle : conversationTitle;
}

function nodeHasDefaultText(node: Node<TurnNodeData>): boolean {
  if (!node.data.turn) return false;
  return node.data.title === titleFromTurn(node.data.turn) && node.data.summary === summaryFromTurn(node.data.turn);
}

type TopicPosition = {
  topicIndex: number;
  depth: number;
  isTopicHead: boolean;
};

function textTokens(value: string): Set<string> {
  const normalized = value.toLowerCase();
  const tokens = new Set<string>();
  for (const word of normalized.match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []) {
    tokens.add(word);
  }
  for (const segment of normalized.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (segment.length === 1) {
      tokens.add(segment);
      continue;
    }
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.add(segment.slice(index, index + 2));
    }
  }
  return tokens;
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });
  return overlap / Math.min(left.size, right.size);
}

function explicitTopicShift(text: string): boolean {
  return /另(一|个|起)|新话题|换个话题|另说|接下来.*(话题|部分|板块)|another topic|new topic|separate topic/i.test(
    text
  );
}

function topicPositionsFromTurns(turns: Turn[]): Record<string, TopicPosition> {
  const positions: Record<string, TopicPosition> = {};
  let topicIndex = -1;
  let depth = 0;
  let previousTokens = new Set<string>();

  turns.forEach((turn, index) => {
    const currentTokens = textTokens(`${turn.userText}\n${turn.assistantText.slice(0, 360)}`);
    const similarity = tokenSimilarity(previousTokens, currentTokens);
    const startsNewTopic =
      index === 0 ||
      explicitTopicShift(turn.userText) ||
      (currentTokens.size >= 4 && previousTokens.size >= 4 && similarity < 0.08);

    if (startsNewTopic) {
      topicIndex += 1;
      depth = 0;
    } else {
      depth += 1;
    }

    positions[turn.id] = {
      topicIndex,
      depth,
      isTopicHead: startsNewTopic
    };
    previousTokens = currentTokens;
  });

  return positions;
}

function nodesFromTurns(
  conversationTitle: string,
  turns: Turn[],
  positions: Record<string, { x: number; y: number }>,
  nodeOverrides: Record<
    string,
    {
      title?: string;
      summary?: string;
      status?: "open" | "review" | "done";
      tags?: string[];
      color?: NodeColorName;
      collapsed?: boolean;
      important?: boolean;
    }
  >,
  onUpdate: TurnNodeData["onUpdate"],
  onSummarize: TurnNodeData["onSummarize"],
  onJump: TurnNodeData["onJump"],
  summarizingNodeIds: Set<string>,
  hiddenNodeIds: string[],
  customNodes: CustomNodeRecord[],
  layoutMode: LayoutMode,
  hiddenRoot: boolean
): Node<TurnNodeData>[] {
  const layoutPositions = createLayoutPositions(turns, layoutMode);
  const rootOverride = nodeOverrides["conversation-root"];
  const rootTitle = rootTitleFromOverride(rootOverride?.title, conversationTitle);
  const rootNode: Node<TurnNodeData> = {
    id: "conversation-root",
    type: "turnNode",
    dragHandle: ".turn-node__drag-handle",
    position: positions["conversation-root"] ?? layoutPositions["conversation-root"],
    data: {
      title: rootTitle,
      summary:
        rootOverride?.summary && !isDefaultRootSummary(rootOverride.summary)
          ? rootOverride.summary
          : `${turns.length} mapped turns`,
      status: rootOverride?.status,
      tags: rootOverride?.tags,
      color: rootOverride?.color,
      collapsed: rootOverride?.collapsed,
      important: rootOverride?.important,
      isConversationRoot: true,
      onUpdate
    }
  };

  const hiddenNodeIdSet = new Set(hiddenNodeIds);
  const turnNodes = turns.filter((turn) => !hiddenNodeIdSet.has(turn.id)).map((turn, index) => ({
    id: turn.id,
    type: "turnNode",
    dragHandle: ".turn-node__drag-handle",
    position: positions[turn.id] ?? layoutPositions[turn.id] ?? { x: 360, y: index * 190 },
    data: {
      title: nodeOverrides[turn.id]?.title ?? titleFromTurn(turn),
      summary: nodeOverrides[turn.id]?.summary ?? summaryFromTurn(turn),
      status: nodeOverrides[turn.id]?.status,
      tags: nodeOverrides[turn.id]?.tags,
      color: nodeOverrides[turn.id]?.color,
      collapsed: nodeOverrides[turn.id]?.collapsed,
      important: nodeOverrides[turn.id]?.important,
      turn,
      onUpdate,
      onSummarize,
      onJump,
      isSummarizing: summarizingNodeIds.has(turn.id)
    }
  }));
  const extraNodes: Node<TurnNodeData>[] = customNodes.map((node) => ({
    id: node.id,
    type: "turnNode",
    dragHandle: ".turn-node__drag-handle",
    position: positions[node.id] ?? node.position,
    data: {
      title: nodeOverrides[node.id]?.title ?? node.title,
      summary: nodeOverrides[node.id]?.summary ?? node.summary,
      status: nodeOverrides[node.id]?.status ?? node.status,
      tags: nodeOverrides[node.id]?.tags ?? node.tags,
      color: nodeOverrides[node.id]?.color ?? node.color,
      collapsed: nodeOverrides[node.id]?.collapsed ?? node.collapsed,
      important: nodeOverrides[node.id]?.important ?? node.important,
      isCustomNode: true,
      onUpdate
    }
  }));

  const mapNodes = [...turnNodes, ...extraNodes];
  return layoutMode === "list" || hiddenRoot ? mapNodes : [rootNode, ...mapNodes];
}

function createLayoutPositions(turns: Turn[], layoutMode: LayoutMode): Record<string, { x: number; y: number }> {
  const topicPositions = topicPositionsFromTurns(turns);
  const topicCount = Math.max(1, ...Object.values(topicPositions).map((position) => position.topicIndex + 1));
  const positions: Record<string, { x: number; y: number }> = {
    "conversation-root": { x: 0, y: 0 }
  };

  turns.forEach((turn, index) => {
    if (layoutMode === "list") {
      const column = index % 3;
      const row = Math.floor(index / 3);
      positions[turn.id] = {
        x: column * 320,
        y: row * 210
      };
      return;
    }

    if (layoutMode === "two-sided") {
      const side = index % 2 === 0 ? 1 : -1;
      const row = Math.floor(index / 2);
      positions[turn.id] = { x: side * 380, y: row * 190 - Math.max(0, turns.length / 4) * 190 };
      return;
    }

    if (layoutMode === "radial") {
      const angle = turns.length <= 1 ? 0 : (index / turns.length) * Math.PI * 2;
      const radius = 420 + Math.floor(index / 12) * 180;
      positions[turn.id] = {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius)
      };
      return;
    }

    positions[turn.id] = {
      x: 360 + (topicPositions[turn.id]?.depth ?? index) * 340,
      y: ((topicPositions[turn.id]?.topicIndex ?? 0) - (topicCount - 1) / 2) * 260
    };
  });

  return positions;
}

function autoEdgesFromTurns(
  turns: Turn[],
  layoutMode: LayoutMode,
  hiddenRoot: boolean,
  hiddenAutoEdgeIds: string[]
): Edge[] {
  if (layoutMode === "list" || hiddenRoot) return [];

  const topicPositions = topicPositionsFromTurns(turns);
  return turns
    .map((turn, index) => {
      const topicPosition = topicPositions[turn.id];
      const isTopicHead = topicPosition?.isTopicHead ?? index === 0;
      const previousTurn = turns[index - 1];
      const relationship: EdgeRelationship = isTopicHead ? "references" : "extends";
      return {
        id: isTopicHead ? `conversation-root-${turn.id}` : `sequence-${previousTurn.id}-${turn.id}`,
        source: isTopicHead ? "conversation-root" : previousTurn.id,
        target: turn.id,
        label: isTopicHead ? "topic" : "next",
        data: {
          relationship
        } satisfies RelationshipEdgeData,
        style: relationshipStyle(relationship)
      };
    })
    .filter((edge) => !hiddenAutoEdgeIds.includes(edge.id));
}

function edgeHasExistingNodes(edge: Edge, nodeIds: Set<string>): boolean {
  return Boolean(edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target));
}

function graphNodesMatchTurns(nodes: Node<TurnNodeData>[], turns: Turn[], hiddenNodeIds: string[] = []): boolean {
  const hidden = new Set(hiddenNodeIds);
  const turnIds = new Set(turns.filter((turn) => !hidden.has(turn.id)).map((turn) => turn.id));
  const nodeTurnIds = nodes.filter((node) => node.data.turn).map((node) => node.id);
  return (
    nodeTurnIds.length === turnIds.size &&
    nodeTurnIds.every((nodeId) => turnIds.has(nodeId)) &&
    nodes.filter((node) => node.data.turn).every((node) => node.data.turn?.id === node.id)
  );
}

function relationshipStyle(relationship: EdgeRelationship, important = false): Edge["style"] {
  return {
    stroke: relationshipColor(relationship),
    strokeWidth: important ? 5.5 : 1.8
  };
}

function relationshipColor(relationship: EdgeRelationship): string {
  return colorForRelationship(relationship);
}

function RelationshipColorPicker({
  value,
  onChange
}: {
  value: EdgeRelationship;
  onChange: (relationship: EdgeRelationship) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="color-picker" aria-label={t("action.colorNode")}>
      <span className="color-picker__title">{t("action.colorNode")}</span>
      <div className="color-picker__row">
        {RELATIONSHIP_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="color-swatch-button"
            aria-pressed={value === option.value}
            style={{ backgroundColor: relationshipColor(option.value) }}
            title={t(RELATIONSHIP_LABEL_KEYS[option.value])}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function applyEdgeStyle(edge: Edge): Edge {
  const data = edge.data as RelationshipEdgeData | undefined;
  const relationship = data?.relationship ?? "related";
  return {
    ...edge,
    label: edge.label ?? relationship,
    style: relationshipStyle(relationship, data?.important)
  };
}

function isAutoEdge(edge: Edge): boolean {
  return edge.id.startsWith("conversation-root-") || edge.id.startsWith("sequence-");
}

function nodeOverridesFromNodes(
  nodes: Node<TurnNodeData>[]
): Record<
  string,
  {
    title?: string;
    summary?: string;
    status?: "open" | "review" | "done";
    tags?: string[];
    color?: NodeColorName;
    collapsed?: boolean;
    important?: boolean;
  }
> {
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        title: typeof node.data?.title === "string" ? node.data.title : undefined,
        summary: typeof node.data?.summary === "string" ? node.data.summary : undefined,
        status: node.data.status,
        tags: node.data.tags,
        color: node.data.color,
        collapsed: node.data.collapsed,
        important: node.data.important
      }
    ])
  );
}

function customRecordsFromNodes(nodes: Node<TurnNodeData>[]): CustomNodeRecord[] {
  return nodes
    .filter((node) => node.id !== "conversation-root" && !node.data.turn)
    .map((node) => ({
      id: node.id,
      position: node.position,
      title: node.data.title,
      summary: node.data.summary,
      status: node.data.status,
      tags: node.data.tags,
      color: node.data.color,
      collapsed: node.data.collapsed,
      important: node.data.important
    }));
}

function nodeTitleById(nodes: Node<TurnNodeData>[]): Map<string, string> {
  return new Map(nodes.map((node) => [node.id, node.data.title || node.id]));
}

function shortNodeTitle(nodes: Node<TurnNodeData>[], nodeId: string): string {
  const title = nodes.find((node) => node.id === nodeId)?.data.title ?? nodeId;
  return title.length > 42 ? `${title.slice(0, 42)}...` : title;
}

function edgeRelationship(edge: Edge): EdgeRelationship {
  return ((edge.data as RelationshipEdgeData | undefined)?.relationship ?? "related") as EdgeRelationship;
}

function safeFilePart(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return (cleaned || "turnmap").slice(0, 80);
}

function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  downloadBlobFile(filename, blob);
}

function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function estimatedSvgTextWidth(value: string, fontSize: number): number {
  let units = 0;

  for (const char of Array.from(value)) {
    if (/\s/.test(char)) {
      units += 0.32;
    } else if (/[\u2e80-\u9fff\uac00-\ud7af\u3040-\u30ff\uff00-\uffef]/.test(char)) {
      units += 1;
    } else if (/[A-Z]/.test(char)) {
      units += 0.66;
    } else if (/[a-z0-9]/.test(char)) {
      units += 0.56;
    } else if (/[.,;:|/\\_\-()[\]{}'"]/.test(char)) {
      units += 0.36;
    } else {
      units += 0.62;
    }
  }

  return units * fontSize;
}

function appendEllipsis(line: string, maxWidth: number, fontSize: number): string {
  const ellipsis = "...";
  let next = line.trimEnd();

  while (next && estimatedSvgTextWidth(`${next}${ellipsis}`, fontSize) > maxWidth) {
    next = Array.from(next).slice(0, -1).join("").trimEnd();
  }

  return next ? `${next}${ellipsis}` : ellipsis;
}

function wrapText(value: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  let currentLine = "";

  for (const char of Array.from(normalized)) {
    const nextLine = currentLine || !/\s/.test(char) ? `${currentLine}${char}` : currentLine;
    if (estimatedSvgTextWidth(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine.trimEnd());
      if (lines.length >= maxLines) break;
    }

    currentLine = /\s/.test(char) ? "" : char;
  }

  if (currentLine && lines.length < maxLines) lines.push(currentLine);
  if (lines.length === maxLines && lines.join("").length < normalized.replace(/\s/g, "").length) {
    lines[maxLines - 1] = appendEllipsis(lines[maxLines - 1], maxWidth, fontSize);
  }

  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("PNG export failed while loading SVG."));
    image.src = src;
  });
}

async function svgToPngBlob(svg: string): Promise<Blob> {
  const sizeMatch = svg.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  const width = sizeMatch ? Number(sizeMatch[1]) : 1600;
  const height = sizeMatch ? Number(sizeMatch[2]) : 1200;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export failed: canvas is unavailable.");
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("PNG export failed while encoding image."));
        }
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function serializeGraph(
  conversationId: string,
  conversationTitle: string,
  turns: Turn[],
  nodes: Node<TurnNodeData>[],
  edges: Edge[],
  layoutMode: LayoutMode,
  hiddenRoot: boolean,
  hiddenAutoEdgeIds: string[],
  hiddenNodeIds: string[]
): string {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    conversation: {
      id: conversationId,
      title: conversationTitle,
      turnCount: turns.length
    },
    layout: {
      mode: layoutMode,
      hiddenRoot,
      hiddenAutoEdgeIds,
      hiddenNodeIds
    },
    turns,
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      title: node.data.title,
      summary: node.data.summary,
      status: node.data.status,
      tags: node.data.tags,
      color: node.data.color,
      collapsed: node.data.collapsed,
      important: node.data.important,
      turnId: node.data.turn?.id,
      isConversationRoot: Boolean(node.data.isConversationRoot)
    })),
    edges: edges.map((edge) => {
      const data = edge.data as RelationshipEdgeData | undefined;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        relationship: data?.relationship ?? (isAutoEdge(edge) ? "references" : "related"),
        important: Boolean(data?.important),
        confidence: data?.confidence,
        reason: data?.reason,
        createdBy: data?.createdBy,
        isAuto: isAutoEdge(edge)
      };
    })
  };

  return JSON.stringify(payload, null, 2);
}

function graphToObsidianCanvas(
  conversationTitle: string,
  nodes: Node<TurnNodeData>[],
  edges: Edge[]
): string {
  const nodeText = (node: Node<TurnNodeData>): string => {
    const metadata = [
      node.data.turn ? `Turn: ${node.data.turn.turnIndex + 1}` : "",
      node.data.status ? `Status: ${node.data.status}` : "",
      node.data.tags?.length ? `Tags: ${node.data.tags.map((tag) => `#${tag}`).join(" ")}` : ""
    ].filter(Boolean);

    return [
      node.data.isConversationRoot ? `# ${node.data.title}` : `## ${node.data.title}`,
      node.data.summary,
      metadata.length ? metadata.join("\n") : ""
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const canvasNodes = nodes.map((node) => ({
    id: node.id,
    type: "text",
    text: nodeText(node),
    x: Math.round(node.position.x),
    y: Math.round(node.position.y),
    width: node.data.isConversationRoot ? 320 : 300,
    height: node.data.isConversationRoot ? 180 : 220
  }));

  const canvasEdges = edges.map((edge) => {
    const relationship = edgeRelationship(edge);
    const data = edge.data as RelationshipEdgeData | undefined;
    return {
      id: edge.id,
      fromNode: edge.source,
      fromSide: "right",
      toNode: edge.target,
      toSide: "left",
      label: [
        String(edge.label ?? relationship),
        data?.important ? "important" : "",
        typeof data?.confidence === "number" ? `${Math.round(data.confidence * 100)}%` : "",
        data?.reason ? data.reason : ""
      ]
        .filter(Boolean)
        .join(" | "),
      color: relationshipColor(relationship)
    };
  });

  return JSON.stringify(
    {
      nodes: canvasNodes,
      edges: canvasEdges,
      metadata: {
        name: conversationTitle,
        source: "TurnMap"
      }
    },
    null,
    2
  );
}

function graphToSvg(
  conversationTitle: string,
  nodes: Node<TurnNodeData>[],
  edges: Edge[]
): string {
  const nodeWidth = 300;
  const nodeHeight = 190;
  const rootHeight = 150;
  const padding = 90;
  const bounds = nodes.reduce(
    (acc, node) => {
      const height = node.data.isConversationRoot ? rootHeight : nodeHeight;
      return {
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + nodeWidth),
        maxY: Math.max(acc.maxY, node.position.y + height)
      };
    },
    { minX: 0, minY: 0, maxX: nodeWidth, maxY: nodeHeight }
  );
  const offsetX = padding - bounds.minX;
  const offsetY = padding - bounds.minY;
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const edgeMarkup = edges
    .map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return "";
      const sourceHeight = source.data.isConversationRoot ? rootHeight : nodeHeight;
      const targetHeight = target.data.isConversationRoot ? rootHeight : nodeHeight;
      const relationship = edgeRelationship(edge);
      const data = edge.data as RelationshipEdgeData | undefined;
      const x1 = source.position.x + offsetX + nodeWidth;
      const y1 = source.position.y + offsetY + sourceHeight / 2;
      const x2 = target.position.x + offsetX;
      const y2 = target.position.y + offsetY + targetHeight / 2;
      const midX = (x1 + x2) / 2;
      const label = edge.label ? String(edge.label) : relationship;

      return `
    <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="${relationshipColor(
      relationship
    )}" stroke-width="${data?.important ? 5.5 : 1.8}" marker-end="url(#arrow)" opacity="0.78" />
    <text x="${midX}" y="${(y1 + y2) / 2 - 6}" class="edge-label">${escapeXml(label)}</text>`;
    })
    .join("");

  const nodeMarkup = nodes
    .map((node, index) => {
      const isRoot = Boolean(node.data.isConversationRoot);
      const x = node.position.x + offsetX;
      const y = node.position.y + offsetY;
      const height = isRoot ? rootHeight : nodeHeight;
      const textX = x + 18;
      const textWidth = nodeWidth - 36;
      const clipId = `node-text-clip-${index}`;
      const titleLines = wrapText(node.data.title, textWidth, 14, isRoot ? 3 : 2);
      const summaryLines = wrapText(node.data.summary, textWidth, 12, isRoot ? 3 : 5);
      const titleMarkup = titleLines
        .map(
          (line, index) =>
            `<tspan x="${textX}" y="${y + 54 + index * 18}">${escapeXml(line)}</tspan>`
        )
        .join("");
      const summaryStart = y + 70 + titleLines.length * 18;
      const summaryMarkup = summaryLines
        .map(
          (line, index) =>
            `<tspan x="${textX}" y="${summaryStart + index * 16}">${escapeXml(line)}</tspan>`
        )
        .join("");

      return `
    <g>
      <clipPath id="${clipId}">
        <rect x="${x + 12}" y="${y + 10}" width="${nodeWidth - 24}" height="${height - 20}" rx="6" />
      </clipPath>
      <rect x="${x}" y="${y}" width="${nodeWidth}" height="${height}" rx="8" class="${
        isRoot ? "node-root" : "node"
      }" />
      <g clip-path="url(#${clipId})">
        <text x="${textX}" y="${y + 26}" class="${isRoot ? "meta-root" : "meta"}">${
          isRoot ? "CONVERSATION" : `TURN ${node.data.turn ? node.data.turn.turnIndex + 1 : ""}`
        }</text>
        <text class="${isRoot ? "title-root" : "title"}">${titleMarkup}</text>
        <text class="${isRoot ? "summary-root" : "summary"}">${summaryMarkup}</text>
      </g>
    </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(
    conversationTitle
  )}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
    </marker>
    <style>
      .bg { fill: #f7f4ef; }
      .node { fill: #fffefb; stroke: #d1d9d4; stroke-width: 1; filter: drop-shadow(0 6px 12px rgba(31,41,55,0.08)); }
      .node-root { fill: #1f2937; stroke: #1f2937; stroke-width: 1; }
      .meta { fill: #68736e; font: 700 11px Inter, Arial, sans-serif; letter-spacing: 0; }
      .meta-root { fill: #ffffff; font: 700 11px Inter, Arial, sans-serif; letter-spacing: 0; }
      .title { fill: #17211d; font: 700 14px Inter, Arial, sans-serif; }
      .title-root { fill: #ffffff; font: 700 14px Inter, Arial, sans-serif; }
      .summary { fill: #52605b; font: 12px Inter, Arial, sans-serif; }
      .summary-root { fill: #ffffff; font: 12px Inter, Arial, sans-serif; }
      .edge-label { fill: #64748b; font: 11px Inter, Arial, sans-serif; paint-order: stroke; stroke: #f7f4ef; stroke-width: 4px; stroke-linejoin: round; }
    </style>
  </defs>
  <rect class="bg" width="100%" height="100%" />
  ${edgeMarkup}
  ${nodeMarkup}
</svg>`;
}

function graphToMarkdown(
  conversationTitle: string,
  turns: Turn[],
  nodes: Node<TurnNodeData>[],
  edges: Edge[]
): string {
  const titles = nodeTitleById(nodes);
  const turnNodes = nodes.filter((node) => !node.data.isConversationRoot);
  const lines: string[] = [`# ${conversationTitle}`, "", `${turns.length} turns mapped by TurnMap.`, ""];

  lines.push("## Nodes", "");
  turnNodes.forEach((node, index) => {
    lines.push(`### ${index + 1}. ${node.data.title}`);
    if (node.data.summary) {
      lines.push("", node.data.summary);
    }
    if (node.data.turn) {
      lines.push("", "**User**", "", node.data.turn.userText.trim());
      lines.push("", "**Assistant**", "", node.data.turn.assistantText.trim());
    }
    lines.push("");
  });

  lines.push("## Links", "");
  if (edges.length === 0) {
    lines.push("No links.");
  } else {
    edges.forEach((edge) => {
      const relationship = edgeRelationship(edge);
      const data = edge.data as RelationshipEdgeData | undefined;
      const important = data?.important ? " important" : "";
      const label = edge.label ? ` - ${String(edge.label)}` : "";
      lines.push(
        `- ${titles.get(edge.source) ?? edge.source} -> ${titles.get(edge.target) ?? edge.target} [${relationship}${important}]${label}`
      );
    });
  }

  return lines.join("\n");
}

function nodesForAdvancedExport(nodes: Node<TurnNodeData>[]): ExportNode[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.data.title,
    summary: node.data.summary,
    status: node.data.status,
    tags: node.data.tags,
    color: node.data.color,
    collapsed: node.data.collapsed,
    important: node.data.important,
    turn: node.data.turn,
    isConversationRoot: node.data.isConversationRoot,
    position: node.position
  }));
}

function edgesForAdvancedExport(edges: Edge[]): ExportEdge[] {
  return edges.map((edge) => {
    const data = edge.data as RelationshipEdgeData | undefined;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      relationship: data?.relationship ?? (isAutoEdge(edge) ? "references" : "related"),
      important: data?.important,
      confidence: data?.confidence,
      reason: data?.reason
    };
  });
}

function isLayoutMode(value: unknown): value is LayoutMode {
  return value === "single" || value === "radial" || value === "list" || value === "two-sided";
}

function isRelationship(value: unknown): value is EdgeRelationship {
  return (
    value === "related" ||
    value === "depends_on" ||
    value === "extends" ||
    value === "supports" ||
    value === "contradicts" ||
    value === "duplicates" ||
    value === "references" ||
    value === "todo"
  );
}

function parseImportedGraph(text: string): ExportedGraph {
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== "object") {
    throw new Error("Imported file is not a TurnMap JSON object.");
  }

  const graph = value as ExportedGraph;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("Imported file does not look like a TurnMap JSON export.");
  }

  return graph;
}

function positionsFromImportedGraph(graph: ExportedGraph): Record<string, { x: number; y: number }> {
  return Object.fromEntries(
    (graph.nodes ?? [])
      .filter(
        (node) =>
          typeof node.id === "string" &&
          typeof node.position?.x === "number" &&
          typeof node.position?.y === "number"
      )
      .map((node) => [node.id!, { x: node.position!.x!, y: node.position!.y! }])
  );
}

function overridesFromImportedGraph(
  graph: ExportedGraph
): Record<string, { title?: string; summary?: string; status?: "open" | "review" | "done"; tags?: string[] }> {
  return Object.fromEntries(
    (graph.nodes ?? [])
      .filter((node) => typeof node.id === "string")
      .map((node) => [
        node.id!,
        {
          title: typeof node.title === "string" ? node.title : undefined,
          summary: typeof node.summary === "string" ? node.summary : undefined,
          status:
            node.status === "open" || node.status === "review" || node.status === "done"
              ? node.status
              : undefined,
          tags: Array.isArray(node.tags) ? node.tags.filter((tag) => typeof tag === "string") : undefined,
          color: isNodeColorName(node.color) ? node.color : undefined,
          collapsed: typeof node.collapsed === "boolean" ? node.collapsed : undefined,
          important: typeof node.important === "boolean" ? node.important : undefined
        }
      ])
  );
}

function customNodesFromImportedGraph(graph: ExportedGraph): CustomNodeRecord[] {
  return (graph.nodes ?? [])
    .filter((node) => typeof node.id === "string" && !node.isConversationRoot && !node.turnId)
    .map((node) => ({
      id: node.id!,
      position: {
        x: typeof node.position?.x === "number" ? node.position.x : 0,
        y: typeof node.position?.y === "number" ? node.position.y : 0
      },
      title: typeof node.title === "string" ? node.title : node.id!,
      summary: typeof node.summary === "string" ? node.summary : "",
      status:
        node.status === "open" || node.status === "review" || node.status === "done" ? node.status : undefined,
      tags: Array.isArray(node.tags) ? node.tags.filter((tag) => typeof tag === "string") : undefined,
      color: isNodeColorName(node.color) ? node.color : undefined,
      collapsed: typeof node.collapsed === "boolean" ? node.collapsed : undefined,
      important: typeof node.important === "boolean" ? node.important : undefined
    }));
}

function cloneSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data, tags: node.data.tags ? [...node.data.tags] : undefined }
    })),
    edges: snapshot.edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : undefined
    })),
    hiddenRoot: snapshot.hiddenRoot,
    hiddenAutoEdgeIds: [...snapshot.hiddenAutoEdgeIds],
    hiddenNodeIds: [...snapshot.hiddenNodeIds]
  };
}

function snapshotKey(snapshot: GraphSnapshot): string {
  return JSON.stringify({
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        title: node.data.title,
        summary: node.data.summary,
        status: node.data.status,
        tags: node.data.tags,
        isCustomNode: node.data.isCustomNode
      },
      selected: node.selected
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      data: edge.data
    })),
    hiddenRoot: snapshot.hiddenRoot,
    hiddenAutoEdgeIds: snapshot.hiddenAutoEdgeIds,
    hiddenNodeIds: snapshot.hiddenNodeIds
  });
}

export function TurnMapCanvas({
  conversationId,
  conversationTitle,
  turns,
  sourceTabId,
  onStatus,
  onTaskStatus
}: TurnMapCanvasProps) {
  const { t } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TurnNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedRoot, setSelectedRoot] = useState(false);
  const [highlightedEndpointIds, setHighlightedEndpointIds] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");
  const [hiddenRoot, setHiddenRoot] = useState(false);
  const [hiddenAutoEdgeIds, setHiddenAutoEdgeIds] = useState<string[]>([]);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<string[]>([]);
  const [summarizingNodeIds, setSummarizingNodeIds] = useState<Set<string>>(() => new Set());
  const [pendingSuggestedEdges, setPendingSuggestedEdges] = useState<Edge[]>([]);
  const [suggestingLinks, setSuggestingLinks] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [undoStack, setUndoStack] = useState<GraphSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<GraphSnapshot[]>([]);
  const saveTimer = useRef<number | null>(null);
  const historyTimer = useRef<number | null>(null);
  const lastHistorySnapshot = useRef<GraphSnapshot | null>(null);
  const restoringHistory = useRef(false);
  const loadedConversationId = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const flowInstance = useRef<ReactFlowInstance<Node<TurnNodeData>, Edge> | null>(null);
  const autoSummarizedNodeIds = useRef<Set<string>>(new Set());
  const autoSummarizeRunning = useRef(false);
  const jumpRequestId = useRef(0);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );
  const selectedTurnNodes = useMemo(
    () => nodes.filter((node) => node.selected && node.data.turn && !node.data.isConversationRoot),
    [nodes]
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return nodes
      .filter((node) => !node.data.isConversationRoot)
      .filter((node) =>
        [node.data.title, node.data.summary, ...(node.data.tags ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 30);
  }, [nodes, searchQuery]);
  const renderedNodes = useMemo<Node<TurnNodeData>[]>(() => {
    const highlighted = new Set(highlightedEndpointIds);
    return nodes.map((node) => ({
      ...node,
      className: [node.className, highlighted.has(node.id) ? "is-endpoint-highlight" : ""]
        .filter(Boolean)
        .join(" ")
    }));
  }, [highlightedEndpointIds, nodes]);
  const currentSnapshot = useCallback(
    (): GraphSnapshot => {
      const snapshot = cloneSnapshot({
        nodes,
        edges,
        hiddenRoot,
        hiddenAutoEdgeIds,
        hiddenNodeIds
      });
      return snapshot;
    },
    [edges, hiddenAutoEdgeIds, hiddenNodeIds, hiddenRoot, nodes]
  );

  const restoreSnapshot = useCallback(
    (snapshot: GraphSnapshot) => {
      restoringHistory.current = true;
      const nextSnapshot = cloneSnapshot(snapshot);
      setNodes(nextSnapshot.nodes);
      setEdges(nextSnapshot.edges);
      setHiddenRoot(nextSnapshot.hiddenRoot);
      setHiddenAutoEdgeIds(nextSnapshot.hiddenAutoEdgeIds);
      setHiddenNodeIds(nextSnapshot.hiddenNodeIds);
      setSelectedEdgeId(null);
      setSelectedRoot(false);
      lastHistorySnapshot.current = cloneSnapshot(nextSnapshot);
      window.setTimeout(() => {
        restoringHistory.current = false;
      }, 0);
    },
    [setEdges, setNodes]
  );

  const updateNodeText = useCallback(
    (nodeId: string, updates: { title?: string; summary?: string }) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates
                }
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const reportApiTask = useCallback(
    (entry: {
      id: string;
      kind: ApiTaskKind;
      status: ApiTaskStatus;
      message: string;
      progress: number;
    }) => {
      onStatus?.(entry.message);
      void onTaskStatus?.(entry);
    },
    [onStatus, onTaskStatus]
  );

  const jumpToNodeTurn = useCallback(
    async (nodeId: string) => {
      const turn = turns.find((candidate) => candidate.id === nodeId);
      if (!turn) return;

      const requestId = (jumpRequestId.current += 1);
      const result = await jumpToTurnInActiveTab(
        {
          type: "TURNMAP_JUMP_TO_TURN",
          anchor: turn.sourceAnchor
        },
        sourceTabId
      );

      if (requestId !== jumpRequestId.current) return;
      if (!result.ok) {
        onStatus?.(result.reason ?? "Jump failed.");
      }
    },
    [onStatus, sourceTabId, turns]
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      setNodes((currentNodes) =>
        currentNodes.map((candidate) => ({
          ...candidate,
          selected: candidate.id === nodeId
        }))
      );
      setSelectedEdgeId(null);
      setSelectedRoot(false);
      flowInstance.current?.setCenter(node.position.x + 150, node.position.y + 95, {
        duration: 420,
        zoom: 1.1
      });
      onStatus?.(`Focused ${node.data.title}`);
    },
    [nodes, onStatus, setNodes]
  );

  useEffect(() => {
    autoSummarizedNodeIds.current = new Set();
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    void loadAiSettings().then((settings) => {
      if (!cancelled) {
        setAutoSummarize(Boolean(settings.autoSummarize));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const summarizeNode = useCallback(
    async (nodeId: string) => {
      const turn = turns.find((candidate) => candidate.id === nodeId);
      if (!turn) return;

      setSummarizingNodeIds((currentIds) => new Set(currentIds).add(nodeId));
      const taskId = `summarize-${conversationId}-${nodeId}`;
      reportApiTask({
        id: taskId,
        kind: "summarize",
        status: "running",
        message: t("task.summarizeOne", { current: turn.turnIndex + 1 }),
        progress: 5
      });

      try {
        const summary = await summarizeTurn(turn);
        setNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    title: summary.title,
                    summary: summary.summary
                  }
                }
              : node
          )
        );
        reportApiTask({
          id: taskId,
          kind: "summarize",
          status: "success",
          message: t("task.summarizeOneDone", { current: turn.turnIndex + 1 }),
          progress: 100
        });
      } catch (error) {
        reportApiTask({
          id: taskId,
          kind: "summarize",
          status: "error",
          message: error instanceof Error ? error.message : t("task.summarizeFailed"),
          progress: 100
        });
      } finally {
        setSummarizingNodeIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(nodeId);
          return nextIds;
        });
      }
    },
    [conversationId, reportApiTask, setNodes, t, turns]
  );

  const summarizeAllNodes = useCallback(async () => {
    if (summarizingNodeIds.size > 0) return;
    if (turns.length === 0) return;

    setSummarizingNodeIds(new Set(turns.map((turn) => turn.id)));
    const taskId = `summarize-all-${conversationId}`;
    reportApiTask({
      id: taskId,
      kind: "summarize",
      status: "running",
      message: t("task.summarizeAll", { total: turns.length }),
      progress: 0
    });
    let completed = 0;
    let failed = false;

    for (const turn of turns) {
      try {
        const summary = await summarizeTurn(turn);
        setNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.id === turn.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    title: summary.title,
                    summary: summary.summary
                  }
                }
              : node
          )
        );
        completed += 1;
        reportApiTask({
          id: taskId,
          kind: "summarize",
          status: "running",
          message: t("task.summarizeProgress", { current: completed, total: turns.length }),
          progress: Math.round((completed / turns.length) * 100)
        });
      } catch (error) {
        reportApiTask({
          id: taskId,
          kind: "summarize",
          status: "error",
          message: error instanceof Error ? error.message : t("task.summarizeFailed"),
          progress: Math.round((completed / turns.length) * 100)
        });
        failed = true;
        break;
      } finally {
        setSummarizingNodeIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(turn.id);
          return nextIds;
        });
      }
    }

    if (!failed) {
      reportApiTask({
        id: taskId,
        kind: "summarize",
        status: "success",
        message: t("task.summarizeAllDone", { total: completed }),
        progress: 100
      });
    }
  }, [conversationId, reportApiTask, setNodes, summarizingNodeIds.size, t, turns]);

  useEffect(() => {
    let cancelled = false;
    const loadingConversationId = conversationId;
    loadedConversationId.current = null;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (historyTimer.current) {
      window.clearTimeout(historyTimer.current);
      historyTimer.current = null;
    }

    Promise.all([loadStoredGraph(conversationId), loadDefaultLayout()]).then(
      ([storedGraph, defaultLayout]) => {
      if (cancelled) return;

      const activeLayout = storedGraph.layoutMode ?? defaultLayout;
      const activeHiddenRoot = storedGraph.hiddenRoot ?? false;
      const activeHiddenAutoEdgeIds = storedGraph.hiddenAutoEdgeIds ?? [];
      const activeHiddenNodeIds = storedGraph.hiddenNodeIds ?? [];
      const storedPositions = storedGraph.schemaVersion >= 2 ? storedGraph.positions : {};
      setLayoutMode(activeLayout);
      setHiddenRoot(activeHiddenRoot);
      setHiddenAutoEdgeIds(activeHiddenAutoEdgeIds);
      setHiddenNodeIds(activeHiddenNodeIds);
      const autoEdges = autoEdgesFromTurns(
        turns,
        activeLayout,
        activeHiddenRoot,
        activeHiddenAutoEdgeIds
      );
      const nodeIds = new Set([
        ...(activeLayout === "list" || activeHiddenRoot ? [] : ["conversation-root"]),
        ...turns.filter((turn) => !activeHiddenNodeIds.includes(turn.id)).map((turn) => turn.id),
        ...(storedGraph.customNodes ?? []).map((node) => node.id)
      ]);
      const validUserEdges = storedGraph.userEdges.filter((edge) => edgeHasExistingNodes(edge, nodeIds));
      const nextNodes = nodesFromTurns(
        conversationTitle,
        turns,
        storedPositions,
        storedGraph.nodeOverrides,
        updateNodeText,
        summarizeNode,
        jumpToNodeTurn,
        new Set(),
        activeHiddenNodeIds,
        storedGraph.customNodes ?? [],
        activeLayout,
        activeHiddenRoot
      );
      const nextEdges = [...autoEdges, ...validUserEdges.map(applyEdgeStyle)];
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedEdgeId((edgeId) =>
        edgeId && validUserEdges.some((edge) => edge.id === edgeId) ? edgeId : null
      );
      setSelectedRoot(false);
      setUndoStack([]);
      setRedoStack([]);
      lastHistorySnapshot.current = cloneSnapshot({
        nodes: nextNodes,
        edges: nextEdges,
        hiddenRoot: activeHiddenRoot,
        hiddenAutoEdgeIds: activeHiddenAutoEdgeIds,
        hiddenNodeIds: activeHiddenNodeIds
      });
      loadedConversationId.current = loadingConversationId;
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    conversationTitle,
    setEdges,
    setNodes,
    summarizeNode,
    jumpToNodeTurn,
    turns,
    updateNodeText
  ]);

  const scheduleSave = useCallback(
    (nextNodes: Node<TurnNodeData>[], nextEdges: Edge[]) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }

      if (loadedConversationId.current !== conversationId) return;
      if (!graphNodesMatchTurns(nextNodes, turns, hiddenNodeIds)) return;

      saveTimer.current = window.setTimeout(() => {
        if (loadedConversationId.current !== conversationId) return;
        if (!graphNodesMatchTurns(nextNodes, turns, hiddenNodeIds)) return;

        void saveStoredGraph(
          conversationId,
          nextNodes,
          nextEdges.filter((edge) => !isAutoEdge(edge)),
          layoutMode,
          hiddenRoot,
          hiddenAutoEdgeIds,
          hiddenNodeIds
        );
      }, 250);
    },
    [conversationId, hiddenAutoEdgeIds, hiddenNodeIds, hiddenRoot, layoutMode, turns]
  );

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onSummarize: summarizeNode,
          onJump: jumpToNodeTurn,
          isSummarizing: summarizingNodeIds.has(node.id)
        }
      }))
    );
  }, [jumpToNodeTurn, setNodes, summarizeNode, summarizingNodeIds]);

  useEffect(() => {
    if (nodes.length === 0) return;
    if (loadedConversationId.current !== conversationId) return;
    if (!graphNodesMatchTurns(nodes, turns, hiddenNodeIds)) return;
    scheduleSave(nodes, edges);
  }, [conversationId, edges, hiddenNodeIds, nodes, scheduleSave, turns]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const snapshot = currentSnapshot();
    if (!lastHistorySnapshot.current) {
      lastHistorySnapshot.current = cloneSnapshot(snapshot);
      return;
    }
    if (restoringHistory.current) return;

    if (historyTimer.current) {
      window.clearTimeout(historyTimer.current);
    }

    historyTimer.current = window.setTimeout(() => {
      const previous = lastHistorySnapshot.current;
      if (!previous || snapshotKey(previous) === snapshotKey(snapshot)) return;
      setUndoStack((currentStack) => [...currentStack.slice(-29), cloneSnapshot(previous)]);
      setRedoStack([]);
      lastHistorySnapshot.current = cloneSnapshot(snapshot);
    }, 450);
  }, [currentSnapshot, edges, hiddenAutoEdgeIds, hiddenNodeIds, hiddenRoot, nodes]);

  useEffect(() => {
    if (!autoSummarize || autoSummarizeRunning.current) return;
    const candidates = nodes
      .filter((node) => !node.data.isConversationRoot && nodeHasDefaultText(node))
      .filter((node) => !autoSummarizedNodeIds.current.has(node.id))
      .filter((node) => !summarizingNodeIds.has(node.id));

    if (candidates.length === 0) return;

    autoSummarizeRunning.current = true;
    let cancelled = false;

    void (async () => {
      const taskId = `auto-summarize-${conversationId}`;
      let completed = 0;
      reportApiTask({
        id: taskId,
        kind: "summarize",
        status: "running",
        message: t("task.autoSummarize", { total: candidates.length }),
        progress: 0
      });

      for (const node of candidates) {
        if (cancelled || !node.data.turn) break;
        autoSummarizedNodeIds.current.add(node.id);
        setSummarizingNodeIds((currentIds) => new Set(currentIds).add(node.id));

        try {
          const summary = await summarizeTurn(node.data.turn);
          if (cancelled) break;
          setNodes((currentNodes) =>
            currentNodes.map((currentNode) => {
              if (currentNode.id !== node.id || !nodeHasDefaultText(currentNode)) return currentNode;
              return {
                ...currentNode,
                data: {
                  ...currentNode.data,
                  title: summary.title,
                  summary: summary.summary
                }
              };
            })
          );
          completed += 1;
          reportApiTask({
            id: taskId,
            kind: "summarize",
            status: "running",
            message: t("task.summarizeProgress", { current: completed, total: candidates.length }),
            progress: Math.round((completed / candidates.length) * 100)
          });
        } catch (error) {
          reportApiTask({
            id: taskId,
            kind: "summarize",
            status: "error",
            message: error instanceof Error ? error.message : t("task.autoSummarizeFailed"),
            progress: Math.round((completed / candidates.length) * 100)
          });
          break;
        } finally {
          setSummarizingNodeIds((currentIds) => {
            const nextIds = new Set(currentIds);
            nextIds.delete(node.id);
            return nextIds;
          });
        }
      }

      if (!cancelled) {
        reportApiTask({
          id: taskId,
          kind: "summarize",
          status: "success",
          message: t("task.autoSummarizeDone", { total: completed }),
          progress: 100
        });
      }
      autoSummarizeRunning.current = false;
    })();

    return () => {
      cancelled = true;
      autoSummarizeRunning.current = false;
    };
  }, [autoSummarize, conversationId, nodes.length, reportApiTask, setNodes, t]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: false,
            label: "related",
            id: `user-${connection.source}-${connection.target}-${Date.now()}`,
            data: {
              relationship: "related",
              important: false
            } satisfies RelationshipEdgeData,
            style: relationshipStyle("related")
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  const onEdgeClick = useCallback<EdgeMouseHandler>(
    (event, edge) => {
      event.stopPropagation();
      setSelectedRoot(false);
      setSelectedEdgeId(edge.id);
      setHighlightedEndpointIds([]);
    },
    []
  );

  const onEdgeContextMenu = useCallback<EdgeMouseHandler>(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedRoot(false);
      setSelectedEdgeId(edge.id);
      setHighlightedEndpointIds([edge.source, edge.target]);
      onStatus?.("Highlighted linked nodes");
    },
    [onStatus]
  );

  const updateSelectedEdge = useCallback(
    (updates: Partial<RelationshipEdgeData> & { label?: string }) => {
      if (!selectedEdgeId) return;
      const selectedIsAutoEdge = selectedEdge ? isAutoEdge(selectedEdge) : false;
      const nextSelectedEdgeId = selectedIsAutoEdge ? `user-${selectedEdgeId}` : selectedEdgeId;

      if (selectedIsAutoEdge) {
        setHiddenAutoEdgeIds((currentIds) =>
          currentIds.includes(selectedEdgeId) ? currentIds : [...currentIds, selectedEdgeId]
        );
        setSelectedEdgeId(nextSelectedEdgeId);
      }

      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== selectedEdgeId) return edge;

          const currentData = (edge.data as RelationshipEdgeData | undefined) ?? {
            relationship: isAutoEdge(edge) ? "references" : "related",
            important: false
          };
          const nextData: RelationshipEdgeData = {
            ...currentData,
            relationship: updates.relationship ?? currentData.relationship,
            important: updates.important ?? currentData.important
          };

          return applyEdgeStyle({
            ...edge,
            id: selectedIsAutoEdge ? nextSelectedEdgeId : edge.id,
            data: nextData,
            label: updates.label ?? edge.label
          });
        })
      );
    },
    [selectedEdge, selectedEdgeId, setEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<TurnNodeData>) => {
      const multiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
      setSelectedEdgeId(null);
      setHighlightedEndpointIds([]);

      if (node.data.isConversationRoot) {
        setSelectedRoot(true);
        setNodes((currentNodes) =>
          currentNodes.map((candidate) => ({
            ...candidate,
            selected: candidate.id === node.id
          }))
        );
        return;
      }

      setSelectedRoot(false);
      setNodes((currentNodes) =>
        currentNodes.map((candidate) => {
          if (candidate.id !== node.id) {
            return multiSelect ? candidate : { ...candidate, selected: false };
          }
          return {
            ...candidate,
            selected: multiSelect ? !candidate.selected : true
          };
        })
      );
    },
    [setNodes]
  );

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;

    if (isAutoEdge(selectedEdge)) {
      setHiddenAutoEdgeIds((currentIds) =>
        currentIds.includes(selectedEdge.id) ? currentIds : [...currentIds, selectedEdge.id]
      );
    }

    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedEdgeId(null);
  }, [selectedEdge, setEdges]);

  const deleteRoot = useCallback(() => {
    setHiddenRoot(true);
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== "conversation-root"));
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== "conversation-root"));
    setSelectedRoot(false);
    onStatus?.("Conversation header deleted");
  }, [onStatus, setEdges, setNodes]);

  const mergeSelectedNodes = useCallback(() => {
    if (selectedTurnNodes.length < 2) return;

    const sortedNodes = [...selectedTurnNodes].sort(
      (left, right) => (left.data.turn?.turnIndex ?? 0) - (right.data.turn?.turnIndex ?? 0)
    );
    const sourceIds = new Set(sortedNodes.map((node) => node.id));
    const mergedId = `custom-merge-${Date.now()}`;
    const averagePosition = sortedNodes.reduce(
      (position, node) => ({
        x: position.x + node.position.x / sortedNodes.length,
        y: position.y + node.position.y / sortedNodes.length
      }),
      { x: 0, y: 0 }
    );
    const mergedTitle = `Merged: ${sortedNodes.map((node) => node.data.title).join(" / ")}`.slice(0, 120);
    const mergedSummary = sortedNodes
      .map((node) => {
        const turnLabel = node.data.turn ? `Turn ${node.data.turn.turnIndex + 1}` : "Note";
        return `${turnLabel}: ${node.data.summary}`;
      })
      .join("\n\n");

    setHiddenNodeIds((currentIds) => [...new Set([...currentIds, ...sourceIds])]);
    setNodes((currentNodes) => [
      ...currentNodes.filter((node) => !sourceIds.has(node.id)),
      {
        id: mergedId,
        type: "turnNode",
        position: averagePosition,
        selected: true,
        data: {
          title: mergedTitle,
          summary: mergedSummary,
          isCustomNode: true,
          onUpdate: updateNodeText
        }
      }
    ]);
    setEdges((currentEdges) => {
      const seen = new Set<string>();
      return currentEdges
        .filter((edge) => !isAutoEdge(edge))
        .map((edge) => ({
          ...edge,
          source: sourceIds.has(edge.source) ? mergedId : edge.source,
          target: sourceIds.has(edge.target) ? mergedId : edge.target
        }))
        .filter((edge) => edge.source !== edge.target)
        .filter((edge) => {
          const key = `${edge.source}:${edge.target}:${edge.label ?? ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(applyEdgeStyle);
    });
    setSelectedEdgeId(null);
    setSelectedRoot(false);
    onStatus?.(`Merged ${sortedNodes.length} nodes`);
  }, [onStatus, selectedTurnNodes, setEdges, setNodes, updateNodeText]);

  const collapseSelectedAsTopic = useCallback(() => {
    if (selectedTurnNodes.length < 2) return;

    const topic = buildCollapsedTopic({
      selectedNodes: selectedTurnNodes.map((node) => ({
        id: node.id,
        title: node.data.title,
        summary: node.data.summary,
        position: node.position,
        turnIndex: node.data.turn?.turnIndex
      }))
    });
    const sourceIds = new Set(topic.hiddenNodeIds);
    const hasRoot = nodes.some((node) => node.id === "conversation-root");

    setHiddenNodeIds((currentIds) => [...new Set([...currentIds, ...topic.hiddenNodeIds])]);
    setNodes((currentNodes) => [
      ...currentNodes
        .filter((node) => !sourceIds.has(node.id))
        .map((node) => ({ ...node, selected: false })),
      {
        id: topic.id,
        type: "turnNode",
        position: topic.position,
        selected: true,
        data: {
          title: topic.title,
          summary: topic.summary,
          isCustomNode: true,
          status: "review",
          tags: topic.tags,
          onUpdate: updateNodeText
        }
      }
    ]);
    setEdges((currentEdges) => {
      const keptEdges = currentEdges.filter(
        (edge) => !sourceIds.has(edge.source) && !sourceIds.has(edge.target)
      );
      if (!hasRoot || hiddenRoot) return keptEdges.map(applyEdgeStyle);
      return [
        ...keptEdges,
        applyEdgeStyle({
          id: `user-conversation-root-${topic.id}`,
          source: "conversation-root",
          target: topic.id,
          label: "topic",
          data: {
            relationship: "references",
            important: true,
            createdBy: "user",
            reason: "Collapsed topic group"
          } satisfies RelationshipEdgeData
        })
      ];
    });
    setSelectedEdgeId(null);
    setSelectedRoot(false);
    onStatus?.(`Collapsed ${topic.hiddenNodeIds.length} turns into a topic`);
  }, [hiddenRoot, nodes, onStatus, selectedTurnNodes, setEdges, setNodes, updateNodeText]);

  const duplicateSelectedNodeAsNote = useCallback(() => {
    const sourceNode = selectedTurnNodes[0];
    if (!sourceNode?.data.turn) return;

    const noteId = `custom-note-${Date.now()}`;
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      {
        id: noteId,
        type: "turnNode",
        position: {
          x: sourceNode.position.x + 340,
          y: sourceNode.position.y + 40
        },
        selected: true,
        data: {
          title: `Note: ${sourceNode.data.title}`.slice(0, 120),
          summary: sourceNode.data.summary,
          isCustomNode: true,
          onUpdate: updateNodeText
        }
      }
    ]);
    setSelectedEdgeId(null);
    setSelectedRoot(false);
    onStatus?.(`Duplicated turn ${sourceNode.data.turn.turnIndex + 1} as note`);
  }, [onStatus, selectedTurnNodes, setNodes, updateNodeText]);

  const splitSelectedNode = useCallback(() => {
    const sourceNode = selectedTurnNodes[0];
    if (!sourceNode) return;
    const paragraphs = sourceNode.data.summary
      .split(/\n{2,}|(?<=。)|(?<=\.)\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const midpoint = Math.max(1, Math.ceil(paragraphs.length / 2));
    const parts =
      paragraphs.length >= 2
        ? [paragraphs.slice(0, midpoint).join(" "), paragraphs.slice(midpoint).join(" ")]
        : [sourceNode.data.summary.slice(0, Math.ceil(sourceNode.data.summary.length / 2)), sourceNode.data.summary.slice(Math.ceil(sourceNode.data.summary.length / 2))];
    const splitIds = [`custom-split-${Date.now()}-a`, `custom-split-${Date.now()}-b`];
    const splitNodes: Node<TurnNodeData>[] = splitIds.map((id, index) => ({
      id,
      type: "turnNode",
      position: {
        x: sourceNode.position.x + (index === 0 ? -170 : 170),
        y: sourceNode.position.y + 230
      },
      selected: true,
      data: {
        title: `${sourceNode.data.title} (${index + 1})`.slice(0, 120),
        summary: parts[index] || sourceNode.data.summary,
        isCustomNode: true,
        status: sourceNode.data.status,
        tags: sourceNode.data.tags,
        onUpdate: updateNodeText
      }
    }));

    setHiddenNodeIds((currentIds) =>
      sourceNode.data.turn ? [...new Set([...currentIds, sourceNode.id])] : currentIds
    );
    setNodes((currentNodes) => [
      ...currentNodes.filter((node) => node.id !== sourceNode.id || (!sourceNode.data.turn && !sourceNode.data.isCustomNode)),
      ...splitNodes
    ]);
    setEdges((currentEdges) =>
      currentEdges
        .filter((edge) => !isAutoEdge(edge))
        .flatMap((edge) => {
          if (edge.source === sourceNode.id) {
            return splitIds.map((id) => applyEdgeStyle({ ...edge, id: `${edge.id}-${id}`, source: id }));
          }
          if (edge.target === sourceNode.id) {
            return splitIds.map((id) => applyEdgeStyle({ ...edge, id: `${edge.id}-${id}`, target: id }));
          }
          return [edge];
        })
    );
    setSelectedEdgeId(null);
    setSelectedRoot(false);
    onStatus?.("Split node into two notes");
  }, [onStatus, selectedTurnNodes, setEdges, setNodes, updateNodeText]);

  const selectAllTurnNodes = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: Boolean(node.data.turn && !node.data.isConversationRoot)
      }))
    );
    setSelectedEdgeId(null);
    setSelectedRoot(false);
    onStatus?.("Selected all turn nodes");
  }, [onStatus, setNodes]);

  const applyBulkStatus = useCallback(
    (status: "open" | "review" | "done") => {
      if (selectedTurnNodes.length === 0) return;
      const selectedIds = new Set(selectedTurnNodes.map((node) => node.id));
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          selectedIds.has(node.id)
            ? {
                ...node,
                data: {
                  ...node.data,
                  status
                }
              }
            : node
        )
      );
      onStatus?.(`Set ${selectedTurnNodes.length} nodes to ${status}`);
    },
    [onStatus, selectedTurnNodes, setNodes]
  );

  const addBulkTag = useCallback(() => {
    const tag = window.prompt("Tag for selected nodes");
    if (!tag?.trim() || selectedTurnNodes.length === 0) return;
    const cleanTag = tag.trim().slice(0, 32);
    const selectedIds = new Set(selectedTurnNodes.map((node) => node.id));
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        selectedIds.has(node.id)
          ? {
              ...node,
              data: {
                ...node.data,
                tags: [...new Set([...(node.data.tags ?? []), cleanTag])]
              }
            }
          : node
      )
    );
    onStatus?.(`Tagged ${selectedTurnNodes.length} nodes`);
  }, [onStatus, selectedTurnNodes, setNodes]);

  const updateSelectedNodeAppearance = useCallback(
    (updates: Pick<Partial<TurnNodeData>, "color" | "collapsed" | "important">) => {
      if (selectedTurnNodes.length === 0) return;
      const selectedIds = new Set(selectedTurnNodes.map((node) => node.id));
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          selectedIds.has(node.id)
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates
                }
              }
            : node
        )
      );
    },
    [selectedTurnNodes, setNodes]
  );

  const toggleSelectedNodeCollapsed = useCallback(() => {
    if (selectedTurnNodes.length === 0) return;
    const shouldCollapse = selectedTurnNodes.some((node) => !node.data.collapsed);
    updateSelectedNodeAppearance({ collapsed: shouldCollapse });
    onStatus?.(shouldCollapse ? t("status.nodesCollapsed") : t("status.nodesExpanded"));
  }, [onStatus, selectedTurnNodes, t, updateSelectedNodeAppearance]);

  const toggleSelectedNodeImportant = useCallback(() => {
    if (selectedTurnNodes.length === 0) return;
    const important = selectedTurnNodes.some((node) => !node.data.important);
    updateSelectedNodeAppearance({ important });
    onStatus?.(important ? t("status.nodesImportant") : t("status.nodesNormal"));
  }, [onStatus, selectedTurnNodes, t, updateSelectedNodeAppearance]);

  const convertSelectedEdgeToNote = useCallback(() => {
    if (!selectedEdge) return;
    const sourceTitle = shortNodeTitle(nodes, selectedEdge.source);
    const targetTitle = shortNodeTitle(nodes, selectedEdge.target);
    const data = selectedEdge.data as RelationshipEdgeData | undefined;
    const noteId = `custom-edge-note-${Date.now()}`;
    const sourceNode = nodes.find((node) => node.id === selectedEdge.source);
    const targetNode = nodes.find((node) => node.id === selectedEdge.target);
    const position = {
      x: ((sourceNode?.position.x ?? 0) + (targetNode?.position.x ?? 340)) / 2,
      y: ((sourceNode?.position.y ?? 0) + (targetNode?.position.y ?? 160)) / 2 + 120
    };

    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      {
        id: noteId,
        type: "turnNode",
        position,
        selected: true,
        data: {
          title: `Link note: ${sourceTitle} -> ${targetTitle}`.slice(0, 120),
          summary: [
            `Relationship: ${data?.relationship ?? "related"}`,
            selectedEdge.label ? `Label: ${String(selectedEdge.label)}` : "",
            data?.reason ? `Reason: ${data.reason}` : ""
          ]
            .filter(Boolean)
            .join("\n"),
          isCustomNode: true,
          tags: ["link-note"],
          onUpdate: updateNodeText
        }
      }
    ]);
    setEdges((currentEdges) => [
      ...currentEdges.filter((edge) => edge.id !== selectedEdge.id),
      applyEdgeStyle({
        id: `user-${selectedEdge.source}-${noteId}-${Date.now()}`,
        source: selectedEdge.source,
        target: noteId,
        label: "note",
        data: { relationship: "references" } satisfies RelationshipEdgeData
      }),
      applyEdgeStyle({
        id: `user-${noteId}-${selectedEdge.target}-${Date.now()}`,
        source: noteId,
        target: selectedEdge.target,
        label: "note",
        data: { relationship: data?.relationship ?? "related", important: data?.important } satisfies RelationshipEdgeData
      })
    ]);
    setSelectedEdgeId(null);
    onStatus?.("Converted link into note node");
  }, [nodes, onStatus, selectedEdge, setEdges, setNodes, updateNodeText]);

  const suggestLinks = useCallback(async () => {
    const taskId = `suggest-links-${conversationId}`;
    try {
      setSuggestingLinks(true);
      reportApiTask({
        id: taskId,
        kind: "suggest-links",
        status: "running",
        message: t("task.suggestLinks"),
        progress: 15
      });
      const suggestedEdges = (await suggestSemanticEdges(nodes)).map(applyEdgeStyle);
      const existingPairs = new Set([
        ...edges.map((edge) => `${edge.source}:${edge.target}`),
        ...pendingSuggestedEdges.map((edge) => `${edge.source}:${edge.target}`)
      ]);
      const uniqueSuggestions = suggestedEdges.filter(
        (edge) => !existingPairs.has(`${edge.source}:${edge.target}`)
      );
      setPendingSuggestedEdges((currentEdges) => [...currentEdges, ...uniqueSuggestions]);
      reportApiTask({
        id: taskId,
        kind: "suggest-links",
        status: "success",
        message: t("task.suggestLinksDone", { count: uniqueSuggestions.length }),
        progress: 100
      });
    } catch (error) {
      reportApiTask({
        id: taskId,
        kind: "suggest-links",
        status: "error",
        message: error instanceof Error ? error.message : t("task.suggestLinksFailed"),
        progress: 100
      });
    } finally {
      setSuggestingLinks(false);
    }
  }, [conversationId, edges, nodes, pendingSuggestedEdges, reportApiTask, t]);

  const updatePendingSuggestion = useCallback(
    (edgeId: string, updates: Partial<RelationshipEdgeData> & { label?: string }) => {
      setPendingSuggestedEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const currentData = (edge.data as RelationshipEdgeData | undefined) ?? {
            relationship: "related",
            important: false
          };

          return applyEdgeStyle({
            ...edge,
            label: updates.label ?? edge.label,
            data: {
              ...currentData,
              relationship: updates.relationship ?? currentData.relationship,
              important: updates.important ?? currentData.important
            } satisfies RelationshipEdgeData
          });
        })
      );
    },
    []
  );

  const rejectPendingSuggestion = useCallback((edgeId: string) => {
    setPendingSuggestedEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
  }, []);

  const acceptPendingSuggestion = useCallback(
    (edgeId: string) => {
      const suggestion = pendingSuggestedEdges.find((edge) => edge.id === edgeId);
      if (!suggestion) return;

      const edgeToAdd = applyEdgeStyle({
        ...suggestion,
        id: `user-${suggestion.id}`,
        data: {
          ...(suggestion.data as RelationshipEdgeData | undefined),
          relationship:
            (suggestion.data as RelationshipEdgeData | undefined)?.relationship ?? "related",
          createdBy: "ai"
        } satisfies RelationshipEdgeData
      });

      setEdges((currentEdges) => {
        const exists = currentEdges.some(
          (edge) => edge.source === edgeToAdd.source && edge.target === edgeToAdd.target
        );
        return exists ? currentEdges : [...currentEdges, edgeToAdd];
      });
      setPendingSuggestedEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
    },
    [pendingSuggestedEdges, setEdges]
  );

  const acceptAllPendingSuggestions = useCallback(() => {
    pendingSuggestedEdges.forEach((edge) => acceptPendingSuggestion(edge.id));
  }, [acceptPendingSuggestion, pendingSuggestedEdges]);

  const clearPendingSuggestions = useCallback(() => {
    setPendingSuggestedEdges([]);
  }, []);

  const exportJson = useCallback(() => {
    const filename = `${safeFilePart(conversationTitle)}.turnmap.json`;
    downloadTextFile(
      filename,
      serializeGraph(
        conversationId,
        conversationTitle,
        turns,
        nodes,
        edges,
        layoutMode,
        hiddenRoot,
        hiddenAutoEdgeIds,
        hiddenNodeIds
      ),
      "application/json"
    );
    onStatus?.(`Exported ${filename}`);
  }, [
    conversationId,
    conversationTitle,
    edges,
    hiddenAutoEdgeIds,
    hiddenNodeIds,
    hiddenRoot,
    layoutMode,
    nodes,
    onStatus,
    turns
  ]);

  const markdown = useMemo(
    () => graphToMarkdown(conversationTitle, turns, nodes, edges),
    [conversationTitle, edges, nodes, turns]
  );

  const exportMarkdown = useCallback(() => {
    const filename = `${safeFilePart(conversationTitle)}.turnmap.md`;
    downloadTextFile(filename, markdown, "text/markdown;charset=utf-8");
    onStatus?.(`Exported ${filename}`);
  }, [conversationTitle, markdown, onStatus]);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      onStatus?.("Markdown copied to clipboard");
    } catch {
      onStatus?.("Clipboard copy failed. Try Markdown export instead.");
    }
  }, [markdown, onStatus]);

  const exportObsidianCanvas = useCallback(() => {
    const filename = `${safeFilePart(conversationTitle)}.canvas`;
    downloadTextFile(
      filename,
      graphToObsidianCanvas(conversationTitle, nodes, edges),
      "application/json"
    );
    onStatus?.(`Exported ${filename}`);
  }, [conversationTitle, edges, nodes, onStatus]);

  const exportOpml = useCallback(() => {
    const filename = `${safeFilePart(conversationTitle)}.opml`;
    downloadTextFile(
      filename,
      graphToOpml(conversationTitle, nodesForAdvancedExport(nodes), edgesForAdvancedExport(edges)),
      "text/x-opml;charset=utf-8"
    );
    onStatus?.(t("file.exported", { filename }));
  }, [conversationTitle, edges, nodes, onStatus, t]);

  const exportObsidianVaultMarkdown = useCallback(() => {
    const filename = `${safeFilePart(conversationTitle)}.obsidian-vault.zip`;
    const files = graphToObsidianVaultMarkdownFiles(
      conversationTitle,
      nodesForAdvancedExport(nodes),
      edgesForAdvancedExport(edges)
    );
    downloadBlobFile(filename, createZipFromTextFiles(files));
    onStatus?.(t("file.exported", { filename }));
  }, [conversationTitle, edges, nodes, onStatus, t]);

  const exportSvg = useCallback(() => {
    const filename = `${safeFilePart(conversationTitle)}.turnmap.svg`;
    downloadTextFile(filename, graphToSvg(conversationTitle, nodes, edges), "image/svg+xml;charset=utf-8");
    onStatus?.(`Exported ${filename}`);
  }, [conversationTitle, edges, nodes, onStatus]);

  const exportPng = useCallback(async () => {
    const filename = `${safeFilePart(conversationTitle)}.turnmap.png`;
    try {
      const pngBlob = await svgToPngBlob(graphToSvg(conversationTitle, nodes, edges));
      downloadBlobFile(filename, pngBlob);
      onStatus?.(`Exported ${filename}`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "PNG export failed.");
    }
  }, [conversationTitle, edges, nodes, onStatus]);

  const resetCurrentMap = useCallback(async () => {
    const confirmed = window.confirm("Reset this TurnMap? This clears saved positions, edits, notes, hidden nodes, and links for the current conversation.");
    if (!confirmed) return;

    await resetStoredGraph(conversationId);
    setHiddenRoot(false);
    setHiddenAutoEdgeIds([]);
    setHiddenNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedRoot(false);
    setPendingSuggestedEdges([]);
    const resetNodes = nodesFromTurns(
      conversationTitle,
      turns,
      {},
      {},
      updateNodeText,
      summarizeNode,
      jumpToNodeTurn,
      summarizingNodeIds,
      [],
      [],
      layoutMode,
      false
    );
    setNodes(resetNodes);
    setEdges(autoEdgesFromTurns(turns, layoutMode, false, []));
    onStatus?.("Current map reset");
  }, [
    conversationId,
    conversationTitle,
    layoutMode,
    onStatus,
    setEdges,
    setNodes,
    summarizeNode,
    jumpToNodeTurn,
    summarizingNodeIds,
    turns,
    updateNodeText
  ]);

  const undoGraphChange = useCallback(() => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    const current = currentSnapshot();
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-29), cloneSnapshot(current)]);
    restoreSnapshot(previous);
    onStatus?.("Undo");
  }, [currentSnapshot, onStatus, restoreSnapshot, undoStack]);

  const redoGraphChange = useCallback(() => {
    const next = redoStack.at(-1);
    if (!next) return;
    const current = currentSnapshot();
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-29), cloneSnapshot(current)]);
    restoreSnapshot(next);
    onStatus?.("Redo");
  }, [currentSnapshot, onStatus, redoStack, restoreSnapshot]);

  const importJson = useCallback(
    async (event: { currentTarget: HTMLInputElement }) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;

      try {
        const graph = parseImportedGraph(await file.text());
        const nextLayout = isLayoutMode(graph.layout?.mode) ? graph.layout.mode : layoutMode;
        const nextHiddenRoot = Boolean(graph.layout?.hiddenRoot);
        const nextHiddenAutoEdgeIds = Array.isArray(graph.layout?.hiddenAutoEdgeIds)
          ? graph.layout.hiddenAutoEdgeIds.filter((id): id is string => typeof id === "string")
          : [];
        const nextHiddenNodeIds = Array.isArray(graph.layout?.hiddenNodeIds)
          ? graph.layout.hiddenNodeIds.filter((id): id is string => typeof id === "string")
          : [];
        const positions = positionsFromImportedGraph(graph);
        const overrides = overridesFromImportedGraph(graph);
        const customNodes = customNodesFromImportedGraph(graph);
        const nextNodes = nodesFromTurns(
          conversationTitle,
          turns,
          positions,
          overrides,
          updateNodeText,
          summarizeNode,
          jumpToNodeTurn,
          summarizingNodeIds,
          nextHiddenNodeIds,
          customNodes,
          nextLayout,
          nextHiddenRoot
        );
        const nodeIds = new Set(nextNodes.map((node) => node.id));
        const importedUserEdges: Edge[] = (graph.edges ?? [])
          .filter((edge) => !edge.isAuto)
          .filter(
            (edge) =>
              typeof edge.source === "string" &&
              typeof edge.target === "string" &&
              nodeIds.has(edge.source) &&
              nodeIds.has(edge.target)
          )
          .map((edge, index) =>
            applyEdgeStyle({
              id: typeof edge.id === "string" ? edge.id : `imported-${index}-${Date.now()}`,
              source: edge.source!,
              target: edge.target!,
              label: typeof edge.label === "string" ? edge.label : undefined,
              data: {
                relationship: isRelationship(edge.relationship) ? edge.relationship : "related",
                important: Boolean(edge.important),
                confidence: typeof edge.confidence === "number" ? edge.confidence : undefined,
                reason: typeof edge.reason === "string" ? edge.reason : undefined,
                createdBy: edge.createdBy === "ai" || edge.createdBy === "user" ? edge.createdBy : undefined
              } satisfies RelationshipEdgeData
            })
          );

        setLayoutMode(nextLayout);
        setHiddenRoot(nextHiddenRoot);
        setHiddenAutoEdgeIds(nextHiddenAutoEdgeIds);
        setHiddenNodeIds(nextHiddenNodeIds);
        setSelectedEdgeId(null);
        setSelectedRoot(false);
        setNodes(nextNodes);
        setEdges([
          ...autoEdgesFromTurns(turns, nextLayout, nextHiddenRoot, nextHiddenAutoEdgeIds),
          ...importedUserEdges
        ]);
        void saveStoredGraph(
          conversationId,
          nextNodes,
          importedUserEdges,
          nextLayout,
          nextHiddenRoot,
          nextHiddenAutoEdgeIds,
          nextHiddenNodeIds
        );
        onStatus?.(`Imported TurnMap JSON: ${nextNodes.length} nodes, ${importedUserEdges.length} user links`);
      } catch (error) {
        onStatus?.(error instanceof Error ? error.message : "TurnMap JSON import failed.");
      }
    },
    [
      conversationId,
      conversationTitle,
      layoutMode,
      onStatus,
      setEdges,
      setNodes,
      summarizeNode,
      jumpToNodeTurn,
      summarizingNodeIds,
      turns,
      updateNodeText
    ]
  );

  const applyLayout = useCallback(
    (nextLayoutMode: LayoutMode, saveAsDefault = true) => {
      setLayoutMode(nextLayoutMode);
      const layoutPositions = createLayoutPositions(turns, nextLayoutMode);
      setNodes((currentNodes) =>
        nodesFromTurns(
          conversationTitle,
          turns,
          layoutPositions,
          nodeOverridesFromNodes(currentNodes),
          updateNodeText,
          summarizeNode,
          jumpToNodeTurn,
          summarizingNodeIds,
          hiddenNodeIds,
          customRecordsFromNodes(currentNodes),
          nextLayoutMode,
          hiddenRoot
        )
      );
      setEdges((currentEdges) => {
        const nodeIds = new Set([
          ...(nextLayoutMode === "list" || hiddenRoot ? [] : ["conversation-root"]),
          ...turns.filter((turn) => !hiddenNodeIds.includes(turn.id)).map((turn) => turn.id),
          ...nodes.filter((node) => node.id !== "conversation-root" && !node.data.turn).map((node) => node.id)
        ]);
        const userEdges = currentEdges
          .filter((edge) => !isAutoEdge(edge))
          .filter((edge) => edgeHasExistingNodes(edge, nodeIds));

        return [
          ...autoEdgesFromTurns(turns, nextLayoutMode, hiddenRoot, hiddenAutoEdgeIds),
          ...userEdges.map(applyEdgeStyle)
        ];
      });
      if (saveAsDefault) {
        void saveDefaultLayout(nextLayoutMode);
      }
      onStatus?.(`Layout set to ${LAYOUT_OPTIONS.find((option) => option.value === nextLayoutMode)?.label}`);
    },
    [
      conversationTitle,
      hiddenAutoEdgeIds,
      hiddenRoot,
      hiddenNodeIds,
      nodes,
      onStatus,
      setEdges,
      setNodes,
      summarizeNode,
      jumpToNodeTurn,
      summarizingNodeIds,
      turns,
      updateNodeText
    ]
  );

  if (turns.length === 0) {
    return (
      <section className="empty-state">
        <h2>No map yet</h2>
        <p>Open a supported AI conversation with at least one complete answer.</p>
      </section>
    );
  }

  return (
    <section className="canvas-shell">
      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeClick={onNodeClick}
        multiSelectionKeyCode={["Control", "Meta", "Shift"]}
        onPaneClick={() => {
          setSelectedEdgeId(null);
          setSelectedRoot(false);
          setHighlightedEndpointIds([]);
          setFileMenuOpen(false);
        }}
        onInit={(instance) => {
          flowInstance.current = instance;
        }}
        fitView
      >
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
      <div className="graph-toolbar">
        <label className="layout-picker">
          <Icon name="layout" />
          <span>{t("toolbar.layout")}</span>
          <select
            value={layoutMode}
            onChange={(event) => applyLayout(event.currentTarget.value as LayoutMode)}
          >
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(LAYOUT_LABEL_KEYS[option.value])}
              </option>
            ))}
          </select>
        </label>
        <button className="button-with-icon" type="button" onClick={suggestLinks} disabled={suggestingLinks}>
          <Icon name="sparkles" />
          <span>{suggestingLinks ? t("toolbar.suggesting") : t("toolbar.suggestLinks")}</span>
        </button>
        <button className="button-with-icon" type="button" onClick={() => setSearchOpen((open) => !open)}>
          <Icon name="search" />
          <span>{t("toolbar.search")}</span>
        </button>
        <button className="button-with-icon" type="button" onClick={undoGraphChange} disabled={undoStack.length === 0}>
          <Icon name="undo" />
          <span>{t("toolbar.undo")}</span>
        </button>
        <button className="button-with-icon" type="button" onClick={redoGraphChange} disabled={redoStack.length === 0}>
          <Icon name="redo" />
          <span>{t("toolbar.redo")}</span>
        </button>
        <button
          className="button-with-icon"
          type="button"
          onClick={summarizeAllNodes}
          disabled={summarizingNodeIds.size > 0}
        >
          <Icon name="brain" />
          <span>{summarizingNodeIds.size > 0 ? t("toolbar.summarizing") : t("toolbar.summarizeAll")}</span>
        </button>
        <div className="file-menu">
          <button className="button-with-icon" type="button" onClick={() => setFileMenuOpen((open) => !open)}>
            <Icon name="files" />
            <span>{t("toolbar.files")}</span>
            <Icon name="chevronDown" size={14} />
          </button>
          {fileMenuOpen ? (
            <div className="file-menu__panel">
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  importInputRef.current?.click();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="upload" />
                <span>{t("file.importJson")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  exportJson();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="download" />
                <span>{t("file.exportJson")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  exportObsidianCanvas();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="map" />
                <span>{t("file.exportCanvas")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  exportOpml();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="download" />
                <span>{t("file.exportOpml")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  exportObsidianVaultMarkdown();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="download" />
                <span>{t("file.exportObsidianVault")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  exportSvg();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="external" />
                <span>{t("file.exportSvg")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  void exportPng();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="image" />
                <span>{t("file.exportPng")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  exportMarkdown();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="download" />
                <span>{t("file.exportMd")}</span>
              </button>
              <button
                className="button-with-icon"
                type="button"
                onClick={() => {
                  void copyMarkdown();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="copy" />
                <span>{t("file.copyMd")}</span>
              </button>
              <button
                type="button"
                className="button-with-icon file-menu__danger"
                onClick={() => {
                  void resetCurrentMap();
                  setFileMenuOpen(false);
                }}
              >
                <Icon name="trash" />
                <span>{t("file.resetMap")}</span>
              </button>
            </div>
          ) : null}
          <input
            ref={importInputRef}
            className="file-input"
            type="file"
            accept=".json,application/json"
            onChange={importJson}
          />
        </div>
      </div>
      {searchOpen ? (
        <aside className="search-panel">
          <div className="edge-panel__header">
            <strong>{t("search.title")}</strong>
            <button type="button" onClick={() => setSearchOpen(false)}>
              {t("search.close")}
            </button>
          </div>
          <input
            value={searchQuery}
            placeholder={t("search.placeholder")}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            autoFocus
          />
          <div className="search-results">
            {searchQuery.trim() && searchResults.length === 0 ? (
              <p className="panel-note">{t("search.empty")}</p>
            ) : null}
            {searchResults.map((node) => (
              <button type="button" key={node.id} onClick={() => focusNode(node.id)}>
                <strong>{node.data.title}</strong>
                <span>{node.data.summary}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
      {pendingSuggestedEdges.length > 0 ? (
        <aside className="suggestion-panel">
          <div className="suggestion-panel__header">
            <strong>{t("suggestions.title")}</strong>
            <div>
              <button type="button" onClick={acceptAllPendingSuggestions}>
                {t("suggestions.acceptAll")}
              </button>
              <button type="button" onClick={clearPendingSuggestions}>
                {t("suggestions.clear")}
              </button>
            </div>
          </div>
          <div className="suggestion-list">
            {pendingSuggestedEdges.map((edge) => {
              const data = (edge.data as RelationshipEdgeData | undefined) ?? {
                relationship: "related"
              };
              return (
                <article className="suggestion-item" key={edge.id}>
                  <div className="suggestion-item__nodes">
                    <span>{shortNodeTitle(nodes, edge.source)}</span>
                    <span>{"->"}</span>
                    <span>{shortNodeTitle(nodes, edge.target)}</span>
                  </div>
                  <div className="suggestion-item__controls">
                    <RelationshipColorPicker
                      value={data.relationship}
                      onChange={(relationship) =>
                        updatePendingSuggestion(edge.id, {
                          relationship
                        })
                      }
                    />
                    <input
                      value={String(edge.label ?? "")}
                      onChange={(event) =>
                        updatePendingSuggestion(edge.id, { label: event.currentTarget.value })
                      }
                    />
                  </div>
                  <label className="suggestion-item__check">
                    <input
                      type="checkbox"
                      checked={Boolean(data.important)}
                      onChange={(event) =>
                        updatePendingSuggestion(edge.id, { important: event.currentTarget.checked })
                      }
                    />
                    {t("action.important")}
                  </label>
                  {data.reason || typeof data.confidence === "number" ? (
                    <p>
                      {data.reason}
                      {typeof data.confidence === "number"
                        ? ` ${t("label.confidence")} ${Math.round(data.confidence * 100)}%`
                        : ""}
                    </p>
                  ) : null}
                  <div className="suggestion-item__actions">
                    <button type="button" onClick={() => acceptPendingSuggestion(edge.id)}>
                      {t("suggestions.accept")}
                    </button>
                    <button type="button" onClick={() => rejectPendingSuggestion(edge.id)}>
                      {t("suggestions.reject")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      ) : null}
      {selectedTurnNodes.length >= 2 ? (
        <aside className="edge-panel node-panel">
          <div className="edge-panel__header">
            <strong>{t("panel.nodesSelected").replace("{count}", String(selectedTurnNodes.length))}</strong>
          </div>
          <p className="panel-note">{t("panel.organizeSelected")}</p>
          <div className="node-panel__actions">
            <button type="button" onClick={mergeSelectedNodes}>
              {t("action.mergeNodes")}
            </button>
            <button type="button" onClick={collapseSelectedAsTopic}>
              {t("action.collapseTopic")}
            </button>
            <button type="button" onClick={addBulkTag}>
              {t("action.addTag")}
            </button>
            <button type="button" onClick={toggleSelectedNodeCollapsed}>
              {selectedTurnNodes.some((node) => !node.data.collapsed) ? t("action.collapseNode") : t("action.expandNode")}
            </button>
            <button type="button" onClick={toggleSelectedNodeImportant}>
              {t("action.important")}
            </button>
          </div>
          <div className="color-picker" aria-label={t("action.colorNode")}>
            <span className="color-picker__title">{t("action.colorNode")}</span>
            <div className="color-picker__row">
              {NODE_COLOR_OPTIONS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="color-swatch-button"
                  style={{ backgroundColor: color.value }}
                  title={t(`color.${color.name}` as I18nKey)}
                  onClick={() => updateSelectedNodeAppearance({ color: color.name })}
                />
              ))}
            </div>
            <button type="button" onClick={() => updateSelectedNodeAppearance({ color: undefined })}>
              {t("color.theme")}
            </button>
          </div>
        </aside>
      ) : null}
      {selectedTurnNodes.length === 1 ? (
        <aside className="edge-panel node-panel">
          <div className="edge-panel__header">
            <strong>{t("panel.nodeActions")}</strong>
          </div>
          <p className="panel-note">{t("panel.nodeHint")}</p>
          <div className="node-panel__actions">
            <button type="button" onClick={selectAllTurnNodes}>
              {t("action.selectAllTurns")}
            </button>
            <button type="button" onClick={addBulkTag}>
              {t("action.addTag")}
            </button>
            <button type="button" onClick={toggleSelectedNodeCollapsed}>
              {selectedTurnNodes[0]?.data.collapsed ? t("action.expandNode") : t("action.collapseNode")}
            </button>
            <button type="button" onClick={toggleSelectedNodeImportant}>
              {t("action.important")}
            </button>
          </div>
          <div className="color-picker" aria-label={t("action.colorNode")}>
            <span className="color-picker__title">{t("action.colorNode")}</span>
            <div className="color-picker__row">
              {NODE_COLOR_OPTIONS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="color-swatch-button"
                  style={{ backgroundColor: color.value }}
                  title={t(`color.${color.name}` as I18nKey)}
                  onClick={() => updateSelectedNodeAppearance({ color: color.name })}
                />
              ))}
            </div>
            <button type="button" onClick={() => updateSelectedNodeAppearance({ color: undefined })}>
              {t("color.theme")}
            </button>
          </div>
        </aside>
      ) : null}
      {selectedEdge ? (
        <aside className="edge-panel">
          <div className="edge-panel__header">
            <strong>{t("panel.linkTitle")}</strong>
            <button type="button" onClick={() => setSelectedEdgeId(null)}>
              {t("action.close")}
            </button>
          </div>
          <div>
            <RelationshipColorPicker
              value={
                (selectedEdge.data as RelationshipEdgeData | undefined)?.relationship ??
                (isAutoEdge(selectedEdge) ? "references" : "related")
              }
              onChange={(relationship) => updateSelectedEdge({ relationship })}
            />
          </div>
          <label>
            {t("field.label")}
            <input
              value={String(selectedEdge.label ?? "")}
              onChange={(event) => updateSelectedEdge({ label: event.currentTarget.value })}
            />
          </label>
          <label className="edge-panel__check">
            <input
              type="checkbox"
              checked={Boolean((selectedEdge.data as RelationshipEdgeData | undefined)?.important)}
              onChange={(event) => updateSelectedEdge({ important: event.currentTarget.checked })}
            />
            {t("action.important")}
          </label>
          {((selectedEdge.data as RelationshipEdgeData | undefined)?.reason ||
            typeof (selectedEdge.data as RelationshipEdgeData | undefined)?.confidence === "number") ? (
            <p className="panel-note">
              {(selectedEdge.data as RelationshipEdgeData | undefined)?.reason}
              {typeof (selectedEdge.data as RelationshipEdgeData | undefined)?.confidence === "number"
                ? ` ${t("label.confidence")} ${Math.round(
                    ((selectedEdge.data as RelationshipEdgeData | undefined)?.confidence ?? 0) * 100
                  )}%`
                : ""}
            </p>
          ) : null}
          <button type="button" className="danger-button" onClick={deleteSelectedEdge}>
            {t("action.deleteLink")}
          </button>
        </aside>
      ) : null}
      {selectedRoot ? (
        <aside className="edge-panel">
          <div className="edge-panel__header">
            <strong>{t("panel.headerTitle")}</strong>
            <button type="button" onClick={() => setSelectedRoot(false)}>
              {t("action.close")}
            </button>
          </div>
          <p className="panel-note">{t("panel.headerHint")}</p>
          <button type="button" className="danger-button" onClick={deleteRoot}>
            {t("action.deleteHeader")}
          </button>
        </aside>
      ) : null}
    </section>
  );
}
