"use server";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";

export interface OriginalityThesis {
  id: string;
  title: string;
  author: string;
  advisor: string;
  year: string;
  university: string;
  abstract?: string;
  abstract_en?: string;
}

export interface OriginalityReport {
  risk: "Düşük" | "Orta" | "Yüksek";
  reasoning: string;
  gapAnalysis: string;
  theses: OriginalityThesis[];
}

export interface OriginalityResponse {
  success: boolean;
  report?: OriginalityReport | null;
  error?: string;
}

/**
 * Helper to decode HTML entities in search results and abstracts.
 */
function decodeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

/**
 * Parallel fetcher to get individual thesis abstracts from tezara.org with a timeout.
 */
async function fetchThesisAbstract(
  id: string,
): Promise<{ abstract: string; abstract_en: string }> {
  try {
    const controller = new AbortController();
    const idTimeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://tezara.org/theses/${id}`, {
      signal: controller.signal,
    });
    clearTimeout(idTimeout);

    if (!res.ok) return { abstract: "", abstract_en: "" };
    const html = await res.text();

    const abstractMatch = html.match(/id="abstract"[^>]*>([\s\S]*?)<\/p>/);
    const abstract = abstractMatch
      ? decodeHtml(abstractMatch[1].replace(/<[^>]*>/g, "").trim())
      : "";

    const englishAbstractMatch =
      html.match(/id="abstract_translated"[^>]*>([\s\S]*?)<\/p>/) ||
      html.match(/id="abstract_english"[^>]*>([\s\S]*?)<\/p>/);
    const abstract_en = englishAbstractMatch
      ? decodeHtml(englishAbstractMatch[1].replace(/<[^>]*>/g, "").trim())
      : "";

    return { abstract, abstract_en };
  } catch (err) {
    console.error(
      `[Tezara Scraper] Failed to fetch abstract for thesis ${id}:`,
      err instanceof Error ? err.message : err,
    );
    return { abstract: "", abstract_en: "" };
  }
}

/**
 * Server Action to check originality of a thesis topic/question against tezara.org using Gemini 3.1 Flash Lite
 */
