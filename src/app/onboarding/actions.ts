"use server";

import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import { GoogleGenAI } from "@google/genai";

export interface ChatMessage {
  role: "user" | "model" | "originality_report";
  content: string;
  reportData?: {
    risk: "Düşük" | "Orta" | "Yüksek";
    reasoning: string;
    gapAnalysis: string;
    theses: {
      id: string;
      title: string;
      author: string;
      advisor: string;
      year: string;
      university: string;
      abstract?: string;
      abstract_en?: string;
    }[];
  };
}

export interface OnboardingResponse {
  success: boolean;
  message?: string;
  structuredData?: {
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
  } | null;
  needsReview?: boolean;
  error?: string;
}

/**
 * Server Action to call Gemini 3.1 Flash Lite and get the next question or the final synthesis.
 */
export async function getProfessorOnboardingResponseAction(
  chatHistory: ChatMessage[],
  currentStep: number,
  userResponse: string,
  originalityReport?: { risk: string; gapAnalysis: string },
): Promise<OnboardingResponse> {
  try {
    if (!userResponse || !userResponse.trim()) {
      return { success: false, error: "Cevap boş olamaz." };
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

    const isHighRisk =
      originalityReport?.risk === "Yüksek" ||
      originalityReport?.risk === "Orta";

    const systemInstruction = isHighRisk
      ? `Sen Fabricca projesinin Siyaset Bilimi ve Politik Sosyoloji alanında uzman, kıdemli ve son derece bilge Tez Danışmanısın (Prof. Dr. Tez Danışmanı).

ÖNEMLİ UYARI: Az önce yapılan Akademik Özgünlük Değer Raporu'nda "${originalityReport!.risk}" düzeyinde bir çakışma riski tespit edildi.

Raporun Stratejik Özgün Değer Tavsiyeleri (Gap Analizi):
${originalityReport!.gapAnalysis}

Bu rapor doğrultusunda şu anki görevin, kullanıcıyı bir sonraki adıma geçirmeden ÖNCE durdurmak ve yukarıdaki çakışmalar ile 3 stratejik öneri doğrultusunda konuyu nasıl esnetebileceğimizi tartışmaya açmaktır.

Yanıtına şu yaklaşımla başla:
1. Kullanıcının verdiği cevabı kısaca analiz et ("${userResponse.trim()}")
2. Raporun varlığına atıfta bulunarak çakışma riskini nazikçe hatırlat
3. Doğrudan şu soruyu yönelt: "Yukarıda listelediğim çakışmalar ve 3 stratejik öneri doğrultusunda konuyu nasıl esnetelim, fikrin nedir meslektaşım?"

Kullanıcının bu cevabına dair 1-2 cümlelik akademik yorum yap ve ardından bu yönlendirme sorusunu ilet.

Yanıtını kesinlikle aşağıdaki JSON formatında vermelisin:
{
  "message": "Kullanıcının cevabına dair akademik yorum ve ardından yukarıdaki yönlendirme sorusu...",
  "structuredData": null,
  "needsReview": true
}

Unutma: structuredData KESİNLİKLE null olmalı, needsReview KESİNLİKLE true olmalı. Yanıtın her zaman geçerli bir JSON olmalı ve \`responseMimeType: "application/json"\` ayarlarına uygun olarak dönmelidir.`
      : `Sen Fabricca projesinin Siyaset Bilimi ve Politik Sosyoloji alanında uzman, kıdemli ve son derece bilge Tez Danışmanısın (Prof. Dr. Tez Danışmanı).
Görevin, yüksek lisans öğrencisine tezinin temel direklerini (Tez Anayasası / Thesis Core) belirlemesinde yol göstermektir.
Mülakat tam olarak 4 adımdan oluşuyor:
1. Tez Başlığı ve Genel Konu (Örn: Post-2001 Türkiye finansallaşması)
2. Ana Araştırma Sorusu (Research Question)
3. Temel Teorik Çatı ve Odak Teorisyenler (Örn: Marx, Foucault, Biyopolitika, Mülksüzleştirme)
4. Tezin İncelediği Tarihsel/Ampirik Dönem Sınırları

${originalityReport ? "Akademik Özgünlük Değer Raporu'nda alanın temiz olduğu görülüyor, bu güzel bir haber. Kullanıcıya bu olumlu durumu kısaca belirt ve normal akışa devam et.\n\n" : ""}Kullanıcı şu anda ${currentStep}. adımı cevapladı. Verdiği cevap: "${userResponse.trim()}"

Kullanıcının bu cevabını analiz et. Son derece yapıcı, saygın, entelektüel derinliği olan bir akademik üslup kullan (örneğin 'Sevgili meslektaşım', 'Bu kavramsal tercih çalışmana derinlik katacaktır' vb.).

Yanıtını kesinlikle aşağıdaki JSON formatında vermelisin:
{
  "message": "Kullanıcının cevabına dair 1-2 cümlelik akademik yorum ve ardından sıradaki soruya geçiş cümlesi...",
  "structuredData": null,
  "needsReview": false
}

Eğer mülakatın son adımıysa (${currentStep} === 4 ise), kullanıcının son cevabını da alarak tüm mülakat geçmişini sentezleyip 'structuredData' alanını doldurmalısın. Bu alandaki başlık (title), soru (researchQuestion), argüman (argument) ve yöntem/dönem sınırları (methodology) kısımlarını öğrencinin girdilerini zenginleştirerek, daha akademik, rafine ve profesyonel bir dile kavuşturarak doldur. Son adımdaki JSON yapısı tam olarak şöyle olmalıdır:
{
  "message": "Harika bir mülakatın sonu tebriği ve tez anayasasının hazır olduğunu bildiren açıklama...",
  "structuredData": {
    "title": "Sentezlenmiş ve akademik olarak yapılandırılmış resmi tez başlığı",
    "researchQuestion": "Akademik derinliği olan net, soru işaretiyle biten araştırma sorusu",
    "argument": "Teorik çatı, odak teorisyenler ve temel kavramsal argüman",
    "methodology": "Ampirik alan, seçilen tarihsel dönem sınırları ve bilimsel yöntem"
  },
  "needsReview": false
}

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve \`responseMimeType: "application/json"\` ayarlarına uygun olarak dönmelidir.`;

    const contents = [
      ...chatHistory.map((item) => ({
        role: item.role,
        parts: [{ text: item.content }],
      })),
      {
        role: "user" as const,
        parts: [
          { text: `Adım ${currentStep} cevabım: ${userResponse.trim()}` },
        ],
      },
    ];

    const genAIResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 1,
        responseMimeType: "application/json",
      },
    });

    const responseText = genAIResponse.text;
    if (!responseText) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir yanıt döndü.",
      };
    }

    const parsed: {
      message: string;
      structuredData?: {
        title: string;
        researchQuestion: string;
        argument: string;
        methodology: string;
      } | null;
      needsReview?: boolean;
    } = JSON.parse(responseText);

    return {
      success: true,
      message: parsed.message,
      structuredData: parsed.structuredData || null,
      needsReview: parsed.needsReview ?? false,
    };
  } catch (error: any) {
    console.error("getProfessorOnboardingResponseAction Error:", error);
    return {
      success: false,
      error: error.message || "Yapay zekadan cevap alınırken hata oluştu.",
    };
  }
}

