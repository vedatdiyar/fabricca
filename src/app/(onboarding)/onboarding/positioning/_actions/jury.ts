"use server";

import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SUBMIT_PIPELINE } from "@/lib/pipeline-definitions";
import type { ThesisMatrix } from "@/lib/types";
import { evaluateThesesInParallel } from "../_services/per-thesis-evaluation";
import {
  analyzePositioningJury,
  type JuryAnalysisResult,
} from "../_services/analysis";
import type { SiftedThesis } from "../_services/sifting";
import { parsePositioningMatrixInput } from "./positioning-helpers";

/**
 * 2. ve 3. Kademe: Aday tezlerin paralel derin değerlendirmesini ve nihai jüri sentezini yürütür.
 *
 * @param matrixInput - Kullanıcının tez matrisi.
 * @param theses - Süzülmüş aday tezler.
 * @param flowId - Log akış kimliği.
 * @returns Başarılıysa jüri analiz sonucu, aksi halde hata mesajı.
 */
export async function runPositioningJuryAction(
  matrixInput: ThesisMatrix,
  theses: SiftedThesis[],
  flowId: string,
): Promise<
  { success: true; juryResult: JuryAnalysisResult } | { error: string }
> {
  const run = PipelineRun.resume(MATRIX_SUBMIT_PIPELINE, flowId);

  const parsedResult = parsePositioningMatrixInput(matrixInput);
  if (!parsedResult.success) return { error: parsedResult.error };

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const juryResult = await run.execute(
      "jury_review",
      async () => {
        const evaluatedTheses = await evaluateThesesInParallel(
          parsedResult.data,
          theses,
          run.logger,
        );
        const relevantTheses = evaluatedTheses.filter(
          (ev) => ev.evaluation.isRelevant,
        );
        return analyzePositioningJury(
          parsedResult.data,
          relevantTheses,
          run.logger,
        );
      },
      { description: `Gemini Parallel (${theses.length} theses)` },
    );

    return { success: true, juryResult };
  } catch {
    return {
      error:
        "Akademik jüri analizi sentezlenirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
