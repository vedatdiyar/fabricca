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
import { orchestrateBatchProcess } from "@/app/(onboarding)/onboarding/literature-review/_services/batch-orchestrator";
import type { SubBoxInput } from "@/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";
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

interface MatrixContext {
  userMatrix: NonNullable<
    Awaited<ReturnType<typeof db.query.matrices.findFirst>>
  >;
  existingBoxes: Box[];
  existingOutlines: Outline[];
}

// ── Helpers ──

async function fetchMatrixContext(
  userId: number,
): Promise<MatrixContext | null> {
  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });
  if (!userMatrix) return null;

  const [existingBoxes, existingOutlines] = await Promise.all([
    db.select().from(boxes).where(eq(boxes.matrixId, userMatrix.id)) as Promise<
      Box[]
    >,
    db
      .select()
      .from(outlines)
      .where(eq(outlines.matrixId, userMatrix.id)) as Promise<Outline[]>,
  ]);

  return { userMatrix, existingBoxes, existingOutlines };
}

async function callRealignmentLLM(
  payload: ReturnType<typeof buildRealignmentPromptPayload>,
  log: Logger,
): Promise<MatrixRealignmentOutput> {
  return generateGeminiStructuredContent<MatrixRealignmentOutput>(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
    matrixRealignmentJsonSchema,
    log,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      zodSchema: matrixRealignmentSchema,
      seed: GEMINI_SEED,
      payloadStage: "matrix_realignment_cascade",
      quiet: true,
    },
  );
}

function resolveDefaultPillarTitle(boxType: string): string {
  if (boxType === "THEORETICAL_FRAMEWORK")
    return "Kuramsal ve Kavramsal Çerçeve";
  if (boxType === "METHODOLOGY") return "Metodoloji ve Araştırma Deseni";
  if (boxType === "SUBJECT_PROBLEM") return "Problem Alanı ve Tarihsel Bağlam";
  return "Birincil ve İkincil Kaynak Arşivi";
}

async function ensureParentPillar(
  userMatrix: MatrixContext["userMatrix"],
  existingBoxes: Box[],
  output: MatrixRealignmentOutput,
): Promise<number> {
  const affectedType = output.affectedBoxType;
  if (!affectedType)
    throw new Error("Realignment output missing affectedBoxType.");
  const rootPillar = existingBoxes.find(
    (b) => b.boxType === affectedType && !b.parentId,
  );

  if (
    rootPillar &&
    output.updatedPillarTitle &&
    output.updatedPillarTitle.trim().length > 3
  ) {
    await db
      .update(boxes)
      .set({ title: output.updatedPillarTitle!.trim(), updatedAt: new Date() })
      .where(eq(boxes.id, rootPillar.id));
    return rootPillar.id;
  }

  if (rootPillar) return rootPillar.id;

  const [newPillar] = await db
    .insert(boxes)
    .values({
      matrixId: userMatrix.id,
      boxType: affectedType,
      title:
        output.updatedPillarTitle || resolveDefaultPillarTitle(affectedType),
      description: "Matris güncellemesi ile oluşturulan ana sütun.",
      concepts: [],
      activeSeedIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: boxes.id });

  return newPillar.id;
}

async function deleteObsoleteBoxes(
  existingBoxes: Box[],
  obsoleteIds?: number[],
): Promise<{ id: number; title: string }[]> {
  if (!obsoleteIds || obsoleteIds.length === 0) return [];
  const deleted: { id: number; title: string }[] = [];
  for (const obsId of obsoleteIds) {
    const match = existingBoxes.find(
      (b) => b.id === obsId && b.parentId !== null,
    );
    if (!match) continue;
    await db.delete(boxes).where(eq(boxes.id, obsId));
    deleted.push({ id: match.id, title: match.title });
  }
  return deleted;
}

