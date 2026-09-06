import { sql, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { chunks, sources, boxes } from "@/core/db/schema";
import type { BoxTypeFilter } from "./types";

export { buildLexicalTsQuery } from "./tsquery";

/** Single lexical candidate returned by the FTS branch. */
export interface LexicalCandidate {
  id: number;
  resourceId: number;
  chunkIndex: number;
  content: string;
  section: string | null;
  headerHierarchy: string[] | null;
  pageNumber: string | null;
  title: string;
  authors: string[] | null;
  publicationYear: number | null;
  boxType?: string | null;
}

/** Options controlling the lexical search query. */
export interface LexicalSearchOptions {
  resourceIds?: number[];
  topK?: number;
  boxTypeFilter?: BoxTypeFilter;
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
  const { resourceIds, topK = 30, boxTypeFilter } = options;

  const conditions = [
    sql`${chunks.searchVector} @@ (to_tsquery('turkish', ${tsQuery}) || to_tsquery('english', ${tsQuery}))`,
    sql`${boxes.boxType} <> 'RELATED_THESES'`,
    sql`${chunks.chunkType} NOT IN ('AUTHOR_BIO', 'REFERENCES')`,
  ];
  if (boxTypeFilter === "PRIMARY_MATERIAL_ONLY") {
    conditions.push(sql`${boxes.boxType} = 'PRIMARY_MATERIAL'`);
  } else if (boxTypeFilter === "SECONDARY_LITERATURE_ONLY") {
    conditions.push(sql`${boxes.boxType} <> 'PRIMARY_MATERIAL'`);
  }
  if (resourceIds && resourceIds.length > 0) {
    conditions.push(sql`${chunks.sourceId} IN ${resourceIds}`);
  }

  const rankExpression = sql`ts_rank_cd(${chunks.searchVector}, (to_tsquery('turkish', ${tsQuery}) || to_tsquery('english', ${tsQuery})))`;

  const rows = await db
    .select({
      id: chunks.id,
      resourceId: chunks.sourceId,
      chunkIndex: chunks.chunkIndex,
      content: chunks.content,
      section: chunks.section,
      headerHierarchy: chunks.headerHierarchy,
      pageNumber: chunks.pageNumber,
      title: sources.title,
      authors: sources.authors,
      publicationYear: sources.publicationYear,
      boxType: boxes.boxType,
    })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .innerJoin(boxes, eq(sources.boxId, boxes.id))
    .where(sql.join(conditions, sql` AND `))
    .orderBy(sql`${rankExpression} DESC`)
    .limit(topK);

  return rows as LexicalCandidate[];
}
