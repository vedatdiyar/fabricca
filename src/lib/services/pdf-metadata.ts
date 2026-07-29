import { z } from "zod";
import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_31 } from "@/lib/constants";
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
    const publisher = (message.publisher as string) || undefined;
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

const geminiMetadataSchema = z.object({
  title: z.string().min(1).describe("Makalenin tam başlığı"),
  authors: z.array(z.string()).min(1).describe("Yazar listesi (ad soyad)"),
  publicationYear: z.number().int().min(1900).max(2100).describe("Yayın yılı"),
  publisher: z.string().optional().describe("Yayınevi veya dergi adı"),
  doi: z.string().optional().describe("DOI numarası (varsa)"),
  abstract: z.string().optional().describe("Makale özeti (varsa)"),
});

const geminiMetadataJsonSchema: JsonSchema = {
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
};

type GeminiMetadataResponse = z.infer<typeof geminiMetadataSchema>;

async function extractMetadataWithGemini(
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
    const result = await generateStructuredContent<GeminiMetadataResponse>(
      FLASH_LITE_31,
      systemInstruction,
      prompt,
      geminiMetadataJsonSchema,
      log,
      {
        payloadStage: "pdf_metadata_extract",
        zodSchema: geminiMetadataSchema,
        quiet: true,
      },
    );

    return {
      title: result.title,
      authors: result.authors,
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
  const firstChunkText = chunks[0]?.content || "";

  const doi = extractDoiFromText(firstChunkText);
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

  if (firstChunkText.length > 50) {
    log.info("pdf_metadata_gemini_start", {
      service: "library",
      data: { textLength: firstChunkText.length, hasDoi: !!doi },
    });

    const geminiResult = await extractMetadataWithGemini(firstChunkText, log);
    if (geminiResult) {
      log.info("pdf_metadata_gemini_success", {
        service: "library",
        data: { title: geminiResult.title },
      });
      return geminiResult;
    }
  }

  log.warn("pdf_metadata_fallback_used", {
    service: "library",
    data: { fileName },
  });

  return fallbackMetadataFromFileName(fileName);
}