async function createSubBoxes(
  userMatrix: MatrixContext["userMatrix"],
  parentId: number,
  newSubBoxes: MatrixRealignmentOutput["newSubBoxes"],
): Promise<{
  createdBoxes: { id: number; title: string; semanticQuery: string }[];
  createdSubBoxes: {
    insertedBox: { id: number; title: string; semanticQuery: string | null };
    newSub: MatrixRealignmentOutput["newSubBoxes"][number];
  }[];
}> {
  const createdBoxes: { id: number; title: string; semanticQuery: string }[] =
    [];
  const createdSubBoxes: {
    insertedBox: { id: number; title: string; semanticQuery: string | null };
    newSub: MatrixRealignmentOutput["newSubBoxes"][number];
  }[] = [];

  for (const newSub of newSubBoxes) {
    const [insertedBox] = await db
      .insert(boxes)
      .values({
        matrixId: userMatrix.id,
        parentId,
        boxType: newSub.parentBoxType,
        title: newSub.title,
        description: newSub.description,
        concepts: newSub.concepts,
        semanticQuery: newSub.semanticQuery,
        activeSeedIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: boxes.id,
        title: boxes.title,
        semanticQuery: boxes.semanticQuery,
      });

    createdBoxes.push({
      id: insertedBox.id,
      title: insertedBox.title,
      semanticQuery: insertedBox.semanticQuery ?? newSub.semanticQuery,
    });
    createdSubBoxes.push({ insertedBox, newSub });
  }

  return { createdBoxes, createdSubBoxes };
}

