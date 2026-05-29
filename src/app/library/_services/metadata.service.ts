import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";

export interface AcademicMetadata {
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  abstract: string | null;
}

/**
 * Extracts academic metadata (title, authors, year, doi, abstract) from the first 4000 characters
 * of a PDF's parsed markdown text using Google Gemini 3.1 Flash Lite.
 */
export async function extractAcademicMetadata(
  markdownFull: string,
  fallbackTitle: string,
): Promise<AcademicMetadata> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn(
      "Gemini API key not found. Using fallbacks for academic metadata.",
    );
    return {
      title: fallbackTitle,
      authors: "Bilinmeyen Yazar",
      year: null,
      doi: null,
      abstract: null,
    };
  }

  try {
    const startText = markdownFull.substring(0, 4000);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const systemPrompt =
      "Sen kıdemli bir akademik dökümantasyon ve kütüphanecilik uzmanısın. Sana verilen makale başlangıç metnini dikkatle incele. Makalenin resmi tam başlığını (title), yazarlarını (authors), yayınlandığı yılı (year), varsa resmi DOI numarasını (doi) ve makalenin kısa özeti/abstract alanını (abstract) ayıkla. Yanıtı KESİNLİKLE başka hiçbir açıklama, markdown işareti veya kod bloğu enjekte etmeden, sadece ve sadece şu JSON şemasında döndür: { title: string, authors: string, year: number, doi: string, abstract: string }";

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: startText,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            authors: { type: "STRING" },
            year: { type: "INTEGER" },
            doi: { type: "STRING" },
            abstract: { type: "STRING" },
          },
          required: ["title", "authors", "year", "doi", "abstract"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    const data = JSON.parse(responseText.trim());

    return {
      title:
        data.title && typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : fallbackTitle,
      authors:
        data.authors && typeof data.authors === "string" && data.authors.trim()
          ? data.authors.trim()
          : "Bilinmeyen Yazar",
      year: data.year && typeof data.year === "number" ? data.year : null,
      doi:
        data.doi && typeof data.doi === "string" && data.doi.trim()
          ? data.doi.trim()
          : null,
      abstract:
        data.abstract &&
        typeof data.abstract === "string" &&
        data.abstract.trim()
          ? data.abstract.trim()
          : null,
    };
  } catch (error) {
    console.error("Error in extractAcademicMetadata:", error);
    return {
      title: fallbackTitle,
      authors: "Bilinmeyen Yazar",
      year: null,
      doi: null,
      abstract: null,
    };
  }
}

/**
 * Generates structured context integration recommendations and APA citations for reading notes
 * in reference to active thesis core parameters.
 */
