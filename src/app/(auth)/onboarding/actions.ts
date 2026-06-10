"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { thesisMatrices, onboardingStates } from "@/db/schema";
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
};

export type OnboardingActionResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

export type OnboardingStatusResult =
  | {
      onboardingCompleted: boolean;
      currentStep: string;
      error?: never;
    }
  | { onboardingCompleted?: never; currentStep?: never; error: string };

export type EnhancedThesisActionResult =
  | { success: true; data: EnhancedThesisData; error?: never }
  | { success?: never; error: string };

const MIN_LENGTH = 3;

const enhancedThesisSchema = z.object({
  akademikCalismaBasligi: z.string(),
  literaturluArastirmaSorusu: z.string(),
  olgunlastirilmisTezSavi: z.string(),
  kavramsalVeKuramsalAltyapi: z.string(),
  akademikMetodolojiTasarimi: z.string(),
});

/**
 * Tez Matrisi form verilerini doğrular, thesis_matrices tablosuna kaydeder
 * ve onboarding_states tablosundaki current_step değerini
 * "thesis_matrix_enhanced" olarak günceller.
 * Kullanıcı kimliği sunucu tarafındaki oturum cookie'sinden alınır.
 *
 * @param data - Tez Matrisi form verileri
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function submitThesisMatrixAction(
  data: ThesisMatrixInput,
): Promise<OnboardingActionResult> {
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

    const [existingState] = await db
      .select()
      .from(onboardingStates)
      .where(eq(onboardingStates.userId, userId));

    if (!existingState) {
      await db.insert(onboardingStates).values({
        userId,
        currentStep: "thesis_matrix_enhanced",
        completedSteps: ["thesis_matrix"],
        onboardingCompleted: false,
      });
    } else {
      const updatedCompletedSteps = [
        ...new Set([...existingState.completedSteps, "thesis_matrix"]),
      ];

      await db
        .update(onboardingStates)
        .set({
          currentStep: "thesis_matrix_enhanced",
          completedSteps: updatedCompletedSteps,
          updatedAt: new Date(),
        })
        .where(eq(onboardingStates.userId, userId));
    }

    return { success: true };
  } catch (error) {
    console.error("Tez matrisi kaydedilirken hata:", error);
    return { error: "Tez matrisi kaydedilirken bir hata oluştu." };
  }
}

/**
 * Kullanıcının 1. adımda kaydettiği ham tez matrisi verilerini okuyup
 * Gemini 3.1 Flash-Lite modeline göndererek akademik olarak
 * olgunlaştırılmış/tercüme edilmiş 5 alanlı çıktı üretir.
 * Bu action DB'ye yazmaz, sadece Gemini yanıtını döndürür.
 *
 * @returns Başarılıysa { success: true, data: EnhancedThesisData },
 *          hatalıysa { error: string }
 */
