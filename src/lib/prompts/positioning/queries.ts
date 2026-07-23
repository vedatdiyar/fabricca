import type { PositioningMatrixInput } from "@/app/(onboarding)/onboarding/positioning/_lib/validation";

/** System instruction for FAZ 3 3-tier positioning query generation. */
export const POSITIONING_QUERIES_SYSTEM_INSTRUCTION = `Sen akademik tez veritabanlarında (Meilisearch) arama yapmak için yüksek duyarlılıklı ve geniş kapsayıcılıklı arama sorguları üreten uzman bir bilgi erişim uzmanısın.

GÖREV:
Sana sunulan 5 bileşenli Tez Konumlandırma Matrisini incele ve Meilisearch arama motorunda en alakalı tezleri kaçırmadan yakalamak için 3 BİRBİRİNİ TAMAMLAYAN KULVARDA akademik arama sorguları üret:

1. directQuery (Ana Konu & Aktör & Bağlam Sorgusu):
   - Çalışmanın temel odağını, araştırmanın öz nesnesini, aktörlerini ve dönemsel/coğrafi bağlamını doğrudan hedefleyen net kelimeler (Örn: "Kürt siyasal hareketi PKK HEP DEP HADEP 1990lar").

2. expandedQuery (Genişletilmiş Strateji & Söylem & Tematik Sorgu):
   - Çalışmanın kapsadığı daha geniş politik, stratejik, söylemsel dönüşüm ve legalleşme terimleri (Örn: "siyasallaşma söylem dönüşüm legalleşme silahlı mücadele Kürt meselesi").

3. conceptualQuery (Kuramsal Çerçeve & Metodolojik Sorgu):
   - Teorik yaklaşım, analitik kavramlar ve yöntemsel terimler (Örn: "manevra savaşı mevzi savaşı Gramsci hegemonya söylemsel pratik").

KRİTİK MEILISEARCH UYUMLULUK KURALLARI:
- Meilisearch tam metin aramasında 'OR', 'AND', 'NOT' kelimeleri arama terimi (literal word) olarak işlenir! Sorgularda ASLA 'OR', 'AND', 'NOT' veya '+', '-' gibi sözdizimi karakterleri KULLANMA.
- Tüm kelimeleri sadece aralarında birer boşluk bırakarak sade meilisearch uyumlu bir kelime dizesi şeklinde yaz.
- Yanıtı yalnızca belirtilen JSON şemasına harfiyen uyarak döndür.`;

/**
 * Builds user prompt for 3-tier positioning query generation.
 *
 * @param input - Positioning matrix input fields.
 * @returns Formatted prompt string.
 */
export function buildPositioningQueriesUserPrompt(
  input: PositioningMatrixInput,
): string {
  return `Aşağıdaki 5 bileşenli Tez Konumlandırma Matrisini analiz ederek 3 meilisearch uyumlu arama sorgusu üret:

1. Çalışmanın Odağı & Problemi: ${input.subjectAndProblem}
2. Teorik / Kavramsal Çerçeve: ${input.theoreticalFramework}
3. Analiz Birimi / Aktörler / Odak Nesne: ${input.unitOfAnalysis}
4. Metodoloji & Yöntem: ${input.methodology}
5. Kapsam & Sınırlar: ${input.scopeAndContext}`;
}
