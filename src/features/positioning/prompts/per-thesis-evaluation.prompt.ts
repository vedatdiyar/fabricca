import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";
import type { SiftedThesis } from "@/features/positioning/sifting";

/**
 * Builds the standardized PromptPayload for single-thesis evaluation.
 *
 * @param input - The validated positioning matrix input.
 * @param thesis - The candidate thesis to evaluate.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPerThesisEvaluationPromptPayload(
  input: PositioningMatrixInput,
  thesis: SiftedThesis,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik tez karşılaştırma, literatür taraması ve özgünlük analizi konusunda son derece titiz bir Ön Değerlendirme Kurulu Üyesisiniz.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisi ile veritabanından gelen TEK BİR tezi karşılaştırarak kesin ve tavizsiz bir ön eleme yapmak ve yapılandırılmış değerlendirme çıktısı üretmektir.",

    workflowSteps: `## Aşama 1 — Kesin ve Tavizsiz Alakalılık Değerlendirmesi (isRelevant)
- Kullanıcının araştırmasının AMPİRİK ODAĞI VE ARAŞTIRMA PROBLEMİ (spesifik konu, temel olgu/olaylar, aktörler veya tarihsel/kavramsal odak) ile bu tez arasında DOĞRUDAN ve ANLAMLI bir akademik bağ var mı?
- **AGRESİF ELEME KURALI (MUTLAK):** Kararsız kaldığın veya yalnızca genel kavramsal/metodolojik ortaklığı olan (örn. aynı kuramcı, aynı analiz yöntemi veya yüzeysel kelime benzerliği olan) tezleri KESİNLİKLE ELE (\`isRelevant: false\`).
- Eğer tez kullanıcının araştırma problemiyle doğrudan örtüşmüyorsa \`isRelevant: false\` ver ve diğer alanları boş bırak.
- Yalnızca ampirik araştırma sorunu gerçekten aynı akademik sahada kesişiyorsa \`isRelevant: true\` ver ve Aşama 2'ye geç.

## Aşama 2 — Birebir Örtüşme / Özgünlük Değerlendirmesi (isDirectOverlap)
- Kullanıcının tezi ile bu tez Konu/Sorunsal + Odak + Çerçeve açısından BİREBİR AYNI mı?
- Eğer BİREBİR örtüşme varsa \`isDirectOverlap: true\` döndür.
- Eğer çalışma özgün bir açı/katkı barındırıyorsa \`isDirectOverlap: false\` döndür ve Aşama 3'e geç.

## Aşama 3 — Katkı Açıları + Literatür Konumu (Yalnızca İlgili Tezler İçin)
- \`contributionAreas\`: Tez kullanıcının çalışmasına hangi spesifik boyuttan katkı/rehberlik sunuyor? En fazla 2-3 kısa etiket (Örn: ["Arşiv Karşılaştırması", "Kavramsal Ayrım"]).
- \`relevanceReason\`: Kullanıcının bu tezi çalışmasında nasıl kaynak/karşılaştırma unsuru yapacağına dair EN FAZLA 1-2 cümlelik net rehber not.
- \`literaturePosition\`: Tezin literatürdeki temel sorunsalı / derdi hakkında EN FAZLA 1 cümlelik özet.`,

    rulesAndConstraints: `1. **Agresif Eleme:** Yüzeysel veya teğet geçen tezleri asla ilgili işaretleme. Amaç ana jüriye yalnızca yüksek kaliteli, doğrudan ilgili tezleri ulaştırmaktır.
2. **Kısa ve Odaklı İfade:** relevanceReason ve literaturePosition açıklamalarını net, kısa ve gürültüsüz tut.
3. **Veri Sadakati:** Yalnızca verilen başlık ve özet metnine dayan; varsayımsal ekleme yapma.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının 3 bileşenli Tez Konumlandırma Matrisi ve değerlendirmen gereken TEK tez listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı: ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

=== DEĞERLENDİRİLECEK TEZ ===
Tez ID: ${thesis.id}
Başlık: ${thesis.title}
Yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
Üniversite/Bölüm: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
Tür: ${thesis.thesisType || "N/A"} | Dil: ${thesis.language || "N/A"}
Özet: ${thesis.abstract}

Lütfen yukarıdaki tezi titizlikle değerlendir ve JSON formatında çıktı üret.`,
  });
}

/**
 * Builds the standardized PromptPayload for multi-thesis batch evaluation.
 *
 * @param input - The validated positioning matrix input.
 * @param theses - Candidate theses in the batch.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildBatchPerThesisEvaluationPromptPayload(
  input: PositioningMatrixInput,
  theses: SiftedThesis[],
): PromptPayload {
  const formattedTheses = theses
    .map(
      (t) => `Tez ID: ${t.id}
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Tür: ${t.thesisType || "N/A"} | Dil: ${t.language || "N/A"}
Özet: ${t.abstract}`,
    )
    .join("\n\n---\n\n");

  return buildPromptPayload({
    roleAndExpertise:
      "Akademik tez karşılaştırma, literatür taraması ve özgünlük analizi konusunda son derece titiz bir Ön Değerlendirme Kurulu Üyesisiniz.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisi ile listedeki HER BİR TEZİ TEK TEK karşılaştırarak kesin ve tavizsiz bir ön eleme yapmak ve yapılandırılmış değerlendirme dizisi (`evaluations`) üretmektir.",

    workflowSteps: `## Aşama 1 — Kesin ve Tavizsiz Alakalılık Değerlendirmesi (isRelevant)
- Kullanıcının araştırmasının AMPİRİK ODAĞI VE ARAŞTIRMA PROBLEMİ ile bu tez arasında DOĞRUDAN ve ANLAMLI bir akademik bağ var mı?
- **AGRESİF ELEME KURALI (MUTLAK):** Kararsız kaldığın veya yalnızca genel kavramsal/metodolojik ortaklığı olan (örn. aynı kuramcı, aynı analiz yöntemi veya yüzeysel kelime benzerliği olan) tezleri KESİNLİKLE ELE (\`isRelevant: false\`).
- Eğer tez kullanıcının araştırma problemiyle doğrudan örtüşmüyorsa \`isRelevant: false\` ver.
- Yalnızca ampirik araştırma sorunu gerçekten aynı akademik sahada kesişiyorsa \`isRelevant: true\` ver ve Aşama 2'ye geç.

## Aşama 2 — Birebir Örtüşme / Özgünlük Değerlendirmesi (isDirectOverlap)
- Kullanıcının tezi ile bu tez Konu/Sorunsal + Odak + Çerçeve açısından BİREBİR AYNI mı?
- Eğer BİREBİR örtüşme varsa \`isDirectOverlap: true\` döndür.
- Eğer çalışma özgün bir açı/katkı barındırıyorsa \`isDirectOverlap: false\` döndür ve Aşama 3'e geç.

## Aşama 3 — Katkı Açıları + Literatür Konumu (Yalnızca İlgili Tezler İçin)
- \`contributionAreas\`: En fazla 2-3 kısa etiket.
- \`relevanceReason\`: EN FAZLA 1-2 cümlelik net rehber not.
- \`literaturePosition\`: EN FAZLA 1 cümlelik özet.`,

    rulesAndConstraints: `1. **Agresif Eleme:** Yüzeysel veya teğet geçen tezleri asla ilgili işaretleme. Amaç ana jüriye yalnızca yüksek kaliteli, doğrudan ilgili tezleri ulaştırmaktır.
2. **Kısa ve Odaklı İfade:** Açıklamaları net, kısa ve gürültüsüz tut.
3. **Bağlam İzolasyonu:** Her tezi sadece kullanıcının tez matrisi ile karşılaştır.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan (`evaluations` dizisi içeren) saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının 3 bileşenli Tez Konumlandırma Matrisi ve değerlendirmen gereken tezler listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı: ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

=== DEĞERLENDİRİLECEK TEZLER ===
${formattedTheses}

Lütfen listedeki her bir tezi 3 aşamalı karar zincirine göre tek tek değerlendir ve JSON \`evaluations\` dizisi olarak çıktı üret.`,
  });
}
