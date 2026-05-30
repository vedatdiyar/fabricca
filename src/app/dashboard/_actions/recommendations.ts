"use server";

import { db } from "@/db";
import { thesisCore, thesisBoxes, references } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { GeminiService } from "../_services/gemini.service";
import { CandidatePaper } from "../_services/types";
import { SemanticScholarService } from "../_services/semanticscholar.service";
import { OpenAlexService } from "../_services/openalex.service";
import { LiteratureRecommendation, RecommendationsResult } from "../actions";

interface EnrichedCandidatePaper extends CandidatePaper {
  boxId?: number;
  boxName?: string;
}

/**
 * Utility to perform double deduplication of candidate papers by paperId and title,
 * while preserving the original relative order (relevance order from search APIs).
 */
function deduplicatePapers(
  pool: EnrichedCandidatePaper[],
): EnrichedCandidatePaper[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const finalPool: EnrichedCandidatePaper[] = [];

  for (const paper of pool) {
    const id = paper.paperId?.trim();
    const title = paper.title.toLowerCase().trim();

    const hasIdMatch = id ? seenIds.has(id) : false;
    const hasTitleMatch = seenTitles.has(title);

    if (!hasIdMatch && !hasTitleMatch) {
      if (id) seenIds.add(id);
      seenTitles.add(title);
      finalPool.push(paper);
    }
  }

  return finalPool;
}

/**
 * Detects whether a book title is in English (EN) or Turkish (TR) using standard heuristic checks.
 */
function detectLanguage(title: string): "TR" | "EN" {
  const lower = title.toLowerCase().trim();

  // Heuristic 1: Unique Turkish characters
  if (/[çğıöşüÇĞİÖŞÜ]/.test(title)) {
    return "TR";
  }

  // Heuristic 2: Turkish stop words
  const trStopWords = [
    "\\bve\\b",
    "\\bbir\\b",
    "\\bda\\b",
    "\\bde\\b",
    "\\biçin\\b",
    "\\bile\\b",
    "\\bkürt\\b",
    "\\bsiyaseti\\b",
    "\\btarihi\\b",
  ];
  const hasTrStopWord = trStopWords.some((pattern) =>
    new RegExp(pattern, "i").test(lower),
  );
  if (hasTrStopWord) {
    return "TR";
  }

  // Heuristic 3: English stop words
  const enStopWords = [
    "\\bthe\\b",
    "\\bof\\b",
    "\\band\\b",
    "\\bin\\b",
    "\\bto\\b",
    "\\bfor\\b",
    "\\bby\\b",
    "\\bon\\b",
    "\\bwith\\b",
    "\\bkurdish\\b",
  ];
  const hasEnStopWord = enStopWords.some((pattern) =>
    new RegExp(pattern, "i").test(lower),
  );
  if (hasEnStopWord) {
    return "EN";
  }

  // Default fallback
  return "EN";
}

interface LoggablePaper {
  title: string;
  source?: string;
  citationCount?: number;
  relevance?: string;
}

/**
 * Logs details about academic papers before and after jury evaluation.
 */
function logCandidatesPool(
  stage: "BEFORE_JURY" | "AFTER_JURY",
  boxName: string,
  papers: LoggablePaper[],
) {
  console.log(`\n==================================================`);
  console.log(`[JURY LOG - ${stage}] Box: "${boxName}"`);
  console.log(`Total papers count: ${papers.length}`);
  console.log(`--------------------------------------------------`);
  papers.forEach((p, idx) => {
    console.log(`[${idx + 1}] Title: "${p.title}"`);
    console.log(`    Source: ${p.source}`);
    console.log(`    Citation Count: ${p.citationCount}`);
    if (stage === "BEFORE_JURY") {
      console.log(`    Relevance Score: N/A (Semantic matching only)`);
    } else {
      console.log(`    Jury Curation Reason (Relevance): "${p.relevance}"`);
    }
  });
  console.log(`==================================================\n`);
}

/**
 * Fetches papers for a single box from both Semantic Scholar and OpenAlex.
 * Complies with rate-limit restrictions and implements sequential delays.
 */
