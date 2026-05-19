export type ApiTaskKind = "summarize" | "suggest-links" | "translate" | "test-connection";
export type ApiTaskStatus = "running" | "success" | "error";

export type ApiTaskLogEntry = {
  id: string;
  kind: ApiTaskKind;
  status: ApiTaskStatus;
  message: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiTaskLogDraft = Omit<ApiTaskLogEntry, "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
};

export type ApiTaskLogExport = {
  version: 1;
  exportedAt: string;
  entries: ApiTaskLogEntry[];
};

export const TASK_LOG_STORAGE_KEY = "turnmap.apiTaskLog";
const MAX_LOG_ENTRIES = 80;

function nowIso(): string {
  return new Date().toISOString();
}

export function sanitizeTaskLogEntry(entry: ApiTaskLogDraft): ApiTaskLogEntry {
  const timestamp = nowIso();
  return {
    id: entry.id.slice(0, 120),
    kind: entry.kind,
    status: entry.status,
    message: entry.message.replace(/\s+/g, " ").trim().slice(0, 200),
    progress: Math.max(0, Math.min(100, Math.round(entry.progress))),
    createdAt: entry.createdAt ?? timestamp,
    updatedAt: entry.updatedAt ?? timestamp
  };
}

export async function loadApiTaskLog(): Promise<ApiTaskLogEntry[]> {
  const result = await chrome.storage.local.get(TASK_LOG_STORAGE_KEY);
  const entries = result[TASK_LOG_STORAGE_KEY];
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry): entry is ApiTaskLogEntry => Boolean(entry && typeof entry === "object"))
    .map((entry) => sanitizeTaskLogEntry(entry))
    .slice(0, MAX_LOG_ENTRIES);
}

export async function recordApiTaskLog(entry: ApiTaskLogDraft): Promise<ApiTaskLogEntry[]> {
  const nextEntry = sanitizeTaskLogEntry(entry);
  const current = await loadApiTaskLog();
  const withoutSameId = current.filter((item) => item.id !== nextEntry.id);
  const nextLog = [nextEntry, ...withoutSameId].slice(0, MAX_LOG_ENTRIES);
  await chrome.storage.local.set({ [TASK_LOG_STORAGE_KEY]: nextLog });
  return nextLog;
}

export function buildApiTaskLogExport(entries: ApiTaskLogEntry[]): ApiTaskLogExport {
  return {
    version: 1,
    exportedAt: nowIso(),
    entries: entries.map((entry) => sanitizeTaskLogEntry(entry))
  };
}
