import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/app/(onboarding)/onboarding/positioning/_services/validation";
import type { SiftedThesis } from "@/app/(onboarding)/onboarding/positioning/_services/sifting";

/**
 * Builds the standardized PromptPayload for Stage 1: Domain-Agnostic Strict Binary Triage.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param input - The validated positioning matrix input.
 * @param thesesInput - One or more candidate theses to evaluate in batch.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildBinaryTriagePromptPayload(
  input: PositioningMatrixInput | { subjectProblem: string; theoreticalFramework?: string; methodology?: string },
  thesesInput: SiftedThesis[] | SiftedThesis,
): PromptPayload {
  const theses = Array.isArray(thesesInput) ? thesesInput : [thesesInput];

  const candidateThesesContext = theses
    .map(
      (thesis, idx) => `--- TEZ #${idx + 1} ---
Tez ID: ${thesis.id}
Başlık: ${thesis.title}
Yazar: ${thesis.author || "Bilinmiyor"} (${thesis.year || "N/A"})
Üniversite/Bölüm: ${thesis.university || "N/A"} - ${thesis.department || "N/A"}
Tür: ${thesis.thesisType || "N/A"} | Dil: ${thesis.language || "N/A"}
Özet: ${thesis.abstract}`,
    )
    .join("\n\n");

  const subjectProblem = input.subjectProblem || "";
  const theoreticalFramework = ("theoreticalFramework" in input && input.theoreticalFramework) ? input.theoreticalFramework : "Belirtilmemiş";
  const methodology = ("methodology" in input && input.methodology) ? input.methodology : "Belirtilmemiş";

  return buildPromptPayload({
    roleAndExpertise:
      "Üniversiteler Üstü Akademik Tez Değerlendirme Kurulu Kıdemli Jüri Raportörüsünüz. Göreviniz, aday tez havuzunu evrensel bilimsel araştırma standartlarına göre eleyerek; araştırmacının tez matrisine doğrudan ampirik, kuramsal veya yöntemsel katkı sunan gerçek muhatap tezleri (Core Literature) belirlemektir.",

    primaryTask:
      "Sana sunulan kullanıcının 3 bileşenli Tez Matrisi (Araştırma Problemi ve Odağı, Teorik Çerçevesi, Metodolojisi) ile aday tez havuzunu karşılaştırarak; her bir tez için 'isRelevant: true | false' kararını ve somut 'decisionReason' gerekçesini üret.",

    rulesAndConstraints: `1. **TEZ MATRİSİ VE AKADEMİK MUHATAP İLKESİ (MUTLAK KURAL):**
   - Kullanıcının Tez Matrisi (Konu/Odak, Kuramsal Çerçeve ve Yöntem) araştırmanın kesin ve bağlayıcı sınırıdır.
   - Bir tez, kullanıcının araştırmasının doğrudan **birincil veri kaynağı/arşivi**, **tarihsel/kurumsal öncülü**, **yöntemsel kıyas modeli** veya **kuramsal/karşıt kutbu** ise \`isRelevant: true\` verilmelidir.

2. **EVRENSEL KABUL KRİTERLERİ (\`isRelevant: true\`):**
   - **Birincil Veri / Vaka / Aktör Kesişimi:** Araştırmacının incelediği temel aktörlerin, kurumların, partilerin, metin havuzlarının veya yayın organlarının kendi birincil dokümanlarını doğrudan inceleyen derinlikli çalışmalar.
   - **Kuramsal / Tarihsel Öncül Zemin:** Araştırma probleminin kuramsal zeminini veya incelenen dönemin hemen önceki hazırlık/kuluçka evresini inceleyen kilit çalışmalar.
   - **Yöntemsel Kılavuz / Model:** Kullanıcının benimsediği araştırma yöntemini (söylem analizi, arşiv taraması, içerik analizi vb.) benzer bir alanda başarıyla işletmiş metodolojik model çalışmalar.
   - **Kavramsal / Eleştirel Karşıtlık:** Kullanıcının temel savına veya kavramsal çerçevesine alternatif/eleştirel bir açıklama getiren kilit tartışma çalışmaları.

3. **EVRENSEL MUTLAK RED KRİTERLERİ (\`isRelevant: false\` - GÜRÜLTÜLÜ TEZLER):**
   - **Epistemolojik ve Dışsal Temsil Uyuşmazlığı:** Araştırmacının odağındaki aktörün/öznelerin kendi birincil söylemini veya eylemini değil; medyanın, basının veya üçüncü şahısların o aktörü nasıl haberleştirdiğini/algıladığını inceleyen dışsal algı ve haber derlemeleri (Örn: "Yazılı Basında X'in Temsili" gibi çalışmalar).
   - **İzole / Teğetsel Alt Tematik Sapmalar:** Kullanıcının temel kuramsal ve ampirik ekseni dışındaki bağımsız, dar veya tali alt başlıklar (Örn: Ana eksen siyasal strateji ve dönüşüm iken, konuyu yalnızca izole inanç, magazin veya dar bir tema üzerinden ele alanlar).
   - **Kronolojik, Dönemsel ve Coğrafi Uyuşmazlık:** Kullanıcının odaklandığı tarihsel dönemin çok öncesini/sonrasını veya tamamen farklı ülkeleri/bölgesel sahaları ele alan çalışmalar.
   - **Jenerik Derlemeler ve Sığ Güvenlik/Bürokrasi Raporları:** Özgün bir ampirik veri seti veya kuramsal yöntem sunmayan, genel lisansüstü derleme niteliğindeki veya yalnızca idari/güvenlik bülteni özetleyen çalışmalar.
   - **Yüzeysel Kelime Eşleşmesi Tuzağı:** Başlık veya özetinde konuya dair birkaç jenerik kelime barındırmasına rağmen, araştırma problemine ampirik veya yöntemsel hiçbir özgün derinlik katmayan çalışmalar.`,

    workflowSteps: `1. Aday tezin başlığını, yazarını ve özetini oku.
2. Kullanıcının Tez Matrisindeki Problem, Kuram ve Yöntem ile karşılaştır.
3. Evrensel Mutlak Red Kriterlerini kontrol et (Dışsal medya analizi mi? İzole teğetsel alt tema mı? Dönemsel/coğrafi sapma mı? Jenerik derleme mi?). Varsa \`isRelevant: false\` ver.
4. Kullanıcının araştırma nesnesine, birincil metin/yayın arşivine, yöntemine veya kuramsal zeminine doğrudan katkı sunuyorsa \`isRelevant: true\` ver.
5. Her aday için 1-2 cümlelik somut analitik gerekçe yaz.`,

    outputFormat:
      "Çıktı, 'evaluations' dizisi içeren JSON nesnesidir. Her adayın ID'si, kararı ve gerekçesi eksiksiz yer almalıdır.",

    examples: `<example>
<input>
=== KULLANICININ TEZ MATRİSİ ===
1. Araştırma Problemi: 1980 Sonrası Türkiye'de İktisadi Dönüşüm ve İş Dünyası Örgütlerinin Söylemi (TÜSİAD ve MÜSİAD Karşılaştırması).
2. Teorik Çerçeve: Eleştirel Ekonomi Politik ve Hegemonya Kuramı.
3. Metodoloji: Nitel Söylem Analizi.

=== ADAY TEZLER ===
--- TEZ #1 ---
Tez ID: 101
Başlık: 1980-2000 Döneminde TÜSİAD ve MÜSİAD'ın İktisadi Söyleminin Evrimi
Özet: İki iş örgütünün yayınladığı resmi raporlar ve genel kurul bildirileri üzerinden sermaye fraksiyonlarının söylemsel dönüşümünü inceler.

--- TEZ #2 ---
Tez ID: 102
Başlık: Türkiye'de Televizyon Dizilerinde İş İnsanı Temsili
Özet: 1990'lardaki popüler TV dizilerinde zengin iş insanı karakterlerinin basmakalıp rollerini inceler.

--- TEZ #3 ---
Tez ID: 103
Başlık: İş Dünyasında Yöneticilerin Zaman Yönetimi Becerileri ve Verimlilik
Özet: Özel sektör yöneticileriyle anket yapılarak zaman yönetimi tekniklerinin şirket performansına etkisi ölçülmüştür.
</input>
<output>
{
  "evaluations": [
    {
      "externalThesisId": "101",
      "isRelevant": true,
      "decisionReason": "Araştırmacının incelediği iki temel örgütün (TÜSİAD ve MÜSİAD) resmi raporlarını birincil kaynak olarak ele alarak söylem analizi yürütmektedir; doğrudan ampirik ve kuramsal muhataptır."
    },
    {
      "externalThesisId": "102",
      "isRelevant": false,
      "decisionReason": "İş insanı söylemini değil, televizyon dizilerindeki kurgusal temsilleri incelediği için Epistemolojik ve Dışsal Temsil Uyuşmazlığı nedeniyle elenmiştir."
    },
    {
      "externalThesisId": "103",
      "isRelevant": false,
      "decisionReason": "Ekonomi politik ve söylemsel dönüşüm yerine şirket içi zaman yönetimi anketine odaklandığı için Teğetsel Alt Tematik Sapma nedeniyle elenmiştir."
    }
  ]
}
</output>
</example>`,

    inputContext: `### KULLANICININ TEZ MATRİSİ:
1. Araştırma Problemi ve Odağı: ${subjectProblem}
2. Teorik ve Kavramsal Çerçeve: ${theoreticalFramework}
3. Metodoloji: ${methodology}

### DEĞERLENDİRİLECEK ADAY TEZLER (${theses.length} ADET):
${candidateThesesContext}`,

    taskTrigger:
      "Yukarıdaki <context> içeriğindeki aday tezleri <instructions> kurallarına göre analiz ederek 'evaluations' dizisini üret.",
  });
}