async function fetchPapersForBox(
  box: { id: number; name: string },
  bq: { englishQueries: string[]; turkishQueries: string[] },
  limit: number = 5,
): Promise<CandidatePaper[]> {
  const boxPapers: CandidatePaper[] = [];

  // Channel 1: Global/Theoretical English Pool (Semantic Scholar)
  try {
    const ssPapers = await SemanticScholarService.fetchSemanticScholarPapers(
      bq.englishQueries,
      limit,
      "citationCount",
    );
    boxPapers.push(...ssPapers);
  } catch (err) {
    console.error(
      `[fetchPapersForBox] Semantic Scholar failed for ${box.name}:`,
      err,
    );
  }

  // Mandatory delay between service calls to respect rate limits
  await new Promise((r) => setTimeout(r, 1200));

  // Channel 1 (Additional): Global/Theoretical English Pool (OpenAlex EN)
  for (const query of bq.englishQueries) {
    try {
      const oaEnPapers = await OpenAlexService.fetchOpenAlexPapers(
        query,
        "en",
        limit,
      );
      boxPapers.push(...oaEnPapers);
    } catch (err) {
      console.error(
        `[fetchPapersForBox] OpenAlex EN failed for ${box.name} with query "${query}":`,
        err,
      );
    }
    // Rate-limit defense
    await new Promise((r) => setTimeout(r, 1200));
  }

  // Channel 2: Local/Regional Turkish Pool (OpenAlex TR)
  for (const query of bq.turkishQueries) {
    try {
      const oaTrPapers = await OpenAlexService.fetchOpenAlexPapers(
        query,
        "tr",
        limit,
      );
      boxPapers.push(...oaTrPapers);
    } catch (err) {
      console.error(
        `[fetchPapersForBox] OpenAlex TR failed for ${box.name} with query "${query}":`,
        err,
      );
    }
    // Rate-limit defense
    await new Promise((r) => setTimeout(r, 1200));
  }

  return boxPapers;
}

/**
 * Server Action to generate highly tailored academic literature recommendations.
 * Utilizes a strict "Fetch & Curate" (Arka Planda Araştır -> İncele -> Sadece Okeylenen Gerçek Veriyi UI'da Göster) mimarisi.
 * Canlı veriler alınamadığında doğrudan connection failure döner.
 */
