"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getProfessorOnboardingResponseAction, ChatMessage } from "../actions";
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
      "Merhaba Vedat. Kahvemi yeni koydum, seni bekliyordum.\n\nTez anayasanı birlikte inşa edeceğiz — ama bunu sıkıcı bir form doldurma seansı gibi yapmayacağız. Seninle gerçek bir akademik tartışma yürüteceğiz: konunun sınırlarını, araştırma sorusunu, teorik zeminini ve yöntemini organik bir sohbet içinde netleştireceğiz.\n\nHazır olduğunda mülakata başlayabiliriz. Bana anlat: üzerinde çalışmak istediğin konu nedir?",
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
      let currentMessages = [...updatedHistory];

      const res = await getProfessorOnboardingResponseAction(
        currentMessages,
        responseText,
      );

      if (!res.success || !res.message) {
        throw new Error(
          res.error || "Yapay zeka asistanından yanıt alınamadı.",
        );
      }

      if (res.originalityReport) {
        const reportMsg: ChatMessage = {
          role: "originality_report",
          content: "",
          reportData: {
            risk: res.originalityReport.risk,
            reasoning: res.originalityReport.reasoning,
            gapAnalysis: res.originalityReport.gapAnalysis,
            theses: res.originalityReport.theses,
          },
        };
        currentMessages = [...currentMessages, reportMsg];
      }

      setOnboardingState((prev) => ({
        ...prev,
        messages: [
          ...currentMessages,
          { role: "model", content: res.message || "" },
        ],
        pendingStructuredData: res.structuredData || null,
      }));
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
