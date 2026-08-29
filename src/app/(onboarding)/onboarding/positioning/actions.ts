"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { positioning, matrices } from "@/core/db/schema";
import type { Positioning } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import {
  MATRIX_SUBMIT_PIPELINE,
  PROPOSAL_POSITIONING_PIPELINE,
} from "@/lib/pipeline-definitions";
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

    const theses = await run.execute(
      "search",
      () => searchAndSiftTheses(validated, run.logger, { pipelineRun: run }),
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

    const juryResult = await run.execute(
      "jury_review",
      async () => {
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

import { clearDownstreamDbAction } from "../actions";
import { synthesizeInitialMatrixFromProposal } from "../matrix/_services/proposal-synthesis-service";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import { sql } from "drizzle-orm";
import type { GapAnalysisStructured } from "./_services/validation";

/**
 * Unified entry action:
 * Takes raw proposal, automatically creates headless background matrix,
 * runs 4-channel search (Qdrant, OpenAlex, Semantic Scholar, Exa) + Cohere Rerank + Jury,
 * saves everything to DB and prepares for instant redirect to /onboarding/positioning.
 *
 * @param rawProposal - The user's raw proposal text.
 * @param flowId - Optional shared flow identifier of the proposal positioning pipeline run.
 * @returns Success flag or error message.
 */
export async function startOnboardingFromProposalAction(
  rawProposal: string,
  flowId?: string,
): Promise<{ success: true } | { error: string }> {
  const run = flowId
    ? PipelineRun.resume(PROPOSAL_POSITIONING_PIPELINE, flowId)
    : PipelineRun.create(PROPOSAL_POSITIONING_PIPELINE);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const trimmed = rawProposal.trim();
    if (trimmed.length < 50) {
      return {
        error:
          "Lütfen analiz için en az 50 karakter uzunluğunda bir tez taslağı girin.",
      };
    }

    // 1. Clear downstream step data
    await clearDownstreamDbAction("proposal");

    // 2. Synthesize initial headless 4-quadrant matrix & persist to DB
    const savedMatrix = await run.execute(
      "matrix",
      async () => {
        const t0 = performance.now();
        const matrix = await synthesizeInitialMatrixFromProposal(
          trimmed,
          run.logger,
        );
        run.subStep(
          "Proposal Decomposition (Gemini Flash)",
          performance.now() - t0,
        );

        const t1 = performance.now();
        const [persisted] = await db
          .insert(matrices)
          .values({
            userId: session.userId,
            rawProposal: trimmed,
            subjectProblem: matrix.subjectProblem,
            theoreticalFramework: matrix.theoreticalFramework,
            primaryMaterial: matrix.primaryMaterial,
            methodology: matrix.methodology,
            updatedAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: matrices.userId,
            set: {
              rawProposal: trimmed,
              subjectProblem: matrix.subjectProblem,
              theoreticalFramework: matrix.theoreticalFramework,
              primaryMaterial: matrix.primaryMaterial,
              methodology: matrix.methodology,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: matrices.id });

        if (!persisted) {
          throw new Error("Tez matrisi oluşturulamadı.");
        }

        run.subStep("Matrix Saved to Database", performance.now() - t1);
        return { ...matrix, id: persisted.id };
      },
      { description: "Initial Matrix Synthesis (Gemini Flash)" },
    );

    // 3. Run 4-Channel Multi-Source Sifting with Cohere Rerank
    const siftedCandidates = await run.execute(
      "search",
      () =>
        searchAndSiftTheses(
          {
            subjectProblem: savedMatrix.subjectProblem,
            theoreticalFramework: savedMatrix.theoreticalFramework,
            methodology: savedMatrix.methodology,
          },
          run.logger,
          { pipelineRun: run },
        ),
      { description: "4-Channel Literature Scan & Cohere Rerank" },
    );

    // 4. Evaluate candidates in parallel and run Jury Review
    const juryResult = await run.execute(
      "jury_review",
      async () => {
        const t0 = performance.now();
        const evaluated = await evaluateThesesInParallel(
          {
            subjectProblem: savedMatrix.subjectProblem,
            theoreticalFramework: savedMatrix.theoreticalFramework,
            methodology: savedMatrix.methodology,
          },
          siftedCandidates,
          run.logger,
        );
        run.subStep(
          `Parallel Candidate Evaluation (${siftedCandidates.length} theses)`,
          performance.now() - t0,
        );

        const relevant = evaluated.filter((e) => e.evaluation.isRelevant);

        const t1 = performance.now();
        const jury = await analyzePositioningJury(
          {
            subjectProblem: savedMatrix.subjectProblem,
            theoreticalFramework: savedMatrix.theoreticalFramework,
            methodology: savedMatrix.methodology,
          },
          relevant,
          run.logger,
        );
        run.subStep(
          `Positioning Jury Synthesis (${relevant.length} relevant)`,
          performance.now() - t1,
        );

        return jury;
      },
      { description: "Gemini Candidate Evaluation & Jury Review" },
    );

    // 5. Sanitize and persist positioning report
    await run.execute(
      "persist",
      async () => {
        if (juryResult.recommendedTheses.length > 0) {
          const t0 = performance.now();
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
          run.subStep(
            `Data Sanitization (${itemsToSanitize.length} titles)`,
            performance.now() - t0,
          );
        }

        const t1 = performance.now();
        await savePositioningReportTransaction(
          session.userId,
          savedMatrix.id,
          juryResult,
        );
        run.subStep(
          "Positioning Report Saved to Database",
          performance.now() - t1,
        );
      },
      { description: "Save Positioning Report to Database" },
    );

    run.finish();

    invalidateOnboardingStepCache("proposal");
    invalidateOnboardingStepCache("positioning");

    return { success: true };
  } catch (err) {
    run.finish();
    const msg =
      err instanceof Error
        ? err.message
        : "Tez taslağı incelenirken beklenmeyen bir hata oluştu.";
    return { error: msg };
  }
}

/**
 * Applies a user-selected differentiation (Pivot) option when a DIRECT_OVERLAP occurs.
 * Updates the background matrix and resolves the positioning status to NOVEL_GAP_IDENTIFIED.
 *
 * @param payload - The chosen pivot option details.
 * @returns Success flag or error.
 */
export async function applyPositioningPivotAction(payload: {
  pivotId: string;
  title: string;
  suggestedFocus: string;
}): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const updatedProblem = `${matrix.subjectProblem}\n\n[Akademik Farklılaşma Rotası]: ${payload.title} — ${payload.suggestedFocus}`;

    await db
      .update(matrices)
      .set({
        subjectProblem: updatedProblem,
        updatedAt: sql`now()`,
      })
      .where(eq(matrices.id, matrix.id));

    // Update positioning record
    const [posRow] = await db
      .select()
      .from(positioning)
      .where(eq(positioning.matrixId, matrix.id));

    if (posRow && posRow.gapAnalysisSummary) {
      const summary = posRow.gapAnalysisSummary as GapAnalysisStructured;
      summary.originalContribution = `**Farklılaşma (Pivot) Rotası Kabul Edildi:** Araştırma, emsal tezden farklılaşarak "${payload.title}" (${payload.suggestedFocus}) odağında yapılandırılmıştır.\n\n${summary.originalContribution}`;

      await db
        .update(positioning)
        .set({
          globalStatus: "NOVEL_GAP_IDENTIFIED",
          gapAnalysisSummary: summary,
          updatedAt: sql`now()`,
        })
        .where(eq(positioning.id, posRow.id));
    }

    invalidateOnboardingStepCache("positioning");

    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Farklılaşma rotası kaydedilemedi.",
    };
  }
}

/**
 * Saves user clarification answers to the background matrix and prepares for advancing to Boxes step.
 *
 * @param answers - Array of question/answer pairs from the positioning report.
 * @returns Success flag or error.
 */
export async function completePositioningClarificationsAction(
  answers: Array<{ question: string; answer: string }>,
): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const validAnswers = answers.filter((a) => a.answer.trim().length > 0);

    if (validAnswers.length > 0) {
      const clarificationsText = validAnswers
        .map((a) => `[Odak Netleştirmesi]: ${a.question} -> ${a.answer}`)
        .join("\n");

      await db
        .update(matrices)
        .set({
          subjectProblem: `${matrix.subjectProblem}\n\n${clarificationsText}`,
          updatedAt: sql`now()`,
        })
        .where(eq(matrices.id, matrix.id));
    }

    invalidateOnboardingStepCache("positioning");
    invalidateOnboardingStepCache("boxes");

    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Netleştirme yanıtları kaydedilemedi.",
    };
  }
}
