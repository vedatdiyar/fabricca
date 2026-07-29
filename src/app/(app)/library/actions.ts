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
 * Server Action: Uploads a PDF file for an existing resource, extracts text, chunks it, and vectorizes embeddings.
 */
export async function uploadResourcePdfAction(
  resourceId: number,
  formData: FormData,
) {
  return pdfActions.uploadResourcePdfAction(resourceId, formData);
}

/**
 * Server Action: Uploads a PDF file, extracts metadata via Unstructured + DOI/Crossref/Gemini,
 * creates a new library resource item, and runs the full RAG pipeline.
 */
export async function createResourceFromPdfAction(formData: FormData) {
  return pdfActions.createResourceFromPdfAction(formData);
}

/**
 * Server Action: Deletes a resource's PDF file from Cloudflare R2 and resets DB PDF status.
 */
export async function deleteResourcePdfAction(resourceId: number) {
  return pdfActions.deleteResourcePdfAction(resourceId);
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
