import { z } from "zod";
import { generateStructuredContent } from "@/lib/services/cerebras";
import { CEREBRAS_MODEL } from "@/lib/constants";
import { CROSSREF_USER_AGENT } from "@/lib/api-utils";
import { formatAuthorList, extractCrossrefYear } from "@/lib/academic/utils";
import type { Logger } from "@/lib/logger";
import type { DocumentChunk } from "@/lib/services/llamaparse";

export interface PdfMetadataResult {
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear: number;
  doi?: string;
  abstract?: string;
  source: "crossref" | "openlibrary" | "googlebooks" | "cerebras";
}

const DOI_REGEX = /10\.\d{4,}\/[-._;()/:A-Z0-9]+/i;

function extractDoiFromText(text: string): string | null {
  const match = text.match(DOI_REGEX);
  return match ? match[0].replace(/\.$/, "") : null;
}

function findDoiInChunks(chunks: DocumentChunk[]): string | null {
  for (const chunk of chunks) {
    const doi = extractDoiFromText(chunk.content);
    if (doi) return doi;
  }
  return null;
}

function extractIsbnFromText(text: string): string | null {
  // Match ISBN prefix + number or bare ISBN-like number
  // Allows hyphens/spaces within digits (e.g. 978-605-4412-11-2, 0 87068 693 3)
  const match = text.match(
    /\b(?:ISBN(?:-1[03])?[:\s]*)?(\d[\d\s-]{8,}[\dX])\b/i,
  );
  if (!match) return null;
  const cleaned = match[1].replace(/[\s-]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(cleaned)) return cleaned;
  if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned;
  return null;
}

function findIsbnInChunks(chunks: DocumentChunk[]): string | null {
  for (const chunk of chunks) {
    const isbn = extractIsbnFromText(chunk.content);
    if (isbn) return isbn;
  }
  return null;
}

function buildMetadataText(chunks: DocumentChunk[]): string {
  return chunks
    .slice(0, 15)
    .map((c) => c.content)
    .join("\n\n")
    .slice(0, 12000);
}

function isMetadataComplete(result: PdfMetadataResult): boolean {
  const hasValidAuthor =
    result.authors.length > 0 &&
    result.authors[0] !== "Bilinmeyen Yazar" &&
    result.authors[0].trim().length > 0;
  const hasValidPublisher =
    Boolean(result.publisher) && result.publisher!.trim().length > 0;
  return Boolean(result.title) && hasValidAuthor && hasValidPublisher;
}

async function fetchCrossrefByDoi(
  doi: string,
): Promise<PdfMetadataResult | null> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as {
      message?: Record<string, unknown>;
    };
    const message = json.message;
    if (!message) return null;

    const title = ((message.title as string[])?.[0] as string) || "";
    const authors = formatAuthorList(
      message.author as { given?: string; family?: string }[] | undefined,
    );
    const year = extractCrossrefYear(message) || new Date().getFullYear();
    const containerTitle =
      ((message["container-title"] as string[])?.[0] as string) || undefined;
    const publisher =
      containerTitle || (message.publisher as string) || undefined;
    const abstractText = (message.abstract as string) || undefined;

    return {
      title,
      authors: authors.length > 0 ? authors : ["Bilinmeyen Yazar"],
      publicationYear: year,
      publisher,
      doi,
      abstract: abstractText,
      source: "crossref",
    };
  } catch {
    return null;
  }
}

interface OpenLibraryBook {
  title?: string;
  authors?: ({ key?: string; name?: string } | string)[];
  publishers?: (string | { name?: string })[];
  publish_date?: string;
}

async function fetchOpenLibraryByIsbn(
  isbn: string,
): Promise<PdfMetadataResult | null> {
  const url = `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as OpenLibraryBook;
    if (!data.title) return null;

    const yearMatch = data.publish_date?.match(/\d{4}/);
    const year = yearMatch
      ? parseInt(yearMatch[0], 10)
      : new Date().getFullYear();

    // 1. Extract Publisher (supports string array or object array)
    let publisher: string | undefined;
    if (Array.isArray(data.publishers) && data.publishers.length > 0) {
      const p = data.publishers[0];
      publisher = typeof p === "string" ? p : p.name;
    }

    // 2. Extract Authors (fetches author name via key if name property is omitted)
    const authors: string[] = [];
    if (Array.isArray(data.authors)) {
      for (const a of data.authors) {
        if (typeof a === "string") {
          authors.push(a);
        } else if (a.name) {
          authors.push(a.name);
        } else if (a.key) {
          try {
            const authorRes = await fetch(
              `https://openlibrary.org${a.key}.json`,
              {
                headers: { "User-Agent": CROSSREF_USER_AGENT },
                signal: AbortSignal.timeout(5000),
              },
            );
            if (authorRes.ok) {
              const authorData = (await authorRes.json()) as { name?: string };
              if (authorData.name) authors.push(authorData.name);
            }
          } catch {
            /* ignore author key fetch failure */
          }
        }
      }
    }

    return {
      title: data.title,
      authors: authors.length > 0 ? authors : ["Bilinmeyen Yazar"],
      publicationYear: year,
      publisher: publisher || undefined,
      source: "openlibrary",
    };
  } catch {
    return null;
  }
}

