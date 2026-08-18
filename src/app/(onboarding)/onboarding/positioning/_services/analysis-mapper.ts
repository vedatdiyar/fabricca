import type { EvaluatedThesis } from "./per-thesis-evaluation";
import type { JuryRecommendedThesis } from "./analysis-schemas";

/**
 * Deterministically builds the recommended guiding thesis cards straight from the
 * evaluated theses — no LLM involvement. Direct-overlap theses are excluded per
 * the "Tam Kapsam" rule that previously lived in the prompt.
 *
 * @param evaluatedTheses - The relevant evaluated theses to convert into cards.
 * @returns The recommended guiding thesis items.
 */
export function mapRecommendedTheses(
  evaluatedTheses: EvaluatedThesis[],
): JuryRecommendedThesis[] {
  return evaluatedTheses
    .filter((ev) => ev.evaluation.isRelevant && !ev.evaluation.isDirectOverlap)
    .map((ev) => {
      const t = ev.thesis;
      const e = ev.evaluation;
      return {
        externalThesisId: String(t.id),
        title: t.title,
        author: t.author,
        year: t.year,
        university: t.university,
        strategicRole: e.strategicRole ?? "SPECIFIC_FOCUS",
        literaturePosition: e.literaturePosition ?? "",
        contributionArea: e.contributionAreas.join(", ") || "",
        relevanceReason: e.strategicUtility ?? "",
        thesisType: t.thesisType,
        abstract: t.abstract || undefined,
        tezaraUrl: `https://tezara.org/theses/${t.id}`,
      };
    });
}
