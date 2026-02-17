// Completion-related types
export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachedFiles?: AttachedFile[];
}

export type ConversationMode = "personal" | "meeting";

export interface LiveSummaryActionItem {
  text: string;
  owner?: string;
  due?: string;
  status?: "open" | "done";
}

export interface LiveSummaryData {
  summary: string[];
  decisions: string[];
  actionItems: LiveSummaryActionItem[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  mode?: ConversationMode;
  liveSummary?: LiveSummaryData;
  liveSummaryUpdatedAt?: number;
}

export interface CompletionState {
  input: string;
  response: string;
  isLoading: boolean;
  error: string | null;
  attachedFiles: AttachedFile[];
  currentConversationId: string | null;
  conversationHistory: ChatMessage[];
}

// Provider-related types
export interface Message {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
        source?: any;
        inline_data?: any;
      }>;
}
