import type { Message, ChatToolCall } from "@/core/db/schema";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { ChatSessionListItem } from "../session-actions";

export interface AssistantWorkspaceState {
  sessions: ChatSessionListItem[];
  activeSessionId: number | null;
  messages: Message[];
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isGenerating: boolean;
  streamingText: string;
  streamingSources: RagSearchResultItem[];
  streamingPersona: string | undefined;
  streamingToolCalls: ChatToolCall[];
  activeCitation: RagSearchResultItem | null;
  isCitationOpen: boolean;
}

export type AssistantWorkspaceAction =
  | { type: "INIT_START" }
  | {
      type: "INIT_SUCCESS";
      payload: {
        sessions: ChatSessionListItem[];
        activeSessionId: number | null;
      };
    }
  | { type: "INIT_FAILED" }
  | { type: "SET_SESSIONS"; payload: ChatSessionListItem[] }
  | { type: "LOAD_MESSAGES_START" }
  | { type: "LOAD_MESSAGES_SUCCESS"; payload: Message[] }
  | { type: "LOAD_MESSAGES_FAILED" }
  | {
      type: "SELECT_SESSION";
      payload: { sessionId: number };
    }
  | { type: "RESET_NEW_SESSION" }
  | {
      type: "START_STREAMING";
      payload: {
        userMessage: Message;
        targetSessionId: number;
      };
    }
  | { type: "SET_STREAMING_TEXT"; payload: string }
  | { type: "SET_STREAMING_PERSONA"; payload: string | undefined }
  | { type: "SET_STREAMING_TOOL_CALLS"; payload: ChatToolCall[] }
  | {
      type: "FINISH_STREAMING";
      payload: { assistantMessage: Message };
    }
  | { type: "STREAMING_ERROR" }
  | {
      type: "UPDATE_MESSAGES";
      payload: Message[] | ((prev: Message[]) => Message[]);
    }
  | { type: "OPEN_CITATION"; payload: RagSearchResultItem }
  | { type: "CLOSE_CITATION" };

/**
 * Pure reducer function managing state transitions for the Advisor Assistant workspace.
 *
 * @param state - Current workspace state snapshot.
 * @param action - Dispatched action.
 * @returns Next workspace state snapshot.
 */
export function assistantWorkspaceReducer(
  state: AssistantWorkspaceState,
  action: AssistantWorkspaceAction,
): AssistantWorkspaceState {
  switch (action.type) {
    case "INIT_START":
      return { ...state, isLoadingSessions: true };
    case "INIT_SUCCESS":
      return {
        ...state,
        sessions: action.payload.sessions,
        activeSessionId: action.payload.activeSessionId,
        isLoadingSessions: false,
      };
    case "INIT_FAILED":
      return { ...state, isLoadingSessions: false };
    case "SET_SESSIONS":
      return { ...state, sessions: action.payload };
    case "LOAD_MESSAGES_START":
      return { ...state, isLoadingMessages: true };
    case "LOAD_MESSAGES_SUCCESS":
      return {
        ...state,
        isLoadingMessages: false,
        messages: action.payload,
      };
    case "LOAD_MESSAGES_FAILED":
      return {
        ...state,
        isLoadingMessages: false,
        messages: [],
      };
    case "SELECT_SESSION":
      return {
        ...state,
        activeSessionId: action.payload.sessionId,
        streamingText: "",
        streamingSources: [],
        streamingPersona: undefined,
        streamingToolCalls: [],
      };
    case "RESET_NEW_SESSION":
      return {
        ...state,
        activeSessionId: null,
        messages: [],
        streamingText: "",
        streamingSources: [],
        streamingPersona: undefined,
        streamingToolCalls: [],
      };
    case "START_STREAMING":
      return {
        ...state,
        activeSessionId: action.payload.targetSessionId,
        messages: [...state.messages, action.payload.userMessage],
        isGenerating: true,
        streamingText: "",
        streamingSources: [],
        streamingPersona: undefined,
        streamingToolCalls: [],
      };
    case "SET_STREAMING_TEXT":
      return { ...state, streamingText: action.payload };
    case "SET_STREAMING_PERSONA":
      return { ...state, streamingPersona: action.payload };
    case "SET_STREAMING_TOOL_CALLS":
      return { ...state, streamingToolCalls: action.payload };
    case "FINISH_STREAMING":
      return {
        ...state,
        messages: [...state.messages, action.payload.assistantMessage],
        isGenerating: false,
        streamingText: "",
        streamingSources: [],
        streamingPersona: undefined,
        streamingToolCalls: [],
      };
    case "STREAMING_ERROR":
      return { ...state, isGenerating: false };
    case "UPDATE_MESSAGES": {
      const nextMessages =
        typeof action.payload === "function"
          ? action.payload(state.messages)
          : action.payload;
      return { ...state, messages: nextMessages };
    }
    case "OPEN_CITATION":
      return {
        ...state,
        activeCitation: action.payload,
        isCitationOpen: true,
      };
    case "CLOSE_CITATION":
      return { ...state, isCitationOpen: false };
    default:
      return state;
  }
}
