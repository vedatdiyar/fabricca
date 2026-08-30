import { positioningMatrixSchema } from "../_services/validation";
import type { ThesisMatrix } from "@/lib/types";
import { sanitizeAcademicDataBulk } from "@/core/services/academic";
import type { Logger } from "@/lib/logger";
import type { JuryAnalysisResult } from "../_services/analysis";

/**
 * Parses and validates thesis matrix input for positioning flow.
 *
 * @param matrixInput - Raw thesis matrix.
 * @returns Validated matrix or error message.
 */
export function parsePositioningMatrixInput(matrixInput: ThesisMatrix):
  | {
      success: true;
      data: {
        subjectProblem: string;
        theoreticalFramework: string;
        primaryMaterial?: string;
        methodology: string;
      };
    }
  | { success: false; error: string } {
  const positioningInput: Record<string, string> = {
    subjectProblem: matrixInput.subjectProblem ?? "",
    theoreticalFramework: matrixInput.theoreticalFramework ?? "",
    primaryMaterial: matrixInput.primaryMaterial ?? "",
    methodology: matrixInput.methodology ?? "",
  };

  const parsed = positioningMatrixSchema.safeParse(positioningInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { success: false, error: msg };
  }

  return { success: true, data: parsed.data };
}

/**
 * Sanitizes recommended thesis titles and authors in place.
 *
 * @param juryResult - Jury result whose theses will be sanitized.
 * @param logger - Logger instance.
 */
export async function sanitizeJuryTheses(
  juryResult: JuryAnalysisResult,
  logger: Logger,
): Promise<void> {
  if (
    !juryResult.recommendedTheses ||
    juryResult.recommendedTheses.length === 0
  ) {
    return;
  }
  const itemsToSanitize = juryResult.recommendedTheses.map((t) => ({
    title: t.title || "",
    author: t.author || "",
  }));
  const sanitized = await sanitizeAcademicDataBulk(itemsToSanitize, logger);
  juryResult.recommendedTheses = juryResult.recommendedTheses.map((t, idx) => ({
    ...t,
    title: sanitized[idx]?.title || t.title,
    author: sanitized[idx]?.author || t.author,
  }));
}
