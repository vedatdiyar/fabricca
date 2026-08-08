"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { runLiteratureExpansion } from "@/lib/literature-expansion/expansion-orchestrator";
import type { ExpansionResult } from "@/lib/literature-expansion/types";

/**
 * Server Action: Triggers automatic literature expansion (2 backward + 2 forward sources) for a Sub-Box.
 *
 * @param boxId - Target Sub-Box ID.
 * @returns Result object with success flag, expansion data, or error message.
 */
export async function triggerLiteratureExpansionAction(
  boxId: number,
): Promise<
  { success: true; data: ExpansionResult } | { success: false; error: string }
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

    log.info("trigger_expansion_action_start", {
      service: "literature",
      data: { boxId, userId: session.userId },
    });

    const result = await runLiteratureExpansion(boxId);

    revalidatePath("/library");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "Literatür genişletme işlemi sırasında beklenmeyen bir hata oluştu.";

    log.error("trigger_expansion_action_failed", {
      service: "literature",
      error: err,
      data: { boxId },
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
