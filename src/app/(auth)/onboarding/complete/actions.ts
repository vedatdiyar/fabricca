"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, thesisBoxes, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { withDbLogging } from "@/lib/db-helpers";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type { OnboardingActionResult } from "@/lib/types";
import { generateStructuredContent } from "@/lib/gemini";
import {
  THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts";
import { searchWikipediaTheorist } from "@/lib/wikipedia";
import { verifyLiterature } from "@/lib/literature";

/**
 * Interface representing a structured thesis box returned by Gemini.
 */
interface GeminiThesisBox {
  category: "intro" | "theory" | "methodology" | "context" | "primary_source";
  title: string;
  description: string;
  theorists: string[];
  concepts: string[];
  queries: string[];
  primaryLiterature: string[];
  secondaryLiterature: string[];
}

/**
 * Generates thesis outline boxes for the specified thesis matrix ID.
 * Invokes Gemini Flash Lite to partition the matrix into 5 categories,
 * validates theorists against Wikipedia concurrently to avoid hallucinations,
 * and saves parent-child box structures in the database hierarchically.
 * Finally, updates the user's onboarding step to "completed".
 *
 * @param thesisMatrixId - The ID of the thesis matrix to generate boxes for.
 * @returns A promise that resolves to an OnboardingActionResult.
 */
export async function generateThesisBoxesAction(
  thesisMatrixId: number,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "enrichment",
        data: { reason: "No session found" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "enrichment",
      data: { userId, thesisMatrixId },
    });

    // Step 1: Read thesis matrix from Database
    const [matrix] = await withDbLogging(
      () =>
        db
          .select()
          .from(thesisMatrices)
          .where(eq(thesisMatrices.id, thesisMatrixId)),
      "read_matrix",
      log,
    );

    if (!matrix) {
      log.info("flow_complete", {
        service: "enrichment",
        data: { reason: "Matrix not found", thesisMatrixId },
      });
      return { error: "Tez matrisi bulunamadı." };
    }

    if (matrix.userId !== userId) {
      log.info("flow_complete", {
        service: "enrichment",
        data: {
          reason: "Unauthorized access",
          userId,
          matrixUserId: matrix.userId,
        },
      });
      return { error: "Yetkisiz işlem: Bu tez matrisi size ait değil." };
    }

    // Step 2: AI call to generate draft boxes using Gemini Flash Lite
    // The structured content generation internally logs starting and finishing states.
    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      methodology: matrix.methodology,
      theoreticalFramework: matrix.theoreticalFramework,
      historicalSpatialLimits: matrix.historicalSpatialLimits,
    });

    const generationResult = await generateStructuredContent<{
      boxes: GeminiThesisBox[];
    }>(
      "gemini-3.1-flash-lite",
      THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
    );

    const draftBoxes = generationResult.boxes || [];

    // Step 3: Wikipedia concurrent cross-check for theorists to prevent hallucinations
    log.info("search_start", {
      service: "enrichment",
      step: "wikipedia_cross_check",
    });

    await Promise.all(
      draftBoxes.map(async (box) => {
        const theorists = box.theorists || [];
        if (theorists.length === 0) return;

        const verificationPromises = theorists.map(async (theoristName) => {
          try {
            const wikiResult = await searchWikipediaTheorist(
              theoristName,
              box.category,
            );
            if (wikiResult) {
              return theoristName;
            }
          } catch (err) {
            log.error("search_filtered", {
              service: "enrichment",
              step: "wikipedia_cross_check_failed",
              error: err,
            });
          }
          return null;
        });

        const verificationResults = await Promise.all(verificationPromises);
        box.theorists = verificationResults.filter(
          (name): name is string => name !== null,
        );
      }),
    );

    log.info("search_success", {
      service: "enrichment",
      step: "wikipedia_cross_check",
    });

    // Step 3.5: Google Books and Wikipedia cross-check for literature to prevent hallucinations
    log.info("search_start", {
      service: "enrichment",
      step: "literature_cross_check",
    });

    await Promise.all(
      draftBoxes.map(async (box) => {
        const primLit = box.primaryLiterature || [];
        const secLit = box.secondaryLiterature || [];

        const verifyList = async (
          list: string[],
          listName: "primaryLiterature" | "secondaryLiterature",
        ) => {
          if (list.length === 0) return [];
          const verificationPromises = list.map(async (lit) => {
            try {
              const res = await verifyLiterature(lit);
              if (res.verified) {
                return lit;
              } else {
                log.info("search_filtered", {
                  service: "enrichment",
                  step: `literature_${listName}_rejected`,
                  data: { citation: lit, method: res.method },
                });
              }
            } catch (err) {
              log.error("search_filtered", {
                service: "enrichment",
                step: `literature_${listName}_check_failed`,
                error: err,
              });
            }
            return null;
          });
          const results = await Promise.all(verificationPromises);
          return results.filter((item): item is string => item !== null);
        };

        const [verifiedPrim, verifiedSec] = await Promise.all([
          verifyList(primLit, "primaryLiterature"),
          verifyList(secLit, "secondaryLiterature"),
        ]);

        box.primaryLiterature = verifiedPrim;
        box.secondaryLiterature = verifiedSec;
      }),
    );

    log.info("search_success", {
      service: "enrichment",
      step: "literature_cross_check",
    });

    // Step 4: Write to database for parent-child hierarchy
    await withDbLogging(
      async () => {
        // Clear existing boxes for this matrix to prevent duplication
        await db
          .delete(thesisBoxes)
          .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

        // 4a. Insert parent boxes
        const parentValues = [
          {
            thesisMatrixId,
            parentId: null,
            category: "intro" as const,
            title: "Giriş ve Temel İddia",
            description: "Tezin temel iddiaları ve giriş çerçevesi.",
            theorists: [],
            concepts: [],
            queries: [],
            primaryLiterature: [],
            secondaryLiterature: [],
          },
          {
            thesisMatrixId,
            parentId: null,
            category: "theory" as const,
            title: "Teorik Zemin",
            description: "Kuramsal çerçeve ve teorik altyapı kutuları.",
            theorists: [],
            concepts: [],
            queries: [],
            primaryLiterature: [],
            secondaryLiterature: [],
          },
          {
            thesisMatrixId,
            parentId: null,
            category: "methodology" as const,
            title: "Yöntem Literatürü",
            description: "Metodoloji ve araştırma yöntemi kutuları.",
            theorists: [],
            concepts: [],
            queries: [],
            primaryLiterature: [],
            secondaryLiterature: [],
          },
          {
            thesisMatrixId,
            parentId: null,
            category: "context" as const,
            title: "Tarihsel ve Mekânsal Bağlam",
            description:
              "Tarihsel sınırlar ve coğrafi/mekânsal bağlam kutuları.",
            theorists: [],
            concepts: [],
            queries: [],
            primaryLiterature: [],
            secondaryLiterature: [],
          },
          {
            thesisMatrixId,
            parentId: null,
            category: "primary_source" as const,
            title: "Birincil Özneler ve Arşivler",
            description: "İncelenen birincil özneler, arşivler ve belgeler.",
            theorists: [],
            concepts: [],
            queries: [],
            primaryLiterature: [],
            secondaryLiterature: [],
          },
        ];

        const insertedParents = await db
          .insert(thesisBoxes)
          .values(parentValues)
          .returning({ id: thesisBoxes.id, category: thesisBoxes.category });

        const parentMap = new Map<string, number>();
        for (const parent of insertedParents) {
          parentMap.set(parent.category, parent.id);
        }

        // 4b. Map and insert child sub-boxes
        const subBoxValues = draftBoxes.map((box) => {
          const parentId = parentMap.get(box.category);
          if (!parentId) {
            throw new Error(
              `Ebeveyn kutusu bulunamadı (kategori: ${box.category})`,
            );
          }
          return {
            thesisMatrixId,
            parentId,
            category: box.category,
            title: box.title,
            description: box.description || "",
            theorists: box.theorists || [],
            concepts: box.concepts || [],
            queries: box.queries || [],
            primaryLiterature: box.primaryLiterature || [],
            secondaryLiterature: box.secondaryLiterature || [],
          };
        });

        if (subBoxValues.length > 0) {
          await db.insert(thesisBoxes).values(subBoxValues);
        }

        // 4c. Update user's onboarding step to "originality_report_completed"
        await db
          .update(users)
          .set({ onboardingStep: "originality_report_completed" })
          .where(eq(users.id, userId));
      },
      "save_hierarchical_boxes",
      log,
    );

    try {
      revalidatePath("/onboarding", "layout");
    } catch (e) {
      log.info("search_filtered", {
        service: "enrichment",
        step: "revalidate_path_skipped",
        error: e,
      });
    }
    log.info("flow_complete", { service: "enrichment" });
    return { success: true };
  } catch (err) {
    log.error("flow_complete", { service: "enrichment", error: err });
    return {
      error: "Kutu yapılandırması sırasında bir hata oluştu.",
    };
  }
}

/**
 * Completes the onboarding flow by fetching the current user's thesis matrix
 * and triggering the thesis box generation process.
 *
 * @returns A promise that resolves to an OnboardingActionResult.
 */
export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "flow",
        data: { reason: "No session found" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "flow",
      data: { userId },
    });

    // Update user onboarding step to completed
    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "completed" })
          .where(eq(users.id, userId)),
      "update_user_step_completed",
      log,
    );

    try {
      revalidatePath("/onboarding", "layout");
    } catch (e) {
      log.info("search_filtered", {
        service: "flow",
        step: "revalidate_path_skipped",
        error: e,
      });
    }
    log.info("flow_complete", {
      service: "flow",
      data: { success: true },
    });

    return { success: true };
  } catch (err) {
    log.error("flow_complete", { service: "flow", error: err });
    return {
      error: "Onboarding tamamlanırken bir hata oluştu.",
    };
  }
}