interface GoogleBooksItem {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
  };
}

async function fetchGoogleBooksByIsbn(
  isbn: string,
): Promise<PdfMetadataResult | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${keyParam}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      totalItems?: number;
      items?: GoogleBooksItem[];
    };
    if (!data.items || data.items.length === 0) return null;

    const volume = data.items[0].volumeInfo;
    if (!volume?.title) return null;

    const yearMatch = volume.publishedDate?.match(/\d{4}/);
    const year = yearMatch
      ? parseInt(yearMatch[0], 10)
      : new Date().getFullYear();

    const authors =
      Array.isArray(volume.authors) && volume.authors.length > 0
        ? volume.authors
        : ["Bilinmeyen Yazar"];

    return {
      title: volume.title,
      authors,
      publicationYear: year,
      publisher: volume.publisher || undefined,
      source: "googlebooks",
    };
  } catch {
    return null;
  }
}

const metadataSchema = z.object({
  title: z.string().min(1).describe("Makalenin tam başlığı"),
  authors: z.array(z.string()).describe("Yazar listesi (ad soyad)"),
  publicationYear: z.coerce
    .number()
    .int()
    .min(1800)
    .max(2100)
    .describe("Yayın yılı"),
  publisher: z
    .string()
    .nullable()
    .optional()
    .describe("Yayınevi veya dergi adı"),
  doi: z.string().nullable().optional().describe("DOI numarası (varsa)"),
  abstract: z.string().nullable().optional().describe("Makale özeti (varsa)"),
});

const metadataJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Makalenin tam başlığı" },
    authors: {
      type: "array",
      items: { type: "string", description: "Yazar adı soyadı" },
      description: "Yazar listesi",
    },
    publicationYear: { type: "number", description: "Yayın yılı" },
    publisher: {
      type: ["string", "null"],
      description: "Yayınevi veya dergi adı (bulunamazsa null)",
    },
    doi: {
      type: ["string", "null"],
      description: "DOI numarası (bulunamazsa null)",
    },
    abstract: {
      type: ["string", "null"],
      description: "Makale özeti (bulunamazsa null)",
    },
  },
  required: [
    "title",
    "authors",
    "publicationYear",
    "publisher",
    "doi",
    "abstract",
  ],
  additionalProperties: false,
};

type MetadataResponse = z.infer<typeof metadataSchema>;

async function extractMetadataWithCerebras(
  chunkText: string,
  log: Logger,
): Promise<PdfMetadataResult | null> {
  const systemInstruction =
    "Sen akademik bir makale veya kitabın ilk sayfalarındaki metni okuyarak bibliyografik metadata çıkaran bir asistansın. " +
    "Yanıtını her zaman belirtilen JSON şemasına uygun olarak ver.\n" +
    "ÖNEMLİ KURALLAR:\n" +
    "1. ANA MAKALE BAŞLIĞI VE YAZARLARI: Yalnızca sayfanın en üstündeki ana makale başlığını ve ana yazar adını al. Sayfa altındaki DİPNOTLARDA (footnote) veya kaynakça atıflarında geçen başlıkları (örneğin İngilizce tırnak içindeki 'Idle souls.regulated emotions...' gibi makale isimlerini) ve dipnotlardaki kişileri (ör. 'Beşir Fuat') KESİNLİKLE ana makale başlığı veya yazarı olarak ALMA.\n" +
    "2. KATEGORİ ETİKETLERİ: Dergi bölüm/kategori başlıklarını ('DOSYA', 'MAKALELER', 'ARAŞTIRMA', 'ÇEVİRİ') yazar adı veya soyadı olarak ALMA.\n" +
    "3. Yazar isimlerini 'Ad Soyad' formatında, birden fazla varsa dizi olarak döndür.\n" +
    "4. Çıkardığın başlıkları APA Title Case formatına getir (bağlaçlar hariç her kelimenin ilk harfi büyük).\n" +
    "5. Türkçe karakterleri düzelt (I→İ, O→Ö, U→Ü, G→Ğ, S→Ş, C→Ç gibi bozulmuş karakterleri onar; örn. 'EYMA' → 'Şeyma').\n" +
    "6. Yazar isimlerini Proper Case'e çevir (örn. 'AHMET YILMAZ' → 'Ahmet Yılmaz').";

  const prompt =
    "Aşağıdaki akademik eser metninden başlık, yazarlar, yayın yılı, yayınevi/dergi, DOI ve özet bilgilerini çıkar.\n\n" +
    chunkText.slice(0, 12000);

  const result = await generateStructuredContent<MetadataResponse>(
    CEREBRAS_MODEL,
    systemInstruction,
    prompt,
    metadataJsonSchema,
    log,
    {
      payloadStage: "pdf_metadata_extract",
      zodSchema: metadataSchema,
    },
  );

  return {
    title: result.title,
    authors: result.authors.length > 0 ? result.authors : ["Bilinmeyen Yazar"],
    publicationYear: result.publicationYear,
    publisher: result.publisher || undefined,
    doi: result.doi || undefined,
    abstract: result.abstract || undefined,
    source: "cerebras",
  };
}

