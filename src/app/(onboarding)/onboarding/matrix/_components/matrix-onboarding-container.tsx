"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { GraduationCap, FileText, ArrowRight } from "lucide-react";
import type { Matrix } from "@/core/db/schema";
import type { ThesisMatrix } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useMatrixSubmit } from "../../_hooks/use-matrix-submit";
import {
  updateMatrixFieldDirectAction,
  syncMatrixFromChatHistoryAction,
} from "../actions";
import { AdvisorChat, type ChatMessage } from "./advisor-chat";
import { MatrixModalView } from "./matrix-modal-view";
import { MatrixForm } from "./matrix-form";
import { MatrixReviewModal } from "./matrix-review-modal";
import {
  evaluateMatrixReadiness,
  type MatrixFieldKey,
} from "../_services/rubrics";

interface MatrixOnboardingContainerProps {
  initialMatrix?: Matrix | null;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-1",
  role: "model",
  content:
    "Hoş geldiniz. Aklınızdaki tez fikrini enstitü ve jüri standartlarında sağlam bir araştırma zeminine oturtmak için buradayım.\n\nBaşlangıç olarak; üzerinde çalışmayı düşündüğünüz o ham fikir, sizi bu alana çeken temel olgu veya çözülmesini arzuladığınız mesele nedir?",
};

/**
 * Main orchestrator container for Onboarding Step 1 (Alternative 1: Chat-First + Top HUD).
 * Provides a focused, single-column conversational studio with a persistent top HUD strip,
 * on-demand single-quadrant modal inspection, and standard bottom-right proceed button.
 */
