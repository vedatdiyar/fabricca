"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getLibraryReferencesAction,
  sendMessageAction,
  saveInsightAction,
  ReferenceItem,
  ChatMessage,
  CitationSource,
} from "../actions";

export interface ChatMessageWithMetadata {
  role: "user" | "assistant" | "model";
  content: string;
  sources?: CitationSource[];
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageWithMetadata[];
  selectedRefIds: number[];
  createdAt: string;
}

export function useAdvisor() {
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<number[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessageWithMetadata[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Multi-session chat history states
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [activeSidebarTab, setActiveSidebarTab] = useState<"chats" | "sources">(
    "chats",
  );

  const [savedInsightIds, setSavedInsightIds] = useState<Set<number>>(
    new Set(),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isPending]);

  // Load references and localStorage on mount
  useEffect(() => {
    async function initPage() {
      // 1. Load references
      try {
        setLoadingRefs(true);
        const res = await getLibraryReferencesAction();
        if (res.success && res.references) {
          setReferences(res.references);
        }
      } catch (err) {
        console.error("Failed to load references:", err);
      } finally {
        setLoadingRefs(false);
      }

      // 2. Load persistent chat sessions from localStorage
      const savedSessions = localStorage.getItem("fabricca_chat_sessions");
      const savedCurrentId = localStorage.getItem(
        "fabricca_current_session_id",
      );

      let loadedSessions: ChatSession[] = [];
      let activeId = "";

      if (savedSessions) {
        try {
          loadedSessions = JSON.parse(savedSessions);
        } catch (e) {
          console.error("Failed to parse chat sessions:", e);
        }
      }

      // If no saved sessions, create a default one
      if (loadedSessions.length === 0) {
        const welcomeMessage: ChatMessageWithMetadata = {
          role: "assistant",
          content:
            "Hoş geldin Vedat. Burası **Dijital Danışman Odası**.\n\n" +
            "Tez çalışmanızın hangi aşamasındasınız? Kütüphanenizdeki makaleleri sol panelden seçerek doğrudan bu kaynaklara yönelik **RAG destekli semantik sorular** sorabilir ya da genel sosyal teoriler ve kavramsal çerçeveler, araştırma yöntemleri ve tez kurgusu üzerine doğrudan **kuramsal/metodolojik tartışmalar** yürütebiliriz.\n\n" +
            "Size nasıl yardımcı olabilirim?",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        const defaultSession: ChatSession = {
          id: "default_" + Date.now(),
          title: "Yeni Sohbet",
          messages: [welcomeMessage],
          selectedRefIds: [],
          createdAt: new Date().toLocaleString(),
        };

        loadedSessions = [defaultSession];
        activeId = defaultSession.id;
      } else {
        activeId = savedCurrentId || loadedSessions[0].id;
        if (!loadedSessions.some((s) => s.id === activeId)) {
          activeId = loadedSessions[0].id;
        }
      }

      setSessions(loadedSessions);
      setCurrentSessionId(activeId);

      const activeSession = loadedSessions.find((s) => s.id === activeId);
      if (activeSession) {
        setChatHistory(activeSession.messages);
        setSelectedRefIds(activeSession.selectedRefIds || []);
      }
    }

    initPage();
  }, []);

  // Dynamically adjust textarea height based on typing
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  // Helper to save active session's message logs and selections in one central spot
  const updateActiveSession = (
    newMessages: ChatMessageWithMetadata[],
    newRefIds?: number[],
  ) => {
    const refIdsToSave = newRefIds !== undefined ? newRefIds : selectedRefIds;

    let sessionTitle = "Yeni Sohbet";
    const activeSess = sessions.find((s) => s.id === currentSessionId);
    if (activeSess) {
      sessionTitle = activeSess.title;
    }

    // Rename chat automatically on first user question
    if (sessionTitle === "Yeni Sohbet") {
      const firstUserMsg = newMessages.find((m) => m.role === "user");
      if (firstUserMsg) {
        sessionTitle =
          firstUserMsg.content.substring(0, 30) +
          (firstUserMsg.content.length > 30 ? "..." : "");
      }
    }

    const updatedSessions = sessions.map((s) => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          title: sessionTitle,
          messages: newMessages,
          selectedRefIds: refIdsToSave,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    setChatHistory(newMessages);
    if (newRefIds !== undefined) {
      setSelectedRefIds(newRefIds);
    }

    localStorage.setItem(
      "fabricca_chat_sessions",
      JSON.stringify(updatedSessions),
    );
  };

  // Toggle selected reference IDs
  const handleToggleRef = (id: number) => {
    const nextRefs = selectedRefIds.includes(id)
      ? selectedRefIds.filter((refId) => refId !== id)
      : [...selectedRefIds, id];
    updateActiveSession(chatHistory, nextRefs);
  };

  const handleSelectAllRefs = () => {
    const nextRefs = references.map((r) => r.id);
    updateActiveSession(chatHistory, nextRefs);
  };

  const handleClearAllRefs = () => {
    updateActiveSession(chatHistory, []);
  };

  // Switch between existing chat sessions
  const handleSwitchSession = (sessionId: string) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;

    // Save current active session data to sessions array before switching
    const updatedSessions = sessions.map((s) => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: chatHistory,
          selectedRefIds: selectedRefIds,
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    setCurrentSessionId(sessionId);
    setChatHistory(targetSession.messages);
    setSelectedRefIds(targetSession.selectedRefIds || []);
    localStorage.setItem("fabricca_current_session_id", sessionId);
    localStorage.setItem(
      "fabricca_chat_sessions",
      JSON.stringify(updatedSessions),
    );
  };

  // Create a brand new empty chat session
  const handleCreateNewSession = () => {
    const newSessionId = "session_" + Date.now();
    const welcomeMessage: ChatMessageWithMetadata = {
      role: "assistant",
      content:
        "Hoş geldin Vedat. Burası **Dijital Danışman Odası**.\n\n" +
        "Tez çalışmanızın hangi aşamasındasınız? Kütüphanenizdeki makaleleri sol panelden seçerek doğrudan bu kaynaklara yönelik **RAG destekli semantik sorular** sorabilir ya da genel sosyal teoriler (Marx, Foucault, biopolitika, finansallaşma vb.), araştırma yöntemleri ve tez kurgusu üzerine doğrudan **kuramsal/metodolojik tartışmalar** yürütebiliriz.\n\n" +
        "Size nasıl yardımcı olabilirim?",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const newSession: ChatSession = {
      id: newSessionId,
      title: "Yeni Sohbet",
      messages: [welcomeMessage],
      selectedRefIds: [],
      createdAt: new Date().toLocaleString(),
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSessionId(newSessionId);
    setChatHistory([welcomeMessage]);
    setSelectedRefIds([]);

    localStorage.setItem("fabricca_current_session_id", newSessionId);
    localStorage.setItem(
      "fabricca_chat_sessions",
      JSON.stringify(updatedSessions),
    );
    toast.success("Yeni sohbet oluşturuldu.");
  };

  // Delete a specific chat session
  const executeDeleteSession = (sessionId: string) => {
    if (sessions.length === 1) {
      const welcomeMessage: ChatMessageWithMetadata = {
        role: "assistant",
        content:
          "Hoş geldin Vedat. Burası **Dijital Danışman Odası**.\n\n" +
          "Tez çalışmanızın hangi aşamasındasınız? Kütüphanenizdeki makaleleri sol panelden seçerek doğrudan bu kaynaklara yönelik **RAG destekli semantik sorular** sorabilir ya da genel sosyal teoriler (Marx, Foucault, biopolitika, finansallaşma vb.), araştırma yöntemleri ve tez kurgusu üzerine doğrudan **kuramsal/metodolojik tartışmalar** yürütebiliriz.\n\n" +
          "Size nasıl yardımcı olabilirim?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const updatedSession = {
        ...sessions[0],
        title: "Yeni Sohbet",
        messages: [welcomeMessage],
        selectedRefIds: [],
      };

      setSessions([updatedSession]);
      setChatHistory([welcomeMessage]);
      setSelectedRefIds([]);
      localStorage.setItem(
        "fabricca_chat_sessions",
        JSON.stringify([updatedSession]),
      );
      toast.success("Sohbet temizlendi.");
      return;
    }

    const updatedSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(updatedSessions);

    if (sessionId === currentSessionId) {
      const remainingSession = updatedSessions[0];
      setCurrentSessionId(remainingSession.id);
      setChatHistory(remainingSession.messages);
      setSelectedRefIds(remainingSession.selectedRefIds || []);
      localStorage.setItem("fabricca_current_session_id", remainingSession.id);
    }

    localStorage.setItem(
      "fabricca_chat_sessions",
      JSON.stringify(updatedSessions),
    );
    toast.success("Sohbet silindi.");
  };

  // Clear ALL chat history sessions
  const executeClearAllChatHistory = () => {
    localStorage.removeItem("fabricca_chat_sessions");
    localStorage.removeItem("fabricca_current_session_id");
    setSavedInsightIds(new Set());

    const welcomeMessage: ChatMessageWithMetadata = {
      role: "assistant",
      content:
        "Hoş geldin Vedat. Burası **Dijital Danışman Odası**.\n\n" +
        "Tez çalışmanızın hangi aşamasındasınız? Kütüphanenizdeki makaleleri sol panelden seçerek doğrudan bu kaynaklara yönelik **RAG destekli semantik sorular** sorabilir ya da genel sosyal teoriler (Marx, Foucault, biopolitika, finansallaşma vb.), araştırma yöntemleri ve tez kurgusu üzerine doğrudan **kuramsal/metodolojik tartışmalar** yürütebiliriz.\n\n" +
        "Size nasıl yardımcı olabilirim?",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const defaultSession: ChatSession = {
      id: "default_" + Date.now(),
      title: "Yeni Sohbet",
      messages: [welcomeMessage],
      selectedRefIds: [],
      createdAt: new Date().toLocaleString(),
    };

    setSessions([defaultSession]);
    setCurrentSessionId(defaultSession.id);
    setChatHistory([welcomeMessage]);
    setSelectedRefIds([]);
    toast.success("Tüm sohbet geçmişi temizlendi.");
  };

  // Send message handler
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isPending) return;

    const userMessageText = inputValue.trim();
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Add user message locally
    const updatedHistory = [
      ...chatHistory,
      {
        role: "user" as const,
        content: userMessageText,
        timestamp: currentTime,
      },
    ];
    updateActiveSession(updatedHistory);
    setInputValue("");
    setIsPending(true);

    // 2. Map history to server action format (without local frontend metadata like timestamp)
    const serverHistory: ChatMessage[] = updatedHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 3. Trigger Server Action
    try {
      const res = await sendMessageAction(
        userMessageText,
        serverHistory,
        selectedRefIds,
      );
      if (res.success && res.response) {
        const finalHistory: ChatMessageWithMetadata[] = [
          ...updatedHistory,
          {
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
    } catch (err: any) {
      toast.error("Sunucu hatası: Mesaj iletilemedi.");
    } finally {
      setIsPending(false);
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
    if (savedInsightIds.has(messageIndex)) {
      toast.warning("Bu öngörü zaten fikir sepetinizde bulunuyor.");
      return;
    }

    try {
      const res = await saveInsightAction(text);
      if (res.success) {
        setSavedInsightIds((prev) => {
          const next = new Set(prev);
          next.add(messageIndex);
          return next;
        });
        toast.success(
          "Parlak fikir başarıyla fikir sepetine (Insights) eklendi! ✨",
        );
      } else {
        toast.error(res.error || "Fikir kaydedilemedi.");
      }
    } catch (err) {
      toast.error("Bağlantı hatası: Fikir kaydedilemedi.");
    }
  };

  return {
    references,
    selectedRefIds,
    chatHistory,
    inputValue,
    setInputValue,
    isPending,
    loadingRefs,
    sessions,
    currentSessionId,
    activeSidebarTab,
    setActiveSidebarTab,
    savedInsightIds,
    messagesEndRef,
    textareaRef,
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
  };
}
