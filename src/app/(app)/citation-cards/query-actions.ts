"use server";

import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { fetchCitationCardsData } from "@/app/(app)/citation-cards/_services/citation-cards-service";
import type { BoxItem, CitationCardItem, SourceItem } from "./_lib/types";

/**
 * Server Action: Fetches all topic boxes, sources, and citation annotations for the logged-in user.
 *
 * @returns The user's citation cards, boxes, and sources data on success, or an error message on failure.
 */
export async function getCitationCardsDataAction(): Promise<
  | {
      success: true;
      data: {
        cards: CitationCardItem[];
        boxes: BoxItem[];
        sources: SourceItem[];
      };
    }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        error: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      };
    }

    const data = await fetchCitationCardsData(session.userId);

    return {
      success: true,
      data,
    };
  } catch (err) {
    log.error("get_citation_cards_data_failed", {
      service: "citation-cards",
      error: err,
    });
    return {
      success: false,
      error: "Alıntı fişleri verileri yüklenirken bir hata oluştu.",
    };
  }
}
