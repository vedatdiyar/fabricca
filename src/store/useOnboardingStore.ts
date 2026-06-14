import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  OnboardingStep,
  StepStatus,
  OnboardingFormData,
  EnhancedThesisData,
  ScrapedTheses,
  JuryReportItem,
  OriginalityReportData,
  GeminiThesisBox,
} from "@/lib/types";

/**
 * Onboarding Zustand Store'unun durum (state) alanlarını temsil eden arayüz.
 */
interface OnboardingStoreState {
  /**
   * Kullanıcının aktif olduğu onboarding adımını tutar.
   */
  currentStep: OnboardingStep;
  /**
   * 1. Adım: Tez Matrisi Form verileri.
   */
  formData: OnboardingFormData | null;
  /**
   * 2. Adım: Gemini tarafından zenginleştirilmiş tez matrisi verileri.
   */
  enrichedData: EnhancedThesisData | null;
  /**
   * 3. Adım: YÖKTEZ ve sifting ajanından gelen seçilen/elenen tezler.
   */
  scrapedTheses: ScrapedTheses | null;
  /**
   * 4. Adım: Gemini tarafından üretilen jüri analizi raporu.
   */
  juryReport: OriginalityReportData | null;
  /**
   * 5. Adım: Yapay zekanın ürettiği ve onay bekleyen konu kutuları (boxes).
   */
  boxes: GeminiThesisBox[] | null;
  /**
   * Jüri analizinde üretilen ve onaylanan anahtar kelimeler.
   */
  approvedKeywords: string[] | null;
  /**
   * Her adımın yükleme ve işlem durumunu yöneten nesne.
   */
  status: {
    matrix: StepStatus;
    enrichment: StepStatus;
    risk: StepStatus;
    boxes: StepStatus;
    "literature-review": StepStatus;
  };
}

/**
 * Onboarding Zustand Store'unun aksiyonlarını (actions) temsil eden arayüz.
 */
interface OnboardingStoreActions {
  /**
   * Aktif onboarding adımını değiştirir.
   * @param targetStep - Geçiş yapılmak istenen hedef adım.
   */
  setStep: (targetStep: OnboardingStep) => void;
  /**
   * İlk adımdaki form verilerini günceller.
   * Veri değiştiğinde "Sıfırlama Kalkanı" devreye girerek sonraki adımların verilerini sıfırlar.
   * @param data - Yeni form verileri.
   */
  updateFormData: (data: OnboardingFormData) => void;
  /**
   * İkinci adımdaki zenginleştirilmiş verileri günceller.
   * Veri değiştiğinde "Sıfırlama Kalkanı" devreye girerek sonraki adımların verilerini sıfırlar.
   * @param data - Yeni zenginleştirilmiş veriler.
   */
  updateEnrichedData: (data: EnhancedThesisData) => void;
  /**
   * Üçüncü adımdaki YÖKTEZ ve sifting sonuçlarını günceller.
   * @param theses - Yeni taranan/elenen tez listesi.
   */
  setScrapedTheses: (theses: ScrapedTheses | null) => void;
  /**
   * Dördüncü adımdaki jüri raporunu günceller.
   * @param report - Yeni jüri analiz tablosu verisi.
   */
  setJuryReport: (report: OriginalityReportData | null) => void;
  /**
   * Beşinci adımdaki konu kutularını günceller.
   * @param boxes - Yeni konu kutuları listesi.
   */
  setBoxes: (boxes: GeminiThesisBox[] | null) => void;
  /**
   * Jüri analizinde üretilen anahtar kelimeleri günceller.
   * @param keywords - Onaylanan anahtar kelimeler listesi.
   */
  setApprovedKeywords: (keywords: string[] | null) => void;
  /**
   * Belirtilen adımın durumunu günceller.
   * @param step - Durumu güncellenecek adım adı.
   * @param status - Yeni yükleme durumu.
   */
  setStatus: (
    step: keyof OnboardingStoreState["status"],
    status: StepStatus,
  ) => void;
  /**
   * Onboarding store verilerini başlangıç durumuna döndürür ve tarayıcı oturumunu temizler.
   */
  resetStore: () => void;
}

