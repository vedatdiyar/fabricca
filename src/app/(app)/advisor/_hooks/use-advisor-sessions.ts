"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getChatSessions,
  getChatMessages,
  deleteChatSession,
  createChatSession,
  type ChatSessionListItem,
} from "../actions";
import type { PendingToolCall } from "../_components/tool-confirmation-card";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { PipelineResult } from "@/app/(app)/advisor/_services/pipeline/types";
import type { AdvisorPersona } from "@/app/(app)/advisor/_services/classifier";
import type { Message } from "../_lib/types";

/** Sentinel used to trigger the initial session sync on mount regardless of the initial id value. */
const PREV_SESSION_SENTINEL = Symbol("prev-session-sentinel");

interface UseAdvisorSessionsParams {
  initialSessionId?: number;
  isSendingRef: { current: boolean };
}

/**
 * Manages the advisor chat session list, the active session and its messages, plus URL sync and session persistence.
 *
 * @param root0 - Hook dependencies.
 * @param root0.initialSessionId - Session id to restore on mount, if any.
 * @param root0.isSendingRef - Shared ref signalling an in-flight message send.
 * @returns Session state and session lifecycle handlers.
 */
export function useAdvisorSessions({
  initialSessionId,
  isSendingRef,
}: UseAdvisorSessionsParams) {
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessagesState] = useState<Message[]>([]);

  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [],
  );

  const loadSessions = useCallback(async () => {
    const res = await getChatSessions();
    if (res.success) {
      setSessions(res.data);
    } else {
      toast.error(res.error);
    }
  }, []);

  const syncUrlSession = useCallback((sessionId: number | null) => {
    const url =
      sessionId !== null ? `/advisor?session=${sessionId}` : "/advisor";
    window.history.replaceState(null, "", url);
  }, []);

  const loadMessages = useCallback(
    async (sessionId: number) => {
      const res = await getChatMessages(sessionId);
      if (res.success && res.messages) {
        const mapped: Message[] = res.messages.map((m) => ({
          id: `msg-${m.id}`,
          dbId: m.id,
          role: m.role as "user" | "model",
          persona: (m.persona as AdvisorPersona | undefined) ?? undefined,
          content: m.content,
          sources:
            (m.sources as RagSearchResultItem[] | undefined) ?? undefined,
          toolCalls:
            (m.toolCalls as PendingToolCall[] | undefined) ?? undefined,
          pipeline: (m.pipelineData as PipelineResult | undefined) ?? undefined,
          timestamp: m.createdAt.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setMessages(mapped);
      } else {
        setMessages([]);
      }
    },
    [setMessages],
  );

  const prevInitialSessionIdRef = useRef<number | undefined | symbol>(
    PREV_SESSION_SENTINEL,
  );
  const activeSessionIdRef = useRef(activeSessionId);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Load sessions and the active session on mount, and resync when the initialSessionId route parameter changes (e.g. browser navigation).
  useEffect(() => {
    if (prevInitialSessionIdRef.current === initialSessionId) return;
    const isFirstMount =
      prevInitialSessionIdRef.current === PREV_SESSION_SENTINEL;
    prevInitialSessionIdRef.current = initialSessionId;

    let cancelled = false;
    /** Loads the session list and messages for the target session id if provided. */
    async function syncFromProp() {
      if (isSendingRef.current) return;
      const res = await getChatSessions();
      if (cancelled) return;
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const list = res.data;
      setSessions(list);

      if (initialSessionId !== undefined) {
        const sessionExists = list.some((s) => s.id === initialSessionId);
        if (sessionExists) {
          if (activeSessionIdRef.current !== initialSessionId) {
            setActiveSessionId(initialSessionId);
            await loadMessages(initialSessionId);
          }
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      } else if (!isFirstMount && activeSessionIdRef.current !== null) {
        setActiveSessionId(null);
        setMessages([]);
      }
    }

    void syncFromProp();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, loadMessages, setMessages, isSendingRef]);

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
    syncUrlSession(null);
  }, [setMessages, syncUrlSession]);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      const res = await deleteChatSession(sessionId);
      if (res.success) {
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
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
    [activeSessionId, setMessages, loadSessions, syncUrlSession],
  );

  /**
   * Persists a new chat session, activates it and syncs the URL for the send flow.
   *
   * @param title - The display title for the new session.
   * @returns The created session id, or null when creation failed.
   */
  const createChatSessionAndActivate = useCallback(
    async (title: string): Promise<number | null> => {
      const createRes = await createChatSession(title);
      if (!createRes.success || !createRes.sessionId) {
        toast.error(createRes.error || "Sohbet oluşturulamadı.");
        return null;
      }
      setActiveSessionId(createRes.sessionId);
      await loadSessions();
      syncUrlSession(createRes.sessionId);
      return createRes.sessionId;
    },
    [loadSessions, syncUrlSession],
  );

  return {
    sessions,
    activeSessionId,
    messages,
    setMessages,
    loadSessions,
    loadMessages,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    syncUrlSession,
    createChatSessionAndActivate,
  };
}
