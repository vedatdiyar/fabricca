import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LiteratureRecommendation } from "../actions";
import { CandidatePaper } from "./types";
import { generateContentWithRetry } from "@/lib/gemini";

const queryExtractionSchema = z.object({
  englishQueries: z
    .array(z.string())
    .min(3)
    .max(3)
    .describe(
      "Semantic Scholar API araması için en fazla 2-3 kelimeden oluşan, bağlaç (and, in, of) içermeyen parça parça 3 adet İngilizce arama terimi kombinasyonu.",
    ),
});

const boxQueryExtractionSchema = z.object({
  boxes: z.array(
    z.object({
      boxId: z.number().describe("Verilen kutunun id değeri"),
      englishQueries: z
        .array(z.string())
        .min(2)
        .max(2)
        .describe(
          "Global literatür standartlarında (saf kuramsal metinleri ve emsal vaka analizlerini yakalayacak) en fazla 2-3 kelimeden oluşan 2 adet İngilizce arama terimi kombinasyonu.",
        ),
      turkishQueries: z
        .array(z.string())
        .min(2)
        .max(2)
        .describe(
          "Türkiye akademisindeki arama indekslerine tam uyumlu, yerel ampirik/tarihsel literatürü yakalayacak rafine en fazla 2-3 kelimeden oluşan 2 adet Türkçe arama terimi kombinasyonu.",
        ),
    }),
  ),
});

const juryResponseSchema = {
  type: "ARRAY" as const,
  description: "Akademik jürinin onayladığı makale önerileri listesi",
  items: {
    type: "OBJECT" as const,
    properties: {
      paperId: { type: "STRING" as const },
      title: { type: "STRING" as const },
      authors: { type: "STRING" as const },
      year: { type: "STRING" as const },
      url: { type: "STRING" as const },
      citationCount: { type: "INTEGER" as const },
      source: { type: "STRING" as const },
      lang: { type: "STRING" as const },
      relevance: { type: "STRING" as const },
    },
    required: [
      "paperId",
      "title",
      "authors",
      "year",
      "url",
      "citationCount",
      "source",
      "lang",
      "relevance",
    ],
  },
};

export class GeminiService {
  private static getClient(): GoogleGenAI {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error(
        "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      );
    }
    return new GoogleGenAI({ apiKey: geminiKey });
  }

