"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import { SESSION_ERROR_MSG } from "@/lib/constants/session";
import { createFlowId, Logger } from "@/lib/logger";
import { invalidateOnboardingCache } from "@/lib/cache-tags";
import type { OnboardingFormData } from "@/lib/types";

const MIN_LENGTH = 3;
const MAX_LENGTH = 4000;

type ValidationResult =
  { valid: true; value: string } | { valid: false; error: string };

function validateField(
  value: string | undefined,
  label: string,
): ValidationResult {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `${label} en az ${MIN_LENGTH} karakter olmalıdır.`,
    };
  }
  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `${label} en fazla ${MAX_LENGTH} karakter olabilir.`,
    };
  }
  return { valid: true, value: trimmed };
}

/**
 * Persists the thesis matrix to the database and clears any downstream analysis
 * data (originality reports and thesis boxes) that may now be stale.
 *
 * @param data - The thesis matrix data from the onboarding form
 * @returns Success confirmation or an error message
 */
export async function saveThesisMatrixAction(
  data: OnboardingFormData,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  const studyTitle = validateField(data.studyTitle, "Çalışma başlığı");
  if (!studyTitle.valid) return { error: studyTitle.error };
  const researchQuestion = validateField(
    data.researchQuestion,
    "Araştırma sorusu",
  );
  if (!researchQuestion.valid) return { error: researchQuestion.error };
  const theoreticalFramework = validateField(
    data.theoreticalFramework,
    "Kavramsal çerçeve",
  );
  if (!theoreticalFramework.valid) return { error: theoreticalFramework.error };
  const methodology = validateField(data.methodology, "Metodoloji");
  if (!methodology.valid) return { error: methodology.error };
  const researchScope = validateField(data.researchScope, "Araştırma kapsamı");
  if (!researchScope.valid) return { error: researchScope.error };
  const mainClaim = validateField(data.mainClaim, "Temel iddia");
  if (!mainClaim.valid) return { error: mainClaim.error };

  log.info("matrix_save_start", {
    service: "db",
    data: { context: "Tez matrisi kaydetme" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    await db
      .insert(thesisMatrices)
      .values({
        userId: session.userId,
        studyTitle: studyTitle.value,
        researchQuestion: researchQuestion.value,
        theoreticalFramework: theoreticalFramework.value,
        methodology: methodology.value,
        researchScope: researchScope.value,
        mainClaim: mainClaim.value,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          studyTitle: studyTitle.value,
          researchQuestion: researchQuestion.value,
          theoreticalFramework: theoreticalFramework.value,
          methodology: methodology.value,
          researchScope: researchScope.value,
          mainClaim: mainClaim.value,
          updatedAt: sql`now()`,
        },
      });

    await db
      .delete(originalityReports)
      .where(eq(originalityReports.userId, session.userId));

    const [matrixRow] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrixRow) {
      await db
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrixRow.id));
    }

    invalidateOnboardingCache();

    log.info("matrix_save_success", {
      service: "db",
      durationMs: performance.now() - startTime,
      data: { context: "Tez matrisi kaydetme" },
    });

    return { success: true };
  } catch (error) {
    log.error("matrix_save_failed", {
      service: "db",
      error,
      data: { context: "Tez matrisi kaydetme" },
    });
    return { error: "Matris veri tabanına kaydedilirken bir hata oluştu." };
  }
}
