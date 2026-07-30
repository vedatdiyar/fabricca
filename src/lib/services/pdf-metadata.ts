import { z } from "zod";
import { generateStructuredContent } from "@/lib/services/cerebras";
import { CEREBRAS_MODEL } from "@/lib/constants";
import { CROSSREF_USER_AGENT } from "@/lib/api-utils";
import { formatAuthorList, extractCrossrefYear } from "@/lib/academic/utils";
import type { Logger } from "@/lib/logger";
import type { UnstructuredChunk } from "@/lib/services/unstructured";

export interface PdfMetadataResult {
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear: number;
  doi?: string;
  abstract?: string;
}

const DOI_REGEX = /10\.\d{4,}\/[-._;()/:A-Z0-9]+/i;

function extractDoiFromText(text: string): string | null {
  const match = text.match(DOI_REGEX);
  return match ? match[0].replace(/\.$/, "") : null;
}

function findDoiInChunks(chunks: UnstructuredChunk[]): string | null {
  for (const chunk of chunks) {
    const doi = extractDoiFromText(chunk.content);
    if (doi) return doi;
  }
  return null;
}

function extractIsbnFromText(text: string): string | null {
  const match = text.match(
    /\b(?:ISBN(?:-1[03])?[:\s]*)?(97[89]\d{10}|\d{9}[\dX])\b/i,
  );
  if (!match) return null;
  const cleaned = match[1].replace(/[-\s]/g, "").toUpperCase();
  if (/^\d{13}$/.test(cleaned) && /^97[89]/.test(cleaned)) return cleaned;
  if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned;
  return null;
}

function findIsbnInChunks(chunks: UnstructuredChunk[]): string | null {
  for (const chunk of chunks) {
    const isbn = extractIsbnFromText(chunk.content);
    if (isbn) return isbn;
  }
  return null;
}

function buildMetadataText(chunks: UnstructuredChunk[]): string {
  return chunks
    .slice(0, 5)
    .map((c) => c.content)
    .join("\n\n")
    .slice(0, 4000);
}

function fallbackMetadataFromFileName(fileName: string): PdfMetadataResult {
  const title =
    fileName
      .replace(/\.pdf$/i, "")
      .replace(/[-_]/g, " ")
      .trim() || "İsimsiz Akademik Eser";
  return {
    title,
    authors: ["Bilinmeyen Yazar"],
    publicationYear: new Date().getFullYear(),
  };
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
    };
  } catch {
    return null;
  }
}

interface OpenLibraryBook {
  title?: string;
  authors?: { key: string; name: string }[];
  publishers?: { name: string }[];
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

    return {
      title: data.title,
      authors: data.authors?.map((a) => a.name).filter(Boolean) || [
        "Bilinmeyen Yazar",
      ],
      publicationYear: year,
      publisher: data.publishers?.[0]?.name || undefined,
    };
  } catch {
    return null;
  }
}

const metadataSchema = z.object({
  title: z.string().min(1).describe("Makalenin tam başlığı"),
  authors: z.array(z.string()).describe("Yazar listesi (ad soyad)"),
  publicationYear: z.number().int().min(1900).max(2100).describe("Yayın yılı"),
  publisher: z.string().optional().describe("Yayınevi veya dergi adı"),
  doi: z.string().optional().describe("DOI numarası (varsa)"),
  abstract: z.string().optional().describe("Makale özeti (varsa)"),
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
    publisher: { type: "string", description: "Yayınevi veya dergi adı" },
    doi: { type: "string", description: "DOI numarası (varsa)" },
    abstract: { type: "string", description: "Makale özeti (varsa)" },
  },
  required: ["title", "authors", "publicationYear"],
  additionalProperties: false,
};

type MetadataResponse = z.infer<typeof metadataSchema>;

async function extractMetadataWithCerebras(
  chunkText: string,
  log: Logger,
): Promise<PdfMetadataResult | null> {
  const systemInstruction =
    "Sen akademik bir makalenin ilk sayfasındaki metni okuyarak bibliyografik metadata çıkaran bir asistansın. " +
    "Yanıtını her zaman belirtilen JSON şemasına uygun olarak ver. " +
    "Yazar isimlerini 'Ad Soyad' formatında, birden fazla varsa dizi olarak döndür.";

  const prompt =
    "Aşağıdaki akademik makale metninden başlık, yazarlar, yayın yılı, yayınevi/dergi, DOI ve özet bilgilerini çıkar.\n\n" +
    chunkText.slice(0, 4000);

  try {
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
      authors:
        result.authors.length > 0 ? result.authors : ["Bilinmeyen Yazar"],
      publicationYear: result.publicationYear,
      publisher: result.publisher || undefined,
      doi: result.doi || undefined,
      abstract: result.abstract || undefined,
    };
  } catch {
    return null;
  }
}

export async function extractPdfMetadata(
  chunks: UnstructuredChunk[],
  fileName: string,
  log: Logger,
): Promise<PdfMetadataResult> {
  const metadataText = buildMetadataText(chunks);

  const doi = findDoiInChunks(chunks);
  if (doi) {
    log.info("pdf_metadata_doi_found", {
      service: "library",
      data: { doi },
    });

    const crossrefResult = await fetchCrossrefByDoi(doi);
    if (crossrefResult) {
      log.info("pdf_metadata_crossref_success", {
        service: "library",
        data: { title: crossrefResult.title, doi },
      });
      return crossrefResult;
    }

    log.warn("pdf_metadata_crossref_failed", {
      service: "library",
      data: { doi },
    });
  }

  const isbn = findIsbnInChunks(chunks);
  if (isbn) {
    log.info("pdf_metadata_isbn_found", {
      service: "library",
      data: { isbn },
    });

    const openLibResult = await fetchOpenLibraryByIsbn(isbn);
    if (openLibResult) {
      log.info("pdf_metadata_openlibrary_success", {
        service: "library",
        data: { title: openLibResult.title, isbn },
      });
      return openLibResult;
    }

    log.warn("pdf_metadata_openlibrary_failed", {
      service: "library",
      data: { isbn },
    });
  }

  if (metadataText.length > 50) {
    log.info("pdf_metadata_cerebras_start", {
      service: "library",
      data: { textLength: metadataText.length, hasDoi: !!doi },
    });

    const cerebrasResult = await extractMetadataWithCerebras(metadataText, log);
    if (cerebrasResult) {
      log.info("pdf_metadata_cerebras_success", {
        service: "library",
        data: { title: cerebrasResult.title },
      });
      return cerebrasResult;
    }
  }

  log.warn("pdf_metadata_fallback_used", {
    service: "library",
    data: { fileName },
  });

  return fallbackMetadataFromFileName(fileName);
}
