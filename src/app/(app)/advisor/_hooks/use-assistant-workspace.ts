"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Message, ChatToolCall } from "@/core/db/schema";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession,
} from "../session-actions";
import { getChatMessages } from "../message-actions";
import { generateChatTitleAction } from "../title-actions";
import { assistantWorkspaceReducer } from "./assistant-workspace-reducer";
import { consumeAssistantChatStream } from "../_lib/assistant-chat-stream";
import {
  approveToolMutation,
  rejectToolMutation,
  undoToolMutation,
  updateChatMessageToolCalls,
} from "../_lib/assistant-tool-helpers";

interface UseAssistantWorkspaceOptions {
  initialSessionId?: number;
}

/**
 * State hook managing the Thesis Assistant workspace, session list,
 * chat message history, real-time SSE streaming, tool confirmations, and RAG citation inspection.
 *
 * @param options - Configuration options including initial session ID.
 * @returns State properties and handler actions for the workspace.
 */
export function useAssistantWorkspace({
  initialSessionId,
}: UseAssistantWorkspaceOptions = {}) {
  const [state, dispatch] = useReducer(assistantWorkspaceReducer, {
    sessions: [],
    activeSessionId: initialSessionId ?? null,
    messages: [],
    isLoadingSessions: true,
    isLoadingMessages: false,
    isGenerating: false,
    streamingText: "",
    streamingSources: [],
    streamingPersona: undefined,
    streamingToolCalls: [],
    activeCitation: null,
    isCitationOpen: false,
  });

  const {
    sessions,
    activeSessionId,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isGenerating,
    streamingText,
    streamingSources,
    streamingPersona,
    streamingToolCalls,
    activeCitation,
    isCitationOpen,
  } = state;

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Refreshes the chat sessions list from the server.
   */
  const refreshSessions = useCallback(async () => {
    const res = await getChatSessions();
    if (res.success) {
      dispatch({ type: "SET_SESSIONS", payload: res.data });
    } else {
      toast.error(res.error || "Oturumlar yüklenemedi.");
    }
  }, []);

  /**
   * Loads messages for a specific session ID.
   */
  const loadMessages = useCallback(async (sessionId: number) => {
    dispatch({ type: "LOAD_MESSAGES_START" });
    try {
      const res = await getChatMessages(sessionId);
      if (res.success && res.messages) {
        dispatch({ type: "LOAD_MESSAGES_SUCCESS", payload: res.messages });
      } else {
        toast.error(res.error || "Mesajlar yüklenemedi.");
        dispatch({ type: "LOAD_MESSAGES_FAILED" });
      }
    } catch {
      toast.error("Mesajlar alınırken bir hata oluştu.");
      dispatch({ type: "LOAD_MESSAGES_FAILED" });
    }
  }, []);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      dispatch({ type: "INIT_START" });
      const res = await getChatSessions();
      if (!mounted) return;
      if (res.success) {
        let chosenId: number | null = null;
        if (initialSessionId) {
          chosenId = initialSessionId;
        } else if (res.data.length > 0) {
          chosenId = res.data[0].id;
          window.history.replaceState(
            null,
            "",
            `/advisor/chat?session=${chosenId}`,
          );
        }
        dispatch({
          type: "INIT_SUCCESS",
          payload: {
            sessions: res.data,
            activeSessionId: chosenId,
          },
        });
        if (chosenId) {
          await loadMessages(chosenId);
        }
      } else {
        dispatch({ type: "INIT_FAILED" });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [initialSessionId, loadMessages]);

  /**
   * Switches to an existing session.
   */
  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      if (sessionId === activeSessionId && !isGenerating) return;
      dispatch({ type: "SELECT_SESSION", payload: { sessionId } });
      window.history.replaceState(
        null,
        "",
        `/advisor/chat?session=${sessionId}`,
      );
      await loadMessages(sessionId);
    },
    [activeSessionId, isGenerating, loadMessages],
  );

  /**
   * Resets workspace to a fresh new chat session.
   */
  const handleNewSession = useCallback(() => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch({ type: "RESET_NEW_SESSION" });
    window.history.replaceState(null, "", "/advisor/chat");
  }, [isGenerating]);

  /**
   * Deletes a session and updates list/state.
   */
  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      const res = await deleteChatSession(sessionId);
      if (res.success) {
        toast.success("Oturum silindi.");
        dispatch({
          type: "SET_SESSIONS",
          payload: sessions.filter((s) => s.id !== sessionId),
        });
        if (activeSessionId === sessionId) {
          handleNewSession();
        }
      } else {
        toast.error(res.error || "Oturum silinemedi.");
      }
    },
    [activeSessionId, sessions, handleNewSession],
  );

  /**
   * Sends a user prompt and streams the assistant response.
   */
  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      let targetSessionId = activeSessionId;
      const isFirstMessage = !targetSessionId || messages.length === 0;

      if (!targetSessionId) {
        const createRes = await createChatSession("Yeni Sohbet");
        if (!createRes.success || !createRes.sessionId) {
          toast.error(createRes.error || "Yeni oturum oluşturulamadı.");
          return;
        }
        targetSessionId = createRes.sessionId;
        window.history.replaceState(
          null,
          "",
          `/advisor/chat?session=${targetSessionId}`,
        );
      }

      const optimisticUserMsg: Message = {
        id: Date.now(),
        sessionId: targetSessionId,
        role: "user",
        content: trimmed,
        persona: null,
        sources: null,
        toolCalls: null,
        pipelineData: null,
        createdAt: new Date(),
      };

      dispatch({
        type: "START_STREAMING",
        payload: { userMessage: optimisticUserMsg, targetSessionId },
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const historyPayload = messages.slice(-6).map((m) => ({
          role: m.role as "user" | "model" | "assistant",
          content: m.content,
        }));

        const response = await fetch("/api/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CHAT",
            sessionId: targetSessionId,
            query: trimmed,
            history: historyPayload,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Danışman yanıt veremedi.");
        }

        const streamResult = await consumeAssistantChatStream(response, {
          onPersona: (persona) =>
            dispatch({ type: "SET_STREAMING_PERSONA", payload: persona }),
          onDelta: (textVal) =>
            dispatch({ type: "SET_STREAMING_TEXT", payload: textVal }),
          onToolCalls: (calls) =>
            dispatch({ type: "SET_STREAMING_TOOL_CALLS", payload: calls }),
          onError: (err) => toast.error(err),
        });

        const modelMsg: Message = {
          id: Date.now() + 1,
          sessionId: targetSessionId,
          role: "assistant",
          content: streamResult.finalResponseText,
          persona: streamResult.finalPersona,
          sources: streamResult.finalSources,
          toolCalls:
            streamResult.finalToolCalls.length > 0
              ? streamResult.finalToolCalls
              : null,
          pipelineData: null,
          createdAt: new Date(),
        };

        dispatch({
          type: "FINISH_STREAMING",
          payload: { assistantMessage: modelMsg },
        });

        if (isFirstMessage) {
          generateChatTitleAction(targetSessionId, trimmed).then((titleRes) => {
            if (titleRes.success) {
              refreshSessions();
            }
          });
        } else {
          refreshSessions();
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Yanıt üretilirken bir hata oluştu.";
        toast.error(errorMsg);
      } finally {
        dispatch({ type: "STREAMING_ERROR" });
        abortControllerRef.current = null;
      }
    },
    [activeSessionId, isGenerating, messages, refreshSessions],
  );

  const updateToolCallStatus = useCallback(
    (messageId: number, toolCallId: string, patch: Partial<ChatToolCall>) => {
      dispatch({
        type: "UPDATE_MESSAGES",
        payload: (prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId || !msg.toolCalls) return msg;
            const updatedToolCalls = msg.toolCalls.map((tc) =>
              tc.toolCallId === toolCallId ? { ...tc, ...patch } : tc,
            );
            updateChatMessageToolCalls(msg.id, updatedToolCalls).catch(
              console.error,
            );
            return { ...msg, toolCalls: updatedToolCalls };
          }),
      });
    },
    [],
  );

  const handleApproveTool = useCallback(
    async (messageId: number, toolCall: ChatToolCall) => {
      await approveToolMutation(messageId, toolCall, updateToolCallStatus);
    },
    [updateToolCallStatus],
  );

  const handleRejectTool = useCallback(
    async (messageId: number, toolCall: ChatToolCall) => {
      rejectToolMutation(messageId, toolCall, updateToolCallStatus);
    },
    [updateToolCallStatus],
  );

  const handleUndoTool = useCallback(
    async (messageId: number, toolCall: ChatToolCall) => {
      await undoToolMutation(messageId, toolCall, updateToolCallStatus);
    },
    [updateToolCallStatus],
  );

  const handleOpenCitation = useCallback((source: RagSearchResultItem) => {
    dispatch({ type: "OPEN_CITATION", payload: source });
  }, []);

  const handleCloseCitation = useCallback(() => {
    dispatch({ type: "CLOSE_CITATION" });
  }, []);

  return {
    sessions,
    activeSessionId,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isGenerating,
    streamingText,
    streamingSources,
    streamingPersona,
    streamingToolCalls,
    activeCitation,
    isCitationOpen,
    handleSelectSession,
    handleNewSession,
    handleDeleteSession,
    handleSendMessage,
    handleApproveTool,
    handleRejectTool,
    handleUndoTool,
    handleOpenCitation,
    handleCloseCitation,
  };
}
