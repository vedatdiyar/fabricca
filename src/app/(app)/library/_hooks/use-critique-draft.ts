"use client";

import { useSyncExternalStore, useCallback } from "react";
import {
  type CritiqueDraftMap,
  type CritiqueFieldKey,
  CRITIQUE_FIELDS,
} from "../_components/resource-detail/critique-constants";

const CRITIQUE_STORAGE_PREFIX = "fabricca_library_critique_draft_";

const memoryCache = new Map<number, CritiqueDraftMap>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function getDraftSnapshot(
  resourceId: number,
  baseValues: CritiqueDraftMap,
): CritiqueDraftMap {
  if (typeof window === "undefined") {
    return baseValues;
  }

  if (memoryCache.has(resourceId)) {
    return memoryCache.get(resourceId)!;
  }

  try {
    const saved = localStorage.getItem(
      `${CRITIQUE_STORAGE_PREFIX}${resourceId}`,
    );
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<CritiqueDraftMap>;
      const draft: CritiqueDraftMap = {
        researchQuestion:
          parsed.researchQuestion ?? baseValues.researchQuestion,
        theoreticalFramework:
          parsed.theoreticalFramework ?? baseValues.theoreticalFramework,
        methodology: parsed.methodology ?? baseValues.methodology,
        mainArgument: parsed.mainArgument ?? baseValues.mainArgument,
        literatureGap: parsed.literatureGap ?? baseValues.literatureGap,
      };
      memoryCache.set(resourceId, draft);
      return draft;
    }
  } catch {
    // Ignore storage parse errors
  }

  memoryCache.set(resourceId, baseValues);
  return baseValues;
}

function persistCritiqueDraft(
  resourceId: number,
  draft: CritiqueDraftMap,
  baseValues: CritiqueDraftMap,
) {
  memoryCache.set(resourceId, draft);

  if (typeof window !== "undefined") {
    const storageKey = `${CRITIQUE_STORAGE_PREFIX}${resourceId}`;
    const isDifferent = Object.keys(draft).some(
      (k) =>
        draft[k as CritiqueFieldKey].trim() !==
        baseValues[k as CritiqueFieldKey].trim(),
    );

    try {
      if (isDifferent) {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage access fallback
    }
  }

  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Manages client-side auto-saving, restoring, and clearing of 5-dimensional critique drafts.
 *
 * @param resourceId - Target library resource ID.
 * @param baseValues - Saved critique values from the database.
 * @returns Draft values, change setter, reset handler, dirty check, and completion counter.
 */
export function useCritiqueDraft(
  resourceId: number,
  baseValues: CritiqueDraftMap,
) {
  const values = useSyncExternalStore(
    subscribe,
    () => getDraftSnapshot(resourceId, baseValues),
    () => baseValues,
  );

  const setFieldValue = useCallback(
    (field: CritiqueFieldKey, val: string): CritiqueDraftMap => {
      const nextValues = { ...values, [field]: val };
      persistCritiqueDraft(resourceId, nextValues, baseValues);
      return nextValues;
    },
    [resourceId, values, baseValues],
  );

  const handleResetDraft = useCallback(() => {
    persistCritiqueDraft(resourceId, baseValues, baseValues);
  }, [resourceId, baseValues]);

  const hasDraft = Object.keys(values).some(
    (k) =>
      values[k as CritiqueFieldKey].trim() !==
      baseValues[k as CritiqueFieldKey].trim(),
  );

  const completedCount = CRITIQUE_FIELDS.filter(
    (field) => values[field.key].trim().length > 0,
  ).length;

  return {
    values,
    setFieldValue,
    handleResetDraft,
    hasDraft,
    completedCount,
  };
}
