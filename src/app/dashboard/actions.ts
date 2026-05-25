"use server";

import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";

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
}

export interface RecommendationsResult {
  success: boolean;
  recommendations?: LiteratureRecommendation[];
  error?: string;
}

/**
 * Server Action to retrieve the thesis core parameters (Thesis Constitution) from Neon PostgreSQL.
 * Since this is a single-user system, we fetch the first (and only) row. We accept userId to satisfy
 * user requirements, logging it dynamically or utilizing it for future multi-tenant expansions.
 */
export async function getThesisCoreAction(userId?: string): Promise<GetThesisCoreResult> {
  try {
    if (userId) {
      console.log(`[getThesisCoreAction] Fetching thesis core for user: ${userId}`);
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
 * Server Action to generate 3 highly tailored academic literature recommendations.
 * Utilizes persistent Neon PostgreSQL database caching before hitting Semantic Scholar or Gemini.
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
        error: "Tez anayasası bulunamadı. Lütfen onboarding işlemini tamamlayın.",
      };
    }

    if (core.academicRecommendations) {
      try {
        const parsed = JSON.parse(core.academicRecommendations);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("[getAcademicRecommendationsAction] Loaded recommendations from Neon PostgreSQL database cache.");
          return {
            success: true,
            recommendations: parsed,
          };
        }
      } catch (parseError) {
        console.error("[getAcademicRecommendationsAction] Failed to parse recommendations from DB:", parseError);
      }
    }

    // Step 2: Database cache is empty. Run full retrieval pipeline
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error: "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Extract 3-4 most critical English academic keywords
    const extractPrompt = `
Görevin, kullanıcının tez başlığı, araştırma sorusu, ana argümanı ve metodolojisinden yola çıkarak, Semantic Scholar API'de arama yapmak için kullanılacak en fazla 3-4 kelimelik, İngilizce temiz bir akademik arama sorgusu (query) üretmendir.

TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

Yanıt Kuralları:
- Sadece arama kelimelerini aralarında boşluk bırakarak döndür (Örn: "neoliberalism class structure precariat Turkey").
- Kesinlikle tırnak işareti, noktalama işareti veya açıklayıcı metin ekleme.
- Arama kalitesini artırmak için terimlerin İngilizce akademik literatür karşılıklarını seç.
`;

    const extractResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: extractPrompt,
      config: {
        temperature: 0.2,
      },
    });

    const searchQuery = (extractResponse.text || "").trim().replace(/['"“”]/g, "");
    console.log(`[getAcademicRecommendationsAction] Extracted search query: "${searchQuery}"`);

    // Query Semantic Scholar Bulk Search endpoint
    let top5Papers: any[] = [];
    try {
      const url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(searchQuery)}&fields=paperId,title,url,abstract,citationCount,authors,year`;
      const apiRes = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        const papers = data.data || [];
        
        const sorted = papers
          .map((p: any) => ({
            paperId: p.paperId || "",
            title: p.title || "",
            url: p.url || "",
            abstract: p.abstract || "",
            citationCount: typeof p.citationCount === "number" ? p.citationCount : 0,
            authors: Array.isArray(p.authors)
              ? p.authors.map((a: any) => (typeof a === "object" && a?.name ? a.name : String(a))).join(", ")
              : String(p.authors || ""),
            year: p.year ? String(p.year) : "",
          }))
          .sort((a: any, b: any) => b.citationCount - a.citationCount);

        top5Papers = sorted.slice(0, 5);
        console.log(`[getAcademicRecommendationsAction] Fetched ${papers.length} papers from Semantic Scholar, top 5 selected.`);
      } else {
        console.error(`[getAcademicRecommendationsAction] Semantic Scholar API returned status ${apiRes.status}`);
      }
    } catch (apiErr) {
      console.error("[getAcademicRecommendationsAction] Semantic Scholar fetch error:", apiErr);
    }

    // Gemini Academic Jury validation filter
    const jurySystemPrompt = `
Sen Siyaset Bilimi, Politik Sosyoloji ve Uluslararası İlişkiler alanlarında uzman, son derece seçkin ve analitik düşünen bir Akademik Jüri / Danışman Profesörsün.
Önünde kullanıcının aktif tez anayasası ve Semantic Scholar'dan çekilmiş gerçek makaleler var. Bu gerçek makaleler arasından kullanıcının argümanına ve metodolojisine en radikal, en uyumlu katkıyı sağlayacak EN İYİ 3 TANESİNİ seç, onay ver ve bunları başlık, url, citationCount ve kısa bir entegrasyon gerekçesi içerecek şekilde temiz bir JSON dizisi olarak döndür.

Yanıtını kesinlikle aşağıdaki JSON formatında bir liste olarak vermelisin:
[
  {
    "paperId": "Makalenin paperId'si",
    "title": "Makale veya Kitap Başlığı",
    "authors": "Yazar(lar)",
    "year": "Yıl",
    "url": "Makalenin URL'si veya boş string",
    "citationCount": Atıf sayısı (sayı olarak),
    "relevance": "Seçilen makalenin tezin ana argümanına ve metodolojisine nasıl bir radikal ve uyumlu katkı sağlayacağı, tezde nasıl konumlandırılacağı (Türkçe olarak 2-3 cümleyle açıklanmalıdır)"
  }
]

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve başka hiçbir metin içermemelidir. Markdown kod bloğu (\`\`\`json vb.) kullanma, sadece saf JSON döndür.
`;

    let juryPrompt = "";
    if (top5Papers.length > 0) {
      juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

SEMANTIC SCHOLAR'DAN ÇEKİLEN GERÇEK MAKALELER:
${JSON.stringify(top5Papers, null, 2)}

Lütfen bu gerçek makaleler arasından tez anayasasına en uygun, en güçlü ve en uyumlu katkıyı sağlayacak EN İYİ 3 TANESİNİ seç ve istenen JSON formatında döndür.
`;
    } else {
      juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

NOT: Semantic Scholar araması sonuç döndürmedi. Lütfen tezin kavramsal çelişkilerini aşmasına ve literatürde sağlam bir temele oturmasına yardımcı olacak en iyi 3 gerçek akademik makale veya kitap önerisini doğrudan kendin üret ve istenen JSON formatında döndür.
`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemPrompt,
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    });

    let cleanText = response.text || "";
    cleanText = cleanText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const recommendations = JSON.parse(cleanText);

    // Save recommendations back to Neon PostgreSQL database for persistence
    await db.update(thesisCore)
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
 * and appending the newly approved 3 papers to the database cache array.
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
        error: "Tez anayasası bulunamadı. Lütfen onboarding işlemini tamamlayın.",
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
        console.error("[discoverNewRecommendationsAction] Failed to parse existing recommendations:", parseError);
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error: "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Step 1: Extract English academic search terms
    const extractPrompt = `
Görevin, kullanıcının tez başlığı, araştırma sorusu, ana argümanı ve metodolojisinden yola çıkarak, Semantic Scholar API'de arama yapmak için kullanılacak en fazla 3-4 kelimelik, İngilizce temiz bir akademik arama sorgusu (query) üretmendir.

TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

Yanıt Kuralları:
- Sadece arama kelimelerini aralarında boşluk bırakarak döndür (Örn: "neoliberalism class structure precariat Turkey").
- Kesinlikle tırnak işareti, noktalama işareti veya açıklayıcı metin ekleme.
- Arama kalitesini artırmak için terimlerin İngilizce akademik literatür karşılıklarını seç.
`;

    const extractResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: extractPrompt,
      config: {
        temperature: 0.2,
      },
    });

    const searchQuery = (extractResponse.text || "").trim().replace(/['"“”]/g, "");
    console.log(`[discoverNewRecommendationsAction] Extracted search query: "${searchQuery}"`);

    // Step 2: Query Semantic Scholar Bulk Search endpoint
    let sortedPapers: any[] = [];
    try {
      const url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(searchQuery)}&fields=paperId,title,url,abstract,citationCount,authors,year`;
      const apiRes = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        const papers = data.data || [];
        
        sortedPapers = papers
          .map((p: any) => ({
            paperId: p.paperId || "",
            title: p.title || "",
            url: p.url || "",
            abstract: p.abstract || "",
            citationCount: typeof p.citationCount === "number" ? p.citationCount : 0,
            authors: Array.isArray(p.authors)
              ? p.authors.map((a: any) => (typeof a === "object" && a?.name ? a.name : String(a))).join(", ")
              : String(p.authors || ""),
            year: p.year ? String(p.year) : "",
          }))
          .sort((a: any, b: any) => b.citationCount - a.citationCount);
      } else {
        console.error(`[discoverNewRecommendationsAction] Semantic Scholar API returned status ${apiRes.status}`);
      }
    } catch (apiErr) {
      console.error("[discoverNewRecommendationsAction] Semantic Scholar fetch error:", apiErr);
    }

    // Step 3: Deduplicate against existing recommendations in the database
    const existingPaperIds = new Set(
      existingRecs
        .map(r => r.paperId)
        .filter((id): id is string => typeof id === "string" && id !== "")
    );
    const existingTitles = new Set(
      existingRecs.map(r => r.title.toLowerCase().trim())
    );

    const unseenPapers = sortedPapers.filter((p: any) => {
      const hasIdMatch = p.paperId && existingPaperIds.has(p.paperId);
      const hasTitleMatch = p.title && existingTitles.has(p.title.toLowerCase().trim());
      return !hasIdMatch && !hasTitleMatch;
    });

    const top5Unseen = unseenPapers.slice(0, 5);
    console.log(`[discoverNewRecommendationsAction] Found ${unseenPapers.length} unseen papers out of ${sortedPapers.length} total fetched. Top 5 selected.`);

    // Step 4: Gemini Academic Jury evaluation (filtering and selecting 3 new papers)
    const jurySystemPrompt = `
Sen Siyaset Bilimi, Politik Sosyoloji ve Uluslararası İlişkiler alanlarında uzman, son derece seçkin ve analitik düşünen bir Akademik Jüri / Danışman Profesörsün.
Önünde kullanıcının aktif tez anayasası ve Semantic Scholar'dan çekilmiş yepyeni (daha önce eklenmemiş) gerçek makaleler var. Bu gerçek makaleler arasından kullanıcının argümanına ve metodolojisine en radikal, en uyumlu katkıyı sağlayacak EN İYİ 3 TANESİNİ seç, onay ver ve bunları başlık, url, citationCount ve kısa bir entegrasyon gerekçesi içerecek şekilde temiz bir JSON dizisi olarak döndür.

Yanıtını kesinlikle aşağıdaki JSON formatında bir liste olarak vermelisin:
[
  {
    "paperId": "Makalenin paperId'si",
    "title": "Makale veya Kitap Başlığı",
    "authors": "Yazar(lar)",
    "year": "Yıl",
    "url": "Makalenin URL'si veya boş string",
    "citationCount": Atıf sayısı (sayı olarak),
    "relevance": "Seçilen makalenin tezin ana argümanına ve metodolojisine nasıl bir radikal ve uyumlu katkı sağlayacağı, tezde nasıl konumlandırılacağı (Türkçe olarak 2-3 cümleyle açıklanmalıdır)"
  }
]

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve başka hiçbir metin içermemelidir. Markdown kod bloğu (\`\`\`json vb.) kullanma, sadece saf JSON döndür.
`;

    let juryPrompt = "";
    if (top5Unseen.length > 0) {
      juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

YEPYENİ GERÇEK MAKALELER (DAHİL EDİLEBİLECEK ADAYLAR):
${JSON.stringify(top5Unseen, null, 2)}

Hali Hazırda Ekli Olan Makalelerin Başlıkları (Bunları Tekrar Seçme):
${JSON.stringify(Array.from(existingTitles), null, 2)}

Lütfen bu yepyeni aday makaleler arasından tez anayasasına en uygun, en güçlü ve en uyumlu katkıyı sağlayacak EN İYİ 3 TANESİNİ seç ve istenen JSON formatında döndür.
`;
    } else {
      juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

Hali Hazırda Ekli Olan Makalelerin Başlıkları (Mükerrerlik Oluşmaması İçin Kesinlikle Bunları Önerme):
${JSON.stringify(Array.from(existingTitles), null, 2)}

NOT: Arama sonuçlarında daha önce eklenmemiş yeni makale bulunamadı. Lütfen daha önce eklenmiş yukarıdaki makalelerden tamamen farklı olan, tezin kavramsal çelişkilerini aşmasına yardımcı olacak en iyi 3 gerçek akademik makale veya kitap önerisini DOĞRUDAN KENDİN üret ve istenen JSON formatında döndür.
`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemPrompt,
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    });

    let cleanText = response.text || "";
    cleanText = cleanText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const newRecommendations = JSON.parse(cleanText);

    // Filter out any potential duplicates generated by LLM as a double check
    const finalizedNewRecommendations = newRecommendations.filter((newRec: any) => {
      const titleLower = (newRec.title || "").toLowerCase().trim();
      const isDuplicate = existingTitles.has(titleLower) || (newRec.paperId && existingPaperIds.has(newRec.paperId));
      return !isDuplicate;
    });

    // Step 5: Append new recommendations to existing list (array push logic)
    const updatedRecommendations = [...existingRecs, ...finalizedNewRecommendations];

    // Save consolidated list back to Neon PostgreSQL
    await db.update(thesisCore)
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

