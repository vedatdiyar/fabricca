import type { Logger } from "@/lib/logger";
import { RAG_CONFIG } from "./config";
import { expandAndTranslateQuery, type HyDeExpansionResult } from "./hyde";
import { buildLexicalTsQuery } from "./tsquery";

export interface PreparedRagQueries {
  hydeExpansion: HyDeExpansionResult | null;
  lexicalQueryText: string;
  denseQueryText: string;
  tsQuery: string | null;
  rerankQueryText: string;
}

/**
 * Prepares dense, lexical, and reranking query representations using HyDE expansion.
 *
 * @param query - Raw user query.
 * @param logger - Optional logger.
 * @returns Prepared query texts and tsquery string.
 */
export async function prepareRagQueries(
  query: string,
  logger?: Logger,
): Promise<PreparedRagQueries> {
  const hydeExpansion = await expandAndTranslateQuery(query, logger);

  const lexicalQueryText = hydeExpansion
    ? `${query} ${hydeExpansion.targetTranslation} ${hydeExpansion.targetKeywords.join(" ")}`
    : query;

  const denseQueryText = hydeExpansion
    ? `${query}\n\n${hydeExpansion.targetTranslation}\n\nContext: ${hydeExpansion.hypotheticalSnippet}`
    : query;

  const tsQuery = buildLexicalTsQuery(
    lexicalQueryText,
    RAG_CONFIG.lexicalMaxQueryTokens,
  );

  const rerankQueryText = hydeExpansion
    ? `${query}\n\n${hydeExpansion.targetTranslation}`
    : query;

  return {
    hydeExpansion,
    lexicalQueryText,
    denseQueryText,
    tsQuery,
    rerankQueryText,
  };
}
