import type { LibraryResourceItem } from "@/app/(app)/library/_lib/types";
import {
  mapSourceToResource,
  type ResourceBoxContext,
} from "./resource-mapper";
import type { ExtractedPdfContent } from "./pdf-upload";
import type { ResourceSourceRow } from "./upload-target";

/**
 * Builds the final client-facing resource item with the freshly extracted metadata
 * and pipeline PDF results, using the create vs upgrade field overrides.
 *
 * @param createMode - Whether this is a new-resource or existing-resource flow.
 * @param targetResource - The resolved source row.
 * @param boxMeta - The box context for the target resource.
 * @param metadata - The extracted PDF metadata.
 * @param pipelineResult - The pipeline result with R2 URL and chunk data.
 * @returns The mapped LibraryResourceItem DTO.
 */
export function buildCompletionResourceItem(
  createMode: boolean,
  targetResource: ResourceSourceRow,
  boxMeta: ResourceBoxContext,
  metadata: ExtractedPdfContent["metadata"],
  pipelineResult: {
    r2Url: string;
    finalFileName: string;
    finalSize: number;
  },
): LibraryResourceItem {
  return mapSourceToResource(
    targetResource,
    boxMeta,
    createMode
      ? {
          containerTitle: metadata.containerTitle || undefined,
          documentType: metadata.documentType || undefined,
          isRead: false,
          pdfUrl: pipelineResult.r2Url,
          pdfFileName: pipelineResult.finalFileName,
          pdfFileSize: pipelineResult.finalSize,
          pdfStatus: "READY",
        }
      : {
          title: metadata.title,
          authors: metadata.authors,
          containerTitle:
            metadata.containerTitle ||
            targetResource.containerTitle ||
            undefined,
          documentType:
            metadata.documentType || targetResource.documentType || undefined,
          publisher: metadata.publisher || "Belirtilmemiş",
          publicationYear: metadata.publicationYear,
          doi: metadata.doi || undefined,
          pdfUrl: pipelineResult.r2Url,
          pdfFileName: pipelineResult.finalFileName,
          pdfFileSize: pipelineResult.finalSize,
          pdfStatus: "READY",
        },
  );
}
