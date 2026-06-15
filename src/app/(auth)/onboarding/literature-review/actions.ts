"use server";

import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  thesisBoxes,
  libraryResources,
  users,
} from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import {
  buildLiteratureSiftingPrompt,
  buildLiteratureJuryAnalysisPrompt,
  literatureSiftingSchema,
  literatureJuryAnalysisSchema,
  LITERATURE_SIFTING_SYSTEM_INSTRUCTION,
  LITERATURE_JURY_ANALYSIS_SYSTEM_INSTRUCTION,
} from "@/lib/prompts";
import { Logger, createFlowId } from "@/lib/logger";
import type {
  OnboardingFormData,
  EnhancedThesisData,
  OriginalityReportData,
  GeminiThesisBox,
  LiteraturePoolEntry,
  JuryArticle,
  OnboardingActionResult,
} from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";

// ============================================================================
// Literature Review Action Types
// ============================================================================

export interface SubBoxInput {
  title: string;
  description: string;
  theorists: string[];
  concepts: string[];
  queries: string[];
}

interface RawPaper {
  source: "semantic_scholar" | "openalex";
  title: string | null;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  authors: string[];
  year: number | null;
  publisher: string | null;
}

interface ValidatedPaper {
  title: string;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  authors: string[];
  year: number | null;
  publisher: string | null;
}

export interface LiteratureReviewResult {
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}

function resolveAbstractInvertedIndex(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null;
  const entries: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      entries.push([pos, word]);
    }
  }
  entries.sort(([a], [b]) => a - b);
  return entries.map(([, word]) => word).join(" ");
}

// ============================================================================
// Stage 1a: Semantic Scholar Search
// ============================================================================

