export class SemanticScholarService {
  /**
   * Fetches papers from Semantic Scholar API in parallel using English queries,
   * then maps and deduplicates the candidate papers.
   */
  static async fetchSemanticScholarPapers(
    englishQueries: string[],
  ): Promise<any[]> {
    let semanticScholarPapers: any[] = [];
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
            const s2Data = JSON.parse(s2Text);
            return s2Data.data || [];
          } else {
            console.error(
              `[Teşhis - Semantic Scholar Error for "${query}"]:`,
              s2Text.slice(0, 200),
            );
            return [];
          }
        } catch (err: any) {
          console.error(
            `[Teşhis - Semantic Scholar Exception for "${query}"]:`,
            err,
          );
          return [];
        }
      });

      const s2ResultsArray = await Promise.all(s2Promises);
      const s2PapersMap = new Map<string, any>();
      for (const papers of s2ResultsArray) {
        for (const p of papers) {
          if (p.paperId) {
            s2PapersMap.set(p.paperId, p);
          }
        }
      }

      semanticScholarPapers = Array.from(s2PapersMap.values()).map(
        (p: any) => ({
          paperId: p.paperId || Math.random().toString(36).substr(2, 9),
          title: p.title || "Untitled Paper",
          url: p.url || "",
          abstract: p.abstract || "",
          citationCount:
            typeof p.citationCount === "number" ? p.citationCount : 0,
          authors: Array.isArray(p.authors)
            ? p.authors
                .map((a: any) =>
                  typeof a === "object" && a?.name ? a.name : String(a),
                )
                .join(", ")
            : String(p.authors || "Unknown"),
          year: p.year ? String(p.year) : new Date().getFullYear().toString(),
          source: "Semantic Scholar" as const,
          lang: "EN" as const,
        }),
      );
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
