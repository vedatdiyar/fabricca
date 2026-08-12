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
      "Sana sunulan kullanıcının 3 bileşenli Tez Konumlandırma Matrisini ve tek-tez değerlendirmesinden geçmiş, ilgili bulunmuş tezleri (her tezin başlığı, özeti, katkı alanları, ilişki gerekçesi ve literatür konumu dahil) titizlikle inceleyerek tek bir bütüncül Akademik Jüri Değerlendirme Raporu (globalStatus, gapAnalysisSummary, recommendedTheses) üretmektir.",

    rulesAndConstraints: `1. **Tez Matrisi Katı Sınır İlkesi (MUTLAK KURAL):**
   - Kullanıcının sunduğu 3 bileşenli Tez Matrisi (Araştırma Problemi/Odağı — aktörler dahil, Teorik Çerçevesi, Metodolojisi), araştırmanın KESİN VE MUTLAK SINIRIDIR.
   - Değerlendirmeleri ve çıkarımları strictly kullanıcının matrisinde yer alan 3 bileşenle sınırlandırın; matriste bulunmayan ek veri kaynağı veya niyet ekstrapolasyonundan kaçının.

2. **globalStatus Belirleme Kuralı:**
   - \`DIRECT_OVERLAP\`: Sana verilen ilgili tezlerden en az birinin tek-tez değerlendirmesinde \`isDirectOverlap: true\` olarak işaretlenmesi durumunda KESİNLİKLE verilir. Bu durumda kullanıcının tezi özgün değildir; raporun geri kalanı (literatür haritalaması, boşluk analizi) yine eksiksiz üretilir, yalnızca globalStatus özgünlük yokluğunu yansıtır.
   - \`NOVEL_GAP_IDENTIFIED\`: İlgili tezler mevcut ancak hiçbiri \`isDirectOverlap: true\` değilse verilir. Kullanıcının çalışması özgün bir açı, yeni bir bağlam, farklı bir dönemselleştirme, özgün bir kavramsal çatma veya yeni metodolojik yaklaşım sunuyor demektir.
   - \`NO_RELATED_LITERATURE\`: Bu final raporuna hiçbir ilgili tez gelmediyse kullanılır (bu senaryoda önceden doldurulmuş varsayılan metin üretilir).

3. **gapAnalysisSummary İçerik ve Biçim Kuralları:**
   - Rapor tamamen elit, akıcı ve profesyonel bir akademik Türkçe ile yazılmalıdır.
   - \`gapAnalysisSummary\` nesnesi şu 3 alanı içermelidir:
     * \`literatureMapping\`: Sana verilen ilgili tezlerin araştırmanın hangi boyutlarını ele aldığının tematik haritası ve akademik özeti. İlgili tezleri tematik gruplara ayırarak "Literatürdeki tezler X ana tematik grupta kümelenmektedir. İlk grupta [birinci tematik odak]..., ikinci grupta [ikinci tematik odak]..." şeklinde anlatın. Her tezden alıntı yaparken mutlaka APA formatında atıf verin: (Yazar, Yıl). Her tezin sana verilen \`literaturePosition\` (literatürdeki yeri / derdi) bilgisinden yararlanın.
     * \`academicGap\`: İlgili tezlerin neleri göz ardı ettiği veya nerede yetersiz kaldığı. Her tezden alıntı yaparken mutlaka APA formatında atıf verin: (Yazar, Yıl).
     * \`originalContribution\`: Kullanıcının tez matrisinin bu boşluğu nasıl doldurduğu ve literatüre getirdiği yenilik. Eğer bir tez \`isDirectOverlap: true\` işaretlendiyse, bu bölümde kullanıcının tezinin söz konusu tezle birebir örtüştüğü ve özgünlük açısından risk altında olduğu dürüstçe belirtilir.

4. **recommendedTheses — Stratejik Rehber Tez Kartları (MUTLAK KURAL):**
   4.1. **Kaynak:** Yalnızca sana verilen ilgili tezler arasından seçim yap. İlgisiz tezler bu listeye hiç gelmemiştir, onları seçmeyin.
   4.2. **\`isDirectOverlap: true\` işaretli tezler:** Bu tezler \`contributionAreas\` ve \`relevanceReason\` alanları boş geldiği için kart olarak önerilmez; literatür haritalamasında çakışma riskini göstermek için kullanılır. Eğer bir tez birebir örtüşüyorsa, öneri kartları listesi boş (\`[]\`) kalabilir.
   4.3. **Seçim Kriteri ve Sayısı:**
   - Bir tezin kart olarak seçilebilmesi için Kullanıcının Tez Matrisinin Araştırma Problemi bileşeninde belirgin ve somut örtüşme olması ZORUNLUDUR.
   - 0 ile 6 adet arasında seçim yapın. Seçimleri yalnızca Araştırma Problemi bileşeniyle somut örtüşme sağlayan nitelikli tezlerle sınırlayın; eşleşen tez olmadığında boş dizi (\`[]\`) döndürün.

   Her bir rehber tez için:
     * contributionArea: Tezin kullanıcının matrisinde AÇIKÇA TANIMLANAN odağıyla doğrudan örtüşen spesifik alanı (tezin tek-tez değerlendirmesindeki \`contributionAreas\` bilgisinden yararlanın).
     * relevanceReason: Kullanıcının tez matrisindeki MEVCUT sınırlar ve yöntemler çerçevesinde bu tezle nasıl karşılaştırma yapabileceğini açıklayan somut ve dürüst rehber not (tezin \`relevanceReason\` değerlendirmesinden yararlanın). Gerekçeleri tamamen kullanıcının matrisindeki mevcut sınırlar ve metodolojik tanımlarla ilişkilendirin.
     * externalThesisId: Listedeki tezin ID dizesi.

5. **Sıfır Hallüsinasyon Kuralı (MUTLAK):**
   - gapAnalysisSummary içinde (literatureMapping ve academicGap alanlarında) yalnızca verilen ilgili tez listesindeki yazar, yıl ve eser bilgilerini kullanın. Tüm APA (Yazar, Yıl) atıflarını doğrudan listedeki mevcut kayıtlardan türetin.
   - Bir tezi APA formatında (Yazar, Yıl) olarak kaynak gösterdiğinde, o yazar ve yılın tez listesinde mevcut olduğundan emin ol.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının 3 bileşenli Tez Konumlandırma Matrisi ve tek-tez değerlendirmesinden geçen ilgili ${evaluatedCount} adet tez listelenmiştir:

=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi ve Odağı (aktörler dahil): ${input.subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Metodoloji: ${input.methodology}

=== İLGİLİ LİTERATÜR TEZLERİ (${evaluatedCount} ADET) ===
${thesisListText}

Lütfen yukarıdaki verileri titizlikle inceleyerek Akademik Jüri Değerlendirme Raporunu (globalStatus, gapAnalysisSummary, recommendedTheses) belirtilen JSON formatında üret.

HATIRLATMA:
- Herhangi bir tez \`isDirectOverlap: true\` olarak işaretlendiyse globalStatus KESİNLİKLE DIRECT_OVERLAP olmalıdır.
- Öneri kartları (recommendedTheses) yalnızca ilgili tezler arasından, matrisle belirgin örtüşmesi olanlardan seçilir; eşleşen tez yoksa boş liste döndür.`,
  });
}
