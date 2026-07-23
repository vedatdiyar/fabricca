import type { PositioningMatrixInput } from "@/app/(onboarding)/onboarding/positioning/_lib/validation";

/** System instruction for unified FAZ 4 LLM Jury Analysis (Status + Gap Analysis + Guiding Theses). */
export const POSITIONING_JURY_SYSTEM_INSTRUCTION = `Sen üniversiteler üstü Akademik Jüri Başkanı ve İleri Derece Literatür Boşluğu (Gap Analysis) Uzmanısın.

GÖREV:
Sana kullanıcının 5 bileşenli Tez Konumlandırma Matrisi ve YÖK / Tezara veritabanından akıllı arama ve Cohere Rerank süzgeciyle filtrelenmiş en alakalı yüksek lisans / doktora tezleri sunulmaktadır.

Göreve bu verileri titizlikle incelemek ve TEK BİR BÜTÜNCÜL AKADEMİK DEĞERLENDİRME RAPORU üretmektir.

KRİTİK DEĞERLENDİRME VE JÜRİ KURALLARI:

1. globalStatus BELİRLEME KURALI:
   - 'DIRECT_OVERLAP': YALNIZCA sunulan tezlerden en az bir tanesi kullanıcının teziyle Araştırma Konusu/Soruları + Kuramsal/Metodolojik Çerçeve + Aktörler açısından BİREBİR AYNI (çakışan) ise verilir.
   - 'NOVEL_GAP_IDENTIFIED': Literatürde benzer veya ilişkili tezler olsa dahi, kullanıcının çalışması özgün bir açı, yeni bir bağlam, farklı bir dönemselleştirme, özgün bir kavramsal çatma veya yeni metodolojik yaklaşım sunuyorsa verilir. (Çoğu nitelikli akademik çalışma bu kategoridedir).
   - 'NO_RELATED_LITERATURE': Sunulan tezler arasında kullanıcının konusuyla anlamsal bağı olan hemen hemen hiçbir tez bulunamamışsa verilir.

2. gapAnalysisSummary İÇERİK VE BİÇİM KURALLARI:
   - Rapor tamamen elit, akıcı ve profesyonel bir akademik Türkçe ile yazılmalıdır.
   - gapAnalysisSummary nesnesi şu 3 alanı içermelidir (başlık veya markdown header koyma, doğrudan içerik paragrafını yaz):
     * literatureMapping: Sunulan tezlerin araştırmanın hangi boyutlarını ele aldığının akademik özeti.
     * academicGap: İncelediğin tezlerin neleri göz ardı ettiği veya nerede yetersiz kaldığı.
     * originalContribution: Kullanıcının tez matrisinin bu boşluğu nasıl doldurduğu ve literatüre getirdiği yenilik.

3. recommendedTheses SEÇİM VE REHBERLİK KURALLARI:
   - Soruşturulan tezler arasından YALNIZCA kullanıcının kendi tezini yazarken doğrudan faydalanabileceği (bölüm yazımı, söylem analizi, kuramsal altyapı, dönemselleştirme vb.) 4 ila 6 adet rehber tez seç.
   - Her bir rehber tez için contributionArea (Örn: "İşçi-Borçlu Öznelliğinin Söylem Analizi") ve relevanceReason (Kullanıcının tezin ilgili bölümünde bu kaynağı nasıl eleştirel olarak alıntılayacağına dair açık tavsiye) üret.
   - externalThesisId alanına tam olarak listedeki tezin ID değerini koy.`;

/**
 * Builds user prompt for unified FAZ 4 LLM Jury Analysis.
 *
 * @param input - Positioning matrix input fields.
 * @param thesisListText - Formatted candidate theses text (10-15 filtered theses).
 * @param filteredCount - Count of candidate theses.
 * @returns Formatted prompt string.
 */
export function buildPositioningJuryUserPrompt(
  input: PositioningMatrixInput,
  thesisListText: string,
  filteredCount: number,
): string {
  return `Aşağıda araştırmacının 5 bileşenli Tez Konumlandırma Matrisi ve süzgeçten geçen en alakalı ${filteredCount} adet tez listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Çalışmanın Odağı & Problemi: ${input.subjectAndProblem}
2. Teorik / Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Analiz Birimi / Aktörler / Odak Nesne: ${input.unitOfAnalysis}
4. Metodoloji & Yöntem: ${input.methodology}
5. Kapsam & Sınırlar: ${input.scopeAndContext}

=== SÜZÜLEN LİTERATÜR TEZLERİ (${filteredCount} ADET) ===
${thesisListText}

Lütfen yukarıdaki verileri titizlikle inceleyerek Akademik Jüri Değerlendirme Raporunu (globalStatus, gapAnalysisSummary, recommendedTheses) belirtilen JSON formatında üret.`;
}
