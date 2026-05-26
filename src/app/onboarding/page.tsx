"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import {
  getProfessorOnboardingResponseAction,
  saveThesisCoreAction,
  checkTezaraOriginalityAction,
  ChatMessage,
} from "./actions";
import { ChatScreen } from "./_components/chat-screen";
import { PreviewScreen } from "./_components/preview-screen";

export default function OnboardingPage() {
  const router = useRouter();

  // State Management
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content:
        "Merhaba Vedat, hoş geldin. Seninle tez sürecini planlamaya başlamak için sabırsızlanıyorum.\n\nTez anayasamızı birlikte kuracağız — çalışmanın sınırlarını, sorusunu ve teorik zeminini adım adım netleştireceğiz.\n\nİlk olarak: **Tezinin başlığı veya üzerinde çalışmak istediğin genel konu nedir?**",
    },
  ]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [userResponse, setUserResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOriginalityLoading, setIsOriginalityLoading] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synthesis & Confirmation States
  const [structuredData, setStructuredData] = useState<{
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Submit response handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userResponse.trim() || isLoading || isOriginalityLoading) return;

    const responseText = userResponse.trim();
    setUserResponse("");
    setError(null);
    setIsLoading(true);

    // Append user message
    const updatedHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: responseText },
    ];
    setMessages(updatedHistory);

    try {
      let currentMessages = [...updatedHistory];

      // Call Originality Scanner on steps 1 (topic) and 2 (question) - skip if already checked
      const hasReport = currentMessages.some(
        (m) => m.role === "originality_report",
      );
      if ((currentStep === 1 || currentStep === 2) && !hasReport) {
        setIsOriginalityLoading(true);
        try {
          const origRes = await checkTezaraOriginalityAction(responseText);
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
            setMessages(currentMessages);
          }
        } catch (origErr) {
          console.error("Originality Check Error:", origErr);
        } finally {
          setIsOriginalityLoading(false);
        }
      }

      // Extract report data for risk-aware professor routing
      const lastReport = currentMessages
        .filter((m) => m.role === "originality_report")
        .pop();

      // Call Server Action to get next question, revision discussion, or final synthesis
      const res = await getProfessorOnboardingResponseAction(
        currentMessages.filter((msg) => msg.role !== "originality_report"),
        currentStep,
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

      // Append assistant message
      setMessages((prev) => [
        ...prev,
        { role: "model", content: res.message || "" },
      ]);

      if (res.structuredData) {
        // If final step completed, store the synthesized core data
        setStructuredData(res.structuredData);
        setCurrentStep(5); // Go to preview & confirmation stage
      } else if (res.needsReview) {
        // Stay on same step for revision discussion - don't increment
      } else {
        // Increment step
        setCurrentStep((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Onboarding Error:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Bir hata oluştu, lütfen tekrar deneyin.";
      setError(errMsg);
      // Rollback last user message if failed so they can edit it
      setMessages((prev) => [...prev.slice(0, -1)]);
      setUserResponse(responseText);
    } finally {
      setIsLoading(false);
    }
  };

  // Final database persistence handler
  const handleConfirmSave = async () => {
    if (!structuredData || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await saveThesisCoreAction(structuredData);
      if (!res.success) {
        throw new Error(
          res.error || "Tez anayasası veritabanına kaydedilemedi.",
        );
      }

      // Force a full router refresh and navigate to dashboard
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      console.error("Save Thesis Core Error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Kayıt sırasında bir hata oluştu.";
      setError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Start mülakat over
  const handleReset = () => {
    setMessages([
      {
        role: "model",
        content:
          "Merhaba Vedat, hoş geldin. Seninle tez sürecini planlamaya başlamak için sabırsızlanıyorum.\n\nTez anayasamızı birlikte kuracağız — çalışmanın sınırlarını, sorusunu ve teorik zeminini adım adım netleştireceğiz.\n\nİlk olarak: **Tezinin başlığı veya üzerinde çalışmak istediğin genel konu nedir?**",
      },
    ]);
    setCurrentStep(1);
    setUserResponse("");
    setStructuredData(null);
    setError(null);
  };

  // Get current step helper info
  const getStepInfo = () => {
    switch (currentStep) {
      case 1:
        return {
          label: "1. Tez Konusu",
          percent: 0,
          placeholder: "Tez konunuzu veya başlığınızı buraya yazın...",
        };
      case 2:
        return {
          label: "2. Araştırma Sorusu",
          percent: 25,
          placeholder: "Tezinizin ana araştırma sorusunu buraya yazın...",
        };
      case 3:
        return {
          label: "3. Teorik Odak",
          percent: 50,
          placeholder:
            "Teorik kavramları ve odak teorisyenlerinizi buraya yazın...",
        };
      case 4:
        return {
          label: "4. Ampirik Alan",
          percent: 75,
          placeholder:
            "Dönemsel sınırları, incelediğiniz yılları/vakaları yazın...",
        };
      default:
        return { label: "Tez Anayasası", percent: 100, placeholder: "" };
    }
  };

  const stepInfo = getStepInfo();

  return (
    <div className="flex flex-col bg-background px-4 py-8 items-center justify-center min-h-full w-full">
      <div className="w-full max-w-3xl border border-border bg-card rounded-lg shadow-2xl relative overflow-hidden flex flex-col min-h-[600px] max-h-[85vh]">
        {/* Top Decorative Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

        {/* Header Section */}
        <div className="border-b border-border p-4 md:p-6 bg-card flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-secondary p-2 rounded-lg border border-border">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground font-sans">
                Tez Anayasası
              </h1>
              <p className="text-xs text-muted-foreground">
                Prof. Dr. Verita ile Tez Anayasası&apos;nı oluşturun
              </p>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className="inline-flex items-center rounded-full bg-secondary border border-border px-3 py-1 text-xs font-semibold text-primary">
              Aşama {Math.min(currentStep, 4)} / 4
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        {currentStep <= 4 && (
          <div className="w-full h-[3px] bg-secondary relative">
            <div
              className="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${stepInfo.percent}%` }}
            />
          </div>
        )}

        {/* 1. INTERACTIVE CHAT SCREEN */}
        {currentStep <= 4 && (
          <ChatScreen
            messages={messages}
            userResponse={userResponse}
            setUserResponse={setUserResponse}
            isLoading={isLoading}
            isOriginalityLoading={isOriginalityLoading}
            error={error}
            handleSubmit={handleSubmit}
            stepInfo={stepInfo}
          />
        )}

        {/* 2. STRUCTURED PREVIEW & CONFIRMATION SCREEN (STEP 5) */}
        {currentStep === 5 && (
          <PreviewScreen
            structuredData={structuredData}
            isSaving={isSaving}
            error={error}
            handleConfirmSave={handleConfirmSave}
            handleReset={handleReset}
            messages={messages}
          />
        )}
      </div>
    </div>
  );
}
