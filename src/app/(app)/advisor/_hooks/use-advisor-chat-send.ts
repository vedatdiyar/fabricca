"use client";

import {
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from "react";
import { toast } from "sonner";
import { saveChatMessage, generateChatTitleAction } from "../actions";
import { useAdvisorStream } from "./use-advisor-stream";
import type { AdvisorPersona } from "@/features/advisor/classifier";
import type { PendingToolCall } from "../_components/tool-confirmation-card";
import type { RagSearchResultItem } from "@/services/search/rag-search";
import type { PipelineResult } from "@/features/advisor/pipeline/types";
import type { PipelineResultData } from "@/db/schema";
import type { Message } from "../_lib/types";
import {
  type StreamingState,
  INITIAL_STREAMING_STATE,
} from "./use-advisor-chat-state";

/** Formats the current time as the compact TR-TR timestamp used by chat messages. */
function formatMessageTimestamp(): string {
  return new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Builds a new user chat message with a fresh client id and timestamp. */
export function buildUserMessage(query: string): Message {
  return {
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    content: query,
    timestamp: formatMessageTimestamp(),
  };
}

/** Builds a new model chat message with a fresh client id and timestamp. */
export function buildModelMessage(params: {
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

/** Persists a finished model message to the active chat session. */
export async function persistModelMessage(params: {
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

export interface UseAdvisorChatSendParams {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  activeSessionId: number | null;
  createChatSessionAndActivate: (title: string) => Promise<number | null>;
  loadSessions: () => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  setIsLocked: (locked: boolean) => void;
  setStreaming: Dispatch<SetStateAction<StreamingState>>;
  isSendingRef: MutableRefObject<boolean>;
  isLoading: boolean;
}

/**
 * Hook providing the handleSend event handler for sending user queries and consuming SSE streams.
 *
 * @param params - Messaging and session controls.
 * @returns Object with handleSend method.
 */
export function useAdvisorChatSend(params: UseAdvisorChatSendParams) {
  const {
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
  } = params;

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
    setStreaming(INITIAL_STREAMING_STATE);

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
      setStreaming(INITIAL_STREAMING_STATE);
      isSendingRef.current = false;
    }
  };

  return { handleSend };
}
