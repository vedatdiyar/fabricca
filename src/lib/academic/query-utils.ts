/**
 * Semantic query interface representing the OpenAlex GTE-Large-EN vector paragraph
 * and targeted lexical search queries for OpenAlex 100 req/s full-text search.
 */
export interface DualSemanticQuery {
  openAlexQuery: string;
  openAlexLexicalQueries?: string[];
}

/**
 * Parses a stored semantic query string into an OpenAlex vector query and lexical queries.
 * Supports backwards compatibility with legacy JSON fields (`openAlexSearchPhrases`, `openAlexSearchPhrase`) and plain strings.
 *
 * @param rawQuery - Raw string from database or API.
 * @returns DualSemanticQuery containing openAlexQuery and optional openAlexLexicalQueries.
 */
export function parseDualSemanticQuery(
  rawQuery: string | null | undefined,
): DualSemanticQuery {
  if (!rawQuery) {
    return { openAlexQuery: "" };
  }
  const trimmed = rawQuery.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        const oa = (parsed.openAlexQuery || parsed.openAlex || "").trim();
        let lexical: string[] | undefined;
        if (Array.isArray(parsed.openAlexLexicalQueries)) {
          lexical = parsed.openAlexLexicalQueries
            .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
            .map((p: string) => p.trim());
        } else if (Array.isArray(parsed.openAlexSearchPhrases)) {
          // Backwards compatibility for records created with legacy field name
          lexical = parsed.openAlexSearchPhrases
            .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
            .map((p: string) => p.trim());
        } else if (typeof parsed.openAlexSearchPhrase === "string" && parsed.openAlexSearchPhrase.trim()) {
          lexical = [parsed.openAlexSearchPhrase.trim()];
        }

        if (oa) {
          return {
            openAlexQuery: oa,
            openAlexLexicalQueries: lexical,
          };
        }
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  return { openAlexQuery: trimmed };
}

/**
 * Serializes an OpenAlex query and lexical queries into a JSON string for database storage.
 *
 * @param openAlexQuery - Rich semantic paragraph query for OpenAlex.
 * @param openAlexLexicalQueries - Targeted lexical queries for OpenAlex 100 req/s text search.
 * @returns JSON string containing the serialized query.
 */
export function serializeDualSemanticQuery(
  openAlexQuery: string,
  openAlexLexicalQueries?: string[],
): string {
  const payload: {
    openAlexQuery: string;
    openAlexLexicalQueries?: string[];
  } = {
    openAlexQuery: openAlexQuery.trim(),
  };

  if (openAlexLexicalQueries && openAlexLexicalQueries.length > 0) {
    payload.openAlexLexicalQueries = openAlexLexicalQueries
      .map((p) => p.trim())
      .filter(Boolean);
  }

  return JSON.stringify(payload);
}


