import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  OriginalityReportData,
} from "@/lib/types";
import type { RawPaper } from "../../app/(auth)/onboarding/literature-review/_services/literature-review-papers";

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
  cachedPapers: Record<string, RawPaper[]>;
  setCachedPapers: (papers: Record<string, RawPaper[]>) => void;
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
        const existingIndex = current.findIndex(
          (e) => e.subBoxTitle === entry.subBoxTitle,
        );
        if (existingIndex >= 0) {
          const updated = [...current];
          updated[existingIndex] = {
            ...updated[existingIndex],
            starterPack: [
              ...updated[existingIndex].starterPack,
              ...entry.starterPack,
            ],
          };
          set({ literaturePool: updated });
        } else {
          set({ literaturePool: [...current, entry] });
        }
      },
      cachedPapers: {},
      setCachedPapers: (cachedPapers) => set({ cachedPapers }),
      resetStore: () =>
        set({
          boxes: null,
          literaturePool: [],
          reportData: null,
          cachedPapers: {},
        }),
    }),
    {
      name: "onboarding-storage",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        literaturePool: state.literaturePool,
        reportData: state.reportData,
        cachedPapers: state.cachedPapers,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<{
          literaturePool: LiteraturePoolEntry[];
          reportData: OriginalityReportData | null;
          cachedPapers: Record<string, RawPaper[]>;
        }>;
        return {
          ...current,
          ...p,
          boxes: current.boxes,
          literaturePool: p.literaturePool ?? [],
          reportData: p.reportData ?? current.reportData,
          cachedPapers: p.cachedPapers ?? {},
        };
      },
    },
  ),
);
