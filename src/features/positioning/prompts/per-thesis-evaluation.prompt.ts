import { buildPromptPayload, type PromptPayload } from "@/lib/ai/prompt-builder";
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
  thesis: SiftedThesis
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik tez karşılaştırma ve özgünlük analizi konusunda uzmanlaşmış bir Değerlendirme Kurulu Üyesisiniz.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisi ile YÖK / Tezara veritabanından gelen TEK BİR tezi titizlikle karşılaştırarak 3 aşamalı karar zincirini uygulayıp yapılandırılmış bir değerlendirme çıktısı üretmektir.",

    workflowSteps: `## Aşama 1 — Alakalılık Değerlendirmesi (isRelevant)
- Kullanıcının tezi ile bu tez arasında anlamlı bir akademik ilişki var mı? (Aynı problem, aktör, dönem, kavram, kuram veya yöntem alanına dokunuyor mu?)
- Eğer tez, kullanıcının tez matrisiyle kayda değer bir örtüşme göstermiyorsa \`isRelevant: false\` döndürün ve diğer alanları boş bırakın.
- Eğer alakalıysa \`isRelevant: true\` döndürün ve Aşama 2'ye geçin.

## Aşama 2 — Birebir Örtüşme / Özgünlük Değerlendirmesi (isDirectOverlap)
- Kullanıcının tezi ile bu tez Araştırma Konusu/Soruları + Kuramsal/Metodolojik Çerçeve + Aktörler açısından BİREBİR AYNI mı?
- Eğer BİREBİR örtüşme varsa \`isDirectOverlap: true\` döndürün.
- Eğer benzerlik var ama birebir örtüşme yoksa \`isDirectOverlap: false\` döndürün ve Aşama 3'e geçin.

## Aşama 3 — Katkı ve Benzerlik Açıları + Literatür Konumu
- \`contributionAreas\`: Tez, kullanıcının tezine TAM OLARAK hangi açılardan benziyor / katkı sağlıyor? En fazla 2-3 nokta atışı etiket.
- \`relevanceReason\`: EN FAZLA 1-2 cümlelik rehber not.
- \`literaturePosition\`: EN FAZLA 1 cümlelik özet literatür notu.`,

    rulesAndConstraints: `- Yalnızca Tez Matrisinde ve ilgili tez metninde açıkça belirtilen somut ampirik verilere, yöntemlere ve kavramsal kurgulara temellenin.
- Tez hakkında yalnızca sana verilen başlık ve özet bilgilerini kullanın.
- İlgisiz tezlerde \`contributionAreas\` ve \`relevanceReason\` alanlarını boş tutun.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının 3 bileşenli Tez Konumlandırma Matrisi ve değerlendirmen gereken TEK tez listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı (aktörler dahil): ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

=== DEĞERLENDİRİLECEK TEZ ===
Tez ID: ${thesis.id}
Başlık: ${thesis.title}
Yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
Üniversite/Bölüm: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
Tür: ${thesis.thesisType || "N/A"} | Dil: ${thesis.language || "N/A"}
Özet: ${thesis.abstract}

Lütfen yukarıdaki tek tezi 3 aşamalı karar zincirine göre değerlendir ve özet odaklı JSON formatında çıktı üret.`,
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
  theses: SiftedThesis[]
): PromptPayload {
  const formattedTheses = theses
    .map(
      (t) => `Tez ID: ${t.id}
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Tür: ${t.thesisType || "N/A"} | Dil: ${t.language || "N/A"}
Özet: ${t.abstract}`
    )
    .join("\n\n---\n\n");

  return buildPromptPayload({
    roleAndExpertise:
      "Akademik tez karşılaştırma ve özgünlük analizi konusunda uzmanlaşmış bir Değerlendirme Kurulu Üyesisiniz.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisi ile YÖK / Tezara veritabanından gelen TEZ LİSTESİNDEKİ HER BİR TEZİ SADECE KULLANICININ TEZ MATRİSİ İLE TEK TEK KARŞILAŞTIRARAK 3 aşamalı karar zincirini uygulayıp yapılandırılmış bir değerlendirme dizisi (`evaluations`) üretmektir.",

    workflowSteps: `## Aşama 1 — Alakalılık Değerlendirmesi (isRelevant)
- Kullanıcının tezi ile bu tez arasında anlamlı bir akademik ilişki var mı?
- Eğer örtüşme yoksa \`isRelevant: false\` döndürün.
- Eğer alakalıysa \`isRelevant: true\` döndürün ve Aşama 2'ye geçin.

## Aşama 2 — Birebir Örtüşme / Özgünlük Değerlendirmesi (isDirectOverlap)
- Kullanıcının tezi ile bu tez BİREBİR AYNI mı?
- Eğer BİREBİR örtüşme varsa \`isDirectOverlap: true\` döndürün.
- Eğer özgünse \`isDirectOverlap: false\` döndürün ve Aşama 3'e geçin.

## Aşama 3 — Katkı ve Benzerlik Açıları + Literatür Konumu
- \`contributionAreas\`: En fazla 2-3 etiket.
- \`relevanceReason\`: EN FAZLA 1-2 cümlelik rehber not.
- \`literaturePosition\`: EN FAZLA 1 cümlelik özet literatür notu.`,

    rulesAndConstraints: `1. **Bağlam İzolasyon İlkesi:** Her tezi bağımsız bir çalışma olarak ele alıp SADECE kullanıcının Tez Matrisi parametreleri ile doğrudan karşılaştırın.
2. **Veri Sadakati:** Yalnızca Tez Matrisinde ve ilgili tez metninde açıkça belirtilen somut ampirik verilere temellenin.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan (`evaluations` dizisi içeren) saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının 3 bileşenli Tez Konumlandırma Matrisi ve değerlendirmen gereken tezler listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı (aktörler dahil): ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

=== DEĞERLENDİRİLECEK TEZLER ===
${formattedTheses}

Lütfen listedeki her bir tezi SADECE kullanıcının Tez Matrisi ile 3 aşamalı karar zincirine göre tek tek değerlendir ve özet odaklı JSON \`evaluations\` dizisi olarak çıktı üret.`,
  });
}
