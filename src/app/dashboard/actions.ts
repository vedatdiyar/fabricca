"use server";

import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { eq } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const queryExtractionSchema = z.object({
  englishQueries: z
    .array(z.string())
    .min(3)
    .max(3)
    .describe(
      "Semantic Scholar API araması için en fazla 2-3 kelimeden oluşan, bağlaç (and, in, of) içermeyen parça parça 3 adet İngilizce arama terimi kombinasyonu.",
    ),
  turkishKeywords: z
    .array(z.string())
    .min(4)
    .max(4)
    .describe(
      "DergiPark OAI-PMH XML verilerini yerelde filtrelemek için kullanılacak, ek almamış, yalın halde 4 adet Türkçe tekil anahtar kelime.",
    ),
});

export interface ThesisCoreData {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
}

export interface GetThesisCoreResult {
  success: boolean;
  data?: ThesisCoreData | null;
  error?: string;
}

export interface LiteratureRecommendation {
  paperId?: string;
  title: string;
  authors: string;
  year: string;
  relevance: string;
  url?: string;
  citationCount?: number;
  source?: "DergiPark" | "Semantic Scholar";
  lang?: "TR" | "EN";
}

export interface RecommendationsResult {
  success: boolean;
  recommendations?: LiteratureRecommendation[];
  error?: string;
}

/**
 * Helper to extract raw text content from multi-format OAI-PMH XML fields (strings, objects, or arrays).
 */
function extractText(field: any): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    return field.map(extractText).join(" / ");
  }
  if (typeof field === "object") {
    return field["#text"] || "";
  }
  return String(field);
}

/**
 * Server Action to retrieve the thesis core parameters (Thesis Constitution) from Neon PostgreSQL.
 * Since this is a single-user system, we fetch the first (and only) row. We accept userId to satisfy
 * user requirements, logging it dynamically or utilizing it for future multi-tenant expansions.
 */
