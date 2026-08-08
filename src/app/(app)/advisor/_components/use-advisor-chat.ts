import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

/**
 * Custom React hook managing Advisor Chat state, session switching, streaming SSE API interactions,
 * and database tool execution confirmations.
 *
 * @param initialSessionId - Optional session id to load on mount.
 * @returns State values and event handlers for the advisor chat component.
 */
export function useAdvisorChat(initialSessionId?: number) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<{
    messageId: string;
    sourceIndex: number;
  } | null>(null);

  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<
    RagSearchResultItem[] | undefined
  >(undefined);
  const [streamingToolCalls, setStreamingToolCalls] = useState<
    PendingToolCall[] | undefined
  >(undefined);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const isSendingRef = useRef(false);

  const loadSessions = useCallback(async () => {
    const list = await getChatSessions();
    setSessions(list);
  }, []);

  const loadMessages = useCallback(async (sessionId: number) => {
    const res = await getChatMessages(sessionId);
    if (res.success && res.messages) {
      const mapped: Message[] = res.messages.map((m) => ({
        id: `msg-${m.id}`,
        dbId: m.id,
        role: m.role as "user" | "model",
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
  }, []);

  const syncUrlSession = useCallback(
    (sessionId: number | null) => {
      if (sessionId !== null) {
        router.push(`/advisor?session=${sessionId}`);
      } else {
        router.push("/advisor");
      }
    },
    [router],
  );

  const prevInitialSessionIdRef = useRef<number | undefined>(initialSessionId);

  // Initial load of sessions list and active session on mount
  useEffect(() => {
    let cancelled = false;
    /** Loads the initial list of chat sessions and loads messages for initialSessionId if provided. */
    async function init() {
      const list = await getChatSessions();
      if (cancelled) return;
      setSessions(list);

      const targetId =
        initialSessionId !== undefined &&
        list.some((s) => s.id === initialSessionId)
          ? initialSessionId
          : null;

      if (targetId !== null) {
        setActiveSessionId(targetId);
        await loadMessages(targetId);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, loadMessages]);

  // Sync when initialSessionId route parameter changes (e.g. browser navigation)
  useEffect(() => {
    if (prevInitialSessionIdRef.current === initialSessionId) return;
    prevInitialSessionIdRef.current = initialSessionId;

    let cancelled = false;
    /** Syncs state when the initialSessionId prop changes due to route navigation. */
    async function syncFromProp() {
      const list = await getChatSessions();
      if (cancelled) return;
      setSessions(list);

      const targetId =
        initialSessionId !== undefined &&
        list.some((s) => s.id === initialSessionId)
          ? initialSessionId
          : null;

      if (targetId !== null) {
        if (activeSessionId !== targetId) {
          setActiveSessionId(targetId);
          await loadMessages(targetId);
        }
      } else if (activeSessionId !== null) {
        setActiveSessionId(null);
        setMessages([]);
        setActiveCitation(null);
      }
    }
    void syncFromProp();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, activeSessionId, loadMessages]);

  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      setActiveSessionId(sessionId);
      await loadMessages(sessionId);
      syncUrlSession(sessionId);
    },
    [loadMessages, syncUrlSession],
  );

  const handleCreateSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setActiveCitation(null);
    syncUrlSession(null);
  }, [syncUrlSession]);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      const res = await deleteChatSession(sessionId);
      if (res.success) {
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
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
    [activeSessionId, loadSessions, syncUrlSession],
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
    const queryToSend = (overrideQuery || inputQuery).trim();
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
      setActiveSessionId(sessionId);
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
    if (!overrideQuery) setInputQuery("");
    setIsLoading(true);
    setStreamingText("");
    setStreamingSources(undefined);
    setStreamingToolCalls(undefined);

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
            if (event.type === "delta") {
              setStreamingText((prev) => prev + event.text);
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
              setStreamingToolCalls([...accumulatedToolCalls]);
            } else if (event.type === "done") {
              setStreamingSources(event.sources);

              const modelMessageId = `model-${crypto.randomUUID()}`;
              const finalContent =
                event.text.trim() ||
                (accumulatedToolCalls.length > 0
                  ? "Aşağıdaki veritabanı işlemini gerçekleştirmek için onayınız isteniyor:"
                  : "");

              const modelMsg: Message = {
                id: modelMessageId,
                role: "model",
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
      setIsLoading(false);
      setStreamingText("");
      setStreamingSources(undefined);
      setStreamingToolCalls(undefined);
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
    [],
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
    inputQuery,
    setInputQuery,
    isLoading,
    activeCitation,
    setActiveCitation,
    sessions,
    activeSessionId,
    streamingText,
    streamingSources,
    streamingToolCalls,
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