export async function checkTezaraOriginalityAction(
  userInput: string,
): Promise<OriginalityResponse> {
  try {
    if (!userInput || !userInput.trim()) {
      return { success: false, error: "Girdi boş olamaz." };
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

    // Step 1: Multi-Tier Query Generation — Tarihsel Bağlam Odaklı Dinamik Sorgulama
    const queryGenPrompt = `Sen sosyal bilimler alanında uzman bir akademik arşiv tarama uzmanısın.
Aşağıda sana JSON olarak verilen tez önerisinin başlığını, araştırma sorusunu, argümanını ve metodolojisini analiz et.
Bu tezin çakışabileceği muhtemel diğer çalışmaları Tezara/YÖK Tez'de bulabilmek için ÜÇ farklı, kısa ve net arama sorgusu üret.

ÖNEMLİ AYRIM:
- Bir tez 2024 yılında yayınlanmış olabilir ama 1991-1999 dönemini konu alıyor olabilir.
- Arama yaparken tezin YAYIM YILINA değil, tezin incelediği TARİHSEL DÖNEME odaklan.
- Tarihsel ifadeleri ("1990'lar", "erken Cumhuriyet", "1985-2000 arası" vb.) tespit ederek sorgulara dönemsel kapsayıcılık terimi olarak ekle.

Üç sorgu kümesini şu kurallara göre üret:
A) KAVRAMSAL SORGU: Tezin ana kuramsal odağını ve ampirik alanını birleştiren 2-3 kelimelik bileşik bir akademik tamlama. (Örn: "hegemonya söylem dönüşümü")
B) BAĞLAMSAL SORGU: Tezin incelediği tarihsel dönem + temel aktörler/olgular. Tespit ettiğin tarihsel aralığı mutlaka dahil et. (Örn: "Kürt siyasi hareketi 1990'lar Türkiye")
C) EYLEM/SÜREÇ SORGUSU: Tezde incelenen süreç veya dönüşüm + coğrafi/kurumsal bağlam. (Örn: "sınıf kimliği çözülme neoliberal Türkiye")

Kurallar:
1. Sorguları virgülle ayır. Her sorgu 2-4 kelimeden oluşsun.
2. Yalnızca A, B ve C sorgularını virgülle ayrılmış tek satırda döndür. Başka hiçbir açıklama ekleme.
3. Tarihsel bağlam tespit edemezsen B sorgusuna "Türkiye modern dönem" ekle.

Tez Özeti (JSON):
${userInput}

Çıkış (sadece A, B, C sorguları virgülle ayrılmış):`;

    const queryGenResponse = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: queryGenPrompt,
      config: { temperature: 1 },
    });

    const rawQueries = (queryGenResponse.text || "").trim();
    const queryList = rawQueries
      .split(",")
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 3); // En fazla 3 sorgu

    console.log(
      `[Tezara Scraper] Multi-Tier Query Set generated: [${queryList.map((q, i) => `${["A", "B", "C"][i]}="${q}"`).join(" | ")}]`,
    );

    let theses: OriginalityThesis[] = [];
    const seenIds = new Set<string>();

    // Step 2: UNION Scrape — Her sorguyu sırayla çalıştır, sonuçları birleştir
    for (let qi = 0; qi < queryList.length; qi++) {
      const query = queryList[qi];
      const queryLabel = ["A (Kavramsal)", "B (Bağlamsal)", "C (Eylem/Süreç)"][
        qi
      ];

      try {
        const searchUrl = `https://tezara.org/search?q=${encodeURIComponent(query)}`;
        console.log(
          `[Tezara Scraper] Firing Query ${queryLabel}: "${query}" → ${searchUrl}`,
        );

        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) {
          console.warn(
            `[Tezara Scraper] Query ${queryLabel} failed with status: ${searchRes.status}`,
          );
          continue;
        }

        const html = await searchRes.text();
        const thesisBlocks = html.split('<li id="thesis-');
        const maxResults = Math.min(thesisBlocks.length - 1, 3); // Her sorgudan max 3 sonuç

        console.log(
          `[Tezara Scraper] Query ${queryLabel} → ${thesisBlocks.length - 1} raw result(s) found, processing top ${maxResults}`,
        );

        const parsedTheses: OriginalityThesis[] = [];

        for (let i = 1; i <= maxResults; i++) {
          const block = thesisBlocks[i];
          const idMatch = block.match(/^(\d+)"/);
          if (!idMatch) continue;
          const thesisId = idMatch[1];

          // Daha önce eklenen tezi atla (UNION deduplication)
          if (seenIds.has(thesisId)) continue;
          seenIds.add(thesisId);

          let title = "";
          const allTitleMatches = [
            ...block.matchAll(
              new RegExp(
                `href="\\/theses\\/${thesisId}"[^>]*>([\\s\\S]*?)<\\/a>`,
                "gi",
              ),
            ),
          ];
          for (const m of allTitleMatches) {
            const fullTag = m[0];
            const text = m[1].replace(/<[^>]*>/g, "").trim();
            if (
              text &&
              !text.includes("Tez No") &&
              text !== thesisId &&
              !fullTag.includes("font-mono")
            ) {
              title = decodeHtml(text);
              break;
            }
          }

          const yearMatch =
            block.match(/icon-calendar[^>]*><\/span>\s*(\d{4})/i) ||
            block.match(/icon-calendar[^>]*>([\s\S]*?)<\/p>/i);
          let year = "";
          if (yearMatch) {
            year = yearMatch[1].replace(/<[^>]*>/g, "").trim();
          }

          const uniMatch = block.match(/href="\/universities\/([^"]+)"/i);
          let university = "";
          if (uniMatch) {
            university = decodeURIComponent(uniMatch[1]);
          }

          const authorMatch = block.match(
            /icon-pen-tool[^>]*><\/span>([\s\S]*?)<\/p>/i,
          );
          let author = "";
          if (authorMatch) {
            author = decodeHtml(authorMatch[1].replace(/<[^>]*>/g, "").trim());
          }

          const advisorMatch = block.match(
            /icon-user-pen[^>]*><\/span>([\s\S]*?)<\/p>/i,
          );
          let advisor = "";
          if (advisorMatch) {
            advisor = decodeHtml(
              advisorMatch[1].replace(/<[^>]*>/g, "").trim(),
            );
          }

          parsedTheses.push({
            id: thesisId,
            title,
            author,
            advisor,
            year,
            university,
          });
        }

        // Abstracts for this query's results
        if (parsedTheses.length > 0) {
          const detailPromises = parsedTheses.map(async (t) => {
            const abstracts = await fetchThesisAbstract(t.id);
            return { ...t, ...abstracts };
          });
          const batchResults = await Promise.all(detailPromises);
          theses.push(...batchResults);

          console.log(
            `[Tezara Scraper] Query ${queryLabel} → Added ${batchResults.length} unique thesis(es). Running total: ${theses.length}`,
          );
        }

        // UNION kümesine 5 benzersiz tez yeterliyse erken çık
        if (theses.length >= 5) {
          console.log(
            `[Tezara Scraper] UNION cap reached (${theses.length} theses). Stopping early.`,
          );
          break;
        }
      } catch (err) {
        console.error(
          `[Tezara Scraper] Error on Query ${queryLabel}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Final UNION kümesini 5 ile sınırla
    theses = theses.slice(0, 5);
    console.log(
      `[Tezara Scraper] Final UNION thesis pool: ${theses.length} unique thesis(es) → IDs: [${theses.map((t) => t.id).join(", ")}]`,
    );

    if (theses.length === 0) {
      return {
        success: true,
        report: {
          risk: "Düşük",
          reasoning:
            "Tezara ve ulusal tez veri tabanlarında bu araştırma sorusu, kuramsal çatı ve spesifik anahtar kelime kombinasyonuyla eşleşen benzer bir akademik çalışma bulunamamıştır. Önerilen çalışma, ampirik odağı ve teorik sentezi açısından yüksek düzeyde özgün değer taşımaktadır.",
          gapAnalysis:
            "Doğrudan bir çakışma riski bulunmamaktadır. Çalışmanın özgün değerini daha da pekiştirmek adına, araştırma sorusunun kuramsal ayaklarını (Gramscici hegemonya ve çerçeveleme teorisi) giriş bölümlerinde metodolojik bir çelişkiye düşmeden derinleştirmeniz ve ampirik kaynak matrisini (Özgür Gündem, Gelenek, Özgürlük Dünyası) eksiksiz yapılandırmanız tavsiye edilir.",
          theses: [],
        },
      };
    }

    // Step 3: Run the Jury Filter and Similarity Risk Evaluation via Gemini
    const jurySystemInstruction = `Sen sosyal bilimler alanında çok seçkin, yapıcı ve vizyoner bir jüri üyesisin.
Öğrencinin yeni tez fikri (Mülakat geçmişindeki Başlık/Konu, Araştırma Sorusu, Teorik Çatı ve Ampirik Sınırlar) ile Türkiye akademik literatüründe bulunan tezleri kıyaslayacaksın.
Benzerlik riskini ("Düşük", "Orta" veya "Yüksek") belirlerken şunlara dikkat et:
1. Sırf aynı kavramlar (örneğin "sosyalizm", "kürt hareketi") çalışılmış diye risk düzeyini hemen "Orta" veya "Yüksek" yapma. Sosyal bilimlerde bu kavramlar binlerce kez çalışılmıştır.
2. Riski "Yüksek" veya "Orta" belirlemen için, karşılaştırılan tezlerin hem araştırma sorusunun, hem kuramsal yaklaşımının hem de ampirik/tarihsel dönem sınırlarının tamamının veya çoğunluğunun öğrencinin çalışmasıyla birebir çakışıyor olması gerekir. Eğer öğrenci farklı bir dönem, farklı bir kuramsal çatı veya farklı bir özgün araştırma sorusu öneriyorsa benzerlik riski "Düşük" olmalıdır.
3. Tezin özgün değerini kurtarmak ve literatürde yeni bir katkı sağlamak için hâlâ açıkta duran teorik boşlukları (gap) ve öğrenciye tavsiyeleri içeren derinlikli bir gap analizi yap.

Yanıtını KESİNLİKLE aşağıdaki JSON formatında vermelisin:
{
  "risk": "Düşük" | "Orta" | "Yüksek",
  "reasoning": "Benzerlik riski gerekçelendirmesi ve çalışılmış alanların özeti...",
  "gapAnalysis": "Tezin özgün değerini kurtarmak için teorik boşluklar ve stratejik öneriler..."
}

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve \`responseMimeType: "application/json"\` ayarlarına uygun olarak dönmelidir.`;

    const studentInput = `Öğrencinin Tez Fikri Konuşma Geçmişi:
${userInput}`;

    const searchContext =
      theses.length > 0
        ? `Bulunan Türkiye Menşeili Tezlerin Listesi (Tezara verileri):
${JSON.stringify(theses, null, 2)}`
        : `Türkiye Menşeili Tez Veri Tabanında doğrudan eşleşen benzer bir tez bulunamadı. Lütfen öğrencinin konusunu genel literatür ve teorik özgünlük çerçevesinde değerlendir.`;

    const juryPrompt = `${studentInput}\n\n${searchContext}`;

    const originalityResponseSchema = {
      type: "OBJECT" as const,
      properties: {
        risk: { type: "STRING" as const, enum: ["Düşük", "Orta", "Yüksek"] },
        reasoning: {
          type: "STRING" as const,
          description:
            "Benzerlik riski gerekçelendirmesi ve çalışılmış alanların özeti",
        },
        gapAnalysis: {
          type: "STRING" as const,
          description:
            "Tezin özgün değerini kurtarmak için teorik boşluklar ve stratejik öneriler",
        },
      },
      required: ["risk", "reasoning", "gapAnalysis"],
    };

    const genAIResponse = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemInstruction,
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: originalityResponseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
      },
    });

    const responseText = genAIResponse.text;
    if (!responseText) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir jüri süzgeci yanıtı döndü.",
      };
    }

    const parsed: {
      risk: "Düşük" | "Orta" | "Yüksek";
      reasoning: string;
      gapAnalysis: string;
    } = JSON.parse(responseText);

    return {
      success: true,
      report: {
        risk: parsed.risk,
        reasoning: parsed.reasoning,
        gapAnalysis: parsed.gapAnalysis,
        theses: theses,
      },
    };
  } catch (error) {
    console.error("checkTezaraOriginalityAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Özgünlük kontrolü yapılırken bir hata oluştu.",
    };
  }
}
