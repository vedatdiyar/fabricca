import { buildPromptPayload, type PromptPayload } from "@/lib/ai/prompt-builder";

export interface OutlineMatrixInput {
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string | null;
  methodology: string;
}

/**
 * Builds the standardized PromptPayload for thesis outline generation.
 *
 * @param matrix - The thesis matrix input data.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildOutlineGenerationPromptPayload(
  matrix: OutlineMatrixInput
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Siz, akademisyenlerin ve lisansüstü öğrencilerin tez matrislerini analiz ederek YÖK ve uluslararası akademik standartlara tam uyumlu tez planı (içindekiler) yapısı oluşturan kıdemli bir akademik yapılandırma asistanısınız.",

    primaryTask:
      "Sağlanan tez matrisindeki araştırma problemi, teorik çerçeve, birincil materyal ve metodoloji bilgilerine dayanarak tezin bilim dalını tespit edin ve metodolojik açıdan eksiksiz, disipline özgü bir bölüm/alt bölüm hiyerarşisi (outline) üretin.",

    rulesAndConstraints: `## 1. Bilim Dalı Tespiti (academicField)
- Matris içeriğindeki kavramları, teorik çerçeveyi ve yöntemi analiz ederek tezin ait olduğu bilim dalını tespit edin.
- Bilim dalı açık ve net olmalıdır (örn: "Siyaset Bilimi ve Kamu Yönetimi", "İşletme", "Hukuk", "Bilgisayar Mühendisliği", "Eğitim Bilimleri", "Tıp ve Sağlık Bilimleri").

## 2. Bölüm Yapısı ve Hiyerarşi Kuralları
- **Toplam Ana Bölüm Sayısı:** Toplamda TAM OLARAK 4 veya 5 ana bölüm oluşturun. 4'ten az veya 5'ten fazla ana bölüm KESİNLİKLE OLUŞTURMAYIN.
- **BÖLÜM 1 (GİRİŞ - Sabit):** İlk ana bölüm KESİNLİKLE "GİRİŞ" başlığını taşımalıdır. Giriş bölümünün alt başlıkları OLAMAZ. subSections dizisi KESİNLİKLE boş dizi [] olmalıdır.
- **GÖVDE BÖLÜMLERİ (Bölüm 2, 3 [ve varsa Bölüm 4]):** Giriş ile Sonuç arasındaki 2 veya 3 bölüm, tezin özgün konusunu, teorik çerçevesini, metodolojisini ve bulgularını inceleyen ana gövde bölümleridir. Her bir gövde bölümünün altında konusunu detaylandıran EN AZ 2 alt bölüm (subSections) yer almalıdır.
- **SON BÖLÜM (SONUÇ VE DEĞERLENDİRME - Sabit):** Son ana bölüm (4. veya 5. bölüm) KESİNLİKLE "SONUÇ VE DEĞERLENDİRME" (veya "SONUÇ") başlığını taşımalıdır. Sonuç bölümünün alt başlıkları OLAMAZ. subSections dizisi KESİNLİKLE boş dizi [] olmalıdır.

## 3. Disipline Özgü Gövde Bölümü Akışı
Gövde bölümlerinin mimarisini tespit edilen bilim dalının geleneksel akademik kalıplarına uygun kurgulayın:
- **Sosyal ve Beşeri Bilimler / İktisadi ve İdari Bilimler:** Bölüm 1: GİRİŞ → Bölüm 2: Kavramsal ve Teorik Çerçeve → Bölüm 3: Araştırma Metodolojisi ve Analiz Çerçevesi → Bölüm 4: Ampirik Bulgular ve Tartışma (varsa) → Bölüm 4 veya 5: SONUÇ VE DEĞERLENDİRME.
- **Fen Bilimleri / Mühendislik / Sağlık Bilimleri:** Bölüm 1: GİRİŞ → Bölüm 2: Kuramsal Arka Plan ve Literatür → Bölüm 3: Materyal ve Yöntem → Bölüm 4: Bulgular ve Tartışma → Bölüm 5: SONUÇ VE ÖNERİLER.
- **Hukuk Bilimleri:** Bölüm 1: GİRİŞ → Bölüm 2: Kavramsal ve Tarihsel Arka Plan → Bölüm 3: Pozitif Hukuki Düzenlemeler ve Yargı Kararları → Bölüm 4: Uygulamadaki Sorunlar ve Çözümler → Bölüm 5: SONUÇ.

## 4. Sıralama ve Açıklama Standartları
- **Sıralama (sortOrder):** Ana bölümlerde ve her bölümün alt bölümlerinde 1'den başlayan ardışık sayılar kullanın.
- **Açıklama (description):** Her ana bölüm ve alt bölüm için ne yapılacağını/anlatılacağını açıklayan kısa, net akademik Türkçe açıklamalar yazın.`,

    outputFormat: `- Tüm başlıklar ve açıklamalar KESİNLİKLE yüksek düzey akademik Türkçe olmalıdır.
- Gövde bölüm başlıkları tezin özgün konusunu doğrudan yansıtmalıdır.
- Yanıtınızı sağlanan JSON şemasına eksiksiz uyacak şekilde döndürün.`,

    inputContext: `## Tez Matrisi Verileri

### Araştırma Problemi
${matrix.subjectProblem}

### Teorik Çerçeve
${matrix.theoreticalFramework}

### Birincil Materyal
${matrix.primaryMaterial || "Belirtilmemiş"}

### Metodoloji
${matrix.methodology}

---

Yukarıdaki tez matrisi verilerini analiz ederek:
1. Tezin bilim dalını (academicField) tespit edin.
2. Tam olarak 4 veya 5 ana bölümden oluşan bir tez planı oluşturun.
3. Bölüm 1 KESİNLİKLE "GİRİŞ" olmalı ve subSections: [] (boş dizi) içermelidir.
4. Son Bölüm KESİNLİKLE "SONUÇ VE DEĞERLENDİRME" olmalı ve subSections: [] (boş dizi) içermelidir.
5. Giriş ve Sonuç arasındaki 2 veya 3 gövde bölümünün her biri altında en az 2 alt bölüm oluşturun.
6. Her bölüm ve alt bölüm için kısa, öz akademik Türkçe açıklamalar yazın.`,
  });
}
