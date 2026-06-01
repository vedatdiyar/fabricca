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

      const nextMessages: ChatMessage[] = [...currentMessages];

      if (res.originalityReport) {
        nextMessages.push({
          role: "originality_report",
          content: "",
          reportData: {
            risk: res.originalityReport.risk,
            reasoning: res.originalityReport.reasoning,
            gapAnalysis: res.originalityReport.gapAnalysis,
            theses: res.originalityReport.theses,
          },
        });
      }

      nextMessages.push({
        role: "model" as const,
        content: res.message || "",
      });

      setOnboardingState((prev) => ({
        ...prev,
        messages: nextMessages,
        pendingStructuredData: res.structuredData || null,
        isOriginalityLoading: false,
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

  const handleSkipToDirectInput = () => {
    setOnboardingState((prev) => ({
      ...prev,
      structuredData: {
        title: "",
        researchQuestion: "",
        argument: "",
        methodology: "",
        boxes: [],
        coreBooks: [],
      },
      isChatActive: false,
      pendingStructuredData: null,
      error: null,
    }));
  };

  const updateCoreField = (
    field: keyof OnboardingThesisData,
    value: string,
  ) => {
    setOnboardingState((prev) => {
      if (!prev.structuredData) return prev;
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          [field]: value,
        },
      };
    });
  };

  const updateBox = (
    index: number,
    updatedBox: { name: string; description: string },
  ) => {
    setOnboardingState((prev) => {
      if (!prev.structuredData || !prev.structuredData.boxes) return prev;
      const nextBoxes = [...prev.structuredData.boxes];
      nextBoxes[index] = updatedBox;
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          boxes: nextBoxes,
        },
      };
    });
  };

  const addBox = () => {
    setOnboardingState((prev) => {
      if (!prev.structuredData) return prev;
      const nextBoxes = prev.structuredData.boxes
        ? [...prev.structuredData.boxes]
        : [];
      nextBoxes.push({ name: "Yeni Bölüm", description: "" });
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          boxes: nextBoxes,
        },
      };
    });
  };

  const removeBox = (index: number) => {
    setOnboardingState((prev) => {
      if (!prev.structuredData || !prev.structuredData.boxes) return prev;
      const nextBoxes = prev.structuredData.boxes.filter((_, i) => i !== index);
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          boxes: nextBoxes,
        },
      };
    });
  };

  const updateBook = (
    index: number,
    updatedBook: NonNullable<OnboardingThesisData["coreBooks"]>[number],
  ) => {
    setOnboardingState((prev) => {
      if (!prev.structuredData || !prev.structuredData.coreBooks) return prev;
      const nextBooks = [...prev.structuredData.coreBooks];
      nextBooks[index] = updatedBook;
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          coreBooks: nextBooks,
        },
      };
    });
  };

  const addBook = () => {
    setOnboardingState((prev) => {
      if (!prev.structuredData) return prev;
      const nextBooks = prev.structuredData.coreBooks
        ? [...prev.structuredData.coreBooks]
        : [];
      nextBooks.push({
        title: "Yeni Kaynak",
        author: "",
        publisher: "",
        year: "",
        rationale: "",
      });
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          coreBooks: nextBooks,
        },
      };
    });
  };

  const removeBook = (index: number) => {
    setOnboardingState((prev) => {
      if (!prev.structuredData || !prev.structuredData.coreBooks) return prev;
      const nextBooks = prev.structuredData.coreBooks.filter(
        (_, i) => i !== index,
      );
      return {
        ...prev,
        structuredData: {
          ...prev.structuredData,
          coreBooks: nextBooks,
        },
      };
    });
  };

  const handleReRunVerification = async () => {
    if (!state.structuredData || state.isOriginalityLoading) return;
    setOnboardingState((prev) => ({
      ...prev,
      isOriginalityLoading: true,
      error: null,
    }));

    try {
      const userMsg =
        state.messages.find((m) => m.role === "user")?.content ||
        state.structuredData.title ||
        "Manuel Giriş";

      const originalityRes = await runOriginalityAndBooksPipelineAction(
        state.messages,
        userMsg,
        state.structuredData,
      );

      if (!originalityRes.success) {
        // Try fallback to check if we can still keep original data but warn
        throw new Error(
          originalityRes.error ||
            "Özgünlük kontrolü veya kitap araması sırasında hata oluştu.",
        );
      }

      const nextHistory = [...state.messages];
      if (originalityRes.originalityReport) {
        // Remove previous originality report messages if any to avoid stacking
        const cleanedHistory = nextHistory.filter(
          (m) => m.role !== "originality_report",
        );
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
        cleanedHistory.push(reportMsg);

        setOnboardingState((prev) => ({
          ...prev,
          isOriginalityLoading: false,
          messages: cleanedHistory,
          structuredData: originalityRes.structuredData || prev.structuredData,
        }));
      } else {
        setOnboardingState((prev) => ({
          ...prev,
          isOriginalityLoading: false,
          structuredData: originalityRes.structuredData || prev.structuredData,
        }));
      }
    } catch (err) {
      console.error("Re-verification Error:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Yeniden doğrulama başarısız oldu.";
      setOnboardingState((prev) => ({
        ...prev,
        error: errMsg,
        isOriginalityLoading: false,
      }));
    }
  };

  return {
    state,
    setUserResponse,
    handleSubmit,
    handleConfirmSave,
    handleApproveConstitution,
    handleReset,
    handleSkipToDirectInput,
    updateCoreField,
    updateBox,
    addBox,
    removeBox,
    updateBook,
    addBook,
    removeBook,
    handleReRunVerification,
  };
}
