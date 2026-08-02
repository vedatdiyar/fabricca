import { Logger } from "@/lib/logger";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type { JuryArticle, LiteraturePoolEntry } from "@/lib/types";
import { sanitizeTargetedArticles } from "@/lib/services/academic-sanitizer";
import type {
  SubBoxInput,
  SubBoxItem,
  RawPaper,
} from "./literature-review-papers";
import {
  searchOpenAlex,
  fetchOpenAlexMetadataBatch,
  healAuthorsByTitle,
} from "./openalex/client";
import {
  extractCleanDoi,
  extractOpenAlexId,
  normalizeCleanTitle,
  areTitlesSimilar,
} from "@/lib/academic/utils";
import { clusterRefMetadata } from "./clustering";
import { analyzeReferenceFrequencies, type QueueItem } from "./selection";
import { evaluateSingleBoxJury, type JuryInputItem } from "./batch-jury";

export interface BatchOrchestrationResult {
  poolEntries: LiteraturePoolEntry[];
  archivalBoxTitles: string[];
}

/** Aggregated result for one active sub-box after Phase 1. */
interface SubBoxResult {
  boxType: string;
  subBoxDescription: string;
  subBox: SubBoxItem;
  thesisBoxId: number;
  candidates: QueueItem["candidates"];
  activeWorks: RawPaper[];
  rawPapers: RawPaper[];
}

/**
 * Converts a co-citation candidate into a raw paper record.
 *
 * @param c - The co-citation candidate queue item.
 * @returns The raw paper representation.
 */
function candidateToRawPaper(c: QueueItem["candidates"][0]): RawPaper {
  return {
    source: "openalex",
    title: c.title,
    metadata: `(kurucu eser adayı, atıf sıklığı: ${c.cluster.combinedFrequency})`,
    doi: c.doi,
    authors: c.authors,
    year: c.year,
    publisher: c.publisher,
    openAlexId: extractOpenAlexId(c.openAlexId),
    isFoundational: false,
    relevanceScore: 0,
    citedByCount: c.cluster.combinedFrequency,
    isCoCitationLeader: true,
    ccFreq: c.cluster.combinedFrequency,
  };
}

interface PoolItem {
  type: "raw" | "cocitation";
  rawPaper: RawPaper;
  citationCount?: number;
}

/**
 * Builds the jury pool for a sub-box from raw papers and co-citation candidates.
 *
 * @param r - The sub-box phase 1 result.
 * @returns The pooled items available for jury evaluation.
 */
function buildPool(r: SubBoxResult): PoolItem[] {
  const raw: PoolItem[] = r.rawPapers.map((p) => ({
    type: "raw" as const,
    rawPaper: p,
  }));
  const cocitation: PoolItem[] = r.candidates.map((c) => ({
    type: "cocitation" as const,
    rawPaper: candidateToRawPaper(c),
    citationCount: c.cluster.combinedFrequency,
  }));
  return [...raw, ...cocitation];
}

/**
 * Runs the full multi-box literature review pipeline across search, jury, selection and persistence phases.
 *
 * @param boxes - The sub-box inputs to process.
 * @param logger - The pipeline logger instance.
 * @param thesisMatrixSubject - Optional thesis subject problem for jury context.
 * @param checkCancelled - Optional callback to abort the pipeline.
 * @param persistSubBox - Optional callback to persist articles per sub-box.
 * @returns The orchestrated pool entries and archival box titles.
 */
