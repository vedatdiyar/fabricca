"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { thesisMatrices, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { revalidatePath } from "next/cache";

export type ThesisMatrixInput = {
  calismaBasligi: string;
  arastirmaSorusu: string;
  temelIddia: string;
  metodoloji: string;
  kuramsalCerceve: string;
  tarihselMekansalSinirlar: string;
};

export type EnhancedThesisData = {
  akademikCalismaBasligi: string;
  literaturluArastirmaSorusu: string;
  olgunlastirilmisTezSavi: string;
  kavramsalVeKuramsalAltyapi: string;
  akademikMetodolojiTasarimi: string;
  tarihselMekansalSinirlar: string;
};

export type EnhancedThesisActionResult =
  | { success: true; data: EnhancedThesisData; error?: never }
  | { success?: never; error: string };

const MIN_LENGTH = 3;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

const enhancedThesisSchema = z.object({
  akademikCalismaBasligi: z.string(),
  literaturluArastirmaSorusu: z.string(),
  olgunlastirilmisTezSavi: z.string(),
  kavramsalVeKuramsalAltyapi: z.string(),
  akademikMetodolojiTasarimi: z.string(),
  tarihselMekansalSinirlar: z.string(),
});

/**
 * Tez Matrisi form verilerini doğrular, thesis_matrices tablosuna kaydeder,
 * ardından doğrulanmış verileri doğrudan Gemini API'sine göndererek
 * akademik olgunlaştırma yapar, sonuçları veri tabanına yazar ve
 * users tablosundaki onboardingStep değerini "thesis_matrix_enhanced"
 * olarak günceller.
 *
 * @param data - Tez Matrisi form verileri
 * @returns Başarılıysa { success: true, data: EnhancedThesisData },
 *          hatalıysa { error: string }
 */
