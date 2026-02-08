import { fetchAIResponse } from "@/lib/functions";
import { shouldUsePluelyAPI } from "@/lib/functions/pluely.api";
import {
  LiveSummaryActionItem,
  LiveSummaryData,
  TYPE_PROVIDER,
} from "@/types";

type MeetingSource = "audio" | "ocr" | "user";

export type MeetingAiConfig = {
  provider: TYPE_PROVIDER | undefined;
  selectedProvider: {
    provider: string;
    variables: Record<string, string>;
  };
};

export type MeetingSummarizerOptions = {
  conversationId: string;
  getAiConfig: () => MeetingAiConfig;
  initialSummary?: LiveSummaryData | null;
  onSummaryUpdated?: (summary: LiveSummaryData, updatedAt: number) => void;
  onError?: (error: Error) => void;
};

const UPDATE_INTERVAL_MS = 15000;
const MIN_UPDATE_INTERVAL_MS = 10000;
const POLL_INTERVAL_MS = 5000;
const CHAR_THRESHOLD = 1200;
const MAX_DELTA_CHARS = 5000;

const SUMMARY_MAX = 6;
const DECISIONS_MAX = 10;
const ACTION_ITEMS_MAX = 15;

const DEFAULT_SUMMARY: LiveSummaryData = {
  summary: [],
  decisions: [],
  actionItems: [],
};

const MEETING_SYSTEM_PROMPT = `You are a meeting summarization engine.
Maintain a LIVE rolling summary with three sections:
1) Rolling Summary (2–6 bullet points)
2) Decisions (bullet list)
3) Action Items (bullet list with owner + due if mentioned)

You will be given the previous summary JSON and new content deltas.
Merge updates into the existing summary: update, append, and deduplicate.
Return strictly valid JSON with this schema and no extra text:
{
  "summary": ["..."],
  "decisions": ["..."],
  "actionItems": [
    {"text":"...", "owner": "...?", "due":"...?", "status":"open"}
  ]
}`;

const JSON_REPAIR_PROMPT = `You are a JSON repair tool.
Return ONLY valid JSON matching this schema:
{
  "summary": ["..."],
  "decisions": ["..."],
  "actionItems": [
    {"text":"...", "owner": "...?", "due":"...?", "status":"open"}
  ]
}
Do not include code fences or commentary.`;

type MeetingSession = {
  conversationId: string;
  getAiConfig: () => MeetingAiConfig;
  summary: LiveSummaryData;
  deltaBuffer: string;
  lastUpdateAt: number;
  lastAttemptAt: number;
  onSummaryUpdated?: (summary: LiveSummaryData, updatedAt: number) => void;
  onError?: (error: Error) => void;
};

let session: MeetingSession | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isUpdating = false;

export function createEmptySummary(): LiveSummaryData {
  return JSON.parse(JSON.stringify(DEFAULT_SUMMARY)) as LiveSummaryData;
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeList(items: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(item.trim());
  }
  return deduped;
}

export function dedupeActionItems(items: LiveSummaryActionItem[]): LiveSummaryActionItem[] {
  const seen = new Set<string>();
  const deduped: LiveSummaryActionItem[] = [];
  for (const item of items) {
    const normalized = normalizeText(item.text || "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(item);
  }
  return deduped;
}

const clipList = <T,>(items: T[], max: number): T[] => {
  if (items.length <= max) return items;
  return items.slice(items.length - max);
};

const sanitizeSummary = (summary: LiveSummaryData): LiveSummaryData => {
  const normalizedSummary: LiveSummaryData = {
    summary: Array.isArray(summary.summary)
      ? summary.summary.filter(Boolean).map((item) => String(item).trim())
      : [],
    decisions: Array.isArray(summary.decisions)
      ? summary.decisions.filter(Boolean).map((item) => String(item).trim())
      : [],
    actionItems: Array.isArray(summary.actionItems)
      ? summary.actionItems
          .filter(Boolean)
          .map((item) => {
            const status: LiveSummaryActionItem["status"] =
              item?.status === "done" ? "done" : "open";
            return {
              text: String(item?.text || "").trim(),
              owner: item?.owner ? String(item.owner).trim() : undefined,
              due: item?.due ? String(item.due).trim() : undefined,
              status,
            };
          })
          .filter((item) => item.text)
      : [],
  };

  return {
    summary: clipList(dedupeList(normalizedSummary.summary), SUMMARY_MAX),
    decisions: clipList(dedupeList(normalizedSummary.decisions), DECISIONS_MAX),
    actionItems: clipList(
      dedupeActionItems(normalizedSummary.actionItems),
      ACTION_ITEMS_MAX
    ),
  };
};

const extractJsonBlock = (text: string): string | null => {
  const fencedMatch =
    text.match(/```json\s*([\s\S]*?)```/i) ||
    text.match(/```([\s\S]*?)```/i);
  const target = fencedMatch ? fencedMatch[1] : text;
  const startIndex = target.indexOf("{");
  if (startIndex === -1) return null;
  let depth = 0;
  for (let i = startIndex; i < target.length; i += 1) {
    const char = target[i];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return target.slice(startIndex, i + 1);
    }
  }
  return null;
};

export const parseMeetingSummary = (raw: string): LiveSummaryData | null => {
  if (!raw) return null;
  const candidate = extractJsonBlock(raw);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate) as LiveSummaryData;
    return sanitizeSummary(parsed);
  } catch (error) {
    return null;
  }
};

