"use client";

import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { CitationSource } from "../actions";

export interface ChatMessageWithMetadata {
  id?: string;
  role: "user" | "assistant" | "model";
  content: string;
  sources?: CitationSource[];
  timestamp: string;
  functionCall?: {
    name: string;
    args: unknown;
    id: string;
    thoughtSignature?: string;
  };
  functionResponse?: {
    name: string;
    response: unknown;
    id: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageWithMetadata[];
  selectedRefIds: number[];
  createdAt: string;
}

export interface UseChatSessionsProps {
  chatHistory: ChatMessageWithMetadata[];
  setChatHistory: Dispatch<SetStateAction<ChatMessageWithMetadata[]>>;
  selectedRefIds: number[];
  setSelectedRefIds: Dispatch<SetStateAction<number[]>>;
  setSavedInsightIds: Dispatch<SetStateAction<Set<number>>>;
}

// Module-level cache to ensure synchronized initialization of sessions and active session ID on the client.
let cachedInitialData: {
  sessions: ChatSession[];
  currentSessionId: string;
} | null = null;

function getInitialChatData(): {
  sessions: ChatSession[];
  currentSessionId: string;
} {
  if (typeof window === "undefined") {
    return { sessions: [], currentSessionId: "" };
  }
  if (cachedInitialData) {
    return cachedInitialData;
  }

  const savedSessions = localStorage.getItem("fabricca_chat_sessions");
  const savedCurrentId = localStorage.getItem("fabricca_current_session_id");

  let loadedSessions: ChatSession[] = [];
  if (savedSessions) {
    try {
      loadedSessions = JSON.parse(savedSessions) as ChatSession[];
      // Ensure all loaded messages have a stable unique ID
      loadedSessions.forEach((session) => {
        if (session.messages) {
          session.messages = session.messages.map((msg, idx) => ({
            ...msg,
            id:
              msg.id ||
              `msg_${session.id}_${idx}_${msg.timestamp.replace(/[^a-zA-Z0-9]/g, "")}`,
          }));
        }
      });
    } catch (error) {
      console.error("Failed to parse chat sessions:", error);
    }
  }

  if (loadedSessions.length === 0) {
    const welcomeMessage: ChatMessageWithMetadata = {
      id: "welcome_default",
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

    const defaultSessionId = "default_" + Date.now();
    const defaultSession: ChatSession = {
      id: defaultSessionId,
      title: "Yeni Sohbet",
      messages: [
        {
          ...welcomeMessage,
          id: `welcome_${defaultSessionId}`,
        },
      ],
      selectedRefIds: [],
      createdAt: new Date().toLocaleString(),
    };

    loadedSessions = [defaultSession];
    cachedInitialData = {
      sessions: loadedSessions,
      currentSessionId: defaultSession.id,
    };
    return cachedInitialData;
  }

  let activeId = savedCurrentId || loadedSessions[0].id;
  if (!loadedSessions.some((s) => s.id === activeId)) {
    activeId = loadedSessions[0].id;
  }

  cachedInitialData = { sessions: loadedSessions, currentSessionId: activeId };
  return cachedInitialData;
}

export function useChatSessions({
  chatHistory,
  setChatHistory,
  selectedRefIds,
  setSelectedRefIds,
  setSavedInsightIds,
}: UseChatSessionsProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(
    () => getInitialChatData().sessions,
  );
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    () => getInitialChatData().currentSessionId,
  );

  useEffect(() => {
    const activeSession = sessions.find((s) => s.id === currentSessionId);
    if (activeSession) {
      setChatHistory(activeSession.messages);
      setSelectedRefIds(activeSession.selectedRefIds || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      id: "welcome_" + newSessionId,
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
        id: "welcome_" + sessions[0].id,
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
    cachedInitialData = null;
    setSavedInsightIds(new Set());

    const welcomeMessage: ChatMessageWithMetadata = {
      id: "welcome_clear",
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

    const defaultSessionId = "default_" + Date.now();
    const defaultSession: ChatSession = {
      id: defaultSessionId,
      title: "Yeni Sohbet",
      messages: [
        {
          ...welcomeMessage,
          id: `welcome_${defaultSessionId}`,
        },
      ],
      selectedRefIds: [],
      createdAt: new Date().toLocaleString(),
    };

    setSessions([defaultSession]);
    setCurrentSessionId(defaultSession.id);
    setChatHistory([welcomeMessage]);
    setSelectedRefIds([]);
    toast.success("Tüm sohbet geçmişi temizlendi.");
  };

  return {
    sessions,
    currentSessionId,
    setSessions,
    setCurrentSessionId,
    updateActiveSession,
    handleSwitchSession,
    handleCreateNewSession,
    executeDeleteSession,
    executeClearAllChatHistory,
  };
}
