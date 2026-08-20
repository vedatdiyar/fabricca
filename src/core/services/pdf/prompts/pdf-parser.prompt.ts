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
   - Standardize document title into standard Academic Title Case (even if printed in ALL CAPS) and author names into Proper Case, preserving acronyms (NATO, YÖK, PKK, DOI, IMF, etc.) in uppercase.
   - Extract journal name or edited book title into containerTitle if present in running headers, footers, or title blocks (e.g. "Alternatif Politika", "Routledge Handbook on the Kurds").
   - Output null for missing metadata fields when absent from source text.

2. **Language & Character Normalization:**
   - Ensure all Turkish characters (ç, ğ, ı, ö, ş, ü, İ) are normalized and preserved without corruption.`,

    outputFormat:
      "Return structured JSON with a 'metadata' object adhering strictly to the provided document metadata schema.",

    examples: `<example>
<input>
Alternatif Politika, Cilt. 2, Sayı. 2, 175-194, October 2010
AYRILIKÇI KÜRT HAREKETİNİN TARİHSEL DİNAMİKLERİNE KISA BİR BAKIŞ
Maya ARAKON
</input>
<output>
{
  "metadata": {
    "title": "Ayrılıkçı Kürt Hareketinin Tarihsel Dinamiklerine Kısa Bir Bakış",
    "authors": ["Maya Arakon"],
    "containerTitle": "Alternatif Politika",
    "publicationYear": 2010,
    "publisher": "Alternatif Politika"
  }
}
</output>
</example>`,

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
      "Return structured JSON with a 'references' array adhering strictly to the provided schema.",

    examples: `<example>
<input>
Gunes, C. (2012). The Kurdish National Movement in Turkey: From Protest to Resistance. London: Routledge.
Romano, D. (2006). The Kurdish Nationalist Movement. Cambridge: Cambridge University Press.
</input>
<output>
{
  "references": [
    {
      "raw": "Gunes, C. (2012). The Kurdish National Movement in Turkey: From Protest to Resistance. London: Routledge.",
      "documentType": "book",
      "title": "The Kurdish National Movement in Turkey: From Protest to Resistance",
      "authors": ["Cengiz Gunes"],
      "year": 2012,
      "publisher": "Routledge",
      "publisherPlace": "London"
    },
    {
      "raw": "Romano, D. (2006). The Kurdish Nationalist Movement. Cambridge: Cambridge University Press.",
      "documentType": "book",
      "title": "The Kurdish Nationalist Movement",
      "authors": ["David Romano"],
      "year": 2006,
      "publisher": "Cambridge University Press",
      "publisherPlace": "Cambridge"
    }
  ]
}
</output>
</example>`,

    inputContext: bibliographyText,

    taskTrigger:
      "Extract all formal bibliography entries from <context> and return the structured JSON references array according to <instructions>.",
  });
}
