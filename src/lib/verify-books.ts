import { GoogleGenAI } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";

export type BookVerificationStatus = "VERIFIED" | "CORRECTED" | "HALLUCINATION";

export interface BookVerificationResult {
  status: BookVerificationStatus;
  originalTitle: string;
  originalAuthor: string;
  originalPublisher: string;
  originalYear: string;
  correctedTitle?: string;
  correctedAuthor?: string;
  correctedPublisher?: string;
  correctedYear?: string;
  rationale: string;
  notes: string;
}

const VERIFY_PROMPT_TEMPLATE = `Sen bir akademik eser doğrulama uzmanısın. Google Search kullanarak web'de aşağıdaki kitabı araştır ve kesin doğrulama yap.

Kitap: "{title}"
Yazar: "{author}"
Yayınevi: "{publisher}"
Yıl: "{year}"

Görevin:
1. Bu kitabın gerçekten var olup olmadığını web'de saygın kaynakları (yayınevi sitesi, üniversite katalogları, Kitapyurdu, Idefix, Amazon, OpenLibrary) kullanarak araştır.
2. SADECE başlık eşleşmesi yeterli değildir. Yazar, yayınevi ve yıl da eşleşmelidir.
3. En az 2 bağımsız saygın kaynakta doğrulanmalıdır.
4. Sayfa gerçekten kitap detayını gösteriyor mu kontrol et. Snippet'ta başlık görmek yeterli değildir.
5. Ufak farklar varsa (yayınevi adında küçük değişiklik, baskı yılı farkı, dil) düzeltilmiş bilgileri sağla.
6. Hiçbir saygın kaynakta yoksa veya bulunan sayfalar 404/hatalıysa HALLUCINATION olarak işaretle.
7. Sadece 1 kaynakta var ve o da güvenilir değilse (alıntı sitesi, sosyal medya, kullanıcı yorumu) → HALLUCINATION.

Yanıt olarak SADECE ve SADECE aşağıdaki JSON'u döndür. Başına sonuna hiçbir şey ekleme, kod bloğu kullanma, açıklama yazma.
{
  "status": "VERIFIED",
  "originalTitle": "{title}",
  "originalAuthor": "{author}",
  "originalPublisher": "{publisher}",
  "originalYear": "{year}",
  "correctedTitle": "varsa düzeltilmiş başlık, yoksa boş string",
  "correctedAuthor": "varsa düzeltilmiş yazar, yoksa boş string",
  "correctedPublisher": "varsa düzeltilmiş yayınevi, yoksa boş string",
  "correctedYear": "varsa düzeltilmiş yıl, yoksa boş string",
  "notes": "doğrulama notu"
}
`;

/**
 * Ham Gemini yanıtından JSON nesnesini çıkartır.
 * - Kod bloğu (```json ... ```) işaretlerini temizler
 * - İlk { ile son } arasındaki metni alır
 */
function extractJsonFromResponse(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code block fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/i, "");

  // Find first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

export async function verifyBookWithGemini(
  ai: GoogleGenAI,
  book: {
    title: string;
    author: string;
    publisher: string;
    year: string;
    rationale: string;
  },
): Promise<BookVerificationResult> {
  const prompt = VERIFY_PROMPT_TEMPLATE
    .replace(/{title}/g, book.title)
    .replace(/{author}/g, book.author)
    .replace(/{publisher}/g, book.publisher)
    .replace(/{year}/g, book.year);

  const response = await generateContentWithRetry(ai, {
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      temperature: 0.3,
      tools: [{ googleSearch: {} }] as unknown as {
        googleSearch: Record<string, unknown>;
      }[],
    },
  });

  if (!response.text) {
    return {
      status: "HALLUCINATION",
      originalTitle: book.title,
      originalAuthor: book.author,
      originalPublisher: book.publisher,
      originalYear: book.year,
      rationale: book.rationale,
      notes: "Gemini yanıt üretemedi.",
    };
  }

  const jsonStr = extractJsonFromResponse(response.text);

  try {
    const parsed = JSON.parse(jsonStr);

    const result: BookVerificationResult = {
      status: parsed.status || "HALLUCINATION",
      originalTitle: parsed.originalTitle || book.title,
      originalAuthor: parsed.originalAuthor || book.author,
      originalPublisher: parsed.originalPublisher || book.publisher,
      originalYear: parsed.originalYear || book.year,
      rationale: book.rationale,
      notes: parsed.notes || "",
    };

    if (parsed.correctedTitle && parsed.correctedTitle !== "") {
      result.correctedTitle = parsed.correctedTitle;
    }
    if (parsed.correctedAuthor && parsed.correctedAuthor !== "") {
      result.correctedAuthor = parsed.correctedAuthor;
    }
    if (parsed.correctedPublisher && parsed.correctedPublisher !== "") {
      result.correctedPublisher = parsed.correctedPublisher;
    }
    if (parsed.correctedYear && parsed.correctedYear !== "") {
      result.correctedYear = parsed.correctedYear;
    }

    return result;
  } catch {
    return {
      status: "HALLUCINATION",
      originalTitle: book.title,
      originalAuthor: book.author,
      originalPublisher: book.publisher,
      originalYear: book.year,
      rationale: book.rationale,
      notes: "Gemini geçersiz JSON yanıtı döndü.",
    };
  }
}

export async function verifyBooksWithGemini(
  ai: GoogleGenAI,
  books: Array<{
    title: string;
    author: string;
    publisher: string;
    year: string;
    rationale: string;
  }>,
): Promise<BookVerificationResult[]> {
  return Promise.all(
    books.map((book) => verifyBookWithGemini(ai, book)),
  );
}
