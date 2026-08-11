"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, outlines } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { generateGeminiStructuredContent } from "@/services/ai";
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
Siz, akademisyenlerin ve lisansüstü öğrencilerin tez matrislerini analiz ederek YÖK ve uluslararası akademik standartlara tam uyumlu tez planı (içindekiler) yapısı oluşturan kıdemli bir akademik yapılandırma asistanısınız.

# Birincil Görev
Sağlanan tez matrisindeki araştırma problemi, teorik çerçeve, birincil materyal ve metodoloji bilgilerine dayanarak tezin bilim dalını tespit edin ve metodolojik açıdan eksiksiz, disipline özgü bir bölüm/alt bölüm hiyerarşisi (outline) üretin.

# Kurallar ve Sınırlamalar

## 1. Bilim Dalı Tespiti (academicField)
- Matris içeriğindeki kavramları, teorik çerçeveyi ve yöntemi analiz ederek tezin ait olduğu bilim dalını tespit edin.
- Bilim dalı açık ve net olmalıdır (örn: "Siyaset Bilimi ve Kamu Yönetimi", "İşletme", "Hukuk", "Bilgisayar Mühendisliği", "Eğitim Bilimleri", "Tıp ve Sağlık Bilimleri").

## 2. Disipline Özgü Bölüm Yapısı ve Akış
Tezin mimarisini tespit edilen bilim dalının geleneksel akademik kalıplarına uygun kurgulayın:
- **Sosyal ve Beşeri Bilimler / İktisadi ve İdari Bilimler:** Giriş ve Araştırma Çerçevesi → Kavramsal ve Teorik Çerçeve → Araştırma Metodolojisi ve Analiz Çerçevesi → Ampirik Bulgular ve Tartışma (Tez konusuna özel bölüm) → Sonuç ve Değerlendirme.
- **Fen Bilimleri / Mühendislik / Sağlık Bilimleri:** Giriş ve Amaç → Literatür Taraması / Kuramsal Arka Plan → Materyal ve Yöntem → Bulgular ve Tartışma → Sonuç ve Öneriler.
- **Hukuk Bilimleri:** Giriş → Kavramsal ve Tarihsel Arka Plan → Pozitif Hukuki Düzenlemeler ve Öğreti/Yargı Kararları → Uygulamadaki Sorunlar ve Çözüm Önerileri → Sonuç.

## 3. Zorunlu Akademik Bölüm Bileşenleri
Üretilen plan istisnasız şu temel yapı taşlarını kapsamalıdır:
- **GİRİŞ BÖLÜMÜ:** Tezin konusunu, amacını, önemini ve araştırma sorularını/problemini kapsayan ilk ana bölüm.
- **METODOLOJİ / YÖNTEM:** Tezin veri toplama, analiz veya teorik yönteminin (matristeki metodoloji bilgisine uygun) işlendiği bölüm veya belirgin alt bölüm.
- **SONUÇ VE DEĞERLENDİRME:** Tezin ana bulgularını özetleyen ve katkılarını değerlendiren son ana bölüm.

## 4. Bölüm ve Alt Bölüm Standartları
- **Ana Bölüm Sayısı:** En az 3, en fazla 8 ana bölüm oluşturun.
- **Alt Bölümler (subSections):** Her ana bölümün altında konusunu detaylandıran EN AZ 2 alt bölüm bulunmalıdır. Asla boş alt bölüm dizisi bırakmayın.
- **Sıralama (sortOrder):** Ana bölümlerde ve her bölümün alt bölümlerinde 1'den başlayan ardışık sayılar kullanın.
- **Açıklama (description):** Her ana bölüm ve alt bölüm için ne yapılacağını/anlatılacağını açıklayan kısa, net akademik Türkçe açıklamalar yazın.

## 5. Dil ve Üslup
- Tüm başlıklar ve açıklamalar KESİNLİKLE yüksek düzey akademik Türkçe olmalıdır.
- Bölüm başlıkları tezin özgün konusunu doğrudan yansıtmalıdır (genel geçer basmakalıp başlıklar yerine tez konusuna özel kavramsal ve akademik terimler kullanın).`;
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
2. Bilim dalına ve tez konusuna uygun, Giriş, Yöntem/Metodoloji, Temel Bulgular/Tartışma ve Sonuç aksını eksiksiz içeren kapsamlı bir tez planı (içindekiler) yapısı oluşturun.
3. Her ana bölüm altında konusunu detaylandıran en az 2 alt bölüm oluşturun.
4. Her bölüm ve alt bölüm için kısa, öz akademik Türkçe açıklamalar yazın.

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

    const result =
      await generateGeminiStructuredContent<OutlineGenerationResponse>(
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
      error: "Tez planı oluşturulurken beklenmeyen bir hata oluştu.",
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

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    await persistOutlines(session.userId, matrix.id, outline);

    return { success: true };
  } catch (err) {
    log.error("outline_persist_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error:
        "Tez planı veritabanına kaydedilirken beklenmeyen bir hata oluştu.",
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
