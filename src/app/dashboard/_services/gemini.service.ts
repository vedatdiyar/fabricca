import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LiteratureRecommendation } from "../actions";
import { CandidatePaper } from "./dergipark.service";

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

      const extractResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: extractPrompt,
        config: {
          systemInstruction:
            "Sen girdi olarak verilen Tez Başlığı, Araştırma Sorusu ve Ana Argüman metinlerinden en efektif akademik arama terimlerini çıkaran titiz bir Kıdemli Sosyal Bilimler kütüphanecisisin. KATI KURAL: Üreteceğin 3 adet 'englishQueries' ve 4 adet 'turkishKeywords' öğeleri, ana argümanda geçen temel kavramlar, teorisyen isimleri ve metodolojik terimler etrafında şekillenmelidir. Her sorgu/keline doğrudan tez metnindeki spesifik kavramlara dayanmalı, jenerik veya konu dışı terimler üretilmesi kesinlikle yasaktır. Uzun cümleler veya odak dışı kelimeler üretilmesi kesinlikle yasaktır.",
          temperature: 1,
          responseMimeType: "application/json",
          responseJsonSchema: zodToJsonSchema(queryExtractionSchema as unknown as Parameters<typeof zodToJsonSchema>[0]) as unknown as Record<string, unknown>,
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
        turkishKeywords: validated.turkishKeywords,
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
        turkishKeywords: words.slice(0, 4).filter(Boolean),
      };
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
  ): Promise<LiteratureRecommendation[]> {
    const ai = this.getClient();

    let jurySystemPrompt = "";
    let juryPrompt = "";

    if (!isNewDiscovery) {
      jurySystemPrompt = `
Sen sosyal bilimler alanında uzman, son derece seçkin ve analitik düşünen bir Akademik Jüri / Danışman Profesörsün.
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

      juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

BİRLEŞİK ADAY MAKALELER HAVUZU (Sadece Buradan Seçim Yapabilirsin!):
${JSON.stringify(candidates, null, 2)}

Lütfen bu birleşik havuzdan kurallara tam uyarak (en iyi 6 makaleyi) seç ve istenen JSON formatında döndür.
`;
    } else {
      jurySystemPrompt = `
Sen sosyal bilimler alanında uzman, son derece seçkin ve analitik düşünen bir Akademik Jüri / Danışman Profesörsün.
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

      juryPrompt = `
TEZ ANAYASASI:
- Başlık: ${title}
- Araştırma Sorusu: ${researchQuestion}
- Ana Argüman: ${argument}
- Metodoloji: ${methodology}

YENİ ADAY MAKALELER (Sadece Buradan Seçebilirsin!):
${JSON.stringify(candidates, null, 2)}

Hali Hazırda Ekli Olan Makalelerin Başlıkları (Bunları Tekrar Seçme):
${JSON.stringify(existingTitles, null, 2)}

Lütfen bu yepyeni aday makaleler arasından en uygun 4 yeni makaleyi seç ve istenen JSON formatında döndür.
`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: juryPrompt,
      config: {
        systemInstruction: jurySystemPrompt,
        temperature: 1,
        responseMimeType: "application/json",
      },
    });

    let cleanText = (response.text || "").trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
    }

    return JSON.parse(cleanText) as LiteratureRecommendation[];
  }
}
