import type { FetchConversationApiResult, Turn } from "../shared/types";
import { getBestTurnsFromRoots } from "./structured-extractor";

export type ConversationApiExtractionResult = {
  turns: Turn[];
  source: "conversation-api";
};

function getConversationIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/c\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function fetchFromContentScript(conversationId: string): Promise<unknown | null> {
  try {
    const response = await fetch(`/backend-api/conversation/${conversationId}`, {
      credentials: "include",
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchFromBackground(conversationId: string): Promise<unknown | null> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "TURNMAP_FETCH_CONVERSATION_API",
      conversationId
    })) as FetchConversationApiResult;

    return response.ok ? response.root ?? null : null;
  } catch {
    return null;
  }
}

export async function extractConversationApiTurns(): Promise<ConversationApiExtractionResult | null> {
  const conversationId = getConversationIdFromUrl();
  if (!conversationId) return null;

  const root = (await fetchFromBackground(conversationId)) ?? (await fetchFromContentScript(conversationId));
  if (!root) return null;

  const turns = getBestTurnsFromRoots([root]);
  if (turns.length === 0) return null;

  return {
    turns,
    source: "conversation-api"
  };
}
