"use server";

// Re-export actions & result interfaces from Library Action Orchestrator
export { uploadPdfAction, getReferencesAction } from "./_actions/library";
export type { UploadResult, GetReferencesResult } from "./_actions/library";

// Re-export actions & result interfaces from Notes Action Orchestrator
export { saveNoteAction, getNotesAction } from "./_actions/notes";
export type { SaveNoteResult, GetNotesResult } from "./_actions/notes";

// Re-export academic metadata functions & interfaces
export { extractAcademicMetadata } from "./_services/metadata.service";
export type { AcademicMetadata } from "./_services/metadata.service";
