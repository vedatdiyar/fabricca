"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw, ArrowRight, AlertCircle } from "lucide-react";
import { ChatMessage } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OriginalityReport } from "./originality-report";

interface PreviewScreenProps {
  structuredData: {
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
    boxes?: {
      name: string;
      description: string;
    }[];
  } | null;
  isSaving: boolean;
  error: string | null;
  handleConfirmSave: () => void;
  handleReset: () => void;
  messages: ChatMessage[];
}

export function PreviewScreen({
  structuredData,
  isSaving,
  error,
  handleConfirmSave,
  handleReset,
  messages,
}: PreviewScreenProps) {
  if (!structuredData) return null;

  // Extract the latest originality report from the chat history
  const originalityReportMsg = [...messages]
    .reverse()
    .find((m) => m.role === "originality_report");
  const reportData = originalityReportMsg?.reportData;

  return (
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
              "Mülakatımız başarıyla tamamlandı Vedat. Tez anayasanın unsurlarını akademik açıdan rafine ederek aşağıda derledim. Lütfen incele."}
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

          {/* 5. Thematic Study Boxes */}
          {structuredData.boxes && structuredData.boxes.length > 0 && (
            <div className="border border-border bg-secondary/40 p-4 rounded-lg space-y-3 relative overflow-hidden md:col-span-2">
              <div className="absolute top-0 left-0 w-[3px] h-full bg-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Önerilen Tematik Çalışma Kutuları (Bilgi Fişleri)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {structuredData.boxes.map((box, index) => (
                  <div
                    key={`box_${index}`}
                    className="border border-border bg-background p-3 rounded-md space-y-1 relative overflow-hidden"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground font-semibold">
                        Kutu {index + 1}
                      </span>
                      <h4 className="text-xs font-bold text-foreground">
                        {box.name}
                      </h4>
                    </div>
                    {box.description && (
                      <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                        {box.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Originality Report Section */}
      {reportData && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Akademik Özgünlük Değer Raporu ve Gap Analizi
          </h2>
          <OriginalityReport reportData={reportData} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Alert
          variant="destructive"
          className="border-destructive bg-destructive/10 text-destructive-foreground items-center"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
          <AlertDescription className="text-xs font-semibold leading-normal">
            <span className="font-bold">Hata:</span> {error}
          </AlertDescription>
        </Alert>
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
  );
}
