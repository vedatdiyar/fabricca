import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import { boxes, matrices, positioning, sources } from "@/core/db/schema";
import type {
  RecommendedThesisItem,
  StrategicRole,
} from "@/app/(onboarding)/onboarding/positioning/_services/validation";
import { normalizeTitle } from "@/lib/academic/utils";

/**
 * Maps each strategic role to its canonical target thesis box type.
 */
export const STRATEGIC_ROLE_TO_BOX_TYPE: Record<
  StrategicRole,
  "SUBJECT_PROBLEM" | "THEORETICAL_FRAMEWORK" | "METHODOLOGY"
> = {
  SPECIFIC_FOCUS: "SUBJECT_PROBLEM",
  FOUNDATIONAL_WORK: "THEORETICAL_FRAMEWORK",
  METHODOLOGICAL_BENCHMARK: "METHODOLOGY",
  ALTERNATIVE_PERSPECTIVE: "THEORETICAL_FRAMEWORK",
};

/**
 * Returns only the primary language portion of a thesis title by cutting it at
 * the " / " separator (YÖK stores titles as "Türkçe / English").
 *
 * @param title - The raw thesis title to clean.
 * @returns The primary (Turkish) title fragment, or the raw title when unchanged.
 */
export function cleanThesisTitle(title: string): string {
  const separatorIndex = title.indexOf(" / ");
  return separatorIndex === -1 ? title : title.slice(0, separatorIndex).trim();
}

/**
 * Persists the essential reading theses identified in the positioning report
 * directly into their corresponding topic boxes as primary academic sources,
 * rather than isolating them in a separate box.
 *
 * @param userId - The database ID of the user.
 */
export async function placeEssentialThesesInBoxes(
  userId: number,
): Promise<void> {
  const [matrix] = await db
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, userId))
    .limit(1);

  if (!matrix) {
    return;
  }

  const [positioningRow] = await db
    .select({ recommendedTheses: positioning.recommendedTheses })
    .from(positioning)
    .where(eq(positioning.userId, userId))
    .limit(1);

  const theses = (positioningRow?.recommendedTheses ??
    []) as RecommendedThesisItem[];
  if (theses.length === 0) {
    return;
  }

  const allBoxes = await db
    .select({
      id: boxes.id,
      parentId: boxes.parentId,
      boxType: boxes.boxType,
      title: boxes.title,
    })
    .from(boxes)
    .where(eq(boxes.matrixId, matrix.id));

  if (allBoxes.length === 0) {
    return;
  }

  const allBoxIds = allBoxes.map((b) => b.id);

  // Load existing sources across all user's boxes to avoid duplicate inserts
  const existingSources = await db
    .select({
      id: sources.id,
      boxId: sources.boxId,
      title: sources.title,
      doi: sources.doi,
    })
    .from(sources)
    .where(inArray(sources.boxId, allBoxIds));

  const existingTitles = new Set(
    existingSources.map((s) => normalizeTitle(s.title)).filter(Boolean),
  );
  const existingDois = new Set(
    existingSources
      .map((s) => s.doi?.toLowerCase().trim())
      .filter((d): d is string => !!d),
  );

  const toInsert: Array<{
    boxId: number;
    title: string;
    authors: string[];
    publisher: string | null;
    documentType: string | null;
    publicationYear: number;
    doi: string | null;
    isRead: boolean;
  }> = [];

  for (const thesis of theses) {
    const role: StrategicRole = thesis.strategicRole ?? "SPECIFIC_FOCUS";
    const targetBoxType = STRATEGIC_ROLE_TO_BOX_TYPE[role] ?? "SUBJECT_PROBLEM";

    const parentBox = allBoxes.find(
      (b) => b.parentId === null && b.boxType === targetBoxType,
    );
    if (!parentBox) continue;

    // Prefer placing in the first child sub-box; fall back to the parent box if no sub-box exists
    const subBox =
      allBoxes.find((b) => b.parentId === parentBox.id) ?? parentBox;
    const targetBoxId = subBox.id;

    const cleanedTitle = cleanThesisTitle(thesis.title);
    const titleKey = normalizeTitle(cleanedTitle);
    const thesisUrl =
      thesis.doi ||
      thesis.tezaraUrl ||
      (thesis.externalThesisId
        ? `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${thesis.externalThesisId}`
        : null);
    const doiKey = thesisUrl?.toLowerCase().trim() ?? null;

    if (
      (titleKey && existingTitles.has(titleKey)) ||
      (doiKey && existingDois.has(doiKey))
    ) {
      continue;
    }

    if (titleKey) existingTitles.add(titleKey);
    if (doiKey) existingDois.add(doiKey);

    toInsert.push({
      boxId: targetBoxId,
      title: cleanedTitle,
      authors: [thesis.author].filter((a) => a && a.length > 0),
      publisher: thesis.university || null,
      documentType: "thesis",
      publicationYear: thesis.year,
      doi: thesisUrl,
      isRead: false,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(sources).values(toInsert);
  }
}
