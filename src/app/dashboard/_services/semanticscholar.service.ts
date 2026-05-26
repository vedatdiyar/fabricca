import { CandidatePaper } from "./dergipark.service";

export class SemanticScholarService {
  /**
   * Fetches papers from Semantic Scholar API in parallel using English queries,
   * then maps and deduplicates the candidate papers.
   */
  static async fetchSemanticScholarPapers(
    englishQueries: string[],
  ): Promise<CandidatePaper[]> {
    let semanticScholarPapers: CandidatePaper[] = [];
    if (englishQueries.length === 0) {
      return semanticScholarPapers;
    }

    try {
      const s2Promises = englishQueries.map(async (query: string) => {
        try {
          const s2Url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(query)}&fields=paperId,title,url,abstract,citationCount,authors,year`;
          const s2Res = await fetch(s2Url, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          console.log(
            `[Teşhis - Semantic Scholar Status for "${query}"]:`,
            s2Res.status,
          );
          const s2Text = await s2Res.text();
          if (s2Res.ok) {
            const s2Data = JSON.parse(s2Text) as {
              data?: Record<string, unknown>[];
            };
            return s2Data.data || [];
          } else {
            console.error(
              `[Teşhis - Semantic Scholar Error for "${query}"]:`,
              s2Text.slice(0, 200),
            );
            return [];
          }
        } catch (err) {
          console.error(
            `[Teşhis - Semantic Scholar Exception for "${query}"]:`,
            err,
          );
          return [];
        }
      });

      const s2ResultsArray = await Promise.all(s2Promises);
      const s2PapersMap = new Map<string, Record<string, unknown>>();
      for (const papers of s2ResultsArray) {
        for (const p of papers) {
          const paperId = p.paperId as string | undefined;
          if (paperId) {
            s2PapersMap.set(paperId, p);
          }
        }
      }

      semanticScholarPapers = Array.from(s2PapersMap.values()).map((p) => {
        const authorsVal = p.authors;
        let authorsStr = "Unknown";
        if (Array.isArray(authorsVal)) {
          authorsStr = authorsVal
            .map((a) => {
              if (typeof a === "object" && a !== null) {
                const authorObj = a as Record<string, unknown>;
                return typeof authorObj.name === "string"
                  ? authorObj.name
                  : String(a);
              }
              return String(a);
            })
            .join(", ");
        } else if (authorsVal) {
          authorsStr = String(authorsVal);
        }

        const yearVal = p.year;
        const yearStr = yearVal
          ? String(yearVal)
          : new Date().getFullYear().toString();

        return {
          paperId:
            (p.paperId as string) || Math.random().toString(36).substr(2, 9),
          title: (p.title as string) || "Untitled Paper",
          url: (p.url as string) || "",
          abstract: (p.abstract as string) || "",
          citationCount:
            typeof p.citationCount === "number" ? p.citationCount : 0,
          authors: authorsStr,
          year: yearStr,
          source: "Semantic Scholar" as const,
          lang: "EN" as const,
        };
      });
      console.log(
        `[SemanticScholarService] Successfully gathered ${semanticScholarPapers.length} unique papers from Semantic Scholar.`,
      );
    } catch (s2Err) {
      console.error(
        "[SemanticScholarService] Semantic Scholar bulk gathering error:",
        s2Err,
      );
    }

    return semanticScholarPapers;
  }
}
