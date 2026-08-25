import { db } from "@/core/db";
import {
  matrices,
  boxes,
  outlines,
  sources,
  tasks,
  type Box,
  type Outline,
} from "@/core/db/schema";
import { eq } from "drizzle-orm";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { searchOpenAlex } from "@/app/(onboarding)/onboarding/literature-review/_services/openalex/client";
import { rerankWithCohere } from "@/core/services/ai/cohere";
import {
  matrixRealignmentSchema,
  matrixRealignmentJsonSchema,
  type MatrixRealignmentOutput,
} from "./realignment-schemas";
import { buildRealignmentPromptPayload } from "./realignment-prompt";

export interface CascadeRealignmentResult {
  success: boolean;
  analysisSummary: string;
  createdBoxes: { id: number; title: string; semanticQuery: string }[];
  deletedBoxes: { id: number; title: string }[];
  addedSources: { id: number; title: string; authors?: string[] }[];
  createdTasks: { id: number; title: string }[];
  summaryMessage: string;
}


/**
 * Normalizes title for deduplication.
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Runs the automatic Cascading Matrix Realignment & Literature Pipeline when a Thesis Matrix changes.
 *
 * 1. Analyzes impact with Gemini Flash Lite 3.5.
 * 2. Generates new sub-boxes with targeted English semantic queries.
 * 3. Persists new boxes to DB.
 * 4. Queries OpenAlex and performs Cohere Rerank.
 * 5. Persists selected academic sources into library.
 * 6. Creates actionable reading tasks on the Kanban board.
 *
 * @param userId - Authenticated user ID.
 * @param updatedFieldDescription - Description of which matrix fields changed.
 * @returns Result summary of the realignment cascade.
 */
