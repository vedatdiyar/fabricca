"use server";

import {
  uploadPdfAction as uploadPdf,
  getReferencesAction as getReferences,
} from "./_actions/library";
import type { UploadResult, GetReferencesResult } from "./_actions/library";

import {
  saveNoteAction as saveNote,
  getNotesAction as getNotes,
  getThesisBoxesAction as getThesisBoxes,
  updateNoteBoxAction as updateNoteBox,
  getAllNotesWithReferencesAction as getAllNotesWithReferences,
} from "./_actions/notes";
import type {
  SaveNoteResult,
  GetNotesResult,
  GetThesisBoxesResult,
  GetAllNotesWithReferencesResult,
} from "./_actions/notes";

import { extractAcademicMetadata as extractAcademicMetadataService } from "./_services/metadata.service";
import type { AcademicMetadata } from "./_services/metadata.service";

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
  boxId?: number | null,
): Promise<SaveNoteResult> {
  return saveNote(referenceId, content, boxId);
}

export async function getNotesAction(
  referenceId: number,
): Promise<GetNotesResult> {
  return getNotes(referenceId);
}

export async function getThesisBoxesAction(): Promise<GetThesisBoxesResult> {
  return getThesisBoxes();
}

export async function updateNoteBoxAction(
  noteId: number,
  boxId: number,
): Promise<{ success: boolean; error?: string }> {
  return updateNoteBox(noteId, boxId);
}

export async function getAllNotesWithReferencesAction(): Promise<GetAllNotesWithReferencesResult> {
  return getAllNotesWithReferences();
}

export async function extractAcademicMetadata(
  markdownText: string,
  fileName: string,
): Promise<AcademicMetadata> {
  return extractAcademicMetadataService(markdownText, fileName);
}
