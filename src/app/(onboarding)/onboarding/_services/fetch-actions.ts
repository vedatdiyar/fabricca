"use server";

import {
  getCachedThesisMatrix as _getCachedThesisMatrix,
  fetchThesisMatrix as _fetchThesisMatrix,
  fetchThesisMatrixFresh as _fetchThesisMatrixFresh,
} from "./matrix-fetch";

import {
  getCachedBoxes as _getCachedBoxes,
  fetchBoxesWithFullShape as _fetchBoxesWithFullShape,
  fetchUncachedBoxesWithFullShape as _fetchUncachedBoxesWithFullShape,
} from "./box-fetch";

import { checkStepsDataAction as _checkStepsDataAction } from "./step-check";
import { handleActionError } from "@/lib/errors/handle-error";

export async function getCachedThesisMatrix(userId: number) {
  try {
    return await _getCachedThesisMatrix(userId);
  } catch (err) {
    return handleActionError(err) as never;
  }
}

export async function fetchThesisMatrix() {
  try {
    return await _fetchThesisMatrix();
  } catch (err) {
    return handleActionError(err) as never;
  }
}

export async function fetchThesisMatrixFresh() {
  try {
    return await _fetchThesisMatrixFresh();
  } catch (err) {
    return handleActionError(err) as never;
  }
}

export async function getCachedBoxes(thesisMatrixId: number) {
  try {
    return await _getCachedBoxes(thesisMatrixId);
  } catch (err) {
    return handleActionError(err) as never;
  }
}

export async function fetchBoxesWithFullShape() {
  try {
    return await _fetchBoxesWithFullShape();
  } catch (err) {
    return handleActionError(err) as never;
  }
}

export async function fetchUncachedBoxesWithFullShape() {
  try {
    return await _fetchUncachedBoxesWithFullShape();
  } catch (err) {
    return handleActionError(err) as never;
  }
}

export async function checkStepsDataAction() {
  try {
    return await _checkStepsDataAction();
  } catch (err) {
    return handleActionError(err) as never;
  }
}
