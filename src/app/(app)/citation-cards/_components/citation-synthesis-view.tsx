"use client";

import { useState } from "react";
import {
  Sparkles,
  Layers,
  Copy,
  Check,
  Loader2,
  ListOrdered,
  Pin,
  X,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  synthesizeCitationCardsAction,
  type CitationSynthesisReport,
} from "../ai-actions";
import { updateCardOutlineLinkAction } from "../mutation-actions";
import type { CitationCardItem, OutlineItem, SourceItem } from "../_lib/types";

interface CitationSynthesisViewProps {
  cards: CitationCardItem[];
  outlines: OutlineItem[];
  sources: SourceItem[];
  selectedOutlineId: number | null;
  onRefreshData: () => Promise<void>;
  onClose: () => void;
}

/**
 * In-place Fikir & Sentez Düzenleyici Panel.
 * Renders directly inside the active section workspace on /citation-cards.
 */
export function CitationSynthesisView({
  cards,
  outlines,
  sources,
  selectedOutlineId,
  onRefreshData,
  onClose,
}: CitationSynthesisViewProps) {
  const [synthesisReport, setSynthesisReport] =
    useState<CitationSynthesisReport | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeTab, setActiveTab] = useState<"clusters" | "flow">("clusters");
  const [hasCopiedFlow, setHasCopiedFlow] = useState(false);
  const [isPinningCluster, setIsPinningCluster] = useState<string | null>(null);

  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const outlineMap = new Map(outlines.map((o) => [o.id, o]));

  const selectedOutline = selectedOutlineId
    ? outlineMap.get(selectedOutlineId)
    : null;

  // Run AI Synthesis
  const handleRunSynthesis = async () => {
    if (cards.length === 0) {
      toast.error("Sentez yapabilmek için en az 1 alıntı fişiniz olmalıdır.");
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await synthesizeCitationCardsAction(
        selectedOutlineId || undefined,
      );
      if (res.success) {
        setSynthesisReport(res.data);
        toast.success(
          "Fişler semantik kümelere ayrıldı ve yazım akış sırası çıkarıldı.",
        );
      } else {
        toast.error(res.error || "Sentez oluşturulamadı.");
      }
    } catch {
      toast.error("Sentez işlemi sırasında bir hata oluştu.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Automatically trigger on mount if not yet generated
  useState(() => {
    handleRunSynthesis();
  });

  // 1-Click pin all cards in a cluster to suggested outline
  const handlePinClusterToOutline = async (
    clusterId: string,
    cardIds: number[],
    targetOutlineId: number,
  ) => {
    setIsPinningCluster(clusterId);
    try {
      for (const cardId of cardIds) {
        await updateCardOutlineLinkAction({
          annotationId: cardId,
          outlineId: targetOutlineId,
        });
      }
      await onRefreshData();
      toast.success(
        "Kümedeki tüm fişler seçili tez bölümüne başarıyla atandı.",
      );
    } catch {
      toast.error("Fişler bölüme atanırken hata oluştu.");
    } finally {
      setIsPinningCluster(null);
    }
  };

  // Copy Argument Flow to Clipboard for Word
  const handleCopyFlowForWord = async () => {
    if (!synthesisReport || synthesisReport.argumentFlow.length === 0) return;

    const formattedLines = [
      `=== TEZ YAZIM PLANI: ARGÜMAN AKIŞ SIRASI ===`,
      selectedOutline
        ? `Hedef Bölüm: ${selectedOutline.title}`
        : "Genel Sentez Planı",
      `Tarih: ${new Date().toLocaleDateString("tr-TR")}`,
      ``,
    ];

    synthesisReport.argumentFlow.forEach((step) => {
      const card = cardMap.get(step.cardId);
      const src = card ? sourceMap.get(card.sourceId) : null;
      const citation = src
        ? `${src.title} (s. ${card?.pageNumber || ""})`
        : "Kaynak";

      formattedLines.push(`[Adım ${step.step}] Rol: ${step.roleInArgument}`);
      formattedLines.push(`Alıntı: "${card?.content || ""}" (${citation})`);
      formattedLines.push(`🔗 Geçiş / Bağlantı Notu: ${step.transitionNote}`);
      formattedLines.push(``);
    });

    await navigator.clipboard.writeText(formattedLines.join("\n"));
    setHasCopiedFlow(true);
    toast.success("Argüman akış sırası Word için panoya kopyalandı.");
    setTimeout(() => setHasCopiedFlow(false), 2500);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-b from-primary/5 via-card to-card shadow-sm p-4 sm:p-5 flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-sm font-semibold text-foreground">
                Fikir & Argüman Sentezi
              </h3>
              {selectedOutline ? (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/10 text-primary border-primary/20"
                >
                  {selectedOutline.title}
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-muted text-muted-foreground"
                >
                  Tüm Fişler
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Fişlerin anlamsal temaları ve Word tez yazım akış sırası.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {synthesisReport && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunSynthesis}
              disabled={isSynthesizing}
              className="text-xs h-7 gap-1 border-border bg-background hover:bg-muted text-foreground cursor-pointer"
            >
              <RotateCw
                className={`h-3 w-3 ${isSynthesizing ? "animate-spin" : ""}`}
              />
              <span>Yeniden Sentezle</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
            title="Sentez Panelini Kapat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Synthesis Content or Loading */}
      {isSynthesizing ? (
        <div className="py-10 flex flex-col items-center justify-center text-center gap-2.5">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-medium">
            Alıntı fişleri anlamsal kümelere ayrılıyor ve Word yazım akışı
            hazırlanıyor...
          </span>
        </div>
      ) : !synthesisReport ? (
        <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-xs text-muted-foreground">
            Sentez henüz oluşturulmadı.
          </p>
          <Button
            size="sm"
            onClick={handleRunSynthesis}
            className="bg-primary text-primary-foreground text-xs h-8 px-4 gap-1.5 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Şimdi Sentezle</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Sub-tabs: Clusters vs Argument Flow */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "clusters" | "flow")}
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-muted/60 h-8 p-0.5">
                <TabsTrigger
                  value="clusters"
                  className="text-xs h-7 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Semantik Fikir Kümeleri</span>
                  <span className="px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                    {synthesisReport.clusters.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="flow"
                  className="text-xs h-7 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
                >
                  <ListOrdered className="h-3.5 w-3.5 text-amber-500" />
                  <span>Word Argüman Akış Sırası</span>
                  <span className="px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                    {synthesisReport.argumentFlow.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "flow" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyFlowForWord}
                className="text-xs h-7 gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 shrink-0 cursor-pointer"
              >
                {hasCopiedFlow ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Word Akışını Kopyala</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* TAB 1: SEMANTIC CLUSTERS */}
          {activeTab === "clusters" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {synthesisReport.clusters.map((cluster) => {
                const clusterCards = cluster.cardIds
                  .map((id) => cardMap.get(id))
                  .filter((c): c is CitationCardItem => c !== undefined);

                return (
                  <Card
                    key={cluster.id}
                    className="border-border bg-card flex flex-col justify-between shadow-2xs overflow-hidden"
                  >
                    <div className="p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <h4 className="font-serif text-xs font-semibold text-foreground">
                            {cluster.themeTitle}
                          </h4>
                        </div>

                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-muted text-muted-foreground"
                        >
                          {clusterCards.length} Fiş
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {cluster.description}
                      </p>

                      {/* Cards Mini List in this Cluster */}
                      <div className="space-y-1.5 pt-2 border-t border-border/40">
                        {clusterCards.map((card) => {
                          const src = sourceMap.get(card.sourceId);

                          return (
                            <div
                              key={card.id}
                              className="p-2 rounded-md bg-muted/40 border border-border/70 text-[11px] flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                <span className="font-medium text-foreground truncate max-w-[180px]">
                                  {src?.title || "Kaynak"}
                                </span>
                                <span>s. {card.pageNumber}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                                &quot;{card.content}&quot;
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cluster Footer: Quick Assign to Outline */}
                    {cluster.suggestedOutlineId && (
                      <div className="p-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground truncate">
                          Önerilen Bölüm:{" "}
                          <strong>
                            {cluster.suggestedOutlineTitle ||
                              `Bölüm #${cluster.suggestedOutlineId}`}
                          </strong>
                        </span>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            cluster.suggestedOutlineId &&
                            handlePinClusterToOutline(
                              cluster.id,
                              cluster.cardIds,
                              cluster.suggestedOutlineId,
                            )
                          }
                          disabled={isPinningCluster === cluster.id}
                          className="h-6 text-[11px] text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 cursor-pointer shrink-0"
                        >
                          {isPinningCluster === cluster.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Pin className="h-3 w-3" />
                          )}
                          <span>Bölüme Ata</span>
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* TAB 2: ARGUMENT FLOW FOR WORD */}
          {activeTab === "flow" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground mr-1">
                  Word Tez Yazım Kılavuzu:
                </span>
                Bu sıralama, alıntılarınızı tezinizde sunarken mantıksal bir
                argüman akışı oluşturmanız için tasarlanmıştır.
              </div>

              <div className="space-y-2.5 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
                {synthesisReport.argumentFlow.map((step) => {
                  const card = cardMap.get(step.cardId);
                  const src = card ? sourceMap.get(card.sourceId) : null;

                  return (
                    <div
                      key={step.step}
                      className="relative pl-8 flex flex-col gap-1.5"
                    >
                      {/* Step Indicator Dot */}
                      <div className="absolute left-2 top-2.5 -translate-x-1/2 h-4 w-4 rounded-full bg-card border-2 border-primary flex items-center justify-center text-[9px] font-bold text-primary shadow-2xs">
                        {step.step}
                      </div>

                      <Card className="border-border bg-card shadow-2xs p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-primary/10 text-primary border-primary/20"
                          >
                            {step.roleInArgument}
                          </Badge>

                          {src && (
                            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[220px]">
                              {src.title} — s. {card?.pageNumber || ""}
                            </span>
                          )}
                        </div>

                        {card && (
                          <div className="p-2 rounded-md bg-muted/30 border border-border/60 text-[11px] text-foreground leading-relaxed italic">
                            &quot;{card.content}&quot;
                          </div>
                        )}

                        {/* Transition Note */}
                        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] leading-relaxed text-foreground">
                          <span className="font-semibold text-amber-600 dark:text-amber-400 block mb-0.5">
                            🔗 Geçiş ve Eklemlenme Önerisi:
                          </span>
                          {step.transitionNote}
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
