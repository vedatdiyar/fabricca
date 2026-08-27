"use client";

import { useReducer, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getOfficeInitialDataAction,
  getOfficeSessionDetailAction,
  type OutlineOption,
} from "../office-actions";
import type { JuryCritique } from "../_services/pipeline/types";
import type { DefenseMessage } from "../_components/office-defense-chat";
import {
  advisorOfficeWorkspaceReducer,
  createInitialOfficeWorkspaceState,
  buildOfficeSessionPayload,
  type AdvisorOfficeWorkspaceState,
} from "./advisor-office-workspace-reducer";
import { streamOfficeDefenseReply } from "../_lib/office-defense-stream";

/**
 * Manages Danışmanın Çalışma Odası workspace state, data loading, review submission and live defense streaming.
 *
 * @param initialSessionId - Optional session id to preload on mount.
 * @returns Workspace state, setters and action handlers.
 */
export function useAdvisorOfficeWorkspace(initialSessionId?: number) {
  const [state, dispatch] = useReducer(
    advisorOfficeWorkspaceReducer,
    null,
    () => createInitialOfficeWorkspaceState(initialSessionId),
  );

  const { initialData, sessionDetail, defenseState, uiState } = state;

  const setInitialData = useCallback(
    (
      action: React.SetStateAction<AdvisorOfficeWorkspaceState["initialData"]>,
    ) => {
      dispatch({ type: "SET_INITIAL_DATA", payload: action });
    },
    [],
  );

  const setSessionDetail = useCallback(
    (
      action: React.SetStateAction<
        AdvisorOfficeWorkspaceState["sessionDetail"]
      >,
    ) => {
      dispatch({ type: "SET_SESSION_DETAIL", payload: action });
    },
    [],
  );

  const setDefenseState = useCallback(
    (
      action: React.SetStateAction<AdvisorOfficeWorkspaceState["defenseState"]>,
    ) => {
      dispatch({ type: "SET_DEFENSE_STATE", payload: action });
    },
    [],
  );

  const setUiState = useCallback(
    (action: React.SetStateAction<AdvisorOfficeWorkspaceState["uiState"]>) => {
      dispatch({ type: "SET_UI_STATE", payload: action });
    },
    [],
  );

  const loadSessionDetail = useCallback(
    async (sessionId: number, outlineList?: OutlineOption[]) => {
      try {
        const res = await getOfficeSessionDetailAction(sessionId);
        if (res.success && res.data) {
          const payload = buildOfficeSessionPayload(res.data, outlineList);
          setSessionDetail(payload.sessionDetail);
          setDefenseState(payload.defenseState);
          setUiState((prev) => ({ ...prev, mobileSubmissionTab: "form" }));

          if (typeof window !== "undefined") {
            const currentUrl = new URL(window.location.href);
            if (
              currentUrl.searchParams.get("session") !== String(res.data.id)
            ) {
              window.history.pushState(
                null,
                "",
                `/advisor/draft-review?session=${res.data.id}`,
              );
            }
          }
        } else {
          toast.error(res.error || "Oturum detayları yüklenemedi.");
        }
      } catch {
        toast.error("Oturum yüklenirken bir hata oluştu.");
      }
    },
    [setSessionDetail, setUiState, setDefenseState],
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
  }, [setSessionDetail, setDefenseState, setUiState]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const res = await getOfficeInitialDataAction();
        if (!isMounted) return;
        if (res.success) {
          let detailPayload:
            AdvisorOfficeWorkspaceState["sessionDetail"] | undefined;
          let defensePayload:
            AdvisorOfficeWorkspaceState["defenseState"] | undefined;

          if (initialSessionId) {
            const detailRes =
              await getOfficeSessionDetailAction(initialSessionId);
            if (isMounted && detailRes.success && detailRes.data) {
              const payload = buildOfficeSessionPayload(
                detailRes.data,
                res.outlines,
              );
              detailPayload = payload.sessionDetail;
              defensePayload = payload.defenseState;
            }
          }

          if (isMounted) {
            dispatch({
              type: "INIT_SUCCESS",
              payload: {
                outlines: res.outlines,
                sessions: res.sessions,
                sessionDetail: detailPayload,
                defenseState: defensePayload,
              },
            });
          }
        } else {
          toast.error(res.error || "Başlangıç verileri yüklenemedi.");
          if (isMounted) dispatch({ type: "INIT_FAILED" });
        }
      } catch {
        if (isMounted) {
          toast.error("Danışman masası yüklenirken bir hata oluştu.");
          dispatch({ type: "INIT_FAILED" });
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

    try {
      const accumulatedText = await streamOfficeDefenseReply({
        sessionId,
        userMessage,
        onDelta: (deltaText) => {
          setDefenseState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === tempAdvisorId ? { ...m, content: deltaText } : m,
            ),
          }));
        },
      });

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
