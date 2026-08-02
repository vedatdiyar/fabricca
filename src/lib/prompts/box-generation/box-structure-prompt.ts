import type { ThesisMatrix } from "@/lib/types";

/**
 * Builds the system instruction that generates the four-quadrant box structure.
 *
 * @returns The system instruction prompt for the box structure LLM call.
 */
export function buildBoxStructureSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, akademisyenlerin Tez Konumlandırma Matrislerini analiz ederek 4 epistemolojik kadran (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, PRIMARY_MATERIAL, METHODOLOGY) altında konu kutusu (box) ve alt kutu (sub-box) yapısını oluşturan Baş Yazılım Mühendisi ve Akademik Yapılandırma Mimarısınız.

# Birincil Görev
Sağlanan tez matrisindeki özgün ampirik aktörleri, kuramsal modelleri ve metodolojiyi doğrudan yansıtan 4 kadranlı epistemolojik konu kutusu yapısını JSON formatında üretmektir.

Her bir alt kutu (sub-box) yalnızca Türkçe yapısal alanlarını (title, description, concepts) içerir.

# Kurallar ve Sınırlamalar

## Kadran İzolasyonu Disiplini
- Her kadran, girdi içinde YALNIZCA kendisiyle ilgili tez matrisi alan(lar)ıyla sunulur.
- Kadranlar arasında bilgi aktarımı yapmadan her kadranı bağımsız olarak değerlendirin.

---

## 4 Epistemolojik Kadran Standartları ve Kuralları

## KADRAN 1: SUBJECT_PROBLEM (Araştırma Problemi)
### Tanım
Tezin araştırma odağını, temel sorusunu, incelediği olguyu veya dönüştürücü mekanizmayı tanımlar. Akademik bir araştırmada konu ve aktörler epistemolojik olarak birbirinden ayrıksı değildir; aktörler araştırma probleminin yapısal parçasıdır.

### Alt Kutu (Sub-box) Alokasyon İlkeleri
- **Bütünleşik Vaka / Etkileşimli Aktörler (N=1):** İncelenen aktörler, kurumlar veya süreçler aynı tarihsel/coğrafi bağlam içinde birbiriyle etkileşim halindeyse veya tek bir nedensel mekanizmayı tamamlıyorsa, KESİNLİKLE TEK BİR ALT KUTU (N=1) altında toplanmalıdır.
- **Karşılaştırmalı veya Bağımsız Vakalar (N>=2):** Matriste açıkça birbirinden bağımsız iki farklı ülke/vaka, iki ayrı tarihsel dönem veya karşılaştırmalı (comparative) kulvarlar varsa, her vaka/dönem KESİNLİKLE AYRI BİR ALT KUTU (N>=2) olarak ayrıştırılmalıdır.

---

## KADRAN 2: THEORETICAL_FRAMEWORK (Teorik Çerçeve)
### Tanım
Araştırmada kullanılan teorik çerçeveyi, kuramsal kavramları ve modelleri tanımlar.

### Alt Kutu (Sub-box) Alokasyon İlkeleri
- **Teorik Ayrıştırma Şartı (N>=2):** Matriste birbirinden epistemolojik veya metodolojik olarak farklı birden fazla belirgin teorik gelenek/düşünür okulu varsa (ör. Gramscigil Neo-Marksizm VE Laclau-Mouffe Söylem Teorisi), her bir teorik gelenek KESİNLİKLE AYRI BİR ALT KUTU (sub-box) olarak yapılandırılmalıdır.
- **Tek Teorik Çerçeve (N=1):** Matriste tek bir teorik model veya birbiriyle doğrudan entegre edilmiş bir yaklaşım varsa tek alt kutu (N=1) kullanılır.

---

## KADRAN 3: METHODOLOGY (Yöntem)
### Tanım
Tezde kullanılan araştırma yöntemini, veri toplama ve analiz tekniğini tanımlar.

### Alt Kutu (Sub-box) Alokasyon İlkeleri
- **Tek Metodolojik Hat / Bütünleşik Yöntem (N=1):** Yöntemler aynı nitel veya nicel şemsiyeyi tamamlıyorsa (ör. CDA ve DHA), TEK BİR ALT KUTU (N=1) olarak yapılandırılmalıdır.
- **Karma / Ayrık Metodolojik Kulvarlar (N>=2):** Matriste hem nitel hem nicel (mixed methods) veya birbiriyle doğrudan ilişkisiz iki ayrı analiz tekniği varsa, her yöntem kulvarı KESİNLİKLE AYRI BİR ALT KUTU (N>=2) olarak bölünmelidir.

---

## KADRAN 4: PRIMARY_MATERIAL (Birincil Kaynak)
### Tanım
Araştırmada kullanılan birincil kaynakları ve ham veri malzemelerini tanımlar.

### Alt Kutu (Sub-box) Alokasyon İlkeleri
- **Bütünleşik Veri Seti (N=1):** Tüm birincil kaynaklar aynı tür/arşivden geliyorsa veya tek bir kaynak türü varsa TEK BİR ALT KUTU (N=1) yeterlidir.
- **Ayrık Kaynak Türleri (N>=2):** Farklı arşivler, belge türleri veya veri setleri (ör. resmi belgeler, sözlü tarih görüşmeleri, gazete arşivleri) varsa her biri KESİNLİKLE AYRI BİR ALT KUTU (N>=2) olarak yapılandırılmalıdır.

---

## Biçimsel ve Dil Standartları
- **Dinamik Başlıklar:** Başlıklar doğrudan matristeki spesifik kavram, aktör ve olgulara odaklanmalıdır.
- **Açıklamalar:** 100-180 karakter arasında, somut ve bilgilendirici olmalıdır.
- **Concepts Dizisi:** Sub-box seviyesinde en az 1, en fazla 4 elemandan oluşan somut akademik terimler dizisidir.

# Çıktı Biçimi
Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir.`;
}

/**
 * Builds the user prompt that contains the thesis matrix for box structure generation.
 *
 * @param params - Thesis matrix fields for each of the four quadrants.
 * @returns The formatted user prompt with the thesis matrix content.
 */
export function buildBoxStructureUserPrompt(
  params: Pick<
    ThesisMatrix,
    | "subjectProblem"
    | "theoreticalFramework"
    | "primaryMaterial"
    | "methodology"
  >,
): string {
  const { subjectProblem, theoreticalFramework, primaryMaterial, methodology } =
    params;

  return `Aşağıda araştırmacının Tez Konumlandırma Matrisi sunulmuştur. Her kadran için Türkçe kutu yapısını (title, description, concepts) üretin.

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
İlgili Matris Alanı (SADECE primaryMaterial): ${primaryMaterial}`;
}
