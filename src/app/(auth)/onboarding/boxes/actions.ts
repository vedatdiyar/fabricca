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
  type FoundationalQuery,
  type GeminiThesisBox,
  type OnboardingActionResult,
} from "@/lib/types";
import { calculateBadge } from "@/lib/academic/badge-calculator";
import type { NewLibraryResource } from "@/db/schema";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../_lib/fetch-actions";
import type { RawPaper } from "../literature-review/_services/literature-review-papers";
import { searchOpenAlex } from "../literature-review/_services/openalex/client";

// ---------------------------------------------------------------------------
// Gemini 5-quadrant nested yanıtı için Zod doğrulama şemaları.
// ---------------------------------------------------------------------------

const RawSubBoxSchema = z.object({
  title: z.string().min(1, "Alt kutu başlığı boş olamaz"),
  description: z.string().min(1, "Alt kutu açıklaması boş olamaz"),
  concepts: z.array(z.string()).min(1),
  semanticQuery: z.string(),
  foundationalQueries: z.array(FoundationalQuerySchema).optional(),
});

const RawCategorySchema = z.object({
  title: z.string().min(1, "Kategori başlığı boş olamaz"),
  description: z.string().min(1, "Kategori açıklaması boş olamaz"),
  subBoxes: z.array(RawSubBoxSchema),
});

const RawNestedResponseSchema = z.object({
  conceptual: RawCategorySchema,
  problematization: RawCategorySchema,
  primaryMaterial: RawCategorySchema,
  context: RawCategorySchema,
  dataProtocol: RawCategorySchema,
});

type RawNestedResponse = z.infer<typeof RawNestedResponseSchema>;

/** Default box title for the hardcoded related theses box appended server-side. */
const RELATED_THESES_TITLE = "İlişkisel Tez Çalışmaları";

// ---------------------------------------------------------------------------
// Quadrant → Production BoxType Mapping (Adapter)
// ---------------------------------------------------------------------------

type ThesisBoxType = GeminiThesisBox["boxType"];

const QUADRANT_MAPPING: Record<string, ThesisBoxType> = {
  conceptual: "CONCEPTUAL",
  problematization: "PROBLEMATIZATION",
  primaryMaterial: "PRIMARY_MATERIAL",
  context: "CONTEXT",
  dataProtocol: "DATA_PROTOCOL",
};

/**
 * Gemini'nin 5-quadrant nested çıktısını düz (flat) GeminiThesisBox[] yapısına
 * dönüştürür. Her kategori bir parent box (parentId: null), altındaki subBoxes
 * ise parentId olarak parent'ın çıktı dizisindeki index'ini taşır.
 *
 * @param apiResponse - Gemini'den dönen 5-quadrant nested JSON nesnesi
 * @returns Düz GeminiThesisBox dizisi
 */
