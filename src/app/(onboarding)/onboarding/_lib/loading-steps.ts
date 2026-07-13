export interface LoadingStep {
  text: string;
  status: "idle" | "active" | "completed";
}

export const STEP_MIN_DURATION_MS = 1200;

export function isNavigationStepText(text: string): boolean {
  return text.includes("yönlendiriliyor");
}

export const ANALYSIS_STEPS: LoadingStep[] = [
  { text: "Sorgu ve doğrulama parametreleri üretiliyor...", status: "idle" },
  {
    text: "Tezara arama motoru sorguları koşturuluyor...",
    status: "idle",
  },
  {
    text: "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
    status: "idle",
  },
  { text: "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...", status: "idle" },
];

export const PROCEED_STEPS: LoadingStep[] = [
  {
    text: "Çalışma matrisi analiz edilerek konu kutuları yapılandırılıyor...",
    status: "active",
  },
  { text: "Kutular sayfasına yönlendiriliyor...", status: "idle" },
];

export const LITERATURE_PIPELINE_STEPS: LoadingStep[] = [
  { text: "Mevcut literatür havuzu kontrol ediliyor...", status: "active" },
  { text: "Akademik kaynaklar taranıyor...", status: "idle" },
  { text: "Literatür havuzu onaylanıp kaydediliyor...", status: "idle" },
];
