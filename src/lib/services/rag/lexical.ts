import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { chunks, sources, boxes } from "@/db/schema";

export { buildLexicalTsQuery } from "./tsquery";

/** Single lexical candidate returned by the FTS branch. */
export interface LexicalCandidate {
  id: number;
  resourceId: number;
  chunkIndex: number;
  content: string;
  parentContent: string | null;
  section: string | null;
  headerHierarchy: string[] | null;
  pageStart: number | null;
  pageEnd: number | null;
  printedPageNumber: string | null;
  title: string;
  authors: string[] | null;
  publicationYear: number | null;
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
    sql`${boxes.boxType} <> 'RELATED_THESES'`,
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
      content: chunks.content,
      parentContent: chunks.parentContent,
      section: chunks.section,
      headerHierarchy: chunks.headerHierarchy,
      pageStart: chunks.pageStart,
      pageEnd: chunks.pageEnd,
      printedPageNumber: chunks.printedPageNumber,
      title: sources.title,
      authors: sources.authors,
      publicationYear: sources.publicationYear,
    })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .innerJoin(boxes, eq(sources.boxId, boxes.id))
    .where(sql.join(conditions, sql` AND `))
    .orderBy(sql`${rankExpression} DESC`)
    .limit(topK);

  return rows as LexicalCandidate[];
}
