"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisPositioning, thesisMatrices } from "@/db/schema";
import type { ThesisPositioning } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import type { ThesisMatrix } from "@/lib/types";
import { positioningMatrixSchema } from "./_lib/validation";
import type { SiftedThesis } from "./_services/sifting";
import { generatePositioningQueries } from "./_services/queries";
import { searchAndSiftTheses } from "./_services/sifting";
import { analyzePositioningJury } from "./_services/analysis";
import { savePositioningReportTransaction } from "./_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import type { JuryAnalysisResult } from "./_services/analysis";

/**
 * Sadece 3 kademeli sorgu üretimi + Tezara Meilisearch araması +
 * Cohere Rerank adımlarını çalıştırır. Jüri analizi ve DB kaydı
 * dahil değildir; ayrı Server Action'larda handle edilir.
 *
 * @param matrixInput - Kullanıcının tez matrisi (5 alan)
 * @returns Süzülen ve sıralanmış tez listesi veya hata mesajı
 */
export async function runPositioningSearchAction(
  matrixInput: ThesisMatrix,
): Promise<{ success: true; theses: SiftedThesis[] } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const positioningInput: Record<string, string> = {
    subjectAndProblem: matrixInput.researchCore ?? "",
    theoreticalFramework: matrixInput.framework ?? "",
    unitOfAnalysis: matrixInput.targetActors ?? "",
    methodology: matrixInput.mainClaim ?? "",
    scopeAndContext: matrixInput.context ?? "",
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

    log.info("generate_positioning_queries_start", {
      service: "positioning",
      data: {
        context: "3-tier academic search query generation",
      },
    });
    const queries = await generatePositioningQueries(validated, log);
    log.info("generate_positioning_queries_success", {
      service: "positioning",
      data: { directQuery: queries.directQuery },
    });

    log.info("sifting_parallel_search_start", {
      service: "tezara",
      data: { context: "Parallel Meilisearch + Cohere Rerank" },
    });
    const theses = await searchAndSiftTheses(queries, validated, log);
    log.info("sifting_parallel_search_success", {
      service: "tezara",
      data: { candidateCount: theses.length },
    });

    return { success: true, theses };
  } catch (error) {
    log.error("positioning_search_failed", {
      service: "positioning",
      error,
      data: { context: "Positioning search failed" },
    });
    return {
      error:
        "Akademik arama sorguları üretilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Süzülen tez listesi üzerinde Gemini LLM ile jüri analizi çalıştırır.
 *
 * @param matrixInput - Kullanıcının tez matrisi (5 alan)
 * @param theses - Cohere Rerank sonucu süzülen tez listesi
 * @returns Jüri analizi sonucu veya hata mesajı
 */
export async function runPositioningJuryAction(
  matrixInput: ThesisMatrix,
  theses: SiftedThesis[],
): Promise<
  { success: true; juryResult: JuryAnalysisResult } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const positioningInput: Record<string, string> = {
    subjectAndProblem: matrixInput.researchCore ?? "",
    theoreticalFramework: matrixInput.framework ?? "",
    unitOfAnalysis: matrixInput.targetActors ?? "",
    methodology: matrixInput.mainClaim ?? "",
    scopeAndContext: matrixInput.context ?? "",
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

    log.info("positioning_jury_analysis_start", {
      service: "positioning",
      data: { context: "LLM jury analysis on sifted theses" },
    });
    const juryResult = await analyzePositioningJury(validated, theses, log);
    log.info("positioning_jury_analysis_success", {
      service: "positioning",
      data: { globalStatus: juryResult.globalStatus },
    });

    return { success: true, juryResult };
  } catch (error) {
    log.error("positioning_jury_failed", {
      service: "positioning",
      error,
      data: { context: "Positioning jury analysis failed" },
    });
    return {
      error:
        "Akademik jüri analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Jüri analizi sonucunu temizler, akademik veriyi sanitize eder ve
 * veritabanına kalıcı olarak yazar.
 *
 * @param matrixInput - Kullanıcının tez matrisi (5 alan)
 * @param juryResult - Jüri analizi sonucu
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function persistPositioningReportAction(
  matrixInput: ThesisMatrix,
  juryResult: JuryAnalysisResult,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const positioningInput: Record<string, string> = {
      subjectAndProblem: matrixInput.researchCore ?? "",
      theoreticalFramework: matrixInput.framework ?? "",
      unitOfAnalysis: matrixInput.targetActors ?? "",
      methodology: matrixInput.mainClaim ?? "",
      scopeAndContext: matrixInput.context ?? "",
    };

    const parsed = positioningMatrixSchema.safeParse(positioningInput);
    if (!parsed.success) {
      return { error: "Form doğrulaması başarısız." };
    }
    const validated = parsed.data;

    // ── Sanitization ──
    if (juryResult.recommendedTheses.length > 0) {
      log.info("literature_bulk_sanitization_start", {
        service: "positioning",
        data: { count: juryResult.recommendedTheses.length },
      });

      const itemsToSanitize = juryResult.recommendedTheses.map((t) => ({
        title: t.title || "",
        author: t.author || "",
      }));
      const sanitized = await sanitizeAcademicDataBulk(itemsToSanitize, log);
      juryResult.recommendedTheses = juryResult.recommendedTheses.map(
        (t, idx) => ({
          ...t,
          title: sanitized[idx]?.title || t.title,
          author: sanitized[idx]?.author || t.author,
        }),
      );

      log.info("literature_bulk_sanitization_success", {
        service: "positioning",
        data: { sanitizedCount: sanitized.length },
      });
    }

    // ── DB persist ──
    log.info("positioning_db_transaction_start", {
      service: "positioning",
      data: { context: "Persisting positioning report to database" },
    });
    await savePositioningReportTransaction(
      session.userId,
      validated,
      juryResult,
    );
    log.info("positioning_db_transaction_success", {
      service: "positioning",
      data: { context: "Positioning report saved" },
    });

    return { success: true };
  } catch (error) {
    log.error("positioning_persist_failed", {
      service: "positioning",
      error,
      data: { context: "Positioning persist failed" },
    });
    return {
      error:
        "Konumlandırma raporu kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Fetches the existing positioning record for the authenticated user.
 * If no positioning record exists yet, attempts to pre-fill matrixInput
 * from the user's thesis_matrices record.
 *
 * @returns The user's positioning record or null if not found
 */
export async function getPositioningAction(): Promise<ThesisPositioning | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const [record] = await db
      .select()
      .from(thesisPositioning)
      .where(eq(thesisPositioning.userId, session.userId));

    const [matrix] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrix) {
      const currentMatrixInput = {
        subjectAndProblem: matrix.researchCore || "",
        theoreticalFramework: matrix.framework || "",
        unitOfAnalysis: matrix.targetActors || "",
        methodology: matrix.mainClaim || "",
        scopeAndContext: matrix.context || "",
      };

      if (record) {
        const recordInput = record.matrixInput as Record<string, string> | null;
        const isMatching =
          recordInput &&
          recordInput.subjectAndProblem ===
            currentMatrixInput.subjectAndProblem &&
          recordInput.theoreticalFramework ===
            currentMatrixInput.theoreticalFramework &&
          recordInput.unitOfAnalysis === currentMatrixInput.unitOfAnalysis &&
          recordInput.methodology === currentMatrixInput.methodology &&
          recordInput.scopeAndContext === currentMatrixInput.scopeAndContext;

        if (isMatching) {
          return record;
        }
      }

      return {
        id: record ? record.id : "prefilled-from-matrix",
        userId: session.userId,
        matrixInput: currentMatrixInput,
        globalStatus: null,
        gapAnalysisSummary: null,
        recommendedTheses: [],
        createdAt: matrix.createdAt,
        updatedAt: matrix.updatedAt,
      } as ThesisPositioning;
    }

    if (record) {
      return record;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Tek bir pipeline'da positioning sürecinin tüm adımlarını çalıştırır:
 *   1. runPositioningSearchAction — sorgu üretimi + arama + filtreleme + rerank
 *   2. runPositioningJuryAction — jüri analizi
 *   3. persistPositioningReportAction — sanitizasyon + DB kaydı
 *
 * Her adım START/SUCCESS logu üretir; pipeline sonunda positioning_toplam
 * satırı tüm sürecin toplam süresini gösterir.
 *
 * @param matrixInput - Kullanıcının tez matrisi (5 alan)
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function runPositioningPipelineAction(
  matrixInput: ThesisMatrix,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const pipelineStart = performance.now();

  log.info("positioning_pipeline_start", {
    service: "positioning",
    data: { context: "Full positioning pipeline started" },
  });

  // ── Step 1: Search ──
  const searchResult = await runPositioningSearchAction(matrixInput);
  if ("error" in searchResult) {
    log.error("positioning_pipeline_failed", {
      service: "positioning",
      error: searchResult.error,
      data: { context: "Search step failed" },
    });
    return { error: searchResult.error };
  }

  // ── Step 2: Jury Analysis ──
  const juryResult = await runPositioningJuryAction(
    matrixInput,
    searchResult.theses,
  );
  if ("error" in juryResult) {
    log.error("positioning_pipeline_failed", {
      service: "positioning",
      error: juryResult.error,
      data: { context: "Jury step failed" },
    });
    return { error: juryResult.error };
  }

  // ── Step 3: Persist ──
  const persistResult = await persistPositioningReportAction(
    matrixInput,
    juryResult.juryResult,
  );
  if ("error" in persistResult) {
    log.error("positioning_pipeline_failed", {
      service: "positioning",
      error: persistResult.error,
      data: { context: "Persist step failed" },
    });
    return { error: persistResult.error };
  }

  log.info("positioning_toplam", {
    service: "positioning",
    data: { durationMs: Math.round(performance.now() - pipelineStart) },
  });

  return { success: true };
}
