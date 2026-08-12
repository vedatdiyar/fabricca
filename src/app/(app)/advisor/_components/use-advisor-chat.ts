"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { saveChatMessage, generateChatTitleAction } from "../actions";
import { useAdvisorSessions } from "../_hooks/use-advisor-sessions";
import { useAdvisorToolHandler } from "../_hooks/use-advisor-tool-handler";
import { useAdvisorStream } from "../_hooks/use-advisor-stream";
import type { AdvisorPersona } from "@/features/advisor/classifier";
import type { PendingToolCall } from "./tool-confirmation-card";
import type { RagSearchResultItem } from "@/services/search/rag-search";
import type { PipelineResult } from "@/features/advisor/pipeline/types";
import type { PipelineResultData } from "@/db/schema";
import type { Message } from "../_lib/types";

/**
 * Formats the current time as the compact TR-TR timestamp used by chat messages.
 *
 * @returns The formatted timestamp string.
 */
function formatMessageTimestamp(): string {
  return new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Builds a new user chat message with a fresh client id and timestamp.
 *
 * @param query - The trimmed user query text.
 * @returns The constructed user message.
 */
function buildUserMessage(query: string): Message {
  return {
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    content: query,
    timestamp: formatMessageTimestamp(),
  };
}

/**
 * Builds a new model chat message with a fresh client id and timestamp.
 *
 * @param params - The model message fields.
 * @returns The constructed model message.
 */
function buildModelMessage(params: {
  persona?: AdvisorPersona;
  content: string;
  sources?: RagSearchResultItem[];
  toolCalls?: PendingToolCall[];
  pipeline?: PipelineResult;
}): Message {
  return {
    id: `model-${crypto.randomUUID()}`,
    role: "model",
    persona: params.persona,
    content: params.content,
    sources: params.sources,
    toolCalls: params.toolCalls,
    pipeline: params.pipeline,
    timestamp: formatMessageTimestamp(),
  };
}

/**
 * Persists a finished model message to the active chat session, returning the
 * created database message id when the save succeeds.
 *
 * @param params - The model message data to persist.
 * @returns The persisted message id, or undefined on failure.
 */
async function persistModelMessage(params: {
  sessionId: number;
  content: string;
  sources?: RagSearchResultItem[];
  toolCalls?: PendingToolCall[];
  persona?: AdvisorPersona;
  pipeline?: PipelineResult | null;
}): Promise<number | undefined> {
  const pipelineData: PipelineResultData | null = params.pipeline
    ? { ...params.pipeline, cycle: 1 }
    : null;
  const saveRes = await saveChatMessage(
    params.sessionId,
    "model",
    params.content,
    params.sources,
    params.toolCalls,
    params.persona,
    pipelineData,
  );
  return saveRes.success ? saveRes.messageId : undefined;
}

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

  const { readStream } = useAdvisorStream();

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

    const userMsg = buildUserMessage(queryToSend);

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

      let accumulatedToolCalls: PendingToolCall[] = [];
      let assignedPersona: AdvisorPersona | undefined = undefined;

      await readStream(response, async (event) => {
        switch (event.type) {
          case "persona_assigned": {
            assignedPersona = event.persona as AdvisorPersona;
            setStreaming((prev) => ({ ...prev, persona: assignedPersona }));
            break;
          }
          case "stage_start": {
            setStreaming((prev) => ({
              ...prev,
              pipeline: { stage: "audit" },
            }));
            break;
          }
          case "stage_done": {
            const payload = event.payload as PipelineResult["audit"];
            setStreaming((prev) => ({
              ...prev,
              pipeline: { stage: "audit", audit: payload },
            }));
            if (
              event.stage === "audit" &&
              payload?.hasCriticalIssues === true
            ) {
              setIsLocked(true);
            }
            break;
          }
          case "delta": {
            setStreaming((prev) => ({
              ...prev,
              text: prev.text + (event.text as string),
            }));
            break;
          }
          case "tool_call_request": {
            const newToolCall: PendingToolCall = {
              toolCallId: event.toolCallId as string,
              name: event.name as string,
              args: event.args as Record<string, unknown>,
              explanation: event.explanation as string,
              status: "pending",
              previousState: event.previousState as
                Record<string, unknown> | undefined,
            };
            accumulatedToolCalls = [...accumulatedToolCalls, newToolCall];
            setStreaming((prev) => ({
              ...prev,
              toolCalls: [...accumulatedToolCalls],
            }));
            break;
          }
          case "done": {
            const eventSources = event.sources as
              RagSearchResultItem[] | undefined;
            setStreaming((prev) => ({ ...prev, sources: eventSources }));
            const finalPersona =
              (event.persona as AdvisorPersona | undefined) || assignedPersona;
            const pipelineResult = event.pipeline as PipelineResult | undefined;

            if (pipelineResult) {
              setStreaming((prev) => ({
                ...prev,
                pipeline: pipelineResult,
              }));
              if (pipelineResult.audit?.hasCriticalIssues) {
                setIsLocked(true);
              }
            }

            const finalContent =
              ((event.text as string) || "").trim() ||
              (accumulatedToolCalls.length > 0
                ? "Aşağıdaki veritabanı işlemini gerçekleştirmek için onayınız isteniyor:"
                : "");

            const modelMsg = buildModelMessage({
              persona: finalPersona,
              content: finalContent,
              sources: eventSources,
              toolCalls:
                accumulatedToolCalls.length > 0
                  ? accumulatedToolCalls
                  : undefined,
              pipeline: pipelineResult,
            });

            if (sessionId) {
              const messageId = await persistModelMessage({
                sessionId,
                content: finalContent,
                sources: eventSources,
                toolCalls:
                  accumulatedToolCalls.length > 0
                    ? accumulatedToolCalls
                    : undefined,
                persona: finalPersona,
                pipeline: pipelineResult,
              });
              if (messageId !== undefined) {
                modelMsg.dbId = messageId;
              }
              await loadSessions();
            }

            setMessages((prev) => [...prev, modelMsg]);
            break;
          }
          case "error": {
            toast.error(
              (event.error as string) || "Yanıt üretilirken hata oluştu.",
            );
            break;
          }
        }
      });
    } catch {
      toast.error(
        "Yanıt üretilirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
      );
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
