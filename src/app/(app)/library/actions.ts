"use server";

import * as resourceActions from "./_actions/resource-actions";
import * as pdfActions from "./_actions/pdf-actions";
import * as noteActions from "./_actions/note-actions";
import type { ThesisBoxType, NoteType } from "./_types/types";

/**
 * Server Action: Fetches all library resources and notes for the current user.
 */
export async function getLibraryResourcesAction() {
  return resourceActions.getLibraryResourcesAction();
}

/**
 * Server Action: Creates a new library resource item in the database.
 */
export async function createLibraryResourceAction(input: {
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear: number;
  doi?: string;
  url?: string;
  boxType: Exclude<ThesisBoxType, "ALL">;
}) {
  return resourceActions.createLibraryResourceAction(input);
}

/**
 * Server Action: Toggles the read status of a library resource.
 */
export async function toggleResourceReadStatusAction(resourceId: number) {
  return resourceActions.toggleResourceReadStatusAction(resourceId);
}

/**
 * Server Action: Permanently deletes a library resource, its R2 PDF, and cascaded data.
 */
export async function deleteLibraryResourceAction(resourceId: number) {
  return resourceActions.deleteLibraryResourceAction(resourceId);
}

/**
 * Server Action: Deletes a resource's PDF file from Cloudflare R2 and resets DB PDF status.
 */
export async function deleteResourcePdfAction(resourceId: number) {
  return pdfActions.deleteResourcePdfAction(resourceId);
}

/**
 * Server Action (Step 1 of 2): Requests a presigned upload URL for direct browser-to-R2 PDF upload.
 */
export async function requestResourcePdfUploadAction(resourceId: number) {
  return pdfActions.requestResourcePdfUploadAction(resourceId);
}

/**
 * Server Action (Step 2 of 2): Completes PDF upload — fetches from R2 temp key, extracts metadata,
 * and runs the full RAG ingestion pipeline for an existing resource.
 */
export async function completeResourcePdfUploadAction(
  resourceId: number,
  tempKey: string,
  originalFileName: string,
) {
  return pdfActions.completeResourcePdfUploadAction(
    resourceId,
    tempKey,
    originalFileName,
  );
}

/**
 * Server Action (Step 1 of 2): Requests a presigned upload URL for creating a new resource from a PDF.
 */
export async function requestPdfCreateUploadAction() {
  return pdfActions.requestPdfCreateUploadAction();
}

/**
 * Server Action (Step 2 of 2): Completes PDF creation — fetches from R2 temp key, extracts metadata,
 * creates a new resource, and runs the full RAG pipeline.
 */
export async function completePdfCreateUploadAction(
  tempKey: string,
  originalFileName: string,
  boxType: Exclude<ThesisBoxType, "ALL">,
) {
  return pdfActions.completePdfCreateUploadAction(
    tempKey,
    originalFileName,
    boxType,
  );
}

/**
 * Server Action: Creates a new note / page-numbered citation linked to a library resource.
 */
export async function createResourceNoteAction(input: {
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
}) {
  return noteActions.createResourceNoteAction(input);
}

/**
 * Server Action: Deletes a note by ID for the logged in user.
 */
export async function deleteResourceNoteAction(noteId: number) {
  return noteActions.deleteResourceNoteAction(noteId);
}
