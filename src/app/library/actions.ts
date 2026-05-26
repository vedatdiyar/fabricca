"use server";

import {
  uploadPdfAction as uploadPdf,
  getReferencesAction as getReferences,
} from "./_actions/library";
import type { UploadResult, GetReferencesResult } from "./_actions/library";

import {
  saveNoteAction as saveNote,
  getNotesAction as getNotes,
} from "./_actions/notes";
import type { SaveNoteResult, GetNotesResult } from "./_actions/notes";

import { extractAcademicMetadata as extractAcademicMetadataService } from "./_services/metadata.service";
import type { AcademicMetadata } from "./_services/metadata.service";

// Re-export types
export type {
  UploadResult,
  GetReferencesResult,
  SaveNoteResult,
  GetNotesResult,
  AcademicMetadata,
};

export async function uploadPdfAction(
  formData: FormData,
): Promise<UploadResult> {
  return uploadPdf(formData);
}

export async function getReferencesAction(): Promise<GetReferencesResult> {
  return getReferences();
}

export async function saveNoteAction(
  referenceId: number,
  content: string,
): Promise<SaveNoteResult> {
  return saveNote(referenceId, content);
}

export async function getNotesAction(
  referenceId: number,
): Promise<GetNotesResult> {
  return getNotes(referenceId);
}

export async function extractAcademicMetadata(
  markdownText: string,
  fileName: string,
): Promise<AcademicMetadata> {
  return extractAcademicMetadataService(markdownText, fileName);
}