export async function runMatrixRealignmentCascade(
  userId: number,
  updatedFieldDescription: string,
): Promise<CascadeRealignmentResult> {
  const log = new Logger(createFlowId());
  const startTime = performance.now();

  log.info("matrix_realignment_cascade_start", {
    service: "boxes",
    data: { userId, updatedFieldDescription },
  });

  // 1. Fetch user matrix, boxes, outlines
  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });

  if (!userMatrix) {
    return {
      success: false,
      analysisSummary: "Tez matrisi bulunamadı.",
      createdBoxes: [],
      deletedBoxes: [],
      addedSources: [],
      createdTasks: [],
      summaryMessage: "Tez matrisi bulunamadığı için kademeli uyarlama yapılamadı.",
    };
  }

  const existingBoxes = (await db
    .select()
    .from(boxes)
    .where(eq(boxes.matrixId, userMatrix.id))) as Box[];

  const existingOutlines = (await db
    .select()
    .from(outlines)
    .where(eq(outlines.matrixId, userMatrix.id))) as Outline[];

  // 2. Build Prompt & Call Gemini Structured Output
  const payload = buildRealignmentPromptPayload({
    matrix: userMatrix,
    updatedField: updatedFieldDescription,
    existingBoxes,
    existingOutlines,
  });

  let output: MatrixRealignmentOutput;
  try {
    output = await generateGeminiStructuredContent<MatrixRealignmentOutput>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      matrixRealignmentJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        zodSchema: matrixRealignmentSchema,
        seed: GEMINI_SEED,
        payloadStage: "matrix_realignment_cascade",
        quiet: true,
      },
    );
  } catch (err) {
    log.error("matrix_realignment_gemini_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      success: false,
      analysisSummary: "Etki analizi üretilirken model hatası oluştu.",
      createdBoxes: [],
      deletedBoxes: [],
      addedSources: [],
      createdTasks: [],
      summaryMessage: "Matris güncellendi ancak kademeli etki analizi oluşturulamadı.",
    };
  }

  const createdBoxes: { id: number; title: string; semanticQuery: string }[] = [];
  const addedSources: { id: number; title: string; authors?: string[] }[] = [];
  const createdTasks: { id: number; title: string }[] = [];

  // 3. Find or ensure parent pillar box for the affected quadrant
  const rootPillar = existingBoxes.find(
    (b) => b.boxType === output.affectedBoxType && !b.parentId,
  );

  let parentId: number | null = rootPillar?.id ?? null;

  if (rootPillar && output.updatedPillarTitle && output.updatedPillarTitle.trim().length > 3) {
    await db
      .update(boxes)
      .set({ title: output.updatedPillarTitle.trim(), updatedAt: new Date() })
      .where(eq(boxes.id, rootPillar.id));
  } else if (!parentId) {
    // If no root pillar exists, create one
    const [newPillar] = await db
      .insert(boxes)
      .values({
        matrixId: userMatrix.id,
        boxType: output.affectedBoxType,
        title:
          output.updatedPillarTitle ||
          (output.affectedBoxType === "THEORETICAL_FRAMEWORK"
            ? "Kuramsal ve Kavramsal Çerçeve"
            : output.affectedBoxType === "METHODOLOGY"
              ? "Metodoloji ve Araştırma Deseni"
              : output.affectedBoxType === "SUBJECT_PROBLEM"
                ? "Problem Alanı ve Tarihsel Bağlam"
                : "Birincil ve İkincil Kaynak Arşivi"),
        description: "Matris güncellemesi ile oluşturulan ana sütun.",
        concepts: [],
        activeSeedIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: boxes.id });

    parentId = newPillar.id;
  }

  // Delete obsolete sub-boxes from previous framework
  const deletedBoxes: { id: number; title: string }[] = [];
  if (output.obsoleteSubBoxIds && output.obsoleteSubBoxIds.length > 0) {
    for (const obsId of output.obsoleteSubBoxIds) {
      const matchingObsBox = existingBoxes.find(
        (b) => b.id === obsId && b.parentId !== null,
      );
      if (matchingObsBox) {
        await db.delete(boxes).where(eq(boxes.id, obsId));
        deletedBoxes.push({ id: matchingObsBox.id, title: matchingObsBox.title });
      }
    }
  }

  // 4. Create new sub-boxes & run literature discovery
  for (const newSub of output.newSubBoxes) {

    const [insertedBox] = await db
      .insert(boxes)
      .values({
        matrixId: userMatrix.id,
        parentId: parentId,
        boxType: newSub.parentBoxType,
        title: newSub.title,
        description: newSub.description,
        concepts: newSub.concepts,
        semanticQuery: newSub.semanticQuery,
        activeSeedIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: boxes.id, title: boxes.title, semanticQuery: boxes.semanticQuery });

    createdBoxes.push({
      id: insertedBox.id,
      title: insertedBox.title,
      semanticQuery: insertedBox.semanticQuery ?? newSub.semanticQuery,
    });

    // 5. Query OpenAlex for canonical literature
    try {
      const rawPapers = await searchOpenAlex(newSub.semanticQuery, 20);

      if (rawPapers && rawPapers.length > 0) {
        // Rerank with Cohere or take top papers
        let selectedPapers = rawPapers;
        const thesisContextQuery = `${userMatrix.subjectProblem ?? ""} ${userMatrix.theoreticalFramework ?? ""} ${newSub.title} ${newSub.description}`;

        if (process.env.COHERE_API_KEY && rawPapers.length > 3) {
          try {
            const documents = rawPapers.map(
              (p) => `${p.title}. Yazar: ${(p.authors ?? []).join(", ")}. Özet: ${p.abstract ?? ""}`,
            );
            const rerankRes = await rerankWithCohere({
              query: thesisContextQuery.substring(0, 4000),
              documents,
            });
            selectedPapers = rerankRes.map((r) => rawPapers[r.index]);
          } catch {
            // keep rawPapers order if rerank fails
          }
        }

        // Limit to standard 3-4 top articles per new sub-box
        const targetArticles = selectedPapers.slice(0, 3);

        for (const art of targetArticles) {
          if (!art.title || art.title.trim().length < 5) continue;

          // Check if already in this box
          const normArtTitle = normalizeTitle(art.title);
          const boxExistingSources = await db
            .select({ title: sources.title })
            .from(sources)
            .where(eq(sources.boxId, insertedBox.id));

          const alreadyExists = boxExistingSources.some(
            (s) => normalizeTitle(s.title) === normArtTitle,
          );
          if (alreadyExists) continue;


          const [insertedSource] = await db
            .insert(sources)
            .values({
              boxId: insertedBox.id,
              title: art.title,
              authors: art.authors ?? [],
              publisher: art.publisher ?? null,
              publicationYear: art.year ?? null,
              doi: art.doi ?? null,
              openalexId: art.openAlexId ?? null,
              isRead: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning({ id: sources.id, title: sources.title, authors: sources.authors });

          addedSources.push({
            id: insertedSource.id,
            title: insertedSource.title,
            authors: insertedSource.authors ?? [],
          });

          // 6. Create reading task on Kanban board
          const [insertedTask] = await db
            .insert(tasks)
            .values({
              userId,
              boxId: insertedBox.id,
              sourceId: insertedSource.id,
              taskType: "MANUAL",
              title: `${art.title.substring(0, 60)}... makalesini incele`,
              description: `Yeni kuramsal/metodolojik odak ("${newSub.title}") doğrultusunda kütüphaneye eklenen yayını inceleyin ve tez argümanınızla ilişkilendirin.`,
              priority: "HIGH",
              status: "TODO",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning({ id: tasks.id, title: tasks.title });

          createdTasks.push({
            id: insertedTask.id,
            title: insertedTask.title,
          });
        }
      }
    } catch (litErr) {
      log.error("matrix_realignment_literature_failed", {
        service: "boxes",
        error: litErr instanceof Error ? litErr : new Error(String(litErr)),
      });
    }
  }

  log.info("matrix_realignment_cascade_success", {
    service: "boxes",
    durationMs: Math.round(performance.now() - startTime),
    data: {
      createdBoxesCount: createdBoxes.length,
      addedSourcesCount: addedSources.length,
      createdTasksCount: createdTasks.length,
    },
  });

  const summaryMessage = `Tez matrisi güncellendi.\n\n` +
    `**Kademeli Etki Analizi:**\n${output.analysisSummary}\n\n` +
    (deletedBoxes.length > 0
      ? `**Temizlenen Eski Araştırma Kutuları (${deletedBoxes.length}):**\n` +
        deletedBoxes.map((b) => `- ~~${b.title}~~ (İlişkili eski kaynaklar temizlendi)`).join("\n") +
        `\n\n`
      : "") +
    `**Oluşturulan Yeni Araştırma Kutuları (${createdBoxes.length}):**\n` +
    createdBoxes.map((b) => `- **${b.title}** (Semantik Sorgu: \`${b.semanticQuery}\`)`).join("\n") +
    `\n\n**Kütüphaneye Eklenen Yeni Kaynaklar (${addedSources.length}):**\n` +
    (addedSources.length > 0
      ? addedSources.map((s) => `- ${s.title}`).join("\n")
      : "Literatür araması devam ediyor.") +
    `\n\n**Kanban Panosuna Eklenen Görevler (${createdTasks.length}):**\n` +
    createdTasks.map((t) => `- ${t.title}`).join("\n");

  return {
    success: true,
    analysisSummary: output.analysisSummary,
    createdBoxes,
    deletedBoxes,
    addedSources,
    createdTasks,
    summaryMessage,
  };
}

