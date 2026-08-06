import type { Logger } from "@/lib/logger";
import { sanitizeAndParseJson } from "@/lib/services/gemini";
import { GEMINI_SEED, FLASH_LITE_35 } from "@/lib/constants";
import { PDF_PARSER_SYSTEM_INSTRUCTION } from "@/lib/prompts";
import {
  DocumentAnalysisSchema,
  ReferencesOnlySchema,
  type DocumentAnalysisResult,
} from "./schema";
import type { KeyWorker, PdfBatchMetric } from "./types";
import { selectWorker, parseRetryDelayMs } from "./key-pool";

const PDF_PARSER_MODEL = FLASH_LITE_35;

/**
 * Filters out non-bibliographic entries such as inline body quotes.
 *
 * @param raw - Raw reference string.
 * @returns True if the string appears to be a formal bibliographic entry.
 */
export function isFormalBibliographicEntry(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (
    /^(It was|During|According to|As noted|He claims|She notes|This process|We can see|See also|Quoted in)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  if (trimmed.length > 350 && trimmed.includes("(") && trimmed.includes(")")) {
    return false;
  }

  if (/,\s*(?:[pP]{1,2}|[sS]{1,2})\.\s*\d+\.?$/i.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Parses a batch of scanned PDF pages via Gemini Vision structured output.
 *
 * @param base64Data - Base64-encoded mini-PDF string for the batch.
 * @param startPage - 1-based start page number of this batch.
 * @param batchPageCount - Number of pages in this batch.
 * @param batchIndex - 0-based batch index.
 * @param preferredKeyIndex - Initially assigned key index.
 * @param isFirstBatch - Whether this is the first batch.
 * @param pool - Multi-key worker pool.
 * @param onMetric - Callback for per-batch diagnostics.
 * @param logger - Optional logger instance.
 * @returns Parsed batch result.
 */
export async function parseBatchVision(
  base64Data: string,
  startPage: number,
  batchPageCount: number,
  batchIndex: number,
  preferredKeyIndex: number,
  isFirstBatch: boolean,
  pool: KeyWorker[],
  onMetric: (m: Omit<PdfBatchMetric, "startPage" | "endPage">) => void,
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const endPage = startPage + batchPageCount - 1;
  const batchStart = performance.now();
  const metadataClause = isFirstBatch
    ? "Fill the metadata object with the document's title and authors (plus optional publicationYear, publisher, and DOI). "
    : "";
  const prompt = `The provided PDF contains ${batchPageCount} pages (original document pages ${startPage}-${endPage}). Analyze every page without skipping any. ${metadataClause}Return one page analysis per page, in reading order, with pageNumber starting at 1 for the first page of the provided PDF. Return every bibliography (references) entry that appears on these pages.`;

  const payload = {
    model: PDF_PARSER_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      systemInstruction: PDF_PARSER_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: DocumentAnalysisSchema,
      seed: GEMINI_SEED,
    },
  };

  const MAX_ATTEMPTS = 5;
  let attempts = 0;

  while (true) {
    attempts++;
    const worker = selectWorker(pool, preferredKeyIndex, attempts);
    await worker.gate.wait();

    try {
      const response = await worker.client.models.generateContent(payload);
      const text = response.text;
      if (!text) {
        throw new Error(
          `Gemini boş yanıt döndürdü. Sayfa aralığı: ${startPage}-${endPage}`,
        );
      }

      onMetric({
        durationMs: Math.round(performance.now() - batchStart),
        attempts,
      });

      return sanitizeAndParseJson<DocumentAnalysisResult>(text);
    } catch (error) {
      const is429 =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("RESOURCE_EXHAUSTED") ||
          error.message.includes("Quota exceeded"));
      const is5xx =
        error instanceof Error &&
        (error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("500"));

      if ((is429 || is5xx) && attempts < MAX_ATTEMPTS) {
        if (is429) {
          const retryDelayMs = parseRetryDelayMs(error) ?? 30_000;
          worker.gate.pause(retryDelayMs);
          logger?.info("pdf_parser_gemini_rate_limit_start", {
            service: "pdf-parser",
            data: {
              pages: `${startPage}-${endPage}`,
              keyIndex: worker.keyIndex,
              attempt: attempts,
              pauseMs: retryDelayMs,
            },
          });
        } else {
          await new Promise((r) => setTimeout(r, 2_000 * attempts));
        }
        continue;
      }

      throw error;
    }
  }
}

/**
 * Extracts metadata from document first pages via Gemini.
 *
 * @param firstPagesText - Combined text of document's first pages.
 * @param pool - Multi-key worker pool.
 * @param logger - Optional logger instance.
 * @returns Extracted metadata object.
 */
export async function extractDocumentMetadata(
  firstPagesText: string,
  pool: KeyWorker[],
  logger?: Logger,
): Promise<DocumentAnalysisResult["metadata"]> {
  const worker = selectWorker(pool, 0, 1);
  await worker.gate.wait();

  const prompt = `Analyze the provided first pages of the document below. Extract document metadata: title, authors (with name and role), publicationYear, publisher, and DOI if explicitly present.\n\n${firstPagesText}`;

  try {
    const response = await worker.client.models.generateContent({
      model: PDF_PARSER_MODEL,
      contents: prompt,
      config: {
        systemInstruction: PDF_PARSER_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: DocumentAnalysisSchema,
        seed: GEMINI_SEED,
      },
    });

    const text = response.text;
    if (text) {
      const parsed = sanitizeAndParseJson<DocumentAnalysisResult>(text);
      if (parsed.metadata?.title) {
        return parsed.metadata;
      }
    }
  } catch (err) {
    logger?.info("pdf_parser_metadata_extract_failed", {
      service: "pdf-parser",
      error: err,
    });
  }

  return { title: "", authors: [] };
}

/**
 * Extracts formal bibliography entries from reference pages via Gemini.
 *
 * @param bibliographyText - Combined text of bibliography pages.
 * @param pool - Multi-key worker pool.
 * @param logger - Optional logger instance.
 * @returns List of parsed reference entries.
 */
export async function extractDocumentReferences(
  bibliographyText: string,
  pool: KeyWorker[],
  logger?: Logger,
): Promise<DocumentAnalysisResult["references"]> {
  const worker = selectWorker(pool, 1 % pool.length, 1);
  await worker.gate.wait();

  const prompt = `Extract all formal bibliography/references entries from these final pages. Return each entry formatted cleanly in the references array.\n\n${bibliographyText}`;
  const systemInstruction =
    "You are an expert academic bibliography parser. Extract formal references strictly adhering to the schema. Ensure all Turkish characters (ç, ğ, ı, ö, ş, ü, İ) are normalized, combined, and perfectly formatted without spaces or lost diacritics.";

  try {
    const response = await worker.client.models.generateContent({
      model: PDF_PARSER_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: ReferencesOnlySchema,
        seed: GEMINI_SEED,
      },
    });

    const text = response.text;
    if (text) {
      const parsed = sanitizeAndParseJson<{
        references?: DocumentAnalysisResult["references"];
      }>(text);
      return (parsed.references ?? []).filter((r) =>
        isFormalBibliographicEntry(r.raw),
      );
    }
  } catch (err) {
    logger?.info("pdf_parser_references_extract_failed", {
      service: "pdf-parser",
      error: err,
    });
  }

  return [];
}
