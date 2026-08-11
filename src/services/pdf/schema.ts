import type { JsonSchema } from "@/services/ai";

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
    documentType?:
      "article-journal" | "book" | "chapter" | "thesis" | "other" | null;
    title?: string | null;
    containerTitle?: string | null;
    authors?: Array<{
      name: string;
      role: "author" | "editor" | "translator";
    }>;
    year?: number | null;
    publisher?: string | null;
    publisherPlace?: string | null;
  }>;
}

/** Per-page analysis shape used by the chunk builder. */
export interface PageAnalysis {
  pageNumber: number;
  printedPageNumber?: string;
  markdownContent: string;
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
            description:
              "1-based page number within the provided PDF, starting at 1 for the first page of the submitted PDF.",
          },
          printedPageNumber: {
            type: ["string", "null"],
            description:
              "PDF'deki basılı sayfa numarası (ör: 'iv', '12'). Yoksa null.",
          },
          markdownContent: {
            type: "string",
            description:
              "Full page content converted to clean markdown, including page-bottom footnotes appended inline as natural paragraphs. Preserve heading hierarchy (H1/H2/H3), numbered/bulleted lists, tables, emphasis. Strip running headers, footers, standalone page numbers. Do NOT output footnote callout tags like [^n] in paragraph text.",
          },
        },
        required: ["pageNumber", "markdownContent"],
      },
    },
    references: {
      type: "array",
      description:
        "Formal bibliographic entries extracted ONLY from dedicated reference list sections (References, Kaynakça, Bibliography). Do NOT include ibid/a.g.e. shorthand, page-bottom footnotes, or body prose.",
      items: {
        type: "object",
        properties: {
          raw: {
            type: "string",
            description:
              'The complete reference text copied VERBATIM from the source, preserving all diacritics and punctuation exactly as printed. Strip leading entry numbers ("1 ", "10 ").',
          },
          documentType: {
            type: ["string", "null"],
            enum: ["article-journal", "book", "chapter", "thesis", "other"],
            description:
              "Bibliographic item type: 'article-journal' for journal articles, 'book' for standalone books, 'chapter' for edited book chapters, 'thesis' for academic dissertations, 'other' for miscellaneous.",
          },
          title: {
            type: ["string", "null"],
            description:
              "Title of the cited article, book, or chapter. VERBATIM copy. Null only if absent.",
          },
          containerTitle: {
            type: ["string", "null"],
            description:
              "Journal name (for articles) or edited book title (for chapters). Null for standalone books.",
          },
          authors: {
            type: "array",
            description: "Contributors list with explicit role.",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Full name (Given Family or Family Given)",
                },
                role: {
                  type: "string",
                  enum: ["author", "editor", "translator"],
                  description: "Contributor role.",
                },
              },
              required: ["name", "role"],
            },
          },
          year: {
            type: ["number", "null"],
            description:
              "4-digit original publication year (e.g. 1913 in '2012 [1913]', 1910 in '1326/1910'). Null if not explicitly specified.",
          },
          publisher: {
            type: ["string", "null"],
            description:
              "Publishing house or publisher name (e.g. 'Brill', 'Frank Cass', 'İletişim'). For 'City: Publisher' citations (e.g. 'Leiden: Brill', 'İstanbul: İletişim'), extract the publisher after the colon.",
          },
          publisherPlace: {
            type: ["string", "null"],
            description:
              "City or location of publication (e.g. 'Leiden', 'London', 'İstanbul'). For 'City: Publisher' citations (e.g. 'Leiden: Brill', 'İstanbul: İletişim'), extract the city before the colon.",
          },
        },
        required: ["raw"],
      },
    },
  },
  required: ["metadata", "pages", "references"],
  additionalProperties: false,
};

/** JSON Schema for Gemini structured output — references extraction only. */
export const ReferencesOnlySchema: JsonSchema = {
  type: "object",
  properties: {
    references: DocumentAnalysisSchema.properties!.references,
  },
  required: ["references"],
  additionalProperties: false,
};
