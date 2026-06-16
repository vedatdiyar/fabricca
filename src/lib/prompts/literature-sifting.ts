import type { JsonSchema } from "../gemini";

export const literatureSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    siftedResults: {
      type: "array",
      items: {
        type: "object",
        properties: {
          doi: { type: "string" },
          title: { type: "string" },
          keep: { type: "boolean" },
        },
        required: ["doi", "title", "keep"],
      },
    },
  },
  required: ["siftedResults"],
};

export const LITERATURE_SIFTING_SYSTEM_INSTRUCTION = `
<role>
Sen akademik bilgi erişimi, literatür taraması ve hızlı konu sınıflandırması konularında uzman, ultra hızlı çalışan bir filtreleme motorusun. Görevin, geniş bir makale havuzundan yalnızca belirli bir akademik alt konu kutusuyla (sub-box) veya tezin küresel matrisiyle anlamsal olarak bağlantılı olanları ikili (binary) kararla süzmektir.
</role>

<instructions>
1. Sana sağlanan <global_context> (tez matrisi) ve <sub_box> bağlamını (başlık, açıklama) analiz et.
2. <candidates_list> içindeki her bir makale adayını, başlık ve özetini (abstract) kullanarak hem <sub_box> kapsamıyla hem de tezin küresel matrisiyle karşılaştır.
3. Her aday için sadece ve sadece ikili bir karar ver: "keep: true" (tutulmalı) veya "keep: false" (elenmeli).
</instructions>

<constraints>
- TEZ MATRİSİ UYUMLULUK TESTİ (Thesis Matrix Alignment Gate):
  Her aday makaleyi tezin küresel matrisindeki araştırma sorusu, kuramsal çerçeve ve tarihsel/mekansal sınırlılıklar ışığında değerlendir. Bir makale, alt kutu konseptiyle dolaylı da olsa, tezin küresel matrisine teorik, metodolojik veya kavramsal düzeyde katma değer sunuyorsa "keep: true" değerlendirmesine açık ol.

- KURAMSAL/YÖNTEMSEL GENİŞLİK ESNEKLİĞİ (Theoretical/Methodological Breadth Allowance):
  Kullanıcının araştırma nesnesinin (ülke, dönem, evren) doğrudan dışında kalan saf kuramsal veya yöntemsel makalelere esneklik tanı. Eğer bir makale tezin kuramsal çerçevesini operasyonelleştirecek, metodolojik model sunacak veya kavramsal araçlar sağlayacak nitelikteyse — ampirik odağı tezle aynı olmasa bile — "keep: true" verilebilir. Bu esneklik aşağıdaki üç boyutlu katma değer filtresini geçersiz kılmaz.

- ÜÇ BOYUTLU KATMA DEĞER FİLTRESİ (Three-Dimensional Value Filter):
  Her aday makaleyi şu üç boyutta tez matrisiyle kesişimi açısından test et:
  a) BAĞLAMSAL BOYUT: Makalenin ampirik odağı tezin tarihsel/mekansal sınırlılıklarıyla örtüşüyor mu?
  b) KURAMSAL BOYUT: Makale tezin kuramsal çerçevesiyle (teoriler, kavramlar) anlamsal kesişim gösteriyor mu?
  c) YÖNTEMSEL BOYUT: Makale tezin metodolojik tasarımına ışık tutacak model veya yöntem sunuyor mu?

  Eğer bir makale bu üç boyuttan en az birinde tez matrisine somut katma değer sunuyorsa "keep: true" koridoruna girebilir. Hiçbir boyutta katkısı olmayan makaleler — hangi disiplinden veya alandan gelirse gelsin — ACIMASIZCA ELENİR.

- SIFIR GEVEZELİK (No Reasoning):
  Kararların için asla ama asla bir gerekçe, metin veya açıklama üretme. Sadece ham yapısal kararı (true/false) döndür.
</constraints>

<output_format>
Yalnızca literatureSiftingSchema yapısına tam uyumlu, içeriklerinde hiçbir metinsel gerekçe/açıklama barındırmayan, geçerli ve temiz bir JSON nesnesi döndür.
</output_format>
`;

export function buildLiteratureSiftingPrompt(
  box: {
    title: string;
    description: string;
  },
  candidates: {
    doi: string;
    title: string;
    abstract: string;
    authors: string[];
  }[],
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    historicalSpatialLimits: string;
  },
): string {
  return `
<context>
Alt Konu Kutusu (Sub-box) Detayları:
- Başlık: ${box.title}
- Açıklama: ${box.description}

Değerlendirilecek Makale Adayları:
${JSON.stringify(
  candidates.map((c) => ({
    doi: c.doi,
    title: c.title,
    abstract: c.abstract,
    authors: c.authors,
  })),
)}
</context>

<global_context>
Tez Matrisi (Küresel Bağlam):
- Çalışma Başlığı: ${thesisCtx.studyTitle}
- Araştırma Sorusu: ${thesisCtx.researchQuestion}
- Kuramsal Çerçeve: ${thesisCtx.theoreticalFramework}
- Tarihsel/Mekansal Sınırlılıklar: ${thesisCtx.historicalSpatialLimits}
</global_context>

<task>
Sistem talimatındaki "Tez Matrisi Uyumluluk Testi" ve "Üç Boyutlu Katma Değer Filtresi" kurallarına harfiyen uyarak, yukarıdaki aday listesindeki her bir makaleyi "keep: true" veya "keep: false" olarak işaretle. Kesinlikle açıklama veya gerekçe metni üretme.
</task>

<final_instruction>
Yukarıda sağlanan alt kutu bağlamını ve aday listesini temel alarak, acımasız eleme kurallarını uygula ve şimdi JSON yanıtını oluştur.
</final_instruction>
`;
}
