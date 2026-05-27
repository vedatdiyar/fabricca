export interface CandidatePaper {
  paperId: string;
  title: string;
  authors: string;
  year: string;
  url: string;
  abstract: string;
  source: "Semantic Scholar" | "OpenAlex";
  lang: "TR" | "EN";
  citationCount?: number;
  venue?: string;
}

// Yapay zekanın analiz etmesi gereken ana odak bağlamı:
export interface ThesisContext {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
}
