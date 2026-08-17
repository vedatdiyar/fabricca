import type { sources } from "@/core/db/schema";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import type {
  ThesisBoxType,
  LibraryResourceItem,
} from "@/app/(app)/library/_lib/types";

type SourceRow = typeof sources.$inferSelect;

/** Minimal box context needed to derive the box badge and sub-box metadata. */
export interface ResourceBoxContext {
  boxType: string | null;
  title: string;
  parentId: number | null;
}

/** Client-facing fields that pipeline flows may override (fresh metadata / PDF results). */
export type ResourceFieldOverrides = Partial<
  Pick<
    LibraryResourceItem,
    | "title"
    | "authors"
    | "publisher"
    | "publicationYear"
    | "doi"
    | "pdfUrl"
    | "pdfFileName"
    | "pdfFileSize"
    | "pdfStatus"
    | "isRead"
  >
>;

/**
 * Maps a library source row (with its attached box context) into the client-facing
 * LibraryResourceItem DTO, deriving the badge type and optional sub-box metadata from
 * the box context while overrides let pipeline flows substitute freshly extracted
 * metadata or PDF results.
 *
 * @param source - The source row to map.
 * @param box - Box context for the attached box (boxType, title, parentId).
 * @param overrides - Optional field overrides for pipeline-produced values.
 * @returns The client-facing LibraryResourceItem.
 */
export function mapSourceToResource(
  source: Pick<
    SourceRow,
    | "id"
    | "boxId"
    | "title"
    | "authors"
    | "publisher"
    | "publicationYear"
    | "doi"
    | "openalexId"
    | "isRead"
    | "pdfUrl"
    | "pdfFileName"
    | "pdfFileSize"
    | "pdfStatus"
    | "createdAt"
  >,
  box: ResourceBoxContext,
  overrides: ResourceFieldOverrides = {},
): LibraryResourceItem {
  const isSubBox = box.parentId != null;
  const boxType = (box.boxType || "THEORETICAL_FRAMEWORK") as Exclude<
    ThesisBoxType,
    "ALL"
  >;

  const rawAuthors = overrides.authors ?? source.authors;
  const rawPublisher = overrides.publisher ?? source.publisher;

  return {
    id: source.id,
    boxType,
    subBoxId: isSubBox ? source.boxId : undefined,
    subBoxTitle: isSubBox ? box.title : undefined,
    title: overrides.title ?? source.title,
    authors: formatResourceAuthors({
      authors: rawAuthors,
      publisher: rawPublisher,
      boxType,
    }),
    publisher: rawPublisher ?? "Belirtilmemiş",
    publicationYear:
      overrides.publicationYear !== undefined
        ? overrides.publicationYear
        : (source.publicationYear ?? null),
    doi: overrides.doi ?? source.doi ?? undefined,
    openalexId: source.openalexId ?? undefined,
    isRead: overrides.isRead ?? source.isRead,
    pdfUrl: overrides.pdfUrl ?? source.pdfUrl ?? undefined,
    pdfFileName: overrides.pdfFileName ?? source.pdfFileName ?? undefined,
    pdfFileSize: overrides.pdfFileSize ?? source.pdfFileSize ?? undefined,
    pdfStatus: overrides.pdfStatus ?? source.pdfStatus ?? "NOT_UPLOADED",
    createdAt: source.createdAt.toISOString(),
  };
}
