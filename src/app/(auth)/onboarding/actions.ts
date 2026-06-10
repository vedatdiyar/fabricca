"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { thesisMatrices, users, originalityReports } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { tavilySearch } from "@/lib/tavily";
import { searchTezara, fetchThesisDetails } from "@/lib/tezara";

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

export type OnboardingActionResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

export type OnboardingStatusResult =
  | {
      onboardingStep: string;
      error?: never;
    }
  | { onboardingStep?: never; error: string };

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
 * Tüm işlemler (DB yazma + Gemini çağrısı) tek bir sunucu aksiyonunda,
 * sıralı ve senkronize şekilde yürütülür. İkinci bir bağımsız isteğe
 * gerek kalmadığı için asenkron yarış (race condition) riski yoktur.
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

    return { success: true, data: enhancedData };
  } catch (error) {
    console.error("Tez matrisi kaydedilirken hata:", error);
    if (error instanceof Error) {
      console.error("Hata adı:", error.name);
      console.error("Hata mesajı:", error.message);
    }
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return {
      error: `Tez matrisi zenginleştirilirken bir hata oluştu: ${message}`,
    };
  }
}

/**
 * Kullanıcının onayladığı akademik olgunlaştırılmış tez matrisi verilerini
 * thesis_matrices tablosundaki mevcut 6 kolona yazar ve users tablosundaki
 * onboardingStep değerini "completed" olarak günceller.
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
        tarihselMekansalSinirlar: data.tarihselMekansalSinirlar,
        updatedAt: new Date(),
      })
      .where(eq(thesisMatrices.userId, userId));

    await db
      .update(users)
      .set({ onboardingStep: "originality_report" })
      .where(eq(users.id, userId));

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error) {
    console.error("Tez matrisi onaylanırken hata:", error);
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}

/**
 * Kullanıcının daha önce kaydedilmiş akademik olgunlaştırılmış tez matrisi
 * verilerini thesis_matrices tablosundan okur.
 *
 * Bu fonksiyon yalnızca sayfa yenileme (page refresh) senaryosunda,
 * kullanıcı zaten "enhanced" adımındayken verinin görüntülenmesi için
 * kullanılır. Gemini API'sini çağırmaz, sadece önceden kaydedilmiş
 * veriyi döndürür.
 *
 * @returns Başarılıysa { success: true, data: EnhancedThesisData },
 *          hatalıysa { error: string }
 */
export async function getStoredEnhancedDataAction(): Promise<EnhancedThesisActionResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const [matrix] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!matrix) {
      return {
        error: "Henüz bir tez matrisi oluşturulmamış.",
      };
    }

    return {
      success: true,
      data: {
        akademikCalismaBasligi: matrix.calismaBasligi,
        literaturluArastirmaSorusu: matrix.arastirmaSorusu,
        olgunlastirilmisTezSavi: matrix.temelIddia,
        kavramsalVeKuramsalAltyapi: matrix.kuramsalCerceve,
        akademikMetodolojiTasarimi: matrix.metodoloji,
        tarihselMekansalSinirlar: matrix.tarihselMekansalSinirlar,
      },
    };
  } catch (error) {
    console.error("Tez matrisi okunurken hata:", error);
    return { error: "Tez matrisi okunurken bir hata oluştu." };
  }
}

/**
 * Mevcut oturumdaki kullanıcının onboarding adımını sorgular.
 * Login sayfası tarafından, başarılı giriş sonrası yönlendirme
 * kararını vermek için kullanılır.
 *
 * @returns { onboardingStep: string } veya hata durumunda { error: string }
 */
export async function checkOnboardingStatus(): Promise<OnboardingStatusResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı." };
    }

    const [user] = await db
      .select({ onboardingStep: users.onboardingStep })
      .from(users)
      .where(eq(users.id, session.userId));

    return {
      onboardingStep: user?.onboardingStep ?? "thesis_matrix",
    };
  } catch {
    return { error: "Onboarding durumu sorgulanırken bir hata oluştu." };
  }
}

