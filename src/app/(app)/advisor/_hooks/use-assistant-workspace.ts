"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Message } from "@/core/db/schema";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession,
  type ChatSessionListItem,
} from "../session-actions";
import { getChatMessages } from "../message-actions";
import { generateChatTitleAction } from "../title-actions";

interface UseAssistantWorkspaceOptions {
  initialSessionId?: number;
}

/**
 * State hook managing the Thesis Assistant workspace, session list,
 * chat message history, real-time SSE streaming, and RAG citation inspection.
 *
 * @param options - Configuration options including initial session ID.
 * @returns State properties and handler actions for the workspace.
 */
export function useAssistantWorkspace({
  initialSessionId,
}: UseAssistantWorkspaceOptions = {}) {
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    initialSessionId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Live streaming states
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<RagSearchResultItem[]>([]);
  const [streamingPersona, setStreamingPersona] = useState<string | undefined>(undefined);

  // Citation modal states
  const [activeCitation, setActiveCitation] = useState<RagSearchResultItem | null>(null);
  const [isCitationOpen, setIsCitationOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Refreshes the chat sessions list from the server.
   */
  const refreshSessions = useCallback(async () => {
    const res = await getChatSessions();
    if (res.success) {
      setSessions(res.data);
    } else {
      toast.error(res.error || "Oturumlar yüklenemedi.");
    }
  }, []);

  /**
   * Loads messages for a specific session ID.
   */
  const loadMessages = useCallback(async (sessionId: number) => {
    setIsLoadingMessages(true);
    try {
      const res = await getChatMessages(sessionId);
      if (res.success && res.messages) {
        setMessages(res.messages);
      } else {
        toast.error(res.error || "Mesajlar yüklenemedi.");
        setMessages([]);
      }
    } catch {
      toast.error("Mesajlar alınırken bir hata oluştu.");
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingSessions(true);
      const res = await getChatSessions();
      if (!mounted) return;
      if (res.success) {
        setSessions(res.data);
        if (initialSessionId) {
          setActiveSessionId(initialSessionId);
          await loadMessages(initialSessionId);
        } else if (res.data.length > 0) {
          // Default to most recent session
          const mostRecent = res.data[0];
          setActiveSessionId(mostRecent.id);
          window.history.replaceState(null, "", `/advisor/chat?session=${mostRecent.id}`);
          await loadMessages(mostRecent.id);
        }
      }
      setIsLoadingSessions(false);
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
      setActiveSessionId(sessionId);
      setStreamingText("");
      setStreamingSources([]);
      setStreamingPersona(undefined);
      window.history.replaceState(null, "", `/advisor/chat?session=${sessionId}`);
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
    setActiveSessionId(null);
    setMessages([]);
    setStreamingText("");
    setStreamingSources([]);
    setStreamingPersona(undefined);
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
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          handleNewSession();
        }
      } else {
        toast.error(res.error || "Oturum silinemedi.");
      }
    },
    [activeSessionId, handleNewSession],
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

      // Create session if none active
      if (!targetSessionId) {
        const createRes = await createChatSession("Yeni Sohbet");
        if (!createRes.success || !createRes.sessionId) {
          toast.error(createRes.error || "Yeni oturum oluşturulamadı.");
          return;
        }
        targetSessionId = createRes.sessionId;
        setActiveSessionId(targetSessionId);
        window.history.replaceState(null, "", `/advisor/chat?session=${targetSessionId}`);
      }

      // Optimistic user message
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

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setIsGenerating(true);
      setStreamingText("");
      setStreamingSources([]);
      setStreamingPersona(undefined);

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

        if (!response.body) {
          throw new Error("Yanıt akışı başlatılamadı.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResponseText = "";
        let finalSources: RagSearchResultItem[] = [];
        let finalPersona = "SOCRATIC_ADVISOR";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const block of lines) {
            const trimmedBlock = block.trim();
            if (!trimmedBlock.startsWith("data:")) continue;

            const jsonStr = trimmedBlock.replace(/^data:\s*/, "");
            try {
              const eventData = JSON.parse(jsonStr);

              if (eventData.type === "persona_assigned" && eventData.persona) {
                setStreamingPersona(eventData.persona);
                finalPersona = eventData.persona;
              } else if (eventData.type === "delta" && eventData.text) {
                finalResponseText += eventData.text;
                setStreamingText(finalResponseText);
              } else if (eventData.type === "done") {
                if (eventData.text) finalResponseText = eventData.text;
                if (eventData.sources) finalSources = eventData.sources;
                if (eventData.persona) finalPersona = eventData.persona;
              } else if (eventData.type === "error") {
                toast.error(eventData.error || "Akış hatası oluştu.");
              }
            } catch {
              // Ignore partial JSON parse errors in SSE chunks
            }
          }
        }

        // Add assistant message to local state
        const modelMsg: Message = {
          id: Date.now() + 1,
          sessionId: targetSessionId,
          role: "assistant",
          content: finalResponseText,
          persona: finalPersona,
          sources: finalSources,
          toolCalls: null,
          pipelineData: null,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, modelMsg]);

        // If this was the first message, generate a 3-5 word title in background
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
          err instanceof Error ? err.message : "Yanıt üretilirken bir hata oluştu.";
        toast.error(errorMsg);
      } finally {
        setIsGenerating(false);
        setStreamingText("");
        setStreamingSources([]);
        abortControllerRef.current = null;
      }
    },
    [activeSessionId, isGenerating, messages, refreshSessions],
  );

  const handleOpenCitation = useCallback((source: RagSearchResultItem) => {
    setActiveCitation(source);
    setIsCitationOpen(true);
  }, []);

  const handleCloseCitation = useCallback(() => {
    setIsCitationOpen(false);
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
    activeCitation,
    isCitationOpen,
    handleSelectSession,
    handleNewSession,
    handleDeleteSession,
    handleSendMessage,
    handleOpenCitation,
    handleCloseCitation,
  };
}
