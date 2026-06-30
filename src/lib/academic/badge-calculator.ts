import type { ThesisAxes, ThesisBadge } from "@/lib/types";

/**
 * Calculates the originality/risk badge for a comparative thesis based on a
 * Weighted Score Model across 4 core axes.
 *
 * Score Matrix:
 * - TAM_ORTÜŞME      = 3 Points
 * - KISMI_ORTÜŞME     = 2 Points
 * - ALAKASIZ          = 1 Point
 *
 * Weights (Katsayılar):
 * - Konu (problem_sinirlari)     = x3 (Core Academic Pillar)
 * - Bağlam (zaman_mekan_ozgullugu) = x3 (Core Academic Pillar)
 * - Teori (teorik_perspektif)    = x1 (Transferable Asset)
 * - Yöntem (metodolojik_kurgu)   = x1 (Transferable Asset)
 *
 * Total Score Range: 8 (Min) to 24 (Max)
 *
 * @param axes - The 4-abstract-axis decision data from Gemini Jury
 * @returns The calculated ThesisBadge string
 */
export function calculateBadge(axes: ThesisAxes): ThesisBadge {
  // 1. Her eksen seçimi için standart taban puan haritası
  const scoreMap: Record<string, number> = {
    TAM_ORTÜŞME: 3,
    KISMI_ORTÜŞME: 2,
    ALAKASIZ: 1,
  };

  const pScore = scoreMap[axes.problem_sinirlari.secim] ?? 1;
  const tScore = scoreMap[axes.teorik_perspektif.secim] ?? 1;
  const mScore = scoreMap[axes.metodolojik_kurgu.secim] ?? 1;
  // Şayet konu (problem_sinirlari) alakasız ise Bağlam (zaman_mekan_ozgullugu) her türlü alakasız kabul edilir.
  const isTopicAlakasiz = axes.problem_sinirlari.secim === "ALAKASIZ";
  const zScore = isTopicAlakasiz
    ? 1
    : (scoreMap[axes.zaman_mekan_ozgullugu.secim] ?? 1);

  // 2. Katsayılı (Ağırlıklı) Puan Hesaplama
  const totalWeightedScore =
    pScore * 3 + // Konu Ağırlığı (x3)
    zScore * 3 + // Bağlam Ağırlığı (x3)
    tScore * 1 + // Teori Ağırlığı (x1)
    mScore * 1; // Yöntem Ağırlığı (x1)

  // 3. Eşik Sınırlarına Göre Kategorizasyon (Thresholding)

  // 🔴 SEVİYE 1: MUTLAK RISK [21 - 24 Puan]
  // Konu ve Bağlam neredeyse tamamen çakışıyor, Teori/Yöntem büyük oranda örtüşüyor.
  if (totalWeightedScore >= 21) {
    return "İKİZ TEZ";
  }

  // 🟡 SEVİYE 2: GÜÇLÜ TEHDİT / ANA REHBER [15 - 20 Puan]
  // Madalyonun bir yüzünü (Kürt siyaseti veya Sol erozyon gibi) ve 90'lar bağlamını tamamen kapsayanlar.
  if (totalWeightedScore >= 15 && totalWeightedScore <= 20) {
    return "SAVUNMA RİSKİ";
  }

  // 🟢 SEVİYE 3: KAVRAMSAL / YÖNTEMSEL REHBER [11 - 14 Puan]
  // Konu ve bağlam uzak olsa bile aynı teorik gözlüğü (Gramsci/Foucault) veya nitel yöntemi kullananlar.
  if (totalWeightedScore >= 11 && totalWeightedScore <= 14) {
    // NOT: Kod tabanındaki tip uyumluluğunu bozmamak adına tip haritasındaki geçerli rozet ismini döndürüyoruz.
    // Eğer types.ts içindeki ThesisBadge tipini "AKADEMİK REHBER" olarak güncellersen burayı doğrudan değiştirebilirsin.
    // Mevcut şemada "TEORİ KAYNAĞI" bu katmana en yakın anlamı taşımaktadır.
    return "TEORİ KAYNAĞI";
  }

  // ❌ SEVİYE 4: ELEME FİLTRESİ / AKADEMİK GÜRÜLTÜ [8 - 10 Puan]
  // Din politikaları örneğinde olduğu gibi tamamen başka sulara yelken açmış tezler.
  return "ÖZGÜN";
}
