import { GoogleGenAI } from "@google/genai";
import type { Logger } from "@/lib/logger";
import { sanitizeAndParseJson, type JsonSchema } from "@/services/ai";
import { GEMINI_SEED, FLASH_LITE_35 } from "@/lib/constants";
import { PDF_PARSER_SYSTEM_INSTRUCTION } from "@/lib/prompts";
import {
  DocumentAnalysisSchema,
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
 * Creates a single-use Gemini Flash-Lite client from the environment.
 * Falls back gracefully when no key is configured.
 */
function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY_1;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_1 environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Runs a single structured-output Gemini request.
 *
 * @param prompt - The user prompt text.
 * @param schema - The structured-output JSON schema.
 * @param systemInstruction - The system instruction for the call.
 * @param logger - Optional logger instance.
 * @returns The raw response text, or null if the model returned empty output.
 */
async function generateStructured(
  prompt: string,
  schema: JsonSchema,
  systemInstruction: string,
  logger?: Logger,
): Promise<string | null> {
  const client = createGeminiClient();

  try {
    const response = await client.models.generateContent({
      model: FLASH_LITE_35,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        seed: GEMINI_SEED,
      },
    });

    return response.text ?? null;
  } catch (err) {
    logger?.info("llm_driver_generate_structured_error", {
      service: "pdf-parser",
      error: err,
    });
    return null;
  }
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
  const prompt = `Analyze the provided first pages of the document below. Extract document metadata: title, authors (with name and role), publicationYear, publisher, and DOI if explicitly present. Standardize the document title into standard Academic Title Case (even if printed in ALL CAPS) and author names into Proper Case, preserving acronyms (NATO, YÖK, PKK, DOI, IMF, etc.) in uppercase.\n\n${firstPagesText}`;

  try {
    const text = await generateStructured(
      prompt,
      DocumentAnalysisSchema,
      PDF_PARSER_SYSTEM_INSTRUCTION,
      logger,
    );
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
    const text = await generateStructured(
      prompt,
      ReferencesOnlySchema,
      systemInstruction,
      logger,
    );
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
