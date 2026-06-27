/**
 * Box pipeline — shared business logic for literature review.
 *
 * Contains:
 * - `isArchivalBox` — detects boxes that bypass external APIs
 * - `resolveBoxFoundationalWorks` — Crossref foundational lookups for one box
 */

import { Logger } from "@/lib/logger";
import type { SubBoxInput } from "./literature-review-papers";
import type { JuryArticle } from "@/lib/types";
import { resolveFoundationalWorks } from "./foundational-resolver";

export function isArchivalBox(subBox: SubBoxInput): boolean {
  if (subBox.boxType === "PRIMARY_MATERIAL") return true;
  if (subBox.boxType === "RELATED_THESES") return true;
  if (!subBox.foundationalQueries || subBox.foundationalQueries.length === 0) {
    return false;
  }
  const first = subBox.foundationalQueries[0];
  return (
    first.author === "Primary Source Repository" || first.publicationYear === 0
  );
}

export async function resolveBoxFoundationalWorks(
  box: SubBoxInput,
  logger: Logger,
): Promise<JuryArticle[]> {
  if (!box.foundationalQueries || box.foundationalQueries.length === 0) {
    return [];
  }

  logger.info("literature_foundational_start", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/box-pipeline.ts",
    data: {
      queryCount: box.foundationalQueries.length,
      subBoxTitle: box.title,
      context: `Kutu: ${box.title}`,
    },
  });

  const foundationalStart = performance.now();
  const resolved = await resolveFoundationalWorks(
    box.foundationalQueries,
    logger,
  );

  const articles: JuryArticle[] = resolved.map((fw) => ({
    title: fw.title,
    abstract: "",
    url: fw.id,
    doi: null as string | null,
    publisher: fw.publisher ?? "",
    publicationYear: fw.publicationYear,
    authors: fw.authors,
    isFoundational: true,
    relevanceScore: 100,
  }));

  logger.info("literature_foundational_done", {
    service: "literature",
    durationMs: performance.now() - foundationalStart,
    filePath: "onboarding/literature-review/_services/box-pipeline.ts",
    status: "SUCCESS",
    data: { resultCount: articles.length, context: `Kutu: ${box.title}` },
  });

  return articles;
}