export async function submitThesisMatrixAction(
  data: ThesisMatrixInput,
): Promise<EnhancedThesisActionResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const calismaBasligi = data.calismaBasligi?.trim();
    const arastirmaSorusu = data.arastirmaSorusu?.trim();
    const temelIddia = data.temelIddia?.trim();
    const metodoloji = data.metodoloji?.trim();
    const kuramsalCerceve = data.kuramsalCerceve?.trim();
    const tarihselMekansalSinirlar = data.tarihselMekansalSinirlar?.trim();

    if (!calismaBasligi || calismaBasligi.length < MIN_LENGTH) {
      return {
        error: "Çalışma başlığı en az 3 karakter olmalıdır.",
      };
    }

    if (!arastirmaSorusu || arastirmaSorusu.length < MIN_LENGTH) {
      return {
        error: "Araştırma sorusu en az 3 karakter olmalıdır.",
      };
    }

    if (!temelIddia || temelIddia.length < MIN_LENGTH) {
      return {
        error: "Temel iddia en az 3 karakter olmalıdır.",
      };
    }

    if (!metodoloji || metodoloji.length < MIN_LENGTH) {
      return {
        error: "Metodoloji en az 3 karakter olmalıdır.",
      };
    }

    if (!kuramsalCerceve || kuramsalCerceve.length < MIN_LENGTH) {
      return {
        error: "Kuramsal çerçeve en az 3 karakter olmalıdır.",
      };
    }

    if (
      !tarihselMekansalSinirlar ||
      tarihselMekansalSinirlar.length < MIN_LENGTH
    ) {
      return {
        error: "Tarihsel/mekânsal sınırlar en az 3 karakter olmalıdır.",
      };
    }

    const userId = session.userId;

    await db
      .insert(thesisMatrices)
      .values({
        userId,
        calismaBasligi,
        arastirmaSorusu,
        temelIddia,
        metodoloji,
        kuramsalCerceve,
        tarihselMekansalSinirlar,
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          calismaBasligi,
          arastirmaSorusu,
          temelIddia,
          metodoloji,
          kuramsalCerceve,
          tarihselMekansalSinirlar,
          updatedAt: new Date(),
        },
      });

    const systemInstruction = `
<role>
You are a senior academic advisor and a brilliant social sciences/humanities theorist.
Your sole task is to translate raw, garden-variety, everyday expressions of a graduate student into fully developed academic, theoretical, and scientific language.
</role>

<constraints>
- Never repeat the raw input verbatim or merely paraphrase/summarize it.
- Always deploy appropriate theoretical lenses (Foucault, Bourdieu, Butler, Latour, Deleuze, Haraway, etc.) and scholarly concepts.
- Elevate the language to publishable academic prose.
- Each output field must read like a passage from a well-structured thesis proposal or academic article.
- Respond only with valid JSON matching the provided schema.
</constraints>
`;

    const prompt = `<context>
Aşağıda, kullanıcının 1. adımda gündelik dille girdiği ham tez matrisi verileri yer almaktadır. Bu verileri akademik/teorik bir dile tercüme et.

<calismaBasligi>
${calismaBasligi}
</calismaBasligi>

<arastirmaSorusu>
${arastirmaSorusu}
</arastirmaSorusu>

<temelIddia>
${temelIddia}
</temelIddia>

<metodoloji>
${metodoloji}
</metodoloji>

<kuramsalCerceve>
${kuramsalCerceve}
</kuramsalCerceve>

<tarihselMekansalSinirlar>
${tarihselMekansalSinirlar}
</tarihselMekansalSinirlar>
</context>

<task>
Yukarıdaki ham verileri kullanarak aşağıdaki 6 alanı doldur:

1. akademikCalismaBasligi: Ham çalışma başlığını, alana uygun kavramsal terimlerle bilimsel bir tez başlığına dönüştür.
2. literaturluArastirmaSorusu: Araştırma sorusunu, teorik değişkenleri ve literatür bağlamını görünür kılacak şekilde akademik formda yeniden ifade et.
3. olgunlastirilmisTezSavi: Temel iddiayı, bilimsel bir hipotez/sav haline getir; karşıt argümanlarla diyaloğa girebilecek düzeyde teorik pozisyon al.
4. kavramsalVeKuramsalAltyapi: Ham kuramsal çerçeve ve sınır bilgilerini kullanarak, çalışmanın hangi teorik merceklerle (Foucault, Bourdieu, Butler vb.) okunacağını ve hangi literatürle diyaloga gireceğini akademik dille açıkla.
5. akademikMetodolojiTasarimi: Ham metodoloji tanımını, bilimsel araştırma deseni (etnografi, söylem analizi, tarihsel analiz, vb.) ve veri toplama/analiz yöntemleriyle zenginleştirilmiş akademik bir metodoloji bölümüne dönüştür.
6. tarihselMekansalSinirlar: Ham tarihsel/mekânsal sınır tanımını, çalışmanın kapsamını, bağlamını ve sınırlılıklarını bilimsel bir dille ifade eden akademik bir alana dönüştür. Zaman aralığını, coğrafi/mekânsal sınırları ve bu sınırların araştırma deseni açısından anlamını teorik olarak gerekçelendir.
</task>`;

    console.log("[submitThesis] Gemini çağrısı yapılıyor...");

    let enhancedData: EnhancedThesisData | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        enhancedData = await generateStructuredContent(
          "gemini-3.1-flash-lite",
          systemInstruction,
          prompt,
          enhancedThesisSchema,
        );
        console.log("[submitThesis] Gemini yanıtı alındı.");
        break;
      } catch (e) {
        lastError = e;
        console.warn(`[submitThesis] ${attempt}. deneme başarısız.`, e);
        if (attempt < MAX_RETRIES) {
          console.log(
            `[submitThesis] ${RETRY_DELAY_MS}ms beklenip tekrar deneniyor...`,
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    if (!enhancedData) {
      throw lastError;
    }

    await db
      .update(thesisMatrices)
      .set({
        calismaBasligi: enhancedData.akademikCalismaBasligi,
        arastirmaSorusu: enhancedData.literaturluArastirmaSorusu,
        temelIddia: enhancedData.olgunlastirilmisTezSavi,
        metodoloji: enhancedData.akademikMetodolojiTasarimi,
        kuramsalCerceve: enhancedData.kavramsalVeKuramsalAltyapi,
        tarihselMekansalSinirlar: enhancedData.tarihselMekansalSinirlar,
        updatedAt: new Date(),
      })
      .where(eq(thesisMatrices.userId, userId));

    await db
      .update(users)
      .set({ onboardingStep: "thesis_matrix_enhanced" })
      .where(eq(users.id, userId));

    revalidatePath("/onboarding");
    return { success: true, data: enhancedData };
  } catch (error) {
    console.error("Tez matrisi kaydedilirken hata:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return {
      error: `Tez matrisi zenginleştirilirken bir hata oluştu: ${message}`,
    };
  }
}