export async function getThesisCoreAction(
  userId?: string,
): Promise<GetThesisCoreResult> {
  try {
    if (userId) {
      console.log(
        `[getThesisCoreAction] Fetching thesis core for user: ${userId}`,
      );
    }

    const [core] = await db.select().from(thesisCore).limit(1);

    if (!core) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        title: core.title,
        researchQuestion: core.researchQuestion,
        argument: core.argument,
        methodology: core.methodology,
      },
    };
  } catch (error: any) {
    console.error("getThesisCoreAction Error:", error);
    return {
      success: false,
      error: error.message || "Tez anayasası yüklenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to generate highly tailored academic literature recommendations.
 * Utilizes a strict "Fetch & Curate" (Arka Planda Araştır -> İncele -> Sadece Okeylenen Gerçek Veriyi UI'da Göster) mimarisi.
 * Canlı veriler alınamadığında doğrudan connection failure döner.
 */
export async function getAcademicRecommendationsAction(
  title: string,
  researchQuestion: string,
  argument: string,
  methodology: string,
): Promise<RecommendationsResult> {
  try {
    // Step 1: Check existing database cache first
    const [core] = await db.select().from(thesisCore).limit(1);
    if (!core) {
      return {
        success: false,
        error:
          "Tez anayasası bulunamadı. Lütfen Tez Anayasası'nı tamamlayın.",
      };
    }

    if (core.academicRecommendations) {
      try {
        const parsed = JSON.parse(core.academicRecommendations);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(
            "[getAcademicRecommendationsAction] Loaded recommendations from Neon PostgreSQL database cache.",
          );
          return {
            success: true,
            recommendations: parsed,
          };
        }
      } catch (parseError) {
        console.error(
          "[getAcademicRecommendationsAction] Failed to parse recommendations from DB:",
          parseError,
        );
      }
    }

    // Step 2: Database cache is empty. Run full retrieval pipeline
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Extract English short query options and Turkish filtering keywords
    const extractPrompt = `TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}`;

    const extractResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: extractPrompt,
      config: {
        systemInstruction:
          "Sen girdi olarak verilen Tez Başlığı, Araştırma Sorusu ve Ana Argüman metinlerinden en efektif akademik arama terimlerini çıkaran titiz bir Kıdemli Siyaset Bilimi kütüphanecisisin. KATI KURAL: Üreteceğin 3 adet 'englishQueries' ve 4 adet 'turkishKeywords' öğelerinden en az biri mutlaka ana argümanda geçen kuramsal teorisyenlerin isimlerini ('Harvey', 'Bourdieu', 'Standing') içermeli, diğerleri ise doğrudan 'prekarizasyon/precarity', 'kutuplaşma/polarization' ve 'gelir dağılımı/inequality' kavramları ile Türkiye ('Turkey') coğrafyasını harmanlamalıdır. Uzun cümleler veya jenerik, odak dışı kelimeler üretilmesi kesinlikle yasaktır.",
        temperature: 1,
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(queryExtractionSchema as any),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    let extracted: { englishQueries: string[]; turkishKeywords: string[] } = {
      englishQueries: [],
      turkishKeywords: [],
    };
    try {
      const cleanExtractText = (extractResponse.text || "").trim();
      const parsedJson = JSON.parse(cleanExtractText);
      const validated = queryExtractionSchema.parse(parsedJson);
      extracted = {
        englishQueries: validated.englishQueries,
        turkishKeywords: validated.turkishKeywords,
      };
    } catch (err) {
      console.error(
        "[getAcademicRecommendationsAction] Extract queries parsing error or validation failure:",
        err,
      );
      const words = title.split(" ").filter(Boolean);
      extracted = {
        englishQueries: [
          (words[0] || "precarity") + " Turkey",
          "precarity Turkey",
          "class polarization Turkey",
        ],
        turkishKeywords: [
          words[0] || "prekarizasyon",
          words[1] || "kutuplaşma",
          words[2] || "gelir",
          "prekarizasyon",
        ],
      };
    }

    const englishQueries = extracted.englishQueries || [];
    const turkishKeywords = extracted.turkishKeywords || [];
    console.log(
      `[getAcademicRecommendationsAction] Extracted englishQueries: ${JSON.stringify(englishQueries)}, turkishKeywords: ${JSON.stringify(turkishKeywords)}`,
    );

    // Fetch from DergiPark OAI-PMH official public endpoint
    let dergiParkPapers: any[] = [];
    try {
      const dergiParkUrl = `https://dergipark.org.tr/api/public/oai/?verb=ListRecords&metadataPrefix=oai_dc`;
      const dpRes = await fetch(dergiParkUrl, {
        method: "GET",
      });

      console.log("[Teşhis - DergiPark OAI-PMH Status]:", dpRes.status);
      const dpXml = await dpRes.text();
      console.log(
        "[Teşhis - DergiPark OAI-PMH Response]:",
        dpXml.slice(0, 200),
      );

      if (dpRes.ok) {
        const parser = new XMLParser({ ignoreAttributes: false });
        const jsonObj = parser.parse(dpXml);
        const records = jsonObj["OAI-PMH"]?.ListRecords?.record || [];

        if (Array.isArray(records) && records.length > 0) {
          const parsedRecords = records.map((rec: any) => {
            const dc = rec.metadata?.["oai_dc:dc"] || {};
            const titleText = extractText(dc["dc:title"]);
            const creators = dc["dc:creator"];
            const authors = Array.isArray(creators)
              ? creators.map(extractText).join(", ")
              : extractText(creators) || "Belirtilmemiş";

            const dateVal = extractText(dc["dc:date"]);
            const year = dateVal
              ? dateVal.split("-")[0]
              : new Date().getFullYear().toString();

            const identifiers = dc["dc:identifier"];
            let url = "";
            if (Array.isArray(identifiers)) {
              url =
                identifiers.find((id: any) => {
                  const s = extractText(id);
                  return s.startsWith("http://") || s.startsWith("https://");
                }) || "";
            } else {
              url = extractText(identifiers);
            }
            if (!url) {
              url = `https://dergipark.org.tr/tr/pub/search?q=${encodeURIComponent(turkishKeywords.join(" "))}`;
            }

            const abstract = extractText(dc["dc:description"]);

            return {
              paperId: String(
                rec.header?.identifier ||
                  Math.random().toString(36).substr(2, 9),
              ),
              title: titleText,
              authors,
              year,
              url,
              abstract,
              source: "DergiPark" as const,
              lang: "TR" as const,
            };
          });

          // In-memory filter using Turkish keywords
          const lowerKeywords = turkishKeywords.map((k) =>
            k.toLowerCase().trim(),
          );
          let filtered = parsedRecords.filter((rec: any) => {
            const titleLower = rec.title.toLowerCase();
            const abstractLower = rec.abstract.toLowerCase();
            return lowerKeywords.some(
              (kw) => titleLower.includes(kw) || abstractLower.includes(kw),
            );
          });

          // Fallback if filter leaves 0 records
          if (filtered.length === 0) {
            console.log(
              "[getAcademicRecommendationsAction] OAI-PMH keyword match is empty, loading top 12 general records.",
            );
            filtered = parsedRecords.slice(0, 12);
          }

          dergiParkPapers = filtered;
          console.log(
            `[getAcademicRecommendationsAction] Successfully processed ${dergiParkPapers.length} papers from DergiPark OAI-PMH.`,
          );
        }
      } else {
        console.error(
          "[Teşhis - DergiPark OAI-PMH Error XML/Text]:",
          dpXml.slice(0, 200),
        );
      }
    } catch (apiErr: any) {
      console.error("[Teşhis - DergiPark OAI-PMH Exception]:", apiErr);
    }

    // Parallel fetch from Semantic Scholar Bulk Search using atomized queries
    let semanticScholarPapers: any[] = [];
    if (englishQueries.length > 0) {
      try {
        const s2Promises = englishQueries.map(async (query: string) => {
          try {
            const s2Url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(query)}&fields=paperId,title,url,abstract,citationCount,authors,year`;
            const s2Res = await fetch(s2Url, {
              method: "GET",
              headers: { Accept: "application/json" },
            });
            console.log(
              `[Teşhis - Semantic Scholar Status for "${query}"]:`,
              s2Res.status,
            );
            const s2Text = await s2Res.text();
            if (s2Res.ok) {
              const s2Data = JSON.parse(s2Text);
              return s2Data.data || [];
            } else {
              console.error(
                `[Teşhis - Semantic Scholar Error for "${query}"]:`,
                s2Text.slice(0, 200),
              );
              return [];
            }
          } catch (err: any) {
            console.error(
              `[Teşhis - Semantic Scholar Exception for "${query}"]:`,
              err,
            );
            return [];
          }
        });

        const s2ResultsArray = await Promise.all(s2Promises);
        const s2PapersMap = new Map<string, any>();
        for (const papers of s2ResultsArray) {
          for (const p of papers) {
            if (p.paperId) {
              s2PapersMap.set(p.paperId, p);
            }
          }
        }

        semanticScholarPapers = Array.from(s2PapersMap.values()).map(
          (p: any) => ({
            paperId: p.paperId || Math.random().toString(36).substr(2, 9),
            title: p.title || "Untitled Paper",
            url: p.url || "",
            abstract: p.abstract || "",
            citationCount:
              typeof p.citationCount === "number" ? p.citationCount : 0,
            authors: Array.isArray(p.authors)
              ? p.authors
                  .map((a: any) =>
                    typeof a === "object" && a?.name ? a.name : String(a),
                  )
                  .join(", ")
              : String(p.authors || "Unknown"),
            year: p.year ? String(p.year) : new Date().getFullYear().toString(),
            source: "Semantic Scholar" as const,
            lang: "EN" as const,
          }),
        );
        console.log(
          `[getAcademicRecommendationsAction] Successfully gathered ${semanticScholarPapers.length} unique papers from Semantic Scholar.`,
        );
      } catch (s2Err) {
        console.error(
          "[getAcademicRecommendationsAction] Semantic Scholar bulk gathering error:",
          s2Err,
        );
      }
    }

    // Combine candidate pools
    const mergedPool = [...dergiParkPapers, ...semanticScholarPapers];

    // If both APIs are down/empty, return connection failure immediately.
    if (mergedPool.length === 0) {
      console.log(
        "[getAcademicRecommendationsAction] Merged candidates list is empty. Returning API_CONNECTION_FAILURE.",
      );
      return {
        success: false,
        error: "API_CONNECTION_FAILURE",
      };
    }

    // Curate using Gemini Academic Jury
    const jurySystemPrompt = `
Sen Siyaset Bilimi, Politik Sosyoloji ve Uluslararası İlişkiler alanlarında uzman, son derece seçkin ve analitik düşünen bir Akademik Jüri / Danışman Profesörsün.
Önünde kullanıcının aktif tez anayasası ve hem DergiPark (TR) hem de Semantic Scholar (EN) kaynaklarından toplanmış tamamen GERÇEK aday akademik makaleler var.

Görevin, YALNIZCA sana sunulan GERÇEK ADAY MAKALELER HAVUZU içinden, tez anayasasına en uygun, en güçlü ve en uyumlu katkıyı sağlayacak toplam 6 (altı) adet makaleyi seçmek ve küratörlük yapmaktır.

KAFANDAN HİÇBİR YENİ MAKALE, YAZAR, YIL VEYA URL TÜRETMEYECEKSİN/UYDURMAYACAKSIN. Sadece sunulan havuzdaki nesneleri seçeceksin. API veya havuzdan gelen orijinal başlık, yazar, yıl, paperId ve URL bilgilerini ASLA DEĞİŞTİRME, manipüle etme, sahte link/metin türetme.

KRİTİK DENGELİ LİSTELEME KURALI:
- Seçtiğin 6 makalenin en az 3 tanesi (%50'si) kesinlikle Türkçe ("lang": "TR" ve "source": "DergiPark") kaynaklarından olmalıdır. Geri kalanı İngilizce ("lang": "EN" ve "source": "Semantic Scholar") kaynaklarından olmalıdır. Havuzdaki TR/EN oranının dengesi kusursuz olmalıdır. (Eğer havuzda yeterince Türkçe veya İngilizce makale yoksa, elindeki tüm adaylar içinden tez anayasasına en uygun olanları uydurma yapmadan seç.)

Her seçilen makale için başlık, url, citationCount, source, lang ve Türkçe olarak 2-3 cümlelik çok güçlü bir entegrasyon gerekçesi ("relevance") üret.

Yanıtını kesinlikle aşağıdaki JSON formatında bir liste olarak vermelisin:
[
  {
    "paperId": "Aday listeden aynen kopyalanacak paperId",
    "title": "Aday listeden aynen kopyalanacak Başlık",
    "authors": "Aday listeden aynen kopyalanacak Yazar(lar)",
    "year": "Aday listeden aynen kopyalanacak Yıl",
    "url": "Aday listeden aynen kopyalanacak URL",
    "citationCount": Aday listeden aynen kopyalanacak Atıf sayısı veya 0,
    "source": "DergiPark" veya "Semantic Scholar",
    "lang": "TR" veya "EN",
    "relevance": "Seçilen makalenin tezin ana argümanına ve metodolojisine nasıl bir radikal ve uyumlu katkı sağlayacağı, tezde nasıl konumlandırılacağı (Türkçe olarak 2-3 cümleyle açıklanmalıdır)"
  }
]

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve başka hiçbir metin içermemelidir. Markdown kod bloğu (\`\`\`json vb.) kullanma, sadece saf JSON döndür.
`;

    const juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

BİRLEŞİK ADAY MAKALELER HAVUZU (Sadece Buradan Seçim Yapabilirsin!):
${JSON.stringify(mergedPool, null, 2)}

Lütfen bu birleşik havuzdan kurallara tam uyarak (en iyi 6 makaleyi) seç ve istenen JSON formatında döndür.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemPrompt,
        temperature: 1,
        responseMimeType: "application/json",
      },
    });

    let cleanText = response.text || "";
    cleanText = cleanText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
    }

    const recommendations = JSON.parse(cleanText);

    // Save recommendations back to Neon PostgreSQL database cache
    await db
      .update(thesisCore)
      .set({ academicRecommendations: JSON.stringify(recommendations) })
      .where(eq(thesisCore.id, core.id));

    return {
      success: true,
      recommendations,
    };
  } catch (error: any) {
    console.error("getAcademicRecommendationsAction Error:", error);
    return {
      success: false,
      error: error.message || "Tavsiyeler üretilirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to search and validate NEW literature recommendations,
 * deduplicating them against existing database recommendations by paperId and title,
 * and curating them using Fetch & Curate framework, completely banning hallucinations.
 */
export async function discoverNewRecommendationsAction(
  title: string,
  researchQuestion: string,
  argument: string,
  methodology: string,
): Promise<RecommendationsResult> {
  try {
    const [core] = await db.select().from(thesisCore).limit(1);
    if (!core) {
      return {
        success: false,
        error:
          "Tez anayasası bulunamadı. Lütfen Tez Anayasası'nı tamamlayın.",
      };
    }

    // Parse existing recommendations from database
    let existingRecs: LiteratureRecommendation[] = [];
    if (core.academicRecommendations) {
      try {
        const parsed = JSON.parse(core.academicRecommendations);
        if (Array.isArray(parsed)) {
          existingRecs = parsed;
        }
      } catch (parseError) {
        console.error(
          "[discoverNewRecommendationsAction] Failed to parse existing recommendations:",
          parseError,
        );
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Extract English short query options and Turkish filtering keywords
    const extractPrompt = `TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}`;

    const extractResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: extractPrompt,
      config: {
        systemInstruction:
          "Sen girdi olarak verilen Tez Başlığı, Araştırma Sorusu ve Ana Argüman metinlerinden en efektif akademik arama terimlerini çıkaran titiz bir Kıdemli Siyaset Bilimi kütüphanecisisin. KATI KURAL: Üreteceğin 3 adet 'englishQueries' ve 4 adet 'turkishKeywords' öğelerinden en az biri mutlaka ana argümanda geçen kuramsal teorisyenlerin isimlerini ('Harvey', 'Bourdieu', 'Standing') içermeli, diğerleri ise doğrudan 'prekarizasyon/precarity', 'kutuplaşma/polarization' ve 'gelir dağılımı/inequality' kavramları ile Türkiye ('Turkey') coğrafyasını harmanlamalıdır. Uzun cümleler veya jenerik, odak dışı kelimeler üretilmesi kesinlikle yasaktır.",
        temperature: 1,
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(queryExtractionSchema as any),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    let extracted: { englishQueries: string[]; turkishKeywords: string[] } = {
      englishQueries: [],
      turkishKeywords: [],
    };
    try {
      const cleanExtractText = (extractResponse.text || "").trim();
      const parsedJson = JSON.parse(cleanExtractText);
      const validated = queryExtractionSchema.parse(parsedJson);
      extracted = {
        englishQueries: validated.englishQueries,
        turkishKeywords: validated.turkishKeywords,
      };
    } catch (err) {
      console.error(
        "[discoverNewRecommendationsAction] Extract queries parsing error or validation failure:",
        err,
      );
      const words = title.split(" ").filter(Boolean);
      extracted = {
        englishQueries: [
          (words[0] || "precarity") + " Turkey",
          "precarity Turkey",
          "class polarization Turkey",
        ],
        turkishKeywords: [
          words[0] || "prekarizasyon",
          words[1] || "kutuplaşma",
          words[2] || "gelir",
          "prekarizasyon",
        ],
      };
    }

    const englishQueries = extracted.englishQueries || [];
    const turkishKeywords = extracted.turkishKeywords || [];

    // Fetch from DergiPark OAI-PMH official public endpoint
    let dergiParkPapers: any[] = [];
    try {
      const dergiParkUrl = `https://dergipark.org.tr/api/public/oai/?verb=ListRecords&metadataPrefix=oai_dc`;
      const dpRes = await fetch(dergiParkUrl, {
        method: "GET",
      });

      console.log("[Teşhis - DergiPark OAI-PMH Status]:", dpRes.status);
      const dpXml = await dpRes.text();
      console.log(
        "[Teşhis - DergiPark OAI-PMH Response]:",
        dpXml.slice(0, 200),
      );

      if (dpRes.ok) {
        const parser = new XMLParser({ ignoreAttributes: false });
        const jsonObj = parser.parse(dpXml);
        const records = jsonObj["OAI-PMH"]?.ListRecords?.record || [];

        if (Array.isArray(records) && records.length > 0) {
          const parsedRecords = records.map((rec: any) => {
            const dc = rec.metadata?.["oai_dc:dc"] || {};
            const titleText = extractText(dc["dc:title"]);
            const creators = dc["dc:creator"];
            const authors = Array.isArray(creators)
              ? creators.map(extractText).join(", ")
              : extractText(creators) || "Belirtilmemiş";

            const dateVal = extractText(dc["dc:date"]);
            const year = dateVal
              ? dateVal.split("-")[0]
              : new Date().getFullYear().toString();

            const identifiers = dc["dc:identifier"];
            let url = "";
            if (Array.isArray(identifiers)) {
              url =
                identifiers.find((id: any) => {
                  const s = extractText(id);
                  return s.startsWith("http://") || s.startsWith("https://");
                }) || "";
            } else {
              url = extractText(identifiers);
            }
            if (!url) {
              url = `https://dergipark.org.tr/tr/pub/search?q=${encodeURIComponent(turkishKeywords.join(" "))}`;
            }

            const abstract = extractText(dc["dc:description"]);

            return {
              paperId: String(
                rec.header?.identifier ||
                  Math.random().toString(36).substr(2, 9),
              ),
              title: titleText,
              authors,
              year,
              url,
              abstract,
              source: "DergiPark" as const,
              lang: "TR" as const,
            };
          });

          // In-memory filter using Turkish keywords
          const lowerKeywords = turkishKeywords.map((k) =>
            k.toLowerCase().trim(),
          );
          let filtered = parsedRecords.filter((rec: any) => {
            const titleLower = rec.title.toLowerCase();
            const abstractLower = rec.abstract.toLowerCase();
            return lowerKeywords.some(
              (kw) => titleLower.includes(kw) || abstractLower.includes(kw),
            );
          });

          // Fallback if filter leaves 0 records
          if (filtered.length === 0) {
            console.log(
              "[discoverNewRecommendationsAction] OAI-PMH keyword match is empty, loading top 12 general records.",
            );
            filtered = parsedRecords.slice(0, 12);
          }

          dergiParkPapers = filtered;
          console.log(
            `[discoverNewRecommendationsAction] Successfully processed ${dergiParkPapers.length} papers from DergiPark OAI-PMH.`,
          );
        }
      } else {
        console.error(
          "[Teşhis - DergiPark OAI-PMH Error XML/Text]:",
          dpXml.slice(0, 200),
        );
      }
    } catch (apiErr: any) {
      console.error("[Teşhis - DergiPark OAI-PMH Exception]:", apiErr);
    }

    // Parallel fetch from Semantic Scholar
    let semanticScholarPapers: any[] = [];
    if (englishQueries.length > 0) {
      try {
        const s2Promises = englishQueries.map(async (query: string) => {
          try {
            const s2Url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(query)}&fields=paperId,title,url,abstract,citationCount,authors,year`;
            const s2Res = await fetch(s2Url, {
              method: "GET",
              headers: { Accept: "application/json" },
            });
            console.log(
              `[Teşhis - Semantic Scholar Status for "${query}"]:`,
              s2Res.status,
            );
            const s2Text = await s2Res.text();
            if (s2Res.ok) {
              const s2Data = JSON.parse(s2Text);
              return s2Data.data || [];
            } else {
              console.error(
                `[Teşhis - Semantic Scholar Error for "${query}"]:`,
                s2Text.slice(0, 200),
              );
              return [];
            }
          } catch (err: any) {
            console.error(
              `[Teşhis - Semantic Scholar Exception for "${query}"]:`,
              err,
            );
            return [];
          }
        });

        const s2ResultsArray = await Promise.all(s2Promises);
        const s2PapersMap = new Map<string, any>();
        for (const papers of s2ResultsArray) {
          for (const p of papers) {
            if (p.paperId) {
              s2PapersMap.set(p.paperId, p);
            }
          }
        }

        semanticScholarPapers = Array.from(s2PapersMap.values()).map(
          (p: any) => ({
            paperId: p.paperId || Math.random().toString(36).substr(2, 9),
            title: p.title || "Untitled Paper",
            url: p.url || "",
            abstract: p.abstract || "",
            citationCount:
              typeof p.citationCount === "number" ? p.citationCount : 0,
            authors: Array.isArray(p.authors)
              ? p.authors
                  .map((a: any) =>
                    typeof a === "object" && a?.name ? a.name : String(a),
                  )
                  .join(", ")
              : String(p.authors || "Unknown"),
            year: p.year ? String(p.year) : new Date().getFullYear().toString(),
            source: "Semantic Scholar" as const,
            lang: "EN" as const,
          }),
        );
      } catch (err) {
        console.error(
          "[discoverNewRecommendationsAction] Semantic Scholar fetch error:",
          err,
        );
      }
    }

    // Deduplicate against existing recommendations by title and paperId
    const existingPaperIds = new Set(
      existingRecs
        .map((r) => r.paperId)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    );
    const existingTitles = new Set(
      existingRecs.map((r) => r.title.toLowerCase().trim()),
    );

    const unseenDergiPark = dergiParkPapers.filter((p: any) => {
      const hasIdMatch = p.paperId && existingPaperIds.has(p.paperId);
      const hasTitleMatch =
        p.title && existingTitles.has(p.title.toLowerCase().trim());
      return !hasIdMatch && !hasTitleMatch;
    });

    const unseenSemanticScholar = semanticScholarPapers.filter((p: any) => {
      const hasIdMatch = p.paperId && existingPaperIds.has(p.paperId);
      const hasTitleMatch =
        p.title && existingTitles.has(p.title.toLowerCase().trim());
      return !hasIdMatch && !hasTitleMatch;
    });

    const mergedUnseen = [
      ...unseenDergiPark.slice(0, 5),
      ...unseenSemanticScholar.slice(0, 5),
    ];

    // If both APIs are down/empty, return connection failure directly.
    if (mergedUnseen.length === 0) {
      console.log(
        "[discoverNewRecommendationsAction] No unseen candidates retrieved. Returning API_CONNECTION_FAILURE.",
      );
      return {
        success: false,
        error: "API_CONNECTION_FAILURE",
      };
    }

    // Select 4 new recommendations purely from candidates pool
    const jurySystemPrompt = `
Sen Siyaset Bilimi, Politik Sosyoloji ve Uluslararası İlişkiler alanlarında uzman, son derece seçkin ve analitik düşünen bir Akademik Jüri / Danışman Profesörsün.
Önünde kullanıcının aktif tez anayasası ve hem DergiPark (TR) hem de Semantic Scholar (EN) kaynaklarından toplanmış yepyeni (daha önce eklenmemiş) akademik makaleler var.

Görevin, YALNIZCA sana sunulan YENİ ADAY MAKALELER listesi içinden, tez anayasasına en uygun, en güçlü ve en uyumlu katkıyı sağlayacak EN İYİ 4 TANESİNİ (mümkünse 2 Türkçe, 2 İngilizce şeklinde) seçip onaylamak ve gerekçelendirmektir.

KAFANDAN HİÇBİR YENİ MAKALE, YAZAR, YIL VEYA URL TÜRETMEYECEKSİN/UYDURMAYACAKSIN. Sadece sunulan havuzdaki nesneleri seçeceksin. API veya havuzdan gelen orijinal başlık, yazar, yıl, paperId ve URL bilgilerini ASLA DEĞİŞTİRMEYECEKSİN, tahrif etmeyeceksin.

Her seçilen makale için başlık, url, citationCount, source, lang ve Türkçe olarak 2-3 cümlelik çok güçlü bir entegrasyon gerekçesi ("relevance") üret.

Yanıtını kesinlikle aşağıdaki JSON formatında bir liste olarak vermelisin:
[
  {
    "paperId": "Aday listeden aynen kopyalanacak paperId",
    "title": "Aday listeden aynen kopyalanacak Başlık",
    "authors": "Aday listeden aynen kopyalanacak Yazar(lar)",
    "year": "Aday listeden aynen kopyalanacak Yıl",
    "url": "Aday listeden aynen kopyalanacak URL",
    "citationCount": Aday listeden aynen kopyalanacak Atıf sayısı veya 0,
    "source": "DergiPark" veya "Semantic Scholar",
    "lang": "TR" veya "EN",
    "relevance": "Seçilen makalenin tezin ana argümanına ve metodolojisine nasıl bir radikal ve uyumlu katkı sağlayacağı, tezde nasıl konumlandırılacağı (Türkçe olarak 2-3 cümleyle açıklanmalıdır)"
  }
]

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve başka hiçbir metin içermemelidir. Markdown kod bloğu (\`\`\`json vb.) kullanma, sadece saf JSON döndür.
`;

    const juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

YENİ ADAY MAKALELER (Sadece Buradan Seçebilirsin!):
${JSON.stringify(mergedUnseen, null, 2)}

Hali Hazırda Ekli Olan Makalelerin Başlıkları (Bunları Tekrar Seçme):
${JSON.stringify(Array.from(existingTitles), null, 2)}

Lütfen bu yepyeni aday makaleler arasından en uygun 4 yeni makaleyi seç ve istenen JSON formatında döndür.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemPrompt,
        temperature: 1,
        responseMimeType: "application/json",
      },
    });

    let cleanText = response.text || "";
    cleanText = cleanText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
    }

    const newRecommendations = JSON.parse(cleanText);

    // Filter duplicates
    const finalizedNewRecommendations = newRecommendations.filter(
      (newRec: any) => {
        const titleLower = (newRec.title || "").toLowerCase().trim();
        const isDuplicate =
          existingTitles.has(titleLower) ||
          (newRec.paperId && existingPaperIds.has(newRec.paperId));
        return !isDuplicate;
      },
    );

    const updatedRecommendations = [
      ...existingRecs,
      ...finalizedNewRecommendations,
    ];

    await db
      .update(thesisCore)
      .set({ academicRecommendations: JSON.stringify(updatedRecommendations) })
      .where(eq(thesisCore.id, core.id));

    return {
      success: true,
      recommendations: updatedRecommendations,
    };
  } catch (error: any) {
    console.error("discoverNewRecommendationsAction Error:", error);
    return {
      success: false,
      error: error.message || "Yeni tavsiyeler aranırken hata oluştu.",
    };
  }
}