/**
 * Server Action to finalize and save the structured "Tez Anayasası" (Thesis Core) into Neon PostgreSQL via Drizzle ORM.
 */
export async function saveThesisCoreAction(data: {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (
      !data.title ||
      !data.researchQuestion ||
      !data.argument ||
      !data.methodology
    ) {
      return {
        success: false,
        error: "Tez anayasasının tüm alanları doldurulmalıdır.",
      };
    }

    // Insert into Neon PostgreSQL
    await db.insert(thesisCore).values({
      title: data.title.trim(),
      researchQuestion: data.researchQuestion.trim(),
      argument: data.argument.trim(),
      methodology: data.methodology.trim(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("saveThesisCoreAction Error:", error);
    return {
      success: false,
      error: error.message || "Tez anayasası kaydedilirken hata oluştu.",
    };
  }
}

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
  } catch (err: any) {
    console.error(
      `[Tezara Scraper] Failed to fetch abstract for thesis ${id}:`,
      err.message || err,
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
    const keywordPrompt = `Sen bir akademik arama motoru optimizasyon asistanısın. 
Aşağıdaki tez başlığı/konusu veya araştırma sorusundan, Türkiye'deki tez veri tabanlarında (YÖK/Tezara) arama yapmak için en uygun 1 veya 2 adet akademik anahtar kelimeyi/kavramı ayıkla.
Sadece anahtar kelimeleri aralarında boşluk bırakarak döndür. Başka hiçbir açıklama, tırnak veya metin ekleme.
Örnek Giriş: Modernleşme ekseninde biyopolitika
Örnek Çıkış: biyopolitika modernleşme

Kullanıcı Girdisi: ${userInput}
Çıkış:`;

    const keywordResponse = await ai.models.generateContent({
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
      } catch (err: any) {
        console.error(
          "[Tezara Scraper] Error scraping search results:",
          err.message || err,
        );
      }
    }

    // Step 3: Run the Jury Filter and Similarity Risk Evaluation via Gemini
    const jurySystemInstruction = `Sen Siyaset Bilimi ve Politik Sosyoloji alanında çok seçkin bir jüri üyesisin. 
Öğrencinin yeni tez fikri (Başlık/Konu ve Araştırma Sorusu) ile Türkiye akademik literatüründe (Tezara) bulunan tezleri kıyaslayacaksın.
Benzerlik riskini ("Düşük", "Orta" veya "Yüksek") belirle. Eğer benzer bir tez varsa risk 'Yüksek' veya 'Orta' olmalıdır.
Tezin özgün değerini kurtarmak ve literatürde yeni bir katkı sağlamak için hâlâ açıkta duran teorik boşlukları (gap) ve öğrenciye tavsiyeleri içeren derinlikli bir gap analizi yap.

Yanıtını KESİNLİKLE aşağıdaki JSON formatında vermelisin:
{
  "risk": "Düşük" | "Orta" | "Yüksek",
  "reasoning": "Benzerlik riski gerekçelendirmesi ve çalışılmış alanların özeti...",
  "gapAnalysis": "Tezin özgün değerini kurtarmak için teorik boşluklar ve stratejik öneriler..."
}

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve \`responseMimeType: "application/json"\` ayarlarına uygun olarak dönmelidir.`;

    const studentInput = `Öğrencinin Tez Fikri:
${userInput}`;

    const searchContext =
      theses.length > 0
        ? `Bulunan Türkiye Menşeili Tezlerin Listesi (Tezara verileri):
${JSON.stringify(theses, null, 2)}`
        : `Türkiye Menşeili Tez Veri Tabanında doğrudan eşleşen benzer bir tez bulunamadı. Lütfen öğrencinin konusunu genel literatür ve teorik özgünlük çerçevesinde değerlendir.`;

    const juryPrompt = `${studentInput}\n\n${searchContext}`;

    const genAIResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemInstruction,
        temperature: 1,
        responseMimeType: "application/json",
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
  } catch (error: any) {
    console.error("checkTezaraOriginalityAction Error:", error);
    return {
      success: false,
      error: error.message || "Özgünlük kontrolü yapılırken bir hata oluştu.",
    };
  }
}