export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
  logger: Logger,
  thesisMatrixSubject?: string,
  checkCancelled?: () => boolean,
  persistSubBox?: (
    thesisBoxId: number,
    articles: JuryArticle[],
  ) => Promise<void>,
): Promise<BatchOrchestrationResult> {
  const poolEntries: LiteraturePoolEntry[] = [];
  const archivalBoxTitles: string[] = [];
  const assignedTitles = new Set<string>();
  const assignedRawTitles: string[] = [];
  const limiter = createConcurrencyLimiter(3);

  for (let i = 0; i < boxes.length; i++) {
    if (checkCancelled?.()) break;
    const box = boxes[i];

    if (box.boxType === "PRIMARY_MATERIAL") {
      archivalBoxTitles.push(box.title);
      poolEntries.push({
        subBoxTitle: box.title,
        thesisBoxId: box.id,
        articles: [],
      });
    }
  }

  const activeJobs: { box: SubBoxInput; subBox: SubBoxItem }[] = [];
  for (const box of boxes) {
    if (!box.subBoxes || box.subBoxes.length === 0) continue;
    if (box.boxType === "PRIMARY_MATERIAL") continue;

    for (const subBox of box.subBoxes) {
      activeJobs.push({ box, subBox });
    }
  }

  if (activeJobs.length === 0) {
    return { poolEntries, archivalBoxTitles };
  }

  logger.info("literature_openalex_search_start");

  const phase1Results = await Promise.allSettled(
    activeJobs.map(({ box, subBox }) =>
      limiter.exec(async (): Promise<SubBoxResult> => {
        const query = subBox.semanticQuery?.trim();

        if (!query) {
          return {
            boxType: box.boxType ?? "PROBLEMATIZATION",
            subBoxDescription: subBox.description ?? "",
            subBox,
            thesisBoxId: subBox.thesisBoxId,
            candidates: [],
            activeWorks: [],
            rawPapers: [],
          };
        }

        const rawPapers = await searchOpenAlex(query, 25, checkCancelled);
        const activeWorks = rawPapers.filter(
          (p) =>
            p.referencedWorks &&
            p.referencedWorks.length > 0 &&
            p.title?.trim(),
        );
        const N = activeWorks.length;
        const subBoxCandidates: QueueItem["candidates"] = [];

        if (N > 0) {
          const { leaderIds } = analyzeReferenceFrequencies(activeWorks, N);
          const refMetadata = await fetchOpenAlexMetadataBatch(
            leaderIds,
            checkCancelled,
          );
          const clusters = clusterRefMetadata(refMetadata);

          const mappedCandidates = clusters.slice(0, 5).map((c) => {
            const sortedMembers = [...c.members].sort((a, b) => {
              const hasDoiA = !!a.doi;
              const hasDoiB = !!b.doi;
              if (hasDoiA && !hasDoiB) return -1;
              if (!hasDoiA && hasDoiB) return 1;
              return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
            });
            const chosen = sortedMembers[0];
            return {
              title: chosen.title,
              authors: chosen.authors,
              year: null,
              openAlexId: chosen.id,
              doi: chosen.doi ? extractCleanDoi(chosen.doi) : null,
              publisher: null,
              cluster: c,
            };
          });

          subBoxCandidates.push(...mappedCandidates);
        }

        if (subBoxCandidates.length === 0 && rawPapers.length > 0) {
          const fallbackCandidates = rawPapers
            .filter((p) => p.title?.trim())
            .slice(0, 5)
            .map((p) => ({
              title: p.title!,
              authors: p.authors,
              year: p.year,
              openAlexId: p.openAlexId ?? "",
              doi: p.doi ? extractCleanDoi(p.doi) : null,
              publisher: p.publisher,
              cluster: {
                id: p.openAlexId ?? "",
                canonicalTitle: p.title ?? "",
                members: [],
                combinedFrequency: 1,
                citingModernIndices: [],
              },
            }));
          subBoxCandidates.push(...fallbackCandidates);
        }

        return {
          boxType: box.boxType ?? "PROBLEMATIZATION",
          subBoxDescription: subBox.description ?? "",
          subBox,
          thesisBoxId: subBox.thesisBoxId,
          candidates: subBoxCandidates,
          activeWorks,
          rawPapers,
        };
      }),
    ),
  );

  const fulfilledResults: SubBoxResult[] = [];
  for (const result of phase1Results) {
    if (result.status === "fulfilled") {
      fulfilledResults.push(result.value);
    } else {
      const errorMsg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      logger.error("literature_phase1_subbox_failed", {
        error: errorMsg,
      });
      throw result.reason;
    }
  }

  logger.info("literature_openalex_search_success");

  logger.info("literature_batch_jury_start");

  const juryInputs: JuryInputItem[] = [];

  const poolByBox = new Map<number, PoolItem[]>();
  for (const r of fulfilledResults) {
    let pool = buildPool(r);
    if (pool.length === 0) continue;

    const seenNormTitles = new Set<string>();
    const seenDois = new Set<string>();
    pool = pool.filter((item) => {
      const normTitle = normalizeCleanTitle(item.rawPaper.title ?? "");
      const doi = extractCleanDoi(item.rawPaper.doi ?? "");
      if (doi) {
        if (seenDois.has(doi)) return false;
        seenDois.add(doi);
      }
      if (normTitle) {
        if (seenNormTitles.has(normTitle)) return false;
        seenNormTitles.add(normTitle);
      }
      return true;
    });

    const capped = pool
      .sort((a, b) => {
        if (a.rawPaper.isCoCitationLeader && !b.rawPaper.isCoCitationLeader)
          return -1;
        if (!a.rawPaper.isCoCitationLeader && b.rawPaper.isCoCitationLeader)
          return 1;
        const relDiff = b.rawPaper.relevanceScore - a.rawPaper.relevanceScore;
        if (Math.abs(relDiff) > 0.0001) return relDiff > 0 ? 1 : -1;
        return (b.rawPaper.citedByCount ?? 0) - (a.rawPaper.citedByCount ?? 0);
      })
      .slice(0, 12);

    poolByBox.set(r.thesisBoxId, capped);
    juryInputs.push({
      box: {
        thesisBoxId: r.thesisBoxId,
        subBoxTitle: r.subBox.title,
        boxType: r.boxType,
        description: r.subBoxDescription,
      },
      articles: capped.map((p) => p.rawPaper),
    });
  }

  interface JuryEvalResult {
    thesisBoxId: number;
    subBoxTitle: string;
    articleTitle: string;
    openAlexId: string | null;
    isRelevant: boolean;
    relevanceScore: number;
    isFoundational: boolean;
    reasoning: string;
  }

  let juryEvaluations: JuryEvalResult[] = [];

  if (juryInputs.length > 0) {
    const subjectProblem = thesisMatrixSubject ?? "";

    try {
      const juryResults = await Promise.all(
        juryInputs.map(async (input) => {
          const result = await evaluateSingleBoxJury(
            subjectProblem,
            input,
            logger,
          );
          return result.evaluations;
        }),
      );
      juryEvaluations = juryResults.flat();

      logger.info("literature_batch_jury_success", {
        data: { evaluationCount: juryEvaluations.length },
      });
    } catch (err) {
      logger.error("literature_batch_jury_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  const subBoxResultsToPersist: {
    subBoxTitle: string;
    thesisBoxId: number;
    articles: JuryArticle[];
  }[] = [];

  const poolLookup = new Map<string, PoolItem>();
  for (const [boxId, pool] of poolByBox) {
    for (const item of pool) {
      const normTitle = normalizeCleanTitle(item.rawPaper.title ?? "");
      const key = `${boxId}::${normTitle}`;
      if (!poolLookup.has(key)) {
        poolLookup.set(key, item);
      }
    }
  }

  const allSelectedArticles: {
    thesisBoxId: number;
    subBoxTitle: string;
    originalTitle: string;
    originalAuthors: string[];
    relevanceScore: number;
    isFoundational: boolean;
    reasoning: string;
    doi: string | null;
    openalexId: string | null;
    publisher: string | null;
    publicationYear: number | null;
    originalAbstract: string | null;
    poolItem: PoolItem;
  }[] = [];

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const boxEvals = juryEvaluations
      .filter((ev) => ev.thesisBoxId === r.thesisBoxId)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (boxEvals.length === 0) {
      subBoxResultsToPersist.push({
        subBoxTitle: r.subBox.title,
        thesisBoxId: r.thesisBoxId,
        articles: [],
      });
      continue;
    }

    const relevantEvals = boxEvals.filter((ev) => ev.isRelevant);
    const eliminatedEvals = boxEvals.filter((ev) => !ev.isRelevant);

    const isDuplicate = (title: string): boolean => {
      const normTitle = normalizeCleanTitle(title);
      if (assignedTitles.has(normTitle)) return true;
      for (const raw of assignedRawTitles) {
        if (areTitlesSimilar(title, raw, 0.8)) return true;
      }
      return false;
    };

    const markSelected = (title: string): void => {
      assignedTitles.add(normalizeCleanTitle(title));
      assignedRawTitles.push(title);
    };

    const selectedEvals: typeof boxEvals = [];

    const tryAdd = (ev: (typeof boxEvals)[0]): boolean => {
      if (selectedEvals.length >= 4) return false;
      if (isDuplicate(ev.articleTitle)) return false;
      const poolKey = `${ev.thesisBoxId}::${normalizeCleanTitle(ev.articleTitle)}`;
      if (!poolLookup.has(poolKey)) return false;
      markSelected(ev.articleTitle);
      selectedEvals.push(ev);
      return true;
    };

    for (const ev of relevantEvals) {
      if (selectedEvals.length >= 4) break;
      tryAdd(ev);
    }

    if (selectedEvals.length < 4) {
      for (const ev of eliminatedEvals) {
        if (selectedEvals.length >= 4) break;
        tryAdd(ev);
      }
    }

    if (selectedEvals.length === 0) {
      subBoxResultsToPersist.push({
        subBoxTitle: r.subBox.title,
        thesisBoxId: r.thesisBoxId,
        articles: [],
      });
      continue;
    }

    for (let idx = 0; idx < selectedEvals.length; idx++) {
      const ev = selectedEvals[idx];
      const normTitle = normalizeCleanTitle(ev.articleTitle);
      const poolKey = `${ev.thesisBoxId}::${normTitle}`;
      const poolItem = poolLookup.get(poolKey);

      if (!poolItem) continue;

      allSelectedArticles.push({
        thesisBoxId: ev.thesisBoxId,
        subBoxTitle: ev.subBoxTitle,
        originalTitle: poolItem.rawPaper.title ?? ev.articleTitle,
        originalAuthors: poolItem.rawPaper.authors,
        relevanceScore: ev.relevanceScore,
        isFoundational: idx === 0,
        reasoning: ev.reasoning,
        doi: poolItem.rawPaper.doi,
        openalexId:
          extractOpenAlexId(poolItem.rawPaper.openAlexId) ??
          extractOpenAlexId(ev.openAlexId) ??
          null,
        publisher: poolItem.rawPaper.publisher,
        publicationYear: poolItem.rawPaper.year,
        originalAbstract: poolItem.rawPaper.abstract ?? null,
        poolItem,
      });
    }
  }

  if (allSelectedArticles.length > 0) {
    const sanitizeInput = allSelectedArticles.map((a) => ({
      title: a.originalTitle,
      author: a.originalAuthors.join(", "),
    }));

    let sanitized: { title: string; author: string }[] = [];

    try {
      sanitized = await sanitizeTargetedArticles(sanitizeInput, logger);
    } catch (err) {
      logger.error("literature_targeted_sanitization_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    for (let i = 0; i < allSelectedArticles.length; i++) {
      const art = allSelectedArticles[i];
      const cleaned = sanitized[i];

      if (cleaned) {
        art.originalTitle = cleaned.title;
        art.originalAuthors = cleaned.author.split(", ").filter(Boolean);
      }
    }
  }

  const selectedByBox = new Map<number, typeof allSelectedArticles>();

  for (const art of allSelectedArticles) {
    const list = selectedByBox.get(art.thesisBoxId) ?? [];
    list.push(art);
    selectedByBox.set(art.thesisBoxId, list);
  }

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const boxSelected = selectedByBox.get(r.thesisBoxId) ?? [];
    const subBoxArticles: JuryArticle[] = [];

    for (const art of boxSelected) {
      const juryArticle: JuryArticle = {
        title: art.originalTitle,
        authors: art.originalAuthors,
        publisher: art.publisher,
        publicationYear: art.publicationYear,
        doi: art.doi,
        openalexId: art.openalexId,
        relevanceScore: art.relevanceScore,
        comparisonNote: art.reasoning,
        abstract: art.originalAbstract ?? null,
        isFoundational: art.isFoundational,
      };

      subBoxArticles.push(juryArticle);
    }

    for (const art of subBoxArticles) {
      if (art.authors.length === 0 && !checkCancelled?.()) {
        try {
          const healed = await healAuthorsByTitle(art.title);
          if (healed && healed.length > 0) {
            art.authors = healed;
          }
        } catch (err) {
          logger.error("literature_author_healing_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    subBoxResultsToPersist.push({
      subBoxTitle: r.subBox.title,
      thesisBoxId: r.thesisBoxId,
      articles: subBoxArticles,
    });
  }

  logger.info("literature_db_write_start");

  for (const item of subBoxResultsToPersist) {
    if (checkCancelled?.()) break;

    poolEntries.push({
      subBoxTitle: item.subBoxTitle,
      thesisBoxId: item.thesisBoxId,
      articles: item.articles,
    });

    if (persistSubBox && item.articles.length > 0) {
      try {
        await persistSubBox(item.thesisBoxId, item.articles);
      } catch (err) {
        logger.error("literature_progressive_save_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  logger.info("literature_db_write_success");

  return { poolEntries, archivalBoxTitles };
}
