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
    text: "Tezler bulunuyor…",
    status: "idle",
  },
  { text: "Literatür inceleniyor…", status: "idle" },
  { text: "Rapor kaydediliyor...", status: "idle" },
];

export const BOX_GENERATION_STEPS: LoadingStep[] = [
  {
    text: "Altyapısal kutular ve tarama sorguları oluşturuluyor…",
    status: "active",
  },
  { text: "Kutular Kaydediliyor...", status: "idle" },
];

export const LITERATURE_PIPELINE_STEPS: LoadingStep[] = [
  { text: "Mevcut literatür havuzu kontrol ediliyor...", status: "active" },
  { text: "Akademik kaynaklar taranıyor...", status: "idle" },
  { text: "Literatür havuzu kaydediliyor...", status: "idle" },
];
