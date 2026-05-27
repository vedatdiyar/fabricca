import { CandidatePaper } from "./types";

export class SemanticScholarService {
  /**
   * Fetches papers from Semantic Scholar API in parallel using English queries,
   * then maps and deduplicates the candidate papers.
   */
  static async fetchSemanticScholarPapers(
    englishQueries: string[],
    limit: number = 5,
    sort?: "influence" | "citationCount" | "relevance",
  ): Promise<CandidatePaper[]> {
    let semanticScholarPapers: CandidatePaper[] = [];
    if (englishQueries.length === 0) {
      return semanticScholarPapers;
    }

    try {
      // Limit queries to at most 2 to reduce redundancy and completely prevent 429 rate limits
      const targetedQueries = englishQueries.slice(0, 2);
      const s2ResultsArray: Record<string, unknown>[][] = [];

      for (const query of targetedQueries) {
        try {
          // Introduce a 1-second delay to comply with Semantic Scholar's strict free-tier rate limit
          await new Promise((resolve) => setTimeout(resolve, 1000));

          let s2Url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=paperId,title,url,abstract,citationCount,authors,year`;
          if (sort) {
            const apiSort = sort === "citationCount" ? "influence" : sort;
            s2Url += `&sort=${apiSort}`;
          }

          const headers: Record<string, string> = {
            Accept: "application/json",
          };
          if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
            headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
          }

          const s2Res = await fetch(s2Url, {
            method: "GET",
            headers,
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
            s2ResultsArray.push(s2Data.data || []);
          } else {
            console.error(
              `[Teşhis - Semantic Scholar Error for "${query}"]:`,
              s2Text.slice(0, 200),
            );
          }
        } catch (err) {
          console.error(
            `[Teşhis - Semantic Scholar Exception for "${query}"]:`,
            err,
          );
        }
      }
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
