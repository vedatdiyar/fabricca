import type { Matrix, Box, Outline } from "@/core/db/schema";

interface RealignmentPromptInput {
  matrix: Matrix;
  updatedField: string;
  existingBoxes: Box[];
  existingOutlines: Outline[];
}

/**
 * Builds the system instruction and user prompt for the Matrix Realignment cascade.
 *
 * @param input - Context containing the matrix, updated fields, existing boxes and outlines.
 * @returns System instruction and user prompt payload.
 */
export function buildRealignmentPromptPayload(input: RealignmentPromptInput) {
  const systemInstruction = `Sen kıdemli bir akademik tez danışmanı ve metodoloji uzmanısın.
Görevin: Bir tez matrisinde (Konu/Problem, Kuramsal Çerçeve, Birincil Materyal veya Metodoloji) meydana gelen bir değişikliği incelemek; bu değişikliğin tezin araştırma kutularına (Topic Boxes) ve bölüm planına olan etkisini analiz etmek ve yeni kuramsal/metodolojik odağı destekleyecek yeni araştırma alt kutuları (ve bunların İngilizce akademik arama sorgularını - semanticQuery) üretmektir.

KURALLAR:
1. Analiz ve kutu açıklamaları akıcı, yetkin ve yüksek standartlı akademik Türkçe ile yazılmalıdır.
2. KATI SADAKAT VE KISITLAMA (STRICT GROUNDING): Üretilecek her yeni alt kutu ('newSubBoxes') ve güncellenecek sütun başlığı ('updatedPillarTitle') YALNIZCA güncellenen yeni tez matrisinde açıkça yer alan kavram, düşünür ve yöntemlere dayanmalıdır. Matriste yer almayan hiçbir harici kavramı veya teorik ekolü dışarıdan eklemeyin/uydurmayın.
3. Üretilecek her yeni alt kutu için mutlaka 'semanticQuery' alanı tanımlanmalıdır.
4. 'semanticQuery' kesinlikle İNGİLİZCE olmalıdır. OpenAlex veritabanı için maksimum 15 kelimeden oluşan, boolean operatörler (AND, OR, NOT) veya tırnak işareti İÇERMEYEN, matristeki kavramlara doğrudan kilitlenmiş spesifik ve yüksek akademik isabetli anahtar terimler zinciri olmalıdır. (Örn: "Pierre Bourdieu field theory habitus political movement collective action").
5. 1 ile 3 adet arasında odaklanmış, birbirini tekrar etmeyen alt kutu üret.`;

  const existingBoxesSummary = input.existingBoxes
    .map(
      (b) =>
        `- [Kutu ID: ${b.id}] (${b.boxType}) ${b.title}: ${b.description ?? "Açıklama yok"}${
          b.semanticQuery ? ` (Semantik: ${b.semanticQuery})` : ""
        }`,
    )
    .join("\n");

  const existingOutlinesSummary = input.existingOutlines
    .map((o) => `- ${o.title} (${o.academicField ?? "Genel"})`)
    .join("\n");

  const userPrompt = `### GÜNCELLENEN TEZ MATRİSİ:
- **Konu ve Problem:** ${input.matrix.subjectProblem ?? "Belirtilmemiş"}
- **Kuramsal Çerçeve:** ${input.matrix.theoreticalFramework ?? "Belirtilmemiş"}
- **Birincil Materyal / Veri:** ${input.matrix.primaryMaterial ?? "Belirtilmemiş"}
- **Yöntem ve Metodoloji:** ${input.matrix.methodology ?? "Belirtilmemiş"}

### GÜNCELLENEN ALAN / ALANLAR:
${input.updatedField}

### MEVCUT ARAŞTIRMA KUTULARI:
${existingBoxesSummary || "Henüz kutu tanımlanmamış."}

### MEVCUT BÖLÜM PLANI:
${existingOutlinesSummary || "Henüz bölüm planı tanımlanmamış."}

Yukarıdaki matris değişimini değerlendir. Yeni kuram/metot/problem doğrultusunda:
1. Değişimin mimari etkisini özetle ('analysisSummary').
2. Hangi ana kadranın doğrudan etkilendiğini belirt ('affectedBoxType').
3. Etkilenen ana sütunun (root pillar) başlığını yeni kuramsal/metodolojik odağa uyacak şekilde güncelle ('updatedPillarTitle', örn. "Bourdieu ve Alan Kuramı Çerçevesi").
4. Eski kurama/odağa ait olup artık geçerliliğini yitiren mevcut alt kutu ID'lerini 'obsoleteSubBoxIds' listesine ekle. Bu kutular ve bunlara bağlı eski kaynaklar sistem tarafından otomatik temizlenecektir.
5. Yeni matrisi destekleyecek 1-3 adet yeni araştırma alt kutusu üret ('newSubBoxes'). Her biri için başlık, açıklama, kavramlar ve İngilizce 'semanticQuery' üret.
6. Bölüm planı için tavsiyelerini 'outlineSuggestions' dizisine ekle.`;

  return {
    systemInstruction,
    userPrompt,
  };
}