export async function extractPdfMetadata(
  chunks: DocumentChunk[],
  fileName: string,
  log: Logger,
): Promise<PdfMetadataResult> {
  const metadataText = buildMetadataText(chunks);

  // 1. DOI Path (Academic Papers)
  const doi = findDoiInChunks(chunks);
  if (doi) {
    log.info("pdf_metadata_crossref_start", {
      service: "library",
      data: { doi },
    });

    const crossrefStart = performance.now();
    const crossrefResult = await fetchCrossrefByDoi(doi);

    if (crossrefResult && isMetadataComplete(crossrefResult)) {
      log.info("pdf_metadata_crossref_success", {
        service: "library",
        data: {
          title: crossrefResult.title,
          doi,
          durationMs: Math.round(performance.now() - crossrefStart),
        },
      });
      return crossrefResult;
    }

    log.info("pdf_metadata_crossref_failed", {
      service: "library",
      data: { doi, durationMs: Math.round(performance.now() - crossrefStart) },
    });
  }

  // 2. ISBN Path (Books)
  const isbn = findIsbnInChunks(chunks);
  let partialResult: PdfMetadataResult | null = null;

  if (isbn) {
    // Step 2a: OpenLibrary
    log.info("pdf_metadata_openlibrary_start", {
      service: "library",
      data: { isbn },
    });

    const olStart = performance.now();
    const openLibResult = await fetchOpenLibraryByIsbn(isbn);

    if (openLibResult) {
      if (isMetadataComplete(openLibResult)) {
        log.info("pdf_metadata_openlibrary_success", {
          service: "library",
          data: {
            title: openLibResult.title,
            isbn,
            durationMs: Math.round(performance.now() - olStart),
          },
        });
        return openLibResult;
      }
      partialResult = openLibResult;
    }

    log.info("pdf_metadata_openlibrary_failed", {
      service: "library",
      data: { isbn, durationMs: Math.round(performance.now() - olStart) },
    });

    // Step 2b: Google Books Fallback
    log.info("pdf_metadata_googlebooks_start", {
      service: "library",
      data: { isbn },
    });

    const gbStart = performance.now();
    const googleBooksResult = await fetchGoogleBooksByIsbn(isbn);

    if (googleBooksResult) {
      if (isMetadataComplete(googleBooksResult)) {
        log.info("pdf_metadata_googlebooks_success", {
          service: "library",
          data: {
            title: googleBooksResult.title,
            isbn,
            durationMs: Math.round(performance.now() - gbStart),
          },
        });
        return googleBooksResult;
      }
      if (!partialResult) partialResult = googleBooksResult;
    }

    log.info("pdf_metadata_googlebooks_failed", {
      service: "library",
      data: { isbn, durationMs: Math.round(performance.now() - gbStart) },
    });
  }

  // 3. Cerebras LLM Fallback (Enrich partial metadata or full extraction)
  if (metadataText.length > 50) {
    const cerebrasResult = await extractMetadataWithCerebras(metadataText, log);
    if (cerebrasResult) {
      if (partialResult) {
        return {
          title: partialResult.title || cerebrasResult.title,
          authors:
            partialResult.authors.length > 0 &&
            partialResult.authors[0] !== "Bilinmeyen Yazar"
              ? partialResult.authors
              : cerebrasResult.authors,
          publicationYear:
            partialResult.publicationYear || cerebrasResult.publicationYear,
          publisher: partialResult.publisher || cerebrasResult.publisher,
          doi: partialResult.doi || cerebrasResult.doi,
          abstract: cerebrasResult.abstract,
          source: partialResult.source,
        };
      }
      return cerebrasResult;
    }
  }

  if (partialResult) {
    return partialResult;
  }

  log.error("pdf_metadata_extraction_failed", {
    service: "library",
    data: { fileName, textLength: metadataText.length },
  });

  throw new Error(
    `PDF dosyasından akademik metadata (başlık, yazar, yayın yılı) otomatik çıkarılamadı: ${fileName}`,
  );
}