export const parseMeetingSummaryWithRepair = async (
  raw: string,
  repair: (rawJson: string) => Promise<string | null>
): Promise<LiveSummaryData | null> => {
  const parsed = parseMeetingSummary(raw);
  if (parsed) {
    return parsed;
  }
  const repaired = await repair(raw);
  if (!repaired) return null;
  return parseMeetingSummary(repaired);
};

export const shouldUpdateSummary = (params: {
  now: number;
  lastAttemptAt: number;
  lastUpdateAt: number;
  bufferLength: number;
  force?: boolean;
}): boolean => {
  const { now, lastAttemptAt, lastUpdateAt, bufferLength, force } = params;
  if (bufferLength <= 0) return false;
  if (force) return true;
  if (now - lastAttemptAt < MIN_UPDATE_INTERVAL_MS) return false;
  if (now - lastUpdateAt >= UPDATE_INTERVAL_MS) return true;
  return bufferLength >= CHAR_THRESHOLD;
};

export const getCurrentSummary = (): LiveSummaryData | null => {
  return session?.summary ? { ...session.summary } : null;
};

export const startMeeting = (options: MeetingSummarizerOptions): void => {
  const nextSummary =
    options.initialSummary && options.initialSummary.summary
      ? sanitizeSummary(options.initialSummary)
      : createEmptySummary();

  session = {
    conversationId: options.conversationId,
    getAiConfig: options.getAiConfig,
    summary: nextSummary,
    deltaBuffer: "",
    lastUpdateAt: 0,
    lastAttemptAt: 0,
    onSummaryUpdated: options.onSummaryUpdated,
    onError: options.onError,
  };
};

export const ingestDelta = (textDelta: string, source: MeetingSource): void => {
  if (!session || !textDelta?.trim()) return;
  const labeledDelta = `[${source.toUpperCase()}] ${textDelta.trim()}`;
  session.deltaBuffer = `${session.deltaBuffer}\n${labeledDelta}`.trim();
  if (session.deltaBuffer.length > MAX_DELTA_CHARS) {
    session.deltaBuffer = session.deltaBuffer.slice(-MAX_DELTA_CHARS);
  }
};

export const maybeIngestScreenshotText = (textDelta: string): void => {
  ingestDelta(textDelta, "ocr");
};

const requestSummaryUpdate = async (
  summary: LiveSummaryData,
  delta: string
): Promise<string> => {
  const { provider, selectedProvider } = session!.getAiConfig();
  const usePluelyAPI = await shouldUsePluelyAPI();

  let response = "";
  for await (const chunk of fetchAIResponse({
    provider: usePluelyAPI ? undefined : provider,
    selectedProvider,
    systemPrompt: MEETING_SYSTEM_PROMPT,
    history: [],
    userMessage: `Previous summary JSON:\n${JSON.stringify(
      summary
    )}\n\nNew content deltas:\n${delta}\n\nReturn updated JSON only.`,
  })) {
    response += chunk;
  }
  return response;
};

const requestRepair = async (raw: string): Promise<string | null> => {
  const { provider, selectedProvider } = session!.getAiConfig();
  const usePluelyAPI = await shouldUsePluelyAPI();
  let response = "";
  for await (const chunk of fetchAIResponse({
    provider: usePluelyAPI ? undefined : provider,
    selectedProvider,
    systemPrompt: JSON_REPAIR_PROMPT,
    history: [],
    userMessage: `Fix this JSON:\n${raw}`,
  })) {
    response += chunk;
  }
  return response || null;
};

export const tick = async (options?: { force?: boolean }): Promise<void> => {
  if (!session || isUpdating) return;
  const now = Date.now();
  const buffer = session.deltaBuffer.trim();

  if (
    !shouldUpdateSummary({
      now,
      lastAttemptAt: session.lastAttemptAt,
      lastUpdateAt: session.lastUpdateAt,
      bufferLength: buffer.length,
      force: options?.force,
    })
  ) {
    return;
  }

  session.lastAttemptAt = now;
  isUpdating = true;
  try {
    const raw = await requestSummaryUpdate(session.summary, buffer);
    const parsed = await parseMeetingSummaryWithRepair(raw, requestRepair);

    if (!parsed) {
      throw new Error("Failed to parse meeting summary JSON");
    }

    session.summary = parsed;
    session.deltaBuffer = "";
    session.lastUpdateAt = Date.now();
    session.onSummaryUpdated?.(parsed, session.lastUpdateAt);
  } catch (error) {
    session?.onError?.(error as Error);
  } finally {
    isUpdating = false;
  }
};

export const scheduleUpdates = (): void => {
  if (intervalId) return;
  intervalId = setInterval(() => {
    tick().catch(() => {});
  }, POLL_INTERVAL_MS);
};

export const clearSummary = (): void => {
  if (!session) return;
  const cleared = createEmptySummary();
  session.summary = cleared;
  session.deltaBuffer = "";
  session.lastUpdateAt = Date.now();
  session.onSummaryUpdated?.(cleared, session.lastUpdateAt);
};

export const stopMeeting = async (options?: { flush?: boolean }): Promise<void> => {
  if (options?.flush) {
    await tick({ force: true });
  }
  session = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isUpdating = false;
};
