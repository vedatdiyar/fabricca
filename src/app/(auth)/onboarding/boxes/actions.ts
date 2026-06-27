"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes, libraryResources } from "@/db/schema";
import { getSession } from "@/session";
import { z } from "zod";
import { generateStructuredContent } from "@/lib/gemini";
import { SESSION_ERROR_MSG } from "@/lib/constants/session";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts/box-generation";
import {
  FinalBoxGenerationResponseSchema,
  FoundationalQuerySchema,
  type GeminiThesisBox,
  type OnboardingActionResult,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Ham Gemini çıktısı için yerel Zod şemaları.
// Gemini'den dönen sub-box'lar yalnızca {title, semanticQuery} içerir;
// aşağıda normalizasyon aşamasında GeminiThesisBox[]'a dönüştürülür.
// ---------------------------------------------------------------------------
const RawSubBoxSchema = z.object({
  title: z.string().min(1, "Alt kutu başlığı boş olamaz"),
  semanticQuery: z.string().min(1, "Arama sorgusu boş olamaz"),
  concepts: z.array(z.string()).max(4).optional(),
  foundationalQueries: z.array(FoundationalQuerySchema).max(2).optional(),
});

const RawGeminiBoxSchema = z.object({
  title: z.string().min(1, "Kutu başlığı boş olamaz"),
  boxType: z.enum([
    "PROBLEMATIZATION",
    "CONCEPTUAL",
    "DATA_PROTOCOL",
    "PRIMARY_MATERIAL",
  ]),
  description: z.string().min(1, "Kutu açıklaması boş olamaz"),
  subBoxes: z.array(RawSubBoxSchema),
});

const RawBoxGenerationResponseSchema = z.object({
  boxes: z.array(RawGeminiBoxSchema).min(1, "En az bir kutu üretilmelidir"),
});
import type { NewLibraryResource } from "@/db/schema";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../_lib/fetch-actions";

/** Default box title for the hardcoded related theses box appended server-side. */
const RELATED_THESES_TITLE = "İlişkisel Tez Çalışmaları";
import { mineCoCitations } from "../_services/co-citation-miner";
import type { BoxContext } from "../_services/co-citation-miner";
import type { RawPaper } from "../literature-review/_services/literature-review-papers";
import { searchOpenAlex } from "../literature-review/_services/openalex/client";

/**
 * Step 1: Generates the boxes structure (without foundational queries) using Gemini 3.1 Flash Lite.
 *
 * @returns The structured boxes array (with empty foundationalQueries), or a user-safe error message
 */
export async function generateBoxesStructureAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix, report] = await Promise.all([
      fetchThesisMatrix(),
      fetchOriginalityReport(),
    ]);

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    log.info("box_structure_generation_start", {
      service: "boxes",
      data: {
        context: "Kutu yapısı oluşturma (3.1 Flash Lite)",
      },
    });

    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
      researchScope: matrix.researchScope,
    });

    const generationResult = await generateStructuredContent<
      z.infer<typeof RawBoxGenerationResponseSchema>
    >(
      "gemini-3.1-flash-lite",
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: RawBoxGenerationResponseSchema,
        temperature: 1.0,
        seed: 42,
      },
    );

    const rawBoxes = generationResult.boxes || [];

    // Normalize generated boxes to full GeminiThesisBox shape.
    // Gemini returns sub-boxes as {title, semanticQuery, concepts?, foundationalQueries?};
    // we promote each sub-box to a full GeminiThesisBox (parentId set on save).
    const normalizedBoxes: GeminiThesisBox[] = rawBoxes.map((box) => {
      const boxType = box.boxType as
        | "PROBLEMATIZATION"
        | "CONCEPTUAL"
        | "DATA_PROTOCOL"
        | "PRIMARY_MATERIAL";
      return {
        title: box.title,
        boxType,
        description: box.description,
        parentId: null,
        semanticQuery: null,
        subBoxes: (box.subBoxes || []).map((sb) => ({
          title: sb.title,
          boxType,
          description: sb.title,
          parentId: null,
          semanticQuery: sb.semanticQuery,
          subBoxes: undefined,
          foundationalQueries: sb.foundationalQueries ?? [],
          concepts: sb.concepts ?? [],
        })),
        foundationalQueries: [],
      };
    });

    // Populate the RELATED_THESES box with overlapping theses from the
    // originality report (already computed during risk analysis).
    const overlapTable = report?.tezaraResults?.overlapTable ?? [];
    normalizedBoxes.push({
      title: RELATED_THESES_TITLE,
      boxType: "RELATED_THESES",
      description: "Tez matrisiyle örtüşen sınırdaş akademik çalışmalar.",
      parentId: null,
      semanticQuery: null,
      subBoxes: [],
      concepts: [],
      foundationalQueries: [],
      relatedTheses: overlapTable.map((t) => ({
        title: t.title,
        author: t.author,
        university: t.university,
        year: t.year,
        thesisType: t.thesisType,
        department: t.department,
        axes: t.axes,
        comparisonNote: t.comparisonNote,
        yokPdfUrl: t.yokPdfUrl,
      })),
    });

    log.info("box_structure_generation_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        count: normalizedBoxes.length,
      },
    });

    return { success: true, boxes: normalizedBoxes };
  } catch (err) {
    log.error("box_structure_generation_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Step 2: Mines OpenAlex for foundational queries based on the box semantic queries.
 *
 * @param boxes - The structured box array from Step 1
 * @returns The populated boxes array, or a user-safe error message
 */
export async function mineFoundationalQueriesAction(
  boxes: GeminiThesisBox[],
): Promise<{ success: true; boxes: GeminiThesisBox[] } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    log.info("mine_foundational_queries_start", {
      service: "boxes",
      data: { boxCount: boxes.length },
    });

    const populatedBoxes: GeminiThesisBox[] = [];

    for (const box of boxes) {
      if (
        box.boxType === "PRIMARY_MATERIAL" ||
        box.boxType === "RELATED_THESES"
      ) {
        populatedBoxes.push(box);
        continue;
      }

      log.info("mining_box_foundational", {
        service: "boxes",
        data: { title: box.title, queryCount: box.subBoxes?.length ?? 0 },
      });

      const queries = (box.subBoxes ?? [])
        .map((s) => s.semanticQuery)
        .filter((q): q is string => q !== null);
      const boxContext: BoxContext = {
        boxType: box.boxType,
        title: box.title,
        description: box.description,
      };
      const mined = await mineCoCitations(queries, log, boxContext);

      // Distribute each mined champion to its corresponding sub-box
      // (mineCoCitations returns one result per query, in order)
      let minedIdx = 0;
      const updatedSubBoxes = (box.subBoxes ?? []).map((sb) => {
        if (sb.semanticQuery?.trim()) {
          const champion =
            minedIdx < mined.length ? mined[minedIdx] : undefined;
          minedIdx++;
          return { ...sb, foundationalQueries: champion ? [champion] : [] };
        }
        return { ...sb, foundationalQueries: [] };
      });

      populatedBoxes.push({
        ...box,
        subBoxes: updatedSubBoxes,
        foundationalQueries: [],
      });
    }

    // Deduplicate across all boxes
    const dedupedBoxes = deduplicateFoundationalQueries(populatedBoxes);

    // Final validation
    const validationResult = FinalBoxGenerationResponseSchema.safeParse({
      boxes: dedupedBoxes,
    });

    if (!validationResult.success) {
      log.error("box_mining_validation_failed", {
        service: "boxes",
        error: new Error(validationResult.error.message),
        data: {
          issues: validationResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      });
      return {
        error: "Kutulardaki kurucu literatür verisi doğrulamayı geçemedi.",
      };
    }

    log.info("mine_foundational_queries_complete", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: { count: dedupedBoxes.length },
    });

    return { success: true, boxes: dedupedBoxes };
  } catch (err) {
    log.error("mine_foundational_queries_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Kurucu eserler aranırken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Removes duplicate foundational queries across all sub-boxes globally
 * based on author+title key. If a work was already assigned to an earlier
 * sub-box, it is filtered out from subsequent sub-boxes.
 */
function deduplicateFoundationalQueries(
  boxes: GeminiThesisBox[],
): GeminiThesisBox[] {
  const seen = new Set<string>();

  return boxes.map((box) => ({
    ...box,
    subBoxes: (box.subBoxes ?? []).map((sb) => {
      const uniqueQueries = (sb.foundationalQueries ?? []).filter((q) => {
        const key = `${q.author}|${q.title}`.toLowerCase().trim();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      return { ...sb, foundationalQueries: uniqueQueries };
    }),
    foundationalQueries: [],
  }));
}

/**
 * Fire-and-forget action that pre-fetches the full literature pool (with abstracts)
 * from OpenAlex for each non-archival box, so the Literature Review step can bypass
 * the API entirely if cached data exists.
 *
 * @param boxes - The structured box array (must have foundationalQueries populated)
 * @returns A record of box title → array of RawPaper, or empty on failure
 */
export async function prefetchLiteratureCacheAction(
  boxes: GeminiThesisBox[],
): Promise<{ cachedPapers: Record<string, RawPaper[]> }> {
  const cachedPapers: Record<string, RawPaper[]> = {};

  for (const box of boxes) {
    if (
      box.boxType === "PRIMARY_MATERIAL" ||
      !box.subBoxes ||
      box.subBoxes.length === 0
    ) {
      continue;
    }

    const allPapers: RawPaper[] = [];

    for (const sub of box.subBoxes) {
      if (!sub.semanticQuery?.trim()) continue;
      try {
        const results = await searchOpenAlex(sub.semanticQuery);
        allPapers.push(...results);
      } catch {
        // Silently skip failed queries — this is a best-effort cache
      }
    }

    // Simple title-based deduplication
    const seen = new Set<string>();
    const unique: RawPaper[] = [];
    for (const p of allPapers) {
      const key = (p.title ?? "").toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    cachedPapers[box.title] = unique;
  }

  return { cachedPapers };
}

/**
 * Persists the generated (and possibly user-edited) subject boxes to thesis_boxes.
 * Deletes existing boxes for the matrix first, then inserts flat hierarchy.
 * After boxes are written, inserts Gemini-mapped overlapping theses from the
 * originality report into library_resources using index-based box mapping.
 *
 * @param boxes - Array of GeminiThesisBox to persist
 * @returns Success or error response
 */
export async function confirmBoxesAction(
  boxes: GeminiThesisBox[],
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("boxes_confirm_start", {
    service: "boxes",
    data: { context: "Konu kutusu kaydetme" },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix, report] = await Promise.all([
      fetchThesisMatrix(),
      fetchOriginalityReport(),
    ]);

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const thesisMatrixId = matrix.id;
    const overlapTable = report?.tezaraResults?.overlapTable ?? [];

    const libraryValues: NewLibraryResource[] = [];

    await db.transaction(async (tx) => {
      // Delete existing boxes
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      // Insert parent boxes (flat rows, no subBoxes/semanticSearchQueries columns)
      const parentValues = boxes.map((box) => ({
        thesisMatrixId,
        title: box.title,
        boxType: box.boxType,
        description: box.description || "",
        parentId: null,
        semanticQuery: null,
        foundationalQueries: box.foundationalQueries || [],
        concepts: box.concepts || [],
      }));

      let insertedBoxes: { id: number; title: string }[] = [];

      if (parentValues.length > 0) {
        insertedBoxes = await tx
          .insert(thesisBoxes)
          .values(parentValues)
          .returning({ id: thesisBoxes.id, title: thesisBoxes.title });
      }

      // Insert sub-boxes as separate rows with parentId FK
      const subBoxValues: (typeof thesisBoxes.$inferInsert)[] = [];

      for (let i = 0; i < boxes.length; i++) {
        const parentRow = insertedBoxes[i];
        if (!parentRow) continue;
        const parentSubBoxes = boxes[i]?.subBoxes ?? [];
        for (const sb of parentSubBoxes) {
          subBoxValues.push({
            thesisMatrixId,
            title: sb.title,
            boxType: sb.boxType,
            description: sb.description,
            parentId: parentRow.id,
            semanticQuery: sb.semanticQuery || "",
            foundationalQueries: sb.foundationalQueries ?? [],
            concepts: sb.concepts ?? [],
          });
        }
      }

      if (subBoxValues.length > 0) {
        await tx.insert(thesisBoxes).values(subBoxValues);
      }

      // Insert all overlap theses into the RELATED_THESES box
      const relatedBoxIndex = boxes.findIndex(
        (b) => b.title === RELATED_THESES_TITLE,
      );
      const relatedBoxId =
        relatedBoxIndex >= 0 ? insertedBoxes[relatedBoxIndex]?.id : null;

      if (relatedBoxId && overlapTable.length > 0) {
        for (const thesis of overlapTable) {
          libraryValues.push({
            thesisBoxId: relatedBoxId,
            title: thesis.title,
            abstract: null,
            url: thesis.yokPdfUrl ?? null,
            doi: null,
            publisher: thesis.university ?? null,
            publicationYear: thesis.year,
            authors: [thesis.author],
            isRead: false,
            isFoundational: false,
            relevanceScore: 0.99,
          });
        }
      }

      if (libraryValues.length > 0) {
        await tx
          .insert(libraryResources)
          .values(libraryValues)
          .onConflictDoNothing();
      }
    });

    revalidateOnboardingPaths();
    updateTag(CACHE_TAGS.thesisBoxes);

    log.info("boxes_confirm_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        count: boxes.length,
        mappedThesisCount: libraryValues.length,
        context: "Konu kutusu kaydetme",
      },
    });
    return { success: true };
  } catch (err) {
    log.error("boxes_confirm_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
      data: { context: "Konu kutusu kaydetme" },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
