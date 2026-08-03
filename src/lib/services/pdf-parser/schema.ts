import type { JsonSchema } from "@/lib/services/gemini";

/** Structured result returned by the Gemini PDF parser — metadata, page-level markdown, and parsed references. */
export interface DocumentAnalysisResult {
  metadata: {
    title: string;
    authors: string[];
    publicationYear?: number;
    publisher?: string;
    doi?: string;
  };
  pages: Array<{
    pageNumber: number;
    printedPageNumber?: string;
    markdownContent: string;
  }>;
  references: Array<{
    raw: string;
    title?: string;
    authors?: string[];
    year?: number;
  }>;
}

/** Per-page analysis shape used internally by the chunk builder (extends Gemini output with footnotes). */
export interface PageAnalysis {
  pageNumber: number;
  printedPageNumber?: string;
  markdownContent: string;
  footnotes?: string[];
}

/** JSON Schema for Gemini structured output — each batch analysis entry. */
export const DocumentAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        title: { type: "string", description: "Makalenin tam başlığı" },
        authors: {
          type: "array",
          items: { type: "string" },
          description: "Yazar listesi (ad soyad)",
        },
        publicationYear: {
          type: "number",
          description: "Yayın yılı (biliniyorsa)",
        },
        publisher: {
          type: ["string", "null"],
          description: "Yayınevi veya dergi adı",
        },
        doi: {
          type: ["string", "null"],
          description: "DOI numarası (biliniyorsa)",
        },
      },
      required: ["title", "authors"],
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pageNumber: {
            type: "number",
            description: "1-based page number in the document.",
          },
          printedPageNumber: {
            type: ["string", "null"],
            description:
              "PDF'deki basılı sayfa numarası (ör: 'iv', '12'). Yoksa null.",
          },
          markdownContent: {
            type: "string",
            description:
              "Full page content converted to clean markdown. Preserve heading hierarchy (H1/H2/H3), numbered/bulleted lists, tables, emphasis. Strip running headers, footers, standalone page numbers. Inline footnotes at the end of the relevant paragraph as [^n].",
          },
        },
        required: ["pageNumber", "markdownContent"],
      },
    },
    references: {
      type: "array",
      items: {
        type: "object",
        properties: {
          raw: {
            type: "string",
            description: "Ham referans satırı",
          },
          title: {
            type: ["string", "null"],
            description: "Çıkarılan başlık (varsa)",
          },
          authors: {
            type: "array",
            items: { type: "string" },
            description: "Yazar listesi (varsa)",
          },
          year: {
            type: ["number", "null"],
            description: "Yayın yılı (varsa)",
          },
        },
        required: ["raw"],
      },
    },
  },
  required: ["metadata", "pages", "references"],
  additionalProperties: false,
};
