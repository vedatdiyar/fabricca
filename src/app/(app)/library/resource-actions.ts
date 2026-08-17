"use server";

import { getLibraryResourcesAction as _getLibraryResourcesAction } from "./resource-queries";
import {
  toggleResourceReadStatusAction as _toggleResourceReadStatusAction,
  deleteLibraryResourceAction as _deleteLibraryResourceAction,
  updateLibraryResourceAction as _updateLibraryResourceAction,
} from "./resource-mutations";

export async function getLibraryResourcesAction(
  ...args: Parameters<typeof _getLibraryResourcesAction>
) {
  return _getLibraryResourcesAction(...args);
}

export async function toggleResourceReadStatusAction(
  ...args: Parameters<typeof _toggleResourceReadStatusAction>
) {
  return _toggleResourceReadStatusAction(...args);
}

export async function deleteLibraryResourceAction(
  ...args: Parameters<typeof _deleteLibraryResourceAction>
) {
  return _deleteLibraryResourceAction(...args);
}

export async function updateLibraryResourceAction(
  ...args: Parameters<typeof _updateLibraryResourceAction>
) {
  return _updateLibraryResourceAction(...args);
}
