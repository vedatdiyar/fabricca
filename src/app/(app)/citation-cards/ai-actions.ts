"use server";

import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  autoMapCitationCards,
  type AutoMapCardsResult,
} from "./_services/ai-card-mapper";
import { revalidatePath } from "next/cache";

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
