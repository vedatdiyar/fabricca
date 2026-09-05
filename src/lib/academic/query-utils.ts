/**
 * Semantic query interface representing the OpenAlex GTE-Large-EN vector paragraph
 * and targeted lexical search queries for OpenAlex 100 req/s full-text search.
 *
 * INVARIANT: openAlexSemanticQuery is ALWAYS English. Turkish content is rejected
 * at generation time (zod refine + eld gate) and never reaches the database.
 */
export interface DualSemanticQuery {
  openAlexSemanticQuery: string;
  openAlexLexicalQueries?: string[];
}

/**
 * Parses a stored semantic query string into an OpenAlex vector query and lexical queries.
 * Only the current `openAlexSemanticQuery` key is recognized — there are no legacy keys.
 * A JSON object without that key is treated as inert (empty semantic query), never as
 * a plain-text query, so stale records can never inject a raw JSON blob into a search channel.
 *
 * @param rawQuery - Raw string from database or API.
 * @returns DualSemanticQuery containing openAlexSemanticQuery and optional openAlexLexicalQueries.
 */
export function parseDualSemanticQuery(
  rawQuery: string | null | undefined,
): DualSemanticQuery {
  if (!rawQuery) {
    return { openAlexSemanticQuery: "" };
  }
  const trimmed = rawQuery.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        const record = parsed as Record<string, unknown>;
        const semantic =
          typeof record.openAlexSemanticQuery === "string"
            ? record.openAlexSemanticQuery.trim()
            : "";
        let lexical: string[] | undefined;
        if (Array.isArray(record.openAlexLexicalQueries)) {
          const cleaned = record.openAlexLexicalQueries
            .filter(
              (p: unknown): p is string =>
                typeof p === "string" && p.trim().length > 0,
            )
            .map((p: string) => p.trim());
          if (cleaned.length > 0) lexical = cleaned;
        }
        return {
          openAlexSemanticQuery: semantic,
          openAlexLexicalQueries: lexical,
        };
      }
    } catch {
      // Malformed JSON is never a query.
    }
    return { openAlexSemanticQuery: "" };
  }

  return { openAlexSemanticQuery: trimmed };
}

/**
 * Serializes an OpenAlex semantic query and lexical queries into a JSON string for database storage.
 *
 * @param openAlexSemanticQuery - Rich English semantic paragraph query for OpenAlex. Must be English.
 * @param openAlexLexicalQueries - Targeted lexical queries for OpenAlex 100 req/s text search.
 * @returns JSON string containing the serialized query.
 */
export function serializeDualSemanticQuery(
  openAlexSemanticQuery: string,
  openAlexLexicalQueries?: string[],
): string {
  const payload: {
    openAlexSemanticQuery: string;
    openAlexLexicalQueries?: string[];
  } = {
    openAlexSemanticQuery: openAlexSemanticQuery.trim(),
  };

  if (openAlexLexicalQueries && openAlexLexicalQueries.length > 0) {
    payload.openAlexLexicalQueries = openAlexLexicalQueries
      .map((p) => p.trim())
      .filter(Boolean);
  }

  return JSON.stringify(payload);
}
