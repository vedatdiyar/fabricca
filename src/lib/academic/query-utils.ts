/**
 * Dual semantic query interface representing separated queries for
 * OpenAlex (rich semantic vector description) and Semantic Scholar (concise keywords).
 */
export interface DualSemanticQuery {
  openAlexQuery: string;
  semanticScholarQuery: string;
}

/**
 * Parses a stored semantic query string into distinct OpenAlex and Semantic Scholar queries.
 * Supports backwards compatibility with legacy plain string queries.
 *
 * @param rawQuery - Raw string from database or API.
 * @returns DualSemanticQuery containing openAlexQuery and semanticScholarQuery.
 */
export function parseDualSemanticQuery(
  rawQuery: string | null | undefined,
): DualSemanticQuery {
  if (!rawQuery) {
    return { openAlexQuery: "", semanticScholarQuery: "" };
  }
  const trimmed = rawQuery.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        const oa = (parsed.openAlexQuery || parsed.openAlex || "").trim();
        const s2 = (
          parsed.semanticScholarQuery ||
          parsed.semanticScholar ||
          ""
        ).trim();
        if (oa || s2) {
          return {
            openAlexQuery: oa,
            semanticScholarQuery: s2 || oa.split(/\s+/).slice(0, 7).join(" "),
          };
        }
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const fallbackS2 = words.length > 7 ? words.slice(0, 7).join(" ") : trimmed;
  return {
    openAlexQuery: trimmed,
    semanticScholarQuery: fallbackS2,
  };
}

/**
 * Serializes openAlexQuery and semanticScholarQuery into a unified JSON string for database storage.
 *
 * @param openAlexQuery - Rich semantic paragraph query for OpenAlex.
 * @param semanticScholarQuery - Focused keyword/phrase query for Semantic Scholar.
 * @returns JSON string containing both queries.
 */
export function serializeDualSemanticQuery(
  openAlexQuery: string,
  semanticScholarQuery: string,
): string {
  return JSON.stringify({
    openAlexQuery: openAlexQuery.trim(),
    semanticScholarQuery: semanticScholarQuery.trim(),
  });
}
