"use client";

import { useCallback, useState } from "react";
import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from "react";

export interface ConceptTagsController {
  concepts: string[];
  setConcepts: Dispatch<SetStateAction<string[]>>;
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  addConcept: (e?: FormEvent) => void;
  removeConcept: (tagToRemove: string) => void;
  handleInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  reset: (initial?: string[]) => void;
}

/**
 * Generic reusable controller for comma/Enter separated concept tag input:
 * trims the leading `#`, de-duplicates and manages add/remove/input state.
 */
export function useConceptTags(
  initialConcepts: string[] = [],
): ConceptTagsController {
  const [concepts, setConcepts] = useState<string[]>(initialConcepts);
  const [inputValue, setInputValue] = useState("");

  const addConcept = useCallback(
    (e?: FormEvent) => {
      if (e) e.preventDefault();
      const tag = inputValue.trim().replace(/^#/, "");
      if (!tag) return;
      setConcepts((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
      setInputValue("");
    },
    [inputValue],
  );

  const removeConcept = useCallback((tagToRemove: string) => {
    setConcepts((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addConcept();
      }
    },
    [addConcept],
  );

  const reset = useCallback((initial: string[] = []) => {
    setConcepts(initial);
    setInputValue("");
  }, []);

  return {
    concepts,
    setConcepts,
    inputValue,
    setInputValue,
    addConcept,
    removeConcept,
    handleInputKeyDown,
    reset,
  };
}
