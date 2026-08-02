import type { sources } from "@/db/schema";
import type { ThesisBoxType, LibraryResourceItem } from "../_types/types";

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

  return {
    id: source.id,
    boxType,
    subBoxId: isSubBox ? source.boxId : undefined,
    subBoxTitle: isSubBox ? box.title : undefined,
    title: overrides.title ?? source.title,
    authors: overrides.authors ?? source.authors ?? ["Bilinmeyen Yazar"],
    publisher: overrides.publisher ?? source.publisher ?? "Belirtilmemiş",
    publicationYear:
      overrides.publicationYear ??
      source.publicationYear ??
      new Date().getFullYear(),
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
