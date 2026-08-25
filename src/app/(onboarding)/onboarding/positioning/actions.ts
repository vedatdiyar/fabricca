"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { positioning, matrices } from "@/core/db/schema";
import type { Positioning } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SUBMIT_PIPELINE } from "@/lib/pipeline-definitions";
import type { ThesisMatrix } from "@/lib/types";
import { positioningMatrixSchema } from "./_services/validation";
import { searchAndSiftTheses, type SiftedThesis } from "./_services/sifting";
import { evaluateThesesInParallel } from "./_services/per-thesis-evaluation";
import {
  analyzePositioningJury,
  type JuryAnalysisResult,
} from "./_services/analysis";
import { savePositioningReportTransaction } from "./_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/core/services/academic";

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
  const positioningInput: Record<string, string> = {
    subjectProblem: matrixInput.subjectProblem ?? "",
    theoreticalFramework: matrixInput.theoreticalFramework ?? "",
    methodology: matrixInput.methodology ?? "",
  };

  const parsed = positioningMatrixSchema.safeParse(positioningInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const theses = await run.execute("search", () =>
      searchAndSiftTheses(validated, run.logger),
    );

    return { success: true, theses };
  } catch {
    return {
      error:
        "Akademik arama sorguları üretilirken veya literatür taranırken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * 2. ve 3. Kademe: Aday tezlerin paralel derin değerlendirmesini (FLASH_LITE_35)
 * ve ardından nihai jüri sentez analizini (FLASH_LITE_35) yürütür.
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
  const positioningInput: Record<string, string> = {
    subjectProblem: matrixInput.subjectProblem ?? "",
    theoreticalFramework: matrixInput.theoreticalFramework ?? "",
    methodology: matrixInput.methodology ?? "",
  };

  const parsed = positioningMatrixSchema.safeParse(positioningInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const juryResult = await run.execute("jury_review", async () => {
      // 2. Kademe: Paralel derin tez değerlendirmesi
      const evaluatedTheses = await evaluateThesesInParallel(
        validated,
        theses,
        run.logger,
      );

      const relevantTheses = evaluatedTheses.filter(
        (ev) => ev.evaluation.isRelevant,
      );

      // 3. Kademe: FLASH_LITE_35 Jüri sentezi
      return analyzePositioningJury(validated, relevantTheses, run.logger);
    });

    return { success: true, juryResult };
  } catch {
    return {
      error:
        "Akademik jüri analizi sentezlenirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

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
      // Sanitization for titles and authors
      if (juryResult.recommendedTheses.length > 0) {
        const itemsToSanitize = juryResult.recommendedTheses.map((t) => ({
          title: t.title || "",
          author: t.author || "",
        }));
        const sanitized = await sanitizeAcademicDataBulk(
          itemsToSanitize,
          run.logger,
        );
        juryResult.recommendedTheses = juryResult.recommendedTheses.map(
          (t, idx) => ({
            ...t,
            title: sanitized[idx]?.title || t.title,
            author: sanitized[idx]?.author || t.author,
          }),
        );
      }

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

/**
 * Kullanıcının mevcut tez matrisine bağlı konumlandırma kaydını döner.
 *
 * @returns Konumlandırma kaydı veya null.
 */
export async function getPositioningAction(): Promise<Positioning | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) {
      return null;
    }

    const [record] = await db
      .select()
      .from(positioning)
      .where(eq(positioning.matrixId, matrix.id));

    return record ?? null;
  } catch {
    return null;
  }
}
