import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";

export interface PositioningJuryPromptInput {
  input: PositioningMatrixInput;
  thesisListText: string;
  evaluatedCount: number;
}

/**
 * Builds the standardized PromptPayload for unified final LLM positioning jury analysis.
 *
 * @param params - Matrix input, serialized thesis text, and count.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPositioningJuryPromptPayload(
  params: PositioningJuryPromptInput,
): PromptPayload {
  const { input, thesisListText, evaluatedCount } = params;

  return buildPromptPayload({
    roleAndExpertise:
      "Üniversiteler Üstü Akademik Jüri Başkanı ve İleri Derece Literatür Boşluğu (Gap Analysis) Uzmanısınız.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisini ve ön elemeden geçerek jüriye iletilen ilgili tezleri (her tezin başlığı, özeti, katkı alanları, ilişki gerekçesi ve literatür konumu dahil) titizlikle inceleyerek tek bir bütüncül Akademik Jüri Değerlendirme Raporu (globalStatus, gapAnalysisSummary, recommendedTheses) üretmektir.",

    rulesAndConstraints: `1. **Tez Matrisi Katı Sınır İlkesi (MUTLAK KURAL):**
   - Kullanıcının sunduğu 3 bileşenli Tez Matrisi (Araştırma Problemi/Odağı — aktörler ve dönem dahil, Teorik Çerçevesi, Metodolojisi), araştırmanın KESİN VE MUTLAK SINIRIDIR.
   - Değerlendirmeleri ve çıkarımları strictly kullanıcının matrisinde yer alan 3 bileşenle sınırlandırın; matriste bulunmayan ek varsayımsal kaynaklar uydurmaktan kaçının.

2. **globalStatus Belirleme Kuralı:**
   - \`DIRECT_OVERLAP\`: Sana verilen ilgili tezlerden en az birinin ön elemesinde \`isDirectOverlap: true\` olarak işaretlenmesi durumunda KESİNLİKLE verilir. Bu durumda kullanıcının tezi özgün değildir; raporun geri kalanı (literatür haritalaması, boşluk analizi) yine eksiksiz üretilir, yalnızca globalStatus özgünlük yokluğunu yansıtır.
   - \`NOVEL_GAP_IDENTIFIED\`: İlgili tezler mevcut ancak hiçbiri \`isDirectOverlap: true\` değilse verilir. Kullanıcının çalışması özgün bir açı, yeni bir bağlam, farklı bir dönemselleştirme, özgün bir kavramsal çatma veya yeni metodolojik yaklaşım sunuyor demektir.
   - \`NO_RELATED_LITERATURE\`: Bu final raporuna hiçbir ilgili tez gelmediyse kullanılır (bu senaryoda önceden doldurulmuş varsayılan metin üretilir).

3. **gapAnalysisSummary İçerik ve Biçim Kuralları:**
   - Rapor tamamen elit, akıcı ve profesyonel bir akademik Türkçe ile yazılmalıdır.
   - \`gapAnalysisSummary\` nesnesi şu 3 alanı içermelidir:
     * \`literatureMapping\`: Sana verilen ilgili tezlerin araştırmanın hangi boyutlarını ele aldığının tematik haritası ve akademik özeti. İlgili tezleri tematik gruplara ayırarak anlatın. Her tezden bahsederken mutlaka APA formatında atıf verin: (Yazar, Yıl). Her tezin sana sağlanan \`literaturePosition\` (literatürdeki yeri / derdi) bilgisinden yararlanın.
     * \`academicGap\`: İlgili tezlerin neleri göz ardı ettiği veya nerede yetersiz kaldığı. Her tezden bahsederken mutlaka APA formatında atıf verin: (Yazar, Yıl).
     * \`originalContribution\`: Kullanıcının tez matrisinin bu boşluğu nasıl doldurduğu ve literatüre getirdiği yenilik. Eğer bir tez \`isDirectOverlap: true\` işaretlendiyse, bu bölümde kullanıcının tezinin söz konusu tezle birebir örtüştüğü ve özgünlük açısından risk altında olduğu dürüstçe belirtilir.

4. **recommendedTheses — Stratejik Rehber Tez Kartları:**
   - Sana iletilen ilgili tezlerin tamamı ön elemeden başarıyla geçmiş nitelikli çalışmalardır.
   - Birebir örtüşen (\`isDirectOverlap: true\`) tezler kart olarak önerilmez; literatür haritalamasında çakışma riskini göstermek için kullanılır.
   - \`isDirectOverlap: false\` olan ilgili tezlerin her biri için rehber kartı nesnesi üretin:
     * contributionArea: Tezin kullanıcının matrisinde AÇIKÇA TANIMLANAN odağıyla doğrudan örtüşen spesifik alanı (tezin \`contributionAreas\` bilgisinden yararlanın).
     * relevanceReason: Kullanıcının tez matrisindeki MEVCUT sınırlar ve yöntemler çerçevesinde bu tezle nasıl karşılaştırma yapabileceğini açıklayan somut ve dürüst rehber not (tezin \`relevanceReason\` değerlendirmesinden yararlanın).
     * externalThesisId: Listedeki tezin ID dizesi.

5. **Sıfır Hallüsinasyon Kuralı (MUTLAK):**
   - gapAnalysisSummary içinde (literatureMapping ve academicGap alanlarında) yalnızca verilen ilgili tez listesindeki yazar, yıl ve eser bilgilerini kullanın. Tüm APA (Yazar, Yıl) atıflarını doğrudan listedeki mevcut kayıtlardan türetin.
   - Bir tezi APA formatında (Yazar, Yıl) olarak kaynak gösterdiğinizde, o yazar ve yılın tez listesinde mevcut olduğundan emin olun.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının 3 bileşenli Tez Konumlandırma Matrisi ve ön elemeden geçen ilgili ${evaluatedCount} adet tez listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı (aktörler dahil): ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

=== ÖN ELEMEDEN GEÇEN İLGİLİ TEZLER (${evaluatedCount} ADET) ===
${thesisListText}

Lütfen yukarıdaki verileri titizlikle inceleyerek Akademik Jüri Değerlendirme Raporunu (globalStatus, gapAnalysisSummary, recommendedTheses) belirtilen JSON formatında üret.`,
  });
}
