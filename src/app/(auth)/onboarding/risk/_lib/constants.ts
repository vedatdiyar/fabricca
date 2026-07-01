import type { ThesisBadge } from "@/lib/types";

/** Turkish display labels for originality badge values. */
export const THESIS_BADGE_LABELS: Record<ThesisBadge, string> = {
  "İKİZ TEZ": "İkiz Tez",
  "SAVUNMA RİSKİ": "Savunma Riski",
  "TEORİ KAYNAĞI": "Teori Kaynağı",
  "YÖNTEM KAYNAĞI": "Yöntem Kaynağı",
  "BAĞLAM KAYNAĞI": "Bağlam Kaynağı",
  ÖZGÜN: "Özgün",
};

/** Soft icon container background colors keyed by badge value. */
export const THESIS_BADGE_ICON_BG: Record<ThesisBadge, string> = {
  "İKİZ TEZ": "bg-destructive/10",
  "SAVUNMA RİSKİ": "bg-warning/10",
  "TEORİ KAYNAĞI": "bg-primary/10",
  "YÖNTEM KAYNAĞI": "bg-success/10",
  "BAĞLAM KAYNAĞI": "bg-success/10",
  ÖZGÜN: "bg-success/10",
};

/** Text-only color classes for the shield icon. */
export const THESIS_BADGE_TEXT: Record<ThesisBadge, string> = {
  "İKİZ TEZ": "text-destructive",
  "SAVUNMA RİSKİ": "text-warning",
  "TEORİ KAYNAĞI": "text-primary",
  "YÖNTEM KAYNAĞI": "text-success",
  "BAĞLAM KAYNAĞI": "text-success",
  ÖZGÜN: "text-success",
};

/** Badge color dictionary keyed by badge value. */
export const THESIS_BADGE_COLORS: Record<ThesisBadge, string> = {
  "İKİZ TEZ": "bg-destructive/20 border-destructive/20 text-destructive",
  "SAVUNMA RİSKİ": "bg-warning/20 border-warning/20 text-warning",
  "TEORİ KAYNAĞI": "bg-primary/20 border-primary/20 text-primary",
  "YÖNTEM KAYNAĞI": "bg-success/20 border-success/20 text-success",
  "BAĞLAM KAYNAĞI": "bg-success/20 border-success/20 text-success",
  ÖZGÜN: "bg-success/20 border-success/20 text-success",
};

/** Returns the badge color class for a given thesis badge key. */
export const getBadgeColor = (key: ThesisBadge): string =>
  THESIS_BADGE_COLORS[key] ?? THESIS_BADGE_COLORS["ÖZGÜN"];

/** Turkish display labels for per-axis selections. */
export const AXIS_SECIM_LABELS: Record<string, string> = {
  // Standart Eşleşmeler
  TAM_ORTÜŞME: "Tam",
  KISMI_ORTÜŞME: "Kısmi",
  ALAKASIZ: "Alakasız",

  // Özdeş
  BİREBİR: "Özdeş",
  "AYNI GÖZLÜK": "Özdeş",
  "BİREBİR YÖNTEM": "Özdeş",
  "AYNI DOKU": "Özdeş",

  // Benzer
  "GENİŞLETİLMİŞ KONU": "Benzer",
  "EVRİLMİŞ TEORİ": "Benzer",
  "YÖNTEMSEL AKRABA": "Benzer",
  "PARALEL BAĞLAM": "Benzer",

  // Alakasız
  "FARKLI GÖZLÜK": "Alakasız",
  "FARKLI YÖNTEM": "Alakasız",
  "ALAKASIZ BAĞLAM": "Alakasız",
};

/** Badge color classes for per-axis selections. */
export const AXIS_SECIM_COLORS: Record<string, string> = {
  // Standart Eşleşmeler
  TAM_ORTÜŞME: "bg-destructive/20 border-destructive/20 text-destructive",
  KISMI_ORTÜŞME: "bg-warning/20 border-warning/20 text-warning",
  ALAKASIZ: "bg-success/20 border-success/20 text-success",

  // Özdeş
  BİREBİR: "bg-destructive/20 border-destructive/20 text-destructive",
  "AYNI GÖZLÜK": "bg-destructive/20 border-destructive/20 text-destructive",
  "BİREBİR YÖNTEM": "bg-destructive/20 border-destructive/20 text-destructive",
  "AYNI DOKU": "bg-destructive/20 border-destructive/20 text-destructive",

  // Benzer
  "GENİŞLETİLMİŞ KONU": "bg-warning/20 border-warning/20 text-warning",
  "EVRİLMİŞ TEORİ": "bg-warning/20 border-warning/20 text-warning",
  "YÖNTEMSEL AKRABA": "bg-warning/20 border-warning/20 text-warning",
  "PARALEL BAĞLAM": "bg-warning/20 border-warning/20 text-warning",

  // Alakasız
  "FARKLI GÖZLÜK": "bg-success/20 border-success/20 text-success",
  "FARKLI YÖNTEM": "bg-success/20 border-success/20 text-success",
  "ALAKASIZ BAĞLAM": "bg-success/20 border-success/20 text-success",
};

/** Returns the color class for a given axis selection string. */
export function getAxisSecimColor(secim: string): string {
  return (
    AXIS_SECIM_COLORS[secim] ?? "bg-success/20 border-success/20 text-success"
  );
}

/** Returns the solid gauge bar fill color based on the selection string. */
export function getAxisSecimBarFill(secim: string): string {
  if (
    secim === "TAM_ORTÜŞME" ||
    secim === "BİREBİR" ||
    secim === "AYNI GÖZLÜK" ||
    secim === "BİREBİR YÖNTEM" ||
    secim === "AYNI DOKU"
  ) {
    return "bg-destructive";
  }
  if (
    secim === "KISMI_ORTÜŞME" ||
    secim === "GENİŞLETİLMİŞ KONU" ||
    secim === "EVRİLMİŞ TEORİ" ||
    secim === "YÖNTEMSEL AKRABA" ||
    secim === "PARALEL BAĞLAM"
  ) {
    return "bg-warning";
  }
  return "bg-success";
}
