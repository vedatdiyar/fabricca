"use client";

import React, { useEffect, useState } from "react";
import {
  getInsightsAction,
  createInsightAction,
  deleteInsightAction,
  sharpenInsightAction,
  InsightItem,
} from "./actions";
import {
  Lightbulb,
  Sparkles,
  Trash2,
  Plus,
  Loader2,
  BrainCircuit,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ideaText, setIdeaText] = useState("");
  const [sharpeningIds, setSharpeningIds] = useState<Record<number, boolean>>(
    {},
  );
  const [errorMessage, setErrorMessage] = useState("");

  const loadInsights = async () => {
    try {
      setLoading(true);
      const res = await getInsightsAction();
      if (res.success && res.insights) {
        setInsights(res.insights);
      } else {
        setErrorMessage(res.error || "Fikir sepeti yüklenemedi.");
      }
    } catch (err) {
      setErrorMessage("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleCreateInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;

    try {
      setSubmitting(true);
      setErrorMessage("");
      const res = await createInsightAction(ideaText);
      if (res.success) {
        setIdeaText("");
        await loadInsights();
      } else {
        setErrorMessage(res.error || "Fikir kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      setErrorMessage("Beklenmeyen bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInsight = async (insightId: number) => {
    try {
      const res = await deleteInsightAction(insightId);
      if (res.success) {
        setInsights((prev) => prev.filter((item) => item.id !== insightId));
      } else {
        setErrorMessage(res.error || "Fikir silinemedi.");
      }
    } catch (err) {
      setErrorMessage("Bağlantı hatası.");
    }
  };

  const handleSharpenInsight = async (insightId: number) => {
    try {
      setSharpeningIds((prev) => ({ ...prev, [insightId]: true }));
      setErrorMessage("");
      const res = await sharpenInsightAction(insightId);
      if (res.success && res.suggestions) {
        setInsights((prev) =>
          prev.map((item) =>
            item.id === insightId
              ? { ...item, aiContextSuggestions: res.suggestions! }
              : item,
          ),
        );
      } else {
        setErrorMessage(res.error || "Fikir keskinleştirilemedi.");
      }
    } catch (err) {
      setErrorMessage("Bağlantı hatası.");
    } finally {
      setSharpeningIds((prev) => ({ ...prev, [insightId]: false }));
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 pb-20 md:pb-10 overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border pb-6 mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Lightbulb className="size-6 text-primary" />
            <span>Fikir Sepeti (AI Insights)</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Okuma notlarınızdan veya anlık ilhamlarınızdan gelen fikirleri
            saklayın ve Gemini ile keskinleştirin
          </p>
        </div>
        <span className="text-xs font-sans text-muted-foreground bg-card border border-border px-3 py-1 rounded w-fit">
          Fikir Laboratuvarı
        </span>
      </header>

      {/* Grid: New Idea Form & Existing Ideas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Idea Form & Information */}
        <div className="lg:col-span-1 space-y-6 h-fit">
          <form
            onSubmit={handleCreateInsight}
            className="bg-card border border-border p-6 rounded-lg space-y-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Plus className="size-4" />
              <span>Yeni Fikir Ekle</span>
            </h2>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-sans">
                Hipotez, Kavramsal Not veya Anlık Düşünce
              </label>
              <textarea
                placeholder="Örn: Kürt sol hareketinin 1970'lerdeki hegemonya kurma çabalarını Gramsciyen sivil toplum kavramsallaştırması üzerinden okumak..."
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                required
                rows={5}
                className="w-full bg-background border border-border px-3 py-2 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans leading-relaxed resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground text-sm font-semibold rounded h-10 hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Lightbulb className="size-4" />
                  <span>Fikri Sepete Ekle</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Info Box */}
          <div className="bg-card border border-border p-6 rounded-lg space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BrainCircuit className="size-4 text-primary" />
              <span>Fikir Keskinleştirici Nedir?</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fikirlerinizi sepete kaydettikten sonra,{" "}
              <strong>Fikir Keskinleştirici</strong> butonunu kullanarak Gemini
              3.1 Flash Lite modelini tetikleyebilirsiniz.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gemini, kaydettiğiniz ham fikri Neon veri tabanındaki{" "}
              <strong>Tez Anayasanız</strong> (Araştırma Sorusu, Argüman,
              Yöntem) ile çapraz karşılaştırarak, bu fikri tezinize en güçlü
              şekilde nasıl entegre edebileceğinizi gösteren
              <strong> 3 vurucu ve akademik içgörü</strong> üretir.
            </p>
          </div>

          {errorMessage && (
            <div className="text-xs text-destructive bg-card border border-destructive p-4 rounded flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Side: Ideas Stack */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Fikir Sepetim ({insights.length})
          </h2>

          {loading ? (
            <div className="border border-border bg-card rounded-lg p-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground mt-4 font-sans">
                Fikirler yükleniyor...
              </p>
            </div>
          ) : insights.length === 0 ? (
            <div className="border border-dashed border-border bg-card rounded-lg p-12 text-center text-sm text-muted-foreground">
              Sepetiniz henüz boş. Aklınıza gelen ilk parlak fikri soldaki
              panelden ekleyebilirsiniz!
            </div>
          ) : (
            <div className="space-y-6">
              {insights.map((insight) => {
                const isSharpening = sharpeningIds[insight.id] || false;

                return (
                  <div
                    key={insight.id}
                    className="bg-card border border-border rounded-lg p-6 space-y-4 hover:border-border transition duration-150 relative"
                  >
                    {/* Top Action Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                        <MessageSquare className="size-3" />
                        <span>Fikir #{insight.id}</span>
                      </div>

                      <button
                        onClick={() => handleDeleteInsight(insight.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition duration-150"
                        title="Fikri Sil"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* Raw User Idea */}
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                      {insight.insightText}
                    </p>

                    {/* Action Panel for AI sharpening */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-[10px] text-muted-foreground">
                        {insight.createdAt
                          ? new Date(insight.createdAt).toLocaleDateString(
                              "tr-TR",
                            )
                          : ""}
                      </span>

                      <button
                        onClick={() => handleSharpenInsight(insight.id)}
                        disabled={isSharpening}
                        className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded transition duration-150 border border-border bg-background cursor-pointer text-primary hover:bg-accent disabled:opacity-50`}
                      >
                        {isSharpening ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Keskinleştiriliyor...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3.5 text-primary" />
                            <span>Fikir Keskinleştirici (AI)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* AI Suggestions Box (If exists) */}
                    {insight.aiContextSuggestions && (
                      <div className="bg-background border border-primary p-5 rounded mt-4 space-y-3 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-bl">
                          Akademik İçgörü
                        </div>
                        <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                          <Sparkles className="size-3.5" />
                          <span>
                            Hoca Yönlendirmesi & Entegrasyon Önerileri
                          </span>
                        </h4>

                        <div className="text-sm text-muted-foreground leading-relaxed font-sans space-y-3 prose prose-invert max-w-none">
                          <ReactMarkdown>
                            {insight.aiContextSuggestions}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
