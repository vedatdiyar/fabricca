export interface LoadingStep {
  text: string;
  status: "idle" | "active" | "completed";
}

export const STEP_MIN_DURATION_MS = 1200;

export function isNavigationStepText(text: string): boolean {
  return text.includes("yönlendiriliyor");
}

export const LITERATURE_PIPELINE_STEPS: LoadingStep[] = [
  { text: "Mevcut literatür havuzu kontrol ediliyor...", status: "active" },
  { text: "Akademik kaynaklar taranıyor...", status: "idle" },
  { text: "Literatür havuzu onaylanıp kaydediliyor...", status: "idle" },
];
