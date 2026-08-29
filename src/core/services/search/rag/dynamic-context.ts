import { db } from "@/core/db";
import { chunks } from "@/core/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { Logger, createFlowId } from "@/lib/logger";

export interface ChunkTarget {
  resourceId: number;
  chunkIndex: number;
}

/**
 * Fetches the dynamic sliding window (chunkIndex - 1, chunkIndex, chunkIndex + 1)
 * for a list of target chunks in a single batched database query.
 *
 * @param targets - Array of { resourceId, chunkIndex }.
 * @returns Map keyed by `${resourceId}:${chunkIndex}` -> joined 3-chunk window text.
 */
export async function fetchDynamicContextWindows(
  targets: ChunkTarget[],
): Promise<Map<string, string>> {
  const windowMap = new Map<string, string>();
  if (targets.length === 0) return windowMap;

  // Build conditions to fetch targets and their immediate adjacent neighbors (idx - 1, idx, idx + 1)
  const conditions = targets.map((t) =>
    and(
      eq(chunks.sourceId, t.resourceId),
      inArray(chunks.chunkIndex, [
        Math.max(0, t.chunkIndex - 1),
        t.chunkIndex,
        t.chunkIndex + 1,
      ]),
    ),
  );

  try {
    const rows = await db
      .select({
        sourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
        content: chunks.content,
      })
      .from(chunks)
      .where(or(...conditions))
      .orderBy(chunks.sourceId, chunks.chunkIndex);

    // Group by sourceId
    const sourceMap = new Map<number, Map<number, string>>();
    for (const r of rows) {
      if (!sourceMap.has(r.sourceId)) {
        sourceMap.set(r.sourceId, new Map());
      }
      sourceMap.get(r.sourceId)!.set(r.chunkIndex, r.content);
    }

    for (const t of targets) {
      const chunkIdxMap = sourceMap.get(t.resourceId);
      if (!chunkIdxMap) {
        continue;
      }

      const prev = chunkIdxMap.get(t.chunkIndex - 1);
      const curr = chunkIdxMap.get(t.chunkIndex);
      const next = chunkIdxMap.get(t.chunkIndex + 1);

      const parts = [prev, curr, next].filter(
        (p): p is string => typeof p === "string" && p.trim().length > 0,
      );

      const key = `${t.resourceId}:${t.chunkIndex}`;
      windowMap.set(key, parts.join("\n\n"));
    }
  } catch (error) {
    new Logger(createFlowId()).failed("fetch_dynamic_context_windows", {
      service: "rag-search",
      error,
    });
  }

  return windowMap;
}
