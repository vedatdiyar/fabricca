"use server";

import { updateMatrixAction as _updateMatrixAction } from "./matrix-actions";
import {
  updateBoxAction as _updateBoxAction,
  createSubBoxAction as _createSubBoxAction,
  deleteSubBoxAction as _deleteSubBoxAction,
} from "./box-actions";
import {
  createOutlineSectionAction as _createOutlineSectionAction,
  updateOutlineSectionAction as _updateOutlineSectionAction,
  deleteOutlineSectionAction as _deleteOutlineSectionAction,
} from "./outline-actions";
import {
  linkAnnotationToOutlineAction as _linkAnnotationToOutlineAction,
  unlinkAnnotationFromOutlineAction as _unlinkAnnotationFromOutlineAction,
  linkSourceToOutlineAction as _linkSourceToOutlineAction,
  unlinkSourceFromOutlineAction as _unlinkSourceFromOutlineAction,
} from "./link-actions";

export async function updateMatrixAction(
  ...args: Parameters<typeof _updateMatrixAction>
) {
  return _updateMatrixAction(...args);
}

export async function updateBoxAction(
  ...args: Parameters<typeof _updateBoxAction>
) {
  return _updateBoxAction(...args);
}

export async function createSubBoxAction(
  ...args: Parameters<typeof _createSubBoxAction>
) {
  return _createSubBoxAction(...args);
}

export async function deleteSubBoxAction(
  ...args: Parameters<typeof _deleteSubBoxAction>
) {
  return _deleteSubBoxAction(...args);
}

export async function createOutlineSectionAction(
  ...args: Parameters<typeof _createOutlineSectionAction>
) {
  return _createOutlineSectionAction(...args);
}

export async function updateOutlineSectionAction(
  ...args: Parameters<typeof _updateOutlineSectionAction>
) {
  return _updateOutlineSectionAction(...args);
}

export async function deleteOutlineSectionAction(
  ...args: Parameters<typeof _deleteOutlineSectionAction>
) {
  return _deleteOutlineSectionAction(...args);
}

export async function linkAnnotationToOutlineAction(
  ...args: Parameters<typeof _linkAnnotationToOutlineAction>
) {
  return _linkAnnotationToOutlineAction(...args);
}

export async function unlinkAnnotationFromOutlineAction(
  ...args: Parameters<typeof _unlinkAnnotationFromOutlineAction>
) {
  return _unlinkAnnotationFromOutlineAction(...args);
}

export async function linkSourceToOutlineAction(
  ...args: Parameters<typeof _linkSourceToOutlineAction>
) {
  return _linkSourceToOutlineAction(...args);
}

export async function unlinkSourceFromOutlineAction(
  ...args: Parameters<typeof _unlinkSourceFromOutlineAction>
) {
  return _unlinkSourceFromOutlineAction(...args);
}
