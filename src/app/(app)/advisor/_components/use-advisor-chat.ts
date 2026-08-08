"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession,
  getChatMessages,
  saveChatMessage,
  updateChatMessageToolCalls,
  generateChatTitleAction,
  type ChatSessionListItem,
} from "../actions";
import {
  executeAdvisorToolAction,
  undoAdvisorToolAction,
} from "../tool-actions";
import type { PendingToolCall } from "./tool-confirmation-card";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import type { Message } from "./types";

/** Sentinel used to trigger the initial session sync on mount regardless of the initial id value. */
const PREV_SESSION_SENTINEL = Symbol("prev-session-sentinel");

/**
 * Custom React hook managing Advisor Chat state, session switching, streaming SSE API interactions,
 * and database tool execution confirmations.
 *
 * @param initialSessionId - Optional session id to load on mount.
 * @returns State values and event handlers for the advisor chat component.
 */
export function useAdvisorChat(initialSessionId?: number) {
  const [session, setSession] = useState<{
    messages: Message[];
    isLoading: boolean;
    sessions: ChatSessionListItem[];
    activeSessionId: number | null;
  }>({
    messages: [],
    isLoading: false,
    sessions: [],
    activeSessionId: null,
  });
  const { messages, isLoading, sessions, activeSessionId } = session;

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
    persona: "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT" | undefined;
  }>({
    text: "",
    sources: undefined,
    toolCalls: undefined,
    persona: undefined,
  });

  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setSession((prev) => ({
        ...prev,
        messages: typeof updater === "function" ? updater(prev.messages) : updater,
      }));
    },
    [],
  );

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
          typeof updater === "function" ? updater(prev.activeCitation) : updater,
      }));
    },
    [],
  );

  const setCopiedMessageId = useCallback((value: string | null) => {
    setUi((prev) => ({ ...prev, copiedMessageId: value }));
  }, []);

  const isSendingRef = useRef(false);

  const loadSessions = useCallback(async () => {
    const list = await getChatSessions();
    setSession((prev) => ({ ...prev, sessions: list }));
  }, []);

  const loadMessages = useCallback(async (sessionId: number) => {
    const res = await getChatMessages(sessionId);
    if (res.success && res.messages) {
      const mapped: Message[] = res.messages.map((m) => ({
        id: `msg-${m.id}`,
        dbId: m.id,
        role: m.role as "user" | "model",
        persona:
          (m.persona as "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT" | undefined) ??
          undefined,
        content: m.content,
        sources: (m.sources as RagSearchResultItem[] | undefined) ?? undefined,
        toolCalls: (m.toolCalls as PendingToolCall[] | undefined) ?? undefined,
        timestamp: m.createdAt.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      setMessages(mapped);
    } else {
      setMessages([]);
    }
    setActiveCitation(null);
  }, [setMessages, setActiveCitation]);

  const syncUrlSession = useCallback((sessionId: number | null) => {
    const url =
      sessionId !== null ? `/advisor?session=${sessionId}` : "/advisor";
    window.history.replaceState(null, "", url);
  }, []);

  const prevInitialSessionIdRef = useRef<number | undefined | symbol>(
    PREV_SESSION_SENTINEL,
  );

  // Load sessions and the active session on mount, and resync when the initialSessionId route parameter changes (e.g. browser navigation)
  useEffect(() => {
    if (prevInitialSessionIdRef.current === initialSessionId) return;
    prevInitialSessionIdRef.current = initialSessionId;

    let cancelled = false;
    /** Loads the session list and messages for the target session id if provided. */
    async function syncFromProp() {
      if (isSendingRef.current) return;
      const list = await getChatSessions();
      if (cancelled) return;
      setSession((prev) => ({ ...prev, sessions: list }));

      const targetId =
        initialSessionId !== undefined &&
        list.some((s) => s.id === initialSessionId)
          ? initialSessionId
          : null;

      if (targetId !== null) {
        if (activeSessionId !== targetId) {
          setSession((prev) => ({ ...prev, activeSessionId: targetId }));
          await loadMessages(targetId);
        }
      } else if (activeSessionId !== null) {
        setSession((prev) => ({
          ...prev,
          activeSessionId: null,
          messages: [],
        }));
        setActiveCitation(null);
      }
    }
    void syncFromProp();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, activeSessionId, loadMessages, setActiveCitation]);

  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      setSession((prev) => ({ ...prev, activeSessionId: sessionId }));
      await loadMessages(sessionId);
      syncUrlSession(sessionId);
    },
    [loadMessages, syncUrlSession],
  );

  const handleCreateSession = useCallback(() => {
    setSession((prev) => ({ ...prev, activeSessionId: null, messages: [] }));
    setActiveCitation(null);
    syncUrlSession(null);
  }, [syncUrlSession, setActiveCitation]);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      const res = await deleteChatSession(sessionId);
      if (res.success) {
        if (activeSessionId === sessionId) {
          setSession((prev) => ({
            ...prev,
            activeSessionId: null,
            messages: [],
          }));
          setActiveCitation(null);
          await loadSessions();
          syncUrlSession(null);
        } else {
          await loadSessions();
        }
        toast.success("Sohbet silindi.");
      } else {
        toast.error(res.error || "Sohbet silinemedi.");
      }
    },
    [activeSessionId, loadSessions, syncUrlSession, setActiveCitation],
  );

  const handleApproveToolCall = async (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
  ) => {
    const res = await executeAdvisorToolAction({ toolName: name, args });
    if (res.success) {
      toast.success(res.message);
      let targetDbId: number | undefined;
      let updatedToolCalls: PendingToolCall[] = [];

      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.toolCalls) return msg;
          const hasCall = msg.toolCalls.some(
            (tc) => tc.toolCallId === toolCallId,
          );
          if (!hasCall) return msg;

          targetDbId = msg.dbId;
          updatedToolCalls = msg.toolCalls.map((tc) =>
            tc.toolCallId === toolCallId
              ? {
                  ...tc,
                  status: "approved",
                  executionResult: res.data,
                  previousState: res.previousState,
                }
              : tc,
          );
          return {
            ...msg,
            toolCalls: updatedToolCalls,
          };
        }),
      );

      if (targetDbId) {
        await updateChatMessageToolCalls(targetDbId, updatedToolCalls);
      }
    } else {
      toast.error(res.message);
    }
  };

  const handleUndoToolCall = async (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
    executionResult?: unknown,
    previousState?: Record<string, unknown>,
  ) => {
    const res = await undoAdvisorToolAction({
      toolName: name,
      args,
      executionResult,
      previousState,
    });

    if (res.success) {
      toast.success(res.message);
      let targetDbId: number | undefined;
      let updatedToolCalls: PendingToolCall[] = [];

      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.toolCalls) return msg;
          const hasCall = msg.toolCalls.some(
            (tc) => tc.toolCallId === toolCallId,
          );
          if (!hasCall) return msg;

          targetDbId = msg.dbId;
          updatedToolCalls = msg.toolCalls.map((tc) =>
            tc.toolCallId === toolCallId ? { ...tc, status: "undone" } : tc,
          );
          return {
            ...msg,
            toolCalls: updatedToolCalls,
          };
        }),
      );

      if (targetDbId) {
        await updateChatMessageToolCalls(targetDbId, updatedToolCalls);
      }
    } else {
      toast.error(res.message);
    }
  };

  const handleRejectToolCall = async (toolCallId: string) => {
    toast.info("Veritabanı işlemi iptal edildi.");
    let targetDbId: number | undefined;
    let updatedToolCalls: PendingToolCall[] = [];

    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.toolCalls) return msg;
        const hasCall = msg.toolCalls.some(
          (tc) => tc.toolCallId === toolCallId,
        );
        if (!hasCall) return msg;

        targetDbId = msg.dbId;
        updatedToolCalls = msg.toolCalls.map((tc) =>
          tc.toolCallId === toolCallId ? { ...tc, status: "rejected" } : tc,
        );
        return {
          ...msg,
          toolCalls: updatedToolCalls,
        };
      }),
    );

    if (targetDbId) {
      await updateChatMessageToolCalls(targetDbId, updatedToolCalls);
    }
  };

  const handleSend = async (overrideQuery?: string) => {
    if (isSendingRef.current) return;
    const queryToSend = (overrideQuery ?? "").trim();
    if (!queryToSend || isLoading) return;

    isSendingRef.current = true;
    let sessionId = activeSessionId;

    if (!sessionId) {
      const title =
        queryToSend.length > 60
          ? queryToSend.slice(0, 60) + "..."
          : queryToSend;
      const createRes = await createChatSession(title);
      if (!createRes.success || !createRes.sessionId) {
        toast.error(createRes.error || "Sohbet oluşturulamadı.");
        isSendingRef.current = false;
        return;
      }
      sessionId = createRes.sessionId;
      setSession((prev) => ({ ...prev, activeSessionId: sessionId }));
      await loadSessions();
      syncUrlSession(sessionId);

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
    setSession((prev) => ({ ...prev, isLoading: true }));
    setStreaming({
      text: "",
      sources: undefined,
      toolCalls: undefined,
      persona: undefined,
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
        body: JSON.stringify({ query: queryToSend, history: historyPayload }),
      });

      if (!response.ok) {
        toast.error("Yanıt alınamadı.");
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedToolCalls: PendingToolCall[] = [];
      let assignedPersona: "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT" | undefined =
        undefined;

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
                timestamp: new Date().toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              };

              if (sessionId) {
                const saveRes = await saveChatMessage(
                  sessionId,
                  "model",
                  finalContent,
                  event.sources ?? undefined,
                  accumulatedToolCalls.length > 0
                    ? accumulatedToolCalls
                    : undefined,
                  finalPersona,
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
    } catch {
      toast.error("İletişim hatası oluştu.");
    } finally {
      setSession((prev) => ({ ...prev, isLoading: false }));
      setStreaming({
        text: "",
        sources: undefined,
        toolCalls: undefined,
        persona: undefined,
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

  return {
    messages,
    setMessages,
    isLoading,
    activeCitation,
    setActiveCitation,
    sessions,
    activeSessionId,
    streamingText: streaming.text,
    streamingSources: streaming.sources,
    streamingToolCalls: streaming.toolCalls,
    streamingPersona: streaming.persona,
    copiedMessageId,
    setCopiedMessageId,
    activeSource,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleApproveToolCall,
    handleUndoToolCall,
    handleRejectToolCall,
    handleSend,
    handleCitationPosition,
  };
}
