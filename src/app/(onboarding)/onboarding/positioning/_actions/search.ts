"use server";

import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SUBMIT_PIPELINE } from "@/lib/pipeline-definitions";
import type { ThesisMatrix } from "@/lib/types";
import { searchAndSiftTheses, type SiftedThesis } from "../_services/sifting";
import { parsePositioningMatrixInput } from "./positioning-helpers";

/**
 * 1. Kademe: Çok boyutlu sorgu üretir, Qdrant vektör taraması ve Cohere Rerank v4.0 Pro çalıştırır.
 *
 * @param matrixInput - Kullanıcının sunduğu tez matrisi.
 * @param flowId - Gözlemlenebilirlik log akış kimliği.
 * @returns Başarılıysa filtrelenmiş tez listesi, aksi halde hata mesajı.
 */
export async function runPositioningSearchAction(
  matrixInput: ThesisMatrix,
  flowId: string,
): Promise<{ success: true; theses: SiftedThesis[] } | { error: string }> {
  const run = PipelineRun.resume(MATRIX_SUBMIT_PIPELINE, flowId);

  const parsedResult = parsePositioningMatrixInput(matrixInput);
  if (!parsedResult.success) return { error: parsedResult.error };

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const theses = await run.execute(
      "search",
      () =>
        searchAndSiftTheses(parsedResult.data, run.logger, {
          pipelineRun: run,
        }),
      { description: "Cohere Rerank & Vector Search" },
    );

    return { success: true, theses };
  } catch {
    return {
      error:
        "Akademik arama sorguları üretilirken veya literatür taranırken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
