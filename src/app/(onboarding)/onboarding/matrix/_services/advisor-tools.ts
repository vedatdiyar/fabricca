import { searchTheses } from "@/core/services/thesis-search";
import { searchOpenAlex } from "@/app/(onboarding)/onboarding/literature-review/_services/openalex/openalex-search";
import { searchExa } from "@/core/services/exa";
import { Logger, createFlowId } from "@/lib/logger";

/**
 * Summarized representation of an empirical or web discovery.
 */
export interface EmpiricalContextSummary {
  title: string;
  url: string;
  keyInsights: string[];
}

/**
 * Summarized representation of a precedent thesis.
 */
export interface PrecedentThesisSummary {
  id: number;
  title: string;
  year?: string | number;
  department?: string;
  university?: string;
  abstractSnippet: string;
}

/**
 * Summarized representation of an academic work from literature.
 */
export interface ScholarlyWorkSummary {
  title: string;
  doi?: string;
  citedByCount: number;
  authors: string[];
}

/**
 * Queries the 366k+ thesis vector archive in Qdrant Cloud for precedent methodology and topic patterns.
 *
 * @param query - Academic search query representing topic or method.
 * @returns Top matching precedent theses.
 */
export async function queryPrecedentTheses(
  query: string,
): Promise<PrecedentThesisSummary[]> {
  const log = new Logger(createFlowId());
  try {
    const results = await searchTheses(query, undefined, {
      limit: 4,
      rankingScoreThreshold: 0.55,
      silent: true,
    });

    return results.slice(0, 3).map((t) => ({
      id: t.id,
      title: t.title,
      year: t.year,
      department: t.department,
      university: t.university,
      abstractSnippet: t.abstract
        ? t.abstract.slice(0, 300) + "..."
        : "Özet bulunamadı.",
    }));
  } catch (error) {
    log.warn("Precedent thesis lookup failed", {
      step: "advisor_thesis_lookup_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Queries OpenAlex for foundational literature, seminal papers, and theoretical discussions.
 *
 * @param query - Academic literature search query.
 * @returns Relevant scholarly papers.
 */
export async function queryScholarlyLiterature(
  query: string,
): Promise<ScholarlyWorkSummary[]> {
  const log = new Logger(createFlowId());
  try {
    const papers = await searchOpenAlex(query, 5);
    return papers.slice(0, 3).map((p) => ({
      title: p.title ?? "Başlıksız Çalışma",
      doi: p.doi ?? undefined,
      citedByCount: p.citedByCount ?? 0,
      authors: (p.authors ?? []).slice(0, 3),
    }));
  } catch (error) {
    log.warn("Scholarly literature lookup failed", {
      step: "advisor_literature_lookup_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Queries Exa.ai for Turkish academic publications, DergiPark articles, and industry reports.
 *
 * @param query - Empirical context search query.
 * @returns Relevant empirical sources with highlights.
 */
export async function queryEmpiricalContext(
  query: string,
): Promise<EmpiricalContextSummary[]> {
  const log = new Logger(createFlowId());
  try {
    const results = await searchExa(query, { numResults: 3 });
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      keyInsights: r.highlights ?? [],
    }));
  } catch (error) {
    log.warn("Empirical context lookup failed", {
      step: "advisor_empirical_lookup_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