async function searchSemanticScholar(query: string): Promise<RawPaper[]> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=50&fields=title,abstract,externalIds,url,authors,year,publicationVenue`;

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      data?: Record<string, unknown>[];
    };
    const papers = data.data;
    if (!papers) return [];

    return papers.map((p) => {
      const externalIds = p.externalIds as
        | Record<string, string>
        | null
        | undefined;
      const authorList = p.authors as { name?: string }[] | null | undefined;
      const venue = p.publicationVenue as { name?: string } | null | undefined;

      return {
        source: "semantic_scholar" as const,
        title: (p.title as string) ?? null,
        abstract: (p.abstract as string) ?? null,
        doi: extractCleanDoi(externalIds?.DOI),
        url: (p.url as string) ?? null,
        authors: authorList?.map((a) => a.name ?? "").filter(Boolean) ?? [],
        year: (p.year as number) ?? null,
        publisher: venue?.name ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// Stage 1b: OpenAlex Search
// ============================================================================

async function searchOpenAlex(query: string): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  const params = new URLSearchParams({
    "search.semantic": query,
    per_page: "50",
    select:
      "title,abstract_inverted_index,doi,id,authorships,publication_year,primary_location",
  });
  if (apiKey) params.set("api_key", apiKey);

  const url = `https://api.openalex.org/works?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      results?: Record<string, unknown>[];
    };
    const results = data.results;
    if (!results) return [];

    return results.map((work) => {
      const invertedIndex = work.abstract_inverted_index as
        | Record<string, number[]>
        | null
        | undefined;
      const authorships = work.authorships as
        | { author?: { display_name?: string } }[]
        | null
        | undefined;
      const primaryLocation = work.primary_location as
        | {
            landing_page_url?: string;
            source?: { display_name?: string };
          }
        | null
        | undefined;

      return {
        source: "openalex" as const,
        title: (work.title as string) ?? null,
        abstract: resolveAbstractInvertedIndex(invertedIndex),
        doi: extractCleanDoi(work.doi as string | null | undefined),
        url: primaryLocation?.landing_page_url ?? (work.id as string) ?? null,
        authors:
          authorships
            ?.map((a) => a.author?.display_name ?? "")
            .filter(Boolean) ?? [],
        year: (work.publication_year as number) ?? null,
        publisher: primaryLocation?.source?.display_name ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// Stage 2: DOI Merge & Deduplication
// ============================================================================

function mergePapers(
  semantic: RawPaper[],
  openalex: RawPaper[],
): ValidatedPaper[] {
  const doiMap = new Map<string, ValidatedPaper>();
  const noDoiPapers: ValidatedPaper[] = [];
  const seenTitleKeys = new Set<string>();

  function ingest(raw: RawPaper): void {
    const paper: ValidatedPaper = {
      title: raw.title ?? "",
      abstract: raw.abstract,
      doi: raw.doi,
      url: raw.url,
      authors: [...raw.authors],
      year: raw.year,
      publisher: raw.publisher,
    };

    if (paper.doi) {
      const existing = doiMap.get(paper.doi);
      if (existing) {
        existing.abstract = existing.abstract ?? paper.abstract;
        existing.url = existing.url ?? paper.url;
        existing.year = existing.year ?? paper.year;
        existing.publisher = existing.publisher ?? paper.publisher;
        const existingSet = new Set(existing.authors);
        for (const a of paper.authors) {
          if (!existingSet.has(a)) {
            existing.authors.push(a);
            existingSet.add(a);
          }
        }
      } else {
        doiMap.set(paper.doi, { ...paper });
      }
    } else {
      const titleKey = paper.title.toLowerCase().trim().slice(0, 80);
      if (paper.title && !seenTitleKeys.has(titleKey)) {
        seenTitleKeys.add(titleKey);
        noDoiPapers.push(paper);
      }
    }
  }

  for (const raw of semantic) ingest(raw);
  for (const raw of openalex) ingest(raw);
  return [...doiMap.values(), ...noDoiPapers];
}

// ============================================================================
// AI Sifting Stage
// ============================================================================

interface SiftingResultItem {
  doi: string;
  title: string;
  keep: boolean;
}

interface SiftingResponse {
  siftedResults: SiftingResultItem[];
}

async function runSiftingStage(
  box: SubBoxInput,
  candidates: ValidatedPaper[],
  logger: Logger,
): Promise<ValidatedPaper[]> {
  const siftingInput = candidates.map((c) => ({
    doi: c.doi ?? "",
    title: c.title,
    abstract: "",
  }));

  const siftingResult = await generateStructuredContent<SiftingResponse>(
    "gemini-3.1-flash-lite",
    LITERATURE_SIFTING_SYSTEM_INSTRUCTION,
    buildLiteratureSiftingPrompt(
      {
        title: box.title,
        description: box.description,
        concepts: box.concepts,
        theorists: box.theorists,
      },
      siftingInput,
    ),
    literatureSiftingSchema,
    logger,
    { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
  );

  const keptDois = new Set(
    siftingResult.siftedResults.filter((r) => r.keep).map((r) => r.doi),
  );

  const keptTitles = new Set(
    siftingResult.siftedResults
      .filter((r) => r.keep === true)
      .map((r) => r.title.toLowerCase().trim()),
  );

  const kept = candidates.filter((c) => {
    if (c.doi && keptDois.has(c.doi)) return true;
    if (c.title && keptTitles.has(c.title.toLowerCase().trim())) return true;
    return false;
  });

  return kept.map((c) => ({ ...c, abstract: null }));
}

// ============================================================================
// AI Jury Analysis Stage
// ============================================================================

interface JuryResponse {
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
}

async function runJuryStage(
  box: SubBoxInput,
  sifted: ValidatedPaper[],
  logger: Logger,
): Promise<LiteratureReviewResult> {
  const juryCandidates = sifted.map((c) => ({
    doi: c.doi ?? "",
    title: c.title,
    abstract: c.abstract ?? "",
    url: c.url ?? "",
    publisher: c.publisher ?? "",
    publicationYear: c.year ?? 0,
    authors: c.authors,
  }));

  const juryResult = await generateStructuredContent<JuryResponse>(
    "gemini-3.1-flash-lite",
    LITERATURE_JURY_ANALYSIS_SYSTEM_INSTRUCTION,
    buildLiteratureJuryAnalysisPrompt(
      {
        title: box.title,
        description: box.description,
        concepts: box.concepts,
        theorists: box.theorists,
      },
      juryCandidates,
    ),
    literatureJuryAnalysisSchema,
    logger,
    { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
  );

  return {
    starterPack: juryResult.starterPack,
    reservedPool: juryResult.reservedPool,
  };
}

// ============================================================================
// Main Action: processLiteratureReviewAction
// ============================================================================

/**
 * Processes a single sub-box through the 5-stage literature review pipeline:
 * 1. Parallel search (Semantic Scholar + OpenAlex) for each query
 * 2. DOI-based merge and deduplication (saved as rawApiPool)
 * 3. AI sifting — aggressive gating
 * 4. AI jury analysis → starter pack + reserved pool
 * 5. CrossRef polite-pool validation on final jury articles + abstract restore
 *
 * @param subBox - Sub-box metadata including search queries
 * @returns LiteratureReviewResult with starterPack and reservedPool arrays
 */
export async function processLiteratureReviewAction(
  subBox: SubBoxInput,
): Promise<{ data?: LiteratureReviewResult; error?: string }> {
  const logger = new Logger(createFlowId());

  try {
    const queries = subBox.queries.filter((q) => q.trim().length > 0);
    if (queries.length === 0) {
      return { data: { starterPack: [], reservedPool: [] } };
    }

    // ------------------------------------------------------------------
    // Stage 1: Equal-weighted parallel search (Semantic Scholar & OpenAlex)
    // ------------------------------------------------------------------
    logger.info("literature_search_start", {
      service: "literature",
      data: { queryCount: queries.length, subBoxTitle: subBox.title },
    });

    const searchStart = performance.now();
    const searchCalls = queries.flatMap((q) => [
      searchSemanticScholar(q),
      searchOpenAlex(q),
    ]);
    const settled = await Promise.allSettled(searchCalls);

    const allRaw: RawPaper[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        allRaw.push(...result.value);
      }
    }

    logger.info("literature_search_done", {
      service: "literature",
      durationMs: performance.now() - searchStart,
      data: { rawCount: allRaw.length },
    });

    if (allRaw.length === 0) {
      return { data: { starterPack: [], reservedPool: [] } };
    }

    // ------------------------------------------------------------------
    // Stage 2: DOI dedup & merge overlay
    // ------------------------------------------------------------------
    const mergeStart = performance.now();
    const semanticPapers = allRaw.filter(
      (r) => r.source === "semantic_scholar",
    );
    const openalexPapers = allRaw.filter((r) => r.source === "openalex");
    const merged = mergePapers(semanticPapers, openalexPapers);

    logger.info("literature_merge_done", {
      service: "literature",
      durationMs: performance.now() - mergeStart,
      data: { mergedCount: merged.length },
    });

    const rawApiPool = merged;

    // ------------------------------------------------------------------
    // Stage 3: AI Sifting — aggressive gating
    // ------------------------------------------------------------------
    const siftStart = performance.now();
    const sifted = await runSiftingStage(subBox, merged, logger);

    logger.info("literature_sifting_done", {
      service: "literature",
      durationMs: performance.now() - siftStart,
      data: { before: merged.length, after: sifted.length },
    });

    if (sifted.length === 0) {
      return { data: { starterPack: [], reservedPool: [] } };
    }

    // ------------------------------------------------------------------
    // Hydration: restore abstracts from rawApiPool (DOI → title fallback)
    // ------------------------------------------------------------------
    const hydraStart = performance.now();
    const normalizedDoiIndex = new Map(
      rawApiPool.map((p) => [p.doi?.toLowerCase().trim() ?? "", p]),
    );
    const hydrated = sifted.map((s) => {
      if (s.doi) {
        const match = normalizedDoiIndex.get(s.doi.toLowerCase().trim());
        if (match?.abstract) return { ...s, abstract: match.abstract };
      } else {
        const titleKey = s.title.toLowerCase().trim().slice(0, 80);
        const match = rawApiPool.find(
          (p) => p.title?.toLowerCase().trim().slice(0, 80) === titleKey,
        );
        if (match?.abstract) return { ...s, abstract: match.abstract };
      }
      return s;
    });

    logger.info("literature_hydration_done", {
      service: "literature",
      durationMs: performance.now() - hydraStart,
      data: {
        before: sifted.length,
        restored: hydrated.filter((h) => h.abstract !== null).length,
      },
    });

    // ------------------------------------------------------------------
    // Stage 4: AI Jury Analysis — starter pack & reserved pool
    // ------------------------------------------------------------------
    const juryStart = performance.now();
    const result = await runJuryStage(subBox, hydrated, logger);

    logger.info("literature_jury_done", {
      service: "literature",
      durationMs: performance.now() - juryStart,
      data: {
        starterPackCount: result.starterPack.length,
        reservedPoolCount: result.reservedPool.length,
      },
    });

    // ------------------------------------------------------------------
    // Stage 5: CrossRef polite-pool validation on final jury articles
    // ------------------------------------------------------------------
    const crossrefStart = performance.now();
    const [enrichedStarterPack, enrichedReservedPool] = await Promise.all([
      Promise.all(
        result.starterPack.map((a) =>
          enrichJuryArticleWithCrossRef(a, rawApiPool),
        ),
      ),
      Promise.all(
        result.reservedPool.map((a) =>
          enrichJuryArticleWithCrossRef(a, rawApiPool),
        ),
      ),
    ]);

    logger.info("literature_crossref_done", {
      service: "literature",
      durationMs: performance.now() - crossrefStart,
      data: {
        enrichedCount: enrichedStarterPack.length + enrichedReservedPool.length,
      },
    });

    return {
      data: {
        starterPack: enrichedStarterPack,
        reservedPool: enrichedReservedPool,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    logger.error("literature_review_failed", {
      service: "literature",
      error: err,
    });
    return { error: message };
  }
}

// ============================================================================
// CrossRef & Enrichment Helpers (polite-pool)
// ============================================================================

async function enrichJuryArticleWithCrossRef(
  article: JuryArticle,
  pool: ValidatedPaper[],
): Promise<JuryArticle> {
  if (article.doi) {
    const match = pool.find((p) => p.doi === article.doi);
    if (match?.abstract) {
      article.abstract = match.abstract;
    }
  } else if (article.title) {
    const titleKey = article.title.toLowerCase().trim().slice(0, 80);
    const match = pool.find(
      (p) => p.title?.toLowerCase().trim().slice(0, 80) === titleKey,
    );
    if (match?.abstract) {
      article.abstract = match.abstract;
    }
  }

  if (!article.doi) return article;

  const paper: ValidatedPaper = {
    title: article.title,
    abstract: article.abstract,
    doi: article.doi,
    url: article.url,
    authors: [...article.authors],
    year: article.publicationYear,
    publisher: article.publisher,
  };

  const enriched = await validateWithCrossRef(paper);

  article.authors = enriched.authors;
  article.url = enriched.url ?? article.url;
  article.publisher = enriched.publisher ?? article.publisher;
  if (enriched.year) article.publicationYear = enriched.year;

  return article;
}

async function validateWithCrossRef(
  paper: ValidatedPaper,
): Promise<ValidatedPaper> {
  if (!paper.doi) return paper;

  const contactEmail = process.env.CROSSREF_CONTACT_EMAIL;
  const endpoint = `https://api.crossref.org/works/${encodeURIComponent(paper.doi)}${contactEmail ? `?mailto=${encodeURIComponent(contactEmail)}` : ""}`;

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return paper;

    const body = (await response.json()) as
      | { message?: Record<string, unknown> }
      | undefined;
    const message = body?.message;
    if (!message) return paper;

    const authorList = message.author as
      | { given?: string; family?: string }[]
      | undefined;
    if (authorList && authorList.length > 0) {
      const resolvedAuthors: string[] = [];
      for (const a of authorList) {
        const given = (a.given ?? "").trim();
        const family = (a.family ?? "").trim();
        const full = `${given} ${family}`.trim();
        if (full) resolvedAuthors.push(full);
      }
      if (resolvedAuthors.length > 0) {
        paper.authors = resolvedAuthors;
      }
    }

    const crossrefUrl = message.URL as string | undefined;
    if (crossrefUrl) paper.url = crossrefUrl;

    const publisher = message.publisher as string | undefined;
    const containerTitle = message["container-title"] as string[] | undefined;
    if (publisher) paper.publisher = publisher;
    else if (containerTitle && containerTitle.length > 0) {
      paper.publisher = containerTitle[0];
    }

    const published = message.published as
      | { "date-parts"?: number[][] }
      | undefined;
    const dateParts = published?.["date-parts"];
    if (dateParts && dateParts.length > 0 && dateParts[0].length > 0) {
      paper.year = dateParts[0][0];
    }

    return paper;
  } catch {
    return paper;
  }
}

// ============================================================================
// Final Action: confirmLiteratureAction
// ============================================================================

const COOKIE_NAME = "fabricca_session";

/**
 * Finalizes the onboarding process by bulk-inserting literature review results
 * and marking the user as fully onboarded.
 *
 * 1. Validates session and retrieves the user's thesis matrix.
 * 2. In a single Drizzle transaction:
 *    a. Maps each `LiteraturePoolEntry` to sub-box DB IDs.
 *    b. Inserts starter pack articles with `status: APPROVED`.
 *    c. Inserts reserved pool articles with `status: RESERVED`.
 *    d. Sets `users.onboardingCompleted = true`.
 * 3. Updates the `fabricca_session` cookie with `onboardingCompleted: true`.
 * 4. Revalidates paths and returns success.
 *
 * @param args.literaturePool - Array of LiteraturePoolEntry from Zustand store
 * @returns OnboardingActionResult
 */
export async function confirmLiteratureAction(args: {
  literaturePool: LiteraturePoolEntry[];
}): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({ step: "confirmLiterature", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({
        step: "confirmLiterature",
        status: "FAILED",
        diagnostics: { errorCode: "AUTH_ERROR", message: "Oturum bulunamadi." },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    const { literaturePool } = args;

    if (!literaturePool || literaturePool.length === 0) {
      log.warn({
        step: "confirmLiterature",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Literatür havuzu boş.",
        },
      });
      return { error: "Onaylanacak literatür verisi bulunamadı." };
    }

    // 1. Get the user's thesis matrix
    log.info({ step: "find_matrix", status: "START", service: "db" });
    const t0 = performance.now();
    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));
    log.info({
      step: "find_matrix",
      status: matrix ? "SUCCESS" : "NOT_FOUND",
      metrics: { durationMs: performance.now() - t0 },
      service: "db",
    });

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    const thesisMatrixId = matrix.id;

    // 2. Atomic transaction
    await db.transaction(async (tx) => {
      const allResources: NewLibraryResource[] = [];

      for (const entry of literaturePool) {
        // 2a. Find sub-box by thesisMatrixId + title
        const subBoxTitle = entry.subBoxTitle;
        const [box] = await tx
          .select({ id: thesisBoxes.id })
          .from(thesisBoxes)
          .where(
            and(
              eq(thesisBoxes.thesisMatrixId, thesisMatrixId),
              eq(thesisBoxes.title, subBoxTitle),
            ),
          );

        if (!box) {
          throw new Error(
            `Alt kutu bulunamadı: "${subBoxTitle}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }

        const thesisBoxId = box.id;

        // 2b. Map starter pack articles → APPROVED
        for (const article of entry.starterPack) {
          allResources.push({
            thesisBoxId,
            status: "APPROVED",
            type: article.type,
            title: article.title,
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            strategicRecommendations: article.strategicRecommendations ?? null,
            isRead: false,
          });
        }

        // 2c. Map reserved pool articles → RESERVED
        for (const article of entry.reservedPool) {
          allResources.push({
            thesisBoxId,
            status: "RESERVED",
            type: article.type,
            title: article.title,
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            strategicRecommendations: article.strategicRecommendations ?? null,
            isRead: false,
          });
        }
      }

      // 2d. Bulk insert all literature resources
      if (allResources.length > 0) {
        log.info({
          step: "insert_literature_resources",
          status: "START",
          service: "db",
          data: { count: allResources.length },
        });
        const t1 = performance.now();
        await tx.insert(libraryResources).values(allResources);
        log.info({
          step: "insert_literature_resources",
          status: "SUCCESS",
          metrics: { durationMs: performance.now() - t1 },
          service: "db",
        });
      }

      // 2e. Mark onboarding as completed
      log.info({ step: "complete_onboarding", status: "START", service: "db" });
      const t2 = performance.now();
      await tx
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));
      log.info({
        step: "complete_onboarding",
        status: "SUCCESS",
        metrics: { durationMs: performance.now() - t2 },
        service: "db",
      });
    });

    // 3. Update session cookie with onboardingCompleted: true
    try {
      const cookieStore = await cookies();
      cookieStore.set(
        COOKIE_NAME,
        JSON.stringify({
          userId: session.userId,
          name: session.name,
          onboardingCompleted: true,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        },
      );
    } catch {
      log.info({
        step: "session_cookie_update_skipped",
        status: "SUCCESS",
      });
    }

    // 4. Revalidate paths
    try {
      revalidatePath("/onboarding", "layout");
      revalidatePath("/", "layout");
    } catch {
      log.info({ step: "revalidate_path_skipped", status: "SUCCESS" });
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({
      step: "confirmLiterature",
      status: "SUCCESS",
      metrics: { duration, totalEntries: literaturePool.length },
    });

    return { success: true };
  } catch (err) {
    log.error({
      step: "confirmLiterature",
      status: "FAILED",
      diagnostics: {
        errorCode: "TRANSACTION_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return {
      error:
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}
