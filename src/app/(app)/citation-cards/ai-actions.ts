"use server";

import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  autoMapCitationCards,
  type AutoMapCardsResult,
} from "./_services/ai-card-mapper";
import {
  runCitationSynthesis,
  type CitationSynthesisReport,
} from "./_services/citation-synthesis.service";
import { fetchCitationCardsData } from "./_services/citation-cards-query";
import type {
  CitationCardItem,
  OutlineItem,
  SourceItem,
} from "./_lib/types";
import { revalidatePath } from "next/cache";

export type { CitationSynthesisReport };

/**
 * Server Action: Automatically maps unassigned (or specific) citation cards to
 * thesis outline sections using Gemini Flash.
 *
 * @param specificCardIds - Optional subset of citation card IDs to map.
 * @returns Mapping outcome with mapped count and details on success, or an error message.
 */
export async function autoMapCitationCardsAction(
  specificCardIds?: number[],
): Promise<
  | { success: true; data: AutoMapCardsResult }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const result = await autoMapCitationCards(
      session.userId,
      specificCardIds,
      log,
    );
    if (!result.success) {
      return result;
    }

    revalidatePath("/citation-cards");
    revalidatePath("/thesis-architecture");

    log.info("auto_map_citation_cards_action_success", {
      service: "citation-cards",
      data: { mappedCount: result.data.mappedCount },
    });

    return result;
  } catch (err) {
    log.error("auto_map_citation_cards_action_failed", {
      service: "citation-cards",
      error: err,
    });
    return {
      success: false,
      error: "Yapay zeka fiş eşlemesi yapılırken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Generates semantic clusters and sequential argument flow for writing in Word.
 *
 * @param targetOutlineId - Optional selected outline ID to focus synthesis on.
 * @returns Synthesis report with clusters and flow steps.
 */
export async function synthesizeCitationCardsAction(
  targetOutlineId?: number,
): Promise<
  | { success: true; data: CitationSynthesisReport }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const rawData = await fetchCitationCardsData(session.userId);
    const { cards, outlines, sources } = rawData;

    if (cards.length === 0) {
      return {
        success: false,
        error: "Sentez yapmak için kütüphanenizde en az 1 alıntı fişi bulunmalıdır.",
      };
    }

    const sourceMap = new Map<number, SourceItem>(sources.map((s) => [s.id, s]));

    const formattedCards = cards.map((c: CitationCardItem) => {
      const src = sourceMap.get(c.sourceId);
      return {
        id: c.id,
        content: c.content,
        sourceTitle: src?.title || "Bilinmeyen Kaynak",
        authors: src?.authors || undefined,
        year: src?.publicationYear || null,
        pageNumber: c.pageNumber,
        noteType: c.noteType,
        outlineId: c.outlineIds && c.outlineIds.length > 0 ? c.outlineIds[0] : null,
      };
    });

    const report = await runCitationSynthesis({
      cards: formattedCards,
      outlines: outlines.map((o: OutlineItem) => ({
        id: o.id,
        title: o.title,
        description: o.description,
      })),
      targetOutlineId,
    });

    log.info("synthesize_citation_cards_success", {
      service: "citation-cards",
      data: {
        clusterCount: report.clusters.length,
        flowStepCount: report.argumentFlow.length,
      },
    });

    return { success: true, data: report };
  } catch (err) {
    log.error("synthesize_citation_cards_failed", {
      service: "citation-cards",
      error: err,
    });
    return {
      success: false,
      error: "Alıntı fişleri sentezlenirken bir hata oluştu.",
    };
  }
}