/**
 * Onboarding Zustand Store tipi.
 */
type OnboardingStore = OnboardingStoreState & OnboardingStoreActions;

const initialStatus: OnboardingStoreState["status"] = {
  matrix: "idle",
  enrichment: "idle",
  risk: "idle",
  boxes: "idle",
  "literature-review": "idle",
};

/**
 * Onboarding akışının durum (state) yönetimini tarayıcı oturumunda kilitleyen global Zustand store.
 * Verileri sessionStorage katmanında saklar ve adımlar arası veri tutarlılığı için Sıfırlama Kalkanı barındırır.
 */
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // State
      currentStep: "matrix",
      formData: null,
      enrichedData: null,
      scrapedTheses: null,
      juryReport: null,
      boxes: null,
      approvedKeywords: null,
      status: initialStatus,

      // Actions
      setStep: (targetStep) => {
        set({ currentStep: targetStep });
      },

      updateFormData: (data) => {
        const currentFormData = get().formData;
        const isDifferent =
          !currentFormData ||
          currentFormData.studyTitle !== data.studyTitle ||
          currentFormData.researchQuestion !== data.researchQuestion ||
          currentFormData.mainClaim !== data.mainClaim ||
          currentFormData.methodology !== data.methodology ||
          currentFormData.theoreticalFramework !== data.theoreticalFramework ||
          currentFormData.historicalSpatialLimits !==
            data.historicalSpatialLimits;

        if (isDifferent) {
          // Sıfırlama Kalkanı: Form verisi değiştiğinde sonraki tüm adımları geçersiz kıl ve sıfırla.
          set({
            formData: data,
            enrichedData: null,
            scrapedTheses: null,
            juryReport: null,
            boxes: null,
            status: {
              matrix: "success",
              enrichment: "idle",
              risk: "idle",
              boxes: "idle",
              "literature-review": "idle",
            },
          });
        } else {
          set({
            formData: data,
            status: {
              ...get().status,
              matrix: "success",
            },
          });
        }
      },

      updateEnrichedData: (data) => {
        const currentEnriched = get().enrichedData;
        const isDifferent =
          !currentEnriched ||
          currentEnriched.academicStudyTitle !== data.academicStudyTitle ||
          currentEnriched.literatureResearchQuestion !==
            data.literatureResearchQuestion ||
          currentEnriched.refinedThesisClaim !== data.refinedThesisClaim ||
          currentEnriched.conceptualTheoreticalInfrastructure !==
            data.conceptualTheoreticalInfrastructure ||
          currentEnriched.academicMethodologyDesign !==
            data.academicMethodologyDesign ||
          currentEnriched.historicalSpatialLimits !==
            data.historicalSpatialLimits;

        if (isDifferent) {
          // Sıfırlama Kalkanı: Zenginleştirilmiş veri değiştiğinde sonraki tüm adımları geçersiz kıl ve sıfırla.
          set({
            enrichedData: data,
            scrapedTheses: null,
            juryReport: null,
            boxes: null,
            status: {
              ...get().status,
              enrichment: "success",
              risk: "idle",
              boxes: "idle",
              "literature-review": "idle",
            },
          });
        } else {
          set({
            enrichedData: data,
            status: {
              ...get().status,
              enrichment: "success",
            },
          });
        }
      },

      setScrapedTheses: (theses) => {
        set({ scrapedTheses: theses });
      },

      setJuryReport: (report) => {
        set({ juryReport: report });
      },

      setBoxes: (boxes) => {
        set({ boxes });
      },

      setApprovedKeywords: (keywords) => {
        set({ approvedKeywords: keywords });
      },

      setStatus: (step, status) => {
        set((state) => ({
          status: {
            ...state.status,
            [step]: status,
          },
        }));
      },

      resetStore: () => {
        set({
          currentStep: "matrix",
          formData: null,
          enrichedData: null,
          scrapedTheses: null,
          juryReport: null,
          boxes: null,
          approvedKeywords: null,
          status: initialStatus,
        });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("onboarding-storage");
        }
      },
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