export async function getAcademicRecommendationsAction(
  _title: string,
  _researchQuestion: string,
  _argument: string,
  _methodology: string,
): Promise<RecommendationsResult> {
  try {
    // Step 1: Check existing database cache first
    const [core] = await db.select().from(thesisCore).limit(1);
    if (!core) {
      return {
        success: false,
        error: "Tez anayasası bulunamadı. Lütfen Tez Anayasası'nı tamamlayın.",
      };
    }

    if (core.academicRecommendations) {
      try {
        const parsed = JSON.parse(core.academicRecommendations);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(
            "[getAcademicRecommendationsAction] Loaded recommendations from Neon PostgreSQL database cache.",
          );

          // Filter out recommendations that correspond to completed references in references table (status = 'tamamlandı')
          const completedReferences = await db
            .select({ title: references.title })
            .from(references)
            .where(eq(references.status, "tamamlandı"));

          const completedTitles = new Set(
            completedReferences.map((ref) => ref.title.toLowerCase().trim()),
          );

          const filteredRecs = parsed.filter(
            (rec: LiteratureRecommendation) => {
              const recTitle = (rec.title || "").toLowerCase().trim();
              return !completedTitles.has(recTitle);
            },
          );

          return {
            success: true,
            recommendations: filteredRecs,
          };
        }
      } catch (parseError) {
        console.error(
          "[getAcademicRecommendationsAction] Failed to parse recommendations from DB:",
          parseError,
        );
      }
    }

    // DO NOT run the automatic literature search when the cache is empty.
    // Instead, check if there are core books recommended during onboarding.
    const coreBooks = await db
      .select()
      .from(references)
      .where(
        or(
          eq(references.pdfUrl, "recommended-onboarding"),
          eq(references.status, "recommended"),
        ),
      );

    if (coreBooks.length > 0) {
      console.log(
        `[getAcademicRecommendationsAction] No cached recommendations. Found ${coreBooks.length} core books from onboarding. Returning them as fallback...`,
      );

      // Filter out recommendations that correspond to completed references in references table (status = 'tamamlandı')
      const completedReferences = await db
        .select({ title: references.title })
        .from(references)
        .where(eq(references.status, "tamamlandı"));

      const completedTitles = new Set(
        completedReferences.map((ref) => ref.title.toLowerCase().trim()),
      );

      const mappedRecs: LiteratureRecommendation[] = coreBooks
        .filter((book) => !completedTitles.has(book.title.toLowerCase().trim()))
        .map((book) => {
          // Attempt to extract rationale from abstract
          // Format: `Yayınevi: ${book.publisher.trim()}\n\nÖneri Gerekçesi: ${book.rationale.trim()}`
          let relevance =
            book.abstract ||
            "Onboarding aşamasında hoca tarafından önerilen temel kaynak.";
          if (book.abstract && book.abstract.includes("Öneri Gerekçesi:")) {
            const parts = book.abstract.split("Öneri Gerekçesi:");
            if (parts.length > 1) {
              relevance = parts[1].trim();
            }
          }

          const isOnboardingBook =
            book.pdfUrl === "recommended-onboarding" ||
            book.status === "recommended";
          const source = isOnboardingBook ? "Temel Kaynak" : "Semantic Scholar";
          const lang = ((book as unknown as { language?: string }).language ||
            detectLanguage(book.title)) as "TR" | "EN" | undefined;

          return {
            paperId: String(book.id),
            title: book.title,
            authors: book.authors || "",
            year: book.year ? String(book.year) : "",
            relevance: relevance,
            url:
              book.pdfUrl !== "recommended-onboarding"
                ? book.pdfUrl
                : undefined,
            citationCount: 0,
            source: source,
            lang: lang,
            boxId: 0,
            boxName: "Kurucu Kaynaklar & Temel Okumalar",
          };
        });

      return {
        success: true,
        recommendations: mappedRecs,
      };
    }

    console.log(
      "[getAcademicRecommendationsAction] No recommendations cached in database and no onboarding core books found. Returning empty list.",
    );
    return {
      success: true,
      recommendations: [],
    };
  } catch (error) {
    console.error("getAcademicRecommendationsAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tavsiyeler yüklenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to search and validate NEW literature recommendations,
 * deduplicating them against existing database recommendations by paperId and title,
 * and curating them using Fetch & Curate framework, completely banning hallucinations.
 */
export async function discoverNewRecommendationsAction(
  title: string,
  researchQuestion: string,
  argument: string,
  methodology: string,
  boxId?: number,
): Promise<RecommendationsResult> {
  try {
    const [core] = await db.select().from(thesisCore).limit(1);
    if (!core) {
      return {
        success: false,
        error: "Tez anayasası bulunamadı. Lütfen Tez Anayasası'nı tamamlayın.",
      };
    }

    // Parse existing recommendations from database
    let existingRecs: LiteratureRecommendation[] = [];
    if (core.academicRecommendations) {
      try {
        const parsed = JSON.parse(core.academicRecommendations);
        if (Array.isArray(parsed)) {
          existingRecs = parsed;
        }
      } catch (parseError) {
        console.error(
          "[discoverNewRecommendationsAction] Failed to parse existing recommendations:",
          parseError,
        );
      }
    }

    // Fetch thesis_boxes from Neon PostgreSQL
    let boxes = await db
      .select()
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisCoreId, core.id))
      .orderBy(thesisBoxes.order);

    if (boxId) {
      boxes = boxes.filter((b) => b.id === boxId);
    }

    if (boxes.length === 0) {
      return {
        success: false,
        error: boxId
          ? "Seçilen Tematik Çalışma Kutusu bulunamadı."
          : "Tezinize ait henüz hiçbir Tematik Çalışma Kutusu bulunamadı. Lütfen onboarding veya dashboard üzerinden kutuları oluşturun.",
      };
    }

    // Extract queries per box
    const boxQueries = await GeminiService.extractAcademicQueriesPerBox(
      title,
      researchQuestion,
      argument,
      methodology,
      boxes,
    );

    const existingPaperIds = new Set(
      existingRecs
        .filter((r) => !boxId || r.boxId !== boxId)
        .map((r) => r.paperId)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    );
    const existingTitles = new Set(
      existingRecs
        .filter((r) => !boxId || r.boxId !== boxId)
        .map((r) => r.title.toLowerCase().trim()),
    );

    const allNewRecommendations: LiteratureRecommendation[] = [];
    let totalUnseenCandidatesCount = 0;

    // Search and curate new recommendations box by box (decoupled)
    for (const bq of boxQueries) {
      const box = boxes.find((b) => b.id === bq.boxId);
      if (!box) continue;

      try {
        console.log(
          `\n[discoverNewRecommendationsAction] Discovering new papers for box: "${box.name}"...`,
        );
        const boxPapers = await fetchPapersForBox(box, bq, 10);

        // Tag papers with boxId and boxName
        const taggedPapers: EnrichedCandidatePaper[] = boxPapers.map((p) => ({
          ...p,
          boxId: box.id,
          boxName: box.name,
        }));

        // Filter out unseen candidates specifically for this box
        const unseenCandidatesRaw = taggedPapers.filter((p) => {
          const hasIdMatch = p.paperId && existingPaperIds.has(p.paperId);
          const hasTitleMatch =
            p.title && existingTitles.has(p.title.toLowerCase().trim());
          return !hasIdMatch && !hasTitleMatch;
        });

        // Deduplicate unseen papers locally preserving API relevance
        const deduplicatedUnseen = deduplicatePapers(unseenCandidatesRaw);
        totalUnseenCandidatesCount += deduplicatedUnseen.length;

        if (deduplicatedUnseen.length === 0) {
          console.log(
            `[discoverNewRecommendationsAction] No new unseen candidates found for box "${box.name}". Skipping jury.`,
          );
          continue;
        }

        // ADIM 1: Log unseen candidate pool before jury session
        logCandidatesPool("BEFORE_JURY", box.name, deduplicatedUnseen);

        // Run academic jury for this box specifically
        const boxNewRecs = await GeminiService.runAcademicJury(
          title,
          researchQuestion,
          argument,
          methodology,
          deduplicatedUnseen,
          true,
          Array.from(existingTitles),
          box.name,
        );

        // Filter duplicates and enrich new recommendation objects
        const finalizedBoxNewRecs = boxNewRecs
          .filter((newRec: LiteratureRecommendation) => {
            const titleLower = (newRec.title || "").toLowerCase().trim();
            const isDuplicate =
              existingTitles.has(titleLower) ||
              (newRec.paperId && existingPaperIds.has(newRec.paperId));
            return !isDuplicate;
          })
          .map((rec) => {
            const match = deduplicatedUnseen.find(
              (c) =>
                c.paperId === rec.paperId ||
                c.title.toLowerCase().trim() === rec.title.toLowerCase().trim(),
            );
            return {
              ...rec,
              boxId: box.id,
              boxName: box.name,
              source: rec.source || match?.source || "OpenAlex",
              citationCount:
                typeof rec.citationCount === "number"
                  ? rec.citationCount
                  : match?.citationCount || 0,
              lang: rec.lang || match?.lang || "EN",
            };
          });

        // ADIM 1: Log recommendations after jury curation
        logCandidatesPool("AFTER_JURY", box.name, finalizedBoxNewRecs);

        allNewRecommendations.push(...finalizedBoxNewRecs);
      } catch (err) {
        console.error(
          `Error processing new discoveries for box "${box.name}":`,
          err,
        );
      }
    }

    // If no candidate papers are returned at all, return connection failure.
    if (totalUnseenCandidatesCount === 0) {
      console.log(
        "[discoverNewRecommendationsAction] No unseen candidates retrieved. Returning API_CONNECTION_FAILURE.",
      );
      return {
        success: false,
        error: "API_CONNECTION_FAILURE",
      };
    }

    let updatedRecommendations: LiteratureRecommendation[] = [];
    if (boxId) {
      // Filter out old recommendations for this specific boxId to prevent stale data
      const otherRecs = existingRecs.filter((r) => r.boxId !== boxId);
      updatedRecommendations = [...otherRecs, ...allNewRecommendations];
    } else {
      updatedRecommendations = [...existingRecs, ...allNewRecommendations];
    }

    await db
      .update(thesisCore)
      .set({ academicRecommendations: JSON.stringify(updatedRecommendations) })
      .where(eq(thesisCore.id, core.id));

    // Filter out recommendations that correspond to completed references (status = 'tamamlandı')
    const completedReferences = await db
      .select({ title: references.title })
      .from(references)
      .where(eq(references.status, "tamamlandı"));

    const completedTitles = new Set(
      completedReferences.map((ref) => ref.title.toLowerCase().trim()),
    );

    const filteredRecs = updatedRecommendations.filter((rec) => {
      const recTitle = (rec.title || "").toLowerCase().trim();
      return !completedTitles.has(recTitle);
    });

    return {
      success: true,
      recommendations: filteredRecs,
    };
  } catch (error) {
    console.error("discoverNewRecommendationsAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Yeni tavsiyeler aranırken hata oluştu.",
    };
  }
}
