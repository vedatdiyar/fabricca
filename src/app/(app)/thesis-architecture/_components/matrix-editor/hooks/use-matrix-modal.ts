"use client";

import { useState } from "react";
import type { MatrixKey } from "../constants/matrix-cards";
import type { MatrixValues } from "./use-matrix-values";

interface UseMatrixModalOptions {
  values: MatrixValues;
  saveValues: (next: MatrixValues) => Promise<boolean>;
}

interface UseMatrixModalResult {
  focusCardKey: MatrixKey | null;
  focusEditValue: string;
  isOpen: boolean;
  openModal: (key: MatrixKey) => void;
  closeModal: () => void;
  setEditValue: (value: string) => void;
  save: () => Promise<void>;
}

/**
 * Drives the column edit modal: open/close state, the temporary textarea value
 * and the save flow that persists through the values hook.
 *
 * @param root0 - Hook options.
 * @param root0.values - The committed matrix values used to seed the editor.
 * @param root0.saveValues - The persistence handler from the values hook.
 * @returns The modal state and its open/close/edit/save handlers.
 */
export function useMatrixModal({
  values,
  saveValues,
}: UseMatrixModalOptions): UseMatrixModalResult {
  const [focusCardKey, setFocusCardKey] = useState<MatrixKey | null>(null);
  const [focusEditValue, setFocusEditValue] = useState<string>("");

  const openModal = (key: MatrixKey) => {
    setFocusCardKey(key);
    setFocusEditValue(values[key] ?? "");
  };

  const closeModal = () => {
    setFocusCardKey(null);
    setFocusEditValue("");
  };

  const save = async () => {
    if (!focusCardKey) return;
    const success = await saveValues({
      ...values,
      [focusCardKey]: focusEditValue,
    });
    if (success) closeModal();
  };

  return {
    focusCardKey,
    focusEditValue,
    isOpen: Boolean(focusCardKey),
    openModal,
    closeModal,
    setEditValue: setFocusEditValue,
    save,
  };
}
