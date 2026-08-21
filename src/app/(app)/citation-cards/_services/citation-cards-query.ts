import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  annotations,
  outlines,
  outlineAnnotations,
  sources,
} from "@/core/db/schema";
import { type ThesisBoxType } from "@/lib/box-constants";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import { ensureUserMatrixAndBoxes } from "@/core/services/box/ownership";
import type {
  BoxItem,
  CitationCardItem,
  OutlineItem,
  SourceItem,
} from "@/app/(app)/citation-cards/_lib/types";
import { mapAnnotationToCard } from "../_lib/citation-card-mapper";

/**
 * Fetches the user's topic boxes, sources, outlines, and citation annotations, assembling client-facing card, box, source, and outline DTOs.
 *
 * @param userId - The authenticated user's ID.
 * @returns The assembled citation card, box, source, and outline DTO arrays.
 */
export async function fetchCitationCardsData(userId: number): Promise<{
  cards: CitationCardItem[];
  boxes: BoxItem[];
  sources: SourceItem[];
  outlines: OutlineItem[];
}> {
  const { matrix, boxes: userBoxes } = await ensureUserMatrixAndBoxes(userId);
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

  const noteIds = dbNotes.map((n) => n.id);

  // Fetch all outline sections for this matrix
  const dbOutlines = await db.query.outlines.findMany({
    where: eq(outlines.matrixId, matrix.id),
    orderBy: [asc(outlines.sortOrder)],
  });

  // Fetch outline_annotations junction records
  const dbOutlineAnnoLinks =
    noteIds.length > 0
      ? await db.query.outlineAnnotations.findMany({
          where: inArray(outlineAnnotations.annotationId, noteIds),
        })
      : [];

  const outlineMap = new Map(dbOutlines.map((o) => [o.id, o]));
  const boxMap = new Map(userBoxes.map((b) => [b.id, b]));
  const sourceMap = new Map(dbSources.map((s) => [s.id, s]));

  // Build mapping from annotationId -> array of outline objects
  const noteOutlineMap = new Map<number, { ids: number[]; titles: string[] }>();
  for (const link of dbOutlineAnnoLinks) {
    const existing = noteOutlineMap.get(link.annotationId) ?? {
      ids: [],
      titles: [],
    };
    const targetOutline = outlineMap.get(link.outlineId);
    if (targetOutline) {
      existing.ids.push(targetOutline.id);
      existing.titles.push(targetOutline.title);
    }
    noteOutlineMap.set(link.annotationId, existing);
  }

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
    const outlineInfo = noteOutlineMap.get(noteRow.id) ?? {
      ids: [],
      titles: [],
    };
    cards.push(
      mapAnnotationToCard(
        noteRow,
        sourceRow,
        boxRow,
        outlineInfo.ids,
        outlineInfo.titles,
      ),
    );
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

  const formattedOutlines: OutlineItem[] = dbOutlines.map((o) => ({
    id: o.id,
    parentId: o.parentId,
    title: o.title,
    description: o.description,
    sortOrder: o.sortOrder,
    academicField: o.academicField,
  }));

  return {
    cards,
    boxes: formattedBoxes,
    sources: formattedSources,
    outlines: formattedOutlines,
  };
}
