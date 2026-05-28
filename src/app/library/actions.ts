"use server";

import {
  uploadPdfAction as uploadPdf,
  getReferencesAction as getReferences,
  deleteReferenceAction as deleteReference,
} from "./_actions/library";
import type { UploadResult, GetReferencesResult } from "./_actions/library";

import {
  saveNoteAction as saveNote,
  getNotesAction as getNotes,
  getThesisBoxesAction as getThesisBoxes,
  updateNoteBoxAction as updateNoteBox,
  getAllNotesWithReferencesAction as getAllNotesWithReferences,
  updateNoteAction as updateNote,
  getNotesByFieldAction as getNotesByField,
  searchNotesByFieldAction as searchNotesByField,
} from "./_actions/notes";
import type {
  SaveNoteResult,
  GetNotesResult,
  GetThesisBoxesResult,
  GetAllNotesWithReferencesResult,
  UpdateNoteParams,
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

export async function deleteReferenceAction(
  referenceId: number,
): Promise<{ success: boolean; error?: string }> {
  return deleteReference(referenceId);
}

export async function saveNoteAction(
  referenceId: number,
  contentOrParams:
    | string
    | {
        mainArgument?: string;
        quotes?: string;
        concepts?: string;
        criticalNotes?: string;
        connections?: string;
        researchNotes?: string;
        memoryAnchors?: string;
        content?: string;
      },
  boxId?: number | null,
): Promise<SaveNoteResult> {
  return saveNote(referenceId, contentOrParams, boxId);
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

export async function updateNoteAction(
  params: UpdateNoteParams,
): Promise<{ success: boolean; error?: string }> {
  return updateNote(params);
}

type AcademicField =
  | "mainArgument"
  | "quotes"
  | "concepts"
  | "criticalNotes"
  | "connections"
  | "researchNotes"
  | "memoryAnchors";

export async function getNotesByFieldAction(
  referenceId: number,
  field: AcademicField,
): Promise<GetNotesResult> {
  return getNotesByField(referenceId, field);
}

export async function searchNotesByFieldAction(
  query: string,
  field: AcademicField,
): Promise<GetNotesResult> {
  return searchNotesByField(query, field);
}

export async function extractAcademicMetadata(
  markdownText: string,
  fileName: string,
): Promise<AcademicMetadata> {
  return extractAcademicMetadataService(markdownText, fileName);
}
