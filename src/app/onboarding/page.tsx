"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Sparkles,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  getProfessorOnboardingResponseAction,
  saveThesisCoreAction,
  ChatMessage,
} from "./actions";

export default function OnboardingPage() {
  const router = useRouter();

  // State Management
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content:
        "Merhaba sevgili meslektaşım, Fabricca'ya hoş geldin. Yüksek lisans tez sürecini planlamak, organize etmek ve seninle çalışmak için sabırsızlanıyorum.\n\nTez anayasamızı birlikte kurmak için 4 adımlı kısa bir akademik mülakat gerçekleştireceğiz. Bu sayede çalışmanın sınırlarını, sorusunu ve teorik zeminini netleştireceğiz.\n\nİlk olarak: **Tezinin başlığı veya üzerinde çalışmak istediğin genel konu nedir?** (Örneğin: *Post-2001 Türkiye finansallaşması* veya *Modernleşme ekseninde biyopolitika*)",
    },
  ]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [userResponse, setUserResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synthesis & Confirmation States
  const [structuredData, setStructuredData] = useState<{
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-grow textarea height on input
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [userResponse]);

  // Submit response handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userResponse.trim() || isLoading) return;

    const responseText = userResponse.trim();
    setUserResponse("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setError(null);
    setIsLoading(true);

    // Append user message
    const updatedHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: responseText },
    ];
    setMessages(updatedHistory);

    try {
      // Call Server Action to get next question or final synthesis
      const res = await getProfessorOnboardingResponseAction(
        messages,
        currentStep,
        responseText,
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
      } else {
        // Increment step
        setCurrentStep((prev) => prev + 1);
      }
    } catch (err: any) {
      console.error("Onboarding Error:", err);
      setError(err.message || "Bir hata oluştu, lütfen tekrar deneyin.");
      // Rollback last user message if failed so they can edit it
      setMessages((prev) => prev.slice(0, -1));
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
    } catch (err: any) {
      console.error("Save Thesis Core Error:", err);
      setError(err.message || "Kayıt sırasında bir hata oluştu.");
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
          "Merhaba sevgili meslektaşım, Fabricca'ya hoş geldin. Yüksek lisans tez sürecini planlamak, organize etmek ve seninle çalışmak için sabırsızlanıyorum.\n\nTez anayasamızı birlikte kurmak için 4 adımlı kısa bir akademik mülakat gerçekleştireceğiz. Bu sayede çalışmanın sınırlarını, sorusunu ve teorik zeminini netleştireceğiz.\n\nİlk olarak: **Tezinin başlığı veya üzerinde çalışmak istediğin genel konu nedir?** (Örneğin: *Post-2001 Türkiye finansallaşması* veya *Modernleşme ekseninde biyopolitika*)",
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
                Tez Onboarding Mülakatı
              </h1>
              <p className="text-xs text-muted-foreground">
                Prof. Dr. Tez Danışmanı ile Akademik Mülakat
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
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col justify-between">
            {/* Scrollable Message Box */}
            <div className="space-y-6 flex-1 overflow-y-auto max-h-[450px] pr-2">
              {messages.map((msg, index) => {
                const isModel = msg.role === "model";
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 ${
                      isModel ? "" : "flex-row-reverse"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border text-xs font-semibold ${
                        isModel
                          ? "bg-secondary text-primary border-primary"
                          : "bg-primary text-primary-foreground border-border"
                      }`}
                    >
                      {isModel ? "H" : "S"}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`flex flex-col max-w-[80%] rounded-lg p-4 font-sans text-sm leading-relaxed ${
                        isModel
                          ? "bg-secondary text-foreground border border-border shadow-sm"
                          : "bg-primary text-primary-foreground font-medium shadow-md"
                      }`}
                    >
                      {isModel ? (
                        <div className="prose prose-invert max-w-none text-foreground font-sans text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Professor Typing Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border bg-secondary text-primary border-primary text-xs font-semibold">
                    H
                  </div>
                  <div className="bg-secondary text-muted-foreground border border-border rounded-lg p-4 flex items-center space-x-2">
                    <span className="text-xs">Hoca düşünüyor</span>
                    <div className="flex space-x-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-75" />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-150" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error Box */}
              {error && (
                <div className="border border-destructive bg-card text-destructive p-4 rounded-lg flex items-start space-x-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="font-semibold">Hata Oluştu:</span> {error}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input & Form Box */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-border pt-4 mt-4"
            >
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                  <span>{stepInfo.label}</span>
                  <span>{stepInfo.percent}% Tamamlandı</span>
                </div>
                <div className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={userResponse}
                    onChange={(e) => setUserResponse(e.target.value)}
                    placeholder={stepInfo.placeholder}
                    rows={2}
                    className="flex-1 bg-secondary text-foreground border border-border rounded-lg p-3 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder-muted-foreground resize-none overflow-y-auto max-h-32"
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-4 rounded-lg flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                    disabled={isLoading || !userResponse.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  * Göndermek için Enter'a basın. Yeni satır için Shift + Enter
                  yapın.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* 2. STRUCTURED PREVIEW & CONFIRMATION SCREEN (STEP 5) */}
        {currentStep === 5 && structuredData && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col justify-between">
            {/* Header Greeting */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-primary">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span className="text-sm font-semibold tracking-wide uppercase">
                  Tez Anayasası Hazırlandı!
                </span>
              </div>
              <div className="bg-secondary text-foreground border border-border p-4 rounded-lg text-sm leading-relaxed font-sans">
                <ReactMarkdown>
                  {messages[messages.length - 1]?.content ||
                    "Mülakatımız başarıyla tamamlandı sevgili meslektaşım. Tez anayasanızın unsurlarını akademik açıdan rafine ederek aşağıda derledim. Lütfen inceleyin."}
                </ReactMarkdown>
              </div>
            </div>

            {/* Structured Card Grid */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tez Anayasası Ögeleri (Core Elements)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Title */}
                <div className="border border-border bg-secondary/40 p-4 rounded-lg space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tez Başlığı & Konusu
                  </span>
                  <p className="text-sm text-foreground font-semibold leading-snug">
                    {structuredData.title}
                  </p>
                </div>

                {/* 2. Research Question */}
                <div className="border border-border bg-secondary/40 p-4 rounded-lg space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Araştırma Sorusu (Research Question)
                  </span>
                  <p className="text-sm text-foreground font-semibold leading-relaxed">
                    {structuredData.researchQuestion}
                  </p>
                </div>

                {/* 3. Argument */}
                <div className="border border-border bg-secondary/40 p-4 rounded-lg space-y-2 relative overflow-hidden md:col-span-2">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Temel Teorik Çatı & Argüman
                  </span>
                  <p className="text-sm text-foreground font-sans leading-relaxed">
                    {structuredData.argument}
                  </p>
                </div>

                {/* 4. Methodology */}
                <div className="border border-border bg-secondary/40 p-4 rounded-lg space-y-2 relative overflow-hidden md:col-span-2">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tarihsel Sınırlar & Yöntem
                  </span>
                  <p className="text-sm text-foreground font-sans leading-relaxed">
                    {structuredData.methodology}
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="border border-destructive bg-card text-destructive p-4 rounded-lg flex items-start space-x-3 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <span className="font-semibold">Hata:</span> {error}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="border-t border-border pt-6 mt-4 flex flex-col md:flex-row md:justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                disabled={isSaving}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Baştan Başla
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    Tezi Onayla ve Devam Et
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
