"use server";

import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GeminiService } from "../_services/gemini.service";
import {
  DergiParkService,
  CandidatePaper,
} from "../_services/dergipark.service";
import { SemanticScholarService } from "../_services/semanticscholar.service";
import { LiteratureRecommendation, RecommendationsResult } from "../actions";

/**
 * Server Action to generate highly tailored academic literature recommendations.
 * Utilizes a strict "Fetch & Curate" (Arka Planda Araştır -> İncele -> Sadece Okeylenen Gerçek Veriyi UI'da Göster) mimarisi.
 * Canlı veriler alınamadığında doğrudan connection failure döner.
 */
export async function getAcademicRecommendationsAction(
  title: string,
  researchQuestion: string,
  argument: string,
  methodology: string,
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
          return {
            success: true,
            recommendations: parsed,
          };
        }
      } catch (parseError) {
        console.error(
          "[getAcademicRecommendationsAction] Failed to parse recommendations from DB:",
          parseError,
        );
      }
    }

    // Step 2: Database cache is empty. Run full retrieval pipeline
    const { englishQueries, turkishKeywords } =
      await GeminiService.extractAcademicQueries(
        title,
        researchQuestion,
        argument,
        methodology,
      );

    console.log(
      `[getAcademicRecommendationsAction] Extracted englishQueries: ${JSON.stringify(
        englishQueries,
      )}, turkishKeywords: ${JSON.stringify(turkishKeywords)}`,
    );

    // Fetch from DergiPark and Semantic Scholar in parallel
    const [dergiParkPapers, semanticScholarPapers] = await Promise.all([
      DergiParkService.fetchDergiParkPapers(turkishKeywords),
      SemanticScholarService.fetchSemanticScholarPapers(englishQueries),
    ]);

    // Combine candidate pools
    const mergedPool = [...dergiParkPapers, ...semanticScholarPapers];

    // If both APIs are down/empty, return connection failure immediately.
    if (mergedPool.length === 0) {
      console.log(
        "[getAcademicRecommendationsAction] Merged candidates list is empty. Returning API_CONNECTION_FAILURE.",
      );
      return {
        success: false,
        error: "API_CONNECTION_FAILURE",
      };
    }

    // Curate using Gemini Academic Jury
    const recommendations = await GeminiService.runAcademicJury(
      title,
      researchQuestion,
      argument,
      methodology,
      mergedPool,
      false,
    );

    // Save recommendations back to Neon PostgreSQL database cache
    await db
      .update(thesisCore)
      .set({ academicRecommendations: JSON.stringify(recommendations) })
      .where(eq(thesisCore.id, core.id));

    return {
      success: true,
      recommendations,
    };
  } catch (error) {
    console.error("getAcademicRecommendationsAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tavsiyeler üretilirken bir hata oluştu.",
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

    // Extract English short query options and Turkish filtering keywords
    const { englishQueries, turkishKeywords } =
      await GeminiService.extractAcademicQueries(
        title,
        researchQuestion,
        argument,
        methodology,
      );

    // Fetch from DergiPark and Semantic Scholar in parallel
    const [dergiParkPapers, semanticScholarPapers] = await Promise.all([
      DergiParkService.fetchDergiParkPapers(turkishKeywords),
      SemanticScholarService.fetchSemanticScholarPapers(englishQueries),
    ]);

    // Deduplicate against existing recommendations by title and paperId
    const existingPaperIds = new Set(
      existingRecs
        .map((r) => r.paperId)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    );
    const existingTitles = new Set(
      existingRecs.map((r) => r.title.toLowerCase().trim()),
    );

    const unseenDergiPark = dergiParkPapers.filter((p: CandidatePaper) => {
      const hasIdMatch = p.paperId && existingPaperIds.has(p.paperId);
      const hasTitleMatch =
        p.title && existingTitles.has(p.title.toLowerCase().trim());
      return !hasIdMatch && !hasTitleMatch;
    });

    const unseenSemanticScholar = semanticScholarPapers.filter(
      (p: CandidatePaper) => {
        const hasIdMatch = p.paperId && existingPaperIds.has(p.paperId);
        const hasTitleMatch =
          p.title && existingTitles.has(p.title.toLowerCase().trim());
        return !hasIdMatch && !hasTitleMatch;
      },
    );

    const mergedUnseen = [
      ...unseenDergiPark.slice(0, 5),
      ...unseenSemanticScholar.slice(0, 5),
    ];

    // If both APIs are down/empty, return connection failure directly.
    if (mergedUnseen.length === 0) {
      console.log(
        "[discoverNewRecommendationsAction] No unseen candidates retrieved. Returning API_CONNECTION_FAILURE.",
      );
      return {
        success: false,
        error: "API_CONNECTION_FAILURE",
      };
    }

    // Select 4 new recommendations purely from candidates pool
    const newRecommendations = await GeminiService.runAcademicJury(
      title,
      researchQuestion,
      argument,
      methodology,
      mergedUnseen,
      true,
      Array.from(existingTitles),
    );

    // Filter duplicates
    const finalizedNewRecommendations = newRecommendations.filter(
      (newRec: LiteratureRecommendation) => {
        const titleLower = (newRec.title || "").toLowerCase().trim();
        const isDuplicate =
          existingTitles.has(titleLower) ||
          (newRec.paperId && existingPaperIds.has(newRec.paperId));
        return !isDuplicate;
      },
    );

    const updatedRecommendations = [
      ...existingRecs,
      ...finalizedNewRecommendations,
    ];

    await db
      .update(thesisCore)
      .set({ academicRecommendations: JSON.stringify(updatedRecommendations) })
      .where(eq(thesisCore.id, core.id));

    return {
      success: true,
      recommendations: updatedRecommendations,
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
