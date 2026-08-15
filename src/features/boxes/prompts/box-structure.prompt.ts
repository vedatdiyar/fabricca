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
- **Tek Metodolojik Hat / Bütünleşik Yöntem (N=1):** Yöntemler aynı şemsiyeyi tamamlıyorsa TEK BİR ALT KUTU (N=1) olmalıdır.
- **Karma / Ayrık Metodolojik Kulvarlar (N>=2):** Karma yöntem varsa AYRI BİR ALT KUTU olarak bölünmelidir.

### KADRAN 4: PRIMARY_MATERIAL (Birincil Kaynak)
- **Bütünleşik Veri Seti (N=1):** Tüm kaynaklar aynı arşivden geliyorsa TEK BİR ALT KUTU (N=1) yeterlidir.
- **Ayrık Kaynak Türleri ve Koleksiyonlar (N>=2):** Farklı arşivler veya belge grupları belirtilmişse her biri müstakil ALT KUTU olmalıdır.

## Biçimsel ve Dil Standartları
- **Dinamik Başlıklar:** Başlıklar doğrudan matristeki spesifik kavram, aktör ve olgulara odaklanmalıdır.
- **Açıklamalar:** 100-180 karakter arasında, somut ve bilgilendirici olmalıdır.
- **Concepts Dizisi:** Sub-box seviyesinde en az 1, en fazla 4 elemandan oluşan somut akademik terimler dizisidir.`,

    workflowSteps: `1. Matristeki her kadranı bağımsız olarak incele.
2. Vaka aktörlerinin etkileşimine göre alt kutu sayısını belirle (N=1 veya N>=2).
3. Teorik çerçevedeki ekolleri ve yöntem yaklaşımlarını ayrıştır.
4. Başlık, açıklama ve kavram dizilerini oluşturup JSON şemasına uygun olarak üret.`,

    outputFormat:
      "Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir.",

    examples: `<example>
<input>
KADRAN 1: SUBJECT_PROBLEM
İlgili Matris Alanı: 1991-1999 döneminde Kürt siyasal hareketinin taleplerindeki niteliksel dönüşümü manevra savaşından mevzi savaşına geçiş bağlamında PKK ve legal partiler (HEP-DEP-HADEP) üzerinden inceler.

KADRAN 2: THEORETICAL_FRAMEWORK
İlgili Matris Alanı: Antonio Gramsci'nin hegemonya, mevzi savaşı ve pasif devrim kuramı; Ernesto Laclau ve Chantal Mouffe'un radikal demokrasi ve söylemsel hegemonya yaklaşımı.

KADRAN 3: METHODOLOGY
İlgili Matris Alanı: Söylem-tarihsel yaklaşım (DHA) ve nitel içerik analizi ile sistematik kodlama şeması.

KADRAN 4: PRIMARY_MATERIAL
İlgili Matris Alanı: HEP, DEP ve HADEP parti programları, seçim bildirgeleri, meclis grup tutanakları ve dönemin periyodik yayınları.
</input>
<output>
{
  "subjectProblem": {
    "title": "Kürt Siyasal Hareketinin Söylemsel Dönüşümü",
    "description": "1991-1999 döneminde PKK ve legal Kürt partilerinin talep ve strateji dönüşümü.",
    "subBoxes": [
      {
        "title": "Yasal ve Silahlı Hat Etkileşimi (1991-1999)",
        "description": "1990'lar boyunca HEP-DEP-HADEP çizgisi ile silahlı hareketin stratejik etkileşimi ve söylemsel evrimi.",
        "concepts": ["Kürt Siyasal Hareketi", "HEP-DEP-HADEP", "1991-1999 Dönemi", "Söylemsel Dönüşüm"]
      }
    ]
  },
  "theoreticalFramework": {
    "title": "Hegemonya ve Söylem Kuramları",
    "description": "Gramsciyen hegemonya ve post-Marksist söylemsel radikal demokrasi yaklaşımları.",
    "subBoxes": [
      {
        "title": "Gramsciyen Hegemonya ve Mevzi Savaşı",
        "description": "Antonio Gramsci'nin hegemonya, karşı-hegemonya, mevzi savaşı ve pasif devrim kuramsal çerçevesi.",
        "concepts": ["Hegemonya", "Mevzi Savaşı", "Karşı-Hegemonya", "Pasif Devrim"]
      },
      {
        "title": "Laclau ve Mouffe'un Söylemsel Hegemonya Kuramı",
        "description": "Radikal demokrasi, söylemsel eklemlenme ve kimlik inşası kuramsal modeli.",
        "concepts": ["Radikal Demokrasi", "Söylemsel Eklemlenme", "Hegemonik Mücadele"]
      }
    ]
  },
  "methodology": {
    "title": "Nitel Söylem ve İçerik Analizi",
    "description": "Metinlerin söylem-tarihsel yöntem ve kategori temelli kodlama ile çözümlenmesi.",
    "subBoxes": [
      {
        "title": "Söylem-Tarihsel Yaklaşım ve Kodlama Şeması",
        "description": "Siyasi metinlerin tarihsel bağlamında çözümlenmesi ve talep tipolojisi için sistematik kodlama.",
        "concepts": ["Söylem-Tarihsel Yaklaşım", "Nitel İçerik Analizi", "Kodlama Şeması", "Talep Tipolojisi"]
      }
    ]
  },
  "primaryMaterial": {
    "title": "Parti Belgeleri ve Tutanaklar Arşivi",
    "description": "1990'lı yıllara ait resmî parti yayınları, bildirgeler ve meclis zabıtları.",
    "subBoxes": [
      {
        "title": "Yasal Parti Belgeleri ve Meclis Tutanakları",
        "description": "HEP, DEP, HADEP kongre kararları, programları, seçim bildirgeleri ve TBMM zabıtları külliyatı.",
        "concepts": ["Parti Programları", "Seçim Bildirgeleri", "TBMM Tutanakları", "Dönem Süreli Yayınları"]
      }
    ]
  }
}
</output>
</example>`,

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
