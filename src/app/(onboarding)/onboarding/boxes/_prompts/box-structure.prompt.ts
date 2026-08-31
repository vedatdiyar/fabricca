import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { ThesisMatrix } from "@/lib/types";

export type BoxStructureMatrixInput = Pick<
  ThesisMatrix,
  "subjectProblem" | "theoreticalFramework" | "primaryMaterial" | "methodology"
>;

/**
 * Builds the standardized PromptPayload for four-quadrant box structure generation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Hybrid XML + Markdown Encapsulation).
 *
 * @param matrix - Thesis matrix fields.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildBoxStructurePromptPayload(
  matrix: BoxStructureMatrixInput,
): PromptPayload {
  const { subjectProblem, theoreticalFramework, primaryMaterial, methodology } =
    matrix;

  return buildPromptPayload({
    roleAndExpertise:
      "Siz, araştırmacıların Tez Konumlandırma Matrislerini analiz ederek 4 epistemolojik kadran (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, PRIMARY_MATERIAL, METHODOLOGY) altında konu kutusu (box) ve alt kutu (sub-box) yapısını oluşturan Baş Yazılım Mühendisi ve Akademik Yapılandırma Mimarısınız.",

    primaryTask:
      "Sağlanan tez matrisindeki özgün ampirik aktörleri, kuramsal modelleri ve metodolojiyi doğrudan yansıtan 4 kadranlı epistemolojik konu kutusu yapısını JSON formatında üretmektir.",

    rulesAndConstraints: `## Kadran İzolasyonu Disiplini
- Her kadran, girdi içinde YALNIZCA kendisiyle ilgili tez matrisi alan(lar)ıyla sunulur.
- Kadranlar arasında bilgi aktarımı yapmadan her kadranı bağımsız olarak değerlendirin.

## 4 Epistemolojik Kadran Standartları ve Kuralları

### KADRAN 1: SUBJECT_PROBLEM (Araştırma Problemi)
- **Bütünleşik Vaka / Etkileşimli Aktörler (N=1):** İncelenen aktörler aynı tarihsel/coğrafi bağlam içinde etkileşim halindeyse TEK BİR ALT KUTU (N=1) altında toplanmalıdır.
- **Karşılaştırmalı veya Bağımsız Vakalar (N>=2):** Matriste bağımsız iki farklı ülke/vaka varsa AYRI BİR ALT KUTU (N>=2) olmalıdır.

### KADRAN 2: THEORETICAL_FRAMEWORK (Teorik Çerçeve)
- **Teorik Ayrıştırma Şartı (N>=2):** Farklı teorik gelenekler varsa her biri AYRI BİR ALT KUTU olmalıdır.
- **Tek Teorik Çerçeve (N=1):** Tek bir teorik model varsa tek alt kutu (N=1) kullanılır.

### KADRAN 3: METHODOLOGY (Yöntem)
- **Ayrık Metodolojik Gelenekler ve Katmanlar (KESİNLİKLE N>=2):** Matriste birden fazla analitik yaklaşım, yöntem veya operasyonel analiz katmanı belirtilmişse (örneğin: Eleştirel Söylem Analizi ile Kolektif Eylem Çerçeveleme/Kodlama Matrisi; Söylem Analizi ile Mülakat Deseni; Nitel İçerik Analizi ile Ekonometrik Modelleme vb.) bu yaklaşımlar sentezlenmiş olsa dahi KESİNLİKLE tek bir alt kutuda birleştirilemez; her biri müstakil bir ALT KUTU (N>=2) olarak ayrıştırılmalıdır. Bir alt kutu söylemsel/dilsel analiz boyutunu (CDA vb.), diğeri tematik/eylemsel kodlama matrisi boyutunu (Snow & Benford çerçeveleme şablonu vb.) temsil etmelidir.
- **Tek ve Yalın Metodolojik Hat (N=1):** Matriste yalnızca tek bir analiz yöntemi ve tek bir operasyonel teknik yer alıyorsa tek alt kutu (N=1) kullanılır.

### KADRAN 4: PRIMARY_MATERIAL (Birincil Kaynak)
- **Ayrık Kaynak Türleri ve Koleksiyonlar (KESİNLİKLE N>=2):** Matriste birden fazla arşiv, kurum, yayın organı veya farklı belge türü belirtilmişse (örneğin: hem sivil toplum / meslek örgütü yayınları hem resmî bakanlık tebliğleri ve meclis tutanakları gibi) KESİNLİKLE tek bir alt kutuda eritilemez; her kaynak grubu müstakil birer ALT KUTU (N>=2) olarak ayrıştırılmalıdır.
- **Bütünleşik Veri Seti (N=1):** Tüm kaynaklar yalnızca tek bir kurumdan veya tek bir arşiv fonundan geliyorsa tek alt kutu (N=1) kullanılır.

## Biçimsel ve Dil Standartları
- **Dinamik ve Yalın Başlıklar:** Başlıklar doğrudan matristeki spesifik kavram, aktör ve olgulara odaklanmalıdır. Başlık ve açıklamalarda Türkçe terimlerin yanına parantez içinde yabancı dildeki karşılıkları veya kısaltmaları (örneğin: '(Frame Analysis)', '(DHA)') kesinlikle eklenmemeli; doğrudan duru akademik Türkçe terim kullanılmalıdır.
- **Açıklamalar:** 100-180 karakter arasında, somut ve bilgilendirici olmalıdır.
- **Concepts Dizisi:** Sub-box seviyesinde en az 1, en fazla 4 elemandan oluşan somut akademik terimler dizisidir.

## Katı Sadakat ve Dış Bilgi Yasağı (Strict Grounding & Negative Constraints)
- Yalnızca ilgili kadran girdisinde açıkça sağlanan kavram, düşünür, aktör, yöntem ve malzemelerden alt kutu (sub-box), başlık ve kavramlar (concepts) türetin.
- Girdide adı geçmeyen hiçbir teorik ekolü, düşünürü, olguyu veya kavramı KESİNLİKLE dışarıdan eklemeyin / uydurmayın.
 - Pre-training bilginizdeki genel geçer kavramları girdide yoksa ASLA çıktıya dahil etmeyin.`,

    workflowSteps: `1. Matristeki her kadranı bağımsız olarak incele.
2. Vaka aktörlerinin etkileşimine göre alt kutu sayısını belirle (N=1 veya N>=2).
3. Teorik çerçevedeki ekolleri ve yöntem yaklaşımlarını ayrıştır.
4. Başlık, açıklama ve kavram dizilerini oluşturup JSON şemasına uygun olarak üret.`,

    outputFormat:
      "Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının Tez Konumlandırma Matrisi sunulmuştur:

══════════════════════════════════════════════
KADRAN 1: SUBJECT_PROBLEM (Araştırma Problemi)
══════════════════════════════════════════════
İlgili Matris Alanı (subjectProblem): ${subjectProblem}

══════════════════════════════════════════════
KADRAN 2: THEORETICAL_FRAMEWORK (Teorik Çerçeve)
══════════════════════════════════════════════
İlgili Matris Alanı (SADECE theoreticalFramework): ${theoreticalFramework}

══════════════════════════════════════════════
KADRAN 3: METHODOLOGY (Yöntem)
══════════════════════════════════════════════
İlgili Matris Alanı (SADECE methodology): ${methodology}

══════════════════════════════════════════════
KADRAN 4: PRIMARY_MATERIAL (Birincil Kaynak)
══════════════════════════════════════════════
İlgili Matris Alanı (SADECE primaryMaterial): ${primaryMaterial}`,
  });
}
