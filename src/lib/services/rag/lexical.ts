import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { chunks, sources } from "@/db/schema";

export { buildLexicalTsQuery } from "./tsquery";

/** Single lexical candidate returned by the FTS branch. */
export interface LexicalCandidate {
  id: number;
  resourceId: number;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  content: string;
  parentContent: string | null;
  title: string;
  authors: string[] | null;
}

/** Options controlling the lexical search query. */
export interface LexicalSearchOptions {
  resourceIds?: number[];
  topK?: number;
}

/**
 * Executes the PostgreSQL FTS (lexical) search over the generated `search_vector`.
 *
 * @param tsQuery - Safe tsquery body produced by `buildLexicalTsQuery`.
 * @param options - Optional resource filter and candidate count.
 * @returns Lexical candidates ordered by descending `ts_rank`.
 */
export async function searchLexical(
  tsQuery: string,
  options: LexicalSearchOptions = {},
): Promise<LexicalCandidate[]> {
  const { resourceIds, topK = 30 } = options;

  const conditions = [
    sql`${chunks.searchVector} @@ to_tsquery('simple', ${tsQuery})`,
  ];
  if (resourceIds && resourceIds.length > 0) {
    conditions.push(sql`${chunks.sourceId} IN ${resourceIds}`);
  }

  const rankExpression = sql`ts_rank(${chunks.searchVector}, to_tsquery('simple', ${tsQuery}))`;

  const rows = await db
    .select({
      id: chunks.id,
      resourceId: chunks.sourceId,
      chunkIndex: chunks.chunkIndex,
      metadata: chunks.metadata,
      content: chunks.content,
      parentContent: chunks.parentContent,
      title: sources.title,
      authors: sources.authors,
    })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(sql.join(conditions, sql` AND `))
    .orderBy(sql`${rankExpression} DESC`)
    .limit(topK);

  return rows as LexicalCandidate[];
}
