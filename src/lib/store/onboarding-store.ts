import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  OriginalityReportData,
} from "@/lib/types";

interface PersistedOnboardingState {
  boxes: GeminiThesisBox[] | null;
  literaturePool: LiteraturePoolEntry[];
  reportData: OriginalityReportData | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading State Types (transient — not persisted)
// ─────────────────────────────────────────────────────────────────────────────
export interface LoadingStep {
  text: string;
  status: "idle" | "active" | "completed";
}

interface LoadingActions {
  showLoading: (
    title: string,
    description: string,
    steps: LoadingStep[],
  ) => void;
  updateLoadingStep: (
    index: number,
    status: "idle" | "active" | "completed",
  ) => void;
  hideLoading: () => void;
}

interface LoadingState {
  isLoading: boolean;
  loadingTitle: string;
  loadingDescription: string;
  loadingSteps: LoadingStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Onboarding State
// ─────────────────────────────────────────────────────────────────────────────
interface OnboardingState extends LoadingState {
  boxes: GeminiThesisBox[] | null;
  setBoxes: (boxes: GeminiThesisBox[] | null) => void;
  reportData: OriginalityReportData | null;
  setReportData: (data: OriginalityReportData | null) => void;
  clearReportData: () => void;
  literaturePool: LiteraturePoolEntry[];
  setLiteraturePool: (pool: LiteraturePoolEntry[]) => void;
  addToLiteraturePool: (entry: LiteraturePoolEntry) => void;
  resetStore: () => void;
}

type OnboardingStore = OnboardingState & LoadingActions;

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // ── Loading state defaults ──
      isLoading: false,
      loadingTitle: "",
      loadingDescription: "",
      loadingSteps: [],
      showLoading: (title, description, steps) =>
        set({
          isLoading: true,
          loadingTitle: title,
          loadingDescription: description,
          loadingSteps: steps,
        }),
      updateLoadingStep: (index, status) =>
        set((state) => {
          const updated = [...state.loadingSteps];
          if (updated[index]) {
            updated[index] = { ...updated[index], status };
          }
          return { loadingSteps: updated };
        }),
      hideLoading: () =>
        set({
          isLoading: false,
          loadingTitle: "",
          loadingDescription: "",
          loadingSteps: [],
        }),

      // ── Persisted state ──
      boxes: null,
      setBoxes: (boxes) => set({ boxes }),
      reportData: null,
      setReportData: (reportData) => set({ reportData }),
      clearReportData: () => set({ reportData: null }),
      literaturePool: [],
      setLiteraturePool: (literaturePool) => set({ literaturePool }),
      addToLiteraturePool: (entry) => {
        const current = get().literaturePool ?? [];
        const exists = current.some((e) => e.subBoxTitle === entry.subBoxTitle);
        if (exists) return;
        set({ literaturePool: [...current, entry] });
      },
      resetStore: () =>
        set({
          boxes: null,
          literaturePool: [],
          reportData: null,
        }),
    }),
    {
      name: "onboarding-storage",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        boxes: state.boxes,
        literaturePool: state.literaturePool,
        reportData: state.reportData,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedOnboardingState>;
        return {
          ...current,
          ...p,
          boxes: p.boxes ?? current.boxes,
          literaturePool: p.literaturePool ?? [],
          reportData: p.reportData ?? current.reportData,
        };
      },
    },
  ),
);
