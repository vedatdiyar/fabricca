"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getOfficeInitialDataAction,
  getOfficeSessionDetailAction,
  type OutlineOption,
  type OfficeSessionSummary,
} from "../office-actions";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../_services/pipeline/types";
import type { DefenseMessage } from "../_components/office-defense-chat";
import { createStreamFlusher } from "../_lib/stream-flusher";

/**
 * Manages Danışmanın Çalışma Odası workspace state, data loading, review submission and live defense streaming.
 *
 * @param initialSessionId - Optional session id to preload on mount.
 * @returns Workspace state, setters and action handlers.
 */
export function useAdvisorOfficeWorkspace(initialSessionId?: number) {
  const [initialData, setInitialData] = useState<{
    isLoading: boolean;
    outlines: OutlineOption[];
    sessions: OfficeSessionSummary[];
  }>({
    isLoading: true,
    outlines: [],
    sessions: [],
  });

  const [sessionDetail, setSessionDetail] = useState<{
    activeSessionId: number | null;
    currentReport: OfficeReviewReport | null;
    activeOutlineId: number | null;
    activeOutlineTitle: string;
  }>({
    activeSessionId: initialSessionId || null,
    currentReport: null,
    activeOutlineId: null,
    activeOutlineTitle: "",
  });

  const [defenseState, setDefenseState] = useState<{
    messages: DefenseMessage[];
    hasStarted: boolean;
    isStreaming: boolean;
    activeCritique: JuryCritique | null;
  }>({
    messages: [],
    hasStarted: false,
    isStreaming: false,
    activeCritique: null,
  });

  const [uiState, setUiState] = useState<{
    isSubmittingReview: boolean;
    isDefenseModalOpen: boolean;
    mobileSubmissionTab: "form" | "history";
  }>({
    isSubmittingReview: false,
    isDefenseModalOpen: false,
    mobileSubmissionTab: "form",
  });

  const loadSessionDetail = useCallback(
    async (sessionId: number, outlineList?: OutlineOption[]) => {
      try {
        const res = await getOfficeSessionDetailAction(sessionId);
        if (res.success && res.data) {
          const detail = res.data;
          const outlineMatch = outlineList?.find(
            (o) => o.id === detail.outlineId,
          );

          setSessionDetail({
            activeSessionId: detail.id,
            currentReport: detail.reviewReport,
            activeOutlineId: detail.outlineId,
            activeOutlineTitle:
              detail.outlineTitle || outlineMatch?.title || "Tez Bölümü",
          });

          if (typeof window !== "undefined") {
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get("session") !== String(detail.id)) {
              window.history.pushState(
                null,
                "",
                `/advisor/draft-review?session=${detail.id}`,
              );
            }
          }

          setUiState((prev) => ({ ...prev, mobileSubmissionTab: "form" }));

          const chatMsgs: DefenseMessage[] = detail.messages
            .filter(
              (m) =>
                m.role === "user" ||
                (m.role === "assistant" && !m.pipelineData),
            )
            .map((m) => ({
              id: m.id,
              role: m.role as "assistant" | "user",
              content: m.content,
              createdAt: m.createdAt,
            }));

          setDefenseState({
            messages: chatMsgs,
            hasStarted: chatMsgs.length > 0,
            isStreaming: false,
            activeCritique: null,
          });
        } else {
          toast.error(res.error || "Oturum detayları yüklenemedi.");
        }
      } catch {
        toast.error("Oturum yüklenirken bir hata oluştu.");
      }
    },
    [],
  );

  const handleResetToNewSubmission = useCallback(() => {
    setSessionDetail({
      activeSessionId: null,
      currentReport: null,
      activeOutlineId: null,
      activeOutlineTitle: "",
    });
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has("session")) {
        window.history.pushState(null, "", "/advisor/draft-review");
      }
    }
    setDefenseState({
      messages: [],
      hasStarted: false,
      isStreaming: false,
      activeCritique: null,
    });
    setUiState({
      isSubmittingReview: false,
      isDefenseModalOpen: false,
      mobileSubmissionTab: "form",
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const res = await getOfficeInitialDataAction();
        if (!isMounted) return;
        if (res.success) {
          setInitialData({
            isLoading: false,
            outlines: res.outlines,
            sessions: res.sessions,
          });

          if (initialSessionId) {
            const detailRes =
              await getOfficeSessionDetailAction(initialSessionId);
            if (isMounted && detailRes.success && detailRes.data) {
              const detail = detailRes.data;
              const outlineMatch = res.outlines.find(
                (o) => o.id === detail.outlineId,
              );
              setSessionDetail({
                activeSessionId: detail.id,
                currentReport: detail.reviewReport,
                activeOutlineId: detail.outlineId,
                activeOutlineTitle:
                  detail.outlineTitle || outlineMatch?.title || "Tez Bölümü",
              });
              const chatMsgs: DefenseMessage[] = detail.messages
                .filter(
                  (m) =>
                    m.role === "user" ||
                    (m.role === "assistant" && !m.pipelineData),
                )
                .map((m) => ({
                  id: m.id,
                  role: m.role as "assistant" | "user",
                  content: m.content,
                  createdAt: m.createdAt,
                }));
              setDefenseState({
                messages: chatMsgs,
                hasStarted: chatMsgs.length > 0,
                isStreaming: false,
                activeCritique: null,
              });
            }
          }
        } else {
          toast.error(res.error || "Başlangıç verileri yüklenemedi.");
          setInitialData((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        if (isMounted) {
          toast.error("Danışman masası yüklenirken bir hata oluştu.");
          setInitialData((prev) => ({ ...prev, isLoading: false }));
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [initialSessionId]);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get("session");
      if (sessionParam && /^\d+$/.test(sessionParam)) {
        const sid = Number(sessionParam);
        loadSessionDetail(sid, initialData.outlines);
      } else {
        handleResetToNewSubmission();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialData.outlines, loadSessionDetail, handleResetToNewSubmission]);

  const handleReviewSubmit = async (data: {
    outlineId: number;
    draftText: string;
  }) => {
    setUiState((prev) => ({ ...prev, isSubmittingReview: true }));
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVIEW",
          outlineId: data.outlineId,
          draftText: data.draftText,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Taslak denetimi başarısız oldu.");
      }

      const outlineMatch = initialData.outlines.find(
        (o) => o.id === data.outlineId,
      );

      setSessionDetail({
        activeSessionId: json.sessionId,
        currentReport: json.reviewReport,
        activeOutlineId: data.outlineId,
        activeOutlineTitle: outlineMatch?.title || "Tez Bölümü",
      });

      if (typeof window !== "undefined") {
        window.history.pushState(
          null,
          "",
          `/advisor/draft-review?session=${json.sessionId}`,
        );
      }

      setDefenseState({
        messages: [],
        hasStarted: false,
        isStreaming: false,
        activeCritique: null,
      });

      setUiState((prev) => ({
        ...prev,
        isDefenseModalOpen: false,
      }));

      const initialRes = await getOfficeInitialDataAction();
      if (initialRes.success) {
        setInitialData((prev) => ({
          ...prev,
          sessions: initialRes.sessions,
        }));
      }

      toast.success(
        "Taslak incelendi. Kenar notları ve jüri eleştirileri hazır!",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Taslak incelenirken hata oluştu.",
      );
    } finally {
      setUiState((prev) => ({ ...prev, isSubmittingReview: false }));
    }
  };

  const handleSendDefenseMessage = async (userMessage?: string) => {
    const sessionId = sessionDetail.activeSessionId;
    if (!sessionId || defenseState.isStreaming) return;

    if (userMessage) {
      const userMsgItem: DefenseMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        createdAt: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setDefenseState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsgItem],
      }));
    }

    setDefenseState((prev) => ({ ...prev, isStreaming: true }));

    const tempAdvisorId = `advisor-${Date.now()}`;
    const streamingMsgItem: DefenseMessage = {
      id: tempAdvisorId,
      role: "assistant",
      content: "",
      isStreaming: true,
      createdAt: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setDefenseState((prev) => ({
      ...prev,
      messages: [...prev.messages, streamingMsgItem],
    }));

    const flusher = createStreamFlusher();

    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DEFENSE",
          sessionId,
          userMessage,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Danışman yanıtı alınamadı.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Buffered SSE framing per spec: frames are separated by a blank
        // line and may span multiple network chunks; keep the remainder.
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const trimmedFrame = frame.trim();
          if (!trimmedFrame.startsWith("data:")) continue;
          const dataStr = trimmedFrame.replace(/^data:\s*/, "");
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (
              (parsed.type === "delta" || parsed.type === "chunk") &&
              parsed.text
            ) {
              accumulatedText += parsed.text;
              flusher.schedule(() => {
                setDefenseState((prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === tempAdvisorId
                      ? { ...m, content: accumulatedText }
                      : m,
                  ),
                }));
              });
            }
          } catch {
            // Ignore non-json frames
          }
        }
      }

      // Flush any final unterminated frame left in the remainder buffer.
      const tail = buffer.trim();
      if (tail.startsWith("data:")) {
        const dataStr = tail.replace(/^data:\s*/, "");
        if (dataStr && dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            if (
              (parsed.type === "delta" || parsed.type === "chunk") &&
              parsed.text
            ) {
              accumulatedText += parsed.text;
            }
          } catch {
            // Ignore non-json tail frame
          }
        }
      }

      flusher.flushNow();

      setDefenseState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === tempAdvisorId
            ? { ...m, content: accumulatedText, isStreaming: false }
            : m,
        ),
      }));
    } catch {
      toast.error("Danışman yanıt verirken bir hata oluştu.");
      setDefenseState((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== tempAdvisorId),
      }));
    } finally {
      flusher.cancel();
      setDefenseState((prev) => ({ ...prev, isStreaming: false }));
    }
  };

  const handleStartDefense = async (critique?: JuryCritique) => {
    if (!sessionDetail.activeSessionId) return;
    setDefenseState((prev) => ({
      ...prev,
      hasStarted: true,
      activeCritique: critique || prev.activeCritique,
    }));
    setUiState((prev) => ({ ...prev, isDefenseModalOpen: true }));

    const userPrompt = critique
      ? `Hocam, "${critique.title}" eleştirisine dair şu noktayı açıklamak ve savunmak istiyorum: ${critique.suggestedDefensePoint || critique.critique}`
      : undefined;

    await handleSendDefenseMessage(userPrompt);
  };

  return {
    initialData,
    setInitialData,
    sessionDetail,
    defenseState,
    uiState,
    setUiState,
    loadSessionDetail,
    handleReviewSubmit,
    handleStartDefense,
    handleSendDefenseMessage,
    handleResetToNewSubmission,
  };
}
