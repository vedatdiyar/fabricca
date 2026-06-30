import type { ThesisAxes, ThesisBadge } from "@/lib/types";

/**
 * Calculates the originality/risk badge for a comparative thesis based on its 4 axes.
 *
 * @param axes - The 4-axis decision data for the thesis
 * @returns The calculated ThesisBadge string
 */
export function calculateBadge(axes: ThesisAxes): ThesisBadge {
  const p = axes.problem_sinirlari.secim;
  const t = axes.teorik_perspektif.secim;
  const m = axes.metodolojik_kurgu.secim;
  const z = axes.zaman_mekan_ozgullugu.secim;

  // 🛡️ GİYOTİN FİLTRESİ: Konu ALAKASIZ ve Bağlam ALAKASIZ BAĞLAM ise doğrudan akademik gürültü kabul edilir.
  if (p === "ALAKASIZ" && z === "ALAKASIZ BAĞLAM") {
    return "ÖZGÜN";
  }

  // 🔴 1. SEVIYE: MUTLAK RISK (İKİZ TEZ)
  if (p === "BİREBİR" && t === "AYNI GÖZLÜK" && z === "AYNI DOKU") {
    return "İKİZ TEZ";
  }

  // 🟡 2. SEVIYE: SARTLI RISK (SAVUNMA RİSKİ)
  if (p === "BİREBİR" || p === "GENİŞLETİLMİŞ KONU") {
    if (z === "AYNI DOKU" || z === "PARALEL BAĞLAM") {
      return "SAVUNMA RİSKİ";
    }
  }

  // 🟢 3. SEVIYE: DOGRUDAN FAYDA (REHBER / YAKIT ALANI)
  if (p === "ALAKASIZ") {
    if (t === "AYNI GÖZLÜK" || t === "EVRİLMİŞ TEORİ") {
      return "TEORİ KAYNAĞI";
    }
    if (t === "FARKLI GÖZLÜK" && m === "BİREBİR YÖNTEM") {
      return "YÖNTEM KAYNAĞI";
    }
    if (z === "AYNI DOKU") {
      return "BAĞLAM KAYNAĞI";
    }
  }

  // ❌ ELEME FILTRESI (GÖRÜNTÜLENMEYECEK)
  return "ÖZGÜN";
}