async function runLiteratureAndPersist(
  createdSubBoxes: {
    insertedBox: { id: number };
    newSub: MatrixRealignmentOutput["newSubBoxes"][number];
  }[],
  userMatrix: MatrixContext["userMatrix"],
  parentId: number,
  userId: number,
  log: Logger,
): Promise<{
  addedSources: { id: number; title: string; authors?: string[] }[];
  createdTasks: { id: number; title: string }[];
}> {
  const addedSources: { id: number; title: string; authors?: string[] }[] = [];
  const createdTasks: { id: number; title: string }[] = [];

  if (createdSubBoxes.length === 0) return { addedSources, createdTasks };

  try {
    const batchBoxes: SubBoxInput[] = createdSubBoxes.map(
      ({ insertedBox, newSub }) => ({
        id: parentId ?? insertedBox.id,
        title: newSub.title,
        description: newSub.description,
        boxType: newSub.parentBoxType,
        subBoxes: [
          {
            title: newSub.title,
            description: newSub.description,
            thesisBoxId: insertedBox.id,
            semanticQuery: newSub.semanticQuery,
          },
        ],
      }),
    );

    const thesisMatrixSubject = [
      userMatrix.subjectProblem,
      userMatrix.theoreticalFramework,
      userMatrix.methodology,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const batchResult = await orchestrateBatchProcess(
      batchBoxes,
      log,
      thesisMatrixSubject,
    );

    for (const poolEntry of batchResult.poolEntries) {
      const boxId = poolEntry.thesisBoxId;
      const matchingSub = createdSubBoxes.find(
        (b) => b.insertedBox.id === boxId,
      );
      const subBoxTitle = matchingSub?.newSub.title ?? poolEntry.subBoxTitle;

      for (const art of poolEntry.articles) {
        const [insertedSource] = await db
          .insert(sources)
          .values({
            boxId,
            title: art.title,
            authors: art.authors ?? [],
            publisher: art.publisher ?? null,
            publicationYear: art.publicationYear ?? null,
            doi: art.doi ?? null,
            openalexId: art.openalexId ?? null,
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({
            id: sources.id,
            title: sources.title,
            authors: sources.authors,
          });

        addedSources.push({
          id: insertedSource.id,
          title: insertedSource.title,
          authors: insertedSource.authors ?? [],
        });

        const [insertedTask] = await db
          .insert(tasks)
          .values({
            userId,
            boxId,
            sourceId: insertedSource.id,
            taskType: "MANUAL",
            title: `${art.title.substring(0, 60)}... makalesini incele`,
            description: art.comparisonNote
              ? `${art.comparisonNote} ("${subBoxTitle}" odağı)`
              : `Yeni kuramsal/metodolojik odak ("${subBoxTitle}") doğrultusunda kütüphaneye eklenen yayını inceleyin ve tez argümanınızla ilişkilendirin.`,
            priority: "HIGH",
            status: "TODO",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: tasks.id, title: tasks.title });

        createdTasks.push({ id: insertedTask.id, title: insertedTask.title });
      }
    }
  } catch (litErr) {
    log.error("matrix_realignment_literature_pipeline_failed", {
      service: "boxes",
      error: litErr instanceof Error ? litErr : new Error(String(litErr)),
    });
  }

  return { addedSources, createdTasks };
}

function buildSummaryMessage(
  output: MatrixRealignmentOutput,
  deletedBoxes: { id: number; title: string }[],
  createdBoxes: { id: number; title: string; semanticQuery: string }[],
  addedSources: { id: number; title: string }[],
  createdTasks: { id: number; title: string }[],
): string {
  return (
    `Tez matrisi güncellendi.\n\n` +
    `**Kademeli Etki Analizi:**\n${output.analysisSummary}\n\n` +
    (deletedBoxes.length > 0
      ? `**Temizlenen Eski Araştırma Kutuları (${deletedBoxes.length}):**\n` +
        deletedBoxes
          .map((b) => `- ~~${b.title}~~ (İlişkili eski kaynaklar temizlendi)`)
          .join("\n") +
        `\n\n`
      : "") +
    `**Oluşturulan Yeni Araştırma Kutuları (${createdBoxes.length}):**\n` +
    createdBoxes
      .map((b) => `- **${b.title}** (Semantik Sorgu: \`${b.semanticQuery}\`)`)
      .join("\n") +
    `\n\n**Kütüphaneye Eklenen Yeni Kaynaklar (${addedSources.length}):**\n` +
    (addedSources.length > 0
      ? addedSources.map((s) => `- ${s.title}`).join("\n")
      : "Literatür araması devam ediyor.") +
    `\n\n**Kanban Panosuna Eklenen Görevler (${createdTasks.length}):**\n` +
    createdTasks.map((t) => `- ${t.title}`).join("\n")
  );
}

/**
 * Runs the automatic Cascading Matrix Realignment & Literature Pipeline when a Thesis Matrix changes.
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

  const context = await fetchMatrixContext(userId);
  if (!context) {
    return {
      success: false,
      analysisSummary: "Tez matrisi bulunamadı.",
      createdBoxes: [],
      deletedBoxes: [],
      addedSources: [],
      createdTasks: [],
      summaryMessage:
        "Tez matrisi bulunamadığı için kademeli uyarlama yapılamadı.",
    };
  }

  const { userMatrix, existingBoxes, existingOutlines } = context;

  const payload = buildRealignmentPromptPayload({
    matrix: userMatrix,
    updatedField: updatedFieldDescription,
    existingBoxes,
    existingOutlines,
  });

  let output: MatrixRealignmentOutput;
  try {
    output = await callRealignmentLLM(payload, log);
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
      summaryMessage:
        "Matris güncellendi ancak kademeli etki analizi oluşturulamadı.",
    };
  }

  const parentId = await ensureParentPillar(userMatrix, existingBoxes, output);
  const deletedBoxes = await deleteObsoleteBoxes(
    existingBoxes,
    output.obsoleteSubBoxIds,
  );
  const { createdBoxes, createdSubBoxes } = await createSubBoxes(
    userMatrix,
    parentId,
    output.newSubBoxes,
  );
  const { addedSources, createdTasks } = await runLiteratureAndPersist(
    createdSubBoxes,
    userMatrix,
    parentId,
    userId,
    log,
  );

  log.info("matrix_realignment_cascade_success", {
    service: "boxes",
    durationMs: Math.round(performance.now() - startTime),
    data: {
      createdBoxesCount: createdBoxes.length,
      addedSourcesCount: addedSources.length,
      createdTasksCount: createdTasks.length,
    },
  });

  return {
    success: true,
    analysisSummary: output.analysisSummary,
    createdBoxes,
    deletedBoxes,
    addedSources,
    createdTasks,
    summaryMessage: buildSummaryMessage(
      output,
      deletedBoxes,
      createdBoxes,
      addedSources,
      createdTasks,
    ),
  };
}
