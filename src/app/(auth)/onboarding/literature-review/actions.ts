"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  users,
} from "@/db/schema";
import { getSession } from "@/session";
import { Logger, createFlowId } from "@/lib/logger";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_ERROR_MSG,
} from "@/lib/constants/session";
import type { LiteraturePoolEntry, OnboardingActionResult } from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";
import type { SubBoxInput } from "./_services/literature-review-papers";
import { orchestrateBatchProcess } from "./_services/batch-orchestrator";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

// ============================================================================
// Batch Action: processAllBoxesAction — delegates to batch orchestrator
// ============================================================================

export async function processAllBoxesAction(
  boxes: SubBoxInput[],
): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> {
  const logger = new Logger(createFlowId());

  logger.info("literature_batch_process_start", {
    service: "literature",
    filePath: "onboarding/literature-review/actions.ts",
    data: {
      boxCount: boxes.length,
      context: "Toplu literatür taraması başlatıldı",
    },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [thesisCtx] = await db
      .select({
        studyTitle: thesisMatrices.studyTitle,
        researchQuestion: thesisMatrices.researchQuestion,
        theoreticalFramework: thesisMatrices.theoreticalFramework,
        researchScope: thesisMatrices.researchScope,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!thesisCtx) return { error: "Tez matrisi bulunamadı." };

    const { poolEntries } = await orchestrateBatchProcess(
      boxes,
      thesisCtx,
      logger,
    );

    return { data: poolEntries };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    logger.error("literature_batch_process_failed", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      error: err,
    });
    return { error: message };
  }
}

// ============================================================================
// Final Action: confirmLiteratureAction
// ============================================================================

export async function confirmLiteratureAction(args: {
  literaturePool: LiteraturePoolEntry[];
}): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("confirm_literature_start", { service: "literature" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn("confirm_literature_failed", {
        service: "literature",
        data: { reason: "Oturum bulunamadı." },
      });
      return { error: SESSION_ERROR_MSG };
    }

    const userId = session.userId;
    const { literaturePool } = args;

    if (!literaturePool || literaturePool.length === 0) {
      log.warn("confirm_literature_failed", {
        service: "literature",
        data: { reason: "Onaylanacak literatür verisi bulunamadı." },
      });
      return { error: "Onaylanacak literatür verisi bulunamadı." };
    }

    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      const allResources: NewLibraryResource[] = [];

      const allBoxes = await tx
        .select({ id: thesisBoxes.id, title: thesisBoxes.title })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      const boxMap = new Map<string, number>();
      for (const b of allBoxes) {
        if (boxMap.has(b.title)) {
          throw new Error(
            `Aynı başlıkta birden fazla kutu bulundu: "${b.title}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }
        boxMap.set(b.title, b.id);
      }

      for (const entry of literaturePool) {
        const subBoxTitle = entry.subBoxTitle;
        const thesisBoxId = boxMap.get(subBoxTitle);

        if (!thesisBoxId) {
          throw new Error(
            `Alt kutu bulunamadı: "${subBoxTitle}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }

        for (const article of entry.starterPack) {
          allResources.push({
            thesisBoxId,
            title: formatAcademicTitle(article.title),
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            isRead: false,
            isFoundational: article.isFoundational ?? false,
            relevanceScore: article.relevanceScore ?? 0,
          });
        }

        for (const article of entry.reservedPool) {
          allResources.push({
            thesisBoxId,
            title: formatAcademicTitle(article.title),
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            isRead: false,
            isFoundational: article.isFoundational ?? false,
            relevanceScore: article.relevanceScore ?? 0,
          });
        }
      }

      if (allResources.length > 0) {
        await tx
          .insert(libraryResources)
          .values(allResources)
          .onConflictDoNothing();
      }

      await tx
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set(
        SESSION_COOKIE_NAME,
        JSON.stringify({
          userId: session.userId,
          name: session.name,
          onboardingCompleted: true,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_MAX_AGE_SECONDS,
        },
      );
    } catch {
      // Session cookie update skipped
    }

    try {
      revalidateOnboardingPaths();
    } catch {
      // Revalidation path skipped
    }

    invalidateOnboardingCache();

    log.info("confirm_literature_success", {
      service: "literature",
      durationMs: performance.now() - startTime,
      data: {
        resultCount: literaturePool.reduce(
          (sum, entry) =>
            sum + entry.starterPack.length + entry.reservedPool.length,
          0,
        ),
      },
    });

    return { success: true };
  } catch (err) {
    log.error("confirm_literature_failed", {
      service: "literature",
      error: err,
    });
    return {
      error:
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}
