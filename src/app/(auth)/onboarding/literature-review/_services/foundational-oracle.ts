import type { Logger } from "@/lib/logger";
import type { GeminiThesisBox, FoundationalQuery } from "@/lib/types";
import {
  bulkFoundationalSelectionSchema,
  BulkFoundationalSelectionResponseSchema,
  buildBulkFoundationalSystemInstruction,
  buildBulkFoundationalSelectionPrompt,
} from "@/lib/prompts";
import type { BulkFoundationalEntry } from "@/lib/prompts";
import { generateStructuredContent } from "@/lib/gemini";
import { searchExa, buildExaConfig } from "./exa-search";
import type { ExaResult } from "./exa-search";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";

interface CrossrefResult {
  doi: string | null;
  publisher: string | null;
  title: string | null;
  author: string | null;
  publicationYear: number | null;
}

function extractYear(item: Record<string, unknown>): number | null {
  const issued = item.issued as { "date-parts"?: number[][] } | undefined;
  const dateParts = issued?.["date-parts"]?.[0];
  if (dateParts?.[0]) return dateParts[0];
  return null;
}

export async function lookupCrossref(
  title: string,
  author: string,
): Promise<CrossrefResult> {
  const mailto = "iletisim@fabricca.com";
  const SELECT_FIELDS = "DOI,title,author,publisher,container-title,issued";

  async function fetchWorks(
    queryParam: string,
    value: string,
  ): Promise<Record<string, unknown>[]> {
    const url = `https://api.crossref.org/works?${queryParam}=${encodeURIComponent(value)}&rows=5&select=${SELECT_FIELDS}&mailto=${mailto}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FabriccaTest/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: { items?: Record<string, unknown>[] };
    };
    return data?.message?.items ?? [];
  }

  let items = await fetchWorks("query.title", title);
  if (items.length === 0) {
    items = await fetchWorks("query.bibliographic", `${author} ${title}`);
  }

  if (items.length === 0)
    return {
      doi: null,
      publisher: null,
      title: null,
      author: null,
      publicationYear: null,
    };

  const best = items[0];
  const rawDoi = best.DOI as string | null | undefined;
  const doi = rawDoi?.trim() || null;
  const publisher =
    (best.publisher as string) ??
    (best["container-title"] as string[])?.[0] ??
    null;

  const rawTitle = (best.title as string[])?.[0] || null;

  const itemAuthorList = best.author as
    { given?: string; family?: string }[] | undefined;
  let parsedAuthor: string | null = null;
  if (itemAuthorList && itemAuthorList.length > 0) {
    parsedAuthor = itemAuthorList
      .map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim())
      .filter((name) => name.length > 0)
      .join(", ");
  }

  const publicationYear = extractYear(best);

  return {
    doi,
    publisher,
    title: rawTitle,
    author: parsedAuthor,
    publicationYear,
  };
}

/**
 * Processes all active parent boxes in a single bulk operation:
 * 1. Runs Exa search for each parent (throttled, concurrency=3)
 * 2. Dispatches one Gemini call to select the best foundational work per parent
 * 3. Per-entry sanity check (hallucination guard) + Crossref enrichment
 *
 * @param parentEntries - Ordered list of parent boxes with pre-generated semantic queries
 * @param thesisMatrix - The thesis matrix for context-aware selection
 * @param logger - Logger instance
 * @returns Map of parent index → enriched FoundationalQuery
 */
export async function processFoundationalSelectionsBulk(
  parentEntries: {
    index: number;
    box: GeminiThesisBox;
    semanticQuery: string;
  }[],
  thesisMatrix: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    methodology: string;
    researchScope: string;
    mainClaim: string;
  },
  logger: Logger,
): Promise<Map<number, FoundationalQuery>> {
  if (parentEntries.length === 0) return new Map();

  // ------------------------------------------------------------------
  // Phase 1: Exa search for each parent (concurrent, throttled)
  // ------------------------------------------------------------------
  const exaLimiter = createConcurrencyLimiter(3);

  const exaTasks = parentEntries.map(async (entry) => {
    const query = entry.semanticQuery;
    if (!query?.trim())
      return { index: entry.index, results: [] as ExaResult[] };

    const boxType = entry.box.boxType ?? "CONCEPTUAL";
    const cfg = buildExaConfig(
      boxType,
      query,
      thesisMatrix.researchScope,
      logger,
    );
    cfg.query = query;

    logger.info("exa_bulk_search_start", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/foundational-oracle.ts",
      data: { parentIndex: entry.index, boxTitle: entry.box.title, boxType },
    });

    const results = await exaLimiter.exec(() => searchExa(cfg, query, logger));

    logger.info("exa_bulk_search_done", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/foundational-oracle.ts",
      data: {
        parentIndex: entry.index,
        resultCount: results.length,
      },
    });

    return { index: entry.index, results };
  });

  const exaResultsByIndex = await Promise.all(exaTasks);

  // ------------------------------------------------------------------
  // Phase 2: Build bulk prompt entries (only parents with results)
  // ------------------------------------------------------------------
  const bulkEntries: BulkFoundationalEntry[] = exaResultsByIndex
    .map(({ index, results }) => {
      const entry = parentEntries.find((e) => e.index === index);
      if (!entry) return null;

      return {
        parentIndex: index,
        boxTitle: entry.box.title,
        boxType: entry.box.boxType ?? "CONCEPTUAL",
        boxDescription: entry.box.description,
        semanticQuery: entry.semanticQuery,
        researchScope: thesisMatrix.researchScope,
        exaResults: results.map((r) => ({
          title: r.title,
          author: r.author ?? null,
          publicationYear: r.publishedDate
            ? new Date(r.publishedDate).getFullYear()
            : null,
          url: r.url ?? null,
          textSnippet: r.text ? r.text.slice(0, 300) : null,
        })),
      } as BulkFoundationalEntry;
    })
    .filter(
      (e): e is BulkFoundationalEntry => e !== null && e.exaResults.length > 0,
    );

  if (bulkEntries.length === 0) {
    logger.warn("bulk_foundational_no_results", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/foundational-oracle.ts",
      data: { totalParents: parentEntries.length },
    });
    return new Map();
  }

  // ------------------------------------------------------------------
  // Phase 3: Single Gemini call for foundational selection
  // ------------------------------------------------------------------
  const response = await generateStructuredContent<{
    selections: {
      parentIndex: number;
      selectedIndex: number;
      refinedTitle: string;
      refinedAuthor: string;
    }[];
  }>(
    "gemini-3.1-flash-lite",
    buildBulkFoundationalSystemInstruction(),
    buildBulkFoundationalSelectionPrompt(thesisMatrix, bulkEntries),
    bulkFoundationalSelectionSchema,
    logger,
    {
      payloadStage: "bulk_foundational_selection",
      zodSchema: BulkFoundationalSelectionResponseSchema,
      seed: 42,
      temperature: 1.0,
      thesisMatrix,
    },
  );

  // ------------------------------------------------------------------
  // Phase 4: Parse, sanity check, Crossref enrichment
  // ------------------------------------------------------------------
  const result = new Map<number, FoundationalQuery>();

  for (const sel of response.selections) {
    const entry = bulkEntries.find((e) => e.parentIndex === sel.parentIndex);
    if (!entry) {
      logger.warn("bulk_foundational_no_entry_match", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/foundational-oracle.ts",
        data: { parentIndex: sel.parentIndex },
      });
      continue;
    }

    const safeIdx = Math.max(
      0,
      Math.min(sel.selectedIndex, entry.exaResults.length - 1),
    );
    const selectedResult = entry.exaResults[safeIdx];

    // Hallucination guard: check if the refined title shares significant words
    // with the actual result title
    const isHallucinated = !selectedResult.title
      .toLowerCase()
      .split(/\s+/)
      .some(
        (word) =>
          word.length > 3 && sel.refinedTitle.toLowerCase().includes(word),
      );

    const safeTitle = isHallucinated ? selectedResult.title : sel.refinedTitle;

    // Crossref enrichment
    const crossrefVerified = await lookupCrossref(safeTitle, sel.refinedAuthor);

    const fq: FoundationalQuery = {
      title: crossrefVerified.title?.trim() || safeTitle,
      author: sel.refinedAuthor,
      publicationYear:
        (crossrefVerified.publicationYear || selectedResult.publicationYear) ??
        0,
      doi: crossrefVerified.doi,
      publisher: crossrefVerified.publisher,
    };

    result.set(sel.parentIndex, fq);

    logger.info("bulk_foundational_selected", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/foundational-oracle.ts",
      data: {
        parentIndex: sel.parentIndex,
        title: fq.title,
        author: fq.author,
        hallucinationFlagged: isHallucinated,
      },
    });
  }

  return result;
}
