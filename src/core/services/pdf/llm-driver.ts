import { ThinkingLevel } from "@google/genai";
import type { Logger } from "@/lib/logger";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { GEMINI_SEED, FLASH_LITE_35 } from "@/lib/constants";
import {
  buildPdfParserPromptPayload,
  buildPdfReferencesPromptPayload,
} from "./prompts/pdf-parser.prompt";
import {
  DocumentMetadataZodSchema,
  DocumentReferencesZodSchema,
  MetadataOnlySchema,
  ReferencesOnlySchema,
  type DocumentAnalysisResult,
} from "./schema";

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
 * Extracts metadata from document first pages via Gemini Flash-Lite.
 *
 * @param firstPagesText - Combined text of document's first pages.
 * @param logger - Optional logger instance.
 * @returns Extracted metadata object.
 */
export async function extractDocumentMetadata(
  firstPagesText: string,
  logger?: Logger,
): Promise<DocumentAnalysisResult["metadata"]> {
  const payload = buildPdfParserPromptPayload(firstPagesText);

  try {
    const res = await generateGeminiStructuredContent<{
      metadata?: DocumentAnalysisResult["metadata"];
    }>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      MetadataOnlySchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        seed: GEMINI_SEED,
        payloadStage: "pdf_parser_metadata",
        operation: "pdf_read",
        quiet: true,
      },
    );

    if (res.metadata?.title) {
      const validated = DocumentMetadataZodSchema.safeParse(res.metadata);
      if (validated.success) {
        return validated.data;
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
 * Extracts formal bibliography entries from reference pages via Gemini Flash-Lite.
 *
 * @param bibliographyText - Combined text of bibliography pages.
 * @param logger - Optional logger instance.
 * @returns List of parsed reference entries.
 */
export async function extractDocumentReferences(
  bibliographyText: string,
  logger?: Logger,
): Promise<DocumentAnalysisResult["references"]> {
  const payload = buildPdfReferencesPromptPayload(bibliographyText);

  try {
    const res = await generateGeminiStructuredContent<{
      references?: DocumentAnalysisResult["references"];
    }>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      ReferencesOnlySchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        seed: GEMINI_SEED,
        payloadStage: "pdf_parser_references",
        operation: "pdf_read",
        quiet: true,
      },
    );

    if (res.references) {
      const validated = DocumentReferencesZodSchema.safeParse(res);
      const refs = validated.success
        ? validated.data.references
        : res.references;
      return (refs ?? []).filter((r) => isFormalBibliographicEntry(r.raw));
    }
  } catch (err) {
    logger?.info("pdf_parser_references_extract_failed", {
      service: "pdf-parser",
      error: err,
    });
  }

  return [];
}
