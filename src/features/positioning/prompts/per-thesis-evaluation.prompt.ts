import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";
import type { SiftedThesis } from "@/features/positioning/sifting";

/**
 * Builds the standardized PromptPayload for single-thesis strategic evaluation.
 * Focuses strictly on the substantive research problem and empirical phenomenon (subjectProblem)
 * to avoid attention leakage from abstract theoretical or methodological labels.
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
      "Akademik Tez Değerlendirme Kurulu Kıdemli Raportörüsünüz. Göreviniz aday tezin olgusal ve ampirik araştırma nesnesini, kullanıcının araştırma problemiyle tarafsız, titiz ve tavizsiz bir biçimde karşılaştırarak stratejik ön eleme yapmaktır.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi ve Olgusal Odağı ile adaya ait TEK BİR tezi karşılaştırarak; tezin olgusal uygunluğunu (isRelevant), birebir çakışma durumunu (isDirectOverlap) ve eğer uygunsa tezin kullanıcının literatür taramasındaki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirlemektir.",

    rulesAndConstraints: `1. **Mutlak Olgusal Saha ve Ampirik Odak Kuralı (MUTLAK KURAL):**
   - \`isRelevant: true\` YALNIZCA VE SADECE aday tezin ampirik araştırma nesnesi kullanıcının çalıştığı somut konu, aktörler, kurumlar veya süreçle DOĞRUDAN kesişiyorsa verilir.

2. **Kuramsal Benzerlik Tuzağı ve Genel Derleme Yasağı (KESİN ELEME SEBEBİ):**
   - Aday tez; somut aktörlerin birincil metinlerini, söylemlerini veya olgusal verilerini ampirik olarak incelemek yerine, yalnızca genel/ikincil kaynaklar üzerinden soyut kavramları tartışan genel bir literatür derlemesiyse KESİNLİKLE ELE (\`isRelevant: false\`).
   - Yöntem veya kuram ne kadar benzer olursa olsun, tezin ampirik ve olgusal odağı kullanıcının araştırma nesnesiyle doğrudan kesişmiyorsa KESİNLİKLE ELE (\`isRelevant: false\`).

3. **Medya ve Alakasız Dış Aktör Yasağı:**
   - Araştırılan hareketin/konunun kendi iç dinamikleri yerine; ana akım medyanın temsillerini, üçüncü ülkelerin dış politikasını veya konuyla doğrudan bağı olmayan dış yapıları inceleyen tezleri KESİNLİKLE ELE (\`isRelevant: false\`).

4. **Evrensel 5'li Stratejik Rol Tipolojisi (Yalnızca Olgusal Olarak Geçerli Tezler İçin):**
   - \`BROAD_CONTEXT\` (Geniş Çerçeve): Konuyu daha geniş bir zaman diliminde veya makro bağlamda ele alan çalışmalar; kullanıcının tezi bu çalışmanın genel geçtiği spesifik dönemi/boyutu derinleştirir.
   - \`SPECIFIC_FOCUS\` (Kısmi Odak): Araştırmanın tek bir parçasına, tek bir aktörüne, kurumuna veya birincil kaynağına odaklanan çalışmalar; kullanıcının tezi çok boyutlu/bütüncül sentez yapar.
   - \`FOUNDATIONAL_WORK\` (Öncül Çalışma): Konunun önceki evrelerini, tarihsel köklerini veya zeminini inceleyen çalışmalar; kullanıcının tezi nedensellik köprüsü kurar.
   - \`METHODOLOGICAL_BENCHMARK\` (Yöntem Rehberi): Benzer bir veri toplama, sınıflandırma, tipoloji veya analiz modeli uygulayan çalışmalar; kullanıcı yöntemini kıyaslamak ve güçlendirmek için kullanır.
   - \`ALTERNATIVE_PERSPECTIVE\` (Karşıt Yaklaşım): Farklı bir kuramsal gözlükle veya zıt bir açıklama modeliyle yaklaşan çalışmalar; kullanıcı eleştirel tartışma açmak için kullanır.

5. **Eylem Odaklı Rehberlik Dili:**
   - \`literaturePosition\`: Tezin başlık ve özetine dayanarak neyi, hangi birincil veriyle incelediğini 1 net cümlede özetleyin.
   - \`strategicUtility\`: Araştırmacıya doğrudan tez yazımında yol gösteren eylem dili kullanın: "Bu tezi Giriş / Literatür bölümünde [X] için referans verebilir; tezinizin farkını ise [Y] noktasında vurgulayabilirsiniz."`,

    workflowSteps: `## Aşama 1 — Olgusal Saha ve Ampirik Derinlik Kontrolü (isRelevant)
- Aday tezin araştırma nesnesi kullanıcının araştırma problemindeki somut aktörler/konuyla doğrudan kesişiyor mu?
- Tez genel soyut bir kuramsal derleme mi yoksa somut birincil/ampirik bir analiz mi?
- Uygun olmayan veya genel kalan tezlerde \`isRelevant: false\` ver ve bitir.

## Aşama 2 — Birebir Çakışma Kontrolü (isDirectOverlap)
- Konu + Dönem + Aktörler + Yöntemsel Problem BİREBİR AYNI mı? Varsa \`isDirectOverlap: true\`.

## Aşama 3 — Stratejik Rol ve Konumlandırma (Yalnızca isRelevant: true ve isDirectOverlap: false için)
- \`strategicRole\`: BROAD_CONTEXT | SPECIFIC_FOCUS | FOUNDATIONAL_WORK | METHODOLOGICAL_BENCHMARK | ALTERNATIVE_PERSPECTIVE
- \`literaturePosition\`: Tezin literatürdeki yerini özetleyen 1 cümle.
- \`strategicUtility\`: Araştırmacıya tez yazımında yol gösteren 1-2 cümlelik rehber not.
- \`contributionAreas\`: 1-3 kısa odak etiketi.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ VE OLGUSAL ODAĞI ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü manevra ve mevzi savaşı bağlamında PKK ve HEP-DEP-HADEP üzerinden inceler.

=== DEĞERLENDİRİLECEK TEZ ===
Tez ID: 363401
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Ali Yılmaz (2015)
Üniversite/Bölüm: Ankara Üniversitesi - Siyaset Bilimi
Tür: Doktora | Dil: Türkçe
Özet: 1990-2014 döneminde yasal Kürt partilerinin (HEP, DEP, HADEP, DEHAP, DTP, BDP, HDP) program ve söylemlerindeki evrimi inceler.
</input>
<output>
{
  "externalThesisId": "363401",
  "isRelevant": true,
  "isDirectOverlap": false,
  "strategicRole": "BROAD_CONTEXT",
  "contributionAreas": ["Yasal parti söylemi", "1990'lar dönemselleştirmesi", "Söylemsel dönüşüm"],
  "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.",
  "strategicUtility": "Bu tezi Giriş ve Literatür Taraması bölümlerinde yasal partilerin tarihsel seyrini temellendirmek için kullanabilir; tezinizin farkını ise bu çalışmanın yüzeysel geçtiği 1991-1999 kuluçka evresini silahlı kanatla karşılaştırmalı olarak derinleştirme noktasında vurgulayabilirsiniz."
}
</output>
</example>

<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ VE OLGUSAL ODAĞI ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü inceler.

=== DEĞERLENDİRİLECEK TEZ ===
Tez ID: 601435
Başlık: Türkiye'de Toplumsal Hareketlerin Evrimi: Etnik Mobilizasyon Örneği
Yazar: Mehmet Demir (2018)
Üniversite/Bölüm: İstanbul Üniversitesi - Sosyoloji
Tür: Yüksek Lisans | Dil: Türkçe
Özet: Toplumsal hareket kuramları ışığında etnik mobilizasyon olgusunu genel ikincil literatür üzerinden teorik olarak tartışır.
</input>
<output>
{
  "externalThesisId": "601435",
  "isRelevant": false,
  "isDirectOverlap": false,
  "contributionAreas": [],
  "literaturePosition": "",
  "strategicUtility": ""
}
</output>
</example>`,

    inputContext: `### KULLANICININ ARAŞTIRMA PROBLEMİ VE OLGUSAL ODAĞI:
${input.subjectProblem}

### DEĞERLENDİRİLECEK TEZ:
Tez ID: ${thesis.id}
Başlık: ${thesis.title}
Yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
Üniversite/Bölüm: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
Tür: ${thesis.thesisType || "N/A"} | Dil: ${thesis.language || "N/A"}
Özet: ${thesis.abstract}`,

    taskTrigger:
      "Yukarıdaki <context> içinde yer alan tezi <instructions> kurallarına göre analiz ederek JSON formatında değerlendirme çıktısını üret.",
  });
}

/**
 * Builds the standardized PromptPayload for multi-thesis batch strategic evaluation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
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
      "Akademik Tez Değerlendirme Kurulu Kıdemli Raportörüsünüz. Göreviniz listedeki aday tezleri kullanıcının araştırma problemiyle olgusal ve ampirik açıdan karşılaştırarak tarafsız ve tavizsiz bir stratejik ön eleme yapmaktır.",

    primaryTask:
      "Sana sunulan kullanıcının Araştırma Problemi ve Olgusal Odağı ile listedeki HER BİR TEZİ TEK TEK karşılaştırarak; tezin olgusal uygunluğunu (isRelevant), birebir çakışma durumunu (isDirectOverlap) ve eğer uygunsa tezin kullanıcının literatür taramasındaki stratejik rolünü (strategicRole, literaturePosition, strategicUtility) belirleyip `evaluations` dizisi olarak döndürmektir.",

    rulesAndConstraints: `1. **Mutlak Olgusal Saha ve Ampirik Odak Kuralı (MUTLAK KURAL):**
   - \`isRelevant: true\` YALNIZCA VE SADECE aday tezin ampirik araştırma nesnesi kullanıcının çalıştığı somut konu, aktörler, kurumlar veya süreçle DOĞRUDAN kesişiyorsa verilir.

2. **Kuramsal Benzerlik Tuzağı ve Genel Derleme Yasağı (KESİN ELEME SEBEBİ):**
   - Aday tez; somut aktörlerin birincil metinlerini, söylemlerini veya olgusal verilerini ampirik olarak incelemek yerine, yalnızca genel/ikincil kaynaklar üzerinden soyut kavramları tartışan genel bir literatür derlemesiyse KESİNLİKLE ELE (\`isRelevant: false\`).

3. **Medya ve Alakasız Dış Aktör Yasağı:**
   - Araştırılan hareketin/konunun kendi iç dinamikleri yerine; ana akım medyanın temsillerini, üçüncü ülkelerin dış politikasını veya konuyla doğrudan bağı olmayan dış yapıları inceleyen tezleri KESİNLİKLE ELE (\`isRelevant: false\`).

4. **Evrensel 5'li Stratejik Rol Tipolojisi (Yalnızca Olgusal Olarak Geçerli Tezler İçin):**
   - \`BROAD_CONTEXT\` (Geniş Çerçeve): Konuyu daha geniş bir zaman diliminde veya makro bağlamda ele alan çalışmalar.
   - \`SPECIFIC_FOCUS\` (Kısmi Odak): Araştırmanın tek bir parçasına, tek bir aktörüne, kurumuna veya birincil kaynağına odaklanan çalışmalar.
   - \`FOUNDATIONAL_WORK\` (Öncül Çalışma): Konunun önceki evrelerini, tarihsel köklerini veya zeminini inceleyen çalışmalar.
   - \`METHODOLOGICAL_BENCHMARK\` (Yöntem Rehberi): Benzer bir veri toplama, sınıflandırma, tipoloji veya analiz modeli uygulayan çalışmalar.
   - \`ALTERNATIVE_PERSPECTIVE\` (Karşıt Yaklaşım): Farklı bir kuramsal gözlükle veya zıt bir açıklama modeliyle yaklaşan çalışmalar.`,

    workflowSteps: `1. Her tezin somut ampirik araştırma nesnesini incele.
2. Genel kuramsal derlemeleri, medya tezlerini ve ilgisiz alanları ele (isRelevant: false).
3. Geçerli tezlerin strategicRole, literaturePosition ve strategicUtility değerlerini üret.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
=== KULLANICININ ARAŞTIRMA PROBLEMİ VE OLGUSAL ODAĞI ===
1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü inceler.

=== DEĞERLENDİRİLECEK TEZLER ===
Tez ID: 363401
Başlık: 1990-2014 Dönemi Kürt Siyasal Hareketinin Söyleminin Dönüşümü
Yazar: Ali Yılmaz (2015)
Özet: 1990-2014 döneminde yasal Kürt partilerinin program ve söylemlerini inceler.
</input>
<output>
{
  "evaluations": [
    {
      "externalThesisId": "363401",
      "isRelevant": true,
      "isDirectOverlap": false,
      "strategicRole": "BROAD_CONTEXT",
      "contributionAreas": ["Yasal parti söylemi", "1990'lar dönemselleştirmesi"],
      "literaturePosition": "1990-2014 dönemindeki yasal Kürt parti geleneğini geniş bir dönemsel perspektifle incelemiştir.",
      "strategicUtility": "Giriş ve Literatür bölümlerinde tarihsel seyri temellendirmek için kullanılabilir."
    }
  ]
}
</output>
</example>`,

    inputContext: `### KULLANICININ ARAŞTIRMA PROBLEMİ VE OLGUSAL ODAĞI:
${input.subjectProblem}

### DEĞERLENDİRİLECEK TEZLER:
${formattedTheses}`,

    taskTrigger:
      "Yukarıdaki <context> içinde yer alan her bir tezi <instructions> kurallarına göre değerlendirerek `evaluations` dizisi içeren JSON formatında çıktı üret.",
  });
}
