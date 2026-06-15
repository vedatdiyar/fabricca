import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";

interface OnboardingState {
  boxes: GeminiThesisBox[] | null;
  setBoxes: (boxes: GeminiThesisBox[] | null) => void;
  literaturePool: LiteraturePoolEntry[];
  setLiteraturePool: (pool: LiteraturePoolEntry[]) => void;
  addToLiteraturePool: (entry: LiteraturePoolEntry) => void;
  resetStore: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      boxes: null,
      setBoxes: (boxes) => set({ boxes }),
      literaturePool: [],
      setLiteraturePool: (literaturePool) => set({ literaturePool }),
      addToLiteraturePool: (entry) => {
        const current = get().literaturePool ?? [];
        const exists = current.some(
          (e) => e.subBoxTitle === entry.subBoxTitle,
        );
        if (exists) return;
        set({ literaturePool: [...current, entry] });
      },
      resetStore: () => set({ boxes: null, literaturePool: [] }),
    }),
    {
      name: "onboarding-storage",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        boxes: (persisted as any)?.boxes ?? current.boxes,
        literaturePool: (persisted as any)?.literaturePool ?? [],
      }),
    },
  ),
);
