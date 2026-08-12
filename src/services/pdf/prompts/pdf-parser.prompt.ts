import { buildPromptPayload, type PromptPayload } from "@/lib/ai/prompt-builder";

/**
 * Builds the standardized PromptPayload for PDF parsing.
 *
 * @param userPrompt - The user prompt payload containing PDF text or pages context.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPdfParserPromptPayload(userPrompt: string): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "You are an expert academic PDF parser. Your role is to analyze provided PDF pages and extract grounded structured data.",

    primaryTask:
      "Analyze PDF pages to produce accurate document metadata, page-level markdown content, and formal references strictly grounded in visual text.",

    rulesAndConstraints: `1. **Grounded Extraction & Verbatim Preservation:**
   - Treat the provided PDF text as the absolute limit of truth. Extract facts strictly printed in the source.
   - Preserve printed body and reference text verbatim, maintaining original spellings, archaic words, and diacritics as printed.
   - Exception for METADATA Title & Authors: Apply standard Academic Title Case to document titles and Proper Case to author names while preserving acronyms (NATO, YÖK, PKK, DOI, IMF, etc.) in uppercase.
   - Output null for missing metadata fields when absent from source text.

2. **Markdown Conversion:**
   - Convert each page to clean markdown, preserving H1 (#), H2 (##), and H3 (###) heading hierarchy.
   - Retain numbered/bulleted lists, pipe-delimited tables, inline emphasis, and mathematical notation.
   - Strip running headers, footers, and standalone page numbers while retaining page-bottom footnote text appended inline as natural paragraphs.

3. **Formal Bibliography Extraction:**
   - Extract formal bibliographic entries exclusively from dedicated reference sections (References, Kaynakça, Bibliography). Return an empty array ([]) when no formal reference section exists.
   - Isolate formal reference list entries from inline citations, body prose, and footnote blocks.
   - Filter out shorthand entry indicators (e.g. "ibid.", "op. cit.", "a.g.e.", "a.g.m.") and include complete, standalone entries.
   - Parse each reference into explicit fields: raw, documentType, title, containerTitle, authors, year, publisher, and publisherPlace.`,

    outputFormat:
      "Return structured JSON adhering strictly to the provided document schema in the same language as the source.",

    inputContext: userPrompt,
  });
}
