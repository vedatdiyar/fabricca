"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getProfessorOnboardingResponseAction, ChatMessage } from "../actions";
import { checkTezaraOriginalityAction } from "../_services/originality-service";
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

      const lastReport = currentMessages
        .filter((m) => m.role === "originality_report")
        .pop();

      const res = await getProfessorOnboardingResponseAction(
        currentMessages.filter((msg) => msg.role !== "originality_report"),
        responseText,
        lastReport?.reportData
          ? {
              risk: lastReport.reportData.risk,
              gapAnalysis: lastReport.reportData.gapAnalysis,
            }
          : undefined,
      );

      if (!res.success || !res.message) {
        throw new Error(
          res.error || "Yapay zeka asistanından yanıt alınamadı.",
        );
      }

      if (res.structuredData) {
        const lastReportInHistory = currentMessages
          .filter((m) => m.role === "originality_report")
          .pop();
        const isAlreadyApproved =
          lastReportInHistory?.reportData?.risk === "Düşük";

        if (!isAlreadyApproved) {
          // If the Server Action already returned the pre-computed originality report, use it immediately!
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

            setOnboardingState((prev) => ({
              ...prev,
              messages: [
                ...currentMessages,
                { role: "model", content: res.message || "" },
              ],
              pendingStructuredData: res.structuredData || null,
            }));
          } else {
            // Safe client-side fallback just in case
            setOnboardingState((prev) => ({
              ...prev,
              isOriginalityLoading: true,
            }));
            try {
              const thesisContext = `Başlık: ${res.structuredData.title}\nAraştırma Sorusu: ${res.structuredData.researchQuestion}\nArgüman: ${res.structuredData.argument}\nMetodoloji: ${res.structuredData.methodology}`;

              const origRes = await checkTezaraOriginalityAction(thesisContext);
              if (origRes.success && origRes.report) {
                const reportMsg: ChatMessage = {
                  role: "originality_report",
                  content: "",
                  reportData: {
                    risk: origRes.report.risk,
                    reasoning: origRes.report.reasoning,
                    gapAnalysis: origRes.report.gapAnalysis,
                    theses: origRes.report.theses,
                  },
                };

                currentMessages = [...currentMessages, reportMsg];

                if (
                  origRes.report.risk === "Orta" ||
                  origRes.report.risk === "Yüksek"
                ) {
                  setOnboardingState((prev) => ({
                    ...prev,
                    isOriginalityLoading: false,
                    isLoading: true,
                    messages: currentMessages,
                  }));

                  const revRes = await getProfessorOnboardingResponseAction(
                    currentMessages.filter(
                      (msg) => msg.role !== "originality_report",
                    ),
                    responseText,
                    {
                      risk: origRes.report.risk,
                      gapAnalysis: origRes.report.gapAnalysis,
                    },
                  );

                  if (revRes.success && revRes.message) {
                    setOnboardingState((prev) => ({
                      ...prev,
                      messages: [
                        ...prev.messages,
                        { role: "model", content: revRes.message || "" },
                      ],
                    }));
                  }
                  return;
                } else {
                  setOnboardingState((prev) => ({
                    ...prev,
                    messages: [
                      ...currentMessages,
                      { role: "model", content: res.message || "" },
                    ],
                    pendingStructuredData: res.structuredData || null,
                  }));
                }
              } else {
                setOnboardingState((prev) => ({
                  ...prev,
                  messages: [
                    ...currentMessages,
                    { role: "model", content: res.message || "" },
                  ],
                  pendingStructuredData: res.structuredData || null,
                }));
              }
            } catch (origErr) {
              console.error("Originality Check Error:", origErr);
              setOnboardingState((prev) => ({
                ...prev,
                pendingStructuredData: res.structuredData || null,
              }));
            } finally {
              setOnboardingState((prev) => ({
                ...prev,
                isOriginalityLoading: false,
              }));
            }
          }
        } else {
          setOnboardingState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: "model", content: res.message || "" },
            ],
            pendingStructuredData: res.structuredData || null,
          }));
        }
      } else {
        setOnboardingState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            { role: "model", content: res.message || "" },
          ],
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
