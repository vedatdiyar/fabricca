import type { Annotation, Box, Source } from "@/core/db/schema";
import { type ThesisBoxType } from "@/lib/box-constants";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import type {
  CitationCardItem,
  CitationNoteType,
} from "@/app/(app)/citation-cards/_lib/types";

/**
 * Shapes an annotation DB row into a client-facing citation card DTO using its linked source and topic box.
 *
 * @param annotation - The annotation (note) DB row.
 * @param source - The linked source row.
 * @param box - The topic box the source belongs to.
 * @returns The citation card DTO.
 */
export function mapAnnotationToCard(
  annotation: Annotation,
  source: Source,
  box: Box,
): CitationCardItem {
  return {
    id: annotation.id,
    sourceId: source.id,
    sourceTitle: source.title,
    sourceAuthors: formatResourceAuthors({
      authors: source.authors,
      publisher: source.publisher,
      boxType: box.boxType,
    }),
    sourceYear: source.publicationYear ?? new Date().getFullYear(),
    boxId: box.id,
    boxType: (box.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
    boxTitle: box.title,
    pageNumber: annotation.pageNumber,
    noteType: annotation.noteType as CitationNoteType,
    content: annotation.content,
    comment: annotation.comment ?? undefined,
    sentToCitationCards: annotation.sentToCitationCards,
    createdAt: annotation.createdAt.toISOString(),
    updatedAt: annotation.updatedAt.toISOString(),
  };
}
