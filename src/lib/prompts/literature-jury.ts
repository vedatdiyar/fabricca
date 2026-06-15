import type { JsonSchema } from "../gemini";

export const literatureJuryAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    starterPack: {
      type: "array",
      description:
        "En kritik 5 makale — dogrudan tez silsilesine katki sunacak birincil kaynaklar.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["PRIMARY", "SECONDARY"],
            description:
              "PRIMARY: dogrudan kuramsal/ampirik katki. SECONDARY: dolayli/arka plan katkisi.",
          },
          title: { type: "string" },
          abstract: { type: "string" },
          url: { type: "string" },
          doi: { type: "string" },
          publisher: { type: "string" },
          publicationYear: { type: "integer" },
          authors: {
            type: "array",
            items: { type: "string" },
          },
          strategicRecommendations: {
            type: "string",
            description:
              "Bu makalenin bu kutunun tez silsilesine neden ve nasil katki sunacagini aciklayan akademik gerekce.",
          },
        },
        required: [
          "type",
          "title",
          "doi",
          "authors",
          "strategicRecommendations",
        ],
      },
    },
    reservedPool: {
      type: "array",
      description:
        "Sonraki 15 makale — potansiyel katki saglayabilecek yedek havuz.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["PRIMARY", "SECONDARY"],
          },
          title: { type: "string" },
          abstract: { type: "string" },
          url: { type: "string" },
          doi: { type: "string" },
          publisher: { type: "string" },
          publicationYear: { type: "integer" },
          authors: {
            type: "array",
            items: { type: "string" },
          },
          strategicRecommendations: { type: "string" },
        },
        required: [
          "type",
          "title",
          "doi",
          "authors",
          "strategicRecommendations",
        ],
      },
    },
  },
  required: ["starterPack", "reservedPool"],
};

export const LITERATURE_JURY_ANALYSIS_SYSTEM_INSTRUCTION = `
<role>
Sen akademik literatur degerlendirmesi, semantik puanlama ve arastirma sentezi konularinda uzman kidemli bir juri uyesisin. Gorevin, belirli bir alt konu kutusu (sub-box) icin onceden elenmis makale adaylarini semantik olarak puanlamak, en kritik 5 makaleyi "Starter Pack" ve kalan potansiyellileri "Reserved Pool" olarak secmektir.
</role>

<instructions>
Cevap uretmeden once issel olarak su 3 adimli analitik plani islet:
1. **Eksenel Puanlama**: <sub_box> baglamindaki baslik (title), aciklama (description), kavramlar (concepts) ve teorisyenler (theorists) eksenlerinde her aday makaleyi semantik olarak puanla.
2. **Siniflandirma**: 3 kati kuralini uygulayarak her makaleyi PRIMARY veya SECONDARY olarak etiketle.
3. **Kota Yonetimi**: En yuksek puanli 5 makaleyi "starterPack" dizisine, sonraki en yuksek puanli 15 makaleyi "reservedPool" dizisine yerlestir.
</instructions>

<constraints>
- 3 Kati Kurali (Triple Filtration):
  a) Format Kriteri: Makale, kutuyla dogrudan kuramsal/ampirik katki sagliyorsa PRIMARY; dolayli, arka plan veya yontemsel katki sagliyorsa SECONDARY olarak isaretle.
  b) Yazar Kriteri: Makalenin yazarlari, kutunun teorisyenleri veya kavramsal alaniyla baglantiliysa bu durumu degerlendirmede dikkate al.
  c) Baglam Kriteri: Makalenin yayin yili, yayincisi ve arastirma baglami, kutunun kapsamina kronolojik ve tematik olarak uyumlu olmalidir.
- Stratejik Gerekce Zorunlulugu: Her makale icin "strategicRecommendations" alanina su sorunun cevabini mutlaka yaz: "Bu makale bu kutunun tez silsilesine neden ve nasil katki sunacak?"
- Kota Disiplini: "starterPack" tam 5, "reservedPool" tam 15 makale icermelidir. Eger yeterli aday yoksa mevcut en iyilerle listeyi doldur, eksik birakma.
- Nesnellik: Makaleleri puanlarken kisisel onyargilardan kacin, yalnizca kutunun akademik kapsamina ve semantik uyuma odaklan.
- Dil: "strategicRecommendations" alanlarini ve tum metin iceriklerini akici, elit bir akademik Turkce ile yaz.
</constraints>

<output_format>
Yalnizca literatureJuryAnalysisSchema yapisina tam uyumlu, gecerli ve temiz bir JSON nesnesi dondur.
</output_format>
`;

export function buildLiteratureJuryAnalysisPrompt(
  box: {
    title: string;
    description: string;
    concepts: string[];
    theorists: string[];
  },
  siftedCandidates: {
    doi: string;
    title: string;
    abstract: string;
    url?: string;
    publisher?: string;
    publicationYear?: number;
    authors: string[];
  }[],
): string {
  return `
<context>
Alt Konu Kutusu (Sub-box) Detaylari:
- Baslik: ${box.title}
- Aciklama: ${box.description}
- Kavramlar: ${box.concepts.join(", ")}
- Teorisyenler: ${box.theorists.join(", ")}

Surecten Gecmis (Keep: True) Makale Adaylari:
${JSON.stringify(siftedCandidates)}
</context>

<task>
Sistem talimatindaki "3 Kati Kurali" ve "Stratejik Gerekce Zorunlulugu" kurallarina uyarak, yukaridaki makale adaylarini semantik olarak puanla. En kritik 5 makaleyi "starterPack" ve sonraki 15 makaleyi "reservedPool" olarak sec. Her makale icin PRIMARY/SECONDARY turu atamasi yap ve akademik stratejik gerekce yaz.
</task>

<final_instruction>
Based on the sub-box context and sifted candidates provided above, execute your internal scoring plan and generate the JSON response now.
</final_instruction>
`;
}
