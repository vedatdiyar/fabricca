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
      "Akademik tez karşılaştırma, literatür taraması ve özgünlük analizi konusunda uzman, tarafsız ve son derece titiz bir Ön Değerlendirme Kurulu Üyesisiniz.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisi ile adaya ait TEK BİR tezi bağımsız ve objektif olarak karşılaştırarak tavizsiz bir ön eleme yapmak ve yapılandırılmış değerlendirme çıktısı üretmektir.",

    workflowSteps: `## Aşama 1 — Bağımsız ve Objektif Alakalılık Değerlendirmesi (isRelevant)
- Kullanıcının araştırmasının ARAŞTIRMA PROBLEMİ, TARİHSEL DÖNEMİ, BİRİNCİL MATERYALİ ve AMPİRİK ODAĞI ile bu tez arasında doğrudan, somut ve anlamlı bir akademik örtüşme var mı?
- **TAVİZSİZ ELEME DİSİPLİNİ:**
  * İncelenen tarihsel dönemi farklı olan (örn. kullanıcının incelediği 1990'lar dönemi yerine 2000'ler/2010'lar veya güncel olaylar/süreçler üzerine olan),
  * Birincil materyali ve ampirik araştırma sahası uyuşmayan (örn. tarihsel arşiv/korpus söylem analizi yerine güncel elit mülakatları veya tekil bir medya olayı üzerine olan),
  * Yalnızca genel/soyut kelime benzerliği veya genel konu ortaklığı taşıyan (örn. genel 'söylem', 'Kürt meselesi' veya 'devlet politikası' gibi geniş şemsiye kavramları paylaşan ancak ampirik odağı bambaşka olan)
  tüm tezleri KESİNLİKLE ELE (\`isRelevant: false\`).
- Yalnızca ampirik araştırma odağı, dönemi ve sorunsalı gerçekten aynı akademik sahada kesişen tezler için \`isRelevant: true\` ver ve Aşama 2'ye geç. İlgisiz tezlerde diğer alanları boş bırak.

## Aşama 2 — Birebir Örtüşme / Özgünlük Değerlendirmesi (isDirectOverlap)
- Kullanıcının tezi ile bu tez Konu/Sorunsal + Tarihsel Dönem + Analiz Birimi + Teorik Çerçeve açısından BİREBİR AYNI mı?
- Eğer BİREBİR örtüşme varsa \`isDirectOverlap: true\` döndür.
- Eğer çalışma özgün bir açı, farklı bir dönemselleştirme veya yeni bir kavramsal çatma barındırıyorsa \`isDirectOverlap: false\` döndür ve Aşama 3'e geç.

## Aşama 3 — Katkı Açıları + Literatür Konumu (Yalnızca İlgili Tezler İçin)
- \`contributionAreas\`: Tezin kullanıcının çalışmasına doğrudan sunduğu 1-3 adet kısa spesifik katkı alanı (Örn: ["1990'lar Serxwebûn Korpus Analizi", "Yasal Parti Belgeleri Mukayesesi"]).
- \`relevanceReason\`: Kullanıcının bu tezi çalışmasında nasıl kaynak/karşılaştırma unsuru yapacağına dair EN FAZLA 1-2 cümlelik somut ve dürüst rehber not.
- \`literaturePosition\`: Tezin literatürdeki temel sorunsalı ve amacı hakkında EN FAZLA 1 cümlelik özet.`,

    rulesAndConstraints: `1. **Tamamen Bağımsız Değerlendirme:** Herhangi bir kota, sayı zorlaması veya belirli sayıda tez seçme hedefi yoktur. Eşleşmeyen her tezi çekinmeden eleyin (\`isRelevant: false\`).
2. **Dönem ve Materyal Hassasiyeti:** Genel kavram benzerliklerine aldanmayın; tarihsel dönem, ampirik materyal ve araştırma odağı uyuşmayan tezleri elenmiş kabul edin.
3. **Kısa ve Odaklı İfade:** relevanceReason ve literaturePosition açıklamalarını net, kısa ve gürültüsüz tutun.
4. **Veri Sadakati:** Yalnızca verilen başlık ve özet metnine dayanın; varsayımsal eklemeler yapmayın.`,

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
      "Akademik tez karşılaştırma, literatür taraması ve özgünlük analizi konusunda uzman, tarafsız ve son derece titiz bir Ön Değerlendirme Kurulu Üyesisiniz.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisi ile listedeki HER BİR TEZİ TEK TEK, bağımsız ve objektif olarak karşılaştırarak tavizsiz bir ön eleme yapmak ve yapılandırılmış değerlendirme dizisi (`evaluations`) üretmektir.",

    workflowSteps: `## Aşama 1 — Bağımsız ve Objektif Alakalılık Değerlendirmesi (isRelevant)
- Kullanıcının araştırmasının ARAŞTIRMA PROBLEMİ, TARİHSEL DÖNEMİ, BİRİNCİL MATERYALİ ve AMPİRİK ODAĞI ile bu tez arasında doğrudan, somut ve anlamlı bir akademik örtüşme var mı?
- **TAVİZSİZ ELEME DİSİPLİNİ:**
  * İncelenen tarihsel dönemi farklı olan (örn. kullanıcının incelediği 1990'lar dönemi yerine 2000'ler/2010'lar veya güncel olaylar/süreçler üzerine olan),
  * Birincil materyali ve ampirik araştırma sahası uyuşmayan (örn. tarihsel arşiv/korpus söylem analizi yerine güncel elit mülakatları veya tekil bir medya olayı üzerine olan),
  * Yalnızca genel/soyut kelime benzerliği veya genel konu ortaklığı taşıyan (örn. genel 'söylem', 'Kürt meselesi' veya 'devlet politikası' gibi geniş şemsiye kavramları paylaşan ancak ampirik odağı bambaşka olan)
  tüm tezleri KESİNLİKLE ELE (\`isRelevant: false\`).
- Yalnızca ampirik araştırma odağı, dönemi ve sorunsalı gerçekten aynı akademik sahada kesişen tezler için \`isRelevant: true\` ver ve Aşama 2'ye geç.

## Aşama 2 — Birebir Örtüşme / Özgünlük Değerlendirmesi (isDirectOverlap)
- Kullanıcının tezi ile bu tez Konu/Sorunsal + Tarihsel Dönem + Analiz Birimi + Teorik Çerçeve açısından BİREBİR AYNI mı?
- Eğer BİREBİR örtüşme varsa \`isDirectOverlap: true\` döndür.
- Eğer çalışma özgün bir açı, farklı bir dönemselleştirme veya yeni bir kavramsal çatma barındırıyorsa \`isDirectOverlap: false\` döndür ve Aşama 3'e geç.

## Aşama 3 — Katkı Açıları + Literatür Konumu (Yalnızca İlgili Tezler İçin)
- \`contributionAreas\`: En fazla 2-3 kısa etiket.
- \`relevanceReason\`: EN FAZLA 1-2 cümlelik net rehber not.
- \`literaturePosition\`: EN FAZLA 1 cümlelik özet.`,

    rulesAndConstraints: `1. **Tamamen Bağımsız Değerlendirme:** Herhangi bir kota, sayı zorlaması veya belirli sayıda tez seçme hedefi yoktur. Eşleşmeyen her tezi çekinmeden eleyin (\`isRelevant: false\`).
2. **Dönem ve Materyal Hassasiyeti:** Genel kavram benzerliklerine aldanmayın; tarihsel dönem, ampirik materyal ve araştırma odağı uyuşmayan tezleri elenmiş kabul edin.
3. **Kısa ve Odaklı İfade:** Açıklamaları net, kısa ve gürültüsüz tutun.
4. **Bağlam İzolasyonu:** Her tezi sadece kullanıcının tez matrisi ile karşılaştırın.`,

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
