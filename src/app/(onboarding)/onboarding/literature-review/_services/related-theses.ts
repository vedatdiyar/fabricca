import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { boxes, matrices, positioning, sources } from "@/core/db/schema";
import { BOX_TYPE_DESCRIPTIONS } from "@/lib/box-constants";
import type { RecommendedThesisItem } from "@/app/(onboarding)/onboarding/positioning/_services/validation";

/** Display title of the parent box holding strategic guide theses. */
const RELATED_THESES_TITLE = "İlgili Tezler";

/**
 * Returns only the primary language portion of a thesis title by cutting it at
 * the " / " separator (YÖK stores titles as "Türkçe / English").
 *
 * @param title - The raw thesis title to clean.
 * @returns The primary (Turkish) title fragment, or the raw title when unchanged.
 */
function cleanThesisTitle(title: string): string {
  const separatorIndex = title.indexOf(" / ");
  return separatorIndex === -1 ? title : title.slice(0, separatorIndex).trim();
}

/**
 * Persists the strategic guide theses from the positioning report into the
 * sources table under a dedicated RELATED_THESES box, creating the box on
 * demand and replacing any prior entries. Runs together with the literature
 * review so the sources pool only fills once the review is performed.
 *
 * @param userId - The id of the user owning the theses.
 */
export async function persistRelatedTheses(userId: number): Promise<void> {
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

  await db.transaction(async (tx) => {
    let [relatedBox] = await tx
      .select({ id: boxes.id })
      .from(boxes)
      .where(
        and(eq(boxes.matrixId, matrix.id), eq(boxes.boxType, "RELATED_THESES")),
      )
      .limit(1);

    if (!relatedBox) {
      const [inserted] = await tx
        .insert(boxes)
        .values({
          matrixId: matrix.id,
          title: RELATED_THESES_TITLE,
          boxType: "RELATED_THESES",
          description:
            BOX_TYPE_DESCRIPTIONS.RELATED_THESES ??
            "Tez konunuz ve konumlandırmanız ile doğrudan ilişkili, incelenmesi önerilen YÖK ve akademik tez çalışmaları.",
          parentId: null,
          concepts: [],
        })
        .returning({ id: boxes.id });
      relatedBox = inserted;
    }

    if (!relatedBox) return;

    // Delete existing sources for this RELATED_THESES box to prevent duplicates
    await tx.delete(sources).where(eq(sources.boxId, relatedBox.id));

    const toInsert = theses.map((t) => {
      const thesisUrl =
        t.doi ||
        t.tezaraUrl ||
        (t.externalThesisId
          ? `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${t.externalThesisId}`
          : null);

      const noteSections = [
        t.abstract ? `ÖZET: ${t.abstract}` : null,
        t.contributionArea ? `KATKI ALANI: ${t.contributionArea}` : null,
        t.relevanceReason ? `STRATEJİK KULLANIM: ${t.relevanceReason}` : null,
      ].filter((s): s is string => !!s && s.trim().length > 0);

      return {
        boxId: relatedBox.id,
        title: cleanThesisTitle(t.title),
        authors: [t.author].filter((a) => a && a.length > 0),
        publisher: t.university || null,
        thesisType: t.thesisType || null,
        publicationYear: t.year,
        doi: thesisUrl,
        comparisonNote:
          noteSections.length > 0 ? noteSections.join("\n\n") : null,
        isRead: false,
        relevanceScore: 100,
      };
    });

    if (toInsert.length > 0) {
      await tx.insert(sources).values(toInsert);
    }
  });
}
