"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Matrix } from "@/core/db/schema";
import type { ThesisMatrix } from "@/lib/types";
import { useMatrixSubmit } from "../../_hooks/use-matrix-submit";
import {
  updateMatrixFieldDirectAction,
  syncMatrixFromChatHistoryAction,
} from "../actions";
import type { ChatMessage } from "../_components/advisor-chat";
import {
  evaluateMatrixReadiness,
  type MatrixFieldKey,
} from "../_services/rubrics";
import {
  WELCOME_MESSAGE,
  matrixOnboardingReducer,
  createInitialMatrixOnboardingState,
} from "./matrix-onboarding-reducer";
import { consumeMatrixAdvisorStream } from "../_lib/matrix-advisor-stream";

export { WELCOME_MESSAGE };

/**
 * Encapsulates all state management, SSE advisor streaming, snapshots and mutation callbacks
 * for the Matrix Onboarding step.
 *
 * @param initialMatrix - Persisted thesis matrix from DB if available.
 * @returns State and actions for the Matrix Onboarding workspace.
 */
export function useMatrixOnboarding(initialMatrix?: Matrix | null) {
  const { submitMatrix } = useMatrixSubmit();

  const [state, dispatch] = useReducer(matrixOnboardingReducer, null, () =>
    createInitialMatrixOnboardingState(initialMatrix),
  );

  const readiness = evaluateMatrixReadiness(state.matrix);

  const setActiveMode = useCallback((mode: "advisor" | "classic") => {
    dispatch({ type: "SET_ACTIVE_MODE", payload: mode });
  }, []);

  const setSelectedSegment = useCallback((seg: MatrixFieldKey | null) => {
    dispatch({ type: "SET_SELECTED_SEGMENT", payload: seg });
  }, []);

  const setIsReviewOpen = useCallback((open: boolean) => {
    dispatch({ type: "SET_IS_REVIEW_OPEN", payload: open });
  }, []);

  const handleSyncFromChat = useCallback(async () => {
    dispatch({ type: "SET_IS_SYNCING", payload: true });
    try {
      const res = await syncMatrixFromChatHistoryAction(
        state.messages,
        state.matrix,
      );
      if ("error" in res) {
        toast.error(res.error);
      } else {
        dispatch({ type: "SET_MATRIX", payload: res.matrix });
        toast.success("Sohbet geçmişi taranarak matris güncellendi.");
      }
    } catch {
      toast.error("Sohbetten aktarım sırasında bir hata oluştu.");
    } finally {
      dispatch({ type: "SET_IS_SYNCING", payload: false });
    }
  }, [state.messages, state.matrix]);

  // Snapshot map: messageId -> matrix state at that point (after that message was committed)
  const matrixSnapshotRef = useRef<Map<string, Partial<ThesisMatrix>>>(
    new Map(),
  );

  // Seed snapshot for welcome message and initial matrix
  useEffect(() => {
    matrixSnapshotRef.current.set(WELCOME_MESSAGE.id, {
      subjectProblem: initialMatrix?.subjectProblem ?? "",
      theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
      primaryMaterial: initialMatrix?.primaryMaterial ?? "",
      methodology: initialMatrix?.methodology ?? "",
    });
    if (
      initialMatrix?.advisorMessages &&
      initialMatrix.advisorMessages.length > 0
    ) {
      const lastId =
        initialMatrix.advisorMessages[initialMatrix.advisorMessages.length - 1]
          .id;
      matrixSnapshotRef.current.set(lastId, {
        subjectProblem: initialMatrix.subjectProblem ?? "",
        theoreticalFramework: initialMatrix.theoreticalFramework ?? "",
        primaryMaterial: initialMatrix.primaryMaterial ?? "",
        methodology: initialMatrix.methodology ?? "",
      });
    }
  }, [initialMatrix]);

  // Synchronize state when initialMatrix is cleared (e.g. Start Over)
  const prevMatrixIdRef = useRef(initialMatrix?.id);
  useEffect(() => {
    if (initialMatrix?.id !== prevMatrixIdRef.current) {
      prevMatrixIdRef.current = initialMatrix?.id;
      if (!initialMatrix) {
        dispatch({
          type: "RESET_MATRIX",
          payload: {
            matrix: {
              subjectProblem: "",
              theoreticalFramework: "",
              primaryMaterial: "",
              methodology: "",
            },
            messages: [WELCOME_MESSAGE],
          },
        });
      }
    }
  }, [initialMatrix]);

  // Send message to the Socratic advisor with real-time SSE streaming
  const handleSendMessage = useCallback(
    async (userText: string) => {
      const userMessageId = `user-${Date.now()}`;
      const newUserMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: userText,
      };

      const nextHistory = [...state.messages, newUserMessage];
      matrixSnapshotRef.current.set(userMessageId, { ...state.matrix });
      dispatch({ type: "SET_MESSAGES", payload: nextHistory });
      dispatch({ type: "SET_IS_LOADING", payload: true });
      dispatch({ type: "SET_STREAMING_TEXT", payload: "" });
      dispatch({ type: "SET_STATUS_MESSAGE", payload: null });

      try {
        const response = await fetch("/api/onboarding/matrix/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: nextHistory,
            currentMatrix: state.matrix,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Danışman yanıt veremedi.");
        }

        const streamResult = await consumeMatrixAdvisorStream(response, {
          onDelta: (text) =>
            dispatch({ type: "SET_STREAMING_TEXT", payload: text }),
          onStatus: (msg) =>
            dispatch({ type: "SET_STATUS_MESSAGE", payload: msg }),
        });

        if (streamResult.finalReplyText) {
          dispatch({
            type: "SET_MESSAGES",
            payload: (prev) => [
              ...prev,
              {
                id: streamResult.modelMessageId,
                role: "model",
                content: streamResult.finalReplyText,
              },
            ],
          });
          const snapshotMatrix =
            streamResult.finalUpdatedMatrix ?? state.matrix;
          matrixSnapshotRef.current.set(streamResult.modelMessageId, {
            ...snapshotMatrix,
          });
        }

        if (streamResult.finalUpdatedMatrix) {
          dispatch({
            type: "SET_MATRIX",
            payload: streamResult.finalUpdatedMatrix,
          });
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Danışmanla iletişim sırasında bir sorun oluştu.",
        );
      } finally {
        dispatch({ type: "SET_IS_LOADING", payload: false });
        dispatch({ type: "SET_STREAMING_TEXT", payload: "" });
        dispatch({ type: "SET_STATUS_MESSAGE", payload: null });
      }
    },
    [state.messages, state.matrix],
  );

  // ChatGPT-like inline edit: truncate from target onward, replace with edited text, and regenerate
  const handleEditSubmit = useCallback(
    async (targetId: string, newContent: string) => {
      if (state.isLoading || state.streamingText) return;
      const idx = state.messages.findIndex((m) => m.id === targetId);
      if (idx === -1) return;
      if (state.messages[idx]?.id === WELCOME_MESSAGE.id) {
        toast.warning("Başlangıç mesajı düzenlenemez.");
        return;
      }
      if (state.messages[idx]?.role !== "user") {
        toast.warning("Sadece kendi mesajlarınızı düzenleyebilirsiniz.");
        return;
      }

      const truncated = state.messages.slice(0, idx);
      const safeTruncated =
        truncated.length === 0 ? [WELCOME_MESSAGE] : truncated;

      const lastId = safeTruncated[safeTruncated.length - 1]?.id;
      const revertMatrix: Partial<ThesisMatrix> =
        (lastId ? matrixSnapshotRef.current.get(lastId) : undefined) ??
        (safeTruncated.length === 1 &&
        safeTruncated[0].id === WELCOME_MESSAGE.id
          ? {
              subjectProblem: "",
              theoreticalFramework: "",
              primaryMaterial: "",
              methodology: "",
            }
          : { ...state.matrix });

      const discardedIds = state.messages.slice(idx).map((m) => m.id);
      discardedIds.forEach((id) => matrixSnapshotRef.current.delete(id));

      const editedUserId = `user-${Date.now()}`;
      const editedUserMessage: ChatMessage = {
        id: editedUserId,
        role: "user",
        content: newContent,
      };
      const nextHistory = [...safeTruncated, editedUserMessage];

      matrixSnapshotRef.current.set(editedUserId, { ...revertMatrix });

      const prevMessages = state.messages;
      const prevMatrix = state.matrix;
      dispatch({ type: "SET_MESSAGES", payload: nextHistory });
      dispatch({ type: "SET_MATRIX", payload: revertMatrix });
      dispatch({ type: "SET_IS_LOADING", payload: true });
      dispatch({ type: "SET_STREAMING_TEXT", payload: "" });
      dispatch({ type: "SET_STATUS_MESSAGE", payload: null });

      try {
        const revertRes = await fetch("/api/onboarding/matrix/advisor/revert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextHistory, matrix: revertMatrix }),
        });
        if (!revertRes.ok) {
          const data = await revertRes.json().catch(() => ({}));
          throw new Error(data.error || "Düzenleme kaydedilemedi.");
        }

        const response = await fetch("/api/onboarding/matrix/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: nextHistory,
            currentMatrix: revertMatrix,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Danışman yanıt veremedi.");
        }

        const streamResult = await consumeMatrixAdvisorStream(response, {
          onDelta: (text) =>
            dispatch({ type: "SET_STREAMING_TEXT", payload: text }),
          onStatus: (msg) =>
            dispatch({ type: "SET_STATUS_MESSAGE", payload: msg }),
        });

        if (streamResult.finalReplyText) {
          dispatch({
            type: "SET_MESSAGES",
            payload: (prev) => [
              ...prev,
              {
                id: streamResult.modelMessageId,
                role: "model",
                content: streamResult.finalReplyText,
              },
            ],
          });
          const snapshotMatrix =
            streamResult.finalUpdatedMatrix ?? revertMatrix;
          matrixSnapshotRef.current.set(streamResult.modelMessageId, {
            ...snapshotMatrix,
          });
        }
        if (streamResult.finalUpdatedMatrix) {
          dispatch({
            type: "SET_MATRIX",
            payload: streamResult.finalUpdatedMatrix,
          });
        }
      } catch (err) {
        dispatch({ type: "SET_MESSAGES", payload: prevMessages });
        dispatch({ type: "SET_MATRIX", payload: prevMatrix });
        toast.error(
          err instanceof Error
            ? err.message
            : "Düzenleme sırasında bir sorun oluştu.",
        );
      } finally {
        dispatch({ type: "SET_IS_LOADING", payload: false });
        dispatch({ type: "SET_STREAMING_TEXT", payload: "" });
        dispatch({ type: "SET_STATUS_MESSAGE", payload: null });
      }
    },
    [state.messages, state.matrix, state.isLoading, state.streamingText],
  );

  // Handle direct manual edit of a quadrant
  const handleFieldChange = useCallback(
    async (field: MatrixFieldKey, value: string) => {
      dispatch({ type: "UPDATE_MATRIX_FIELD", payload: { field, value } });
      const res = await updateMatrixFieldDirectAction(
        field,
        value,
        state.matrix,
      );
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Kadran güncellendi.");
      }
    },
    [state.matrix],
  );

  // Final submission of the thesis matrix
  const handleSubmitMatrix = useCallback(async () => {
    if (
      !state.matrix.subjectProblem ||
      !state.matrix.theoreticalFramework ||
      !state.matrix.methodology
    ) {
      toast.warning("Lütfen zorunlu matris kadranlarını tamamlayın.");
      return;
    }

    dispatch({ type: "SET_IS_SUBMITTING", payload: true });
    try {
      await submitMatrix(state.matrix as ThesisMatrix);
    } finally {
      dispatch({ type: "SET_IS_SUBMITTING", payload: false });
    }
  }, [state.matrix, submitMatrix]);

  return {
    activeMode: state.activeMode,
    setActiveMode,
    selectedSegment: state.selectedSegment,
    setSelectedSegment,
    isReviewOpen: state.isReviewOpen,
    setIsReviewOpen,
    matrix: state.matrix,
    messages: state.messages,
    isLoading: state.isLoading,
    streamingText: state.streamingText,
    statusMessage: state.statusMessage,
    isSubmitting: state.isSubmitting,
    isSyncing: state.isSyncing,
    readiness,
    handleSyncFromChat,
    handleSendMessage,
    handleEditSubmit,
    handleFieldChange,
    handleSubmitMatrix,
  };
}
