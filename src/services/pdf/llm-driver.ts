import { ThinkingLevel } from "@google/genai";
import type { Logger } from "@/lib/logger";
import { generateGeminiStructuredContent } from "@/services/ai";
import { GEMINI_SEED, FLASH_LITE_35 } from "@/lib/constants";
import { buildPdfParserPromptPayload } from "./prompts/pdf-parser.prompt";
import {
  DocumentAnalysisSchema,
  DocumentMetadataZodSchema,
  DocumentReferencesZodSchema,
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
  const userPrompt = `Analyze the provided first pages of the document below. Extract document metadata: title, authors (with name and role), publicationYear, publisher, and DOI if explicitly present. Standardize the document title into standard Academic Title Case (even if printed in ALL CAPS) and author names into Proper Case, preserving acronyms (NATO, YÖK, PKK, DOI, IMF, etc.) in uppercase.\n\n${firstPagesText}`;
  const payload = buildPdfParserPromptPayload(userPrompt);

  try {
    const res = await generateGeminiStructuredContent<{
      metadata?: DocumentAnalysisResult["metadata"];
    }>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      DocumentAnalysisSchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        seed: GEMINI_SEED,
        payloadStage: "pdf_parser_metadata",
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
  const prompt = `Extract all formal bibliography/references entries from these final pages. Return each entry formatted cleanly in the references array.\n\n${bibliographyText}`;
  const systemInstruction =
    "You are an expert academic bibliography parser. Extract formal references strictly adhering to the schema. Ensure all Turkish characters (ç, ğ, ı, ö, ş, ü, İ) are normalized, combined, and perfectly formatted without spaces or lost diacritics.";

  try {
    const res = await generateGeminiStructuredContent<{
      references?: DocumentAnalysisResult["references"];
    }>(FLASH_LITE_35, systemInstruction, prompt, ReferencesOnlySchema, logger, {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      seed: GEMINI_SEED,
      payloadStage: "pdf_parser_references",
    });

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
