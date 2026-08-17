"use server";

import {
  setLiteratureCancelledAction as _setLiteratureCancelledAction,
  resetLiteratureCancelledAction as _resetLiteratureCancelledAction,
  isLiteratureCancelledAction as _isLiteratureCancelledAction,
} from "./cancel-actions";
import {
  processAllBoxesAction as _processAllBoxesAction,
  runLiteraturePipelineAction as _runLiteraturePipelineAction,
} from "./pipeline-actions";
import {
  confirmLiteratureAction as _confirmLiteratureAction,
  fetchPreloadedLiteraturePool as _fetchPreloadedLiteraturePool,
  checkLiteraturePoolAction as _checkLiteraturePoolAction,
} from "./pool-actions";
import { finalizeOnboardingAction as _finalizeOnboardingAction } from "./finalize-actions";

export async function setLiteratureCancelledAction(
  ...args: Parameters<typeof _setLiteratureCancelledAction>
) {
  return _setLiteratureCancelledAction(...args);
}

export async function resetLiteratureCancelledAction(
  ...args: Parameters<typeof _resetLiteratureCancelledAction>
) {
  return _resetLiteratureCancelledAction(...args);
}

export async function isLiteratureCancelledAction(
  ...args: Parameters<typeof _isLiteratureCancelledAction>
) {
  return _isLiteratureCancelledAction(...args);
}

export async function processAllBoxesAction(
  ...args: Parameters<typeof _processAllBoxesAction>
) {
  return _processAllBoxesAction(...args);
}

export async function runLiteraturePipelineAction(
  ...args: Parameters<typeof _runLiteraturePipelineAction>
) {
  return _runLiteraturePipelineAction(...args);
}

export async function confirmLiteratureAction(
  ...args: Parameters<typeof _confirmLiteratureAction>
) {
  return _confirmLiteratureAction(...args);
}

export async function fetchPreloadedLiteraturePool(
  ...args: Parameters<typeof _fetchPreloadedLiteraturePool>
) {
  return _fetchPreloadedLiteraturePool(...args);
}

export async function checkLiteraturePoolAction(
  ...args: Parameters<typeof _checkLiteraturePoolAction>
) {
  return _checkLiteraturePoolAction(...args);
}

export async function finalizeOnboardingAction(
  ...args: Parameters<typeof _finalizeOnboardingAction>
) {
  return _finalizeOnboardingAction(...args);
}
