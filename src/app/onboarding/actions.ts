"use server";

import { db } from "@/db";
import { thesisCore, thesisBoxes } from "@/db/schema";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";

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
    boxes?: {
      name: string;
      description: string;
    }[];
  } | null;
  needsReview?: boolean;
  error?: string;
}


/**
 * Server Action to call Gemini 3.1 Flash Lite and get the next question or the final synthesis.
 */
export async function getProfessorOnboardingResponseAction(
  chatHistory: ChatMessage[],
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
      ? `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere odanda kahve eşliğinde derin bir entelektüel istişare yürütüyorsun.

ÖNEMLİ UYARI: Yapılan Akademik Özgünlük Değer Raporu'nda "${originalityReport!.risk}" düzeyinde bir çakışma riski tespit edildi.
Raporun Stratejik Özgün Değer Tavsiyeleri (Gap Analizi):
${originalityReport!.gapAnalysis}

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir kahve sohbeti atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (örn. Gramsci'nin hegemonyası, Snow & Benford'un çerçeveleme kuramı) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
5. AKADEMİK MEYDAN OKUMA VE ÖZGÜNLÜK: Çakışma riskini ve gap analizini son derece bilgece, teşvik edici fakat bilimsel ciddiyetle hatırla. Eğer öğrenci çakışma riski üzerine yapılan bu uyarıma henüz cevap vermediyse veya konuyu esnetme önerisinde bulunmadıysa, öğrenciyi durdur, gap analizindeki 3 stratejik öneri doğrultusunda konuyu nasıl esnetebileceğimizi sor ve structuredData'yı kesinlikle null dön.
6. KULLANICI TETİKLEMELİ BİTİŞ (ZORUNLU KURAL): Vedat sana açıkça "anayasayı basabiliriz", "mülakatı bitir", "paneli açalım", "anayasayı kaydedebiliriz" veya "tez anayasasını basabiliriz" gibi kesin bir sözel onay verene kadar structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Mülakatın bitiş kararı tamamen kullanıcının bu sözel onayına bağlıdır; kesinlikle kendi inisiyatifinle veya yapay olarak mülakatı kendi kendine bitirme.

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Vedat sözel onay verip bitirdiğinde yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü Gramsci'nin Hegemonyası ve Snow & Benford'un Çerçeveleme Teorisi arasındaki ilişki üzerinden temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU KUTU YAPISI (structuredData.boxes):
  Kesinlikle 3 ila 5 adet API uyumlu akademik kutu (boxes) üret. Bu kutuların isimleri (name) ve açıklamaları (description) ileride semantik aramalarda kullanılacağı için son derece yoğun, zengin ve nokta atışı kuramsal kavramlar ile tarihsel evreler içermelidir:
  1. Giriş ve Kuramsal Altyapı Kutusu (Teorik çatı, Gramsci, hegemony, Snow & Benford, framing kavramlarıyla yoğun proposal gövdesi).
  2. Metodolojik Yaklaşım ve Veri Seti Kutusu (Söylem analizi, kaynak matrisi ve geçerlilik kriterleri).
  3. Dinamik Dönem Kutuları (Sohbette netleşen 1991-1994, 1995 Bloku, 1996-1999 gibi ampirik tarihsel evreler).

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Özgünlük riski/gap analizini değerlendiren ve konuyu esneten bilgece yönlendirme sorusu veya bitiş tebriği...",
  "needsReview": true,
  "structuredData": null
}`
      : `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere odanda kahve eşliğinde derin bir entelektüel istişare yürütüyorsun.

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir kahve sohbeti atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (örn. Gramsci'nin hegemonyası, Snow & Benford'un çerçeveleme kuramı) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
5. AKADEMİK MEYDAN OKUMA VE REHBERLİK: Kendi engin entelektüel birikimini kullan. Öğrencinin fikirlerindeki kuramsal açıkları, metodolojik zayıflıkları ve bir akademik jürinin bu çalışmayı nerede çökertebileceğini dürüstçe fakat yapıcı bir üslupla göster. Karşı argümanlar (antiteler) üreterek öğrenciye rehberlik et.
6. KULLANICI TETİKLEMELİ BİTİŞ (ZORUNLU KURAL): Vedat sana açıkça "anayasayı basabiliriz", "mülakatı bitir", "paneli açalım", "anayasayı kaydedebiliriz" veya "tez anayasasını basabiliriz" gibi kesin bir sözel onay verene kadar structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Mülakatın bitiş kararı tamamen kullanıcının bu sözel onayına bağlıdır; kesinlikle kendi inisiyatifinle veya yapay olarak mülakatı kendi kendine bitirme.

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Vedat sözel onay verip bitirdiğinde yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü Gramsci'nin Hegemonyası ve Snow & Benford'un Çerçeveleme Teorisi arasındaki ilişki üzerinden temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU KUTU YAPISI (structuredData.boxes):
  Kesinlikle 3 ila 5 adet API uyumlu akademik kutu (boxes) üret. Bu kutuların isimleri (name) ve açıklamaları (description) ileride semantik aramalarda kullanılacağı için son derece yoğun, zengin ve nokta atışı kuramsal kavramlar ile tarihsel evreler içermelidir:
  1. Giriş ve Kuramsal Altyapı Kutusu (Teorik çatı, Gramsci, hegemony, Snow & Benford, framing kavramlarıyla yoğun proposal gövdesi).
  2. Metodolojik Yaklaşım ve Veri Seti Kutusu (Söylem analizi, kaynak matrisi ve geçerlilik kriterleri).
  3. Dinamik Dönem Kutuları (Sohbette netleşen 1991-1994, 1995 Bloku, 1996-1999 gibi ampirik tarihsel evreler).

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Öğrenciye yönelik akademik yorum, derin analiz ve yönlendirme sorusu veya bitiş tebriği açıklaması...",
  "needsReview": true,
  "structuredData": null
}`;

    const contents = [
      ...chatHistory.map((item) => ({
        role: item.role,
        parts: [{ text: item.content }],
      })),
      {
        role: "user" as const,
        parts: [{ text: userResponse.trim() }],
      },
    ];

    const onboardingResponseSchema = {
      type: "OBJECT" as const,
      properties: {
        message: {
          type: "STRING" as const,
          description:
            "Kullanıcının cevabına dair akademik yorum ve sıradaki soru",
        },
        needsReview: {
          type: "BOOLEAN" as const,
          description:
            "Mülakatın devam etmesi gerekiyorsa true, sözel onay alınıp anayasa basıldığında false",
        },
        structuredData: {
          type: "OBJECT" as const,
          description:
            "Mülakat tamamlandığında (kullanıcı sözel onay verdiğinde) sentezlenmiş tez anayasası bilgileri, aksi takdirde null",
          properties: {
            title: { type: "STRING" as const },
            researchQuestion: { type: "STRING" as const },
            argument: { type: "STRING" as const },
            methodology: { type: "STRING" as const },
            boxes: {
              type: "ARRAY" as const,
              description:
                "Tezin özgün bölüm planına (Chapter Outline) göre dinamik olarak üretilmiş 3-5 adet tematik çalışma kutusu",
              items: {
                type: "OBJECT" as const,
                properties: {
                  name: { type: "STRING" as const },
                  description: { type: "STRING" as const },
                },
                required: ["name", "description"],
              },
            },
          },
          required: [
            "title",
            "researchQuestion",
            "argument",
            "methodology",
            "boxes",
          ],
        },
      },
      required: ["message", "needsReview"],
    };

    const genAIResponse = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: onboardingResponseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
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
        boxes?: {
          name: string;
          description: string;
        }[];
      } | null;
      needsReview?: boolean;
    } = JSON.parse(responseText);

    // KATI AKIŞ KONTROLÜ (FLOW CONTROL):
    // Kontrolü tamamen modelin structuredData üretip üretmeme kararına (karar mekanizmasına) bırakıyoruz.
    if (parsed.needsReview || !parsed.structuredData) {
      parsed.structuredData = null;
      parsed.needsReview = true;
    }

    return {
      success: true,
      message: parsed.message,
      structuredData: parsed.structuredData || null,
      needsReview: parsed.needsReview ?? false,
    };
  } catch (error) {
    console.error("getProfessorOnboardingResponseAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Yapay zekadan cevap alınırken hata oluştu.",
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
  boxes?: {
    name: string;
    description: string;
  }[];
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
    const [newThesis] = await db
      .insert(thesisCore)
      .values({
        title: data.title.trim(),
        researchQuestion: data.researchQuestion.trim(),
        argument: data.argument.trim(),
        methodology: data.methodology.trim(),
      })
      .returning();

    // Insert the generated thesis boxes if any
    if (data.boxes && data.boxes.length > 0) {
      await db.insert(thesisBoxes).values(
        data.boxes.map((box, index) => ({
          thesisCoreId: newThesis.id,
          name: box.name.trim(),
          description: box.description?.trim() || null,
          order: index,
        })),
      );
    }

    return { success: true };
  } catch (error) {
    console.error("saveThesisCoreAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez anayasası kaydedilirken hata oluştu.",
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
