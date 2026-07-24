"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisPositioning, thesisMatrices } from "@/db/schema";
import type { ThesisPositioning } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import type { ThesisMatrix } from "@/lib/types";
import { positioningMatrixSchema } from "./_lib/validation";
import { generatePositioningQueries } from "./_services/queries";
import { searchAndSiftTheses } from "./_services/sifting";
import { analyzePositioningJury } from "./_services/analysis";
import { savePositioningReportTransaction } from "./_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";

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
 *   1. generate_positioning_queries — 3 kademeli akademik sorgu üretimi
 *   2. sifting_parallel_search — Tezara Meilisearch paralel arama + filtreleme
 *   3. cohere_rerank — Cohere Rerank v4 Pro ile anlamsal sıralama
 *   4. positioning_jury_analysis — Gemini LLM jüri değerlendirmesi
 *   5. literature_bulk_sanitization — Akademik metin temizliği
 *   6. positioning_db_transaction — Raporun veritabanına yazılması
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

    // ── Step 1: Query generation ──
    log.info("generate_positioning_queries_start", {
      service: "positioning",
      data: {
        context: "3-tier academic search query generation (Gemini Flash-Lite)",
      },
    });
    const queries = await generatePositioningQueries(validated, log);
    log.info("generate_positioning_queries_success", {
      service: "positioning",
      data: { directQuery: queries.directQuery },
    });

    // ── Steps 2 & 3: Tezara search + Cohere rerank (logged inside searchAndSiftTheses) ──
    const theses = await searchAndSiftTheses(queries, validated, log);

    // ── Step 4: Jury LLM analysis ──
    log.info("positioning_jury_analysis_start", {
      service: "positioning",
      data: { context: "LLM jury analysis on sifted theses" },
    });
    const juryResult = await analyzePositioningJury(validated, theses, log);
    log.info("positioning_jury_analysis_success", {
      service: "positioning",
      data: { globalStatus: juryResult.globalStatus },
    });

    // ── Step 5: Sanitization ──
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

    // ── Step 6: DB persist ──
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

    // ── Pipeline total ──
    log.info("positioning_toplam", {
      service: "positioning",
      data: { durationMs: Math.round(performance.now() - pipelineStart) },
    });

    return { success: true };
  } catch (error) {
    log.error("positioning_pipeline_failed", {
      service: "positioning",
      error,
      data: { context: "Positioning pipeline failed" },
    });
    return {
      error:
        "Konumlandırma analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
