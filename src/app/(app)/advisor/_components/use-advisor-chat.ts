"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { saveChatMessage, generateChatTitleAction } from "../actions";
import { useAdvisorSessions } from "../_hooks/use-advisor-sessions";
import { useAdvisorToolHandler } from "../_hooks/use-advisor-tool-handler";
import type { AdvisorPersona } from "@/lib/services/advisor-classifier";
import type { PendingToolCall } from "./tool-confirmation-card";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import type { PipelineResult } from "@/lib/services/advisor-pipeline/types";
import type { PipelineResultData } from "@/db/schema";
import type { Message } from "../_lib/types";

/**
 * Custom React hook orchestrating Advisor Chat session state, DB tool confirmations,
 * UI citations and streaming SSE API interactions.
 *
 * @param initialSessionId - Optional session id to load on mount.
 * @returns State values and event handlers for the advisor chat component.
 */
export function useAdvisorChat(initialSessionId?: number) {
  const [ui, setUi] = useState<{
    activeCitation: {
      messageId: string;
      sourceIndex: number;
    } | null;
    copiedMessageId: string | null;
  }>({ activeCitation: null, copiedMessageId: null });
  const { activeCitation, copiedMessageId } = ui;

  const [streaming, setStreaming] = useState<{
    text: string;
    sources: RagSearchResultItem[] | undefined;
    toolCalls: PendingToolCall[] | undefined;
    persona: AdvisorPersona | undefined;
    pipeline: PipelineResult | undefined;
  }>({
    text: "",
    sources: undefined,
    toolCalls: undefined,
    persona: undefined,
    pipeline: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const isSendingRef = useRef(false);

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

  const {
    messages,
    setMessages,
    sessions,
    activeSessionId,
    loadSessions,
    handleSelectSession: selectSessionRaw,
    handleCreateSession,
    handleDeleteSession,
    createChatSessionAndActivate,
  } = useAdvisorSessions({
    initialSessionId,
    isSendingRef,
    setActiveCitation,
  });

  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      setIsLocked(false);
      await selectSessionRaw(sessionId);
    },
    [selectSessionRaw],
  );

  const { handleApproveToolCall, handleUndoToolCall, handleRejectToolCall } =
    useAdvisorToolHandler({ setMessages });

  const handleSend = async (overrideQuery?: string) => {
    if (isSendingRef.current) return;
    const queryToSend = (overrideQuery ?? "").trim();
    if (!queryToSend || isLoading) return;

    isSendingRef.current = true;
    let sessionId = activeSessionId;
    setIsLocked(false);

    if (!sessionId) {
      const title =
        queryToSend.length > 60
          ? queryToSend.slice(0, 60) + "..."
          : queryToSend;
      sessionId = await createChatSessionAndActivate(title);
      if (!sessionId) {
        isSendingRef.current = false;
        return;
      }

      void generateChatTitleAction(sessionId, queryToSend).then((titleRes) => {
        if (titleRes.success) {
          void loadSessions();
        }
      });
    }

    const userMessageId = `user-${crypto.randomUUID()}`;
    const userMsg: Message = {
      id: userMessageId,
      role: "user",
      content: queryToSend,
      timestamp: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreaming({
      text: "",
      sources: undefined,
      toolCalls: undefined,
      persona: undefined,
      pipeline: undefined,
    });

    await saveChatMessage(sessionId, "user", queryToSend);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryToSend,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("Yanıt alınamadı.");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedToolCalls: PendingToolCall[] = [];
      let assignedPersona: AdvisorPersona | undefined = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "persona_assigned") {
              assignedPersona = event.persona;
              setStreaming((prev) => ({ ...prev, persona: event.persona }));
            } else if (event.type === "stage_start") {
              setStreaming((prev) => ({
                ...prev,
                pipeline: { stage: event.stage },
              }));
            } else if (event.type === "stage_done") {
              setStreaming((prev) => ({
                ...prev,
                pipeline: { stage: event.stage, audit: event.payload },
              }));
              if (
                event.stage === "audit" &&
                event.payload?.hasCriticalIssues === true
              ) {
                setIsLocked(true);
              }
            } else if (event.type === "delta") {
              setStreaming((prev) => ({
                ...prev,
                text: prev.text + event.text,
              }));
            } else if (event.type === "tool_call_request") {
              const newToolCall: PendingToolCall = {
                toolCallId: event.toolCallId,
                name: event.name,
                args: event.args,
                explanation: event.explanation,
                status: "pending",
                previousState: event.previousState,
              };
              accumulatedToolCalls = [...accumulatedToolCalls, newToolCall];
              setStreaming((prev) => ({
                ...prev,
                toolCalls: [...accumulatedToolCalls],
              }));
            } else if (event.type === "done") {
              setStreaming((prev) => ({ ...prev, sources: event.sources }));
              const finalPersona = event.persona || assignedPersona;
              const pipelineResult = event.pipeline as
                PipelineResult | undefined;

              if (pipelineResult) {
                setStreaming((prev) => ({
                  ...prev,
                  pipeline: pipelineResult,
                }));
                if (pipelineResult.audit?.hasCriticalIssues) {
                  setIsLocked(true);
                }
              }

              const modelMessageId = `model-${crypto.randomUUID()}`;
              const finalContent =
                event.text.trim() ||
                (accumulatedToolCalls.length > 0
                  ? "Aşağıdaki veritabanı işlemini gerçekleştirmek için onayınız isteniyor:"
                  : "");

              const modelMsg: Message = {
                id: modelMessageId,
                role: "model",
                persona: finalPersona,
                content: finalContent,
                sources: event.sources,
                toolCalls:
                  accumulatedToolCalls.length > 0
                    ? accumulatedToolCalls
                    : undefined,
                pipeline: pipelineResult,
                timestamp: new Date().toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              };

              if (sessionId) {
                const pipelineData: PipelineResultData | null = pipelineResult
                  ? { ...pipelineResult, cycle: 1 }
                  : null;
                const saveRes = await saveChatMessage(
                  sessionId,
                  "model",
                  finalContent,
                  event.sources ?? undefined,
                  accumulatedToolCalls.length > 0
                    ? accumulatedToolCalls
                    : undefined,
                  finalPersona,
                  pipelineData,
                );
                if (saveRes.success && saveRes.messageId) {
                  modelMsg.dbId = saveRes.messageId;
                }
                await loadSessions();
              }

              setMessages((prev) => [...prev, modelMsg]);
            } else if (event.type === "error") {
              toast.error(event.error || "Yanıt üretilirken hata oluştu.");
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "İletişim hatası oluştu.";
      toast.error(message);
    } finally {
      setIsLoading(false);
      setStreaming({
        text: "",
        sources: undefined,
        toolCalls: undefined,
        persona: undefined,
        pipeline: undefined,
      });
      isSendingRef.current = false;
    }
  };

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

  const activeSource =
    activeCitation &&
    (() => {
      const msg = messages.find((m) => m.id === activeCitation.messageId);
      return msg?.sources?.[activeCitation.sourceIndex] ?? null;
    })();

  const handleApprovePipeline = useCallback(() => {
    setIsLocked(false);
  }, []);

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