export async function generateNoteSuggestions(
  content: string,
  core: unknown,
  ref: unknown,
  semanticSources?: {
    authors: string | null;
    year: number | null;
    title: string;
    shortContent: string;
  }[],
): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error(
      "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  let thesisContext = "";
  if (core && typeof core === "object") {
    const c = core as Record<string, unknown>;
    thesisContext =
      `FİKRİ KESKİNLEŞTİRİLECEK ETKİN TEZ ANAYASASI:\n` +
      `- Başlık: ${c.title || ""}\n` +
      `- Araştırma Sorusu: ${c.researchQuestion || ""}\n` +
      `- Ana Argüman/Hipotez: ${c.argument || ""}\n` +
      `- Yöntem/Teorik Çatı: ${c.methodology || ""}\n\n`;
  } else {
    thesisContext = `TEZ ANAYASASI: Henüz tanımlanmadı. Genel akademik standartlar ve kuramsal entegrasyon kuralları çerçevesinde analiz yapın.\n\n`;
  }

  let sourceMetadata = "";
  if (ref && typeof ref === "object") {
    const r = ref as Record<string, unknown>;
    sourceMetadata =
      `KAYNAK DÖKÜMAN BİLGİLERİ (KÜNYE):\n` +
      `- Başlık (Title): ${r.title || ""}\n` +
      `- Yazarlar (Authors): ${r.authors || "Bilinmiyor"}\n` +
      `- Yıl (Year): ${r.year || "Belirtilmemiş"}\n` +
      `- DOI: ${r.doi || "Mevcut Değil"}\n` +
      `- Özet (Abstract): ${r.abstract || "Mevcut Değil"}\n\n`;
  } else {
    sourceMetadata = "KAYNAK DÖKÜMAN BİLGİLERİ: Mevcut Değil.\n\n";
  }

  const c = (core && typeof core === "object" ? core : {}) as Record<
    string,
    unknown
  >;
  const thesisTitle = c.title || "Belirtilmemiş";
  const thesisQuestion = c.researchQuestion || "Belirtilmemiş";
  const thesisArgument = c.argument || "Belirtilmemiş";
  const thesisMethodology = c.methodology || "Belirtilmemiş";

  let semanticContext = "";
  if (semanticSources && semanticSources.length > 0) {
    semanticContext = `KULLANICININ KÜTÜPHANESİNDEKİ DİĞER İLİŞKİLİ KAYNAKLAR (SEMANTİK BAĞLAM):\n`;
    semanticSources.forEach((src, idx) => {
      semanticContext += `Kaynak ${idx + 1}:\n`;
      semanticContext += `- Yazar(lar): ${src.authors || "Bilinmeyen Yazar"}\n`;
      semanticContext += `- Yayın Yılı: ${src.year || "Belirtilmemiş"}\n`;
      semanticContext += `- Başlık: ${src.title || "Başlıksız Kaynak"}\n`;
      semanticContext += `- Kısa İçerik (Semantik Eşleşme): ${src.shortContent.substring(0, 800).trim()}...\n\n`;
    });
  }

  const systemPrompt =
    "Sen sosyal bilimler alanında uzman, son derece seçkin, eleştirel, yöntemsel hassasiyete ve sarsılmaz bir akademik ahlaka sahip bir Akademik Tez Danışmanısın (Profesör).\n" +
    "Görevin, kullanıcının kütüphanesindeki bir makaleden aldığı ham okuma notunu, onun aktif tez konusu ve teorik/ampirik odak alanlarıyla ilişkilendirerek yapılandırılmış bir entegrasyon önerisi ve atıf künyesi üretmektir.\n\n" +
    "KATI AKADEMİK DÜRÜSTLÜK FİLTRESİ VE DENETİM PROTOKOLÜ:\n" +
    "1. Kullanıcı tarafından girilen not içeriği (KULLANICININ YENİ EKLEDİĞİ HAM NOT METNİ) akademi dışı (gündelik/kişisel/gayriakademik) bir konu içeriyorsa,\n" +
    `2. VEYA girilen notun, kullanıcının mevcut tez konusuyla (Tez Başlığı: '${thesisTitle}', Araştırma Sorusu: '${thesisQuestion}', Ana Argüman: '${thesisArgument}', Metodoloji/Yöntem: '${thesisMethodology}') doğrudan/somut ve anlamlı bir bağı bulunmuyorsa (tez anayasasındaki kavramlardan, teorilerden veya odak alanından çıkarılan mantıklı/akademik çıkarımlara dayanarak),\n` +
    "3. VEYA bu bağ son derece zorlama, yapay ve yüzeysel ise;\n" +
    "ASLA uydurma akademik öneriler veya entegrasyon bağlamları üretmeyeceksin! Doğrudan ve KESİNLİKLE sadece şu yapılandırılmış gerekçeli reddi döndüreceksin:\n" +
    `"Bu girdinin mevcut tez çalışmanızla doğrudan bir ilgisi bulunmamaktadır. Nedeni: [Girdinin tezin ampirik/teorik odak sınırlarının neden dışında kaldığını açıklayan analitik ve yapısal gerekçe.]"\n\n` +
    "Eğer girdi bu filtreyi başarıyla geçerse (yani yukarıdaki tez konusu, kavramlar veya ampirik odakla doğrudan ve somut bir bağı bulunuyorsa/akademik olarak alakalı ise), o zaman KESİNLİKLE şu iki bölümü içerecek şekilde Markdown formatında yanıt üret:\n\n" +
    "### Entegrasyon Önerisi\n" +
    "[Bu notun, aktif tezin hangi kavramsal katmanına veya hangi bölümüne nasıl entegre edilebileceğine dair pratik, keskin ve 2-3 cümlelik somut bir taktiksel akademik öneri yazın.]\n\n" +
    "### Akademik Atıf\n" +
    "[Döküman verilerine dayanarak temiz bir APA formatında akademik atıf künyesi oluşturun.]\n\n" +
    "UYUM KURAL VE KISITLAMALARI:\n" +
    "- KESİNLİKLE UYULMASI ZORUNLU ÇAPRAZ ATIF KURALI: Eğer sana 'KULLANICININ KÜTÜPHANESİNDEKİ DİĞER İLİŞKİLİ KAYNAKLAR (SEMANTİK BAĞLAM)' başlığı altında kaynaklar beslenmişse, üreteceğin 'Entegrasyon Önerisi' metninin içinde bu kaynaklara (Yazar Soyadı, Yayın Yılı) belirterek somut, görünür akademik atıflar yapmak ZORUNDASIN. Örnek: 'Bu durum kütüphanenizdeki Whitaker & Müller (2024) çalışmasının siyah kutu argümanıyla örtüşmektedir...' veya 'Chen vd. (2024) tarafından öne sürülen rasyonel verimlilik düğüm noktasının aksine...' şeklinde kütüphanede halihazırda var olan kaynakların metadatalarını metne açıkça enjekte et, asla soyut geçiştirme.\n" +
    "- Türkçe dilinde, son derece yapıcı, samimi ve doğrudan bir akademik üslup kullan. Kullanıcının adını yalnızca ilk cümlede bir kez kullan, sonra tekrarlama.\n" +
    "- Entegrasyon önerisini 2-3 cümle ile sınırla, lafı uzatma, doğrudan stratejik katma değere odaklan.\n" +
    "- Üretilen olumlu yanıt KESİNLİKLE VE SADECE '### Entegrasyon Önerisi' ve '### Akademik Atıf' başlıklarından oluşmalıdır. Başka hiçbir ek metin, giriş veya kapanış ifadesi barındırma.";

  const userPrompt =
    `${thesisContext}` +
    `${sourceMetadata}` +
    `${semanticContext}` +
    `KULLANICININ YENİ EKLEDİĞİ HAM NOT METNİ:\n` +
    `"${content.trim()}"\n\n` +
    `Lütfen yukarıdaki kurallara ve tez anayasasına sadık kalarak, bu notu analiz et, entegrasyon önerisini ve atıf künyesini üret.`;

  const geminiResponse = await generateContentWithRetry(ai, {
    model: "gemini-3.1-flash-lite",
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 1,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  return geminiResponse.text ? geminiResponse.text.trim() : null;
}
