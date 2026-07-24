export interface LoadingStep {
  text: string;
  status: "idle" | "active" | "completed";
}

export const STEP_MIN_DURATION_MS = 1200;

export function isNavigationStepText(text: string): boolean {
  return text.includes("yönlendiriliyor");
}

export const MATRIX_SUBMIT_STEPS: LoadingStep[] = [
  { text: "Çalışma matrisi kaydediliyor...", status: "active" },
  {
    text: "Akademik arama sorguları üretiliyor ve tezler taranıyor...",
    status: "idle",
  },
  { text: "Akademik jüri analizi tamamlanıyor...", status: "idle" },
  { text: "Rapor kaydediliyor...", status: "idle" },
];

export const LITERATURE_PIPELINE_STEPS: LoadingStep[] = [
  { text: "Mevcut literatür havuzu kontrol ediliyor...", status: "active" },
  { text: "Akademik kaynaklar taranıyor...", status: "idle" },
  { text: "Literatür havuzu onaylanıp kaydediliyor...", status: "idle" },
];