  /**
   * Extracts Turkish and English academic query/keyword combinations from a thesis constitution.
   */
  static async extractAcademicQueries(
    title: string,
    researchQuestion: string,
    argument: string,
    methodology: string,
  ): Promise<{ englishQueries: string[]; turkishKeywords: string[] }> {
    try {
      const ai = this.getClient();

      const extractPrompt = `TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}`;

      const extractResponse = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-lite",
        contents: extractPrompt,
        config: {
          systemInstruction:
            "Sen girdi olarak verilen Tez Başlığı, Araştırma Sorusu ve Ana Argüman metinlerinden en efektif akademik arama terimlerini çıkaran titiz bir Kıdemli Sosyal Bilimler kütüphanecisisin. KATI KURAL: Üreteceğin 3 adet 'englishQueries' öğesi, ana argümanda geçen temel kavramlar, teorisyen isimleri ve metodolojik terimler etrafında şekillenmelidir. Her sorgu doğrudan tez metnindeki spesifik kavramlara dayanmalı, jenerik veya konu dışı terimler üretilmesi kesinlikle yasaktır. Uzun cümleler veya odak dışı kelimeler üretilmesi kesinlikle yasaktır.",
          temperature: 1,
          responseMimeType: "application/json",
          responseSchema: zodToJsonSchema(
            queryExtractionSchema as unknown as Parameters<
              typeof zodToJsonSchema
            >[0],
          ) as unknown as Record<string, unknown>,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const cleanExtractText = (extractResponse.text || "").trim();
      const parsedJson = JSON.parse(cleanExtractText);
      const validated = queryExtractionSchema.parse(parsedJson);

      return {
        englishQueries: validated.englishQueries,
        turkishKeywords: [],
      };
    } catch (err) {
      console.error(
        "[GeminiService] Extract queries parsing error or validation failure:",
        err,
      );
      // Fallback: use words from title
      const words = title.split(" ").filter(Boolean);
      return {
        englishQueries: [
          words.slice(0, 2).join(" "),
          words.slice(0, 3).join(" "),
          words.slice(1, 3).join(" "),
        ].filter(Boolean),
        turkishKeywords: [],
      };
    }
  }

  /**
   * Extracts target queries per box specifically matching box name and description.
   */
  static async extractAcademicQueriesPerBox(
    title: string,
    researchQuestion: string,
    argument: string,
    methodology: string,
    boxes: { id: number; name: string; description: string | null }[],
  ): Promise<
    { boxId: number; englishQueries: string[]; turkishQueries: string[] }[]
  > {
    try {
      const ai = this.getClient();

      const extractPrompt = `TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

TEMATİK ÇALIŞMA KUTULARI (THESIS BOXES):
${JSON.stringify(
  boxes.map((b) => ({ id: b.id, name: b.name, description: b.description })),
  null,
  2,
)}

Lütfen yukarıdaki tezin genel bağlamı altında, her bir "Tematik Çalışma Kutusu" (Thesis Box) için özel, nokta atışı arama terimleri üret. Her kutu için belirlenen sorgular doğrudan kutunun adına ve açıklamasına odaklanmalıdır.`;

      const extractResponse = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-lite",
        contents: extractPrompt,
        config: {
          systemInstruction:
            "Sen girdi olarak verilen Tez Anayasası (Başlık, Soru, Argüman, Metodoloji) ve Tematik Çalışma Kutuları listesinden, her bir kutuya özel akademik arama terimlerini çıkaran titiz bir Kıdemli Sosyal Bilimler kütüphanecisisin.\n\n" +
            "GÖREVİN VE ANALİZ ADIMLARI:\n" +
            "1. Girdideki tez anayasasını ve kutuları (kutu aslında tezin bir bölümü/outline'ıdır) titizlikle incele.\n" +
            "2. Her kutu için üreteceğin arama terimlerini (sorguları) üretirken şu unsurları birbiriyle harmanla: Kutu adı + Kutu Açıklaması + Varsa kutuda geçen kuramsal eşlenikler (Örn: Teorisyen isimleri, metodolojik kavramlar) ve tezin ampirik özneleri / coğrafyası / tarihsel dönemi.\n" +
            '3. \'englishQueries\' için: Arama motorlarının ham metin eşleşmesi körlüğünü yıkmak ve kurucu \'ağır topları\' ıskalamamak için, her sorgu string\'i, yazar soyadları ve teorik çekirdeğin doğal bir birleşimi olmalıdır (Örn: "Snow Benford collective action framing" veya "Gramsci hegemony political consent"). Asla ["frame bridging"] gibi tekil veya atomik kelimeler üretilmemelidir.\n' +
            '4. \'turkishQueries\' için: Türkiye akademisindeki tam isabet kesişimleri yakalamak için sorguları doğrudan ÇİFT TIRNAKLI esnek öbekler halinde üretmelisin (Örn: "\\"çerçeveleme kuramı\\" \\"toplumsal hareketler\\"" veya "\\"hegemonya stratejisi\\" \\"rıza üretimi\\"").\n\n' +
            "KATI KURALLAR:\n" +
            "- Her sorgu doğrudan kutudaki spesifik kavramlara ve tez bağlamına dayanmalı, jenerik veya konu dışı terimler üretilmesi kesinlikle yasaktır.\n" +
            "- Uzun cümleler veya odak dışı kelimeler üretilmesi kesinlikle yasaktır.",
          temperature: 1,
          responseMimeType: "application/json",
          responseSchema: zodToJsonSchema(
            boxQueryExtractionSchema as unknown as Parameters<
              typeof zodToJsonSchema
            >[0],
          ) as unknown as Record<string, unknown>,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const cleanExtractText = (extractResponse.text || "").trim();
      const parsedJson = JSON.parse(cleanExtractText);

      const singleBoxSchema = z.object({
        boxId: z.coerce.number().optional().nullable(),
        id: z.coerce.number().optional().nullable(),
        englishQueries: z.array(z.string()).catch([]),
        turkishQueries: z.array(z.string()).catch([]),
      });

      let boxesList: {
        boxId: number;
        englishQueries: string[];
        turkishQueries: string[];
      }[] = [];

      let rawItems: Record<string, unknown>[] = [];
      try {
        if (Array.isArray(parsedJson)) {
          rawItems = parsedJson as Record<string, unknown>[];
        } else if (parsedJson && typeof parsedJson === "object") {
          const parsedObj = parsedJson as Record<string, unknown>;
          if (Array.isArray(parsedObj.boxes)) {
            rawItems = parsedObj.boxes as Record<string, unknown>[];
          } else {
            const validated = boxQueryExtractionSchema.safeParse(parsedJson);
            if (validated.success) {
              rawItems = validated.data.boxes as unknown as Record<
                string,
                unknown
              >[];
            } else {
              rawItems = [parsedObj];
            }
          }
        }
      } catch (e) {
        console.warn(
          "[GeminiService] Failed to extract raw items, defaulting to empty list:",
          e,
        );
      }

      boxesList = rawItems.map((item, idx) => {
        const parsed = singleBoxSchema.safeParse(item);
        const data = parsed.success
          ? parsed.data
          : {
              boxId:
                item && typeof item === "object"
                  ? (item.boxId ?? item.id)
                  : undefined,
              id:
                item && typeof item === "object"
                  ? (item.id ?? item.boxId)
                  : undefined,
              englishQueries:
                item &&
                typeof item === "object" &&
                Array.isArray(item.englishQueries)
                  ? (item.englishQueries as string[])
                  : [],
              turkishQueries:
                item &&
                typeof item === "object" &&
                Array.isArray(item.turkishQueries)
                  ? (item.turkishQueries as string[])
                  : [],
            };

        // Determine final boxId using safe fallback mechanism
        let finalBoxId: number;
        if (data.boxId !== undefined && data.boxId !== null) {
          finalBoxId = Number(data.boxId);
        } else if (data.id !== undefined && data.id !== null) {
          finalBoxId = Number(data.id);
        } else {
          const originalBox = boxes[idx] || boxes[0];
          finalBoxId = originalBox ? originalBox.id : 0;
        }

        return {
          boxId: finalBoxId,
          englishQueries: data.englishQueries || [],
          turkishQueries: data.turkishQueries || [],
        };
      });

      return boxesList;
    } catch (err) {
      console.error(
        "[GeminiService] extractAcademicQueriesPerBox parsing error or validation failure:",
        err,
      );
      // Fallback
      return boxes.map((b) => {
        const words = b.name.split(" ").filter((w) => w.length > 2);
        return {
          boxId: b.id,
          englishQueries: [
            words.slice(0, 2).join(" "),
            words.slice(1, 3).join(" "),
          ].filter(Boolean),
          turkishQueries: [
            words.slice(0, 2).join(" "),
            words.slice(1, 3).join(" "),
          ].filter(Boolean),
        };
      });
    }
  }

  /**
   * Curates literature recommendations using an Academic Jury professor persona.
   */
  static async runAcademicJury(
    title: string,
    researchQuestion: string,
    argument: string,
    methodology: string,
    candidates: CandidatePaper[],
    isNewDiscovery: boolean,
    existingTitles: string[] = [],
    boxName?: string,
  ): Promise<LiteratureRecommendation[]> {
    const ai = this.getClient();

    const activeBoxName = boxName || "ilgili";
    const jurySystemPrompt = `Sen sosyal bilimler ve siyaset bilimi alanında uzman, son derece titiz ve kıdemli bir akademisyensin. Önündeki aday makale listesini, tezin [TITLE, ARGUMENT, METHODOLOGY] verileriyle karşılaştıracaksın.
Makalelerin atıf sayısı senin için bir kriter değildir. Kriterin, makalenin tezin ilgili [${activeBoxName}] kutusu ile olan metodolojik, kuramsal ve ampirik uyumudur.

[NER HASSASİYETİ (NAMED ENTITY RECOGNITION)]
- Girdi olarak aldığın tez anayasası uzun, derinlikli ve edebi paragraflardan oluşur. Paragrafların içindeki spesifik tarihsel kırılmaları/evreleri (Örn: "1991-1995", "1995-1999", "1990-2000" vb.) ve birincil ampirik/tarihsel kaynak isimlerini (Örn: Kürt hareketi yayınları/savunmaları ile Türkiye solunun "Gelenek", "Özgürlük Dünyası" gibi teorik dergilerini) çok yüksek bir Named Entity Recognition (NER) hassasiyeti ile tara ve yakala!
- Seçtiğin makalelerin bu spesifik tarihsel evrelere ve kaynak karşılaşmalarına kuramsal veya ampirik olarak ne kadar temas ettiğini tam olarak ölç.

Hangi kaynaktan gelirse gelsin (SS veya OA), teze en derinlikli katkıyı sunan 2 makaleyi bu kutu için seç.

KATI AKADEMİK KURALLAR:
1. KAFANDAN HİÇBİR YENİ MAKALE, YAZAR, YIL VEYA URL TÜRETMEYECEKSİN/UYDURMAYACAKSIN. Sadece sunulan aday makaleler listesinden seçim yapacaksın.
2. Aday makalelerin 'paperId', 'title', 'authors', 'year', 'url', 'citationCount', 'source', 'lang' gibi orijinal bilgilerini kesinlikle değiştirme, manipüle etme.
3. Her seçtiğin makale için Türkçe olarak 2-3 cümlelik çok güçlü bir entegrasyon gerekçesi ("relevance") üret. Bu gerekçede makalenin [${activeBoxName}] kutusundaki literatür boşluğuna/çalışmaya nasıl katkı sağladığını, yakaladığın spesifik NER kavramları (tarihler, dergiler, kuramlar) üzerinden detaylandırarak açıkla.
${isNewDiscovery ? "4. ÖNEMLİ: Hali hazırda ekli olan makaleleri (aşağıda listelenmiştir) kesinlikle tekrar seçme." : ""}`;

    const juryPrompt = `TEZ ANAYASASI:
- Başlık (TITLE): ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman (ARGUMENT): ${argument}
- Metodoloji (METHODOLOGY): ${methodology}

ÇALIŞMA KUTUSU (BOX_NAME): ${activeBoxName}

ADAY MAKALELER HAVUZU:
${JSON.stringify(candidates, null, 2)}

${isNewDiscovery ? `HALİ HAZIRDA EKİLİ MAKALELER (Bunları tekrar seçme!):\n${JSON.stringify(existingTitles, null, 2)}` : ""}

Lütfen bu aday makaleler havuzundan, bu kutu için en uygun 2 makaleyi kurallara tam uyarak seç ve döndür.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemPrompt,
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: juryResponseSchema,
      },
    });

    const cleanText = (response.text || "").trim();
    return JSON.parse(cleanText) as LiteratureRecommendation[];
  }
}
