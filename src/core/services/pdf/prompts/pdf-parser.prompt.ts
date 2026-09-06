import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

/**
 * Builds the standardized PromptPayload for PDF metadata and page parsing.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param firstPagesText - Text extracted from the first pages of the document.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPdfParserPromptPayload(
  firstPagesText: string,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "You are an expert academic PDF parser. Your role is to analyze provided PDF pages and extract grounded structured metadata.",

    primaryTask:
      "Analyze PDF first pages and running headers to extract accurate document metadata: title, authors, containerTitle (journal or edited book name), publication year, publisher, and DOI strictly grounded in the source text.",

    rulesAndConstraints: `1. **Grounded Extraction & Verbatim Preservation:**
   - Treat the provided PDF text as the absolute limit of truth. Extract facts strictly printed in the source.
    - Standardize document title into standard Academic Title Case (even if printed in ALL CAPS) and author names into Proper Case, preserving acronyms (NATO, AB, YÖK, TBMM, IMF, DOI, etc.) in uppercase.
    - Extract journal name or edited book title into containerTitle if present in running headers, footers, or title blocks (e.g. "Alternatif Politika", "Journal of Social Policy").
   - Output null for missing metadata fields when absent from source text.

2. **Language & Character Normalization:**
   - Ensure all Turkish characters (ç, ğ, ı, ö, ş, ü, İ) are normalized and preserved without corruption.`,

    outputFormat:
      'Return structured JSON with a \'metadata\' object adhering strictly to the provided document metadata schema. Schema: {"metadata": {"title": string|null, "authors": string[], "containerTitle": string|null, "publicationYear": number|null, "publisher": string|null}}',

    inputContext: firstPagesText,

    taskTrigger:
      "Analyze the first pages in <context> and extract document metadata according to <instructions> into structured JSON.",
  });
}

/**
 * Builds the standardized PromptPayload for formal bibliographic references extraction.
 *
 * @param bibliographyText - Combined text of bibliography / reference pages.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPdfReferencesPromptPayload(
  bibliographyText: string,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "You are an expert academic bibliography parser. Your role is to parse formal reference sections into structured citation entries.",

    primaryTask:
      "Extract all formal bibliography entries exclusively from dedicated reference sections into the structured references array.",

    rulesAndConstraints: `1. **Formal Reference Isolation:**
   - Extract formal bibliographic entries exclusively from reference sections (References, Kaynakça, Bibliography).
   - Isolate formal reference list entries from inline citations, body prose, and footnote blocks.
   - Filter out shorthand entry indicators (e.g. "ibid.", "op. cit.", "a.g.e.", "a.g.m.").

2. **Character & Formatting Integrity:**
   - Ensure all Turkish characters (ç, ğ, ı, ö, ş, ü, İ) are normalized, combined, and perfectly preserved.
   - Parse each reference into explicit fields: raw, documentType, title, containerTitle, authors, year, publisher, and publisherPlace.`,

    outputFormat:
      'Return structured JSON with a \'references\' array adhering strictly to the provided schema. Schema: {"references": [{"raw": string, "documentType": string, "title": string, "authors": string[], "year": number|null, "publisher": string|null, "publisherPlace": string|null}]}',

    inputContext: bibliographyText,

    taskTrigger:
      "Extract all formal bibliography entries from <context> and return the structured JSON references array according to <instructions>.",
  });
}

/**
 * Builds the standardized PromptPayload for primary empirical material metadata parsing.
 * Specifically crafted for Social Science research primary sources: interview transcripts,
 * field observations, archival records, court defenses/verdicts, official gazettes, survey
 * reports, or institutional/political declarations.
 *
 * @param firstPagesText - Text extracted from the first pages of the document.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPrimaryMaterialParserPromptPayload(
  firstPagesText: string,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "You are an expert archive, primary source, and qualitative empirical data parser for Social Science research.",

    primaryTask:
      "Analyze the first pages of this primary empirical document (e.g., archival record, interview transcript, survey/statistical report, court defense/verdict, official gazette, political or institutional declaration) and extract accurate metadata: title, authors (issuing institution, organization, court, or participant/informant code), publicationYear, and publisher.",

    rulesAndConstraints: `1. **Empirical Primary Source Grounding:**
   - Treat the provided text as primary research data / archival evidence.
   - Standardize document title into clear Academic Title Case (e.g., "1994 DEP Kapatma Davası Esas Hakkında Savunma Layihası", "Katılımcı K-1 Mülakat Metni", "1995 Genel Seçim Bildirgesi", "TÜİK Hanehalkı İşgücü Raporu").
   - For authors, extract the issuing institution, court, political party, committee, or participant/informant code (e.g., ["Anayasa Mahkemesi"], ["Halkın Demokrasi Partisi (HADEP)"], ["TÜİK"], ["Görüşmeci K-1"]). If a personal informant code or anonymous participant is used, preserve it faithfully.
   - Extract the document year or period into publicationYear (e.g., 1991, 1994, 1999, 2024).
   - Set containerTitle to null (primary empirical materials do not have journal containers).
   - For publisher, use the issuing authority, archive fund, or research project if explicitly stated; otherwise null.
   - Never invent or hallucinate academic journal names, volumes, or DOIs.

2. **Language & Character Normalization:**
   - Ensure all Turkish characters (ç, ğ, ı, ö, ş, ü, İ) are normalized and preserved without corruption.`,

    outputFormat:
      'Return structured JSON with a \'metadata\' object adhering strictly to the provided document metadata schema. Schema: {"metadata": {"title": string|null, "authors": string[], "containerTitle": null, "publicationYear": number|null, "publisher": string|null}}',

    inputContext: firstPagesText,

    taskTrigger:
      "Analyze the primary material first pages in <context> and extract metadata according to <instructions> into structured JSON.",
  });
}
