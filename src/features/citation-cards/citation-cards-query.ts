import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { annotations, sources } from "@/db/schema";
import { type ThesisBoxType } from "@/lib/box-constants";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import { ensureUserMatrixAndBoxes } from "@/services/box/ownership";
import type {
  BoxItem,
  CitationCardItem,
  SourceItem,
} from "@/app/(app)/citation-cards/_lib/types";
import { mapAnnotationToCard } from "./citation-card-mapper";

/**
 * Fetches the user's topic boxes, sources, and citation annotations, assembling client-facing card, box, and source DTOs.
 *
 * @param userId - The authenticated user's ID.
 * @returns The assembled citation card, box, and source DTO arrays.
 */
export async function fetchCitationCardsData(userId: number): Promise<{
  cards: CitationCardItem[];
  boxes: BoxItem[];
  sources: SourceItem[];
}> {
  const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(userId);
  const boxIds = userBoxes.map((b) => b.id);

  const dbSources =
    boxIds.length > 0
      ? await db.query.sources.findMany({
          where: inArray(sources.boxId, boxIds),
          orderBy: [desc(sources.createdAt)],
        })
      : [];

  const dbNotes = await db.query.annotations.findMany({
    where: eq(annotations.userId, userId),
    orderBy: [desc(annotations.createdAt)],
  });

  const boxMap = new Map(userBoxes.map((b) => [b.id, b]));
  const sourceMap = new Map(dbSources.map((s) => [s.id, s]));

  const cardCountMap = new Map<number, number>();
  for (const box of userBoxes) {
    cardCountMap.set(box.id, 0);
  }

  const cards: CitationCardItem[] = [];
  for (const noteRow of dbNotes) {
    const sourceRow = sourceMap.get(noteRow.sourceId);
    if (!sourceRow) continue;

    const boxRow = boxMap.get(sourceRow.boxId);
    if (!boxRow) continue;

    cardCountMap.set(boxRow.id, (cardCountMap.get(boxRow.id) ?? 0) + 1);
    cards.push(mapAnnotationToCard(noteRow, sourceRow, boxRow));
  }

  const formattedBoxes: BoxItem[] = userBoxes.map((b) => ({
    id: b.id,
    boxType: (b.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
    title: b.title,
    description: b.description ?? "",
    cardCount: cardCountMap.get(b.id) ?? 0,
  }));

  const formattedSources: SourceItem[] = dbSources.map((s) => ({
    id: s.id,
    boxId: s.boxId,
    title: s.title,
    authors: formatResourceAuthors({
      authors: s.authors,
      publisher: s.publisher,
      boxType: boxMap.get(s.boxId)?.boxType,
    }),
    publisher: s.publisher ?? "Belirtilmemiş",
    publicationYear: s.publicationYear ?? new Date().getFullYear(),
  }));

  return { cards, boxes: formattedBoxes, sources: formattedSources };
}
