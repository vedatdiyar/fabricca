"use server";

export type { OutlineOption, OfficeSessionSummary, OfficeSessionDetail } from "./_services/office/types";
export { getOfficeInitialDataAction } from "./_services/office/session-list-service";
export { getOfficeSessionDetailAction } from "./_services/office/session-detail-service";
export { saveDefenseNoteAction } from "./_services/office/defense-note-service";
export { createRevisionTaskAction, deleteOfficeSessionAction } from "./_services/office/task-service";
