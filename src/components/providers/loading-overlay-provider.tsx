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
  onCancel: (() => void) | null;
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

export function LoadingOverlayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("");
  const [loadingDescription, setLoadingDescription] = useState("");
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([]);
  const [onCancel, setOnCancel] = useState<(() => void) | null>(null);
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
      onCancelRef.current = cancelCallback ?? null;
      setOnCancel(() => cancelCallback ?? null);
    },
    [],
  );

  const updateLoadingStep = useCallback(
    (index: number, status: "idle" | "active" | "completed") => {
      setLoadingSteps((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], status };
        }
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
    onCancelRef.current = null;
    setOnCancel(null);
  }, []);

  const cancelLoading = useCallback(() => {
    onCancelRef.current?.();
    setIsLoading(false);
    setLoadingTitle("");
    setLoadingDescription("");
    setLoadingSteps([]);
    onCancelRef.current = null;
    setOnCancel(null);
  }, []);

  return (
    <LoadingOverlayContext.Provider
      value={{
        isLoading,
        loadingTitle,
        loadingDescription,
        loadingSteps,
        onCancel,
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
