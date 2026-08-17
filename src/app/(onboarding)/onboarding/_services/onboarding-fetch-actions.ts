"use server";

import {
  getCachedThesisMatrix as _getCachedThesisMatrix,
  fetchThesisMatrix as _fetchThesisMatrix,
  fetchThesisMatrixFresh as _fetchThesisMatrixFresh,
  getCachedBoxes as _getCachedBoxes,
  fetchBoxesWithFullShape as _fetchBoxesWithFullShape,
  fetchUncachedBoxesWithFullShape as _fetchUncachedBoxesWithFullShape,
  checkStepsDataAction as _checkStepsDataAction,
} from "./fetch-actions";

export async function getCachedThesisMatrix(userId: number) {
  return _getCachedThesisMatrix(userId);
}

export async function fetchThesisMatrix() {
  return _fetchThesisMatrix();
}

export async function fetchThesisMatrixFresh() {
  return _fetchThesisMatrixFresh();
}

export async function getCachedBoxes(thesisMatrixId: number) {
  return _getCachedBoxes(thesisMatrixId);
}

export async function fetchBoxesWithFullShape() {
  return _fetchBoxesWithFullShape();
}

export async function fetchUncachedBoxesWithFullShape() {
  return _fetchUncachedBoxesWithFullShape();
}

export async function checkStepsDataAction() {
  return _checkStepsDataAction();
}
