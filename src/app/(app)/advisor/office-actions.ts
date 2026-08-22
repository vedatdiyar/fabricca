"use server";

import { getOfficeInitialDataAction as _getOfficeInitialDataAction } from "./_services/office/session-list-service";
import { getOfficeSessionDetailAction as _getOfficeSessionDetailAction } from "./_services/office/session-detail-service";
import { saveDefenseNoteAction as _saveDefenseNoteAction } from "./_services/office/defense-note-service";
import {
  createRevisionTaskAction as _createRevisionTaskAction,
  deleteOfficeSessionAction as _deleteOfficeSessionAction,
} from "./_services/office/task-service";

export type { OutlineOption, OfficeSessionSummary, OfficeSessionDetail } from "./_services/office/types";

export async function getOfficeInitialDataAction(
  ...args: Parameters<typeof _getOfficeInitialDataAction>
): Promise<Awaited<ReturnType<typeof _getOfficeInitialDataAction>>> {
  return _getOfficeInitialDataAction(...args);
}

export async function getOfficeSessionDetailAction(
  ...args: Parameters<typeof _getOfficeSessionDetailAction>
): Promise<Awaited<ReturnType<typeof _getOfficeSessionDetailAction>>> {
  return _getOfficeSessionDetailAction(...args);
}

export async function saveDefenseNoteAction(
  ...args: Parameters<typeof _saveDefenseNoteAction>
): Promise<Awaited<ReturnType<typeof _saveDefenseNoteAction>>> {
  return _saveDefenseNoteAction(...args);
}

export async function createRevisionTaskAction(
  ...args: Parameters<typeof _createRevisionTaskAction>
): Promise<Awaited<ReturnType<typeof _createRevisionTaskAction>>> {
  return _createRevisionTaskAction(...args);
}

export async function deleteOfficeSessionAction(
  ...args: Parameters<typeof _deleteOfficeSessionAction>
): Promise<Awaited<ReturnType<typeof _deleteOfficeSessionAction>>> {
  return _deleteOfficeSessionAction(...args);
}
