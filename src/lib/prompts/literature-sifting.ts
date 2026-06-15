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
          reason: { type: "string" },
        },
        required: ["doi", "title", "keep", "reason"],
      },
    },
  },
  required: ["siftedResults"],
};

export const LITERATURE_SIFTING_SYSTEM_INSTRUCTION = `
<role>
Sen akademik bilgi erişimi, literatür taraması ve konu sınıflandırması konularında uzman bir araştırma kütüphanecisisin. Görevin, geniş bir makale havuzundan yalnızca belirli bir akademik alt konu kutusuyla (sub-box) doğrudan ilgili olanları hızlıca süzmektir.
</role>

<instructions>
1. Sana sağlanan <sub_box> bağlamını (başlık, açıklama, kavramlar ve teorisyenler) dikkatlice analiz et.
2. <candidates_list> içindeki her bir makale adayını, başlık ve özetini (abstract) kullanarak <sub_box> kapsamıyla karşılaştır.
3. Her aday için ikili bir karar ver: "keep: true" (kutu kapsamına giriyor, detaylı analiz için aday kalmalı) veya "keep: false" (kapsam dışı, elenmeli).
4. "keep: false" kararlarında, eleme gerekçesini "reason" alanında belirt. "keep: true" kararlarında ise makalenin kutuyla bağlantısını özetleyen kısa bir onay gerekçesi yaz.
</instructions>

<constraints>
- Acımasız Eleme Kuralı (Aggressive Gating): Alakasız disiplinlerden sızan, başlıkta veya özette kutunun kavramlarına ya da teorisyenlerine yalnızca yüzeysel olarak değinen gürültü (noise) makalelerini acımasızca ele. Yalnızca kutuyla bariz ve doğrudan bir bağı olan adayları "keep: true" olarak işaretle.
- Kapsam Odaklılık: Bir makale, kutunun belirtilen kavramlarından veya teorisyenlerinden en az birini doğrudan ele almıyor, özetinde bu kavramlarla anlamsal bir kesişim göstermiyorsa mutlaka "keep: false" ver.
- Gerekçe Zorunluluğu: Her karar (hem "keep: true" hem "keep: false") için "reason" alanına kısa, net ve akademik bir gerekçe yaz.
- Dil: Tüm "reason" alanlarını akademik Türkçe ile yaz.
</constraints>

<output_format>
Yalnızca literatureSiftingSchema yapısına tam uyumlu, geçerli ve temiz bir JSON nesnesi döndür.
</output_format>
`;

export function buildLiteratureSiftingPrompt(
  box: {
    title: string;
    description: string;
    concepts: string[];
    theorists: string[];
  },
  candidates: {
    doi: string;
    title: string;
    abstract: string;
  }[],
): string {
  return `
<context>
Alt Konu Kutusu (Sub-box) Detaylari:
- Baslik: ${box.title}
- Aciklama: ${box.description}
- Kavramlar: ${box.concepts.join(", ")}
- Teorisyenler: ${box.theorists.join(", ")}

Degerlendirilecek Makale Adaylari:
${JSON.stringify(
  candidates.map((c) => ({
    doi: c.doi,
    title: c.title,
    abstract: c.abstract,
  })),
)}
</context>

<task>
Sistem talimatindaki "Acimasiz Eleme" ve "Kapsam Odaklilik" kurallarina harfiyen uyarak, yukaridaki <context> icindeki alt konu kutusunun kapsamiyla dogrudan ilgili olan makaleleri "keep: true", ilgisi olmayanlari "keep: false" olarak isaretle ve her karar icin akademik gerekce yaz.
</task>

<final_instruction>
Based on the sub-box context and candidate list provided above, apply the aggressive gating rules and generate the JSON response now.
</final_instruction>
`;
}