// Zod schemas for originality analysis

const queryExtractionSchema = z.object({
  tavilyQueries: z.array(z.string()).min(2).max(4),
  tezaraQueries: z.array(z.string()).min(2).max(4),
});

const tavilyEvaluationSchema = z.object({
  items: z.array(
    z.object({
      fact: z.string(),
      result: z.string(),
      sourceUrl: z.string(),
    }),
  ),
  briefingNote: z.string(),
});

const axesEnum = z.enum(["ÇAKIŞIYOR", "KISMEN ÇAKIŞIYOR", "FARKLI"]);
const originalityEnum = z.enum(["YÜKSEK", "ORTA", "DÜŞÜK"]);

const comparisonThesisSchema = z.object({
  id: z.number(),
  title: z.string(),
  author: z.string(),
  university: z.string(),
  year: z.number(),
  thesisType: z.string(),
  department: z.string(),
  axes: z.object({
    subject: axesEnum,
    theory: axesEnum,
    methodology: axesEnum,
    context: axesEnum,
  }),
  originalityLevel: originalityEnum,
});

const analysisResultSchema = z.object({
  originalityBadge: originalityEnum,
  overlapTable: z.array(comparisonThesisSchema),
  strategicRecommendations: z.string(),
});

/**
 * Kullanıcı tez matrisine göre Tavily ile maddi doğrulamaları yapar
 * ve Tezara'da İngilizce çapraz arama sorgularıyla tez taraması gerçekleştirir.
 * Sonuçları karşılaştırıp veri tabanına kaydeder ve kullanıcının
 * onboarding adımını "originality_report_completed" yapar.
 *
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function startOriginalityAnalysisAction(): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;

    const [matrix] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (!matrix) {
      return {
        error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun.",
      };
    }

    const {
      calismaBasligi,
      arastirmaSorusu,
      temelIddia,
      metodoloji,
      kuramsalCerceve,
      tarihselMekansalSinirlar,
    } = matrix;

    // Adım 1: Tavily ve Tezara için arama sorgularını üretme
    console.log("[Originality Analysis] Sorgular çıkartılıyor...");
    const querySystemInstruction = `
You are an expert academic advisor. Your job is to extract search queries from the user's thesis matrix.

<constraints>
1. Produce 2-4 factual queries for Tavily search in Turkish. These queries should aim to verify historical facts, alliances, concepts, or treaties mentioned in the thesis matrix.
2. Produce 2-4 English search queries for Tezara (cross-lingual thesis search). Each query should consist of 3-4 words, in English, without quotes or special characters, capturing the core themes, methodologies, or theories.
3. Respond ONLY with valid JSON matching the schema.
</constraints>
`;

    const queryPrompt = `
Kullanıcının onayladığı tez matrisi bilgileri aşağıdadır:

<calismaBasligi>${calismaBasligi}</calismaBasligi>
<arastirmaSorusu>${arastirmaSorusu}</arastirmaSorusu>
<temelIddia>${temelIddia}</temelIddia>
<metodoloji>${metodoloji}</metodoloji>
<kuramsalCerceve>${kuramsalCerceve}</kuramsalCerceve>
<tarihselMekansalSinirlar>${tarihselMekansalSinirlar}</tarihselMekansalSinirlar>

Lütfen Tavily ve Tezara için arama sorgularını çıkartın.
`;

    const extractedQueries = await generateStructuredContent(
      "gemini-3.1-flash-lite",
      querySystemInstruction,
      queryPrompt,
      queryExtractionSchema,
    );

    console.log(
      "[Originality Analysis] Çıkartılan sorgular:",
      extractedQueries,
    );

    // Adım 2: Tavily aramaları ve Tezara aramalarını paralel koşturma (Promise.all)
    console.log(
      "[Originality Analysis] Aramalar paralel olarak başlatılıyor...",
    );
    const tavilyPromises = extractedQueries.tavilyQueries.map(async (query) => {
      try {
        const res = await tavilySearch(query);
        return { query, results: res.results };
      } catch (err) {
        console.error(`Tavily search failed for query "${query}":`, err);
        return { query, results: [] };
      }
    });

    const tezaraPromises = extractedQueries.tezaraQueries.map(async (query) => {
      try {
        return await searchTezara(query);
      } catch (err) {
        console.error(`Tezara search failed for query "${query}":`, err);
        return [];
      }
    });

    const [tavilySearchResults, ...tezaraSearchResultsLists] =
      await Promise.all([Promise.all(tavilyPromises), ...tezaraPromises]);

    // Adım 3: Tavily doğrulama sonuçlarını Gemini ile değerlendirme
    console.log("[Originality Analysis] Tavily sonuçları değerlendiriliyor...");
    const tavilyResultsFormatted = tavilySearchResults
      .map((item) => {
        const resultsSnippet = item.results
          .map(
            (r) =>
              `- Başlık: ${r.title}\n  URL: ${r.url}\n  Özet: ${r.content}`,
          )
          .join("\n");
        return `Sorgu: "${item.query}"\nBulunan Sonuçlar:\n${resultsSnippet}`;
      })
      .join("\n\n");

    const tavilyEvalSystemInstruction = `
You are a factual verification expert and academic advisor.
Analyze the internet search results for each query against the user's thesis claims.
Generate a list of evaluated facts, stating whether they are verified ("Doğrulandı"), partially verified ("Kısmen Doğrulandı"), or unverified/caution required ("Doğrulanamadı/Dikkat"). Explain why briefly in Turkish. Choose the best source URL for each fact.
Also generate an analytical, professional briefing note in Turkish summarizing the findings and historical/factual context.
Respond ONLY with valid JSON matching the schema.
`;

    const tavilyEvalPrompt = `
Kullanıcının tez matrisi:
- Başlık: ${calismaBasligi}
- Araştırma Sorusu: ${arastirmaSorusu}
- Temel İddia: ${temelIddia}
- Kuramsal Çerçeve: ${kuramsalCerceve}

Arama sorgularına ait internet arama sonuçları aşağıdadır:
${tavilyResultsFormatted}

Lütfen bu sonuçları değerlendirerek her bir sorgunun doğruluk durumunu tespit edin ve genel bir akademik briefing notu hazırlayın.
Her bir öğe için en güvenilir ve alakalı kaynak URL'sini 'sourceUrl' olarak seçin. Boş bırakmayın.
`;

    const tavilyEvaluation = await generateStructuredContent(
      "gemini-3.1-flash-lite",
      tavilyEvalSystemInstruction,
      tavilyEvalPrompt,
      tavilyEvaluationSchema,
    );

    // Adım 4: Tezara sonuçlarını süzme ve filtreleme
    const rawTheses: (typeof tezaraSearchResultsLists)[number] = [];
    for (const list of tezaraSearchResultsLists) {
      rawTheses.push(...list);
    }

    // ID bazında tekilleştirme
    const uniqueThesesMap = new Map<number, (typeof rawTheses)[number]>();
    for (const t of rawTheses) {
      uniqueThesesMap.set(t.id, t);
    }
    const uniqueTheses = Array.from(uniqueThesesMap.values());
    console.log(
      `[Originality Analysis] Benzersiz Tezara tez sayısı: ${uniqueTheses.length}`,
    );

    let selectedThesisIds: number[] = [];
    if (uniqueTheses.length === 0) {
      selectedThesisIds = [];
    } else if (uniqueTheses.length <= 7) {
      selectedThesisIds = uniqueTheses.map((t) => t.id);
    } else {
      console.log("[Originality Analysis] Kaba eleme yapılıyor...");
      const siftingSystemInstruction = `
You are an academic researcher. You are given a list of academic theses from a database and a target thesis matrix.
Your job is to select the top 5 to 7 theses that are most relevant to the target thesis (in terms of subject, methodology, or context) for detailed comparative analysis.
Do not select more than 7 theses.
Respond only with valid JSON.
`;

      const siftingPrompt = `
Target Thesis Matrix:
- Title: ${calismaBasligi}
- Subject/Research Question: ${arastirmaSorusu}
- Theory: ${kuramsalCerceve}
- Methodology: ${metodoloji}
- Context: ${tarihselMekansalSinirlar}

List of candidate theses from search:
${JSON.stringify(
  uniqueTheses.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author,
    university: t.university,
    year: t.year,
    department: t.department,
  })),
)}

Please choose the top 5 to 7 thesis IDs that are the most closely related or have the highest chance of overlap.
`;

      const siftingSchema = z.object({
        relevantThesisIds: z.array(z.number()),
      });

      try {
        const siftResult = await generateStructuredContent(
          "gemini-3.1-flash-lite",
          siftingSystemInstruction,
          siftingPrompt,
          siftingSchema,
        );
        selectedThesisIds = siftResult.relevantThesisIds.filter((id) =>
          uniqueTheses.some((t) => t.id === id),
        );
      } catch (err) {
        console.error("Gemini kaba eleme başarısız, ilk 7 tez seçiliyor:", err);
        selectedThesisIds = uniqueTheses.slice(0, 7).map((t) => t.id);
      }
    }

    // Adım 5: Seçilen tezlerin detaylarını (özetlerini) çekme
    console.log(
      `[Originality Analysis] Tez detayları çekiliyor: ${selectedThesisIds.join(", ")}`,
    );
    const detailsList = await Promise.all(
      selectedThesisIds.map((id) => fetchThesisDetails(id)),
    );
    const validDetails = detailsList.filter(
      (d): d is NonNullable<typeof d> => d !== null,
    );

    let tezaraResults;

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "YÜKSEK" as const,
        overlapTable: [],
        strategicRecommendations:
          "Literatür taramasında doğrudan çakışan veya yakın ilişki kuran bir tez tespit edilmemiştir. Araştırma tasarımınızın özgünlüğü oldukça yüksek görünmektedir. Bu özgünlüğü korumak için metodolojik derinliğinizi ve kuramsal çerçevenizi güçlendirmeye devam etmeniz önerilir.",
      };
    } else {
      console.log(
        "[Originality Analysis] 4 eksenli çakışma analizi yapılıyor...",
      );
      const analysisSystemInstruction = `
You are a senior academic committee evaluator. Your job is to compare the target thesis matrix against a list of literature theses on 4 axes:
1. Subject (Konu)
2. Theory (Teori)
3. Methodology (Metodoloji)
4. Context (Mekansal/Tarihsel Sınırlar - Bağlam)

For each literature thesis, you must evaluate these 4 axes and assign a comparison value for each axis: "ÇAKIŞIYOR" (Overlaps), "KISMEN ÇAKIŞIYOR" (Partially Overlaps), or "FARKLI" (Different).
Then, you must decide the originality level of the target thesis relative to that literature thesis: "YÜKSEK" (High), "ORTA" (Medium), or "DÜŞÜK" (Low).

<critical_rules>
- TEORİ KURALI DİSİPLİNİ: Eğer bir literatür tezi ile hedef tezin 'Konu' (Subject) ve 'Metodoloji' (Methodology) bileşenleri %100 ÇAKIŞIYOR olsa bile, eğer 'Teori' (Theory/Kuramsal çerçeve) ekseni "FARKLI" (Different) ise, o tezin özgünlük seviyesi (originalityLevel) kesinlikle "YÜKSEK" (High) olarak atanmalıdır. Bu kuralı asla esnetmeyin.
</constraints>

Additionally, you must determine the overall originality badge for the entire thesis work ("YÜKSEK", "ORTA", or "DÜŞÜK") and provide strategic academic recommendations for the student to maintain/enhance their originality.
All outputs must be in Turkish.
Respond ONLY with valid JSON matching the schema.
`;

      const analysisPrompt = `
Hedef Tez Matrisi:
- Başlık: ${calismaBasligi}
- Araştırma Sorusu: ${arastirmaSorusu}
- Temel İddia: ${temelIddia}
- Kuramsal Çerçeve: ${kuramsalCerceve}
- Metodoloji: ${metodoloji}
- Tarihsel/Mekansal Sınırlar: ${tarihselMekansalSinirlar}

Karşılaştırılacak Tezlerin Detayları (Özetleri ile birlikte):
${JSON.stringify(
  validDetails.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author,
    university: t.university,
    year: t.year,
    thesisType: t.thesisType,
    department: t.department,
    abstract: t.abstract,
  })),
)}

Lütfen bu verileri karşılaştırarak her bir tez için 4 eksenli analizi yapın ve genel özgünlük raporunu oluşturun.
TEORİ KURALI DİSİPLİNİ'ni uygulamayı unutmayın.
`;

      const analysisResult = await generateStructuredContent(
        "gemini-3.1-flash-lite",
        analysisSystemInstruction,
        analysisPrompt,
        analysisResultSchema,
      );

      // Kod tarafında Teori Kuralı Disiplini kontrolünü zorlama (Safety guard)
      const adjustedOverlapTable = analysisResult.overlapTable.map((item) => {
        if (item.axes.theory === "FARKLI") {
          return {
            ...item,
            originalityLevel: "YÜKSEK" as const,
          };
        }
        return item;
      });

      let adjustedBadge = analysisResult.originalityBadge;
      const hasLowOrMedium = adjustedOverlapTable.some(
        (t) => t.originalityLevel === "DÜŞÜK" || t.originalityLevel === "ORTA",
      );
      if (!hasLowOrMedium && adjustedOverlapTable.length > 0) {
        adjustedBadge = "YÜKSEK" as const;
      }

      tezaraResults = {
        originalityBadge: adjustedBadge,
        overlapTable: adjustedOverlapTable,
        strategicRecommendations: analysisResult.strategicRecommendations,
      };
    }

    // Adım 6: Raporu kaydetme ve adımı güncelleme
    console.log("[Originality Analysis] Sonuçlar veri tabanına yazılıyor...");
    await db
      .insert(originalityReports)
      .values({
        userId,
        tavilyResults: tavilyEvaluation,
        tezaraResults,
      })
      .onConflictDoUpdate({
        target: originalityReports.userId,
        set: {
          tavilyResults: tavilyEvaluation,
          tezaraResults,
          updatedAt: new Date(),
        },
      });

    await db
      .update(users)
      .set({ onboardingStep: "originality_report_completed" })
      .where(eq(users.id, userId));

    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("startOriginalityAnalysisAction failed:", err);
    return {
      error: `Özgünlük analizi sırasında bir hata oluştu: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}

/**
 * Kullanıcının veri tabanında kayıtlı olan özgünlük raporunu getirir.
 */
export async function getStoredOriginalityReportAction() {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const [report] = await db
      .select()
      .from(originalityReports)
      .where(eq(originalityReports.userId, session.userId));

    if (!report) {
      return { error: "Henüz özgünlük raporu oluşturulmamış." };
    }

    return {
      success: true,
      data: {
        tavilyResults: report.tavilyResults,
        tezaraResults: report.tezaraResults,
      },
    };
  } catch (err) {
    console.error("getStoredOriginalityReportAction failed:", err);
    return { error: "Özgünlük raporu yüklenirken bir hata oluştu." };
  }
}

/**
 * Onboarding adımını tamamen "completed" olarak günceller.
 */
export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    await db
      .update(users)
      .set({ onboardingStep: "completed" })
      .where(eq(users.id, session.userId));

    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("completeOnboardingAction failed:", err);
    return { error: "Onboarding tamamlanırken bir hata oluştu." };
  }
}
