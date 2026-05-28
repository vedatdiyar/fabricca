"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Coffee } from "lucide-react";
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
        "Merhaba Vedat. Kahvemi yeni koydum, seni bekliyordum.\n\nTez anayasanı birlikte inşa edeceğiz — ama bunu sıkıcı bir form doldurma seansı gibi yapmayacağız. Seninle gerçek bir akademik tartışma yürüteceğiz: konunun sınırlarını, araştırma sorusunu, teorik zeminini ve yöntemini organik bir sohbet içinde netleştireceğiz.\n\nHazır olduğunda mülakata başlayabiliriz. Bana anlat: üzerinde çalışmak istediğin konu nedir?",
    },
  ]);
  const [isChatActive, setIsChatActive] = useState<boolean>(true);
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
    boxes?: {
      name: string;
      description: string;
    }[];
  } | null>(null);

  // "Pending" state: hoca onay teklif etti (structuredData dolu, needsReview=true),
  // ama kullanıcı henüz arayüzdeki butona basmadı.
  const [pendingStructuredData, setPendingStructuredData] = useState<{
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
    boxes?: {
      name: string;
      description: string;
    }[];
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

      // Extract report data for risk-aware professor routing during revision discussions
      const lastReport = currentMessages
        .filter((m) => m.role === "originality_report")
        .pop();

      // Call Server Action to get next question, revision discussion, or final synthesis
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

      // Check if the final structured thesis core has been synthesized
      if (res.structuredData) {
        // Find the last originality report in the conversation to see if we are already approved
        const lastReportInHistory = currentMessages
          .filter((m) => m.role === "originality_report")
          .pop();
        const isAlreadyApproved =
          lastReportInHistory?.reportData?.risk === "Düşük";

        if (!isAlreadyApproved) {
          setIsOriginalityLoading(true);
          try {
            // Synthesize thesis parameters into a clean summary to check originality
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
              setMessages(currentMessages);

              // If risk is Medium or High, block completion and discuss revision
              if (
                origRes.report.risk === "Orta" ||
                origRes.report.risk === "Yüksek"
              ) {
                setIsOriginalityLoading(false);
                setIsLoading(true);

                // Get the professor's high-risk response to warn the user and discuss revision
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
                  setMessages((prev) => [
                    ...prev,
                    { role: "model", content: revRes.message || "" },
                  ]);
                }
                return; // End handleSubmit here (STRICTLY KEEPS USER IN CHAT FOR REVISION!)
              } else {
                // Low risk — surface professor's offer and pending approve button
                setMessages((prev) => [
                  ...prev,
                  { role: "model", content: res.message || "" },
                ]);
                setPendingStructuredData(res.structuredData);
              }
            } else {
              // Fallback if scanner fails — still surface approve button
              setMessages((prev) => [
                ...prev,
                { role: "model", content: res.message || "" },
              ]);
              setPendingStructuredData(res.structuredData);
            }
          } catch (origErr) {
            console.error("Originality Check Error:", origErr);
            setPendingStructuredData(res.structuredData);
          } finally {
            setIsOriginalityLoading(false);
          }
        } else {
          // Already has an approved low-risk originality report
          setMessages((prev) => [
            ...prev,
            { role: "model", content: res.message || "" },
          ]);
          setPendingStructuredData(res.structuredData);
        }
      } else {
        // Normal sohbet akışı — structuredData null, devam ediyor
        setMessages((prev) => [
          ...prev,
          { role: "model", content: res.message || "" },
        ]);
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
      router.push("/");
    } catch (err) {
      console.error("Save Thesis Core Error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Kayıt sırasında bir hata oluştu.";
      setError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Kullanıcı "Tez Anayasasını Onayla ve İlerle" butonuna bastığında:
  // pending synthezi confirmed'e taşı, isChatActive kapat → PreviewScreen gösterilir.
  const handleApproveConstitution = () => {
    if (!pendingStructuredData) return;
    setStructuredData(pendingStructuredData);
    setPendingStructuredData(null);
    setIsChatActive(false);
  };

  // Reset to initial state
  const handleReset = () => {
    setMessages([
      {
        role: "model",
        content:
          "Merhaba Vedat. Kahvemi yeni koydum, seni bekliyordum.\n\nTez anayasanı birlikte inşa edeceğiz — ama bunu sıkıcı bir form doldurma seansı gibi yapmayacağız. Seninle gerçek bir akademik tartışma yürüteceğiz: konunun sınırlarını, araştırma sorusunu, teorik zeminini ve yöntemini organik bir sohbet içinde netleştireceğiz.\n\nHazır olduğunda mülakata başlayabiliriz. Bana anlat: üzerinde çalışmak istediğin konu nedir?",
      },
    ]);
    setIsChatActive(true);
    setUserResponse("");
    setStructuredData(null);
    setPendingStructuredData(null);
    setError(null);
  };

  return (
    <div className="flex flex-col bg-background px-4 py-4 items-center justify-center h-screen w-full overflow-hidden">
      <div className="w-full max-w-5xl border border-border bg-card rounded-lg shadow-2xl relative overflow-hidden flex flex-col h-[90vh]">
        {/* Top Decorative Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Header Section — Academic Dialogue Lounge */}
        <div className="border-b border-border p-4 md:p-5 bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-secondary p-2 rounded-lg border border-border">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground font-sans">
                Prof. Dr. Verita ile Tez Mülakatı
              </h1>
              <p className="text-xs text-muted-foreground font-sans">
                Tez anayasasını hazırlamak için serbest bir akademik diyalog
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Coffee className="h-4 w-4 text-primary" />
            <span className="text-xs font-sans hidden md:block">
              Sözel onay verdiğinde anayasa basılır
            </span>
          </div>
        </div>

        {/* 1. INTERACTIVE CHAT SCREEN */}
        {isChatActive && (
          <ChatScreen
            messages={messages}
            userResponse={userResponse}
            setUserResponse={setUserResponse}
            isLoading={isLoading}
            isOriginalityLoading={isOriginalityLoading}
            error={error}
            handleSubmit={handleSubmit}
            pendingStructuredData={pendingStructuredData}
            onApproveConstitution={handleApproveConstitution}
          />
        )}

        {/* 2. STRUCTURED PREVIEW & CONFIRMATION SCREEN */}
        {!isChatActive && (
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
