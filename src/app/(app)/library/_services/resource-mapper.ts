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
    | "containerTitle"
    | "documentType"
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

// ---------------------------------------------------------------------------
// Lookup table & small formatters (SRP helpers)
// ---------------------------------------------------------------------------

const DEFAULT_BOX_TYPE: Exclude<ThesisBoxType, "ALL"> = "THEORETICAL_FRAMEWORK";

const VALID_BOX_TYPES = new Set<string>([
  "SUBJECT_PROBLEM",
  "THEORETICAL_FRAMEWORK",
  "PRIMARY_MATERIAL",
  "METHODOLOGY",
]);

function resolveBoxType(boxType: string | null): Exclude<ThesisBoxType, "ALL"> {
  if (boxType && VALID_BOX_TYPES.has(boxType)) {
    return boxType as Exclude<ThesisBoxType, "ALL">;
  }
  return DEFAULT_BOX_TYPE;
}

function resolveSubBoxMeta(
  box: ResourceBoxContext,
  sourceBoxId: number,
): Pick<LibraryResourceItem, "subBoxId" | "subBoxTitle"> {
  const isSubBox = box.parentId != null;
  if (!isSubBox) return {};
  return { subBoxId: sourceBoxId, subBoxTitle: box.title };
}

function resolvePublisher(rawPublisher: string | null | undefined): string {
  return rawPublisher ?? "Belirtilmemiş";
}

function resolvePublicationYear(
  overrideYear: number | null | undefined,
  sourceYear: number | null | undefined,
  hasOverride: boolean,
): number | null {
  if (hasOverride) return overrideYear ?? null;
  return sourceYear ?? null;
}

function resolveOptional<T>(overrideVal: T | undefined, sourceVal: T | null | undefined): T | undefined {
  if (overrideVal !== undefined) return overrideVal;
  return sourceVal ?? undefined;
}

function resolvePdfStatus(
  overrideStatus: LibraryResourceItem["pdfStatus"] | undefined,
  sourceStatus: string | null | undefined,
): LibraryResourceItem["pdfStatus"] {
  if (overrideStatus) return overrideStatus;
  return (sourceStatus as LibraryResourceItem["pdfStatus"]) ?? "NOT_UPLOADED";
}

function resolveTitle(
  overrideTitle: string | undefined,
  sourceTitle: string,
): string {
  return overrideTitle ?? sourceTitle;
}

function resolveIsRead(
  overrideIsRead: boolean | undefined,
  sourceIsRead: boolean,
): boolean {
  return overrideIsRead ?? sourceIsRead;
}

// ---------------------------------------------------------------------------
// Public mapper — composes helpers, no branching logic inline
// ---------------------------------------------------------------------------

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
    | "containerTitle"
    | "documentType"
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
  const boxType = resolveBoxType(box.boxType);
  const subBoxMeta = resolveSubBoxMeta(box, source.boxId);

  const rawAuthors = overrides.authors ?? source.authors;
  const rawPublisher = overrides.publisher ?? source.publisher;

  const hasYearOverride = overrides.publicationYear !== undefined;

  return {
    id: source.id,
    boxType,
    ...subBoxMeta,
    title: resolveTitle(overrides.title, source.title),
    authors: formatResourceAuthors({ authors: rawAuthors, publisher: rawPublisher, boxType }),
    containerTitle: resolveOptional(overrides.containerTitle, source.containerTitle),
    documentType: resolveOptional(overrides.documentType, source.documentType),
    publisher: resolvePublisher(rawPublisher),
    publicationYear: resolvePublicationYear(overrides.publicationYear, source.publicationYear, hasYearOverride),
    doi: resolveOptional(overrides.doi, source.doi),
    openalexId: source.openalexId ?? undefined,
    isRead: resolveIsRead(overrides.isRead, source.isRead),
    pdfUrl: resolveOptional(overrides.pdfUrl, source.pdfUrl),
    pdfFileName: resolveOptional(overrides.pdfFileName, source.pdfFileName),
    pdfFileSize: resolveOptional(overrides.pdfFileSize, source.pdfFileSize),
    pdfStatus: resolvePdfStatus(overrides.pdfStatus, source.pdfStatus),
    createdAt: source.createdAt.toISOString(),
  };
}
