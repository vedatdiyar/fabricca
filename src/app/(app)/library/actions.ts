"use server";

import * as resourceActions from "./_actions/resource-actions";
import * as pdfActions from "./_actions/pdf-actions";
import * as noteActions from "./_actions/note-actions";
import * as boxActions from "./_actions/box-actions";
import type { NoteType } from "./_types/types";

/**
 * Server Action: Fetches all library resources and notes for the current user.
 *
 * @returns The resources and notes on success, or an error message on failure.
 */
export async function getLibraryResourcesAction() {
  return resourceActions.getLibraryResourcesAction();
}

/**
 * Server Action: Updates metadata (title, authors, publisher, publication year, doi, box) for a library resource.
 *
 * @param input - The metadata update payload.
 * @param input.resourceId - The ID of the resource to update.
 * @param input.title - The new resource title.
 * @param input.authors - The new list of author names.
 * @param input.publisher - The optional publisher name.
 * @param input.publicationYear - The new publication year.
 * @param input.doi - The optional DOI.
 * @param input.boxId - The optional ID of the box to move the resource into.
 * @returns The updated resource on success, or an error message on failure.
 */
export async function updateLibraryResourceAction(input: {
  resourceId: number;
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear?: number | null;
  doi?: string;
  boxId?: number;
}) {
  return resourceActions.updateLibraryResourceAction(input);
}

/**
 * Server Action: Toggles the read status of a library resource.
 *
 * @param resourceId - The ID of the resource to toggle.
 * @returns The new read status on success, or an error message on failure.
 */
export async function toggleResourceReadStatusAction(resourceId: number) {
  return resourceActions.toggleResourceReadStatusAction(resourceId);
}

/**
 * Server Action: Permanently deletes a library resource, its R2 PDF, and cascaded data.
 *
 * @param resourceId - The ID of the resource to delete.
 * @returns A success flag, or an error message on failure.
 */
export async function deleteLibraryResourceAction(resourceId: number) {
  return resourceActions.deleteLibraryResourceAction(resourceId);
}

/**
 * Server Action: Deletes a resource's PDF file from Cloudflare R2 and resets DB PDF status.
 *
 * @param resourceId - The ID of the resource whose PDF will be deleted.
 * @returns A success flag, or an error message on failure.
 */
export async function deleteResourcePdfAction(resourceId: number) {
  return pdfActions.deleteResourcePdfAction(resourceId);
}

/**
 * Server Action (Step 1 of 2): Requests a presigned upload URL for direct browser-to-R2 PDF upload.
 *
 * @param resourceId - The ID of the resource receiving the PDF upload.
 * @returns The presigned upload URL and temp key on success, or an error message on failure.
 */
export async function requestResourcePdfUploadAction(resourceId: number) {
  return pdfActions.requestResourcePdfUploadAction(resourceId);
}

/**
 * Server Action (Step 2 of 2): Completes PDF upload — processes metadata, runs the full RAG ingestion pipeline, and cleans up the temp file.
 *
 * When `pdfBuffer` is provided the server skips the R2 re-fetch round-trip.
 *
 * @param resourceId - The ID of the resource to attach the processed PDF to.
 * @param tempKey - The R2 temp object key of the uploaded PDF.
 * @param originalFileName - The original file name of the uploaded PDF.
 * @param flowId - Optional flow identifier.
 * @param uploadStartedAt - Optional timestamp when the upload started.
 * @param pdfBuffer - Optional Uint8Array-serializable buffer that skips the R2 read.
 * @returns The updated resource item on success, or an error message on failure.
 */
export async function completeResourcePdfUploadAction(
  resourceId: number,
  tempKey: string,
  originalFileName: string,
  flowId?: string,
  uploadStartedAt?: number,
  pdfBuffer?: number[],
) {
  return pdfActions.completeResourcePdfUploadAction(
    resourceId,
    tempKey,
    originalFileName,
    flowId,
    uploadStartedAt,
    pdfBuffer,
  );
}

/**
 * Server Action (Step 1 of 2): Requests a presigned upload URL for creating a new resource from a PDF.
 *
 * @returns The presigned upload URL and temp key on success, or an error message on failure.
 */
export async function requestPdfCreateUploadAction() {
  return pdfActions.requestPdfCreateUploadAction();
}

/**
 * Server Action (Step 2 of 2): Completes PDF creation — processes metadata, creates a new resource, and runs the full RAG pipeline.
 *
 * When `pdfBuffer` is provided the server skips the R2 re-fetch round-trip.
 *
 * @param tempKey - The R2 temp object key of the uploaded PDF.
 * @param originalFileName - The original file name of the uploaded PDF.
 * @param boxId - The ID of the box the new resource will be placed in.
 * @param flowId - Optional flow identifier.
 * @param uploadStartedAt - Optional timestamp when the upload started.
 * @param pdfBuffer - Optional Uint8Array-serializable buffer that skips the R2 read.
 * @returns The created resource item on success, or an error message on failure.
 */
export async function completePdfCreateUploadAction(
  tempKey: string,
  originalFileName: string,
  boxId: number,
  flowId?: string,
  uploadStartedAt?: number,
  pdfBuffer?: number[],
) {
  return pdfActions.completePdfCreateUploadAction(
    tempKey,
    originalFileName,
    boxId,
    flowId,
    uploadStartedAt,
    pdfBuffer,
  );
}

/**
 * Server Action: Fetches the current user's real thesis box hierarchy (parent boxes with their sub-boxes) for the PDF upload selector.
 *
 * @returns The parent box hierarchy for the PDF upload selector, or an error message on failure.
 */
export async function getBoxHierarchyForLibraryAction() {
  return boxActions.getBoxHierarchyForLibraryAction();
}

/**
 * Server Action: Creates a new note / page-numbered citation linked to a library resource.
 *
 * @param input - The note data to create.
 * @param input.resourceId - The ID of the resource the note is linked to.
 * @param input.pageNumber - The page number the note refers to.
 * @param input.noteType - The type of the note.
 * @param input.content - The note text.
 * @param input.comment - Optional personal meta-comment / annotation attached to the note.
 * @returns The created note data on success, or an error message on failure.
 */
export async function createResourceNoteAction(input: {
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
  comment?: string;
}) {
  return noteActions.createResourceNoteAction(input);
}

/**
 * Server Action: Deletes a note by ID for the logged in user.
 *
 * @param noteId - The ID of the note to delete.
 * @returns A success flag, or an error message on failure.
 */
export async function deleteResourceNoteAction(noteId: number) {
  return noteActions.deleteResourceNoteAction(noteId);
}
