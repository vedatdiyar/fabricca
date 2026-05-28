"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { sendMessageAction, ChatMessage } from "../actions";
import {
  getLibraryReferencesAction,
  saveInsightAction,
  ReferenceItem,
} from "../_services/db-actions";
import {
  useChatSessions,
  ChatMessageWithMetadata,
  ChatSession,
} from "./use-chat-sessions";
import { useThesisUpdates, PendingFunctionCall } from "./use-thesis-updates";

export type { ChatMessageWithMetadata, ChatSession, PendingFunctionCall };

interface AdvisorState {
  references: ReferenceItem[];
  selectedRefIds: number[];
  chatHistory: ChatMessageWithMetadata[];
  inputValue: string;
  isPending: boolean;
  loadingRefs: boolean;
  activeSidebarTab: "chats" | "sources";
  savedInsightIds: Set<number>;
}

const INITIAL_STATE: AdvisorState = {
  references: [],
  selectedRefIds: [],
  chatHistory: [],
  inputValue: "",
  isPending: false,
  loadingRefs: true,
  activeSidebarTab: "chats",
  savedInsightIds: new Set(),
};

export function useAdvisor() {
  const [state, setState] = useState<AdvisorState>(INITIAL_STATE);

  const setChatHistory = useCallback((value: React.SetStateAction<ChatMessageWithMetadata[]>) => {
    setState((prev) => ({
      ...prev,
      chatHistory: typeof value === "function" ? value(prev.chatHistory) : value,
    }));
  }, []);

  const setSelectedRefIds = useCallback((value: React.SetStateAction<number[]>) => {
    setState((prev) => ({
      ...prev,
      selectedRefIds: typeof value === "function" ? value(prev.selectedRefIds) : value,
    }));
  }, []);

  const setSavedInsightIds = useCallback((value: React.SetStateAction<Set<number>>) => {
    setState((prev) => ({
      ...prev,
      savedInsightIds: typeof value === "function" ? value(prev.savedInsightIds) : value,
    }));
  }, []);

  const setIsPending = useCallback((value: React.SetStateAction<boolean>) => {
    setState((prev) => ({
      ...prev,
      isPending: typeof value === "function" ? value(prev.isPending) : value,
    }));
  }, []);

  const setInputValue = useCallback((value: React.SetStateAction<string>) => {
    setState((prev) => ({
      ...prev,
      inputValue: typeof value === "function" ? value(prev.inputValue) : value,
    }));
  }, []);

  const setActiveSidebarTab = useCallback((value: React.SetStateAction<"chats" | "sources">) => {
    setState((prev) => ({
      ...prev,
      activeSidebarTab: typeof value === "function" ? value(prev.activeSidebarTab) : value,
    }));
  }, []);

  // Initialize the new chat sessions hook
  const {
    sessions,
    currentSessionId,
    updateActiveSession,
    handleSwitchSession,
    handleCreateNewSession,
    executeDeleteSession,
    executeClearAllChatHistory,
  } = useChatSessions({
    chatHistory: state.chatHistory,
    setChatHistory,
    selectedRefIds: state.selectedRefIds,
    setSelectedRefIds,
    setSavedInsightIds,
  });

  // Initialize the thesis updates hook
  const {
    pendingFunctionCall,
    setPendingFunctionCall,
    handleApproveUpdate,
    handleRejectUpdate,
  } = useThesisUpdates({
    chatHistory: state.chatHistory,
    selectedRefIds: state.selectedRefIds,
    setIsPending,
    updateActiveSession,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.chatHistory, state.isPending]);

  // Load references on mount
  useEffect(() => {
    async function loadRefs() {
      try {
        setState((prev) => ({ ...prev, loadingRefs: true }));
        const res = await getLibraryReferencesAction();
        if (res.success && res.references) {
          setState((prev) => ({ ...prev, references: res.references || [] }));
        }
      } catch (err) {
        console.error("Failed to load references:", err);
      } finally {
        setState((prev) => ({ ...prev, loadingRefs: false }));
      }
    }

    loadRefs();
  }, []);

  // Dynamically adjust textarea height based on typing
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [state.inputValue]);

  // Toggle selected reference IDs
  const handleToggleRef = (id: number) => {
    const nextRefs = state.selectedRefIds.includes(id)
      ? state.selectedRefIds.filter((refId) => refId !== id)
      : [...state.selectedRefIds, id];
    updateActiveSession(state.chatHistory, nextRefs);
  };

  const handleSelectAllRefs = () => {
    const nextRefs = state.references.map((r) => r.id);
    updateActiveSession(state.chatHistory, nextRefs);
  };

  const handleClearAllRefs = () => {
    updateActiveSession(state.chatHistory, []);
  };

  // Send message handler
  const handleSendMessage = async () => {
    if (!state.inputValue.trim() || state.isPending) return;

    const userMessageText = state.inputValue.trim();
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Add user message locally
    const updatedHistory = [
      ...state.chatHistory,
      {
        id:
          "msg_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substring(2, 7) +
          "_user",
        role: "user" as const,
        content: userMessageText,
        timestamp: currentTime,
      },
    ];
    updateActiveSession(updatedHistory);
    setState((prev) => ({
      ...prev,
      inputValue: "",
      isPending: true,
    }));

    // 2. Map history to server action format (without local frontend metadata like timestamp)
    const serverHistory: ChatMessage[] = updatedHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
      functionCall: msg.functionCall,
      functionResponse: msg.functionResponse,
    }));

    // 3. Trigger Server Action
    try {
      const res = await sendMessageAction(
        userMessageText,
        serverHistory,
        state.selectedRefIds,
      );
      if (res.success && res.functionCall) {
        setPendingFunctionCall({
          name: res.functionCall.name,
          args: res.functionCall.args as PendingFunctionCall["args"],
          id: res.functionCall.id,
          thoughtSignature: res.functionCall.thoughtSignature,
        });

        const finalHistory: ChatMessageWithMetadata[] = [
          ...updatedHistory,
          {
            id:
              "msg_" +
              Date.now() +
              "_" +
              Math.random().toString(36).substring(2, 7) +
              "_assistant",
            role: "assistant",
            content:
              res.response ||
              "Tezinizin ilgili bölümünü güncellemek için bir öneri hazırladım. Aşağıdaki panelden onaylayabilir veya reddedebilirsiniz.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            functionCall: {
              name: res.functionCall.name,
              args: res.functionCall.args,
              id: res.functionCall.id,
              thoughtSignature: res.functionCall.thoughtSignature,
            },
          },
        ];
        updateActiveSession(finalHistory);
      } else if (res.success && res.response) {
        const finalHistory: ChatMessageWithMetadata[] = [
          ...updatedHistory,
          {
            id:
              "msg_" +
              Date.now() +
              "_" +
              Math.random().toString(36).substring(2, 7) +
              "_assistant",
            role: "assistant",
            content: res.response!,
            sources: res.sources,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ];
        updateActiveSession(finalHistory);
      } else {
        toast.error(res.error || "Hoca yanıt veremedi, bir sorun oluştu.");
      }
    } catch {
      toast.error("Sunucu hatası: Mesaj iletilemedi.");
    } finally {
      setState((prev) => ({ ...prev, isPending: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Save brilliant insight into Fikir Sepeti
  const handleSaveInsight = async (text: string, messageIndex: number) => {
    if (state.savedInsightIds.has(messageIndex)) {
      toast.warning("Bu öngörü zaten fikir sepetinizde bulunuyor.");
      return;
    }

    try {
      const res = await saveInsightAction(text);
      if (res.success) {
        setState((prev) => {
          const next = new Set(prev.savedInsightIds);
          next.add(messageIndex);
          return {
            ...prev,
            savedInsightIds: next,
          };
        });
        toast.success(
          "Parlak fikir başarıyla fikir sepetine (Insights) eklendi! ✨",
        );
      } else {
        toast.error(res.error || "Fikir kaydedilemedi.");
      }
    } catch {
      toast.error("Bağlantı hatası: Fikir kaydedilemedi.");
    }
  };

  return {
    references: state.references,
    selectedRefIds: state.selectedRefIds,
    chatHistory: state.chatHistory,
    inputValue: state.inputValue,
    setInputValue,
    isPending: state.isPending,
    loadingRefs: state.loadingRefs,
    sessions,
    currentSessionId,
    activeSidebarTab: state.activeSidebarTab,
    setActiveSidebarTab,
    savedInsightIds: state.savedInsightIds,
    messagesEndRef,
    textareaRef,
    pendingFunctionCall,
    handleToggleRef,
    handleSelectAllRefs,
    handleClearAllRefs,
    handleSwitchSession,
    handleCreateNewSession,
    executeDeleteSession,
    executeClearAllChatHistory,
    handleSendMessage,
    handleKeyDown,
    handleSaveInsight,
    handleApproveUpdate,
    handleRejectUpdate,
  };
}