function mapToProductionShape(
  apiResponse: RawNestedResponse,
): GeminiThesisBox[] {
  const result: GeminiThesisBox[] = [];

  for (const [category, boxType] of Object.entries(QUADRANT_MAPPING)) {
    const cat = apiResponse[category as keyof RawNestedResponse];
    if (!cat?.subBoxes || cat.subBoxes.length === 0) continue;

    const parentIndex = result.length;

    // Unique concept aggregation from child sub-boxes
    const aggregatedConcepts = Array.from(
      new Set(cat.subBoxes.flatMap((sub) => sub.concepts ?? [])),
    );

    result.push({
      title: cat.title,
      boxType,
      description: cat.description,
      parentId: null,
      semanticQuery: null,
      concepts: aggregatedConcepts,
      foundationalQueries: [],
    });

    for (const sub of cat.subBoxes) {
      result.push({
        title: sub.title,
        boxType,
        description: sub.description,
        parentId: parentIndex,
        semanticQuery: sub.semanticQuery ?? null,
        concepts: sub.concepts ?? [],
        foundationalQueries: [],
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 1: Box Structure Generation
// ---------------------------------------------------------------------------

/**
 * Gemini 3.1 Flash Lite ile 5-quadrant epistemolojik kutu yapısını üretir.
 * Nested API yanıtını adaptör ile düz GeminiThesisBox[] yapısına çevirir ve
 * RELATED_THESES kutusunu özgünlük raporundan ekler.
 *
 * @returns Üretilen düz kutu dizisi veya kullanıcıya güvenli hata mesajı
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

    const generationResult = await generateStructuredContent<RawNestedResponse>(
      "gemini-3.1-flash-lite",
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: RawNestedResponseSchema,
        temperature: 1.0,
        seed: 42,
      },
    );

    const normalizedBoxes = mapToProductionShape(generationResult);

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
      relatedTheses: overlapTable.map((t) => {
        const isIkiz = calculateBadge(t.axes) === "İKİZ TEZ";
        const note = t.comparisonNote || "";
        return {
          title: t.title,
          author: t.author,
          university: t.university,
          year: t.year,
          thesisType: t.thesisType,
          department: t.department,
          axes: t.axes,
          comparisonNote: isIkiz ? `[MUTLAK İKİZ TEHDİDİ] ${note}` : note,
          yokPdfUrl: t.yokPdfUrl,
        };
      }),
    });

    const parentCount = normalizedBoxes.filter(
      (b) => b.parentId === null,
    ).length;
    const childCount = normalizedBoxes.filter(
      (b) => b.parentId !== null,
    ).length;

    log.info("box_structure_generation_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        parentCount,
        childCount,
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

// ---------------------------------------------------------------------------
// Exa & Crossref Foundational Query Mining Service
// ---------------------------------------------------------------------------
import { processSingleBox } from "./_services/foundational-oracle";

// ---------------------------------------------------------------------------
// Step 2: Foundational Query Mining
// ---------------------------------------------------------------------------

/**
 * Processes an array of items with a limit on concurrent asynchronous operations.
 *
 * @param items - Array of items to process.
 * @param limit - Maximum number of concurrent operations.
 * @param fn - Asynchronous function to apply to each item.
 * @returns Array of results preserving the original order.
 */
async function limitConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
      if (index < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Her kutunun semantik sorgularını OpenAlex üzerinde aratarak
 * co-citation tabanlı kurucu eserleri bulur ve sub-box'lara dağıtır.
 * Düz (flat) array yapısını destekler: parent box'lar (parentId === null)
 * pas geçilir, child box'lar (parentId !== null) semantik sorgularıyla
 * madenciliğe gönderilir.
 *
 * @param boxes - Step 1'den gelen düz kutu dizisi
 * @returns Kurucu eserlerle zenginleştirilmiş kutu dizisi veya hata
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

    const thesisMatrix = await fetchThesisMatrix();
    if (!thesisMatrix) return { error: "Tez matrisi bulunamadı." };

    log.info("mine_foundational_queries_start", {
      service: "boxes",
      data: { boxCount: boxes.length },
    });

    // Identify target child boxes for mining
    // Bypasses parent boxes (parentId === null), RELATED_THESES, PRIMARY_MATERIAL or CONTEXT boxes
    const targetBoxesToProcess: { box: GeminiThesisBox; flatIndex: number }[] =
      [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.parentId === null) continue;
      if (b.boxType === "PRIMARY_MATERIAL" || b.boxType === "RELATED_THESES") {
        continue;
      }
      targetBoxesToProcess.push({ box: b, flatIndex: i });
    }

    log.info("mine_foundational_queries_parallel_launch", {
      service: "boxes",
      data: { targetCount: targetBoxesToProcess.length },
    });

    // Concurrently process all target child boxes with limited concurrency (max 3)
    const results = await limitConcurrency(
      targetBoxesToProcess,
      3,
      async ({ box, flatIndex }) => {
        try {
          return await processSingleBox(box, flatIndex, thesisMatrix, log);
        } catch (err) {
          log.error("process_single_box_failed", {
            service: "boxes",
            data: { boxTitle: box.title, flatIndex },
            error: err instanceof Error ? err : new Error(String(err)),
          });
          return null;
        }
      },
    );

    // Map resolved results back to flatIndex
    const resultsMap = new Map<number, FoundationalQuery>();
    for (const r of results) {
      if (r) {
        resultsMap.set(r.flatIndex, r.foundationalQuery);
      }
    }

    // Build the final flat populatedBoxes array preserving original structure and parents
    const populatedBoxes: GeminiThesisBox[] = boxes.map((box, i) => {
      const queryForBox = resultsMap.get(i);
      if (queryForBox) {
        return {
          ...box,
          foundationalQueries: [queryForBox],
        };
      }
      return box;
    });

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

    const parentCount = dedupedBoxes.filter((b) => b.parentId === null).length;
    const childCount = dedupedBoxes.filter((b) => b.parentId !== null).length;

    log.info("mine_foundational_queries_complete", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        parentCount,
        childCount,
      },
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
 * Flat array içindeki tüm box'lar arasında yazar+başlık bazlı global
 * deduplikasyon yapar. Daha önceki bir box'a atanmış eser, sonraki
 * box'lardan filtrelenir.
 *
 * @param boxes - Kurucu eserlerle doldurulmuş düz kutu dizisi
 * @returns Deduplike edilmiş düz kutu dizisi
 */
function deduplicateFoundationalQueries(
  boxes: GeminiThesisBox[],
): GeminiThesisBox[] {
  const seen = new Set<string>();

  return boxes.map((box) => ({
    ...box,
    foundationalQueries: (box.foundationalQueries ?? []).filter((q) => {
      const key = `${q.author}|${q.title}`.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }),
  }));
}

// ---------------------------------------------------------------------------
// Literature Cache Pre-fetch
// ---------------------------------------------------------------------------

/**
 * Her kutunun semantik sorgularını OpenAlex'te aratarak sonuçları ön belleğe
 * alır. Flat array yapısında child box'lar parentId referansı ile ebeveynlerine
 * bağlanır; sonuçlar ebeveyn başlığı altında gruplanır. Literatür Tarama adımı
 * bu önbellekten beslenebilir.
 *
 * @param boxes - Kurucu eserleri doldurulmuş düz kutu dizisi
 * @returns Kutu başlığı → RawPaper[] eşleşmesi
 */
export async function prefetchLiteratureCacheAction(
  boxes: GeminiThesisBox[],
): Promise<{ cachedPapers: Record<string, RawPaper[]> }> {
  const cachedPapers: Record<string, RawPaper[]> = {};

  // Group children by their parent's flat index
  const childrenByParent = new Map<number, GeminiThesisBox[]>();
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.parentId === null) continue;
    const list = childrenByParent.get(b.parentId) ?? [];
    list.push(b);
    childrenByParent.set(b.parentId, list);
  }

  for (const [parentIndex, children] of childrenByParent) {
    const parent = boxes[parentIndex];
    if (!parent || parent.boxType === "PRIMARY_MATERIAL") continue;

    const allPapers: RawPaper[] = [];

    for (const child of children) {
      if (!child.semanticQuery?.trim()) continue;
      try {
        const results = await searchOpenAlex(child.semanticQuery);
        allPapers.push(...results);
      } catch {
        // Best-effort cache — failed queries are silently skipped
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

    cachedPapers[parent.title] = unique;
  }

  return { cachedPapers };
}

// ---------------------------------------------------------------------------
// Step 3: Box Persistence
// ---------------------------------------------------------------------------

/**
 * Üretilen (ve kullanıcı tarafından düzenlenebilmiş) konu kutularını
 * thesis_boxes tablosuna yazar. Mevcut kutular silinir, düz hiyerarşi
 * yeniden eklenir. Özgünlük raporundaki örtüşen tezler library_resources'a
 * eklenir.
 *
 * @param boxes - Kaydedilecek GeminiThesisBox dizisi
 * @returns Başarı veya hata yanıtı
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

      // Step 1: Collect parent flat indices (original array positions)
      const parentFlatIndices: number[] = [];
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].parentId === null) {
          parentFlatIndices.push(i);
        }
      }

      // Step 2: Insert parent boxes first (preserving flat order)
      const parentValues = parentFlatIndices.map((i) => ({
        thesisMatrixId,
        title: boxes[i].title,
        boxType: boxes[i].boxType,
        description: boxes[i].description || "",
        parentId: null,
        semanticQuery: null,
        foundationalQueries: boxes[i].foundationalQueries || [],
        concepts: boxes[i].concepts || [],
      }));

      let insertedParents: { id: number }[] = [];

      if (parentValues.length > 0) {
        insertedParents = await tx
          .insert(thesisBoxes)
          .values(parentValues)
          .returning({ id: thesisBoxes.id });
      }

      // Step 3: Map original flat index → database ID
      // (child box'ların parentId alanı orijinal flat array index'ini işaret eder)
      const dbParentIdMap = new Map<number, number>();
      for (let j = 0; j < parentFlatIndices.length; j++) {
        const dbId = insertedParents[j]?.id;
        if (dbId !== undefined) {
          dbParentIdMap.set(parentFlatIndices[j], dbId);
        }
      }

      // Step 4: Insert child boxes with correct FK parentId
      const childValues: (typeof thesisBoxes.$inferInsert)[] = [];

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (box.parentId === null) continue;

        const mappedParentId = dbParentIdMap.get(box.parentId) ?? null;
        childValues.push({
          thesisMatrixId,
          title: box.title,
          boxType: box.boxType,
          description: box.description || "",
          parentId: mappedParentId,
          semanticQuery: box.semanticQuery || "",
          foundationalQueries: box.foundationalQueries ?? [],
          concepts: box.concepts ?? [],
        });
      }

      if (childValues.length > 0) {
        await tx.insert(thesisBoxes).values(childValues);
      }

      // Step 5: RELATED_THESES box — DB ID via flat-index map
      const relatedBoxFlatIndex = boxes.findIndex(
        (b) => b.title === RELATED_THESES_TITLE,
      );
      const relatedBoxId =
        relatedBoxFlatIndex >= 0
          ? (dbParentIdMap.get(relatedBoxFlatIndex) ?? null)
          : null;

      if (relatedBoxId && overlapTable.length > 0) {
        for (const thesis of overlapTable) {
          const isIkiz = calculateBadge(thesis.axes) === "İKİZ TEZ";
          libraryValues.push({
            thesisBoxId: relatedBoxId,
            title: thesis.title,
            abstract: isIkiz
              ? `[MUTLAK İKİZ TEHDİDİ] ${thesis.comparisonNote || ""}`
              : thesis.comparisonNote || null,
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

    const parentCount = boxes.filter((b) => b.parentId === null).length;
    const childCount = boxes.filter((b) => b.parentId !== null).length;

    log.info("boxes_confirm_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        parentCount,
        childCount,
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
