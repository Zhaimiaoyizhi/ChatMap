export type SourceAnchor = {
  turnIndex: number;
  userMessageId?: string;
  assistantMessageId?: string;
  userAttachmentNames?: string[];
  userHash: string;
  assistantHash: string;
  userPreview: string;
  assistantPreview: string;
};

export type Turn = {
  id: string;
  turnIndex: number;
  userText: string;
  assistantText: string;
  sourceAnchor: SourceAnchor;
  extractedAt: number;
};

export type ConversationInfo = {
  id: string;
  title: string;
};

export type ConversationSite = {
  id: string;
  displayName: string;
};

export type ExtractedTurnsMessage = {
  type: "TURNMAP_TURNS_UPDATED";
  turns: Turn[];
  conversationTitle: string;
  conversationId: string;
  site?: ConversationSite;
  harvestMeta?: {
    attempted: boolean;
    source: "conversation-api" | "structured" | "web-storage" | "indexeddb" | "dom" | "deep-scan";
    scrollContainer: string;
    scrollHeight: number;
    clientHeight: number;
    scannedSteps: number;
    diagnostics?: {
      selectorBlocks?: number;
      selectorTurns?: number;
      fallbackSelectorCandidates?: number;
      fallbackTextCandidates?: number;
      fallbackBlocks?: number;
      fallbackTurns?: number;
    };
  };
};

export type RequestTurnsMessage = {
  type: "TURNMAP_REQUEST_TURNS";
  harvest?: boolean;
  ensureFull?: boolean;
};

export type JumpToTurnMessage = {
  type: "TURNMAP_JUMP_TO_TURN";
  anchor: SourceAnchor;
};

export type SetFloatingPanelMessage = {
  type: "TURNMAP_SET_FLOATING_PANEL";
  enabled: boolean;
};

export type OpenSidePanelMessage = {
  type: "TURNMAP_OPEN_SIDE_PANEL";
};

export type OpenSettingsMessage = {
  type: "TURNMAP_OPEN_SETTINGS";
};

export type JumpToTurnResult = {
  ok: boolean;
  reason?: string;
};

export type FetchConversationApiMessage = {
  type: "TURNMAP_FETCH_CONVERSATION_API";
  conversationId: string;
};

export type FetchConversationApiResult = {
  ok: boolean;
  root?: unknown;
  status?: number;
  reason?: string;
};

export type TurnMapMessage =
  | ExtractedTurnsMessage
  | RequestTurnsMessage
  | JumpToTurnMessage
  | SetFloatingPanelMessage
  | OpenSidePanelMessage
  | OpenSettingsMessage
  | FetchConversationApiMessage;
