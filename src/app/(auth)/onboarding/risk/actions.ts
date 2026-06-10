"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { thesisMatrices, users, originalityReports } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { tavilySearch } from "@/lib/tavily";
import { extractRscTexts } from "@/lib/tezara";

export type OnboardingActionResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

export interface TezaraThesisSummary {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
}

export interface TezaraThesisDetails {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  abstract: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

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

const axesEnum = z.enum(["ÇAKIŞIYOR", "KISMEN", "ÖZGÜN"]);

const geminiAnalysisSchema = z.object({
  overlapTable: z.array(
    z.object({
      id: z.number(),
      axes: z.object({
        subject: axesEnum,
        theory: axesEnum,
        methodology: axesEnum,
        context: axesEnum,
      }),
    }),
  ),
  strategicRecommendations: z.string(),
});

/**
 * RSC stream formatındaki metinden tez bilgilerini regex kullanarak ayıklar.
 *
 * @param text - RSC ham yanıt metni
 * @returns Çözümlenmiş tez özetleri
 */
function parseRscThesesRegex(text: string): TezaraThesisSummary[] {
  const results: TezaraThesisSummary[] = [];
  const objectRegex = /\{"id":\s*\d+\s*,[^{}]+\}/g;
  let match;

  while ((match = objectRegex.exec(text)) !== null) {
    const objStr = match[0];
    if (
      (objStr.includes("title_original") ||
        objStr.includes("title_translated")) &&
      objStr.includes("author")
    ) {
      const idMatch = objStr.match(/"id"\s*:\s*(\d+)/);
      const titleMatch = objStr.match(
        /"title_(?:original|translated)"\s*:\s*"([^"]*)"/,
      );
      const authorMatch = objStr.match(/"author"\s*:\s*"([^"]*)"/);
      const universityMatch = objStr.match(/"university"\s*:\s*"([^"]*)"/);
      const yearMatch = objStr.match(/"year"\s*:\s*(\d+)/);
      const thesisTypeMatch = objStr.match(/"thesis_type"\s*:\s*"([^"]*)"/);
      const departmentMatch = objStr.match(/"department"\s*:\s*"([^"]*)"/);

      if (idMatch && titleMatch && authorMatch) {
        results.push({
          id: parseInt(idMatch[1], 10),
          title: titleMatch[1] || "",
          author: authorMatch[1] || "",
          university: universityMatch ? universityMatch[1] : "",
          year: yearMatch ? parseInt(yearMatch[1], 10) : 0,
          thesisType: thesisTypeMatch ? thesisTypeMatch[1] : "",
          department: departmentMatch ? departmentMatch[1] : "",
        });
      }
    }
  }
  return results;
}

/**
 * Tezara üzerinden tekil sayfa bazlı arama gerçekleştirir.
 *
 * @param query - İngilizce çapraz arama sorgusu
 * @param page - Sayfa numarası
 * @returns Bulunan tezlerin listesi
 */
