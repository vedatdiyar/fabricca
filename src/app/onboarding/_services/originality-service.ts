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

    // Step 1: Extract keywords for searching on Tezara
    const keywordPrompt = `Sen sosyal bilimler alanında uzman bir akademik arama motoru optimizasyon asistanısın.
Aşağıdaki yüksek lisans tez onboarding mülakatı konuşma geçmişinden, tezin genel konusunu, araştırma sorusunu, kuramsal odağını ve ampirik/tarihsel sınırlarını analiz et.
Türkiye'deki ulusal tez veri tabanlarında (YÖK/Tezara) arama yapmak üzere en uygun, çakışmaları yakalayabilecek ve tezin kesişim kümesini temsil eden 1 veya 2 adet BİRLEŞİK (compound / multi-concept) akademik arama terimi üreterek bunları boşlukla birleştirerek döndür.

Kurallar:
1. "sosyalizm", "kapitalizm", "kürt hareketi" gibi tek başına aratıldığında binlerce alakasız sonuç döndürecek aşırı genel kelimeler yerine, tezin teorik odağını ve ampirik alanını/vakasını birleştiren 2 veya 3 kelimelik anlamlı akademik tamlamalar üret. (Örn: "kürt hareketi sınıf analizi", "finansallaşma emek süreci", "biyopolitika göç yönetimi").
2. Sadece arama terimlerini tek bir satırda döndür. Başka hiçbir açıklama, tırnak, noktalama işareti veya metin ekleme.

Konuşma Geçmişi:
${userInput}

Çıkış:`;

    const keywordResponse = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: keywordPrompt,
      config: {
        temperature: 1,
      },
    });

    const keywords = (keywordResponse.text || "").trim();
    console.log(
      `[Tezara Scraper] Extracted keywords: "${keywords}" for input: "${userInput}"`,
    );

    let theses: OriginalityThesis[] = [];

    // Step 2: Scrape tezara.org/search
    if (keywords) {
      try {
        const searchRes = await fetch(
          `https://tezara.org/search?q=${encodeURIComponent(keywords)}`,
        );
        if (searchRes.ok) {
          const html = await searchRes.text();
          const thesisBlocks = html.split('<li id="thesis-');
          const maxResults = Math.min(thesisBlocks.length - 1, 5); // Scrape up to 4-5 theses

          const parsedTheses: OriginalityThesis[] = [];

          for (let i = 1; i <= maxResults; i++) {
            const block = thesisBlocks[i];
            const idMatch = block.match(/^(\d+)"/);
            if (!idMatch) continue;
            const thesisId = idMatch[1];

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
              author = decodeHtml(
                authorMatch[1].replace(/<[^>]*>/g, "").trim(),
              );
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

          // Fetch abstracts in parallel
          const detailPromises = parsedTheses.map(async (t) => {
            const abstracts = await fetchThesisAbstract(t.id);
            return { ...t, ...abstracts };
          });

          theses = await Promise.all(detailPromises);
        } else {
          console.warn(
            `[Tezara Scraper] Search request failed with status: ${searchRes.status}`,
          );
        }
      } catch (err) {
        console.error(
          "[Tezara Scraper] Error scraping search results:",
          err instanceof Error ? err.message : err,
        );
      }
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
