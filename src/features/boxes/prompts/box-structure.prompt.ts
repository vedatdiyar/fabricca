import { buildPromptPayload, type PromptPayload } from "@/lib/ai/prompt-builder";
import type { ThesisMatrix } from "@/lib/types";

export type BoxStructureMatrixInput = Pick<
  ThesisMatrix,
  "subjectProblem" | "theoreticalFramework" | "primaryMaterial" | "methodology"
>;

/**
 * Builds the standardized PromptPayload for four-quadrant box structure generation.
 *
 * @param matrix - Thesis matrix fields.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildBoxStructurePromptPayload(
  matrix: BoxStructureMatrixInput
): PromptPayload {
  const { subjectProblem, theoreticalFramework, primaryMaterial, methodology } =
    matrix;

  return buildPromptPayload({
    roleAndExpertise:
      "Siz, akademisyenlerin Tez Konumlandırma Matrislerini analiz ederek 4 epistemolojik kadran (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, PRIMARY_MATERIAL, METHODOLOGY) altında konu kutusu (box) ve alt kutu (sub-box) yapısını oluşturan Baş Yazılım Mühendisi ve Akademik Yapılandırma Mimarısınız.",

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
- **Tek Metodolojik Hat / Bütünleşik Yöntem (N=1):** Yöntemler aynı şemsiyeyi tamamlıyorsa TEK BİR ALT KUTU (N=1) olmalıdır.
- **Karma / Ayrık Metodolojik Kulvarlar (N>=2):** Karma yöntem varsa AYRI BİR ALT KUTU olarak bölünmelidir.

### KADRAN 4: PRIMARY_MATERIAL (Birincil Kaynak)
- **Bütünleşik Veri Seti (N=1):** Tüm kaynaklar aynı arşivden geliyorsa TEK BİR ALT KUTU (N=1) yeterlidir.
- **Ayrık Kaynak Türleri ve Koleksiyonlar (N>=2):** Farklı arşivler veya belge grupları belirtilmişse her biri müstakil ALT KUTU olmalıdır.

## Biçimsel ve Dil Standartları
- **Dinamik Başlıklar:** Başlıklar doğrudan matristeki spesifik kavram, aktör ve olgulara odaklanmalıdır.
- **Açıklamalar:** 100-180 karakter arasında, somut ve bilgilendirici olmalıdır.
- **Concepts Dizisi:** Sub-box seviyesinde en az 1, en fazla 4 elemandan oluşan somut akademik terimler dizisidir.`,

    outputFormat:
      "Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    inputContext: `Aşağıda araştırmacının Tez Konumlandırma Matrisi sunulmuştur. Her kadran için Türkçe kutu yapısını (title, description, concepts) üretin.

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
