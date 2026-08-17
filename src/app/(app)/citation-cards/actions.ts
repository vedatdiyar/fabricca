"use server";

import { getCitationCardsDataAction as _getCitationCardsDataAction } from "./query-actions";
import {
  createCitationCardAction as _createCitationCardAction,
  updateCitationCardAction as _updateCitationCardAction,
  deleteCitationCardAction as _deleteCitationCardAction,
  moveCitationCardBoxAction as _moveCitationCardBoxAction,
} from "./mutation-actions";

export async function getCitationCardsDataAction(
  ...args: Parameters<typeof _getCitationCardsDataAction>
) {
  return _getCitationCardsDataAction(...args);
}

export async function createCitationCardAction(
  ...args: Parameters<typeof _createCitationCardAction>
) {
  return _createCitationCardAction(...args);
}

export async function updateCitationCardAction(
  ...args: Parameters<typeof _updateCitationCardAction>
) {
  return _updateCitationCardAction(...args);
}

export async function deleteCitationCardAction(
  ...args: Parameters<typeof _deleteCitationCardAction>
) {
  return _deleteCitationCardAction(...args);
}

export async function moveCitationCardBoxAction(
  ...args: Parameters<typeof _moveCitationCardBoxAction>
) {
  return _moveCitationCardBoxAction(...args);
}
