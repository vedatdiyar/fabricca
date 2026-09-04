"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SUBMIT_PIPELINE } from "@/lib/pipeline-definitions";
import type { ThesisMatrix } from "@/lib/types";
import { savePositioningReportTransaction } from "../_services/decision-engine";
import { positioningMatrixSchema } from "../_services/validation";
import type { JuryAnalysisResult } from "../_services/analysis";

/**
 * Başlık ve yazar verilerini sanitize eder ve raporu veritabanına atomik olarak kaydeder.
 *
 * @param matrixInput - Tez matrisi.
 * @param juryResult - Jüri analiz sonucu.
 * @param flowId - Log akış kimliği.
 * @returns Başarı durumu veya hata mesajı.
 */
export async function persistPositioningReportAction(
  matrixInput: ThesisMatrix,
  juryResult: JuryAnalysisResult,
  flowId: string,
): Promise<{ success: true } | { error: string }> {
  const run = PipelineRun.resume(MATRIX_SUBMIT_PIPELINE, flowId);
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const positioningInput: Record<string, string> = {
      subjectProblem: matrixInput.subjectProblem ?? "",
      theoreticalFramework: matrixInput.theoreticalFramework ?? "",
      methodology: matrixInput.methodology ?? "",
    };

    const parsed = positioningMatrixSchema.safeParse(positioningInput);
    if (!parsed.success) {
      return { error: "Form doğrulaması başarısız." };
    }

    await run.execute("persist", async () => {
      const [matrix] = await db
        .select({ id: matrices.id })
        .from(matrices)
        .where(eq(matrices.userId, session.userId));

      if (!matrix) {
        throw new Error("Tez matrisi bulunamadı.");
      }

      await savePositioningReportTransaction(
        session.userId,
        matrix.id,
        juryResult,
      );
    });

    run.finish();

    return { success: true };
  } catch {
    run.finish();
    return {
      error:
        "Konumlandırma raporu kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
