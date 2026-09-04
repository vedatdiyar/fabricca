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
- **Çoklu Mücadele Hatları, Çift Kanatlı Dinamikler veya Ayrık Aktör Kümeleri (KESİNLİKLE N>=2):** Araştırma problemi birbirine indirgenemeyen birden fazla mücadele/eylem alanını, kurumsal/örgütsel hattı (örneğin: yasal/parlamenter siyaset ile yasadışı/silahlı mücadele; devlet kurumları ile sivil toplumsal hareketler; sermaye örgütleri ile emek sendikaları; iktidar blokları ile muhalefet odakları) veya karşılaştırmalı vakaları eşzamanlı olarak inceliyorsa, her bir ana hat/aktör kümesi müstakil birer ALT KUTU (N>=2) olarak ayrıştırılmalıdır. Bu ayrım, literatür taramasında her iki alanın uzmanlaşmış akademik literatürünün bağımsız taranabilmesi için zorunludur.
- **Tekil ve Homojen Vaka / Süreç (N=1):** Araştırma problemi tek bir kurumu, tekil bir aktör grubunu veya homojen bir kurumsal/toplumsal süreci inceliyorsa TEK BİR ALT KUTU (N=1) altında toplanmalıdır.

### KADRAN 2: THEORETICAL_FRAMEWORK (Teorik Çerçeve)
- **Müstakil Kuramsal Ekoller ve Bağımsız Paradigmalar (N>=2):** Matriste birden fazla bağımsız kuramsal gelenek, farklı düşünürler veya rakip paradigmalar (örneğin: Gramsciyen hegemonya ile Foucaultgil iktidar analizi; Weberci bürokrasi ile Marksist devlet kuramı vb.) bir arada kullanılıyorsa her bağımsız kuramsal gelenek müstakil birer ALT KUTU (N>=2) olmalıdır.
- **Tekil Kuramsal Model ve Kavramsal Çerçeve (N=1):** Matriste tek bir düşünürün kuramı, tekil bir teorik model veya bir kuramın kendi kavramsal mekanizmaları (örneğin: manevra ve mevzi savaşı, kuşatma savaşı, karşı-hegemonya) işleniyorsa TEK BİR ALT KUTU (N=1) kullanılır. Aynı kuramsal modelin iç kavramsal bileşenleri yapay olarak alt kutulara bölünemez.

### KADRAN 3: METHODOLOGY (Yöntem)
- **Müstakil Araştırma Yöntemleri ve Veri Analizi Ekolleri (N>=2):** Matriste birbirine indirgenemeyen birden fazla bağımsız araştırma yöntemi veya veri toplama/analiz ekolü açıkça belirtilmişse (örneğin: Derinlemesine Mülakat ile Arşiv/Belge Analizi; Eleştirel Söylem Analizi ile Nicel Ekonometrik Modelleme; Etnografik Gözlem ile Sayısal İçerik Analizi) her bağımsız yöntem müstakil birer ALT KUTU (N>=2) olarak ayrıştırılmalıdır.
- **Tekil ve Bütünleşik Metodolojik Hat (N=1):** Matriste yalnızca tek bir araştırma ve analiz yöntemi (örneğin salt söylem analizi, salt arşiv incelemesi veya salt vaka analizi) ve onun kendi içsel analitik adımları, açık uçlu soruları, korpus sınırlama kriterleri veya dönemselleştirmesi (kritik momentler, kırılma noktaları) yer alıyorsa KESİNLİKLE TEK BİR ALT KUTU (N=1) kullanılır. Yöntemin iç adımları, analitik soruları, örneklem sınırlaması veya dönemleme evreleri yapay olarak ayrı metodoloji kutularına bölünemez.

### KADRAN 4: PRIMARY_MATERIAL (Birincil Kaynak)
- **Ayrık Kaynak Koleksiyonları ve Farklı Belge Türleri (KESİNLİKLE N>=2):** Matriste birden fazla arşiv, kurum, farklı aktör yayınları veya ayrık belge türleri belirtilmişse (örneğin: örgütsel/parti yayınları ile resmî meclis/dava tutanakları; bakanlık raporları ile sivil toplum bültenleri; mülakat transkriptleri ile basın arşivi gibi) her kaynak grubu müstakil birer ALT KUTU (N>=2) olarak ayrıştırılmalıdır.
- **Bütünleşik Veri Seti veya Tekil Arşiv (N=1):** Tüm kaynaklar tek bir kurumdan, tek bir arşiv fonundan veya tekil bir veri tabanından geliyorsa tek alt kutu (N=1) kullanılır.

## Biçimsel ve Dil Standartları
- **Duru, Zengin ve İmlası Kusursuz Türkçe:** Başlık ve açıklamalarda yüksek düzeyde akademik Türkçe kullanılmalıdır. Yabancı düşünür isimlerinin Türkçe sıfatlaştırılmasında (örneğin: Gramsci -> Gramsciyen; Foucault -> Foucaultcu; Marx -> Marksist; Habermas -> Habermasçı) ve terimlerde kesinlikle yazım hatası, harf kayması veya uydurma sözcük yapılmamalıdır.
- **Dinamik ve Yalın Başlıklar:** Başlıklar doğrudan matristeki spesifik kavram, aktör ve olgulara odaklanmalıdır. Başlık ve açıklamalarda Türkçe terimlerin yanına parantez içinde yabancı dildeki karşılıkları veya kısaltmaları kesinlikle eklenmemeli; doğrudan duru akademik Türkçe terim kullanılmalıdır.
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
