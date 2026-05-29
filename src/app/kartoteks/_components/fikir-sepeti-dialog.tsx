"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  Plus,
  Lightbulb,
  MessageSquare,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { InsightsState } from "../types";
import { inlineMarkdownComponents } from "./markdown-renderers";

export interface FikirSepetiDialogProps {
  isInsightsOpen: boolean;
  setIsInsightsOpen: (open: boolean) => void;
  insightsState: InsightsState;
  setInsightsState: React.Dispatch<React.SetStateAction<InsightsState>>;
  handleCreateInsight: (e: React.FormEvent) => void | Promise<void>;
  handleDeleteInsight: (insightId: number) => void | Promise<void>;
  handleSharpenInsight: (insightId: number) => void | Promise<void>;
}

export function FikirSepetiDialog({
  isInsightsOpen,
  setIsInsightsOpen,
  insightsState,
  setInsightsState,
  handleCreateInsight,
  handleDeleteInsight,
  handleSharpenInsight,
}: FikirSepetiDialogProps) {
  return (
    <>
      {/* Fikir Sepeti Yüzen Buton (FAB) */}
      <button
        onClick={() => setIsInsightsOpen(true)}
        className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8 flex items-center justify-center size-14 rounded-full border border-primary bg-background hover:bg-secondary text-primary shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:scale-105 active:scale-95 transition-all duration-200 group cursor-pointer"
        title="Fikir Sepeti & Fikir Keskinleştirici"
        aria-label="Fikir sepetini aç"
      >
        <Lightbulb className="size-6 text-primary group-hover:animate-pulse" />

        {/* Count Badge */}
        {insightsState.insights.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground font-sans ring-2 ring-background animate-fade-in">
            {insightsState.insights.length}
          </span>
        )}
      </button>

      {/* Fikir Sepeti Modal (Dialog) */}
      <Dialog
        open={isInsightsOpen}
        onOpenChange={(open) => {
          setIsInsightsOpen(open);
          if (!open) {
            setInsightsState((prev) => ({ ...prev, errorMessage: "" }));
          }
        }}
      >
        <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[85vh] overflow-y-auto bg-card border border-border p-6 flex flex-col font-sans">
          <DialogHeader className="border-b border-border pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lightbulb className="size-6 text-primary shrink-0" />
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Fikir Sepeti & Yapay Zeka Fikir Keskinleştirici
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Ham hipotezlerinizi, anlık düşüncelerinizi kaydedin ve
                    Gemini 3.1 Flash Lite ile tez anayasanıza göre
                    keskinleştirin.
                  </p>
                </div>
              </div>
              <DialogClose
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </DialogClose>
            </div>
          </DialogHeader>

          {/* Grid Layout inside Dialog */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pr-1">
            {/* Left Column: Form & Info */}
            <div className="lg:col-span-1 space-y-5 h-fit">
              <form
                onSubmit={handleCreateInsight}
                className="bg-secondary border border-border p-5 rounded-lg space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Plus className="size-4" />
                  <span>Yeni Fikir Ekle</span>
                </h3>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-sans">
                    Hipotez, Kavramsal Not veya Anlık Düşünce
                  </label>
                  <textarea
                    placeholder="Örn: Çalışmanızla ilişkili olabilecek hipoteziniz veya kavramsal notunuz..."
                    value={insightsState.ideaText}
                    onChange={(e) =>
                      setInsightsState((prev) => ({
                        ...prev,
                        ideaText: e.target.value,
                      }))
                    }
                    required
                    rows={4}
                    aria-label="Hipotez veya kavramsal not girişi"
                    className="w-full bg-background border border-border px-3 py-2 rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans leading-relaxed resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={insightsState.isSubmitting}
                  className="w-full bg-primary text-primary-foreground text-xs font-semibold rounded h-9 hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {insightsState.isSubmitting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <Lightbulb className="size-3.5" />
                      <span>Sepete Ekle</span>
                    </>
                  )}
                </button>
              </form>

              {/* Informative widget */}
              <div className="bg-secondary border border-border p-5 rounded-lg space-y-2.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                  <span>Nasıl Çalışır?</span>
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
                  Fikrinizi ekledikten sonra yanındaki{" "}
                  <strong>Keskinleştir (AI)</strong> butonuna tıklayarak Gemini
                  3.1&apos;i tetikleyin.
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
                  Model, ham fikri Neon&apos;daki{" "}
                  <strong>Tez Anayasanız</strong> ile karşılaştırır ve tezinize
                  entegre edecek 3 pratik akademik yönlendirme üretir.
                </p>
              </div>

              {insightsState.errorMessage && (
                <div className="text-[11px] text-destructive bg-secondary border border-destructive p-3 rounded flex items-start gap-2">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  <span>{insightsState.errorMessage}</span>
                </div>
              )}
            </div>

            {/* Right Column: List of Insights */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fikir Sepetim ({insightsState.insights.length})
              </h3>

              {insightsState.isLoading ? (
                <div className="border border-border bg-secondary rounded-lg p-10 text-center flex flex-col items-center justify-center">
                  <Loader2 className="size-6 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground mt-3 font-sans">
                    Fikirler yükleniyor...
                  </p>
                </div>
              ) : insightsState.insights.length === 0 ? (
                <div className="border border-dashed border-border bg-secondary rounded-lg p-10 text-center text-xs text-muted-foreground font-sans">
                  Sepetiniz henüz boş. Aklınıza gelen düşünceleri soldaki
                  panelden ekleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                  {insightsState.insights.map((insight, index) => (
                    <div
                      key={insight.id}
                      className="bg-secondary border border-border rounded-lg p-5 space-y-3 relative hover:border-border transition duration-150"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground bg-accent px-2 py-0.5 rounded border border-border">
                          <MessageSquare className="size-3 text-primary" />
                          <span>Fikir #{index + 1}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteInsight(insight.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition duration-150 cursor-pointer"
                          title="Fikri Sil"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                        {insight.insightText}
                      </p>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-[9px] text-muted-foreground">
                          {insight.createdAt
                            ? new Date(insight.createdAt).toLocaleDateString(
                                "tr-TR",
                              )
                            : ""}
                        </span>
                        <button
                          onClick={() => handleSharpenInsight(insight.id)}
                          disabled={
                            insightsState.sharpeningIds[insight.id] || false
                          }
                          className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded transition duration-150 border border-border bg-background cursor-pointer text-primary hover:bg-accent disabled:opacity-50"
                        >
                          {insightsState.sharpeningIds[insight.id] ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              <span>Keskinleştiriliyor...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-3 text-primary" />
                              <span>Fikir Keskinleştirici (AI)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* AI Suggestions inside Card */}
                      {insight.aiContextSuggestions && (
                        <div className="bg-background border border-primary p-4 rounded-lg mt-3 space-y-2 relative overflow-hidden">
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-bl">
                            Akademik İçgörü
                          </div>
                          <h4 className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                            <Sparkles className="size-3" />
                            <span>
                              Hoca Yönlendirmesi & Entegrasyon Önerileri
                            </span>
                          </h4>
                          <div className="text-[11px] text-muted-foreground leading-relaxed font-sans prose prose-invert max-w-none [&_li]:mb-2">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={inlineMarkdownComponents}
                            >
                              {insight.aiContextSuggestions}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
