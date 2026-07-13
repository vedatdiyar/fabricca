"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from "react";

export interface LoadingStep {
  text: string;
  status: "idle" | "active" | "completed";
}

interface LoadingOverlayState {
  isLoading: boolean;
  loadingTitle: string;
  loadingDescription: string;
  loadingSteps: LoadingStep[];
  hasCancel: boolean;
  showLoading: (
    title: string,
    description: string,
    steps: LoadingStep[],
    onCancel?: () => void,
  ) => void;
  updateLoadingStep: (
    index: number,
    status: "idle" | "active" | "completed",
  ) => void;
  hideLoading: () => void;
  cancelLoading: () => void;
}

const LoadingOverlayContext = createContext<LoadingOverlayState | null>(null);

export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("");
  const [loadingDescription, setLoadingDescription] = useState("");
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([]);
  const [hasCancel, setHasCancel] = useState(false);
  const onCancelRef = useRef<(() => void) | null>(null);

  const showLoading = useCallback(
    (
      title: string,
      description: string,
      steps: LoadingStep[],
      cancelCallback?: () => void,
    ) => {
      setLoadingTitle(title);
      setLoadingDescription(description);
      setLoadingSteps(steps);
      setIsLoading(true);
      setHasCancel(!!cancelCallback);
      onCancelRef.current = cancelCallback ?? null;
    },
    [],
  );

  const updateLoadingStep = useCallback(
    (index: number, status: "idle" | "active" | "completed") => {
      setLoadingSteps((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const step = prev[index];
        if (step.status === "completed") return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], status };
        return updated;
      });
    },
    [],
  );

  const hideLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingTitle("");
    setLoadingDescription("");
    setLoadingSteps([]);
    setHasCancel(false);
    onCancelRef.current = null;
  }, []);

  const cancelLoading = useCallback(() => {
    onCancelRef.current?.();
    setIsLoading(false);
    setLoadingTitle("");
    setLoadingDescription("");
    setLoadingSteps([]);
    setHasCancel(false);
    onCancelRef.current = null;
  }, []);

  return (
    <LoadingOverlayContext.Provider
      value={{
        isLoading,
        loadingTitle,
        loadingDescription,
        loadingSteps,
        hasCancel,
        showLoading,
        updateLoadingStep,
        hideLoading,
        cancelLoading,
      }}
    >
      {children}
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay(): LoadingOverlayState {
  const ctx = useContext(LoadingOverlayContext);
  if (!ctx) {
    throw new Error(
      "useLoadingOverlay must be used within a LoadingOverlayProvider",
    );
  }
  return ctx;
}
