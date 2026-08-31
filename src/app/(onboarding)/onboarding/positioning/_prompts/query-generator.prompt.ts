/** Prompt payload structure separating system instructions from user prompt. */
export interface QueryGenerationPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

export interface MatrixInputForQuery {
  subjectProblem: string;
  theoreticalFramework?: string;
  methodology?: string;
  primaryMaterial?: string | null;
}

/**
 * Builds the hybrid XML/Markdown prompt payload for 4-channel multi-source query extraction:
 * 1. Qdrant (YÖK 366k Tez) - 2x Turkish queries
 * 2. OpenAlex & Semantic Scholar - 2x English queries
 * 3. Exa.ai (DergiPark & Field) - 2x Turkish queries
 *
 * @param matrix - The positioning matrix or raw proposal input.
 * @returns The structured prompt payload containing static systemInstruction and dynamic userPrompt.
 */
export function buildQueryGenerationPromptPayload(
  matrix: MatrixInputForQuery,
): QueryGenerationPromptPayload {
  const systemInstruction = `<role>
Kıdemli Araştırma Metodoloğu ve Çok Kanallı Akademik Bilgi Erişim (IR) Uzmanı.
</role>

<instructions>
# Görev ve Amaç
Kullanıcının araştırma konusunu, kuramsal çerçevesini ve yöntemini analiz ederek, 4 farklı akademik kanalda eşzamanlı taranacak toplam 7 odaklanmış sorgu ve anahtar kavramları üret.

# 7 Odaklı Sorgu Mimarisi
1. **thesisEmpiricalQuery (Qdrant - YÖK Tezleri / Türkçe):**
   - Türkiye'deki tez arşivinde benzer vakaları, konuları ve olguları yakalayacak 15-25 kelimelik yoğun Türkçe semantik sorgu.
2. **thesisMethodologyQuery (Qdrant - YÖK Tezleri / Türkçe):**
   - Araştırmanın yöntemini, kuramsal desenini, örneklem modelini veya yaklaşımını tarayacak Türkçe akademik sorgu.
3. **globalTheoreticalQuery (OpenAlex / İngilizce):**
   - Dünyadaki kuramsal modelleri, felsefi/sosyolojik paradigmaları ve kurucu teorisyenleri hedefleyen İngilizce akademik sorgu.
4. **globalEmpiricalQuery (OpenAlex / İngilizce):**
   - Küresel literatürdeki benzer olgusal araştırmaları, çağdaş tartışmaları ve etkili makaleleri hedefleyen İngilizce sorgu.
5. **semanticScholarQuery (Semantic Scholar / İngilizce):**
   - Semantic Scholar'ın anahtar kelime arama motoru için 3-6 kelimelik, araştırmanın en temel kavramlarını ve odağını birleştiren dolgusuz, öz İngilizce kavram sorgusu (örnek: "digital diplomacy artificial intelligence public diplomacy").
6. **dergiparkQuery (Exa.ai - DergiPark / Türkçe):**
   - Türkiye'deki hakemli dergilerde yayımlanmış makaleleri yakalayacak Türkçe akademik sorgu (örn: "DergiPark [temel kavramlar ve vaka]").
7. **fieldWebQuery (Exa.ai - Canlı Saha & Raporlar / Türkçe):**
   - Türkiye sahasındaki güncel sektörel verileri, mevzuatı, kurumsal raporları veya vaka dinamiklerini hedefleyen doğal dil sorgusu.
8. **substantiveKeywords:**
   - 4-6 adet spesifik Türkçe ve İngilizce anahtar kavram.

# Kurallar
- Tırnak işaretleri, bool operatörler (AND, OR, NOT) veya joker karakterler (*) KULLANMAYIN.
- Sorgular doğal, akıcı, zengin ve hedefe kilitli olmalıdır.
</instructions>`;

  const userPrompt = `<context>
[Araştırma Problemi ve Odak]:
${matrix.subjectProblem}

[Kuramsal Çerçeve]:
${matrix.theoreticalFramework || "Henüz belirtilmemiş"}

[Yöntem ve Saha]:
${matrix.methodology || "Henüz belirtilmemiş"}
</context>

<task>
Yukarıdaki <context> içeriğini inceleyerek, 4 kanallı literatür taraması için 7 odaklı arama sorgusunu ve anahtar kavramları JSON formatında üret.
</task>`;

  return { systemInstruction, userPrompt };
}
