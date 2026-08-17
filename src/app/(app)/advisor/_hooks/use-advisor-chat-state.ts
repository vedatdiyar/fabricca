"use client";

import { useState, useCallback, useMemo } from "react";
import type { AdvisorPersona } from "@/app/(app)/advisor/_services/classifier";
import type { PendingToolCall } from "../_components/tool-confirmation-card";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { PipelineResult } from "@/app/(app)/advisor/_services/pipeline/types";
import type { Message } from "../_lib/types";

export interface StreamingState {
  text: string;
  sources: RagSearchResultItem[] | undefined;
  toolCalls: PendingToolCall[] | undefined;
  persona: AdvisorPersona | undefined;
  pipeline: PipelineResult | undefined;
}

export const INITIAL_STREAMING_STATE: StreamingState = {
  text: "",
  sources: undefined,
  toolCalls: undefined,
  persona: undefined,
  pipeline: undefined,
};

/**
 * Manages UI, selection, citation, lock, and streaming states for Advisor Chat.
 *
 * @param messages - Current chat messages array.
 * @returns State properties and setters for chat UI elements.
 */
export function useAdvisorChatState(messages: Message[]) {
  const [ui, setUi] = useState<{
    activeCitation: {
      messageId: string;
      sourceIndex: number;
    } | null;
    copiedMessageId: string | null;
  }>({ activeCitation: null, copiedMessageId: null });

  const [streaming, setStreaming] = useState<StreamingState>(
    INITIAL_STREAMING_STATE,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const { activeCitation, copiedMessageId } = ui;

  const setActiveCitation = useCallback(
    (
      updater:
        | { messageId: string; sourceIndex: number }
        | null
        | ((
            prev: { messageId: string; sourceIndex: number } | null,
          ) => { messageId: string; sourceIndex: number } | null),
    ) => {
      setUi((prev) => ({
        ...prev,
        activeCitation:
          typeof updater === "function"
            ? updater(prev.activeCitation)
            : updater,
      }));
    },
    [],
  );

  const setCopiedMessageId = useCallback((value: string | null) => {
    setUi((prev) => ({ ...prev, copiedMessageId: value }));
  }, []);

  const handleCitationPosition = useCallback(
    (messageId: string, sourceIndex: number) => {
      setActiveCitation((prev) => {
        if (prev?.messageId === messageId && prev.sourceIndex === sourceIndex) {
          return null;
        }
        return { messageId, sourceIndex };
      });
    },
    [setActiveCitation],
  );

  const activeSource = useMemo(() => {
    if (!activeCitation) return null;
    const msg = messages.find((m) => m.id === activeCitation.messageId);
    return msg?.sources?.[activeCitation.sourceIndex] ?? null;
  }, [activeCitation, messages]);

  const handleApprovePipeline = useCallback(() => {
    setIsLocked(false);
  }, []);

  return {
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
  };
}
