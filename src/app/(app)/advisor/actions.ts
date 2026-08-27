"use server";

import {
  getOfficeInitialDataAction as _getOfficeInitialDataAction,
  getOfficeSessionDetailAction as _getOfficeSessionDetailAction,
  createRevisionTaskAction as _createRevisionTaskAction,
  deleteOfficeSessionAction as _deleteOfficeSessionAction,
} from "./office-actions";

export type {
  OutlineOption,
  OfficeSessionSummary,
  OfficeSessionDetail,
} from "./office-actions";

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
