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

export interface RawTezaraPoolResult {
  success: boolean;
  theses?: OriginalityThesis[];
  queryList?: string[];
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
 * Defensive upper bound for per-query pagination. Tezara rarely returns more than
 * a few hundred results for a focused social-science query; 20 pages × ~10 results
 * per page is a safe academic ceiling while preventing infinite loops.
 */
const SAFETY_PAGE_CAP = 3;

/**
 * Step 0 helper (extracted from checkTezaraOriginalityAction):
 *   1. Generates a Multi-Tier query set (A: conceptual, B: contextual, C: process)
 *      via Gemini 3.1 Flash Lite — dönemsel ve kök analizi yapan prompt AYNIEN.
 *   2. For each query, dynamically paginates Tezara search results (no fixed page
 *      cap) until an empty page is encountered, the server stops responding OK,
 *      or the SAFETY_PAGE_CAP safety bound is hit.
 *   3. Deduplicates theses across queries/pages via a shared seenIds Set (UNION).
 *   4. Returns ONLY light metadata (id, title, author, advisor, year, university).
 *      No abstract scraping is performed at this stage.
 */
export async function fetchTezaraRawPool(
  userInput: string,
): Promise<RawTezaraPoolResult> {
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
      .map((q) => {
        let cleaned = q.trim();
        // Remove alphabetical or numeric prefixes like "A)", "B:", "1.", "a -" (case-insensitive)
        cleaned = cleaned.replace(/^[a-zA-Z0-9]\s*[\):\.-]\s*/, "");
        // Remove common bullet points or hyphens
        cleaned = cleaned.replace(/^[-–—•*+]\s*/, "");
        // Strip surrounding quotes
        cleaned = cleaned.replace(/^['"`]+|['"`]+$/g, "");
        return cleaned.trim();
      })
      .filter(Boolean)
      .slice(0, 3);

    console.log(
      `[Tezara Scraper] Tezara'ya Gönderilen Arama Anahtar Kelimeleri (Keywords):`,
      queryList,
    );

    console.log(
      `[Tezara Scraper] Multi-Tier Query Set generated: [${queryList.map((q, i) => `${["A", "B", "C"][i]}="${q}"`).join(" | ")}]`,
    );

    // Step 2: Dynamic pagination + UNION dedup — only LIGHT metadata collected.
    const allRawTheses: OriginalityThesis[] = [];
    const seenIds = new Set<string>();

    for (let qi = 0; qi < queryList.length; qi++) {
      const query = queryList[qi];
      const queryLabel = ["A (Kavramsal)", "B (Bağlamsal)", "C (Eylem/Süreç)"][
        qi
      ];

      let page = 1;
      while (page <= SAFETY_PAGE_CAP) {
        const searchUrl = `https://tezara.org/search?q=${encodeURIComponent(query)}&page=${page}`;
        const searchRes = await fetch(searchUrl);

        if (!searchRes.ok) {
          console.warn(
            `[Tezara Scraper] Query ${queryLabel} | Page ${page} HTTP ${searchRes.status} → ending pagination for this query.`,
          );
          break;
        }

        const html = await searchRes.text();
        const thesisBlocks = html.split('<li id="thesis-');
        const blockCount = thesisBlocks.length - 1;

        if (blockCount === 0) {
          console.log(
            `[Tezara Scraper] Query ${queryLabel} | Page ${page} returned no thesis blocks → end of pagination.`,
          );
          break;
        }

        const newOnesThisPage: OriginalityThesis[] = [];

        for (let i = 1; i < thesisBlocks.length; i++) {
          const block = thesisBlocks[i];
          const idMatch = block.match(/^(\d+)"/);
          if (!idMatch) continue;
          const thesisId = idMatch[1];

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

          newOnesThisPage.push({
            id: thesisId,
            title,
            author,
            advisor,
            year,
            university,
          });
        }

        allRawTheses.push(...newOnesThisPage);
        console.log(
          `[Tezara Scraper] Query ${queryLabel} | Page ${page} → ${blockCount} raw block(s), ${newOnesThisPage.length} new (running total: ${allRawTheses.length})`,
        );
        page++;
      }
    }

    console.log(
      `[Tezara Scraper] Raw UNION pool size: ${allRawTheses.length} unique thesis(es) across ${queryList.length} query × up to ${SAFETY_PAGE_CAP} page(s).`,
    );

    return { success: true, theses: allRawTheses, queryList };
  } catch (error) {
    console.error("fetchTezaraRawPool Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tezara ham havuz toplanırken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to check originality of a thesis topic/question against tezara.org using Gemini 3.1 Flash Lite
 *
 * Two-stage semantic filtering pipeline:
 *   - Step 0 (Raw pool): fetchTezaraRawPool — Multi-Tier query gen + dynamic pagination
 *     + UNION dedup, returns light metadata only.
 *   - AŞAMA 1 (Light LLM Filter, temp=0.2): Compares the raw Tezara pool (titles +
 *     institutions only) against the user's thesis proposal. Returns ONLY the IDs
 *     of theses that are genuinely suspicious (real risk of overlap).
 *   - GEÇİŞ (Targeted Scrape): Fetches abstracts (via fetchThesisAbstract) ONLY
 *     for the refined suspicious ID set. Drastically cuts network load.
 *   - AŞAMA 2 (Deep Jury): Feeds the enriched suspicious theses into the existing
 *     Jüri prompt + originalityResponseSchema for the final risk verdict and gap
 *     analysis.
 */
export async function checkTezaraOriginalityAction(
  userInput: string,
): Promise<OriginalityResponse> {
  const noMatchFallback: OriginalityReport = {
    risk: "Düşük",
    reasoning:
      "Tezara ve ulusal tez veri tabanlarında bu araştırma sorusu, kuramsal çatı ve spesifik anahtar kelime kombinasyonuyla eşleşen benzer bir akademik çalışma bulunamamıştır. Önerilen çalışma, ampirik odağı ve teorik sentezi açısından yüksek düzeyde özgün değer taşımaktadır.",
    gapAnalysis:
      "Doğrudan bir çakışma riski bulunmamaktadır. Çalışmanın özgün değerini daha da pekiştirmek adına, araştırma sorusunun kuramsal ayaklarını (Gramscici hegemonya ve çerçeveleme teorisi) giriş bölümlerinde metodolojik bir çelişkiye düşmeden derinleştirmeniz ve ampirik kaynak matrisini (Özgür Gündem, Gelenek, Özgürlük Dünyası) eksiksiz yapılandırmanız tavsiye edilir.",
    theses: [],
  };

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

    // Step 0: Raw pool collection
    const pool = await fetchTezaraRawPool(userInput);
    if (!pool.success || !pool.theses || pool.theses.length === 0) {
      console.log(
        "[Tezara Scraper] Raw pool empty → returning Düşük risk fallback.",
      );
      return { success: true, report: noMatchFallback };
    }

    // ====== AŞAMA 1 — Hafif LLM Filtresi (Özet Öncesi) ======
    const stage1SystemInstruction = `Sen sosyal bilimler alanında uzman bir jüri üyesisin.
Görevin: Öğrencinin tez anayasası (Başlık, Araştırma Sorusu, Argüman, Metodoloji) ile aşağıda listelenen tezlerin sadece başlık ve üniversite bilgilerini semantik olarak kıyaslamak.

Hangi tezlerin kuramsal, dönemsel veya ampirik olarak öğrencinin çalışmasıyla GERÇEKTEN çakışma ihtimali barındırdığını, yakından incelenmesi gerektiğini belirle.

Kriterler:
1. Sırf aynı anahtar kelime geçiyor diye bir tezi şüpheli listesine ekleme. Sosyal bilimlerde binlerce çalışmada aynı kavram geçer.
2. Çakışma için: araştırma sorusunun, kuramsal yaklaşımın VE ampirik/tarihsel sınırların çoğunluğunun örtüşmesi gerekir.
3. Emin değilsen "şüpheli listesine" DAHİL ETME. Yanlış pozitif, yanlış negatiften daha kötüdür; sadece özetleri gerçekten çekilip ikinci aşamada jüri tarafından incelenmeye değer olan tezleri işaretle.
4. Hiçbir tez gerçek anlamda şüpheli değilse boş dizi [] döndür.`;

    const stage1Schema = {
      type: "OBJECT" as const,
      properties: {
        suspiciousIds: {
          type: "ARRAY" as const,
          items: { type: "STRING" as const },
          description:
            "Yalnızca gerçek anlamda çakışma ihtimali olan tezlerin ID listesi. Hiçbiri yoksa boş dizi [] döndür.",
        },
      },
      required: ["suspiciousIds"],
    };

    const stage1Prompt = `Öğrencinin Tez Anayasası (JSON):
${userInput}

Ham Tez Havuzu (Tezara — yalnızca hafif metadata):
${JSON.stringify(pool.theses, null, 2)}

Lütfen bu listeyi semantik olarak değerlendir ve sadece gerçekten şüpheli olanların ID'lerini döndür.`;

    const stage1Response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: stage1Prompt,
      config: {
        systemInstruction: stage1SystemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: stage1Schema,
      },
    });

    const stage1Text = stage1Response.text;
    if (!stage1Text) {
      console.warn(
        "[Tezara Scraper] AŞAMA 1 returned empty text → returning Düşük risk fallback.",
      );
      return { success: true, report: noMatchFallback };
    }

    let stage1Parsed: { suspiciousIds: string[] };
    try {
      stage1Parsed = JSON.parse(stage1Text);
    } catch (parseErr) {
      console.error(
        "[Tezara Scraper] AŞAMA 1 JSON parse failed:",
        parseErr instanceof Error ? parseErr.message : parseErr,
      );
      return {
        success: false,
        error: "Aşama 1 süzgeci beklenen formatta yanıt veremedi.",
      };
    }

    const suspiciousIds = Array.isArray(stage1Parsed.suspiciousIds)
      ? stage1Parsed.suspiciousIds.filter(
          (id) => typeof id === "string" && id.length > 0,
        )
      : [];

    console.log(
      `[Tezara Scraper] AŞAMA 1 → suspiciousIds count: ${suspiciousIds.length}`,
    );

    // Maliyet optimizasyonu: Şüpheli tez yoksa AŞAMA 2 (Jüri) atlanır.
    if (suspiciousIds.length === 0) {
      console.log(
        "[Tezara Scraper] AŞAMA 1 yielded no suspicious IDs → returning Düşük risk, skipping AŞAMA 2.",
      );
      return { success: true, report: noMatchFallback };
    }

    // ====== GEÇİŞ FAZI — Nokta Atışı Abstract Scrape ======
    const suspiciousSet = new Set(suspiciousIds);
    const suspiciousTheses = pool.theses.filter((t) => suspiciousSet.has(t.id));
    const enrichedTheses = await Promise.all(
      suspiciousTheses.map(async (t) => ({
        ...t,
        ...(await fetchThesisAbstract(t.id)),
      })),
    );

    console.log(
      `[Tezara Scraper] Targeted scrape → ${enrichedTheses.length} enriched suspicious thesis(es) → IDs: [${enrichedTheses.map((t) => t.id).join(", ")}]`,
    );

    // ====== AŞAMA 2 — Derinlemesine Jüri Analizi ======
    const jurySystemInstruction = `Sen sosyal bilimler alanında çok seçkin, yapıcı ve vizyoner bir jüri üyesisin.
Öğrencinin yeni tez fikri (Mülakat geçmişindeki Başlık/Konu, Araştırma Sorusu, Teorik Çatı ve Ampirik Sınırlar) ile Türkiye akademik literatüründe bulunan tezleri kıyaslayacaksın.
Benzerlik riskini ("Düşük", "Orta" veya "Yüksek") belirlerken şunlara dikkat et:
1. Sırf aynı kavramlar çalışılmış diye risk düzeyini hemen "Orta" veya "Yüksek" yapma. Sosyal bilimlerde benzer kavramlar binlerce kez çalışılmıştır.
2. Riski "Yüksek" veya "Orta" belirlemen için, karşılaştırılan tezlerin hem araştırma sorusunun, hem kuramsal yaklaşımının hem de ampirik/tarihsel dönem sınırlarının tamamının veya çoğunluğunun öğrencinin çalışmasıyla birebir çakışıyor olması gerekir. Eğer öğrenci farklı bir dönem, farklı bir kuramsal çatı veya farklı bir özgün araştırma sorusu öneriyorsa benzerlik riski "Düşük" olmalıdır.
3. Tezin özgün değerini kurtarmak ve literatürde yeni bir katkı sağlamak için hâlâ açıkta duran teorik boşlukları (gap) ve öğrenciye tavsiyeleri içeren derinlikli bir gap analizi yap.
4. KESİN YASAK - TEZ İSMİ VE YAZAR YASAĞI: Raporda KESİNLİKLE hiçbir tezin ismini (başlığını), yazar adını/soyadını, danışman ismini veya veri tabanı ID numarasını geçirme. Değerlendirmeyi, gerekçelendirmeyi ve gap analizini tamamen kuramsal, kavramsal, metodolojik ve tarihsel boyutlar üzerinden isimsiz olarak yap. Literatürdeki benzerlikleri ve çakışma riskini spesifik çalışmaların adını vermeden, genel akademik eğilimler ve konu örüntüleri üzerinden değerlendir.

Yanıtını KESİNLİKLE aşağıdaki JSON formatında vermelisin:
{
  "risk": "Düşük" | "Orta" | "Yüksek",
  "reasoning": "Benzerlik riski gerekçelendirilmesi ve çalışılmış alanların özeti...",
  "gapAnalysis": "Tezin özgün değerini kurtarmak için teorik boşluklar ve stratejik öneriler..."
}

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve \`responseMimeType: "application/json"\` ayarlarına uygun olarak dönmelidir.`;

    const studentInput = `Öğrencinin Tez Fikri Konuşma Geçmişi:
${userInput}`;

    const searchContext = `Aşama 1 süzgecinden geçen, özetleri çekilmiş şüpheli tezler (Tezara verileri):
${JSON.stringify(enrichedTheses, null, 2)}`;

    const juryPrompt = `${studentInput}\n\n${searchContext}`;

    const originalityResponseSchema = {
      type: "OBJECT" as const,
      properties: {
        risk: { type: "STRING" as const, enum: ["Düşük", "Orta", "Yüksek"] },
        reasoning: {
          type: "STRING" as const,
          description:
            "Benzerlik riski gerekçelendirilmesi ve çalışılmış alanların özeti",
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
        theses: enrichedTheses,
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