export async function getEnhancedThesisMatrixAction(): Promise<EnhancedThesisActionResult> {
  try {
    console.log("[getEnhanced] Action çağrıldı.");
    const session = await getSession();
    console.log("[getEnhanced] Session alındı:", !!session);

    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    console.log("[getEnhanced] DB'den matris okunuyor. userId:", session.userId);
    const [matrix] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    console.log("[getEnhanced] Matris bulundu mu:", !!matrix);

    if (!matrix) {
      return {
        error:
          "Henüz bir tez matrisi oluşturulmamış. Lütfen önce 1. adımı tamamlayın.",
      };
    }

    const systemInstruction = `
You are a senior academic advisor and a brilliant social sciences/humanities theorist.
Your sole task is to translate raw, garden-variety, everyday expressions of a graduate student into fully developed academic, theoretical, and scientific language.

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
${matrix.calismaBasligi}
</calismaBasligi>

<arastirmaSorusu>
${matrix.arastirmaSorusu}
</arastirmaSorusu>

<temelIddia>
${matrix.temelIddia}
</temelIddia>

<metodoloji>
${matrix.metodoloji}
</metodoloji>

<kuramsalCerceve>
${matrix.kuramsalCerceve}
</kuramsalCerceve>

<tarihselMekansalSinirlar>
${matrix.tarihselMekansalSinirlar}
</tarihselMekansalSinirlar>
</context>

<task>
Yukarıdaki ham verileri kullanarak aşağıdaki 5 alanı doldur:

1. akademikCalismaBasligi: Ham çalışma başlığını, alana uygun kavramsal terimlerle bilimsel bir tez başlığına dönüştür.
2. literaturluArastirmaSorusu: Araştırma sorusunu, teorik değişkenleri ve literatür bağlamını görünür kılacak şekilde akademik formda yeniden ifade et.
3. olgunlastirilmisTezSavi: Temel iddiayı, bilimsel bir hipotez/sav haline getir; karşıt argümanlarla diyaloğa girebilecek düzeyde teorik pozisyon al.
4. kavramsalVeKuramsalAltyapi: Ham kuramsal çerçeve ve sınır bilgilerini kullanarak, çalışmanın hangi teorik merceklerle (Foucault, Bourdieu, Butler vb.) okunacağını ve hangi literatürle diyaloga gireceğini akademik dille açıkla.
5. akademikMetodolojiTasarimi: Ham metodoloji tanımını, bilimsel araştırma deseni (etnografi, söylem analizi, tarihsel analiz, vb.) ve veri toplama/analiz yöntemleriyle zenginleştirilmiş akademik bir metodoloji bölümüne dönüştür.
</task>`;

    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 1500;

    let data: EnhancedThesisData | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[getEnhanced] Gemini çağrısı yapılıyor (deneme ${attempt}/${MAX_RETRIES})...`);
        data = await generateStructuredContent(
          "gemini-3.1-flash-lite",
          systemInstruction,
          prompt,
          enhancedThesisSchema,
        );
        console.log("[getEnhanced] Gemini yanıtı alındı. data anahtarları:", Object.keys(data));
        break;
      } catch (e) {
        lastError = e;
        console.warn(`[getEnhanced] ${attempt}. deneme başarısız.`, e);
        if (attempt < MAX_RETRIES) {
          console.log(`[getEnhanced] ${RETRY_DELAY_MS}ms beklenip tekrar deneniyor...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    if (!data) {
      throw lastError;
    }
    return { success: true, data };
  } catch (error) {
    console.error("[getEnhanced] Beklenmeyen hata:", error);
    if (error instanceof Error) {
      console.error("[getEnhanced] Hata adı:", error.name);
      console.error("[getEnhanced] Hata mesajı:", error.message);
      console.error("[getEnhanced] Stack trace:", error.stack);
    }
    const message =
      error instanceof Error ? error.message : "Bilinmeyen hata";
    return {
      error: `Tez matrisi zenginleştirilirken bir hata oluştu: ${message}`,
    };
  }
}

/**
 * Kullanıcının onayladığı akademik olgunlaştırılmış tez matrisi verilerini
 * thesis_matrices tablosundaki mevcut 6 kolona yazar ve onboarding_states
 * tablosundaki current_step değerini "originality_report" olarak günceller.
 *
 * @param data - Onaylanmış EnhancedThesisData
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;

    await db
      .update(thesisMatrices)
      .set({
        calismaBasligi: data.akademikCalismaBasligi,
        arastirmaSorusu: data.literaturluArastirmaSorusu,
        temelIddia: data.olgunlastirilmisTezSavi,
        metodoloji: data.akademikMetodolojiTasarimi,
        kuramsalCerceve: data.kavramsalVeKuramsalAltyapi,
        updatedAt: new Date(),
      })
      .where(eq(thesisMatrices.userId, userId));

    const [existingState] = await db
      .select()
      .from(onboardingStates)
      .where(eq(onboardingStates.userId, userId));

    const updatedCompletedSteps = [
      ...new Set([
        ...(existingState?.completedSteps ?? []),
        "thesis_matrix_enhanced",
      ]),
    ];

    await db
      .update(onboardingStates)
      .set({
        currentStep: "originality_report",
        completedSteps: updatedCompletedSteps,
        updatedAt: new Date(),
      })
      .where(eq(onboardingStates.userId, userId));

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error) {
    console.error("Tez matrisi onaylanırken hata:", error);
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}

/**
 * Mevcut oturumdaki kullanıcının onboarding durumunu ve mevcut adımını sorgular.
 * Login sayfası tarafından, başarılı giriş sonrası yönlendirme
 * kararını vermek için kullanılır.
 *
 * @returns { onboardingCompleted: boolean, currentStep: string }
 *          veya hata durumunda { error: string }
 */
export async function checkOnboardingStatus(): Promise<OnboardingStatusResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı." };
    }

    const [state] = await db
      .select({
        onboardingCompleted: onboardingStates.onboardingCompleted,
        currentStep: onboardingStates.currentStep,
      })
      .from(onboardingStates)
      .where(eq(onboardingStates.userId, session.userId));

    return {
      onboardingCompleted: state?.onboardingCompleted ?? false,
      currentStep: state?.currentStep ?? "thesis_matrix",
    };
  } catch {
    return { error: "Onboarding durumu sorgulanırken bir hata oluştu." };
  }
}
