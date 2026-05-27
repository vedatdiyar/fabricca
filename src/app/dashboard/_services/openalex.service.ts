import { CandidatePaper } from "./types";

interface OpenAlexAuthor {
  display_name: string;
}

interface OpenAlexAuthorship {
  author?: OpenAlexAuthor;
}

interface OpenAlexSource {
  display_name?: string;
}

interface OpenAlexPrimaryLocation {
  landing_page_url?: string;
  source?: OpenAlexSource;
}

interface OpenAlexWork {
  id?: string;
  title?: string;
  publication_year?: number;
  authorships?: OpenAlexAuthorship[];
  primary_location?: OpenAlexPrimaryLocation | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  cited_by_count?: number;
}

export class OpenAlexService {
  /**
   * Reconstructs abstract from OpenAlex's abstract_inverted_index.
   */
  private static parseAbstractInvertedIndex(
    invertedIndex: Record<string, number[]> | null | undefined,
  ): string {
    if (!invertedIndex || typeof invertedIndex !== "object") return "";

    const entries = Object.entries(invertedIndex);
    if (entries.length === 0) return "";

    let maxPos = -1;
    for (const [, positions] of entries) {
      if (Array.isArray(positions)) {
        for (const pos of positions) {
          if (typeof pos === "number" && pos > maxPos) {
            maxPos = pos;
          }
        }
      }
    }

    if (maxPos === -1) return "";

    const words = new Array<string>(maxPos + 1);
    for (const [word, positions] of entries) {
      if (Array.isArray(positions)) {
        for (const pos of positions) {
          if (typeof pos === "number" && pos >= 0) {
            words[pos] = word;
          }
        }
      }
    }

    return words
      .map((w) => w ?? "")
      .join(" ")
      .trim();
  }

  /**
   * Fetches academic papers from OpenAlex API using dynamic language and search term.
   */
  static async fetchOpenAlexPapers(
    query: string,
    lang: "tr" | "en",
    limit: number = 5,
  ): Promise<CandidatePaper[]> {
    if (!query || !query.trim()) {
      return [];
    }

    try {
      const languageFilter = lang === "tr" ? "language:tr" : "language:en";
      const encodedQuery = encodeURIComponent(query.trim());

      // OpenAlex Basic search URL with per_page limit and language filter
      const url = `https://api.openalex.org/works?search=${encodedQuery}&filter=${languageFilter}&per_page=${limit}`;

      console.log(`[OpenAlexService] Fetching: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "FabriccaAcademicClient/1.0 (mailto:academic@fabricca.com)",
        },
      });

      if (!response.ok) {
        console.error(
          `[OpenAlexService] API returned error status: ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as { results?: OpenAlexWork[] };
      const results = data.results || [];

      return results.map((work: OpenAlexWork): CandidatePaper => {
        // Parse authors
        const authorsStr =
          (work.authorships || [])
            .map((a: OpenAlexAuthorship) => a.author?.display_name)
            .filter(Boolean)
            .join(", ") || "Unknown";

        // Parse publication year
        const yearStr = work.publication_year
          ? String(work.publication_year)
          : new Date().getFullYear().toString();

        // Get landing page or PDF URL
        const urlStr = work.primary_location?.landing_page_url || work.id || "";

        // Parse venue/source name
        const venueStr = work.primary_location?.source?.display_name || "";

        // Parse abstract
        let abstractStr = "";
        if (work.abstract_inverted_index) {
          abstractStr = this.parseAbstractInvertedIndex(
            work.abstract_inverted_index,
          );
        }

        // Clean paperId from the work.id URI (e.g., https://openalex.org/W1234567890 -> W1234567890)
        let paperId = work.id || "";
        if (paperId.includes("openalex.org/")) {
          paperId = paperId.split("openalex.org/").pop() || paperId;
        }

        return {
          paperId,
          title: work.title || "Untitled Paper",
          authors: authorsStr,
          year: yearStr,
          url: urlStr,
          abstract: abstractStr,
          source: "OpenAlex",
          lang: lang.toUpperCase() as "TR" | "EN",
          citationCount:
            typeof work.cited_by_count === "number" ? work.cited_by_count : 0,
          venue: venueStr,
        };
      });
    } catch (err) {
      console.error("[OpenAlexService] Exception during fetch:", err);
      return [];
    }
  }
}
