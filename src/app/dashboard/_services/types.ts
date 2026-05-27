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
