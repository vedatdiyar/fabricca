import { searchExa, type ExaSearchResult } from "@/core/services/exa";
import type { Logger } from "@/lib/logger";
import type { PositioningMatrixInput } from "./validation";

/** Result of an academic factual and chronological verification check. */
export interface FactualVerificationReport {
  /** Checked topic / domain summary. */
  topicSummary: string;
  /** Verified factual snippets retrieved from authoritative web sources. */
  verifiedEvidence: {
    title: string;
    url: string;
    publishedDate?: string | null;
    highlights: string[];
  }[];
  /** Whether the verification search executed successfully. */
  hasEvidence: boolean;
}

/**
 * Executes a targeted factual and chronological verification of the user's thesis matrix using Exa.ai neural search.
 * Validates dates, legal/institutional frameworks, and recent field developments without polluting candidate literature.
 *
 * @param matrix - The user's validated positioning matrix.
 * @param logger - Optional logger instance.
 * @returns Structured factual verification report.
 */
export async function verifyMatrixFactualClaims(
  matrix: PositioningMatrixInput,
  logger?: Logger,
): Promise<FactualVerificationReport> {
  const queryParts = [
    matrix.subjectProblem,
    matrix.primaryMaterial,
    matrix.methodology,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);

  const verificationQuery = `${queryParts} mevzuat kanun tarih güncel rapor`.trim();

  logger?.info("positioning_fact_check_start", {
    service: "positioning",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/fact-checker.ts",
    data: { query: verificationQuery },
    hidden: true,
  });

  try {
    const searchResults: ExaSearchResult[] = await searchExa(
      verificationQuery,
      {
        numResults: 4,
        highlights: true,
        category: "publication",
        silent: true,
        logger,
        summary: "Fact-Check & Chronology",
      },
    );

    const verifiedEvidence = searchResults
      .filter((r) => Boolean(r.title && (r.highlights?.length ?? 0) > 0))
      .map((r) => ({
        title: r.title,
        url: r.url,
        publishedDate: r.publishedDate,
        highlights: r.highlights ?? [],
      }));

    return {
      topicSummary: matrix.subjectProblem.slice(0, 100),
      verifiedEvidence,
      hasEvidence: verifiedEvidence.length > 0,
    };
  } catch (err) {
    logger?.warn("positioning_fact_check_failed", {
      service: "positioning",
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      topicSummary: matrix.subjectProblem.slice(0, 100),
      verifiedEvidence: [],
      hasEvidence: false,
    };
  }
}
