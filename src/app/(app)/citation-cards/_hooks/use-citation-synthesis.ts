"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  synthesizeCitationCardsAction,
  type CitationSynthesisReport,
} from "../ai-actions";
import { updateCardOutlineLinkAction } from "../mutation-actions";
import type { CitationCardItem, OutlineItem, SourceItem } from "../_lib/types";

interface UseCitationSynthesisProps {
  cards: CitationCardItem[];
  outlines: OutlineItem[];
  sources: SourceItem[];
  selectedOutlineId: number | null;
  onRefreshData: () => Promise<void>;
  onClose: () => void;
}

/**
 * Manages citation synthesis state, AI clustering and outline pinning.
 *
 * @param props - Hook props.
 * @returns Synthesis state, maps and handlers.
 */
export function useCitationSynthesisLogic({
  cards,
  outlines,
  sources,
  selectedOutlineId,
  onRefreshData,
}: UseCitationSynthesisProps) {
  const [synthesisState, setSynthesisState] = useState<{
    report: CitationSynthesisReport | null;
    isSynthesizing: boolean;
    activeTab: "clusters" | "flow";
    hasCopiedFlow: boolean;
    pinningClusterId: string | null;
  }>({
    report: null,
    isSynthesizing: cards.length > 0,
    activeTab: "clusters",
    hasCopiedFlow: false,
    pinningClusterId: null,
  });

  const sourceMap = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const outlineMap = useMemo(
    () => new Map(outlines.map((o) => [o.id, o])),
    [outlines],
  );

  const selectedOutline = selectedOutlineId
    ? outlineMap.get(selectedOutlineId)
    : null;

  const handleRunSynthesis = useCallback(async () => {
    if (cards.length === 0) {
      toast.error("Sentez yapabilmek için en az 1 alıntı fişiniz olmalıdır.");
      return;
    }

    setSynthesisState((prev) => ({ ...prev, isSynthesizing: true }));
    try {
      const res = await synthesizeCitationCardsAction(
        selectedOutlineId || undefined,
      );
      if (res.success) {
        setSynthesisState((prev) => ({ ...prev, report: res.data }));
        toast.success(
          "Fişler semantik kümelere ayrıldı ve yazım akış sırası çıkarıldı.",
        );
      } else {
        toast.error(res.error || "Sentez oluşturulamadı.");
      }
    } catch {
      toast.error("Sentez işlemi sırasında bir hata oluştu.");
    } finally {
      setSynthesisState((prev) => ({ ...prev, isSynthesizing: false }));
    }
  }, [cards.length, selectedOutlineId]);

  useEffect(() => {
    let isMounted = true;
    if (cards.length === 0) return;

    synthesizeCitationCardsAction(selectedOutlineId || undefined)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setSynthesisState((prev) => ({ ...prev, report: res.data }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setSynthesisState((prev) => ({ ...prev, isSynthesizing: false }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cards.length, selectedOutlineId]);

  const handlePinClusterToOutline = async (
    clusterId: string,
    cardIds: number[],
    targetOutlineId: number,
  ) => {
    setSynthesisState((prev) => ({ ...prev, pinningClusterId: clusterId }));
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
      setSynthesisState((prev) => ({ ...prev, pinningClusterId: null }));
    }
  };

  const handleCopyFlowForWord = async () => {
    const report = synthesisState.report;
    if (!report || report.argumentFlow.length === 0) return;

    const formattedLines = [
      `=== TEZ YAZIM PLANI: ARGÜMAN AKIŞ SIRASI ===`,
      selectedOutline
        ? `Hedef Bölüm: ${selectedOutline.title}`
        : "Genel Sentez Planı",
      `Tarih: ${new Date().toLocaleDateString("tr-TR")}`,
      ``,
    ];

    report.argumentFlow.forEach((step) => {
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
    setSynthesisState((prev) => ({ ...prev, hasCopiedFlow: true }));
    toast.success("Argüman akış sırası Word için panoya kopyalandı.");
    setTimeout(() => {
      setSynthesisState((prev) => ({ ...prev, hasCopiedFlow: false }));
    }, 2500);
  };

  return {
    synthesisState,
    setSynthesisState,
    sourceMap,
    cardMap,
    selectedOutline,
    handleRunSynthesis,
    handlePinClusterToOutline,
    handleCopyFlowForWord,
  };
}
