"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { completePositioningClarificationsAction } from "../../actions";
import type { JuryAnalysisResult } from "../../_services/analysis";

/**
 * Manages clarification answers and confirmation flow for positioning report.
 *
 * @param reportData - Jury analysis result.
 * @param onConfirm - Callback after successful confirmation.
 * @returns Answers state and confirm handler.
 */
export function usePositioningConfirm(
  reportData: JuryAnalysisResult,
  onConfirm: () => void,
) {
  const questions = useMemo(
    () => reportData.gapAnalysisSummary?.clarificationQuestions ?? [],
    [reportData.gapAnalysisSummary],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const handleAnswerChange = useCallback((questionId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      if (questions.length > 0) {
        const answersList = questions
          .filter((q) => answers[q.id]?.trim())
          .map((q) => ({ question: q.question, answer: answers[q.id] }));
        if (answersList.length > 0) {
          await completePositioningClarificationsAction(answersList);
        }
      }
      await onConfirm();
    } catch {
      toast.error("İşlem sırasında bir hata oluştu.");
    } finally {
      setConfirming(false);
    }
  }, [answers, confirming, onConfirm, questions]);

  return { questions, answers, confirming, handleAnswerChange, handleConfirm };
}
