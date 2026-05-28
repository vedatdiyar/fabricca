"use client";

import React, { useEffect, useState, useCallback } from "react";
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

interface InsightsState {
  insights: InsightItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  ideaText: string;
  sharpeningIds: Record<number, boolean>;
  errorMessage: string;
}

const INITIAL_STATE: InsightsState = {
  insights: [],
  isLoading: true,
  isSubmitting: false,
  ideaText: "",
  sharpeningIds: {},
  errorMessage: "",
};

interface InsightFormProps {
  ideaText: string;
  isSubmitting: boolean;
  onChangeText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function InsightForm({
  ideaText,
  isSubmitting,
  onChangeText,
  onSubmit,
}: InsightFormProps) {
  return (
    <form
      onSubmit={onSubmit}
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
          placeholder="Örn: Hipoteziniz, kavramsal notunuz veya anlık düşünceniz..."
          value={ideaText}
          onChange={(e) => onChangeText(e.target.value)}
          required
          rows={5}
          aria-label="Hipotez veya kavramsal not girişi"
          className="w-full bg-background border border-border px-3 py-2 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans leading-relaxed resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary text-primary-foreground text-sm font-semibold rounded h-10 hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Lightbulb className="size-4" />
            <span>Fikri Sepete Ekle</span>
          </>
        )}
      </button>
    </form>
  );
}

interface InsightCardProps {
  insight: InsightItem;
  index: number;
  isSharpening: boolean;
  onDelete: (id: number) => void;
  onSharpen: (id: number) => void;
}

function InsightCard({
  insight,
  index,
  isSharpening,
  onDelete,
  onSharpen,
}: InsightCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4 hover:border-border transition duration-150 relative">
      {/* Top Action Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
          <MessageSquare className="size-3" />
          <span>Fikir #{index + 1}</span>
        </div>

        <button
          onClick={() => onDelete(insight.id)}
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
            ? new Date(insight.createdAt).toLocaleDateString("tr-TR")
            : ""}
        </span>

        <button
          onClick={() => onSharpen(insight.id)}
          disabled={isSharpening}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded transition duration-150 border border-border bg-background cursor-pointer text-primary hover:bg-accent disabled:opacity-50"
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
            <span>Hoca Yönlendirmesi & Entegrasyon Önerileri</span>
          </h4>

          <div className="text-sm text-muted-foreground leading-relaxed font-sans prose prose-invert max-w-none [&_li]:mb-4">
            <ReactMarkdown>{insight.aiContextSuggestions}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const [insightsState, setInsightsState] =
    useState<InsightsState>(INITIAL_STATE);

  const loadInsights = useCallback(async () => {
    try {
      setInsightsState((prev) => ({ ...prev, isLoading: true }));
      const res = await getInsightsAction();
      if (res.success && res.insights) {
        setInsightsState((prev) => ({
          ...prev,
          insights: res.insights!,
          errorMessage: "",
        }));
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir sepeti yüklenemedi.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası oluştu.",
      }));
    } finally {
      setInsightsState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) {
        loadInsights();
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadInsights]);

  const handleCreateInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    const ideaTextTrimmed = insightsState.ideaText.trim();
    if (!ideaTextTrimmed) return;

    try {
      setInsightsState((prev) => ({
        ...prev,
        isSubmitting: true,
        errorMessage: "",
      }));
      const res = await createInsightAction(ideaTextTrimmed);
      if (res.success) {
        setInsightsState((prev) => ({ ...prev, ideaText: "" }));
        await loadInsights();
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir kaydedilirken bir hata oluştu.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Beklenmeyen bir hata oluştu.",
      }));
    } finally {
      setInsightsState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleDeleteInsight = async (insightId: number) => {
    try {
      const res = await deleteInsightAction(insightId);
      if (res.success) {
        setInsightsState((prev) => ({
          ...prev,
          insights: prev.insights.filter((item) => item.id !== insightId),
        }));
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir silinemedi.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası.",
      }));
    }
  };

  const handleSharpenInsight = async (insightId: number) => {
    try {
      setInsightsState((prev) => ({
        ...prev,
        sharpeningIds: { ...prev.sharpeningIds, [insightId]: true },
        errorMessage: "",
      }));
      const res = await sharpenInsightAction(insightId);
      if (res.success && res.suggestions) {
        setInsightsState((prev) => ({
          ...prev,
          insights: prev.insights.map((item) =>
            item.id === insightId
              ? { ...item, aiContextSuggestions: res.suggestions! }
              : item,
          ),
        }));
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir keskinleştirilemedi.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası.",
      }));
    } finally {
      setInsightsState((prev) => ({
        ...prev,
        sharpeningIds: { ...prev.sharpeningIds, [insightId]: false },
      }));
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 pb-20 md:pb-10 overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border pb-6 mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Lightbulb className="size-6 text-primary" />
            <span>Fikir Sepeti</span>
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
          <InsightForm
            ideaText={insightsState.ideaText}
            isSubmitting={insightsState.isSubmitting}
            onChangeText={(text) =>
              setInsightsState((prev) => ({ ...prev, ideaText: text }))
            }
            onSubmit={handleCreateInsight}
          />

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

          {insightsState.errorMessage && (
            <div className="text-xs text-destructive bg-card border border-destructive p-4 rounded flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{insightsState.errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Side: Ideas Stack */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Fikir Sepetim ({insightsState.insights.length})
          </h2>

          {insightsState.isLoading ? (
            <div className="border border-border bg-card rounded-lg p-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground mt-4 font-sans">
                Fikirler yükleniyor...
              </p>
            </div>
          ) : insightsState.insights.length === 0 ? (
            <div className="border border-dashed border-border bg-card rounded-lg p-12 text-center text-sm text-muted-foreground">
              Sepetiniz henüz boş. Aklınıza gelen ilk parlak fikri soldaki
              panelden ekleyebilirsiniz!
            </div>
          ) : (
            <div className="space-y-6">
              {insightsState.insights.map((insight, index) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  index={index}
                  isSharpening={
                    insightsState.sharpeningIds[insight.id] || false
                  }
                  onDelete={handleDeleteInsight}
                  onSharpen={handleSharpenInsight}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