async function searchTezaraPageCustom(
  query: string,
  page: number,
): Promise<TezaraThesisSummary[]> {
  try {
    const url = `https://tezara.org/search?q=${encodeURIComponent(query)}&page=${page}&advanced=true&_rsc=vusbg`;
    const response = await fetch(url, {
      headers: {
        rsc: "1",
        accept: "text/x-component",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.warn(`[Tezara Search] HTTP Hatası: ${response.status}`);
      return [];
    }

    const text = await response.text();
    return parseRscThesesRegex(text);
  } catch (err) {
    console.error("[Tezara Search] Arama hatası:", err);
    return [];
  }
}

/**
 * İngilizce çapraz arama sorgusu ile Tezara'yı 2 sayfa limitli olarak tarar.
 *
 * @param query - İngilizce çapraz arama sorgusu
 * @returns Çakışan tezlerin listesi (Maksimum 40 adet)
 */
async function searchTezaraCustom(
  query: string,
): Promise<TezaraThesisSummary[]> {
  console.log(`[Tezara Engine] Sorgu aranıyor: "${query}"`);
  const page1Results = await searchTezaraPageCustom(query, 1);

  if (page1Results.length < 20) {
    return page1Results;
  }

  const page2Results = await searchTezaraPageCustom(query, 2);
  return [...page1Results, ...page2Results].slice(0, 40);
}

/**
 * Tekil tez detaylarını RSC formatında çekip özet ve metadata bilgilerini ayrıştırır.
 *
 * @param id - Tez numarası (ID)
 * @returns Tez detayları nesnesi veya hata durumunda null
 */
async function fetchThesisDetailsCustom(
  id: number,
): Promise<TezaraThesisDetails | null> {
  try {
    const url = `https://tezara.org/theses/${id}?_rsc=vusbg`;
    const response = await fetch(url, {
      headers: {
        rsc: "1",
        accept: "text/x-component",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.warn(
        `[Tezara Details] Detay çekilemedi (${id}): ${response.status}`,
      );
      return null;
    }

    const text = await response.text();
    const refMap = extractRscTexts(text);

    let thesisObj: Record<string, any> | null = null;
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.includes("title_original") && line.includes('"thesis":{')) {
        const startIdx =
          line.indexOf('{"thesis":') !== -1
            ? line.indexOf('{"thesis":')
            : line.indexOf('{"id":');
        if (startIdx === -1) continue;

        let braceCount = 0;
        let endIdx = -1;
        for (let i = startIdx; i < line.length; i++) {
          if (line[i] === "{") braceCount++;
          else if (line[i] === "}") {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = line.substring(startIdx, endIdx + 1);
          try {
            const parsedJson = JSON.parse(jsonStr) as Record<string, any>;
            thesisObj = (parsedJson.thesis || parsedJson) as Record<
              string,
              any
            >;
            break;
          } catch {
            // continue
          }
        }
      }
    }

    if (!thesisObj) {
      return null;
    }

    // Özet Seçim Kuralı: İlk karşılaşılan bütünsel özet bloğunu al, ikinciyi pas geç.
    let abstract = "";
    if (
      thesisObj.abstract_original &&
      thesisObj.abstract_original.startsWith("$")
    ) {
      const refId = thesisObj.abstract_original.substring(1);
      abstract = refMap[refId] || "";
    }

    if (
      !abstract &&
      thesisObj.abstract_translated &&
      thesisObj.abstract_translated.startsWith("$")
    ) {
      const refId = thesisObj.abstract_translated.substring(1);
      abstract = refMap[refId] || "";
    }

    return {
      id: Number(thesisObj.id || id),
      title: String(
        thesisObj.title_original || thesisObj.title_translated || "",
      ),
      author: String(thesisObj.author || ""),
      university: String(thesisObj.university || ""),
      year: Number(thesisObj.year || 0),
      thesisType: String(thesisObj.thesis_type || ""),
      department: String(thesisObj.department || ""),
      abstract,
    };
  } catch (err) {
    console.error(`[Tezara Details] Tez detay alma hatası (${id}):`, err);
    return null;
  }
}

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
<role>
You are an expert academic advisor. Your job is to extract search queries from the user's thesis matrix.
</role>

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
        return await searchTezaraCustom(query);
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
<role>
You are a factual verification expert and academic advisor.
Analyze the internet search results for each query against the user's thesis claims.
</role>

<constraints>
- Generate a list of evaluated facts, stating whether they are verified ("Doğrulandı"), partially verified ("Kısmen Doğrulandı"), or unverified/caution required ("Doğrulanamadı/Dikkat"). Explain why briefly in Turkish.
- Choose the best source URL for each fact.
- Also generate an analytical, professional briefing note in Turkish summarizing the findings and historical/factual context.
- Respond ONLY with valid JSON matching the schema.
</constraints>
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
`;

    const tavilyEvaluation = await generateStructuredContent(
      "gemini-3.1-flash-lite",
      tavilyEvalSystemInstruction,
      tavilyEvalPrompt,
      tavilyEvaluationSchema,
    );

    // Adım 4: Tezara sonuçlarını süzme ve filtreleme
    const rawTheses: TezaraThesisSummary[] = [];
    for (const list of tezaraSearchResultsLists) {
      rawTheses.push(...list);
    }

    // ID bazında tekilleştirme
    const uniqueThesesMap = new Map<number, TezaraThesisSummary>();
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
<role>
You are an academic researcher. You are given a list of academic theses and a target thesis matrix.
Your job is to select the top 5 to 7 theses that are relevant or have any thematic, subject, methodological, or contextual closeness to the target thesis.
</role>

<constraints>
- Be extremely lenient and cautious during this sifting stage. Do NOT exclude theses that have thematic similarity or regional/period overlaps.
- Select up to 7 most relevant or closest theses.
- Respond ONLY with valid JSON matching the schema.
</constraints>
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

Please choose the top 5 to 7 thesis IDs that are the most closely related.
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
      selectedThesisIds.map((id) => fetchThesisDetailsCustom(id)),
    );
    const validDetails = detailsList.filter(
      (d): d is TezaraThesisDetails => d !== null,
    );

    let tezaraResults;

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "SIFIR RİSK" as const,
        overlapTable: [],
        strategicRecommendations:
          "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir. Araştırma tasarımınızın özgünlüğü maksimum seviyededir.",
      };
    } else {
      console.log(
        "[Originality Analysis] 4 eksenli çakışma analizi yapılıyor...",
      );
      const analysisSystemInstruction = `
<role>
You are a senior academic committee evaluator. Your job is to compare the target thesis matrix against a list of literature theses on 4 axes:
1. Subject (Konu)
2. Theory (Teori)
3. Methodology (Metodoloji)
4. Context (Mekansal/Tarihsel Sınırlar - Bağlam)

For each literature thesis, evaluate these 4 axes and assign a comparison value: "ÇAKIŞIYOR", "KISMEN", or "ÖZGÜN".
Additionally, you must provide strategic academic recommendations for the student to maintain or enhance their work's originality and navigate the identified overlap risks. All outputs must be in Turkish.
</role>

<constraints>
- "Daha çok okuyun", "Örneklemi genişletin", "Literatür taramasını derinleştirin" gibi klişe, içi boş akademik tavsiyeler vermek KESİNLİKLE YASAKTIR.
- Risk veya çakışma tespit ettiğin durumlarda doğrudan o tezin künyesini/yazarını hedef alarak saldırgan bir akademik savunma/konumlandırma tavsiyesi geliştir.
- Örnek Format: "[Yazar Adı] ([Yıl]) tarihli çalışmasında konuyu şu şekilde sınırlamıştır. Sizin çalışmanızın bu tezi aşması için, saha analizlerinde [hedef kavram] nüansını öne çıkararak tezin metodolojik sınırlarını şu yöne bükmeniz şarttır."
- Respond ONLY with valid JSON matching the schema.
</constraints>
`;

      const analysisPrompt = `
Hedef Tez Matrisi:
- Başlık: ${calismaBasligi}
- Araştırma Sorusu: ${arastirmaSorusu}
- Temel İddia: ${temelIddia}
- Kuramsal Çerçeve: ${kuramsalCerceve}
- Metodoloji: ${metodoloji}
- Tarihsel/Mekansal Sınırlar: ${tarihselMekansalSinirlar}

Karşılaştırılacak Tezlerin Detayları:
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
`;

      const geminiResult = await generateStructuredContent(
        "gemini-3.1-flash-lite",
        analysisSystemInstruction,
        analysisPrompt,
        geminiAnalysisSchema,
      );

      // Kod Seviyesinde Risk Hesaplama
      const scoreMap: Record<"ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN", number> = {
        ÇAKIŞIYOR: 0,
        KISMEN: 1,
        ÖZGÜN: 2,
      };

      const overlapTable = geminiResult.overlapTable.map((item) => {
        const detail = validDetails.find((d) => d.id === item.id);
        if (!detail) {
          throw new Error(
            `Kaba elemeden gelen tez detayı bulunamadı: ${item.id}`,
          );
        }

        const { subject, theory, methodology, context } = item.axes;
        let originalityLevel: "YÜKSEK RİSK" | "ORTA RİSK" | "DÜŞÜK RİSK";

        // Teori Kuralı: Teori ekseni = Özgün ise diğer eksenler çakışsa bile doğrudan DÜŞÜK RİSK.
        if (theory === "ÖZGÜN") {
          originalityLevel = "DÜŞÜK RİSK";
        }
        // Bağlam İstisnası: Sadece Bağlam Özgün ise doğrudan ORTA RİSK.
        else if (
          context === "ÖZGÜN" &&
          subject === "ÇAKIŞIYOR" &&
          theory === "ÇAKIŞIYOR" &&
          methodology === "ÇAKIŞIYOR"
        ) {
          originalityLevel = "ORTA RİSK";
        }
        // Skorlama Skalası (Toplam Puan)
        else {
          const totalScore =
            scoreMap[subject] +
            scoreMap[theory] +
            scoreMap[methodology] +
            scoreMap[context];

          if (totalScore <= 2) {
            originalityLevel = "YÜKSEK RİSK";
          } else if (totalScore <= 5) {
            originalityLevel = "ORTA RİSK";
          } else {
            originalityLevel = "DÜŞÜK RİSK";
          }
        }

        return {
          id: detail.id,
          title: detail.title,
          author: detail.author,
          university: detail.university,
          year: detail.year,
          thesisType: detail.thesisType,
          department: detail.department,
          axes: item.axes,
          originalityLevel,
        };
      });

      // Genel Sonuç Hiyerarşisi
      let originalityBadge:
        | "YÜKSEK RİSK"
        | "ORTA RİSK"
        | "DÜŞÜK RİSK"
        | "SIFIR RİSK";
      if (
        overlapTable.some((item) => item.originalityLevel === "YÜKSEK RİSK")
      ) {
        originalityBadge = "YÜKSEK RİSK";
      } else if (
        overlapTable.some((item) => item.originalityLevel === "ORTA RİSK")
      ) {
        originalityBadge = "ORTA RİSK";
      } else {
        originalityBadge = "DÜŞÜK RİSK";
      }

      tezaraResults = {
        originalityBadge,
        overlapTable,
        strategicRecommendations: geminiResult.strategicRecommendations,
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