export function MatrixOnboardingContainer({
  initialMatrix,
}: MatrixOnboardingContainerProps) {
  const { submitMatrix } = useMatrixSubmit();

  const [activeMode, setActiveMode] = useState<"advisor" | "classic">("advisor");
  const [selectedSegment, setSelectedSegment] = useState<MatrixFieldKey | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [matrix, setMatrix] = useState<Partial<ThesisMatrix>>({
    subjectProblem: initialMatrix?.subjectProblem ?? "",
    theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
    primaryMaterial: initialMatrix?.primaryMaterial ?? "",
    methodology: initialMatrix?.methodology ?? "",
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMatrix?.advisorMessages && initialMatrix.advisorMessages.length > 0) {
      return initialMatrix.advisorMessages;
    }
    return [WELCOME_MESSAGE];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const readiness = evaluateMatrixReadiness(matrix);

  const handleSyncFromChat = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await syncMatrixFromChatHistoryAction(messages, matrix);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setMatrix(res.matrix);
        toast.success("Sohbet geçmişi taranarak matris güncellendi.");
      }
    } catch {
      toast.error("Sohbetten aktarım sırasında bir hata oluştu.");
    } finally {
      setIsSyncing(false);
    }
  }, [messages, matrix]);

  // Snapshot map: messageId -> matrix state at that point (after that message was committed)
  // Used for Gemini/ChatGPT-like rewind: reverting truncates both chat and matrix to that snapshot
  const matrixSnapshotRef = useRef<Map<string, Partial<ThesisMatrix>>>(new Map());

  // Seed snapshot for welcome message and initial matrix
  useEffect(() => {
    matrixSnapshotRef.current.set(WELCOME_MESSAGE.id, {
      subjectProblem: initialMatrix?.subjectProblem ?? "",
      theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
      primaryMaterial: initialMatrix?.primaryMaterial ?? "",
      methodology: initialMatrix?.methodology ?? "",
    });
    // Also seed snapshots for persisted messages if any (assume progressive matrix, reuse current matrix as last snapshot)
    if (initialMatrix?.advisorMessages && initialMatrix.advisorMessages.length > 0) {
      const lastId = initialMatrix.advisorMessages[initialMatrix.advisorMessages.length - 1].id;
      matrixSnapshotRef.current.set(lastId, {
        subjectProblem: initialMatrix.subjectProblem ?? "",
        theoreticalFramework: initialMatrix.theoreticalFramework ?? "",
        primaryMaterial: initialMatrix.primaryMaterial ?? "",
        methodology: initialMatrix.methodology ?? "",
      });
    }
  }, [initialMatrix]);

  // Synchronize state when initialMatrix is cleared (e.g. Start Over)
  const [prevMatrixId, setPrevMatrixId] = useState(initialMatrix?.id);
  if (initialMatrix?.id !== prevMatrixId) {
    setPrevMatrixId(initialMatrix?.id);
    if (!initialMatrix) {
      setMatrix({
        subjectProblem: "",
        theoreticalFramework: "",
        primaryMaterial: "",
        methodology: "",
      });
      setMessages([WELCOME_MESSAGE]);
    }
  }

  // Send message to the Socratic advisor with real-time SSE streaming
  const handleSendMessage = useCallback(
    async (userText: string) => {
      const userMessageId = `user-${Date.now()}`;
      const newUserMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: userText,
      };

      const nextHistory = [...messages, newUserMessage];
      // Snapshot matrix at this user turn (before advisor potentially crystallizes a quadrant)
      matrixSnapshotRef.current.set(userMessageId, { ...matrix });
      setMessages(nextHistory);
      setIsLoading(true);
      setStreamingText("");
      setStatusMessage(null);

      try {
        const response = await fetch("/api/onboarding/matrix/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: nextHistory,
            currentMatrix: matrix,
          }),
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
        let finalReplyText = "";
        let finalUpdatedMatrix: Partial<ThesisMatrix> | undefined;
        let modelMessageId = `model-${Date.now()}`;

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
            if (jsonStr === "[DONE]") continue;

            try {
              const eventData = JSON.parse(jsonStr);

              if (eventData.type === "delta" && eventData.text) {
                finalReplyText += eventData.text;
                setStreamingText(finalReplyText);
              } else if (eventData.type === "status" && eventData.message) {
                setStatusMessage(eventData.message);
              } else if (eventData.type === "done") {
                if (eventData.messageId) {
                  modelMessageId = eventData.messageId;
                }
                if (eventData.replyText) {
                  finalReplyText = eventData.replyText;
                }
                if (eventData.updatedMatrix) {
                  finalUpdatedMatrix = eventData.updatedMatrix;
                }
              } else if (eventData.type === "error" && eventData.error) {
                throw new Error(eventData.error);
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
                if (parseErr.message.includes("Danışman")) throw parseErr;
              }
            }
          }
        }

        // Finalize completed model message in client state
        if (finalReplyText) {
          setMessages((prev) => [
            ...prev,
            {
              id: modelMessageId,
              role: "model",
              content: finalReplyText,
            },
          ]);
          // Snapshot matrix after this model turn (ChatGPT branch point = this model)
          const snapshotMatrix = finalUpdatedMatrix ?? matrix;
          matrixSnapshotRef.current.set(modelMessageId, { ...snapshotMatrix });
        }

        if (finalUpdatedMatrix) {
          setMatrix(finalUpdatedMatrix);
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Danışmanla iletişim sırasında bir sorun oluştu.",
        );
      } finally {
        setIsLoading(false);
        setStreamingText("");
        setStatusMessage(null);
      }
    },
    [messages, matrix],
  );

  // ChatGPT-like inline edit: truncate from target onward, replace with edited text, and regenerate (no separate revert button)
  const handleEditSubmit = useCallback(
    async (targetId: string, newContent: string) => {
      if (isLoading || streamingText) return;
      const idx = messages.findIndex((m) => m.id === targetId);
      if (idx === -1) return;
      if (messages[idx]?.id === WELCOME_MESSAGE.id) {
        toast.warning("Başlangıç mesajı düzenlenemez.");
        return;
      }
      if (messages[idx]?.role !== "user") {
        toast.warning("Sadece kendi mesajlarınızı düzenleyebilirsiniz.");
        return;
      }

      // Inclusive truncate: remove target and everything after it, will be replaced with edited version
      const truncated = messages.slice(0, idx);
      const safeTruncated = truncated.length === 0 ? [WELCOME_MESSAGE] : truncated;

      const lastId = safeTruncated[safeTruncated.length - 1]?.id;
      const revertMatrix: Partial<ThesisMatrix> =
        (lastId ? matrixSnapshotRef.current.get(lastId) : undefined) ??
        (safeTruncated.length === 1 && safeTruncated[0].id === WELCOME_MESSAGE.id
          ? { subjectProblem: "", theoreticalFramework: "", primaryMaterial: "", methodology: "" }
          : { ...matrix });

      // Clean up snapshots for discarded branch
      const discardedIds = messages.slice(idx).map((m) => m.id);
      discardedIds.forEach((id) => matrixSnapshotRef.current.delete(id));

      const editedUserId = `user-${Date.now()}`;
      const editedUserMessage: ChatMessage = {
        id: editedUserId,
        role: "user",
        content: newContent,
      };
      const nextHistory = [...safeTruncated, editedUserMessage];

      // Snapshot for the edited user turn
      matrixSnapshotRef.current.set(editedUserId, { ...revertMatrix });

      // Optimistic UI: show truncated + edited message, revert matrix temporarily
      const prevMessages = messages;
      const prevMatrix = matrix;
      setMessages(nextHistory);
      setMatrix(revertMatrix);
      setIsLoading(true);
      setStreamingText("");
      setStatusMessage(null);

      try {
        // Persist truncated + edited history + reverted matrix first (branch point)
        const revertRes = await fetch("/api/onboarding/matrix/advisor/revert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextHistory, matrix: revertMatrix }),
        });
        if (!revertRes.ok) {
          const data = await revertRes.json().catch(() => ({}));
          throw new Error(data.error || "Düzenleme kaydedilemedi.");
        }

        // Then stream the new advisor turn from the edited point (same as normal send)
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
        if (!response.body) throw new Error("Yanıt akışı başlatılamadı.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalReplyText = "";
        let finalMatrixUpdate: { field: MatrixFieldKey; value: string; explanation?: string } | undefined;
        let finalUpdatedMatrix: Partial<ThesisMatrix> | undefined;
        let modelMessageId = `model-${Date.now()}`;

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
            if (jsonStr === "[DONE]") continue;
            try {
              const eventData = JSON.parse(jsonStr);
              if (eventData.type === "delta" && eventData.text) {
                finalReplyText += eventData.text;
                setStreamingText(finalReplyText);
              } else if (eventData.type === "status" && eventData.message) {
                setStatusMessage(eventData.message);
              } else if (eventData.type === "done") {
                if (eventData.messageId) modelMessageId = eventData.messageId;
                if (eventData.replyText) finalReplyText = eventData.replyText;
                if (eventData.matrixUpdate) finalMatrixUpdate = eventData.matrixUpdate;
                if (eventData.updatedMatrix) finalUpdatedMatrix = eventData.updatedMatrix;
              } else if (eventData.type === "error" && eventData.error) {
                throw new Error(eventData.error);
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
                if (parseErr.message.includes("Danışman")) throw parseErr;
              }
            }
          }
        }

        if (finalReplyText) {
          setMessages((prev) => [
            ...prev,
            { id: modelMessageId, role: "model", content: finalReplyText },
          ]);
          const snapshotMatrix = finalUpdatedMatrix ?? revertMatrix;
          matrixSnapshotRef.current.set(modelMessageId, { ...snapshotMatrix });
        }
        if (finalMatrixUpdate && finalUpdatedMatrix) {
          setMatrix(finalUpdatedMatrix);
        }
      } catch (err) {
        setMessages(prevMessages);
        setMatrix(prevMatrix);
        toast.error(err instanceof Error ? err.message : "Düzenleme sırasında bir sorun oluştu.");
      } finally {
        setIsLoading(false);
        setStreamingText("");
        setStatusMessage(null);
      }
    },
    [messages, matrix, isLoading, streamingText],
  );

  // Handle direct manual edit of a quadrant
  const handleFieldChange = useCallback(
    async (field: MatrixFieldKey, value: string) => {
      setMatrix((prev) => ({ ...prev, [field]: value }));
      const res = await updateMatrixFieldDirectAction(field, value, matrix);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Kadran güncellendi.");
      }
    },
    [matrix],
  );

  // Final submission of the thesis matrix
  const handleSubmitMatrix = useCallback(async () => {
    if (
      !matrix.subjectProblem ||
      !matrix.theoreticalFramework ||
      !matrix.methodology
    ) {
      toast.warning("Lütfen zorunlu matris kadranlarını tamamlayın.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitMatrix(matrix as ThesisMatrix);
    } finally {
      setIsSubmitting(false);
    }
  }, [matrix, submitMatrix]);

  return (
    <div className="w-full space-y-3">
      {/* Studio Toolbar: Mode Switcher */}
      <div className="flex items-center justify-between p-1.5 rounded-lg bg-card border border-border">
        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant={activeMode === "advisor" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveMode("advisor")}
            className={`h-7 text-xs px-2.5 rounded-md [&_svg]:size-3.5 ${
              activeMode === "advisor"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="mr-1.5" />
            Danışman Eşliğinde (Sokratik)
          </Button>

          <Button
            type="button"
            variant={activeMode === "classic" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveMode("classic")}
            className={`h-7 text-xs px-2.5 rounded-md [&_svg]:size-3.5 ${
              activeMode === "classic"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="mr-1.5" />
            Klasik Doğrudan Form
          </Button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      {activeMode === "classic" ? (
        <MatrixForm initialMatrix={matrix as Matrix} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col space-y-3 h-[calc(100vh-16rem)] min-h-[580px] max-h-[820px]">
            {/* Focused Single-Column Chat Stüdyosu */}
            <div className="flex-1 min-h-0">
              <AdvisorChat
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                streamingText={streamingText}
                statusMessage={statusMessage}
                onEditSubmit={handleEditSubmit}
              />
            </div>

            {/* Focused Single-Quadrant Inspection & Edit Modal */}
            <MatrixModalView
              isOpen={selectedSegment !== null}
              onOpenChange={(open) => {
                if (!open) setSelectedSegment(null);
              }}
              selectedField={selectedSegment}
              matrix={matrix}
              onFieldChange={handleFieldChange}
            />
          </div>

          {/* Bottom Row - Step 1: Preview */}
          <div className="flex justify-end pt-1 pb-4">
            <Button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="h-10 text-sm px-5 rounded-md border border-border bg-card hover:bg-accent text-foreground font-medium shadow-sm cursor-pointer inline-flex items-center gap-2"
            >
              <span className="inline-flex items-center gap-2">
                Tez matrisini gör
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-secondary border border-border">
                  {readiness.completedCount}/4
                </span>
                <ArrowRight className="size-4" />
              </span>
            </Button>
          </div>

          {/* Review Modal: 4 quadrants stacked + Mühürle ve İlerle inside */}
          <MatrixReviewModal
            isOpen={isReviewOpen}
            onOpenChange={setIsReviewOpen}
            matrix={matrix}
            completedCount={readiness.completedCount}
            isFullyReady={readiness.isFullyReady}
            isSubmitting={isSubmitting}
            isSyncing={isSyncing}
            onSyncFromChat={handleSyncFromChat}
            onConfirm={handleSubmitMatrix}
          />
        </div>
      )}
    </div>
  );
}
