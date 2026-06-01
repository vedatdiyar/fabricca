"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getProfessorOnboardingResponseAction,
  runOriginalityAndBooksPipelineAction,
  ChatMessage,
} from "../actions";
import { saveThesisCoreAction } from "../_services/db-actions";

export interface OnboardingThesisData {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
  isAcademicApproval?: boolean;
  boxes?: {
    name: string;
    description: string;
  }[];
  coreBooks?: {
    title: string;
    author: string;
    publisher: string;
    year: string;
    rationale: string;
  }[];
}

export interface OnboardingState {
  messages: ChatMessage[];
  isChatActive: boolean;
  userResponse: string;
  isLoading: boolean;
  isOriginalityLoading: boolean;
  error: string | null;
  structuredData: OnboardingThesisData | null;
  pendingStructuredData: OnboardingThesisData | null;
  isSaving: boolean;
}

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "model",
    content:
      "Merhaba Vedat.\n\nTez anayasanı birlikte inşa edeceğiz — ama bunu sıkıcı bir form doldurma seansı gibi yapmayacağız. Seninle gerçek bir akademik tartışma yürüteceğiz: konunun sınırlarını, araştırma sorusunu, teorik zeminini ve yöntemini organik bir sohbet içinde netleştireceğiz.\n\nHazır olduğunda mülakata başlayabiliriz. Bana anlat: üzerinde çalışmak istediğin konu nedir?",
  },
];

export const INITIAL_STATE: OnboardingState = {
  messages: INITIAL_MESSAGES,
  isChatActive: true,
  userResponse: "",
  isLoading: false,
  isOriginalityLoading: false,
  error: null,
  structuredData: null,
  pendingStructuredData: null,
  isSaving: false,
};

export function useOnboardingLogic(router: ReturnType<typeof useRouter>) {
  const [state, setOnboardingState] = useState<OnboardingState>(INITIAL_STATE);

  const setUserResponse = (val: string) => {
    setOnboardingState((prev) => ({ ...prev, userResponse: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !state.userResponse.trim() ||
      state.isLoading ||
      state.isOriginalityLoading
    )
      return;

    const responseText = state.userResponse.trim();
    const updatedHistory: ChatMessage[] = [
      ...state.messages,
      { role: "user", content: responseText },
    ];

    setOnboardingState((prev) => ({
      ...prev,
      userResponse: "",
      error: null,
      isLoading: true,
      messages: updatedHistory,
    }));

    try {
      const currentMessages = [...updatedHistory];

      const res = await getProfessorOnboardingResponseAction(
        currentMessages,
        responseText,
      );

      if (!res.success || !res.message) {
        throw new Error(
          res.error || "Yapay zeka asistanından yanıt alınamadı.",
        );
      }

      if (res.needsOriginalityCheck && res.structuredData) {
        // Set state for Professor response, and toggle originality loading
        setOnboardingState((prev) => ({
          ...prev,
          messages: [
            ...currentMessages,
            { role: "model" as const, content: res.message || "" },
          ],
          isOriginalityLoading: true,
          isLoading: false, // Turn off Professor typing indicator
        }));

        const updatedHistoryWithProf: ChatMessage[] = [
          ...currentMessages,
          { role: "model" as const, content: res.message || "" },
        ];

        // Call Step 2 Server Action: Check originality and generate books
        const originalityRes = await runOriginalityAndBooksPipelineAction(
          updatedHistoryWithProf,
          responseText,
          res.structuredData,
        );

        if (!originalityRes.success) {
          throw new Error(
            originalityRes.error ||
              "Özgünlük kontrolü veya kitap araması sırasında hata oluştu.",
          );
        }

        if (originalityRes.riskDetected) {
          // If risk is detected, append originality report, append revised Prof message,
          // clear pendingStructuredData, and turn off originality loading
          let nextHistory: ChatMessage[] = [...updatedHistoryWithProf];
          if (originalityRes.originalityReport) {
            const reportMsg: ChatMessage = {
              role: "originality_report",
              content: "",
              reportData: {
                risk: originalityRes.originalityReport.risk,
                reasoning: originalityRes.originalityReport.reasoning,
                gapAnalysis: originalityRes.originalityReport.gapAnalysis,
                theses: originalityRes.originalityReport.theses,
              },
            };
            nextHistory = [...nextHistory, reportMsg];
          }

          setOnboardingState((prev) => ({
            ...prev,
            isOriginalityLoading: false,
            messages: [
              ...nextHistory,
              { role: "model" as const, content: originalityRes.message || "" },
            ],
            pendingStructuredData: null,
          }));
        } else {
          // No risk detected! Append originality report (low risk), update structuredData with books
          let nextHistory: ChatMessage[] = [...updatedHistoryWithProf];
          if (originalityRes.originalityReport) {
            const reportMsg: ChatMessage = {
              role: "originality_report",
              content: "",
              reportData: {
                risk: originalityRes.originalityReport.risk,
                reasoning: originalityRes.originalityReport.reasoning,
                gapAnalysis: originalityRes.originalityReport.gapAnalysis,
                theses: originalityRes.originalityReport.theses,
              },
            };
            nextHistory = [...nextHistory, reportMsg];
          }

          setOnboardingState((prev) => ({
            ...prev,
            isOriginalityLoading: false,
            messages: nextHistory,
            pendingStructuredData: originalityRes.structuredData || null,
          }));
        }
      } else {
        // Standard normal response
        setOnboardingState((prev) => ({
          ...prev,
          messages: [
            ...currentMessages,
            { role: "model" as const, content: res.message || "" },
          ],
          pendingStructuredData: null,
        }));
      }
    } catch (err) {
      console.error("Onboarding Error:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Bir hata oluştu, lütfen tekrar deneyin.";
      setOnboardingState((prev) => ({
        ...prev,
        error: errMsg,
        messages: prev.messages.slice(0, -1),
        userResponse: responseText,
        isOriginalityLoading: false,
      }));
    } finally {
      setOnboardingState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleConfirmSave = async () => {
    if (!state.structuredData || state.isSaving) return;
    setOnboardingState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const res = await saveThesisCoreAction(state.structuredData);
      if (!res.success) {
        throw new Error(
          res.error || "Tez anayasası veritabanına kaydedilemedi.",
        );
      }

      router.refresh();
      router.push("/");
    } catch (err) {
      console.error("Save Thesis Core Error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Kayıt sırasında bir hata oluştu.";
      setOnboardingState((prev) => ({ ...prev, error: errMsg }));
    } finally {
      setOnboardingState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleApproveConstitution = () => {
    if (!state.pendingStructuredData) return;
    setOnboardingState((prev) => ({
      ...prev,
      structuredData: prev.pendingStructuredData,
      pendingStructuredData: null,
      isChatActive: false,
    }));
  };

  const handleReset = () => {
    setOnboardingState(INITIAL_STATE);
  };

  return {
    state,
    setUserResponse,
    handleSubmit,
    handleConfirmSave,
    handleApproveConstitution,
    handleReset,
  };
}
