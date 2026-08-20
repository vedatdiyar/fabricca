"use client";

import { useRef, useCallback } from "react";
import { useAdvisorSessions } from "../_hooks/use-advisor-sessions";
import { useAdvisorToolHandler } from "../_hooks/use-advisor-tool-handler";
import { useAdvisorChatState } from "../_hooks/use-advisor-chat-state";
import { useAdvisorChatSend } from "../_hooks/use-advisor-chat-send";

/**
 * Custom React hook orchestrating Advisor Chat session state, DB tool confirmations,
 * UI citations and streaming SSE API interactions.
 *
 * @param initialSessionId - Optional session id to load on mount.
 * @returns State values and event handlers for the advisor chat component.
 */
export function useAdvisorChat(initialSessionId?: number) {
  const isSendingRef = useRef(false);

  // 1. Session and message history state
  const {
    messages,
    setMessages,
    sessions,
    activeSessionId,
    loadSessions,
    handleSelectSession: selectSessionRaw,
    handleCreateSession: createSessionRaw,
    handleDeleteSession: deleteSessionRaw,
    createChatSessionAndActivate,
  } = useAdvisorSessions({
    initialSessionId,
    isSendingRef,
  });

  // 2. UI, citation, loading, lock, and streaming state
  const {
    activeCitation,
    setActiveCitation,
    copiedMessageId,
    setCopiedMessageId,
    streaming,
    setStreaming,
    isLoading,
    setIsLoading,
    isLocked,
    setIsLocked,
    handleCitationPosition,
    activeSource,
    handleApprovePipeline,
  } = useAdvisorChatState(messages);

  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      setIsLocked(false);
      setActiveCitation(null);
      await selectSessionRaw(sessionId);
    },
    [selectSessionRaw, setIsLocked, setActiveCitation],
  );

  const handleCreateSession = useCallback(() => {
    setIsLocked(false);
    setActiveCitation(null);
    createSessionRaw();
  }, [createSessionRaw, setIsLocked, setActiveCitation]);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      setActiveCitation(null);
      await deleteSessionRaw(sessionId);
    },
    [deleteSessionRaw, setActiveCitation],
  );

  // 3. Tool execution handlers (approve, reject, undo)
  const { handleApproveToolCall, handleUndoToolCall, handleRejectToolCall } =
    useAdvisorToolHandler({ setMessages });

  // 4. Send action and stream consumer
  const { handleSend } = useAdvisorChatSend({
    messages,
    setMessages,
    activeSessionId,
    createChatSessionAndActivate,
    loadSessions,
    setIsLoading,
    setIsLocked,
    setStreaming,
    isSendingRef,
    isLoading,
  });

  return {
    messages,
    setMessages,
    isLoading,
    isLocked,
    activeCitation,
    setActiveCitation,
    sessions,
    activeSessionId,
    streamingText: streaming.text,
    streamingSources: streaming.sources,
    streamingToolCalls: streaming.toolCalls,
    streamingPersona: streaming.persona,
    streamingPipeline: streaming.pipeline,
    copiedMessageId,
    setCopiedMessageId,
    activeSource,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleApproveToolCall,
    handleUndoToolCall,
    handleRejectToolCall,
    handleApprovePipeline,
    handleSend,
    handleCitationPosition,
  };
}
