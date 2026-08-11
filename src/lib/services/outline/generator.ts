"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, outlines } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { generateStructuredContent } from "@/lib/services/gemini";
import { FLASH_36, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import {
  outlineGenerationSchema,
  outlineGenerationJsonSchema,
  type OutlineGenerationResponse,
} from "./schema";

/**
 * Builds the system instruction for outline generation.
 *
 * @returns The system instruction prompt string.
 */
function buildOutlineSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, akademisyenlerin tez matrislerini analiz ederek tez planı (içindekiler) yapısını oluşturan uzman bir akademik yapılandırma asistanısınız.

# Birincil Görev
Sağlanan tez matrisindeki araştırma problemi, teorik çerçeve, birincil materyal ve metodoloji bilgilerine dayanarak, tezin bilim dalını tespit edin ve kapsamlı bir bölüm/alt bölüm hiyerarşisi (outline) üretin.

# Kurallar ve Sınırlamalar

## Bilim Dalı Tespiti
- Matris içeriğindeki kavramları, teorik çerçeveyi ve yöntemi analiz ederek tezin ait olduğu bilim dalını (academicField) doğru bir şekilde tespit edin.
- Bilim dalı açık ve net olmalıdır (ör: "İşletme", "Bilgisayar Mühendisliği", "Eğitim Bilimleri", "Hukuk", "Sağlık Bilimleri").

## Bölüm Yapısı
- En az 3, en fazla 8 ana bölüm oluşturun.
- Her bölüm için kısa ve öz bir akademik Türkçe açıklama yazın.
- Her bölüme ait sortOrder değerini 1'den başlayarak sıralayın.

## Alt Bölümler
- Homojen (tek konulu) bölümler için boş alt bölüm dizisi kullanın.
- Heterojen (çok konulu) bölümler için en az 2 alt bölüm oluşturun.
- Alt bölümlerin sortOrder değerleri 1'den başlayarak sıralanmalıdır.

## Dil
- Tüm başlıklar ve açıklamalar KESİNLİKLE akademik Türkçe olmalıdır.
- Bölüm başlıkları tezin içeriğini doğrudan yansıtmalıdır.

## Çıktı Formatı
- JSON formatında çıktı üretin.
- academicField alanını mutlaka doldurun.
- sections dizisini en az 3, en fazla 8 bölüm olarak doldurun.`;
}

/**
 * Builds the user prompt for outline generation from thesis matrix data.
 *
 * @param matrix - The thesis matrix data.
 * @returns The formatted user prompt string.
 */
function buildOutlineUserPrompt(matrix: {
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string | null;
  methodology: string;
}): string {
  return `# Tez Matrisi Verileri

## Araştırma Problemi
${matrix.subjectProblem}

## Teorik Çerçeve
${matrix.theoreticalFramework}

## Birincil Materyal
${matrix.primaryMaterial || "Belirtilmemiş"}

## Metodoloji
${matrix.methodology}

---

Yukarıdaki tez matrisi verilerini analiz ederek:
1. Tezin bilim dalını (academicField) tespit edin.
2. Kapsamlı bir tez planı (içindekiler) yapısı oluşturun.
3. Her bölüm ve alt bölüm için kısa, öz akademik Türkçe açıklamalar yazın.

Lütfen JSON formatında çıktı üretin.`;
}

/**
 * Generates the thesis outline via Gemini without persisting it.
 *
 * @returns The generated outline or an error message.
 */
export async function generateOutlineAction(): Promise<
  { success: true; outline: OutlineGenerationResponse } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("outline_generation_start", {
      service: "outline",
    });

    const prompt = buildOutlineUserPrompt({
      subjectProblem: matrix.subjectProblem,
      theoreticalFramework: matrix.theoreticalFramework,
      primaryMaterial: matrix.primaryMaterial,
      methodology: matrix.methodology,
    });

    const result = await generateStructuredContent<OutlineGenerationResponse>(
      FLASH_36,
      buildOutlineSystemInstruction(),
      prompt,
      outlineGenerationJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: outlineGenerationSchema,
        seed: GEMINI_SEED,
        thesisMatrix: matrix,
        payloadStage: "outline_generation",
        quiet: true,
      },
    );

    log.info("outline_generation_success", {
      service: "outline",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true, outline: result };
  } catch (err) {
    log.error("outline_generation_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error:
        "Tez planı oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Persists a generated thesis outline to the database.
 *
 * @param outline - The generated outline data from Gemini.
 * @returns A success flag or an error message.
 */
export async function persistOutlineAction(
  outline: OutlineGenerationResponse,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    await persistOutlines(session.userId, matrix.id, outline);

    log.info("outline_persist_success", {
      service: "outline",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true };
  } catch (err) {
    log.error("outline_persist_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Tez planı veritabanına kaydedilirken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Persists the outline hierarchy to the database in a single transaction.
 *
 * @param userId - The current user id.
 * @param matrixId - The thesis matrix id.
 * @param outline - The generated outline data from Gemini.
 */
async function persistOutlines(
  userId: number,
  matrixId: number,
  outline: OutlineGenerationResponse,
): Promise<void> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  await db.transaction(async (tx) => {
    await tx.delete(outlines).where(eq(outlines.matrixId, matrixId));

    const parentValues: (typeof outlines.$inferInsert)[] = [];
    for (const section of outline.sections) {
      parentValues.push({
        matrixId,
        parentId: null,
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        academicField: outline.academicField,
      });
    }

    if (parentValues.length === 0) return;

    const insertedParents = await tx
      .insert(outlines)
      .values(parentValues)
      .returning({ id: outlines.id });

    const dbParentIdMap = new Map<number, number>();
    for (let i = 0; i < outline.sections.length; i++) {
      const dbId = insertedParents[i]?.id;
      if (dbId !== undefined) {
        dbParentIdMap.set(i, dbId);
      }
    }

    const childValues: (typeof outlines.$inferInsert)[] = [];
    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      if (!section.subSections || section.subSections.length === 0) continue;

      const mappedParentId = dbParentIdMap.get(i) ?? null;
      if (mappedParentId === null) continue;

      for (const sub of section.subSections) {
        childValues.push({
          matrixId,
          parentId: mappedParentId,
          title: sub.title,
          description: sub.description,
          sortOrder: sub.sortOrder,
          academicField: null,
        });
      }
    }

    if (childValues.length > 0) {
      await tx.insert(outlines).values(childValues);
    }
  });

  log.info("outline_persist_transaction_complete", {
    service: "outline",
  });
}
