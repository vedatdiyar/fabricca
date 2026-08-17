/** A single parsed bibliographic reference extracted from a resource's reference list. */
export interface ParsedReference {
  raw: string;
  documentType:
    "article-journal" | "book" | "chapter" | "thesis" | "other" | null;
  title: string | null;
  containerTitle: string | null;
  authors: Array<{
    name: string;
    role: "author" | "editor" | "translator";
  }>;
  year: number | null;
  publisher: string | null;
  publisherPlace: string | null;
  resolved: boolean;
}
